# FCPN · Sistema de Asistencia Académica

Monorepo con **un solo backend** y frontend React para la Facultad de Ciencias Puras y Naturales (UMSA).

```
fcpn-asistente/
├── backend/
│   ├── app/
│   │   ├── main.py          ← FastAPI: monta /ki y /fcpn
│   │   ├── ki_router.py     ← Módulo KI  (variables KI_AZURE_*)
│   │   └── fcpn_router.py   ← Módulo FCPN (variables FCPN_AZURE_*)
│   ├── requirements.txt
│   └── .env.example         ← Todas las variables prefijadas
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── components/
    │   ├── utils/
    │   │   ├── api.js        ← sendMessage() → /ki/chat o /fcpn/chat
    │   │   └── config.js     ← AGENTS con chatPayloadType
    │   └── styles/
    └── .env.example          ← Solo VITE_API_URL
```

## Módulos del backend

| Ruta base | Módulo           | Motor                                     |
|-----------|------------------|-------------------------------------------|
| `/ki`     | Asistente General | Azure OpenAI embeddings + Azure AI Search |
| `/fcpn`   | Kardex & Info     | Azure AI Foundry GPT-4o mini + RAG        |

Las variables de cada módulo están **prefijadas** en el mismo `.env`:
- `KI_AZURE_*`   → módulo `/ki`
- `FCPN_AZURE_*` → módulo `/fcpn`

## Inicio rápido

### Backend (un solo servidor)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # completar con claves reales
uvicorn app.main:app --reload --port 8000
```
Docs: http://localhost:8000/docs

### Frontend
```bash
cd frontend
npm install
cp .env.example .env             # VITE_API_URL=http://localhost:8000
npm run dev
```
App: http://localhost:5173

## Variables de entorno

### Módulo KI (`/ki/*`)
| Variable | Descripción |
|----------|-------------|
| `KI_AZURE_OPENAI_ENDPOINT` | Endpoint de Azure OpenAI |
| `KI_AZURE_OPENAI_API_KEY` | Clave de API |
| `KI_AZURE_SEARCH_ENDPOINT` | Endpoint de Azure AI Search |
| `KI_AZURE_SEARCH_ADMIN_KEY` | Clave de administrador del índice |
| `KI_AZURE_SEARCH_INDEX_NAME` | Nombre del índice (ej: `fcpn-index`) |
| `KI_AZURE_STORAGE_CONNECTION_STRING` | Cadena de conexión a Blob Storage |
| `KI_AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` | Endpoint para OCR |
| `KI_AZURE_DOCUMENT_INTELLIGENCE_KEY` | Clave de Document Intelligence |

### Módulo FCPN (`/fcpn/*`)
| Variable | Descripción |
|----------|-------------|
| `FCPN_AZURE_OPENAI_ENDPOINT` | Endpoint de Azure AI Foundry |
| `FCPN_AZURE_OPENAI_API_KEY` | Clave de API |
| `FCPN_AZURE_OPENAI_DEPLOYMENT` | Nombre del deployment (ej: `gpt-4o-mini`) |
| `FCPN_AZURE_OPENAI_API_VERSION` | Versión de API (ej: `2025-01-01-preview`) |
| `FCPN_AZURE_SEARCH_ENDPOINT` | Endpoint de Azure AI Search |
| `FCPN_AZURE_SEARCH_QUERY_KEY` | Clave de consulta del índice |
| `FCPN_AZURE_SEARCH_INDEX` | Nombre del índice RAG |
