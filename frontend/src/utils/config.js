// ── Configuración de agentes ──────────────────────────────────────────────
// chatPayloadType: "ki"   → ruta /ki/chat   (Asistente General)
//                  "fcpn" → ruta /fcpn/chat  (Kardex, Información)

export const AGENTS = [
  {
    id: "agent_general_fcpn",
    chatPayloadType: "ki",
    name: "Asistente General",
    role: "Información académica general",
    description:
      "Responde consultas sobre inscripciones, calendario, trámites y procesos de la FCPN usando documentos institucionales indexados.",
    accentClass: "text-teal",
    bgClass:     "bg-teal/10",
    borderClass: "border-teal/30",
    dotClass:    "bg-teal",
  },
  {
    id: "kardex",
    chatPayloadType: "fcpn",
    name: "Agente Kardex",
    role: "Historial académico y notas",
    description:
      "Consulta tu historial académico, estado de materias, créditos y notas mediante RAG sobre documentos del SIA.",
    accentClass: "text-agent-kardex",
    bgClass:     "bg-agent-kardex/10",
    borderClass: "border-agent-kardex/30",
    dotClass:    "bg-agent-kardex",
  },
];

// ── Canales de comunicación ───────────────────────────────────────────────
export const CHANNELS = [
  { id: 1, name: "Soporte WhatsApp",      sub: "En línea",                color: "#25D366", status: "online" },
  { id: 2, name: "Canal Telegram",         sub: "Actualizado: hace 5 min", color: "#229ED9", status: "recent" },
  { id: 3, name: "Página de Facebook",    sub: "Página Oficial FCPN",     color: "#1877F2", status: "info"   },
  { id: 4, name: "Correo Institucional",  sub: "Actualizado: 1 hora",     color: "#6BBBAE", status: "info"   },
];

// ── Archivos estáticos para descarga ─────────────────────────────────────
export const STATIC_FILES = [
  { id: "f1", name: "Guia_de_Inscripciones_2024.pdf",  type: "pdf",  category: "Inscripciones",
    url: "/static/docs/Guia_de_Inscripciones_2024.pdf" },
  { id: "f2", name: "Formulario_001_Inscripcion.docx", type: "docx", category: "Inscripciones",
    url: "/static/docs/Formulario_001_Inscripcion.docx" },
  { id: "f3", name: "Calendario_Academico.pdf",        type: "pdf",  category: "Calendario",
    url: "/static/docs/Calendario_Academico.pdf" },
  { id: "f4", name: "Reglamento_Academico.pdf",        type: "pdf",  category: "Reglamentos",
    url: "/static/docs/Reglamento_Academico.pdf" },
  { id: "f5", name: "Malla_Curricular_Informatica.pdf",type: "pdf",  category: "Curricular",
    url: "/static/docs/Malla_Curricular_Informatica.pdf" },
];

// ── Calendario académico ──────────────────────────────────────────────────
export const ACADEMIC_EVENTS = {
  1:  [{ day: 6,  label: "Inicio matriculación alumnos antiguos", type: "enroll" },
       { day: 13, label: "Inicio inscripciones PSA I-2026",       type: "enroll" }],
  2:  [{ day: 15, label: "Inicio inscripciones 1er semestre",     type: "enroll" },
       { day: 28, label: "Fin inscripciones 1er semestre",        type: "deadline" }],
  3:  [{ day: 3,  label: "Inicio clases 1er semestre",            type: "class" },
       { day: 21, label: "Fin calendario oficial matriculación",  type: "deadline" }],
  4:  [{ day: 17, label: "Jueves Santo – Asueto",                 type: "holiday" },
       { day: 18, label: "Viernes Santo – Asueto",                type: "holiday" }],
  5:  [{ day: 1,  label: "Día del Trabajo – Asueto",              type: "holiday" },
       { day: 22, label: "1er Examen parcial (aprox.)",           type: "exam" }],
  6:  [{ day: 5,  label: "Corpus Christi – Asueto",               type: "holiday" },
       { day: 20, label: "2do Examen parcial (aprox.)",           type: "exam" }],
  7:  [{ day: 16, label: "Asueto – Día de la Independencia",      type: "holiday" }],
  8:  [{ day: 6,  label: "Inicio clases 2do semestre",            type: "class" },
       { day: 22, label: "Fin calendario matriculación II",       type: "deadline" }],
  9:  [{ day: 26, label: "1er Examen parcial II semestre",        type: "exam" }],
  10: [{ day: 12, label: "Día de la Hispanidad – Asueto",         type: "holiday" }],
  11: [{ day: 2,  label: "Día de Difuntos – Asueto",              type: "holiday" },
       { day: 14, label: "2do Examen parcial II semestre",        type: "exam" }],
  12: [{ day: 5,  label: "Exámenes finales 2do semestre",         type: "exam" },
       { day: 19, label: "Fin gestión académica 2025",            type: "deadline" },
       { day: 25, label: "Navidad – Asueto",                      type: "holiday" }],
};

export const EVENT_STYLES = {
  exam:     { dot: "bg-red-400",    badge: "bg-red-400/15 text-red-400",        label: "Examen" },
  enroll:   { dot: "bg-accent",     badge: "bg-accent/15 text-accent",          label: "Inscripción" },
  class:    { dot: "bg-blue-400",   badge: "bg-blue-400/15 text-blue-400",      label: "Clases" },
  holiday:  { dot: "bg-yellow-400", badge: "bg-yellow-400/15 text-yellow-400",  label: "Asueto" },
  deadline: { dot: "bg-orange-400", badge: "bg-orange-400/15 text-orange-400",  label: "Fecha límite" },
};
