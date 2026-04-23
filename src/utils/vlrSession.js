const axios = require("axios");
const { vlrgg_url } = require("../constants");

const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = 3 * 60 * 60 * 1000;
const VALID_THEMES = new Set(["light", "dark"]);
const DEFAULT_THEME = "light";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 vlresports/1.0";

const MIN_REQUEST_GAP_MS = 600;
const REQUEST_TIMEOUT_MS = 20000;

const sessions = {
  light: { cookie: null, expiresAt: 0 },
  dark: { cookie: null, expiresAt: 0 },
};
const pendingInits = { light: null, dark: null };
let refreshTimer = null;

const requestQueue = [];
let queueRunning = false;
let lastRequestAt = 0;

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

function vlrAxiosGet(url, config) {
  return enqueue(() =>
    axios.get(url, { timeout: REQUEST_TIMEOUT_MS, ...config })
  );
}

function vlrAxiosPost(url, body, config) {
  return enqueue(() =>
    axios.post(url, body, { timeout: REQUEST_TIMEOUT_MS, ...config })
  );
}

function normalizeTheme(theme) {
  return VALID_THEMES.has(theme) ? theme : DEFAULT_THEME;
}

function extractPHPSessionId(setCookieHeaders) {
  if (!setCookieHeaders) return null;
  const headers = Array.isArray(setCookieHeaders)
    ? setCookieHeaders
    : [setCookieHeaders];
  for (const h of headers) {
    const m = h.match(/PHPSESSID=([^;]+)/);
    if (m) return m[1];
  }
  return null;
}

async function createSession(theme) {
  const initRes = await vlrAxiosGet(`${vlrgg_url}/`, {
    headers: { "User-Agent": USER_AGENT },
  });
  const sid = extractPHPSessionId(initRes.headers["set-cookie"]);
  if (!sid) throw new Error("PHPSESSID not present in vlr.gg response");

  if (theme === "dark") {
    await vlrAxiosPost(
      `${vlrgg_url}/user/settings`,
      { key: "dark_mode", value: 1 },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": USER_AGENT,
          Cookie: `PHPSESSID=${sid}`,
          Referer: `${vlrgg_url}/`,
        },
      }
    );
  }

  return `PHPSESSID=${sid}`;
}

async function getSessionCookie(theme) {
  const t = normalizeTheme(theme);
  const slot = sessions[t];
  if (slot.cookie && Date.now() < slot.expiresAt) return slot.cookie;
  if (pendingInits[t]) return pendingInits[t];

  pendingInits[t] = createSession(t)
    .then((cookie) => {
      slot.cookie = cookie;
      slot.expiresAt = Date.now() + SESSION_TTL_MS;
      pendingInits[t] = null;
      return cookie;
    })
    .catch((err) => {
      pendingInits[t] = null;
      throw err;
    });

  return pendingInits[t];
}

function invalidateSession(theme) {
  const t = normalizeTheme(theme);
  sessions[t].cookie = null;
  sessions[t].expiresAt = 0;
}

function mergeRequestHeaders(existingHeaders, sessionCookie) {
  const baseCookie = existingHeaders && existingHeaders.Cookie;
  return {
    "User-Agent": USER_AGENT,
    ...(existingHeaders || {}),
    Cookie: baseCookie ? `${baseCookie}; ${sessionCookie}` : sessionCookie,
  };
}

async function vlrGet(url, theme, axiosConfig = {}) {
  const t = normalizeTheme(theme);
  const cookie = await getSessionCookie(t);

  const firstAttempt = await vlrAxiosGet(url, {
    ...axiosConfig,
    headers: mergeRequestHeaders(axiosConfig.headers, cookie),
  });

  if (typeof firstAttempt.data === "string") {
    const themeMatch = firstAttempt.data.match(/data-theme="(light|dark)"/);
    if (themeMatch && themeMatch[1] !== t) {
      invalidateSession(t);
      const fresh = await getSessionCookie(t);
      return vlrAxiosGet(url, {
        ...axiosConfig,
        headers: mergeRequestHeaders(axiosConfig.headers, fresh),
      });
    }
  }

  return firstAttempt;
}

function startSessionRefresher({
  intervalMs = REFRESH_INTERVAL_MS,
  initialDelayMs = 60 * 1000,
} = {}) {
  if (refreshTimer) return;

  setTimeout(() => {
    Promise.all([getSessionCookie("light"), getSessionCookie("dark")])
      .then(() => {
        console.log("[vlrSession] Warm-up loaded light + dark sessions");
      })
      .catch((err) => {
        console.error("[vlrSession] Warm-up failed:", err.message);
      });
  }, initialDelayMs).unref();

  refreshTimer = setInterval(() => {
    invalidateSession("light");
    invalidateSession("dark");
    Promise.all([getSessionCookie("light"), getSessionCookie("dark")])
      .then(() => {
        console.log("[vlrSession] Refreshed light + dark sessions");
      })
      .catch((err) => {
        console.error("[vlrSession] Refresh failed:", err.message);
      });
  }, intervalMs);

  refreshTimer.unref();
}

function stopSessionRefresher() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

module.exports = {
  vlrGet,
  getSessionCookie,
  invalidateSession,
  normalizeTheme,
  startSessionRefresher,
  stopSessionRefresher,
  VALID_THEMES,
  DEFAULT_THEME,
};
