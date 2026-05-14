"""
Módulo KI — Asistente General FCPN
====================================
Rutas montadas en /ki por main.py

Motor : Azure OpenAI  (text-embedding-3-large + gpt-4o-mini-2)
RAG   : Azure AI Search (fcpn-index, búsqueda híbrida vectorial+keyword)
Store : Azure Blob Storage (fcpn-docs)
OCR   : Azure Document Intelligence (PDFs escaneados)
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime
from enum import Enum
from io import BytesIO
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from azure.storage.blob import BlobServiceClient
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import (
    SearchIndex, SearchFieldDataType, SimpleField,
    SearchableField, VectorSearch, HnswAlgorithmConfiguration,
    VectorSearchProfile, SearchField,
)
from azure.search.documents.models import VectorizedQuery
from azure.core.credentials import AzureKeyCredential
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.ai.documentintelligence.models import AnalyzeDocumentRequest
from pypdf import PdfReader
from openai import AzureOpenAI, OpenAIError

# ── Configuración (variables prefijadas KI_; AZURE_* como compatibilidad) ─
def _env(primary: str, fallback: str | None = None, default: str = "") -> str:
    value = os.getenv(primary)
    if value:
        return value.strip()
    if fallback:
        value = os.getenv(fallback)
        if value:
            return value.strip()
    return default


_OPENAI_ENDPOINT    = _env("KI_AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_ENDPOINT").rstrip("/")
_OPENAI_KEY         = _env("KI_AZURE_OPENAI_API_KEY", "AZURE_OPENAI_API_KEY")
_SEARCH_ENDPOINT    = _env("KI_AZURE_SEARCH_ENDPOINT", "AZURE_SEARCH_ENDPOINT").rstrip("/")
_SEARCH_ADMIN_KEY   = _env("KI_AZURE_SEARCH_ADMIN_KEY", "AZURE_SEARCH_ADMIN_KEY")
_SEARCH_INDEX       = _env("KI_AZURE_SEARCH_INDEX_NAME", "AZURE_SEARCH_INDEX_NAME", "fcpn-index")
_STORAGE_CONN       = _env("KI_AZURE_STORAGE_CONNECTION_STRING", "AZURE_STORAGE_CONNECTION_STRING")
_DOC_INTEL_ENDPOINT = _env("KI_AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT", "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT").rstrip("/")
_DOC_INTEL_KEY      = _env("KI_AZURE_DOCUMENT_INTELLIGENCE_KEY", "AZURE_DOCUMENT_INTELLIGENCE_KEY")

_BLOB_CONTAINER       = "fcpn-docs"
_EMBEDDING_MODEL      = "text-embedding-3-large"
_EMBEDDING_DIMENSIONS = 3072
_CHAT_DEPLOYMENT      = "gpt-4o-mini-2"

_EXTENSIONES_TEXTO: set[str] = {
    ".txt", ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".c", ".cpp",
    ".cs", ".go", ".rb", ".php", ".swift", ".kt", ".r", ".rs", ".sh",
    ".sql", ".html", ".css", ".yaml", ".yml", ".json", ".md",
}

# ── Clientes Azure (inicialización lazy para evitar errores en startup) ───
def _openai():
    return AzureOpenAI(api_key=_OPENAI_KEY, azure_endpoint=_OPENAI_ENDPOINT,
                       api_version="2024-02-15-preview")


def _missing_openai_config() -> list[str]:
    missing = []
    if not _OPENAI_ENDPOINT:
        missing.append("KI_AZURE_OPENAI_ENDPOINT o AZURE_OPENAI_ENDPOINT")
    if not _OPENAI_KEY:
        missing.append("KI_AZURE_OPENAI_API_KEY o AZURE_OPENAI_API_KEY")
    return missing


def _config_warnings() -> list[str]:
    warnings = []
    if _STORAGE_CONN.count("DefaultEndpointsProtocol=") > 1:
        warnings.append(
            "KI_AZURE_STORAGE_CONNECTION_STRING parece duplicado; debe empezar una sola vez con "
            "'DefaultEndpointsProtocol=https;AccountName=...'."
        )
    if _OPENAI_KEY and _STORAGE_CONN and _OPENAI_KEY in _STORAGE_CONN:
        warnings.append(
            "KI_AZURE_OPENAI_API_KEY coincide con la AccountKey de Storage. Usa la clave de Azure OpenAI, no la de Storage."
        )
    if _SEARCH_ADMIN_KEY and _STORAGE_CONN and _SEARCH_ADMIN_KEY in _STORAGE_CONN:
        warnings.append(
            "KI_AZURE_SEARCH_ADMIN_KEY coincide con la AccountKey de Storage. Usa la clave Admin primaria/secundaria de Azure AI Search."
        )
    return warnings

def _blob():
    return BlobServiceClient.from_connection_string(_STORAGE_CONN)

def _search_index_client():
    return SearchIndexClient(_SEARCH_ENDPOINT, AzureKeyCredential(_SEARCH_ADMIN_KEY))

def _search_client():
    return SearchClient(endpoint=_SEARCH_ENDPOINT, index_name=_SEARCH_INDEX,
                        credential=AzureKeyCredential(_SEARCH_ADMIN_KEY))

def _doc_intel():
    return DocumentIntelligenceClient(
        endpoint=_DOC_INTEL_ENDPOINT,
        credential=AzureKeyCredential(_DOC_INTEL_KEY),
    )

# ── Pydantic models ───────────────────────────────────────────────────────
class KiAgentInfo(BaseModel):
    id: str
    name: str
    role: str
    description: str
    online: bool = True

class KiChatRequest(BaseModel):
    agent_id: str = Field(..., examples=["agent_general_fcpn"])
    message: str = Field(..., min_length=1, max_length=2000)
    history: list[dict] = Field(default_factory=list)
    session_id: str | None = None

class KiCitedDocument(BaseModel):
    id: str
    title: str
    excerpt: str | None = None

class KiChatResponse(BaseModel):
    session_id: str
    agent_id: str
    message: str
    cited_documents: list[KiCitedDocument] = Field(default_factory=list)
    suggested_followups: list[str] = Field(default_factory=list)
    tokens_used: int | None = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

# ── Agentes disponibles ───────────────────────────────────────────────────
_AGENTS = [
    KiAgentInfo(
        id="agent_general_fcpn",
        name="Asistente General FCPN",
        role="Información académica general",
        description="Consultas sobre inscripciones, calendario, trámites y procesos de la FCPN usando documentos institucionales indexados.",
    ),
]

# ── Azure AI Search — helpers ─────────────────────────────────────────────
def _ensure_index_exists():
    """Crea el índice vectorial si no existe."""
    try:
        idx_client = _search_index_client()
        existing = [i.name for i in idx_client.list_indexes()]
        if _SEARCH_INDEX in existing:
            return
        fields = [
            SimpleField(name="id",         type=SearchFieldDataType.String, key=True, filterable=True),
            SearchableField(name="content", type=SearchFieldDataType.String, analyzer_name="es.microsoft"),
            SimpleField(name="source",     type=SearchFieldDataType.String, filterable=True),
            SimpleField(name="file_title", type=SearchFieldDataType.String, filterable=True),
            SimpleField(name="materia",    type=SearchFieldDataType.String, filterable=True),
            SearchField(
                name="content_vector",
                type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
                searchable=True,
                vector_search_dimensions=_EMBEDDING_DIMENSIONS,
                vector_search_profile_name="fcpn-hnsw-profile",
            ),
        ]
        idx_client.create_index(SearchIndex(
            name=_SEARCH_INDEX, fields=fields,
            vector_search=VectorSearch(
                algorithms=[HnswAlgorithmConfiguration(name="fcpn-hnsw")],
                profiles=[VectorSearchProfile(name="fcpn-hnsw-profile", algorithm_configuration_name="fcpn-hnsw")],
            ),
        ))
        print(f"[KI] Índice '{_SEARCH_INDEX}' creado.")
    except Exception as e:
        msg = str(e)
        if "doesn't match service" in msg or "doesn" in msg and "match" in msg:
            print(
                "[KI] Azure Search rechazó KI_AZURE_SEARCH_ADMIN_KEY. "
                "Copia la clave Admin primaria o secundaria del servicio Azure AI Search correcto."
            )
        else:
            print(f"[KI] Warning al crear índice: {e}")


def _get_embedding(text: str) -> list[float]:
    return _openai().embeddings.create(model=_EMBEDDING_MODEL, input=text).data[0].embedding


def _search_context(question: str, k: int = 5) -> list[dict]:
    if not _SEARCH_ENDPOINT or not _SEARCH_ADMIN_KEY:
        return []
    try:
        emb = _get_embedding(question)
        vq  = VectorizedQuery(vector=emb, k_nearest_neighbors=k * 4, fields="content_vector")
        results = _search_client().search(
            search_text=question, vector_queries=[vq],
            select=["id", "content", "source", "file_title", "materia"],
            top=k,
        )
        docs, seen = [], set()
        for r in results:
            key = (r.get("source", ""), r.get("materia", ""))
            if key in seen:
                continue
            seen.add(key)
            docs.append({
                "id": r.get("id"), "content": r.get("content"),
                "source": r.get("source", ""), "file_title": r.get("file_title"),
                "materia": r.get("materia"),
            })
        return docs
    except Exception as e:
        print(f"[KI] Search error: {e}")
        return []


def _generate_response(question: str) -> tuple[str, list[dict], int]:
    system_prompt = (
        "Eres un asistente académico de la FCPN (Facultad de Ciencias Puras y Naturales, UMSA). "
        "Responde siempre en español de forma clara, amable y concisa. "
        "Para preguntas académicas usa el contexto de documentos como fuente principal."
    )
    context = _search_context(question)
    if context:
        docs_text = "\n\n---\n\n".join(
            f"[{c.get('file_title', c.get('source', 'Documento'))}]\n{c['content']}"
            for c in context
        )
        prompt = (
            f"Responde usando los documentos institucionales.\n\n"
            f"=== DOCUMENTOS ===\n{docs_text}\n=== FIN ===\n\n"
            f"PREGUNTA: {question}"
        )
    else:
        prompt = (
            f"No se encontró documentación institucional relacionada.\n\n"
            f"PREGUNTA: {question}\n\n"
            "Indica que no hay documentos disponibles y complementa con conocimiento general."
        )

    resp = _openai().chat.completions.create(
        model=_CHAT_DEPLOYMENT,
        messages=[{"role": "system", "content": system_prompt},
                  {"role": "user", "content": prompt}],
        temperature=0.3,
    )
    tokens  = resp.usage.total_tokens if resp.usage else 0
    sources = [{"source": c.get("source"), "file_title": c.get("file_title")} for c in context]
    return resp.choices[0].message.content, sources, tokens


def _sync_index():
    """Indexa blobs nuevos y elimina chunks de blobs borrados."""
    if not _STORAGE_CONN:
        return
    try:
        container = _blob().get_container_client(_BLOB_CONTAINER)
        blobs_now = {b.name for b in container.list_blobs()}
        indexed   = {r["source"] for r in _search_client().search(search_text="*", select=["source"], top=10000)}
        for name in blobs_now - indexed:
            data = container.get_blob_client(name).download_blob().readall()
            _index_blob(name, data)
    except Exception as e:
        print(f"[KI] Sync warning: {e}")


def _index_blob(name: str, data: bytes):
    ext = os.path.splitext(name)[-1].lower()
    if ext == ".pdf":
        reader = PdfReader(BytesIO(data))
        text   = "".join(p.extract_text() or "" for p in reader.pages)
        if len(text.strip()) < 100:
            try:
                poller = _doc_intel().begin_analyze_document(
                    "prebuilt-read", analyze_request=AnalyzeDocumentRequest(bytes_source=data))
                res  = poller.result()
                text = "\n\n".join(
                    "\n".join(l.content for l in (pg.lines or []))
                    for pg in res.pages
                )
            except Exception as e:
                print(f"[KI] OCR error: {e}")
                text = ""
        try:
            title = reader.metadata.title or os.path.splitext(os.path.basename(name))[0]
        except Exception:
            title = os.path.splitext(os.path.basename(name))[0]
    elif ext in _EXTENSIONES_TEXTO:
        text  = data.decode("utf-8", errors="ignore")
        title = os.path.splitext(os.path.basename(name))[0]
    else:
        return

    chunks = [text[i:i+500] for i in range(0, len(text), 500)]
    docs   = []
    for chunk in chunks:
        emb = _get_embedding(f"{title}\n{chunk}")
        docs.append({
            "id": str(uuid.uuid4()), "content": chunk,
            "source": name, "file_title": title,
            "materia": name.split("/")[0] if "/" in name else "",
            "content_vector": emb,
        })
    sc = _search_client()
    for i in range(0, len(docs), 100):
        sc.upload_documents(documents=docs[i:i+100])
    print(f"[KI] Indexados {len(docs)} chunks de '{name}'")


# ── Router ─────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/ki", tags=["KI · Asistente General"])


@router.get("/health")
def ki_health():
    missing_openai = _missing_openai_config()
    config_warnings = _config_warnings()
    return {
        "status": "ok" if not missing_openai and not config_warnings else "degraded",
        "module": "KI",
        "index": _SEARCH_INDEX,
        "openai_ready": not missing_openai,
        "missing_openai_config": missing_openai,
        "config_warnings": config_warnings,
        "rag_ready": bool(_SEARCH_ENDPOINT and _SEARCH_ADMIN_KEY and _SEARCH_INDEX),
    }


@router.get("/agents", response_model=list[KiAgentInfo])
def ki_agents():
    return _AGENTS


@router.post("/chat", response_model=KiChatResponse)
def ki_chat(req: KiChatRequest):
    agent = next((a for a in _AGENTS if a.id == req.agent_id), None)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agente '{req.agent_id}' no encontrado.")

    missing = _missing_openai_config()
    if missing:
        raise HTTPException(
            status_code=503,
            detail=f"Variables del Asistente General no configuradas: {', '.join(missing)}.",
        )

    try:
        text, sources, tokens = _generate_response(req.message)
    except OpenAIError as exc:
        raise HTTPException(status_code=503, detail=f"Azure OpenAI no disponible: {exc}") from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"No se pudo generar la respuesta KI: {exc}") from exc

    cited = []
    for i, src in enumerate(sources):
        raw   = src.get("file_title") or src.get("source", "")
        title = os.path.splitext(os.path.basename(raw))[0].replace("_", " ").strip() or f"Documento {i+1}"
        cited.append(KiCitedDocument(id=f"doc_{i}", title=title))

    return KiChatResponse(
        session_id=req.session_id or f"ki_{abs(hash(req.message)) % 99999:05d}",
        agent_id=req.agent_id,
        message=text,
        cited_documents=cited,
        suggested_followups=[
            "¿Dónde descargo el Formulario 001?",
            "¿Cuál es la fecha límite de inscripción?",
            "¿Cómo realizo el comprobante de pago?",
        ],
        tokens_used=tokens,
    )


@router.get("/resources")
def ki_resources(category: str | None = None):
    files = [
        {"id": "f1", "name": "Guia_de_Inscripciones_2024.pdf",   "type": "pdf",  "category": "Inscripciones"},
        {"id": "f2", "name": "Formulario_001_Inscripcion.docx",   "type": "docx", "category": "Inscripciones"},
        {"id": "f3", "name": "Calendario_Académico.pdf",          "type": "pdf",  "category": "Calendario"},
        {"id": "f4", "name": "Reglamento_Academico.pdf",          "type": "pdf",  "category": "Reglamentos"},
    ]
    if category:
        files = [f for f in files if f["category"].lower() == category.lower()]
    return {"total": len(files), "files": files}


@router.post("/index/sync")
def ki_sync():
    try:
        _sync_index()
        return {"status": "ok", "message": "Índice KI sincronizado."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def startup_ki():
    """Llamar desde main.py en el evento startup."""
    for warning in _config_warnings():
        print(f"[KI] Config warning: {warning}")
    if not (_SEARCH_ENDPOINT and _SEARCH_ADMIN_KEY and _SEARCH_INDEX):
        print("[KI] Azure Search no configurado; se omite creación/sincronización del índice KI.")
        return
    _ensure_index_exists()
    _sync_index()
