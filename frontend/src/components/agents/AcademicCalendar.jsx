import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { ACADEMIC_EVENTS, EVENT_STYLES } from "../../utils/config";

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                 "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAYS   = ["Do","Lu","Ma","Mi","Ju","Vi","Sa"];

function daysInMonth(y, m)  { return new Date(y, m, 0).getDate(); }
function firstDayOf(y, m)   { return new Date(y, m - 1, 1).getDay(); }

export default function AcademicCalendar() {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [sel, setSel]     = useState(null);

  const events    = ACADEMIC_EVENTS[month] || [];
  const eventMap  = Object.fromEntries(events.map(e => [e.day, e]));
  const totalDays = daysInMonth(year, month);
  const startDay  = firstDayOf(year, month);

  const prev = () => { if (month === 1) { setMonth(12); setYear(y=>y-1); } else setMonth(m=>m-1); setSel(null); };
  const next = () => { if (month === 12) { setMonth(1); setYear(y=>y+1); } else setMonth(m=>m+1); setSel(null); };
  const isToday = d => d === today.getDate() && month === today.getMonth()+1 && year === today.getFullYear();

  const cells = [...Array(startDay).fill(null), ...Array.from({length: totalDays}, (_, i) => i+1)];
  const selEv = sel && eventMap[sel];

  return (
    <div className="rounded-xl border border-app-border bg-app-panel overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-app-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays size={13} className="text-accent" />
          <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-tx-muted">
            Calendario FCPN
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prev} className="w-6 h-6 rounded-md flex items-center justify-center
            text-tx-dim hover:text-tx-primary hover:bg-app-hover transition-colors">
            <ChevronLeft size={12} />
          </button>
          <span className="text-xs font-semibold text-tx-primary w-[104px] text-center">
            {MONTHS[month-1]} {year}
          </span>
          <button onClick={next} className="w-6 h-6 rounded-md flex items-center justify-center
            text-tx-dim hover:text-tx-primary hover:bg-app-hover transition-colors">
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="px-3 pt-2 pb-1">
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-[9px] font-bold text-tx-dim py-0.5">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={`e${i}`} />;
            const ev = eventMap[day];
            const today_ = isToday(day);
            const active = sel === day;
            return (
              <button
                key={day}
                onClick={() => setSel(active ? null : day)}
                className={`relative h-7 w-full rounded-md text-[11px] font-medium transition-all
                  ${active
                    ? "bg-accent text-app-bg font-bold"
                    : today_
                    ? "bg-accent/20 text-accent font-bold ring-1 ring-accent/40"
                    : "text-tx-primary hover:bg-app-hover"
                  }`}
              >
                {day}
                {ev && !active && (
                  <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${EVENT_STYLES[ev.type].dot}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalle evento seleccionado */}
      {selEv ? (
        <div className="mx-3 mb-3 mt-1 rounded-lg border border-app-border bg-app-card px-3 py-2 flex gap-2">
          <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${EVENT_STYLES[selEv.type].dot}`} />
          <div>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${EVENT_STYLES[selEv.type].badge}`}>
              {EVENT_STYLES[selEv.type].label}
            </span>
            <p className="text-xs text-tx-primary mt-1 leading-snug">{selEv.label}</p>
            <p className="text-[10px] text-tx-muted mt-0.5">{sel} de {MONTHS[month-1]} {year}</p>
          </div>
        </div>
      ) : events.length > 0 ? (
        <div className="px-3 pb-2.5">
          <p className="text-[9px] font-bold text-tx-dim uppercase mb-1.5">Eventos del mes</p>
          <ul className="space-y-0.5">
            {events.map((ev, i) => (
              <li key={i} onClick={() => setSel(ev.day)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-app-hover transition-colors">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${EVENT_STYLES[ev.type].dot}`} />
                <span className="text-[10px] text-tx-dim font-bold w-4 shrink-0">{ev.day}</span>
                <span className="text-[10px] text-tx-primary truncate">{ev.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[10px] text-tx-dim text-center pb-3">Sin eventos este mes</p>
      )}

      {/* Leyenda */}
      <div className="px-3 pb-3 pt-1 border-t border-app-border flex flex-wrap gap-x-3 gap-y-1">
        {Object.entries(EVENT_STYLES).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${val.dot}`} />
            <span className="text-[9px] text-tx-dim">{val.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
