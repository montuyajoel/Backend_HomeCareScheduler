// Logs method, URL, IP, query, body and response status + duration

// ANSI color helpers (no external deps)
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function colorize(text, color) {
  return `${COLORS[color] || ''}${text}${COLORS.reset}`;
}

module.exports = function requestLogger(req, res, next) {
  const start = process.hrtime();
  const { method, originalUrl, ip } = req;
  const timestamp = new Date().toISOString();

  // Capture body and query safely
  let body = '';
  try {
    body = req.body && Object.keys(req.body).length ? JSON.stringify(req.body) : '';
  } catch (err) {
    body = '[unserializable body]';
  }
  let query = '';
  try {
    query = req.query && Object.keys(req.query).length ? JSON.stringify(req.query) : '';
  } catch (err) {
    query = '[unserializable query]';
  }

  // When response finishes, log status and duration
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationMs = (diff[0] * 1e3) + (diff[1] / 1e6);

    // Color method
    const methodColored = colorize(method, 'cyan');

    // Color status (green=2xx, yellow=3xx/4xx, red=5xx)
    const status = res.statusCode || 0;
    let statusColor = 'green';
    if (status >= 500) statusColor = 'red';
    else if (status >= 400) statusColor = 'yellow';
    else if (status >= 300) statusColor = 'magenta';
    const statusColored = colorize(`status=${status}`, statusColor);

    // Color duration (slow > 1000ms red, > 500ms yellow)
    let durColor = 'green';
    if (durationMs > 1000) durColor = 'red';
    else if (durationMs > 500) durColor = 'yellow';
    const durationColored = colorize(`duration=${durationMs.toFixed(2)}ms`, durColor);

    const timestampColored = colorize(`[${timestamp}]`, 'gray');
    const ipColored = colorize(ip || req.connection.remoteAddress || '-', 'blue');
    const urlColored = colorize(originalUrl, 'bright');

    const parts = [timestampColored, ipColored, methodColored, urlColored, statusColored, durationColored];
    if (query) parts.push(colorize(`query=${query}`, 'dim'));
    if (body) parts.push(colorize(`body=${body}`, 'dim'));

    console.log(parts.join(' '));
  });

  next();
};
