import { useState, useEffect } from "react";
import {
  FileText, Eye, Download, ChevronDown, ChevronLeft, ChevronRight,
  Database, FileType2, Layers,
} from "lucide-react";
import { STATIC_FILES } from "../../utils/config";

const EMPTY_MSG = "Haz una consulta al agente para ver aquí los documentos recuperados del índice RAG.";

function FileTypeBadge({ type }) {
  const cls = type === "pdf"
    ? "bg-red-500/20 text-red-400"
    : "bg-blue-500/20 text-blue-400";
  return (
    <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0 ${cls}`}>
      {type.toUpperCase()}
    </div>
  );
}

export default function ResourcesPanel({ citedDocument = null, searchResults = [], agent }) {
  const [page, setPage]           = useState(0);
  const [moreOpen, setMoreOpen]   = useState(false);
  const [selectedMore, setSelectedMore] = useState(null);

  useEffect(() => { setPage(0); }, [citedDocument, searchResults]);

  // Construcción de docs RAG
  const ragDocs = [
    ...(citedDocument ? [{
      title: citedDocument.filename || citedDocument.title || "Documento",
      content: citedDocument.relevance_reason || citedDocument.excerpt || "",
      type: citedDocument.document_type || "pdf",
      isCited: true,
      score: null,
    }] : []),
    ...searchResults
      .filter(r => {
        const rTitle = r.title || "";
        const cTitle = citedDocument?.filename || citedDocument?.title || "";
        return rTitle !== cTitle;
      })
      .map(r => ({
        title: r.title || "Documento",
        content: r.content || "",
        type: "pdf",
        isCited: false,
        score: r.score,
        source: r.source,
      })),
  ];

  const hasRag  = ragDocs.length > 0;
  const curDoc  = hasRag ? ragDocs[Math.min(page, ragDocs.length - 1)] : null;
  const accentClass = agent?.accentClass || "text-teal";
  const bgClass     = agent?.bgClass || "bg-teal/10";

  // Archivos para descargar: primeros 3 primarios + resto en dropdown
  const primary = STATIC_FILES.slice(0, 3);
  const more    = STATIC_FILES.slice(3);

  return (
    <aside className="flex flex-col gap-3 h-full overflow-y-auto pb-4">

      {/* ── Documento Citado / RAG Viewer ── */}
      <div className="rounded-xl border border-app-border bg-app-panel overflow-hidden">
        <div className="px-4 py-3 border-b border-app-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database size={13} className={hasRag ? accentClass : "text-tx-dim"} />
            <h2 className="text-[10px] font-bold tracking-[0.12em] uppercase text-tx-muted">
              Documento citado
            </h2>
          </div>
          {hasRag && (
            <span className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-bold
              ${bgClass} ${accentClass}`}>
              <Layers size={9} /> RAG
            </span>
          )}
        </div>

        {/* Preview visual */}
        <div className="mx-4 my-3 rounded-xl border border-app-border bg-app-card overflow-hidden">
          <div className="h-36 bg-gradient-to-b from-app-card to-app-bg flex items-center justify-center p-3">
            {hasRag && curDoc ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-3">
                <div className={`w-10 h-10 rounded-xl ${bgClass} flex items-center justify-center`}>
                  <FileType2 size={18} className={accentClass} />
                </div>
                <p className="text-xs font-semibold text-tx-primary text-center leading-tight line-clamp-2 px-2">
                  {curDoc.title}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  {curDoc.isCited && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${bgClass} ${accentClass} font-bold`}>
                      ★ Principal
                    </span>
                  )}
                  {curDoc.score && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-app-hover text-tx-dim">
                      score: {curDoc.score}
                    </span>
                  )}
                </div>
                {/* Líneas decorativas */}
                <div className="w-full space-y-1 mt-1">
                  {["w-full","w-4/5","w-3/5","w-2/3"].map((w,i) => (
                    <div key={i} className={`h-1 rounded-full bg-app-border ${w}`} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="w-12 h-12 rounded-full bg-app-hover flex items-center justify-center">
                  <Database size={20} className="text-tx-dim opacity-40" />
                </div>
                <p className="text-[11px] text-tx-dim opacity-60">Sin documento recuperado</p>
              </div>
            )}
          </div>

          {/* Paginación */}
          {hasRag && ragDocs.length > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-app-border">
              <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0}
                className="w-7 h-7 rounded-lg bg-app-bg border border-app-border flex items-center justify-center
                  text-tx-dim hover:text-tx-primary disabled:opacity-30 transition-colors">
                <ChevronLeft size={13} />
              </button>
              <span className="text-[10px] text-tx-muted">Doc {page+1} de {ragDocs.length}</span>
              <button onClick={() => setPage(p => Math.min(ragDocs.length-1, p+1))} disabled={page === ragDocs.length-1}
                className="w-7 h-7 rounded-lg bg-app-bg border border-app-border flex items-center justify-center
                  text-tx-dim hover:text-tx-primary disabled:opacity-30 transition-colors">
                <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Fragmento de texto */}
        <div className="px-4 pb-4">
          {hasRag && curDoc ? (
            <>
              <p className="text-[9px] font-bold text-tx-dim uppercase mb-1.5">Fragmento recuperado</p>
              <p className="text-xs text-tx-muted leading-relaxed line-clamp-5">{curDoc.content}</p>
            </>
          ) : (
            <p className="text-[11px] text-tx-dim opacity-60 leading-relaxed">{EMPTY_MSG}</p>
          )}
        </div>
      </div>

      {/* ── Archivos para descargar ── */}
      <div className="rounded-xl border border-app-border bg-app-panel overflow-hidden">
        <div className="px-4 py-3 border-b border-app-border">
          <h2 className="text-[10px] font-bold tracking-[0.12em] uppercase text-tx-muted">
            Archivos para descargar
          </h2>
        </div>
        <ul className="divide-y divide-app-border">
          {primary.map(f => (
            <li key={f.id} className="flex items-center gap-2 px-3 py-2.5">
              <FileTypeBadge type={f.type} />
              <span className="flex-1 min-w-0 text-[11px] text-tx-muted truncate" title={f.name}>
                {f.name.replace(/_/g, " ")}
              </span>
              <div className="flex gap-1 shrink-0">
                <a href={f.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium
                    bg-app-card hover:bg-app-hover text-tx-dim hover:text-tx-primary transition-colors">
                  <Eye size={10} /> Ver
                </a>
                <a href={f.url} download
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium
                    ${bgClass} ${accentClass} hover:opacity-80 transition-opacity`}>
                  <Download size={10} />
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Más archivos ── */}
      {more.length > 0 && (
        <div className="rounded-xl border border-app-border bg-app-panel overflow-hidden">
          <button
            onClick={() => setMoreOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3
              hover:bg-app-hover transition-colors"
          >
            <h2 className="text-[10px] font-bold tracking-[0.12em] uppercase text-tx-muted">
              Más archivos
            </h2>
            <ChevronDown size={13} className={`text-tx-dim transition-transform duration-200
              ${moreOpen ? "rotate-180" : ""}`} />
          </button>
          {moreOpen && (
            <ul className="border-t border-app-border divide-y divide-app-border animate-fade-in">
              {more.map(f => (
                <li key={f.id}>
                  <button
                    onClick={() => setSelectedMore(selectedMore === f.id ? null : f.id)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left
                      hover:bg-app-hover transition-colors"
                  >
                    <FileText size={13} className="text-red-400 shrink-0" />
                    <span className="flex-1 text-[11px] text-tx-muted truncate">{f.name.replace(/_/g, " ")}</span>
                    {selectedMore === f.id && (
                      <div className="flex gap-1 ml-auto shrink-0">
                        <a href={f.url} target="_blank" rel="noopener noreferrer"
                          className={`p-1 ${accentClass} hover:opacity-70 transition-opacity`}>
                          <Eye size={12} />
                        </a>
                        <a href={f.url} download
                          className={`p-1 ${accentClass} hover:opacity-70 transition-opacity`}>
                          <Download size={12} />
                        </a>
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}
