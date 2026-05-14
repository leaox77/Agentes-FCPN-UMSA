import { useState } from "react";
import {
  Bot, FileText, Info, Phone, MessageCircle, MessageSquare, Mail,
  HelpCircle, Bug, ChevronDown, CheckCircle2,
} from "lucide-react";
import { AGENTS, CHANNELS } from "../../utils/config";
import AcademicCalendar from "./AcademicCalendar";

const AGENT_ICONS = {
  agent_general_fcpn: Bot,
  kardex: FileText,
  informacion: Info,
};

const CHANNEL_ICONS = {
  1: Phone,
  2: MessageCircle,
  3: MessageSquare,
  4: Mail,
};

export default function AgentSelector({ selectedAgent, onSelectAgent, darkMode, setDarkMode }) {
  const [channelsOpen, setChannelsOpen] = useState(true);

  return (
    <aside className="flex min-h-0 flex-col gap-3 pb-4">

      {/* ── Encabezado de agentes ── */}
      <div className="rounded-xl border border-app-border bg-app-panel overflow-hidden">
        <div className="px-4 py-3 border-b border-app-border">
          <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-tx-muted">
            Asistentes disponibles
          </p>
        </div>
        <div className="p-2 space-y-1">
          {AGENTS.map((agent) => {
            const Icon = AGENT_ICONS[agent.id] || Bot;
            const isActive = selectedAgent?.id === agent.id;
            return (
              <button
                key={agent.id}
                onClick={() => onSelectAgent(agent)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-all group
                  ${isActive
                    ? `${agent.bgClass} border border-current/20 ring-1 ring-current/10`
                    : "hover:bg-app-hover border border-transparent"
                  }`}
                style={isActive ? { color: `var(--tw-${agent.color}, #6bbbae)` } : {}}
              >
                {/* Ícono */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all
                  ${isActive ? agent.bgClass : "bg-app-card group-hover:bg-app-hover"}`}
                  style={isActive ? { color: `var(--tw-${agent.color})` } : {}}
                >
                  <Icon size={16} className={isActive ? agent.accentClass : "text-tx-muted"} />
                </div>

                {/* Texto */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate transition-colors
                    ${isActive ? agent.accentClass : "text-tx-primary"}`}>
                    {agent.name}
                  </p>
                  <p className="text-xs text-tx-muted truncate">{agent.role}</p>
                </div>

                {/* Indicador activo */}
                <div className="shrink-0">
                  {isActive
                    ? <CheckCircle2 size={14} className={agent.accentClass} />
                    : <div className="w-2 h-2 rounded-full bg-accent opacity-70" />
                  }
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Canales (colapsable) ── */}
      <div className="rounded-xl border border-app-border bg-app-panel overflow-hidden">
        <button
          onClick={() => setChannelsOpen(o => !o)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-app-hover transition-colors"
        >
          <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-tx-muted">
            Canales de contacto
          </p>
          <ChevronDown
            size={13}
            className={`text-tx-dim transition-transform duration-300 ${channelsOpen ? "rotate-180" : ""}`}
          />
        </button>
        <div className={`overflow-hidden transition-all duration-300 ${channelsOpen ? "max-h-64" : "max-h-0"}`}>
          <div className="p-2 pt-0 space-y-1">
            {CHANNELS.map(ch => {
              const Icon = CHANNEL_ICONS[ch.id] || MessageSquare;
              return (
                <button
                  key={ch.id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-app-hover transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: ch.color + "18" }}
                  >
                    <Icon size={14} style={{ color: ch.color }} />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-medium text-tx-primary truncate">{ch.name}</p>
                    <p className="text-[10px] text-tx-muted truncate">{ch.sub}</p>
                  </div>
                  {ch.status === "online" && (
                    <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Calendario ── */}
      <AcademicCalendar />

      {/* ── Botones inferiores ── */}
      <div className="flex gap-2 mt-auto pt-1">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border border-app-border
            bg-app-panel hover:bg-app-hover hover:border-accent/30 transition-all"
        >
          <span className="text-tx-muted text-[10px]">{darkMode ? "☀ Claro" : "☾ Oscuro"}</span>
        </button>
        <button
          className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border border-app-border
            bg-app-panel hover:bg-app-hover hover:border-accent/30 transition-all"
        >
          <span className="text-tx-muted text-[10px]">FAQ & Ayuda</span>
        </button>
      </div>
    </aside>
  );
}
