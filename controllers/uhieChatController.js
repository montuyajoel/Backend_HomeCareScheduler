const {
  isFoundryConfigured,
  getAgentInfo,
  chatWithUhie,
  agentName,
  HISTORY_LIMIT,
} = require("../services/uhieFoundryService");
const { getStaffProfile } = require("../utils/staffHelper");

/**
 * Prefer verified JWT + DB profile for Foundry identity.
 * Body `user` is an optional hint only when profile fields are missing.
 */
async function resolveChatUser(req) {
  const hint = req.body?.user && typeof req.body.user === "object" ? req.body.user : {};
  const role = req.user?.role || hint.role || null;

  let fullName = null;
  let employeeCode = null;

  if (req.user?.id && req.user?.role) {
    try {
      const profile = await getStaffProfile(req.user.id, req.user.role);
      if (profile) {
        fullName = profile.fullName || null;
        employeeCode = profile.employeeCode || null;
      }
    } catch (err) {
      console.warn("Uhie: staff profile lookup failed:", err.message);
    }
  }

  return {
    fullName: fullName || hint.fullName || null,
    employeeCode: employeeCode || hint.employeeCode || null,
    role,
  };
}

/**
 * Prior turns only (drop trailing duplicate of current message), capped.
 */
function normalizeHistory(history, message) {
  if (!Array.isArray(history)) return [];

  const turns = history
    .map((turn) => {
      if (!turn || typeof turn !== "object") return null;
      const role = turn.role === "assistant" ? "assistant" : "user";
      const content = String(turn.content ?? turn.text ?? turn.message ?? "").trim();
      if (!content) return null;
      return { role, content };
    })
    .filter(Boolean);

  const trimmedMessage = String(message || "").trim();
  if (
    turns.length > 0 &&
    turns[turns.length - 1].role === "user" &&
    turns[turns.length - 1].content === trimmedMessage
  ) {
    turns.pop();
  }

  return turns.slice(-HISTORY_LIMIT);
}

const health = async (req, res) => {
  const deep = req.query.deep === "1" || req.query.deep === "true";

  const base = {
    success: true,
    status: "ok",
    service: "uhie-chat",
    foundryConfigured: isFoundryConfigured(),
    agentName: agentName || null,
    timestamp: new Date().toISOString(),
  };

  if (!deep) return res.json(base);

  if (!isFoundryConfigured()) {
    const msg = "FOUNDRY_ENDPOINT and FOUNDRY_AGENT_NAME are required";
    return res.status(503).json({
      ...base,
      success: false,
      status: "degraded",
      error: msg,
      message: msg,
      code: "UHIE_FOUNDRY_DOWN",
    });
  }

  try {
    const agent = await getAgentInfo();
    return res.json({
      ...base,
      agent: {
        name: agent.name,
        version: agent.versions?.latest?.version || null,
      },
    });
  } catch (error) {
    console.error("Uhie health deep check failed:", error);
    return res.status(503).json({
      ...base,
      success: false,
      status: "degraded",
      error: error.message,
      message: error.message,
      code: "UHIE_FOUNDRY_DOWN",
    });
  }
};

const chat = async (req, res) => {
  try {
    const { message, history = [], conversationId } = req.body || {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({
        success: false,
        code: "UHIE_VALIDATION",
        message: "Message is required",
        error: "Message is required",
      });
    }

    if (!isFoundryConfigured()) {
      const msg =
        "Foundry is not configured. Set FOUNDRY_ENDPOINT and FOUNDRY_AGENT_NAME on the server.";
      return res.status(503).json({
        success: false,
        code: "UHIE_FOUNDRY_DOWN",
        message: msg,
        error: msg,
      });
    }

    const chatUser = await resolveChatUser(req);
    const priorHistory = normalizeHistory(history, message);

    const { response, references } = await chatWithUhie({
      message: String(message).trim(),
      history: priorHistory,
      user: chatUser,
      conversationId: conversationId || null,
    });

    return res.json({
      success: true,
      reply: response,
      response,
      references,
    });
  } catch (error) {
    console.error("Uhie Foundry error:", error);
    const msg = error.message || "Uhie chat failed";
    return res.status(500).json({
      success: false,
      code: "UHIE_FOUNDRY_DOWN",
      message: msg,
      error: msg,
    });
  }
};

module.exports = { health, chat, resolveChatUser, normalizeHistory };
