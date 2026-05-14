"""
Módulo FCPN — Agentes Kardex & Información
============================================
VERSIÓN DEFINITIVA - Optimizada para búsqueda de horarios y docentes
"""

from __future__ import annotations

import os
import re
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

# ── Configuración ────────────────────────────────────────────
_OPENAI_ENDPOINT    = os.getenv("FCPN_AZURE_OPENAI_ENDPOINT", "").rstrip("/")
_OPENAI_KEY         = os.getenv("FCPN_AZURE_OPENAI_API_KEY", "")
_DEPLOYMENT         = os.getenv("FCPN_AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")
_API_VERSION        = os.getenv("FCPN_AZURE_OPENAI_API_VERSION", "2025-01-01-preview")
_SEARCH_ENDPOINT    = os.getenv("FCPN_AZURE_SEARCH_ENDPOINT", "").rstrip("/")
_SEARCH_QUERY_KEY   = os.getenv("FCPN_AZURE_SEARCH_QUERY_KEY", "")
_SEARCH_INDEX       = os.getenv("FCPN_AZURE_SEARCH_INDEX", "")

_CHAT_URL = f"{_OPENAI_ENDPOINT}/openai/deployments/{_DEPLOYMENT}/chat/completions?api-version={_API_VERSION}"
_SEARCH_SELECT      = "id,chunk_id,parent_id,chunk,title,category"
_SEARCH_API_VERSION = "2024-07-01"
_SEMANTIC_CONFIG    = "config-semantica-rag"

# ── Pydantic models ──────────────────────────────────────────
class FcpnAgentID(str, Enum):
    kardex      = "kardex"
    informacion = "informacion"

class FcpnChatMessage(BaseModel):
    role:    str = Field(..., pattern="^(user|assistant)$")
    content: str = Field(..., min_length=1, max_length=4000)

class FcpnChatRequest(BaseModel):
    agent_id:        FcpnAgentID
    messages:        list[FcpnChatMessage] = Field(..., min_length=1)
    session_id:      Optional[str]         = None
    use_rag:         bool                  = True
    category_filter: Optional[str]         = None

class FcpnSearchDoc(BaseModel):
    title:    str
    content:  str
    category: Optional[str]  = None
    source:   Optional[str]  = None
    score:    Optional[float] = None

class FcpnCitedDoc(BaseModel):
    filename:         str
    document_type:    str = "pdf"
    relevance_reason: str
    preview_url:      Optional[str] = None

class FcpnChatResponse(BaseModel):
    session_id:     str
    agent_id:       FcpnAgentID
    reply:          str
    cited_document: Optional[FcpnCitedDoc]   = None
    search_results: list[FcpnSearchDoc]       = Field(default_factory=list)
    model:          str
    rag_used:       bool     = False
    created_at:     datetime = Field(default_factory=datetime.utcnow)

# ── System Prompts ───────────────────────────────────────────
_SYSTEM_PROMPTS = {
    FcpnAgentID.kardex: """Eres el Agente Kardex de la FCPN (UMSA).

REGLAS:
1. Si hay documentos en el contexto, USA ESA INFORMACIÓN para responder.
2. Si el usuario pregunta por horarios de docentes, búscalos en el contexto.
3. NO inventes información que no esté en los documentos.
4. Responde siempre en español, de forma clara y ordenada.
5. Si el contexto contiene horarios, extráelos y preséntalos de manera legible.""",

    FcpnAgentID.informacion: """Eres el Agente de Información de la FCPN (UMSA). Responde usando el contexto proporcionado. Sé amable y conciso. Responde en español.""",
}

