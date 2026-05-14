import { useState, useRef, useEffect } from "react";
import {
  Send, Paperclip, Bot, User, FileText, Eye,
  AlertTriangle, RotateCcw, Copy, Check,
} from "lucide-react";
import { renderMarkdown } from "../../utils/markdown";
import { sendMessage } from "../../utils/api";

const SUGGESTIONS = {
  agent_general_fcpn: [
    "¿Cuáles son los requisitos para la pre-inscripción?",
    "¿Cuándo comienza el semestre académico?",
    "¿Dónde puedo descargar el Formulario 001?",
  ],
  kardex: [
    "¿Cuántas materias tengo aprobadas este semestre?",
    "¿Cuál es mi promedio acumulado?",
    "¿Qué materias me faltan para graduarme?",
  ],
  informacion: [
    "¿Qué carreras ofrece la FCPN?",
    "¿Cómo solicito un cambio de carrera?",
    "¿Cuáles son los contactos de los docentes?",
  ],
};

function AgentWelcome({ agent, onSuggestion }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center animate-fade-in">
      <div className={`w-16 h-16 rounded-2xl ${agent.bgClass} border border-app-border2 flex items-center justify-center mb-5`}>
        <Bot size={28} className={agent.accentClass} />
      </div>
      <h2 className={`text-xl font-bold mb-2 ${agent.accentClass}`}>{agent.name}</h2>
      <p className="text-sm text-tx-muted max-w-xs leading-relaxed mb-8">{agent.description}</p>
      <div className="w-full max-w-sm space-y-2">
        <p className="text-[10px] font-bold text-tx-dim uppercase tracking-widest mb-3">Preguntas sugeridas</p>
        {(SUGGESTIONS[agent.id] || []).map((s, i) => (
          <button key={i}
            onClick={() => onSuggestion?.(s)}
            className="w-full text-left px-4 py-3 rounded-xl text-sm border transition-all
              border-app-border bg-app-card hover:bg-app-hover text-tx-muted hover:text-tx-primary">
            <span className={`font-semibold ${agent.accentClass} mr-2`}>→</span>{s}
          </button>
        ))}
      </div>
    </div>
  );
}

