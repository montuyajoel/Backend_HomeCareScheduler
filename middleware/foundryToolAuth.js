/**
 * Foundry tool auth only — isolated from JWT `protect`.
 * Existing /api/* routes keep Bearer; this middleware is for /api/uhie/tools/* only.
 */
const foundryToolAuth = (req, res, next) => {
  const expected = (process.env.FOUNDRY_TOOL_API_KEY || "").trim();
  if (!expected) {
    return res.status(503).json({
      success: false,
      message: "Foundry tools are not configured (FOUNDRY_TOOL_API_KEY missing).",
    });
  }

  const provided = (req.headers["x-api-key"] || "").trim();
  if (!provided || provided !== expected) {
    return res.status(401).json({
      success: false,
      message: "Invalid or missing x-api-key.",
    });
  }

  next();
};

module.exports = { foundryToolAuth };