# ── FUNCIÓN CLAVE: Optimización de búsqueda para nombres ─────
def _extract_search_query(messages: list[FcpnChatMessage]) -> str:
    """
    Extrae y optimiza la consulta de búsqueda a partir de los mensajes del usuario.
    Especialmente diseñado para buscar nombres de docentes y horarios.
    """
    # Obtener todos los mensajes del usuario
    user_msgs = [m.content for m in messages if m.role == "user"]
    if not user_msgs:
        return ""
    
    # Tomar el último mensaje y parte del anterior si existe
    last_msg = user_msgs[-1]
    prev_context = user_msgs[-2] if len(user_msgs) > 1 else ""
    
    full_query = f"{prev_context} {last_msg}".strip()
    
    # Limpiar y normalizar
    full_query = full_query.replace("ñ", "n")
    
    # Extraer nombres de docentes (patrón: "Lic.", "Doc.", nombre con mayúsculas)
    patterns = [
        r'(?:Lic|Doc|Dr|Prof)\.?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',  # Título + nombre
        r'(?:del?\s+)?([A-Z][a-záéíóú]+(?:\s+[A-Z][a-záéíóú]+){1,3})',  # Nombre completo
        r'(Jorge|Juan|Carlos|Maria|Ana|Luis|Jose)(?:\s+[A-Z][a-z]+){1,2}',  # Nombres comunes
        r'(Teran|Pomier|Felipez|Llanque|Tellez|Hurtado|Huanca|Orihuela|Flores)',  # Apellidos
    ]
    
    found_names = []
    for pattern in patterns:
        matches = re.findall(pattern, full_query, re.IGNORECASE)
        for m in matches:
            if isinstance(m, tuple):
                m = m[0]
            if len(m) > 3 and m.lower() not in [n.lower() for n in found_names]:
                found_names.append(m.strip())
    
    # Si encontramos nombres, priorizarlos
    if found_names:
        # Buscar también "horario" o horarios específicos
        if re.search(r'horario|atencion|clase|clases', full_query, re.IGNORECASE):
            search_query = f"horario {' '.join(found_names)}"
        else:
            search_query = ' '.join(found_names)
        print(f"[FCPN] Extraídos nombres: {found_names} → query: '{search_query}'")
        return search_query
    
    # Fallback: usar el último mensaje completo
    return last_msg


def _expand_search_query(query: str) -> str:
    """
    Expande la consulta con variaciones para mejorar la búsqueda.
    Ejemplo: "Jorge Teran" → "Jorge Teran OR Jorge Humberto Teran OR Teran Pomier"
    """
    if not query or len(query) < 5:
        return query
    
    # Detectar si es un nombre
    name_parts = query.split()
    if len(name_parts) >= 2:
        first_name = name_parts[0]
        last_name = name_parts[-1]
        
        # Variaciones comunes
        variations = [query]
        
        # Si es como "Jorge Teran", añadir "Jorge Humberto Teran"
        if first_name == "Jorge":
            variations.append(f"Jorge Humberto Teran")
            variations.append(f"Jorge Humberto Teran Pomier")
        
        # Añadir solo el apellido
        variations.append(last_name)
        
        # Construir consulta con OR
        expanded = " OR ".join(variations)
        print(f"[FCPN] Query expandida: '{query}' → '{expanded}'")
        return expanded
    
    return query


# ── Azure AI Search ──────────────────────────────────────────
async def _call_search(client: httpx.AsyncClient, payload: dict) -> dict | None:
    url = f"{_SEARCH_ENDPOINT}/indexes/{_SEARCH_INDEX}/docs/search"
    headers = {"Content-Type": "application/json", "api-key": _SEARCH_QUERY_KEY}
    try:
        r = await client.post(url, params={"api-version": _SEARCH_API_VERSION},
                              headers=headers, json=payload)
        r.raise_for_status()
        return r.json()
    except httpx.HTTPStatusError as e:
        print(f"[FCPN] Search HTTP {e.response.status_code}: {e.response.text[:200]}")
        return None
    except httpx.RequestError as e:
        print(f"[FCPN] Search connection error: {e}")
        return None


def _parse_results(data: dict) -> list[FcpnSearchDoc]:
    docs = []
    for item in data.get("value", []):
        content = (item.get("chunk") or "").strip()
        if not content:
            captions = item.get("@search.captions") or []
            content = captions[0].get("text", "").strip() if captions else ""
        if not content:
            continue
        score = item.get("@search.rerankerScore") or item.get("@search.score")
        docs.append(FcpnSearchDoc(
            title=item.get("title") or "Documento",
            content=content[:2000],
            category=item.get("category"),
            source=item.get("parent_id") or item.get("chunk_id") or "",
            score=round(float(score), 4) if score else None,
        ))
    return docs


async def _search_docs(query: str, top: int = 5,
                        category_filter: Optional[str] = None) -> list[FcpnSearchDoc]:
    if not _SEARCH_ENDPOINT or not _SEARCH_QUERY_KEY or not _SEARCH_INDEX:
        return []
    
    # Expandir la consulta si es necesario
    expanded_query = _expand_search_query(query)
    
    print(f"[FCPN] Buscando: '{expanded_query}'")
    
    odata = f"category eq '{category_filter}'" if category_filter else None
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        payload_sem: dict = {
            "search": expanded_query,
            "top": top * 2,
            "select": _SEARCH_SELECT,
            "queryType": "semantic",
            "semanticConfiguration": _SEMANTIC_CONFIG,
            "captions": "extractive",
            "answers": "extractive|count-3",
            "searchMode": "all",
        }
        if odata:
            payload_sem["filter"] = odata
        data = await _call_search(client, payload_sem)

        if data is None:
            payload_sim: dict = {
                "search": expanded_query,
                "top": top * 2,
                "select": _SEARCH_SELECT,
                "queryType": "simple",
                "searchMode": "any",
            }
            if odata:
                payload_sim["filter"] = odata
            data = await _call_search(client, payload_sim)

        if data is None:
            return []

    results = _parse_results(data)
    print(f"[FCPN] Encontrados {len(results)} resultados")
    
    # Ordenar por score
    results.sort(key=lambda x: x.score if x.score else 0, reverse=True)
    return results[:top]


