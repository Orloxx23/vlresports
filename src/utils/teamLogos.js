const cheerio = require("cheerio");
const { vlrgg_url, team_logo_placeholder } = require("../constants");
const { vlrGet, normalizeTheme } = require("./vlrSession");

const INDEX_TTL_MS = 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const FALLBACK_CONCURRENCY = 5;
const INDEX_CONCURRENCY = 6;

const REGIONS = [
  "all",
  "na",
  "eu",
  "br",
  "kr",
  "jp",
  "ap",
  "latam-n",
  "latam-s",
  "oce",
  "mn",
  "gc",
  "cn",
  "col",
];

let teamsIndex = new Map();
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

function logoKeyFor(theme) {
  return normalizeTheme(theme) === "dark" ? "logoDark" : "logoLight";
}

async function mapLimit(items, limit, fn) {
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const idx = cursor++;
        await fn(items[idx], idx);
      }
    }
  );
  await Promise.all(workers);
}

async function fetchRegionTeams(region, theme) {
  const { data } = await vlrGet(`${vlrgg_url}/rankings/${region}`, theme);
  const $ = cheerio.load(data);
  const entries = [];

  if (region === "all") {
    $("tr")
      .has("td")
      .each((_, el) => {
        const cell = $(el).find("td").first().next();
        const name = cell.attr("data-sort-value");
        if (!name) return;
        const href = cell.find("a").attr("href") || "";
        const id = href.split("/")[2] || null;
        const logo = resolveImgSrc(cell.find("img").attr("src"));
        entries.push({ name, id, logo });
      });
  } else {
    $(".mod-scroll")
      .find(".fa-certificate")
      .parent()
      .parent()
      .each((_, el) => {
        const anchor = $(el).find("a").first();
        const name = anchor.attr("data-sort-value");
        if (!name) return;
        const href = anchor.attr("href") || "";
        const id = href.split("/")[2] || null;
        const logo = resolveImgSrc(anchor.find("img").attr("src"));
        entries.push({ name, id, logo });
      });
  }

  return entries;
}

function mergeIntoIndex(index, entries, themeKey) {
  for (const entry of entries) {
    const key = normalizeName(entry.name);
    let slot = index.get(key);
    if (!slot) {
      slot = { id: entry.id, logoLight: null, logoDark: null };
      index.set(key, slot);
    }
    if (!slot.id && entry.id) slot.id = entry.id;
    if (!slot[themeKey] && entry.logo) slot[themeKey] = entry.logo;
  }
}

async function fetchTeamsIndex() {
  const tasks = [];
  for (const region of REGIONS) {
    tasks.push({ theme: "light", region });
    tasks.push({ theme: "dark", region });
  }

  const index = new Map();
  await mapLimit(tasks, INDEX_CONCURRENCY, async ({ theme, region }) => {
    try {
      const entries = await fetchRegionTeams(region, theme);
      mergeIntoIndex(index, entries, logoKeyFor(theme));
    } catch (err) {
      // Region/theme combination failed; continue with the rest.
    }
  });

  // Fill missing theme variants with the available one so we never expose null.
  for (const slot of index.values()) {
    if (!slot.logoLight && slot.logoDark) slot.logoLight = slot.logoDark;
    if (!slot.logoDark && slot.logoLight) slot.logoDark = slot.logoLight;
  }

  return index;
}

async function getTeamsIndex() {
  if (teamsIndex.size > 0 && Date.now() < teamsIndexExpiresAt) return teamsIndex;
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

function extractTeamFromMatchPage($, modClass) {
  const a = $(`a.match-header-link.${modClass}`).first();
  if (!a.length) return null;
  const name = a.find(".wf-title-med").first().text().trim();
  const href = a.attr("href") || "";
  const id = href.split("/")[2] || null;
  const logo = resolveImgSrc(a.find("img").attr("src"));
  return { name, id, logo };
}

async function fetchTeamsFromMatch(matchId, theme) {
  try {
    const { data } = await vlrGet(`${vlrgg_url}/${matchId}`, theme);
    const $ = cheerio.load(data);
    return [
      extractTeamFromMatchPage($, "mod-1"),
      extractTeamFromMatchPage($, "mod-2"),
    ].filter(Boolean);
  } catch (err) {
    return [];
  }
}

function applyTeamLookup(match, themeKey) {
  if (!match || !Array.isArray(match.teams)) return true;
  let allResolved = true;
  for (const team of match.teams) {
    if (!team || !team.name) continue;
    if (team.id && team.logo && team.logo !== team_logo_placeholder) continue;
    const entry = teamsIndex.get(normalizeName(team.name));
    if (entry) {
      team.id = entry.id;
      team.logo = entry[themeKey] || team_logo_placeholder;
    } else {
      allResolved = false;
    }
  }
  return allResolved;
}

async function enrichMatchesWithTeamLogos(matches, theme) {
  if (!Array.isArray(matches) || matches.length === 0) return matches;

  const themeKey = logoKeyFor(theme);

  try {
    await getTeamsIndex();
  } catch (err) {
    // serve what we have (possibly empty) and continue
  }

  const unresolvedMatches = [];
  for (const match of matches) {
    const resolved = applyTeamLookup(match, themeKey);
    if (!resolved && match && match.id) unresolvedMatches.push(match);
  }

  if (unresolvedMatches.length > 0) {
    await mapLimit(unresolvedMatches, FALLBACK_CONCURRENCY, async (match) => {
      const teams = await fetchTeamsFromMatch(match.id, theme);
      if (teams.length) {
        mergeIntoIndex(teamsIndex, teams, themeKey);
      }
      applyTeamLookup(match, themeKey);
    });
  }

  for (const match of matches) {
    if (!match || !Array.isArray(match.teams)) continue;
    for (const team of match.teams) {
      if (!team) continue;
      if (team.id === undefined) team.id = null;
      if (!team.logo) team.logo = team_logo_placeholder;
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
