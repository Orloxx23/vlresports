const axios = require("axios");

const VALID_THEMES = new Set(["light", "dark"]);
const DEFAULT_THEME = "light";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 vlresports/1.0";

// vlr.gg stores the dark-mode preference in a plain client-side cookie named
// `settings`. There is no server-side session involved — sending this cookie
// flips the theme for any request, no PHPSESSID required.
const DARK_MODE_COOKIE = 'settings=%7B%22dark_mode%22%3A1%7D';

const MIN_REQUEST_GAP_MS = 600;
const REQUEST_TIMEOUT_MS = 20000;

// Upper bound on how many scraper jobs may sit in the shared queue at once.
// Because a single worker drains the queue with a MIN_REQUEST_GAP_MS gap, an
// unbounded queue lets any client serialize the whole service behind their
// jobs (CWE-770). Rejecting once the queue is full caps both the added latency
// (MAX_QUEUE_LENGTH * MIN_REQUEST_GAP_MS) and memory growth.
const MAX_QUEUE_LENGTH = Number(process.env.VLR_MAX_QUEUE_LENGTH) || 50;

// A job that has waited longer than this is dropped instead of fetched: its
// caller has most likely given up already. Fetching it anyway is how a slow
// vlr.gg turns into a queue packed with work nobody is waiting for.
const QUEUE_MAX_WAIT_MS = Number(process.env.VLR_QUEUE_MAX_WAIT_MS) || 30000;

// Raw vlr.gg pages are cached so repeat API calls never reach the queue, and
// so the last good copy can be served while vlr.gg or the proxy is failing.
const CACHE_MAX_CHARS =
  (Number(process.env.VLR_CACHE_MAX_MB) || 32) * 1024 * 1024;