def _build_rag_context(docs: list[FcpnSearchDoc]) -> str:
    if not docs:
        return ""
    parts = ["=== INFORMACIÓN DE DOCUMENTOS INSTITUCIONALES ==="]
    for i, d in enumerate(docs, 1):
        parts.append(f"[Documento {i}] {d.title}")
        parts.append(f"{d.content}")
        parts.append("─" * 50)
    parts.append("=== FIN DE DOCUMENTOS ===")
    return "\n".join(parts)


# ── Router ────────────────────────────────────────────────────
router = APIRouter(prefix="/fcpn", tags=["FCPN · Kardex & Información"])


@router.get("/health")
def fcpn_health():
    return {"status": "ok", "module": "FCPN", "rag_ready": bool(_SEARCH_ENDPOINT and _SEARCH_QUERY_KEY and _SEARCH_INDEX)}


@router.get("/agents")
def fcpn_agents():
    return [
        {"id": "kardex", "name": "Agente Kardex", "role": "Historial académico y notas"},
        {"id": "informacion", "name": "Agente Información", "role": "Carreras, trámites y procesos"},
    ]


@router.post("/chat", response_model=FcpnChatResponse)
async def fcpn_chat(body: FcpnChatRequest) -> FcpnChatResponse:
    system_prompt = _SYSTEM_PROMPTS.get(body.agent_id)
    if not system_prompt:
        raise HTTPException(status_code=400, detail="agent_id inválido.")

    session_id = body.session_id or f"fcpn_{uuid.uuid4().hex[:10]}"

    # RAG - Búsqueda optimizada
    search_results: list[FcpnSearchDoc] = []
    rag_used = False
    
    if body.use_rag:
        # Extraer consulta optimizada
        search_query = _extract_search_query(body.messages)
        
        if search_query:
            search_results = await _search_docs(search_query, top=5, category_filter=body.category_filter)
            rag_used = len(search_results) > 0
            
            # Si no hay resultados con nombres, intentar búsqueda más amplia
            if not search_results and len(search_query.split()) > 1:
                # Buscar solo el apellido
                words = search_query.split()
                for w in words:
                    if len(w) > 4 and not w.lower() in ["horario", "horarios", "docente", "lic"]:
                        fallback_query = w
                        print(f"[FCPN] Fallback: buscando solo '{fallback_query}'")
                        fallback_results = await _search_docs(fallback_query, top=3, category_filter=body.category_filter)
                        if fallback_results:
                            search_results = fallback_results
                            rag_used = True
                            break

    # Construir contexto y prompt
    rag_ctx = _build_rag_context(search_results)
    sys_content = system_prompt + (f"\n\n{rag_ctx}" if rag_ctx else "")

    payload = {
        "messages": [{"role": "system", "content": sys_content}]
                   + [{"role": m.role, "content": m.content} for m in body.messages],
        "max_tokens": 1024,
        "temperature": 0.3,  # Más bajo para respuestas más precisas
        "top_p": 0.95,
        "stream": False,
    }

    if not _OPENAI_ENDPOINT or not _OPENAI_KEY:
        raise HTTPException(status_code=503, detail="OpenAI no configurado.")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                _CHAT_URL,
                headers={"Content-Type": "application/json", "api-key": _OPENAI_KEY},
                json=payload,
            )
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=503, detail=f"Error HTTP {e.response.status_code}.")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Error de conexión: {e}")

    reply = data["choices"][0]["message"]["content"]

    return FcpnChatResponse(
        session_id=session_id,
        agent_id=body.agent_id,
        reply=reply,
        search_results=search_results,
        model=data.get("model", _DEPLOYMENT),
        rag_used=rag_used,
    )


@router.get("/search")
async def fcpn_search(q: str, top: int = 5, category: Optional[str] = None):
    results = await _search_docs(q, top=top, category_filter=category)
    return {"query": q, "results": [r.model_dump() for r in results], "total": len(results)}


@router.get("/debug/config")
def fcpn_debug_config():
    return {
        "FCPN_AZURE_OPENAI_ENDPOINT": _OPENAI_ENDPOINT or "❌ VACÍO",
        "FCPN_AZURE_SEARCH_INDEX": _SEARCH_INDEX or "❌ VACÍO",
        "rag_ready": bool(_SEARCH_ENDPOINT and _SEARCH_QUERY_KEY and _SEARCH_INDEX),
    }