const { DefaultAzureCredential } = require("@azure/identity");
const { AIProjectClient } = require("@azure/ai-projects");

const endpoint = (process.env.FOUNDRY_ENDPOINT || "").trim().replace(/\/$/, "");
const agentName = (process.env.FOUNDRY_AGENT_NAME || "").trim();

let projectClient = null;

function isFoundryConfigured() {
  return Boolean(endpoint && agentName);
}

function assertProjectEndpoint() {
  if (!endpoint.includes("/api/projects/")) {
    throw new Error(
      "FOUNDRY_ENDPOINT must be the project endpoint, e.g. https://<resource>.services.ai.azure.com/api/projects/<project-name> (copy from Foundry project Overview)."
    );
  }
}

function getProjectClient() {
  if (!isFoundryConfigured()) return null;
  assertProjectEndpoint();
  if (!projectClient) {
    // AIProjectClient(endpoint, credential) — do not pass a model name here
    projectClient = new AIProjectClient(endpoint, new DefaultAzureCredential());
  }
  return projectClient;
}

function buildAgentInput({ message, history = [], user }) {
  const lines = [];

  if (user?.fullName || user?.employeeCode || user?.role) {
    lines.push(
      `Signed-in user context: name=${user.fullName || "unknown"}; employeeCode=${user.employeeCode || "unknown"}; role=${user.role || "unknown"}.`
    );
  }

  lines.push(
    [
      "HomeCare OpenAPI tools are split by role. Always pass actingRole and actingEmployeeCode from signed-in user context on every tool call.",
      "Caregiver tools (actingRole=caregiver): getCaregiverSchedules, getCaregiverLeaveRequests, createCaregiverLeaveRequest — only for the signed-in caregiver.",
      "Admin tools (actingRole=admin): findAvailableCaregivers, validateScheduleAssignment, assignSchedule, reassignSchedule, getPendingLeaveRequests.",
      "Admin scheduling flow: findAvailableCaregivers → optionally validateScheduleAssignment → assignSchedule after admin confirms.",
      "Before assignSchedule or reassignSchedule, confirm client, caregiver, date, and times with the admin user.",
    ].join(" ")
  );

  if (Array.isArray(history) && history.length > 0) {
    lines.push("Recent conversation:");
    for (const turn of history.slice(-12)) {
      const role = turn.role || "user";
      const content = turn.content || turn.text || turn.message || "";
      if (content) lines.push(`${role}: ${content}`);
    }
  }

  lines.push(`User message: ${message}`);
  return lines.join("\n");
}

async function getAgentInfo() {
  const client = getProjectClient();
  if (!client) throw new Error("Foundry is not configured");
  return client.agents.get(agentName);
}

/**
 * Pull real filenames from the Responses API payload.
 * Foundry often embeds 【doc:chunk†source】 in text — the "source" label is a
 * placeholder; filenames live on annotations / file_search results.
 */
function extractCitationMeta(apiResponse) {
  /** docIndex -> filename */
  const byDocIndex = new Map();
  /** ordered unique filenames from file_search / citations */
  const ordered = [];
  /** { start, end, filename } from url/file annotations with spans */
  const bySpan = [];

  const remember = (docIndex, name) => {
    const filename = cleanFilename(name);
    if (!filename) return filename;
    if (docIndex != null && docIndex !== "" && !Number.isNaN(Number(docIndex))) {
      byDocIndex.set(String(docIndex), filename);
    }
    if (!ordered.includes(filename)) ordered.push(filename);
    return filename;
  };

  const walk = (node, seen = new Set()) => {
    if (!node || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);

    if (Array.isArray(node)) {
      for (const item of node) walk(item, seen);
      return;
    }

    const type = node.type;

    if (type === "file_citation") {
      remember(node.index, node.filename || node.file_id);
    } else if (type === "container_file_citation") {
      const name = remember(node.index, node.filename || node.file_id);
      if (name && typeof node.start_index === "number") {
        bySpan.push({
          start: node.start_index,
          end: node.end_index ?? node.start_index,
          filename: name,
        });
      }
    } else if (type === "url_citation") {
      const name = remember(null, filenameFromUrlCitation(node));
      if (name && typeof node.start_index === "number") {
        bySpan.push({
          start: node.start_index,
          end: node.end_index ?? node.start_index,
          filename: name,
        });
      }
    } else if (type === "file_search_call" && Array.isArray(node.results)) {
      for (const [i, result] of node.results.entries()) {
        remember(
          i,
          result.filename ||
            result.attributes?.title ||
            result.attributes?.filepath ||
            result.file_id
        );
      }
    }

    for (const value of Object.values(node)) {
      if (value && typeof value === "object") walk(value, seen);
    }
  };

  walk(apiResponse);
  return { byDocIndex, ordered, bySpan };
}

