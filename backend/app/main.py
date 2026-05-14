"""
FCPN · Asistente Académico — Backend Unificado
================================================
Un solo servidor FastAPI, dos módulos montados en prefijos distintos:

  /ki/*    → Asistente General (Azure OpenAI embeddings + Azure AI Search)
  /fcpn/*  → Agentes Kardex & Información (Azure AI Foundry + RAG semántico)

Variables de entorno:
  Prefijo KI_   → módulo ki_router.py
  Prefijo FCPN_ → módulo fcpn_router.py
  (ver .env.example)

Ejecutar:
  uvicorn app.main:app --reload --port 8000

Docs interactivos:
  http://localhost:8000/docs
  http://localhost:8000/redoc
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Cargar backend/.env ANTES de importar los routers.
# Los routers leen variables al importarse, por eso el orden es importante.
_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(_ENV_FILE)
load_dotenv()

from app.ki_router   import router as ki_router,   startup_ki
from app.fcpn_router import router as fcpn_router

PORT         = int(os.getenv("PORT", 8000))
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
).split(",")


# ── Startup / Shutdown ────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicialización del módulo KI (crea índice si no existe, sincroniza blobs)
    try:
        startup_ki()
    except Exception as e:
        print(f"⚠️  KI startup warning (no bloqueante): {e}")
    yield
    # Aquí iría cleanup si fuera necesario


# ── App ───────────────────────────────────────────────────────────────────
app = FastAPI(
    title="FCPN · Asistente Académico API",
    description="""
## Sistema de Asistencia Académica — FCPN / UMSA

Backend unificado con dos módulos independientes:

| Prefijo | Módulo | Motor |
|---------|--------|-------|
| `/ki`   | Asistente General | Azure OpenAI embeddings + Azure AI Search |
| `/fcpn` | Kardex & Información | Azure AI Foundry GPT-4o mini + RAG semántico |

### Variables de entorno
- Variables `KI_*`   → configuran el módulo `/ki`
- Variables `FCPN_*` → configuran el módulo `/fcpn`
""",
    version="4.0.0",
    contact={"name": "División de Sistemas – FCPN", "email": "sistemas@fcpn.umsa.bo"},
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Montar routers ────────────────────────────────────────────────────────
app.include_router(ki_router)
app.include_router(fcpn_router)


# ── Raíz ─────────────────────────────────────────────────────────────────
@app.get("/", tags=["Sistema"])
def root():
    return {
        "status":  "ok",
        "service": "FCPN Asistente Académico API",
        "version": "4.0.0",
        "modules": {
            "ki":   "/ki  — Asistente General (embeddings propios)",
            "fcpn": "/fcpn — Kardex & Información (AI Foundry + RAG)",
        },
        "docs": "/docs",
    }


@app.get("/health", tags=["Sistema"])
def health():
    return {"status": "ok", "version": "4.0.0"}