const STALE_MAX_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TTL_MS = 5 * 60 * 1000;
// How long a page counts as fresh, by vlr.gg path. Pages that can show live
// scores stay short.
const TTL_RULES = [
  [/^\/\d+/, 30 * 1000], // match page
  [/^\/matches\/results/, 60 * 1000],
  [/^\/matches/, 30 * 1000],
  [/^\/event\/matches\//, 60 * 1000],
  [/^\/rankings\//, 30 * 60 * 1000],
];

// After this many upstream failures in a row vlr.gg is treated as down:
// expired pages are served from cache right away (refreshed in the
// background) and /health reports degraded.
const FAILURE_THRESHOLD = 5;

const PROXY_URL = process.env.VLR_PROXY_URL || "";
const PROXY_TOKEN = process.env.VLR_PROXY_TOKEN || "";
const PROXY_ENABLED = Boolean(PROXY_URL && PROXY_TOKEN);

const requestQueue = [];
let queueRunning = false;
let lastRequestAt = 0;
let bootLogged = false;

const cache = new Map();
let cacheChars = 0;
const inflight = new Map();

const upstream = {
  consecutiveFailures: 0,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastFailure: null,
  staleServed: 0,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function queueError(message) {
  const err = new Error(message);
  err.statusCode = 503;
  return err;
}

async function processQueue() {
  if (queueRunning) return;
  queueRunning = true;
  try {
    while (requestQueue.length > 0) {
      const job = requestQueue.shift();
      if (Date.now() - job.enqueuedAt > QUEUE_MAX_WAIT_MS) {
        job.reject(queueError("Scraper queue timed out, try again later"));
        continue;
      }
      const wait = lastRequestAt + MIN_REQUEST_GAP_MS - Date.now();
      if (wait > 0) await sleep(wait);
      lastRequestAt = Date.now();
      try {
        const result = await job.fn();
        job.resolve(result);
      } catch (err) {
        job.reject(err);
      }
    }
  } finally {
    queueRunning = false;
  }
}

function enqueue(fn) {
  return new Promise((resolve, reject) => {
    if (requestQueue.length >= MAX_QUEUE_LENGTH) {
      reject(queueError("Scraper queue is full, try again later"));
      return;
    }
    requestQueue.push({ fn, resolve, reject, enqueuedAt: Date.now() });
    processQueue();
  });
}

function proxify(url, headers) {
  if (!PROXY_ENABLED) return { url, headers: headers || {} };
  return {
    url: `${PROXY_URL}?u=${encodeURIComponent(url)}`,
    headers: { ...(headers || {}), "X-Proxy-Token": PROXY_TOKEN },
  };
}

function normalizeTheme(theme) {
  return VALID_THEMES.has(theme) ? theme : DEFAULT_THEME;
}

function buildHeaders(theme) {
  const headers = { "User-Agent": USER_AGENT };
  if (theme === "dark") headers.Cookie = DARK_MODE_COOKIE;
  return headers;
}

function ttlFor(url) {
  const { pathname } = new URL(url);
  const rule = TTL_RULES.find(([pattern]) => pattern.test(pathname));
  return rule ? rule[1] : DEFAULT_TTL_MS;
}

function cacheDelete(key) {
  const entry = cache.get(key);
  if (!entry) return;
  cacheChars -= entry.data.length;
  cache.delete(key);
}

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > STALE_MAX_MS) {
    cacheDelete(key);
    return null;
  }
  // Re-insert so the Map's order tracks recency (oldest first) for eviction.
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

function cacheSet(key, data) {
  if (typeof data !== "string" || data.length > CACHE_MAX_CHARS) return;
  cacheDelete(key);
  cache.set(key, { data, fetchedAt: Date.now() });
  cacheChars += data.length;
  for (const oldestKey of cache.keys()) {
    if (cacheChars <= CACHE_MAX_CHARS) break;
    cacheDelete(oldestKey);
  }
}

// A 404 means vlr.gg answered fine and the page just doesn't exist.
function isUpstreamFailure(err) {
  return !(err.response && err.response.status === 404);
}

function recordAttempt(err) {
  if (!err || !isUpstreamFailure(err)) {
    upstream.consecutiveFailures = 0;
    upstream.lastSuccessAt = new Date().toISOString();
    return;
  }
  upstream.consecutiveFailures++;
  upstream.lastFailureAt = new Date().toISOString();
  upstream.lastFailure = err.response
    ? `HTTP ${err.response.status}`
    : err.code || "unknown";
}

function upstreamDown() {
  return upstream.consecutiveFailures >= FAILURE_THRESHOLD;
}

// axios' `timeout` is a socket idle timeout, so a response that trickles in a
// few bytes at a time never trips it. With a single queue worker that one
// request would stall every request behind it; the abort is a hard deadline.
async function fetchPage(url, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await axios.get(url, {
      timeout: REQUEST_TIMEOUT_MS,
      headers,
      signal: controller.signal,
    });
    recordAttempt(null);
    return res;
  } catch (err) {
    let failure = err;
    if (axios.isCancel(err)) {
      failure = new Error(`timeout of ${REQUEST_TIMEOUT_MS}ms exceeded`);
      failure.code = "ETIMEDOUT";
    }
    recordAttempt(failure);
    throw failure;
  } finally {
    clearTimeout(timer);
  }
}

// Concurrent requests for the same page share one upstream fetch instead of
// each taking a slot in the queue.
function refresh(key, url, theme) {
  if (inflight.has(key)) return inflight.get(key);
  const { url: finalUrl, headers } = proxify(url, buildHeaders(theme));
  const pending = enqueue(() => fetchPage(finalUrl, headers))
    .then(({ data }) => {
      cacheSet(key, data);
      return { data };
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, pending);
  return pending;
}

async function vlrGet(url, theme) {
  const t = normalizeTheme(theme);
  const key = `${t}|${url}`;
  const cached = cacheGet(key);

  if (cached) {
    if (Date.now() - cached.fetchedAt < ttlFor(url)) {
      return { data: cached.data };
    }
    if (upstreamDown()) {
      // Don't make the caller wait on a fetch that will most likely fail;
      // the background refresh is what notices vlr.gg coming back.
      refresh(key, url, t).catch(() => {});
      upstream.staleServed++;
      return { data: cached.data };
    }
  }

  try {
    return await refresh(key, url, t);
  } catch (err) {
    if (cached && isUpstreamFailure(err)) {
      upstream.staleServed++;
      return { data: cached.data };
    }
    throw err;
  }
}

function getScraperHealth() {
  return {
    healthy: !upstreamDown(),
    queueLength: requestQueue.length,
    maxQueueLength: MAX_QUEUE_LENGTH,
    cachedPages: cache.size,
    cacheMb: Math.round((cacheChars / 1024 / 1024) * 10) / 10,
    ...upstream,
  };
}

function startSessionRefresher() {
  if (bootLogged) return;
  bootLogged = true;
  console.log(
    PROXY_ENABLED
      ? `[vlrSession] Routing vlr.gg requests through proxy ${PROXY_URL}`
      : "[vlrSession] No proxy configured — talking to vlr.gg directly"
  );
}

function stopSessionRefresher() {
  // No state to clean up anymore; kept for API compatibility.
}

module.exports = {
  vlrGet,
  normalizeTheme,
  getScraperHealth,
  startSessionRefresher,
  stopSessionRefresher,
  VALID_THEMES,
  DEFAULT_THEME,
};