function cleanFilename(value) {
  if (value == null) return "";
  let name = String(value).trim();
  if (!name || /^source$/i.test(name)) return "";

  if (name.includes("://")) {
    const path = name.split("://").slice(1).join("://");
    name = path.split("/").filter(Boolean).pop() || name;
  }

  name = name.replace(/[?#].*$/, "");
  // Strip Azure chunk suffixes: File.pdf_p1_c0
  name = name.replace(/_p\d+_c\d+$/i, "");
  // Prefer bare filename when a path/title is returned
  name = name.split(/[/\\]/).filter(Boolean).pop() || name;
  return name.trim();
}

/** Azure grounding / tool labels that are not knowledge-base documents */
function isNoiseCitation(name) {
  if (!name) return true;
  const n = String(name).trim().toLowerCase();
  if (!n || n === "source") return true;
  if (/^document\s+\d+$/i.test(n)) return true;
  // MCP / Azure AI Search internal endpoints (e.g. mcp://answersynthesis)
  if (/answersynthesis/i.test(n)) return true;
  if (/^searchindex$/i.test(n)) return true;
  if (/^mcp$/i.test(n)) return true;
  return false;
}

function filenameFromUrlCitation(ann) {
  return cleanFilename(ann.title) || cleanFilename(ann.url) || "";
}

/**
 * Strip Foundry markers 【6:0†source】 from the answer text and build a
 * references map of real knowledge-base documents (no inline [1]/[2]).
 */
function formatCitations(rawText = "", apiResponse = null) {
  const text = String(rawText);
  const { byDocIndex, ordered, bySpan } = extractCitationMeta(apiResponse);
  const markerRe = /【(\d+):(\d+)†([^】]+)】/g;

  /** @type {Map<string, number>} */
  const fileToNum = new Map();
  /** @type {Record<string, string>} */
  const references = {};
  let next = 1;

  const resolveFilename = (docIdx, label, matchStart, matchEnd) => {
    const fromLabel = cleanFilename(label);
    if (fromLabel && !isNoiseCitation(fromLabel)) return fromLabel;

    const spanHit =
      bySpan.find((s) => s.start <= matchStart && s.end > matchStart) ||
      bySpan.find((s) => s.start < matchEnd && s.end > matchStart);
    if (spanHit?.filename && !isNoiseCitation(spanHit.filename)) {
      return spanHit.filename;
    }

    const fromDoc = byDocIndex.get(String(docIdx));
    if (fromDoc && !isNoiseCitation(fromDoc)) return fromDoc;

    const asNum = Number(docIdx);
    if (!Number.isNaN(asNum) && ordered[asNum] && !isNoiseCitation(ordered[asNum])) {
      return ordered[asNum];
    }

    const realDocs = ordered.filter((f) => !isNoiseCitation(f));
    if (realDocs.length === 1) return realDocs[0];

    return "";
  };

  // Remove markers from the visible answer; collect real docs for references
  let response = text.replace(markerRe, (match, docIdx, _chunkIdx, label, offset) => {
    const filename = resolveFilename(docIdx, label, offset, offset + match.length);
    if (filename && !isNoiseCitation(filename) && !fileToNum.has(filename)) {
      const num = next++;
      fileToNum.set(filename, num);
      references[String(num)] = filename;
    }
    return "";
  });

  // Also include any other retrieved real docs not tied to a marker
  for (const filename of ordered) {
    if (isNoiseCitation(filename) || fileToNum.has(filename)) continue;
    const num = next++;
    fileToNum.set(filename, num);
    references[String(num)] = filename;
  }

  // Tidy whitespace left by stripped markers
  response = response
    .replace(/[ \t]+\n/g, "\n")
    .replace(/ +([.,;:!?])/g, "$1")
    .replace(/ {2,}/g, " ")
    .trim();

  return { response, references };
}

async function chatWithUhie({ message, history = [], user }) {
  const client = getProjectClient();
  if (!client) {
    throw new Error("FOUNDRY_ENDPOINT and FOUNDRY_AGENT_NAME are required");
  }

  const agent = await client.agents.get(agentName);
  console.log("Agent:", agent.name);

  // Prompt/workflow agents: project OpenAI client + agent_reference
  const openaiClient = client.getOpenAIClient();
  const input = buildAgentInput({ message, history, user });

  let response;
  try {
    response = await openaiClient.responses.create(
      {
        input,
        // Needed so file_search results (with filenames) are present on the payload
        include: ["file_search_call.results"],
      },
      {
        body: {
          agent_reference: { name: agent.name, type: "agent_reference" },
        },
      }
    );
  } catch (err) {
    // Older agent endpoints may reject `include`; retry without it
    const msg = String(err?.message || err);
    if (!/include/i.test(msg)) throw err;
    response = await openaiClient.responses.create(
      { input },
      {
        body: {
          agent_reference: { name: agent.name, type: "agent_reference" },
        },
      }
    );
  }

  // Temporary: help diagnose citation payload shape in server logs
  try {
    const sample = JSON.stringify(response?.output ?? response, null, 2);
    console.log("Uhie citation payload sample:", sample.slice(0, 4000));
  } catch {
    /* ignore */
  }

  return formatCitations(response.output_text || "", response);
}

/** Local-dev startup probe: resolve the Foundry agent (non-blocking). */
async function checkUhieConnection() {
  if (!isFoundryConfigured()) {
    console.warn(
      "⚠️  Uhie chatbot not configured (set FOUNDRY_ENDPOINT and FOUNDRY_AGENT_NAME)"
    );
    return false;
  }

  try {
    const agent = await getAgentInfo();
    const version = agent.versions?.latest?.version;
    console.log(
      `✅ Uhie chatbot connection successful${version ? ` (agent: ${agent.name} v${version})` : ` (agent: ${agent.name})`}`
    );
    return true;
  } catch (error) {
    console.error("❌ Uhie chatbot connection failed:", error.message);
    return false;
  }
}

module.exports = {
  isFoundryConfigured,
  getAgentInfo,
  chatWithUhie,
  formatCitations,
  checkUhieConnection,
  agentName,
};
