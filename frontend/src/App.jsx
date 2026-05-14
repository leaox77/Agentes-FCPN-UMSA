import { useState, useEffect } from "react";
import { X } from "lucide-react";
import Header from "./components/layout/Header";
import AgentSelector from "./components/agents/AgentSelector";
import ChatArea from "./components/chat/ChatArea";
import ResourcesPanel from "./components/resources/ResourcesPanel";
import { AGENTS } from "./utils/config";

export default function App() {
  const [darkMode, setDarkMode]           = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0]);
  const [leftOpen, setLeftOpen]           = useState(false);
  const [rightOpen, setRightOpen]         = useState(false);
  const [citedDocument, setCitedDocument] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isConnected, setIsConnected]     = useState(true);

  // Aplicar clase dark al html
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // Cambiar agente limpia estado RAG
  const handleSelectAgent = (agent) => {
    setSelectedAgent(agent);
    setCitedDocument(null);
    setSearchResults([]);
    setLeftOpen(false);
  };

  const closeAll = () => { setLeftOpen(false); setRightOpen(false); };

  return (
    <div className={`flex flex-col font-body transition-colors duration-300
      ${darkMode ? "bg-app-bg text-tx-primary" : "bg-lt-bg text-lt-text"}`}
      style={{ height: "100dvh", overflow: "hidden" }}>

      {/* ══ HEADER ══ */}
      <Header
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onToggleLeft={() => { setLeftOpen(o => !o); setRightOpen(false); }}
        onToggleRight={() => { setRightOpen(o => !o); setLeftOpen(false); }}
        isConnected={isConnected}
      />

      {/* ══ CUERPO ══ */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">

        {/* Overlay móvil */}
        {(leftOpen || rightOpen) && (
          <div
            className="fixed inset-0 bg-black/60 z-20 xl:hidden backdrop-blur-sm"
            onClick={closeAll}
          />
        )}

        {/* ── Panel izquierdo (Agentes) ── */}
        <aside className={`
          w-[20rem] max-w-[86vw] shrink-0 flex flex-col z-30
          xl:relative xl:translate-x-0 xl:flex xl:z-auto
          fixed top-14 bottom-0 left-0
          transition-transform duration-300 ease-in-out
          ${darkMode ? "bg-app-bg" : "bg-lt-bg"}
          border-r ${darkMode ? "border-app-border" : "border-lt-border"}
          ${leftOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0"}
        `}>
          {/* Botón cerrar (solo mobile) */}
          <button
            className="xl:hidden absolute top-3 right-3 p-1.5 rounded-lg text-tx-muted hover:text-tx-primary hover:bg-app-hover z-10"
            onClick={() => setLeftOpen(false)}
          >
            <X size={15} />
          </button>
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <AgentSelector
              selectedAgent={selectedAgent}
              onSelectAgent={handleSelectAgent}
              darkMode={darkMode}
              setDarkMode={setDarkMode}
            />
          </div>
        </aside>

        {/* ── Chat central ── */}
        <main className="flex-1 min-w-0 min-h-0 p-3 sm:p-4">
          <div className="relative w-full h-full">
            <ChatArea
              agent={selectedAgent}
              onCitedDocument={setCitedDocument}
              onSearchResults={setSearchResults}
            />
          </div>
        </main>

        {/* ── Panel derecho (Recursos) ── */}
        <aside className={`
          w-[20rem] max-w-[86vw] shrink-0 flex flex-col z-30
          xl:relative xl:translate-x-0 xl:flex xl:z-auto
          fixed top-14 bottom-0 right-0
          transition-transform duration-300 ease-in-out
          ${darkMode ? "bg-app-bg" : "bg-lt-bg"}
          border-l ${darkMode ? "border-app-border" : "border-lt-border"}
          ${rightOpen ? "translate-x-0" : "translate-x-full xl:translate-x-0"}
        `}>
          <button
            className="xl:hidden absolute top-3 left-3 p-1.5 rounded-lg text-tx-muted hover:text-tx-primary hover:bg-app-hover z-10"
            onClick={() => setRightOpen(false)}
          >
            <X size={15} />
          </button>
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            <ResourcesPanel
              citedDocument={citedDocument}
              searchResults={searchResults}
              agent={selectedAgent}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
