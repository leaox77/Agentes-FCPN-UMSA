"""
Módulo FCPN — Agentes Kardex & Información
============================================
Rutas montadas en /fcpn por main.py

Motor : Azure AI Foundry (GPT-4o mini)
RAG   : Azure AI Search  (semántico con fallback simple)
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

# ── Configuración (variables prefijadas FCPN_) ────────────────────────────
_OPENAI_ENDPOINT    = os.getenv("FCPN_AZURE_OPENAI_ENDPOINT", "").rstrip("/")
_OPENAI_KEY         = os.getenv("FCPN_AZURE_OPENAI_API_KEY", "")
_DEPLOYMENT         = os.getenv("FCPN_AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")
_API_VERSION        = os.getenv("FCPN_AZURE_OPENAI_API_VERSION", "2025-01-01-preview")
_SEARCH_ENDPOINT    = os.getenv("FCPN_AZURE_SEARCH_ENDPOINT", "").rstrip("/")
_SEARCH_QUERY_KEY   = os.getenv("FCPN_AZURE_SEARCH_QUERY_KEY", "")
_SEARCH_INDEX       = os.getenv("FCPN_AZURE_SEARCH_INDEX", "")

_CHAT_URL = (
    f"{_OPENAI_ENDPOINT}/openai/deployments/{_DEPLOYMENT}"
    f"/chat/completions?api-version={_API_VERSION}"
)
_SEARCH_SELECT      = "id,chunk_id,parent_id,chunk,title,category"
_SEARCH_API_VERSION = "2024-07-01"
_SEMANTIC_CONFIG    = "config-semantica-rag"

# ── Pydantic models ───────────────────────────────────────────────────────
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

# ── Agentes ───────────────────────────────────────────────────────────────
_SYSTEM_PROMPTS = {
    FcpnAgentID.kardex: """Eres el Agente Kardex de la FCPN (UMSA). Ayudas a estudiantes con información académica.

Tienes acceso a fragmentos de documentos institucionales (RAG) que son tu fuente principal.

