/**
 * Redact credentials from a MongoDB URI before logging.
 * mongodb+srv://user:pass@host/db -> mongodb+srv://***:***@host/db
 */
function sanitizeMongoUri(uri) {
    if (!uri || typeof uri !== "string") return "(not set)";

    try {
        const parsed = new URL(uri.replace(/^mongodb(\+srv)?:/, "http:"));
        if (parsed.username || parsed.password) {
            parsed.username = "***";
            parsed.password = "***";
        }
        const protocol = uri.startsWith("mongodb+srv://") ? "mongodb+srv://" : "mongodb://";
        return protocol + parsed.host + parsed.pathname + parsed.search;
    } catch {
        return "(invalid URI)";
    }
}

module.exports = { sanitizeMongoUri };
