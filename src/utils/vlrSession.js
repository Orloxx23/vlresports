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

const PROXY_URL = process.env.VLR_PROXY_URL || "";
const PROXY_TOKEN = process.env.VLR_PROXY_TOKEN || "";
const PROXY_ENABLED = Boolean(PROXY_URL && PROXY_TOKEN);

const requestQueue = [];
let queueRunning = false;
let lastRequestAt = 0;
let bootLogged = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processQueue() {
  if (queueRunning) return;
  queueRunning = true;
  try {
    while (requestQueue.length > 0) {
      const job = requestQueue.shift();
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
    requestQueue.push({ fn, resolve, reject });
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

function buildHeaders(existingHeaders, theme) {
  const baseCookie = existingHeaders && existingHeaders.Cookie;
  const themeCookie = theme === "dark" ? DARK_MODE_COOKIE : null;
  const cookieParts = [baseCookie, themeCookie].filter(Boolean);
  const headers = {
    "User-Agent": USER_AGENT,
    ...(existingHeaders || {}),
  };
  if (cookieParts.length > 0) {
    headers.Cookie = cookieParts.join("; ");
  }
  return headers;
}

async function vlrGet(url, theme, axiosConfig = {}) {
  const t = normalizeTheme(theme);
  const headers = buildHeaders(axiosConfig.headers, t);
  const { url: finalUrl, headers: finalHeaders } = proxify(url, headers);
  return enqueue(() =>
    axios.get(finalUrl, {
      timeout: REQUEST_TIMEOUT_MS,
      ...axiosConfig,
      headers: finalHeaders,
    })
  );
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
  startSessionRefresher,
  stopSessionRefresher,
  VALID_THEMES,
  DEFAULT_THEME,
};