REGLAS:
1. Si hay contexto, DEBES usarlo. Resume, organiza y explica la información encontrada.
2. Si el documento no cubre todo el dato, responde con lo que sí existe.
3. No inventes horarios, aulas ni docentes que no estén en el contexto.
4. Usa mensajes anteriores para mantener contexto conversacional.
5. Respuestas claras y directas. Usa listas para datos múltiples.
6. PROHIBIDO ignorar los documentos recuperados cuando existen.
OBJETIVO: Responder SIEMPRE usando la información disponible en los documentos.""",

    FcpnAgentID.informacion: (
        "Eres el Agente de Información de la FCPN (Facultad de Ciencias Puras y Naturales, UMSA), "
        "La Paz, Bolivia. Proporcionas información sobre carreras, inscripciones, trámites, "
        "calendario académico y eventos institucionales. "
        "Usa los documentos del contexto cuando estén disponibles. "
        "Sé amable, claro y conciso. Responde siempre en español."
    ),
}

# ── Azure AI Search ───────────────────────────────────────────────────────
async def _call_search(client: httpx.AsyncClient, payload: dict) -> dict | None:
    url     = f"{_SEARCH_ENDPOINT}/indexes/{_SEARCH_INDEX}/docs/search"
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
            content  = captions[0].get("text", "").strip() if captions else ""
        if not content:
            continue
        score = item.get("@search.rerankerScore") or item.get("@search.score")
        docs.append(FcpnSearchDoc(
            title    = item.get("title") or "Documento",
            content  = content[:1200],
            category = item.get("category"),
            source   = item.get("parent_id") or item.get("chunk_id") or "",
            score    = round(float(score), 4) if score else None,
        ))
    return docs


async def _search_docs(query: str, top: int = 5,
                        category_filter: Optional[str] = None) -> list[FcpnSearchDoc]:
    if not _SEARCH_ENDPOINT or not _SEARCH_QUERY_KEY or not _SEARCH_INDEX:
        return []
    odata = f"category eq '{category_filter}'" if category_filter else None
    async with httpx.AsyncClient(timeout=15.0) as client:
        payload_sem: dict = {
            "search": query, "top": top, "select": _SEARCH_SELECT,
            "queryType": "semantic", "semanticConfiguration": _SEMANTIC_CONFIG,
            "captions": "extractive", "answers": "extractive|count-3", "searchMode": "all",
        }
        if odata:
            payload_sem["filter"] = odata
        data = await _call_search(client, payload_sem)

        if data is None:
            payload_sim: dict = {
                "search": query, "top": top, "select": _SEARCH_SELECT,
                "queryType": "simple", "searchMode": "all",
            }
            if odata:
                payload_sim["filter"] = odata
            data = await _call_search(client, payload_sim)

        if data is None:
            return []

    results = _parse_results(data)
    print(f"[FCPN] RAG '{query[:60]}' → {len(results)} docs")
    return results


def _build_rag_context(docs: list[FcpnSearchDoc]) -> str:
    if not docs:
        return ""
    parts = ["=== DOCUMENTOS INSTITUCIONALES ==="]
    for i, d in enumerate(docs, 1):
        cat = f"\n   Categoría: {d.category}" if d.category else ""
        parts.append(f"[Doc {i}] {d.title}{cat}\n{d.content}\n{'─'*50}")
    parts.append("=== FIN DOCUMENTOS ===")
    return "\n".join(parts)


def _detect_cited(text: str,
                  results: list[FcpnSearchDoc]) -> Optional[FcpnCitedDoc]:
    if results:
        top   = results[0]
        score = f" (score: {top.score})" if top.score else ""
        cat   = f" · {top.category}" if top.category else ""
        return FcpnCitedDoc(
            filename=top.title or "Documento institucional",
            relevance_reason=f"Recuperado del índice RAG{score}{cat}",
        )
    _KEYWORDS = {
        "inscripci": "Guia_de_Inscripciones_2024.pdf",
        "formulario": "Formulario_001_Inscripcion.docx",
        "calendario": "Calendario_Académico.pdf",
        "reglamento": "Reglamento_Academico.pdf",
        "malla":      "Malla_Curricular_Informatica.pdf",
    }
    lower = text.lower()
    for kw, fname in _KEYWORDS.items():
        if kw in lower:
            return FcpnCitedDoc(filename=fname, relevance_reason=f"Relacionado con '{kw}'.")
    return None


# ── Router ─────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/fcpn", tags=["FCPN · Kardex & Información"])


@router.get("/health")
def fcpn_health():
    return {
        "status": "ok", "module": "FCPN",
        "rag_ready": bool(_SEARCH_ENDPOINT and _SEARCH_QUERY_KEY and _SEARCH_INDEX),
    }


@router.get("/agents")
def fcpn_agents():
    return [
        {"id": "kardex",      "name": "Agente Kardex",
         "role": "Historial académico y notas",
         "description": "Consulta tu kardex, materias aprobadas, créditos y notas mediante RAG."},
        {"id": "informacion", "name": "Agente Información",
         "role": "Carreras, trámites y procesos",
         "description": "Carreras, cambios, convalidaciones, contactos y eventos institucionales."},
    ]


@router.post("/chat", response_model=FcpnChatResponse)
async def fcpn_chat(body: FcpnChatRequest) -> FcpnChatResponse:
    system_prompt = _SYSTEM_PROMPTS.get(body.agent_id)
    if not system_prompt:
        raise HTTPException(status_code=400, detail="agent_id inválido.")

    session_id = body.session_id or f"fcpn_{uuid.uuid4().hex[:10]}"

    # RAG
    search_results: list[FcpnSearchDoc] = []
    rag_used = False
    if body.use_rag:
        user_msgs    = [m.content for m in body.messages if m.role == "user"]
        query        = " ".join(user_msgs[-2:])
        search_results = await _search_docs(query, top=5, category_filter=body.category_filter)
        rag_used = len(search_results) > 0

    rag_ctx = _build_rag_context(search_results)
    sys_content = system_prompt + (f"\n\n{rag_ctx}" if rag_ctx else "")

    payload = {
        "messages": [{"role": "system", "content": sys_content}]
                   + [{"role": m.role, "content": m.content} for m in body.messages],
        "max_tokens": 1024, "temperature": 0.7, "top_p": 0.95, "stream": False,
    }

    if not _OPENAI_ENDPOINT or not _OPENAI_KEY:
        raise HTTPException(status_code=503,
            detail="FCPN_AZURE_OPENAI_ENDPOINT / FCPN_AZURE_OPENAI_API_KEY no configurados.")

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
        raise HTTPException(status_code=503,
            detail=f"Azure AI Foundry HTTP {e.response.status_code}.")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"No se pudo conectar a Azure: {e}")

    reply = data["choices"][0]["message"]["content"]
    cited = _detect_cited(reply, search_results if rag_used else [])

    return FcpnChatResponse(
        session_id=session_id,
        agent_id=body.agent_id,
        reply=reply,
        cited_document=cited,
        search_results=search_results,
        model=data.get("model", _DEPLOYMENT),
        rag_used=rag_used,
    )


@router.get("/resources")
def fcpn_resources(category: Optional[str] = None):
    files = [
        {"id": "r1", "filename": "Guia_de_Inscripciones_2024.pdf",  "type": "pdf",  "category": "Inscripciones",
         "download_url": "/static/docs/Guia_de_Inscripciones_2024.pdf"},
        {"id": "r2", "filename": "Formulario_001_Inscripcion.docx", "type": "docx", "category": "Inscripciones",
         "download_url": "/static/docs/Formulario_001_Inscripcion.docx"},
        {"id": "r3", "filename": "Calendario_Académico.pdf",        "type": "pdf",  "category": "Calendario",
         "download_url": "/static/docs/Calendario_Academico.pdf"},
        {"id": "r4", "filename": "Reglamento_Academico.pdf",        "type": "pdf",  "category": "Reglamentos",
         "download_url": "/static/docs/Reglamento_Academico.pdf"},
        {"id": "r5", "filename": "Malla_Curricular_Informatica.pdf","type": "pdf",  "category": "Curricular",
         "download_url": "/static/docs/Malla_Curricular_Informatica.pdf"},
    ]
    if category:
        files = [f for f in files if f["category"].lower() == category.lower()]
    return {"total": len(files), "resources": files}


@router.get("/search")
async def fcpn_search(q: str, top: int = 5, category: Optional[str] = None):
    results = await _search_docs(q, top=top, category_filter=category)
    return {"query": q, "results": [r.model_dump() for r in results], "total": len(results)}


@router.get("/debug/config")
def fcpn_debug_config():
    return {
        "FCPN_AZURE_OPENAI_ENDPOINT":    _OPENAI_ENDPOINT or "❌ VACÍO",
        "FCPN_AZURE_OPENAI_DEPLOYMENT":  _DEPLOYMENT,
        "FCPN_AZURE_OPENAI_API_KEY_set": bool(_OPENAI_KEY),
        "FCPN_AZURE_SEARCH_ENDPOINT":    _SEARCH_ENDPOINT or "❌ VACÍO",
        "FCPN_AZURE_SEARCH_INDEX":       _SEARCH_INDEX or "❌ VACÍO",
        "FCPN_AZURE_SEARCH_KEY_set":     bool(_SEARCH_QUERY_KEY),
        "rag_ready": bool(_SEARCH_ENDPOINT and _SEARCH_QUERY_KEY and _SEARCH_INDEX),
    }
