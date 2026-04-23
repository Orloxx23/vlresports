const cheerio = require("cheerio");
const { vlrgg_url } = require("../constants");
const { vlrGet, normalizeTheme } = require("./vlrSession");

const TTL_MS = 6 * 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = 3 * 60 * 60 * 1000;
const PAGES = [1, 2, 3];

let lightToDark = new Map();
let darkToLight = new Map();
let expiresAt = 0;
let pendingLoad = null;
let refreshTimer = null;

function resolveSrc(src) {
  if (!src) return null;
  if (src.includes("/img/vlr")) return vlrgg_url + src;
  return "https:" + src;
}

function extractEventId(href) {
  if (!href) return null;
  const m = href.replace(/\\/g, "/").match(/\/event\/(\d+)/);
  return m ? m[1] : null;
}

async function fetchEventsPage(page, theme) {
  const { data } = await vlrGet(`${vlrgg_url}/events/?page=${page}`, theme);
  const $ = cheerio.load(data);
  const out = [];
  $(".event-item").each((_, el) => {
    const id = extractEventId($(el).attr("href"));
    const src = resolveSrc($(el).find(".event-item-thumb img").attr("src"));
    if (id && src) out.push({ id, src });
  });
  return out;
}

async function fetchEventLogosIndex() {
  const lightById = new Map();
  const darkById = new Map();

  for (const page of PAGES) {
    try {
      const lights = await fetchEventsPage(page, "light");
      for (const e of lights) lightById.set(e.id, e.src);
    } catch (err) {
      // swallow per-page failure; continue with what we have
    }
    try {
      const darks = await fetchEventsPage(page, "dark");
      for (const e of darks) darkById.set(e.id, e.src);
    } catch (err) {}
  }

  const l2d = new Map();
  const d2l = new Map();
  for (const [id, lightSrc] of lightById) {
    const darkSrc = darkById.get(id);
    if (!darkSrc) continue;
    if (lightSrc !== darkSrc) {
      l2d.set(lightSrc, darkSrc);
      d2l.set(darkSrc, lightSrc);
    }
  }
  return { l2d, d2l };
}

async function getEventLogosIndex() {
  if (lightToDark.size > 0 && Date.now() < expiresAt) {
    return { l2d: lightToDark, d2l: darkToLight };
  }
  if (pendingLoad) return pendingLoad;

  pendingLoad = fetchEventLogosIndex()
    .then(({ l2d, d2l }) => {
      lightToDark = l2d;
      darkToLight = d2l;
      expiresAt = Date.now() + TTL_MS;
      pendingLoad = null;
      return { l2d, d2l };
    })
    .catch((err) => {
      pendingLoad = null;
      throw err;
    });

  return pendingLoad;
}

async function applyEventLogosToMatches(matches, theme) {
  if (!Array.isArray(matches) || matches.length === 0) return matches;
  const t = normalizeTheme(theme);

  let l2d, d2l;
  try {
    ({ l2d, d2l } = await getEventLogosIndex());
  } catch (err) {
    return matches;
  }

  const map = t === "dark" ? l2d : d2l;
  if (map.size === 0) return matches;

  for (const m of matches) {
    if (!m || !m.img) continue;
    const replacement = map.get(m.img);
    if (replacement) m.img = replacement;
  }
  return matches;
}

function startEventLogosRefresher({
  intervalMs = REFRESH_INTERVAL_MS,
  initialDelayMs = 120 * 1000,
} = {}) {
  if (refreshTimer) return;

  setTimeout(() => {
    getEventLogosIndex()
      .then(({ l2d }) => {
        console.log(`[eventLogos] Warm-up loaded ${l2d.size} event logo pairs`);
      })
      .catch((err) => {
        console.error("[eventLogos] Warm-up failed:", err.message);
      });
  }, initialDelayMs).unref();

  refreshTimer = setInterval(() => {
    fetchEventLogosIndex()
      .then(({ l2d, d2l }) => {
        lightToDark = l2d;
        darkToLight = d2l;
        expiresAt = Date.now() + TTL_MS;
        console.log(`[eventLogos] Refreshed (${l2d.size} pairs)`);
      })
      .catch((err) => {
        console.error("[eventLogos] Refresh failed:", err.message);
      });
  }, intervalMs);

  refreshTimer.unref();
}

function stopEventLogosRefresher() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

module.exports = {
  applyEventLogosToMatches,
  getEventLogosIndex,
  startEventLogosRefresher,
  stopEventLogosRefresher,
};
