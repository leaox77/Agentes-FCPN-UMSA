import { GraduationCap, Menu, Sun, Moon, Wifi, WifiOff } from "lucide-react";

export default function Header({ darkMode, setDarkMode, onToggleLeft, onToggleRight, isConnected }) {
  return (
    <header className="shrink-0 flex items-center h-14 px-4 gap-3 z-30
      bg-app-surface dark:bg-app-surface border-b border-app-border
      lt:bg-lt-surface lt:border-lt-border">

      {/* Hamburger izquierdo (mobile) */}
      <button
        onClick={onToggleLeft}
        className="xl:hidden p-2 rounded-lg text-tx-muted hover:text-tx-primary hover:bg-app-hover transition-colors"
        aria-label="Panel de agentes"
      >
        <Menu size={18} />
      </button>

      {/* Logo */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-glow-green">
          <GraduationCap size={16} className="text-app-bg" strokeWidth={2.5} />
        </div>
        <div className="hidden sm:block">
          <span className="font-display font-bold text-sm tracking-wide text-tx-primary dark:text-tx-primary">
            FCPN
          </span>
          <span className="text-tx-muted text-xs ml-1.5 tracking-widest uppercase">
            · UMSA
          </span>
        </div>
      </div>

      {/* Título central */}
      <div className="flex-1 hidden md:flex items-center justify-center">
        <span className="text-xs font-medium text-tx-dim tracking-widest uppercase">
          Sistema de Asistencia Académica
        </span>
      </div>

      {/* Acciones derecha */}
      <div className="ml-auto flex items-center gap-2">
        {/* Estado conexión */}
        <div className="hidden sm:flex items-center gap-1.5">
          {isConnected ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-xs text-tx-muted">Conectado</span>
            </>
          ) : (
            <>
              <WifiOff size={12} className="text-red-400" />
              <span className="text-xs text-red-400">Sin conexión</span>
            </>
          )}
        </div>

        {/* Toggle tema */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-lg text-tx-muted hover:text-tx-primary hover:bg-app-hover transition-colors"
          aria-label="Cambiar tema"
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Hamburger derecho (mobile) */}
        <button
          onClick={onToggleRight}
          className="xl:hidden p-2 rounded-lg text-tx-muted hover:text-tx-primary hover:bg-app-hover transition-colors"
          aria-label="Panel de recursos"
        >
          <Menu size={18} />
        </button>
      </div>
    </header>
  );
}
