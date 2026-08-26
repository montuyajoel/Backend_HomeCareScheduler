const sendToolResult = (res, payload) => res.status(200).json(payload);

function getActingRole(req) {
  const raw =
    req.body?.actingRole ||
    req.query?.actingRole ||
    req.headers["x-uhie-role"] ||
    "";
  return String(raw).trim().toLowerCase();
}

function getActingEmployeeCode(req) {
  const raw =
    req.body?.actingEmployeeCode ||
    req.query?.actingEmployeeCode ||
    req.headers["x-uhie-employee-code"] ||
    "";
  return String(raw).trim();
}

function createResponseProxy() {
  let body = { success: false, message: "Request failed." };
  const proxy = {
    status() {
      return proxy;
    },
    json(payload) {
      body = payload;
      return proxy;
    },
  };
  return { proxy, getBody: () => body };
}

async function invokeController(handler, req, res) {
  const { proxy, getBody } = createResponseProxy();
  try {
    await handler(req, proxy);
    return sendToolResult(res, getBody());
  } catch (error) {
    console.error("Foundry tool controller error:", error);
    return sendToolResult(res, {
      success: false,
      message: error.message || "Unable to complete request.",
    });
  }
}

module.exports = {
  sendToolResult,
  getActingRole,
  getActingEmployeeCode,
  invokeController,
};
