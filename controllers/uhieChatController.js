const {
  isFoundryConfigured,
  getAgentInfo,
  chatWithUhie,
  agentName,
} = require("../services/uhieFoundryService");

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
    return res.status(503).json({
      ...base,
      success: false,
      status: "degraded",
      message: "FOUNDRY_ENDPOINT and FOUNDRY_AGENT_NAME are required",
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
      message: error.message,
    });
  }
};

const chat = async (req, res) => {
  try {
    const { message, history = [], user } = req.body || {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    if (!isFoundryConfigured()) {
      return res.status(503).json({
        success: false,
        message:
          "Foundry is not configured. Set FOUNDRY_ENDPOINT and FOUNDRY_AGENT_NAME.",
      });
    }

    // Prefer body.user from frontend; fall back to JWT protect payload
    const chatUser = user || {
      fullName: req.user?.fullName,
      employeeCode: req.user?.employeeCode,
      role: req.user?.role,
    };

    const { response, references } = await chatWithUhie({
      message: String(message).trim(),
      history,
      user: chatUser,
    });

    return res.json({
      success: true,
      response,
      references,
    });
  } catch (error) {
    console.error("Uhie Foundry error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = { health, chat };