function TypingIndicator({ agent }) {
  return (
    <div className="flex items-start gap-3 animate-fade-in">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${agent.bgClass} border border-app-border2`}>
        <Bot size={14} className={agent.accentClass} />
      </div>
      <div className={`${agent.bgClass} border ${agent.borderClass} rounded-2xl rounded-tl-sm px-4 py-3`}>
        <div className="flex gap-1.5 items-center h-4">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`w-2 h-2 rounded-full animate-bounce ${agent.dotClass}`}
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg, agent }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.text || msg.content || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex w-full gap-3 msg-bubble ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${agent.bgClass} border border-app-border2`}>
          <Bot size={14} className={agent.accentClass} />
        </div>
      )}

      <div className={`flex flex-col gap-1.5 max-w-[78%] min-w-0 ${isUser ? "items-end" : "items-start"}`}>
        {!isUser && (
          <span className={`text-[10px] font-bold px-1 ${agent.accentClass} opacity-80`}>{agent.name}</span>
        )}

        <div className={`relative group rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${isUser
            ? "bg-accent text-app-bg rounded-tr-sm font-medium"
            : `${agent.bgClass} border ${agent.borderClass} text-tx-primary rounded-tl-sm`}`}>
          {isUser
            ? <p className="whitespace-pre-wrap">{msg.text || msg.content}</p>
            : <div className="space-y-0.5">{renderMarkdown(msg.text || msg.content || "")}</div>
          }
          {!isUser && (
            <button onClick={handleCopy}
              className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-app-hover text-tx-dim hover:text-tx-primary"
              title="Copiar respuesta">
              {copied ? <Check size={11} className="text-accent" /> : <Copy size={11} />}
            </button>
          )}
        </div>

        {msg.citedDocuments?.length > 0 && (
          <div className="flex flex-col gap-1.5 w-full">
            {msg.citedDocuments.slice(0, 2).map((doc, i) => {
              const title = doc.title || doc.filename || `Documento ${i + 1}`;
              return (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-app-border2 bg-app-card text-xs">
                  <FileText size={12} className={`${agent.accentClass} shrink-0`} />
                  <span className="text-tx-dim flex-1 truncate">
                    <span className="text-tx-muted">Fuente: </span>
                    <span className="font-semibold text-tx-primary">{title}</span>
                  </span>
                  {msg.ragUsed && (
                    <span className={`px-1.5 py-0.5 rounded-full ${agent.bgClass} ${agent.accentClass} text-[9px] font-bold shrink-0`}>RAG</span>
                  )}
                  <button className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium ${agent.bgClass} ${agent.accentClass} hover:opacity-80 transition-opacity shrink-0`}>
                    <Eye size={10} /> Ver
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {!isUser && msg.suggestedFollowups?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {msg.suggestedFollowups.slice(0, 3).map((s, i) => (
              <button key={i}
                className={`text-[10px] px-2.5 py-1 rounded-full border ${agent.borderClass} ${agent.bgClass} ${agent.accentClass} hover:opacity-80 transition-opacity`}>
                {s}
              </button>
            ))}
          </div>
        )}

        <span className="text-[10px] text-tx-dim px-1">{msg.time}</span>
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-accent/20 border border-accent/30">
          <User size={14} className="text-accent" />
        </div>
      )}
    </div>
  );
}

export default function ChatArea({ agent, onCitedDocument, onSearchResults }) {
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const scrollRef = useRef(null);
  const inputRef  = useRef(null);
  const fileRef   = useRef(null);

  useEffect(() => {
    setMessages([]);
    setError(null);
    setSessionId(null);
    onCitedDocument?.(null);
    onSearchResults?.([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [agent.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const nowTime = () => {
    const d = new Date();
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    if (inputRef.current) inputRef.current.style.height = "auto";

    const userMsg = { id: Date.now(), role: "user", text, time: nowTime() };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);

    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.text }));

    try {
      const result = await sendMessage(agent, text, history, sessionId);
      if (result.sessionId) setSessionId(result.sessionId);
      onCitedDocument?.(result.citedDocuments?.[0] || null);
      onSearchResults?.(result.searchResults || []);
      setMessages((m) => [
        ...m,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: result.text,
          citedDocuments: result.citedDocuments || [],
          suggestedFollowups: result.suggestedFollowups || [],
          searchResults: result.searchResults || [],
          ragUsed: result.ragUsed,
          time: nowTime(),
        },
      ]);
    } catch (err) {
      setError(err.message || "Error de conexión. Verifica que el servidor esté activo.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const handleReset = () => {
    setMessages([]);
    setSessionId(null);
    setError(null);
    onCitedDocument?.(null);
    onSearchResults?.([]);
  };

  return (
    <div className="absolute inset-0 flex flex-col rounded-xl overflow-hidden bg-app-panel border border-app-border">

      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3.5 bg-app-card border-b border-app-border">
        <div className={`w-9 h-9 rounded-xl ${agent.bgClass} border border-app-border2 flex items-center justify-center shrink-0`}>
          <Bot size={17} className={agent.accentClass} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-tx-primary truncate">{agent.name}</h1>
          <p className="text-[11px] text-tx-muted truncate">{agent.role}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-xs text-tx-muted hidden sm:block">En línea</span>
          {messages.length > 0 && (
            <button onClick={handleReset}
              className="p-1.5 rounded-lg text-tx-dim hover:text-tx-primary hover:bg-app-hover transition-colors ml-1"
              title="Nueva conversación">
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="shrink-0 mx-4 mt-3 flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 animate-fade-in">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0"><span className="font-semibold">Error: </span>{error}</div>
          <button onClick={() => setError(null)} className="shrink-0 underline opacity-70 hover:opacity-100">Cerrar</button>
        </div>
      )}

      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-5" style={{ overscrollBehavior: "contain" }}>
        {messages.length === 0 && !loading
          ? <AgentWelcome agent={agent} onSuggestion={(text) => { setInput(text); setTimeout(() => inputRef.current?.focus(), 0); }} />
          : messages.map((msg) => <MessageBubble key={msg.id} msg={msg} agent={agent} />)
        }
        {loading && <TypingIndicator agent={agent} />}
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 py-3 border-t border-app-border bg-app-card">
        <div className={`flex items-end gap-2 rounded-xl border bg-app-panel px-3 py-2 focus-within:border-accent/50 transition-colors ${error ? "border-red-500/30" : "border-app-border2"}`}>
          <button onClick={() => fileRef.current?.click()}
            className="p-1.5 rounded-lg text-tx-dim hover:text-tx-primary hover:bg-app-hover transition-colors shrink-0 mb-0.5"
            title="Adjuntar archivo">
            <Paperclip size={15} />
          </button>
          <input ref={fileRef} type="file" className="hidden" multiple />

          <textarea ref={inputRef} value={input} onChange={handleInputChange} onKeyDown={handleKey}
            placeholder={`Pregunta al ${agent.name}...`} rows={1}
            className="flex-1 bg-transparent text-sm text-tx-primary placeholder-tx-dim outline-none resize-none leading-relaxed py-1 min-h-[28px] max-h-[120px] overflow-y-auto" />

          <button onClick={handleSend} disabled={!input.trim() || loading}
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mb-0.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed
              ${input.trim() && !loading ? "bg-accent hover:bg-accent-dark text-app-bg shadow-glow-green" : "bg-app-hover text-tx-dim"}`}>
            <Send size={14} />
          </button>
        </div>
        <p className="text-[10px] text-tx-dim mt-1.5 px-1">
          <kbd className="px-1 py-0.5 rounded bg-app-card border border-app-border text-[9px]">Enter</kbd>
          {" "}para enviar ·{" "}
          <kbd className="px-1 py-0.5 rounded bg-app-card border border-app-border text-[9px]">Shift+Enter</kbd>
          {" "}para nueva línea
        </p>
      </div>
    </div>
  );
}
