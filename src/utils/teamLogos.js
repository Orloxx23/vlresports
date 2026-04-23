const axios = require("axios");
const cheerio = require("cheerio");
const { vlrgg_url, team_logo_placeholder } = require("../constants");

const INDEX_TTL_MS = 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

let teamsIndex = null;
let teamsIndexExpiresAt = 0;
let pendingIndexLoad = null;
let refreshTimer = null;

function normalizeName(name) {
  return (name || "").toLowerCase().trim();
}

function resolveImgSrc(src) {
  if (!src) return null;
  if (src.includes("/img/vlr")) return vlrgg_url + src;
  return "https:" + src;
}

async function fetchTeamsIndex() {
  const { data } = await axios.get(`${vlrgg_url}/rankings/all`);
  const $ = cheerio.load(data);
  const index = new Map();

  $("tr")
    .has("td")
    .each((_, el) => {
      const cell = $(el).find("td").first().next();
      const name = cell.attr("data-sort-value");
      if (!name) return;
      const href = cell.find("a").attr("href") || "";
      const id = href.split("/")[2] || null;
      const logo = resolveImgSrc(cell.find("img").attr("src"));
      index.set(normalizeName(name), { id, logo });
    });

  return index;
}

async function getTeamsIndex() {
  if (teamsIndex && Date.now() < teamsIndexExpiresAt) return teamsIndex;
  if (pendingIndexLoad) return pendingIndexLoad;

  pendingIndexLoad = fetchTeamsIndex()
    .then((index) => {
      teamsIndex = index;
      teamsIndexExpiresAt = Date.now() + INDEX_TTL_MS;
      pendingIndexLoad = null;
      return index;
    })
    .catch((err) => {
      pendingIndexLoad = null;
      throw err;
    });

  return pendingIndexLoad;
}

async function enrichMatchesWithTeamLogos(matches) {
  if (!Array.isArray(matches) || matches.length === 0) return matches;

  let index;
  try {
    index = await getTeamsIndex();
  } catch (err) {
    return matches;
  }

  for (const match of matches) {
    if (!match || !Array.isArray(match.teams)) continue;
    for (const team of match.teams) {
      if (!team || !team.name) continue;
      const entry = index.get(normalizeName(team.name));
      team.id = entry ? entry.id : null;
      team.logo = entry && entry.logo ? entry.logo : team_logo_placeholder;
    }
  }

  return matches;
}

function startTeamsIndexRefresher({ intervalMs = REFRESH_INTERVAL_MS } = {}) {
  if (refreshTimer) return;

  getTeamsIndex()
    .then((index) => {
      console.log(`[teamLogos] Warm-up loaded ${index.size} teams`);
    })
    .catch((err) => {
      console.error("[teamLogos] Warm-up failed:", err.message);
    });

  refreshTimer = setInterval(() => {
    fetchTeamsIndex()
      .then((index) => {
        teamsIndex = index;
        teamsIndexExpiresAt = Date.now() + INDEX_TTL_MS;
        console.log(`[teamLogos] Refreshed index (${index.size} teams)`);
      })
      .catch((err) => {
        console.error("[teamLogos] Refresh failed:", err.message);
      });
  }, intervalMs);

  refreshTimer.unref();
}

function stopTeamsIndexRefresher() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

module.exports = {
  enrichMatchesWithTeamLogos,
  getTeamsIndex,
  startTeamsIndexRefresher,
  stopTeamsIndexRefresher,
};
