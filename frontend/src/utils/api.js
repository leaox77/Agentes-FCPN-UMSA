/**
 * api.js — Capa de acceso al backend unificado
 *
 * Un solo VITE_API_URL apunta al servidor.
 * Cada agente tiene un chatPayloadType ("ki" | "fcpn") que determina
 * qué ruta y qué formato de payload usa.
 *
 *   /ki/chat   → { agent_id, message, history }
 *   /fcpn/chat → { agent_id, messages: [...] }
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Helper con timeout ────────────────────────────────────────────────────
async function apiFetch(path, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  } catch (e) {
    clearTimeout(tid);
    if (e.name === "AbortError")
      throw new Error("Tiempo de espera agotado. Verifica que el servidor esté activo.");
    throw e;
  }
}

// ── Checks de salud ───────────────────────────────────────────────────────
export const checkHealth   = () => apiFetch("/health");
export const checkKiHealth = () => apiFetch("/ki/health");
export const checkFcpnHealth = () => apiFetch("/fcpn/health");

// ── Función unificada de chat ─────────────────────────────────────────────
/**
 * sendMessage(agent, userText, history, sessionId)
 *
 * @param {object} agent       — objeto del agente (de config.js)
 * @param {string} userText    — mensaje del usuario
 * @param {Array}  history     — historial [{ role, content }]
 * @param {string} sessionId   — sesión actual (o null)
 * @returns {object}  { text, citedDocuments, searchResults, suggestedFollowups, ragUsed, sessionId }
 */
export async function sendMessage(agent, userText, history = [], sessionId = null) {
  if (agent.chatPayloadType === "ki") {
    // ── Módulo KI ────────────────────────────────────────────
    const data = await apiFetch("/ki/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id:   agent.id,
        message:    userText,
        history:    history.map((m) => ({ role: m.role, content: m.content || m.text })),
        session_id: sessionId,
      }),
    });
    return {
      text:               data.message,
      citedDocuments:     data.cited_documents    || [],
      searchResults:      [],
      suggestedFollowups: data.suggested_followups || [],
      tokensUsed:         data.tokens_used,
      ragUsed:            (data.cited_documents || []).length > 0,
      sessionId:          data.session_id,
    };
  } else {
    // ── Módulo FCPN ──────────────────────────────────────────
    const messages = [
      ...history.map((m) => ({ role: m.role, content: m.content || m.text })),
      { role: "user", content: userText },
    ];
    const data = await apiFetch("/fcpn/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id:   agent.id,
        messages,
        session_id: sessionId,
        use_rag:    true,
      }),
    });
    return {
      text:               data.reply,
      citedDocuments:     data.cited_document ? [data.cited_document] : [],
      searchResults:      data.search_results || [],
      suggestedFollowups: [],
      ragUsed:            data.rag_used,
      sessionId:          data.session_id,
    };
  }
}
