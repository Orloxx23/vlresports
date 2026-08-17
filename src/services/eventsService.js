const cheerio = require("cheerio");
const { vlrgg_url } = require("../constants");
const { vlrGet } = require("../utils/vlrSession");

const TIER_MAP = {
  vct: "60",
  vcl: "61",
  t3: "62",
  "game-changers": "63",
  collegiate: "64",
  offseason: "67",
  all: "all"
};

const REGION_MAP = {
  americas: "26",
  emea: "27",
  pacific: "28",
  china: "24",
  all: "all"
};

/**
 * Retrieves and parses event data based on the provided status, region, tier, and page number from a specified URL using cheerio and request modules.
 * @param {string} status - The status of the events to filter ("all", "upcoming", "live", "completed").
 * @param {string} region - The region of the events to filter (e.g., "na", "eu").
 * @param {string} tier - The tier of the events to filter (e.g., "vct", "vcl", "t3").
 * @param {number} page - The page number of the events to retrieve (default is 1).
 * @returns {Object} An object containing event details including event name, status, prize pool, dates, region, and event image URL.
 */
async function getEvents(status, region, tier, page, theme) {
  const regionParam = REGION_MAP[region] || region;
  const tierParam = tier ? `&tier=${TIER_MAP[tier] || tier}` : "";
  const { data } = await vlrGet(
    `${vlrgg_url}/events/?region=${regionParam}&page=${page}${tierParam}`,
    theme
  );
  const $ = cheerio.load(data);

  // Array to store event objects
  const events = [];

  // Iterate over each event item on the page and extract relevant information
  $(".event-item").each((index, element) => {
    // Extract event ID, name, and status
    const href = $(element).attr("href");
    const id = href.match(/\/event\/(\d+)\//)[1];
    const name = $(element).find(".event-item-title").text().trim();
    const eventStatus = $(element)
      .find(".event-item-desc-item-status")
      .text()
      .trim();

    // Check if the event status matches the provided status or if status is "all"
    if (status === "all" || eventStatus === status) {
      // Extract prize pool, dates, country, and event image URL
      const prizepoolText = $(element)
        .find(".event-item-desc-item.mod-prize")
        .text()
        .trim();
      const prizepool = prizepoolText.replace(/\D/g, "");
      const datesText = $(element)
        .find(".event-item-desc-item.mod-dates")
        .text()
        .trim();
      const dates = datesText
        .match(/[a-zA-Z]+|\d+/g)
        .join(" ")
        .replace(" Dates", "");
      const country = $(element)
        .find(".event-item-desc-item.mod-location .flag")
        .attr("class")
        .split(" ")[1]
        .replace("mod-", "");
      const img = $(element)
        .find(".event-item-thumb img")
        .attr("src")
        .includes("/img/vlr")
        ? vlrgg_url + $(element).find(".event-item-thumb img").attr("src")
        : "https:" + $(element).find(".event-item-thumb img").attr("src");

      // Create event object and push it to the events array
      events.push({
        id,
        name,
        status: eventStatus,
        prizepool,
        dates,
        country,
        img,
      });
    }
  });

  // Return an object containing the list of events and the number of events in the list
  return {
    events: events,
    size: events.length,
  };
}

/**
 * Converts a relative or protocol-relative image URL to an absolute URL.
 * @param {string} src - The image source attribute.
 * @returns {string|null} The absolute URL or null if missing.
 */
function toAbsoluteUrl(src) {
  if (!src) return null;
  if (src.startsWith("//")) return "https:" + src;
  if (src.startsWith("/")) return vlrgg_url + src;
  return src;
}

/**
 * Retrieves the full details of an event by its ID: header info, stages,
 * prize distribution, participating teams with rosters, and the bracket.
 * The bracket (and teams list) belong to one stage at a time; vlr.gg shows
 * the current stage by default and `stage` selects a different one by slug.
 * @param {string} id - The event's unique ID.
 * @param {string} theme - The vlr.gg theme variant.
 * @param {string} [stage] - Optional stage slug (e.g. "playoffs", "group-stage").
 * @returns {Object} The event details.
 */
async function getEventById(id, theme, stage) {
  // vlr.gg ignores the event-name segment of the URL, so any placeholder works
  const url = stage
    ? `${vlrgg_url}/event/${id}/x/${stage}`
    : `${vlrgg_url}/event/${id}`;

  let data;
  try {
    ({ data } = await vlrGet(url, theme));
  } catch (err) {
    if (err.response && err.response.status === 404) {
      const error = new Error("Event not found");
      error.statusCode = 404;
      throw error;
    }
    throw err;
  }
  const $ = cheerio.load(data);

  if ($(".event-header").length === 0) {
    const error = new Error("Event not found");
    error.statusCode = 404;
    throw error;
  }

  // Header
  const name = $(".event-header-main-title").text().trim();
  const description = $(".event-header-main-desc").text().replace(/\s+/g, " ").trim();
  const img = toAbsoluteUrl($(".event-header-thumb img").attr("src"));

  const circuitLink = $(".event-header-main-bc > a").first();
  const circuit = circuitLink.length
    ? {
        name: circuitLink.text().trim(),
        url: vlrgg_url + circuitLink.attr("href"),
      }
    : null;

  // Meta: label/value pairs (Dates, Prize, Location)
  const meta = {};
  $(".event-header .label").each((i, el) => {
    const label = $(el).text().trim().toLowerCase();
    const value = $(el)
      .parent()
      .find(".value")
      .text()
      .replace(/\s+/g, " ")
      .trim();
    meta[label] = value || null;
  });

  // Stages (subnav). The active one is the stage this response's bracket
  // and teams belong to.
  const stages = $(".wf-subnav-item")
    .map((i, el) => {
      const href = $(el).attr("href") || "";
      return {
        name: $(el).find(".wf-subnav-item-title").text().trim(),
        slug: href.split("/").filter(Boolean).pop() || null,
        dates: $(el).find(".ge-text-light").first().text().trim() || null,
        active: $(el).hasClass("mod-active"),
        url: vlrgg_url + href,
      };
    })
    .get();

  // vlr.gg silently falls back to the default stage on unknown slugs, so an
  // explicit request for a stage that doesn't exist must fail loudly instead.
  if (stage && stages.length > 0 && !stages.some((s) => s.slug === stage)) {
    const error = new Error("Stage not found");
    error.statusCode = 400;
    error.validStages = stages.map((s) => s.slug);
    throw error;
  }

  // Participating teams with rosters
  const teams = $(".event-teams-container > .wf-card")
    .map((i, card) => {
      const nameLink = $(card).find("a.event-team-name");
      const href = nameLink.attr("href") || "";
      const players = $(card)
        .find("a.event-team-players-item")
        .map((j, p) => {
          const pHref = $(p).attr("href") || "";
          const flagClass = $(p).find(".flag").attr("class");
          return {
            id: pHref.split("/")[2] || null,
            url: pHref ? vlrgg_url + pHref : null,
            name: $(p).text().trim(),
            flag: flagClass ? flagClass.split(" ")[1].replace("mod-", "") : null,
          };
        })
        .get();

      return {
        id: href.split("/")[2] || null,
        url: href ? vlrgg_url + href : null,
        name: nameLink.text().trim(),
        logo: toAbsoluteUrl(
          $(card).find("img.event-team-players-mask-team").attr("src")
        ),
        seed: $(card).find(".event-team-note").text().replace(/\s+/g, " ").trim() || null,
        roster: players,
      };
    })
    .get()
    .filter((team) => team.name);

  // Prize distribution
  const prizes = [];
  $(".wf-ptable--standings .row")
    .slice(1)
    .each((i, row) => {
      const cells = $(row).find(".cell");
      const teamLink = cells.eq(2).find("a");
      const teamHref = teamLink.attr("href") || "";

      // The team cell nests the country inside the name div
      const nameClone = teamLink.find(".text-of").clone();
      nameClone.find(".ge-text-light").remove();

      prizes.push({
        place: cells.eq(0).text().replace(/\s+/g, " ").trim(),
        prize: cells.eq(1).text().replace(/\s+/g, " ").trim() || null,
        team: teamLink.length
          ? {
              id: teamHref.split("/")[2] || null,
              url: teamHref ? vlrgg_url + teamHref : null,
              name: nameClone.text().replace(/\s+/g, " ").trim(),
              country:
                teamLink.find(".ge-text-light").text().replace(/\s+/g, " ").trim() ||
                null,
              logo: toAbsoluteUrl(teamLink.find("img").attr("src")),
            }
          : null,
      });
    });

  // Groups (group stages): one standings table per group
  const groups = [];
  $(".event-group").each((i, groupEl) => {
    const table = $(groupEl).find("table.mod-group");
    const groupName = table.find("th").first().text().replace(/\s+/g, " ").trim();

    const standings = [];
    table.find("tbody tr").each((j, row) => {
      const teamLink = $(row).find("a.event-group-team");
      const href = teamLink.attr("href") || "";
      if (!href) return;

      const nameClone = teamLink.find(".event-group-team-name").clone();
      nameClone.find(".event-group-team-region").remove();

      // Stat cells: record "4–1", maps "9/5", rounds "165/135", diff "+30"
      const stats = $(row)
        .find("td.mod-stat")
        .map((k, td) => $(td).text().replace(/\s+/g, " ").trim())
        .get();
      const splitPair = (text) => {
        const parts = (text || "").split(/[^\d]+/).filter(Boolean).map(Number);
        return parts.length >= 2 ? { won: parts[0], lost: parts[1] } : null;
      };
      const record = splitPair(stats[0]);
      const diff = Number((stats[3] || "").replace(/[^\d+-]/g, ""));

      standings.push({
        position: standings.length + 1,
        team: {
          id: href.split("/")[2] || null,
          url: vlrgg_url + href,
          name: nameClone.text().replace(/\s+/g, " ").trim(),
          country:
            teamLink.find(".event-group-team-region").text().replace(/\s+/g, " ").trim() ||
            null,
          logo: toAbsoluteUrl(
            $(row).find("img.event-group-team-logo").attr("src")
          ),
        },
        record: record ? { wins: record.won, losses: record.lost } : null,
        maps: splitPair(stats[1]),
        rounds: splitPair(stats[2]),
        roundsDiff: Number.isFinite(diff) ? diff : null,
      });
    });

    if (groupName || standings.length > 0) {
      groups.push({ name: groupName || null, standings });
    }
  });

  // Bracket: one entry per column (round) across every bracket container
  const bracket = [];
  $(".event-brackets-container .bracket-col").each((i, col) => {
    const round = $(col).find(".bracket-col-label").text().trim();
    const matches = [];

    $(col)
      .find(".bracket-item")
      .each((j, item) => {
        const href =
          $(item).attr("href") ||
          $(item).closest("a").attr("href") ||
          $(item).find("a").attr("href") ||
          null;

        const matchTeams = $(item)
          .find(".bracket-item-team")
          .map((k, teamEl) => {
            const scoreText = $(teamEl)
              .find(".bracket-item-team-score")
              .text()
              .trim();
            const score = scoreText === "" ? null : Number(scoreText);
            return {
              id: $(teamEl).attr("data-team-id") || null,
              name: $(teamEl).find(".bracket-item-team-name span").text().trim(),
              logo: toAbsoluteUrl(
                $(teamEl).find(".bracket-item-team-name img").attr("src")
              ),
              score: Number.isNaN(score) ? null : score,
              winner: $(teamEl).hasClass("mod-winner"),
            };
          })
          .get();

        // Bracket timestamps are real unix epochs, unlike match pages
        const ts = Number($(item).find(".bracket-item-status").attr("data-utc-ts"));
        const timestamp = Number.isFinite(ts) && ts > 0 ? ts : null;

        matches.push({
          id: href ? href.split("/")[1] : null,
          url: href ? vlrgg_url + href : null,
          teams: matchTeams,
          timestamp,
          utcDate: timestamp ? new Date(timestamp * 1000).toUTCString() : null,
        });
      });

    if (round || matches.length > 0) {
      bracket.push({ round: round || null, matches });
    }
  });

  return {
    id,
    url: `${vlrgg_url}/event/${id}`,
    name,
    description,
    img,
    circuit,
    dates: meta.dates || null,
    prizepool: meta.prize || null,
    location: meta.location || null,
    stages,
    teams,
    prizes,
    groups,
    bracket,
  };
}

/**
 * Converts a display name into a URL-friendly slug (e.g. "Play-Ins" -> "play-ins").
 * @param {string} text - The text to slugify.
 * @returns {string}
 */
function slugify(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Extracts the event's series (stages) and their vlr.gg series ids from any
 * event subpage that links to the matches page filters.
 * @param {Object} $ - Cheerio instance of an event page.
 * @returns {Array<Object>} [{ id, name, slug }]
 */
function parseEventSeries($) {
  const series = [];
  const seen = new Set();
  $('a[href*="series_id="]').each((i, el) => {
    const href = $(el).attr("href") || "";
    const match = href.match(/series_id=(\d+)/);
    if (!match) return;
    const name = $(el).text().replace(/\s+/g, " ").trim();
    if (!name || seen.has(match[1])) return;
    seen.add(match[1]);
    series.push({ id: match[1], name, slug: slugify(name) });
  });
  return series;
}

/**
 * Resolves a stage slug (or numeric series id) against the event's series
 * list, throwing a 400 with the valid options when it doesn't exist.
 * @param {Array<Object>} series - Parsed series list.
 * @param {string} stage - Requested stage slug or series id.
 * @returns {Object} The matching series entry.
 */
function resolveStage(series, stage) {
  const found = series.find((s) => s.slug === stage || s.id === stage);
  if (!found) {
    const error = new Error("Stage not found");
    error.statusCode = 400;
    error.validStages = series.map((s) => s.slug);
    throw error;
  }
  return found;
}

/**
 * Wraps vlrGet mapping vlr.gg 404s to API 404s.
 */
async function fetchOr404(url, theme, resourceName) {
  try {
    const { data } = await vlrGet(url, theme);
    return data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      const error = new Error(`${resourceName} not found`);
      error.statusCode = 404;
      throw error;
    }
    throw err;
  }
}

/**
 * Parses match items from an event matches page.
 * @param {Object} $ - Cheerio instance.
 * @returns {Array<Object>} Matches with teams, status and schedule info.
 */
function parseEventMatchItems($) {
  const matches = [];
  $("a.match-item").each((i, el) => {
    const href = $(el).attr("href") || "";

    const teams = $(el)
      .find(".match-item-vs-team")
      .map((j, teamEl) => {
        const flagClass = $(teamEl).find(".flag").attr("class");
        const scoreText = $(teamEl)
          .find(".match-item-vs-team-score")
          .text()
          .trim();
        const score = Number(scoreText);
        return {
          name: $(teamEl).find(".text-of").text().replace(/\s+/g, " ").trim(),
          flag: flagClass ? flagClass.split(" ")[1].replace("mod-", "") : null,
          score: scoreText !== "" && Number.isFinite(score) ? score : null,
          winner: $(teamEl).hasClass("mod-winner"),
        };
      })
      .get();

    matches.push({
      id: href.split("/")[1] || null,
      url: href ? vlrgg_url + href : null,
      date:
        $(el).parent().prev().text().replace(/\s+/g, " ").replace("Today", "").trim() ||
        null,
      time: $(el).find(".match-item-time").text().trim() || null,
      status: $(el).find(".ml-status").text().trim().toLowerCase() || null,
      eta: $(el).find(".ml-eta").text().trim() || null,
      teams,
    });
  });
  return matches;
}

/**
 * Retrieves every match of an event, optionally filtered by stage and status.
 * @param {string} id - The event's unique ID.
 * @param {string} theme - The vlr.gg theme variant.
 * @param {Object} filters - { stage, status } where status is
 *   "all" | "upcoming" | "live" | "completed".
 * @returns {Object} Stages list and the matches.
 */
async function getEventMatches(id, theme, filters = {}) {
  const status = filters.status || "all";
  // vlr.gg only knows all/upcoming/completed; live matches live inside upcoming
  const group = status === "live" ? "upcoming" : status;

  const data = await fetchOr404(
    `${vlrgg_url}/event/matches/${id}/?series_id=all&group=${group}`,
    theme,
    "Event"
  );
  let $ = cheerio.load(data);

  const series = parseEventSeries($);

  let activeStage = "all";
  if (filters.stage) {
    const found = resolveStage(series, filters.stage);
    activeStage = found.slug;
    const stageData = await fetchOr404(
      `${vlrgg_url}/event/matches/${id}/?series_id=${found.id}&group=${group}`,
      theme,
      "Event"
    );
    $ = cheerio.load(stageData);
  }

  let matches = parseEventMatchItems($);
  if (status === "live") {
    matches = matches.filter((m) => m.status === "live");
  }

  return {
    stage: activeStage,
    status,
    stages: series.map((s) => ({ name: s.name, slug: s.slug })),
    size: matches.length,
    matches,
  };
}

/**
 * Retrieves the player statistics table of an event, optionally for a single
 * stage (resolved via the event's matches page).
 * @param {string} id - The event's unique ID.
 * @param {string} theme - The vlr.gg theme variant.
 * @param {string} [stage] - Optional stage slug.
 * @returns {Object} Stage info and per-player statistics.
 */
async function getEventStats(id, theme, stage) {
  let seriesId = "all";
  let activeStage = "all";
  let series = [];

  if (stage) {
    const matchesData = await fetchOr404(
      `${vlrgg_url}/event/matches/${id}/?series_id=all&group=all`,
      theme,
      "Event"
    );
    series = parseEventSeries(cheerio.load(matchesData));
    const found = resolveStage(series, stage);
    seriesId = found.id;
    activeStage = found.slug;
  }

  const data = await fetchOr404(
    `${vlrgg_url}/event/stats/${id}/?series_id=${seriesId}`,
    theme,
    "Event"
  );
  const $ = cheerio.load(data);

  const players = [];
  $("#st-table tbody tr").each((i, tr) => {
    const tds = $(tr).find("td");
    const link = tds.eq(0).find("a");
    const href = link.attr("href") || "";
    const flagClass = tds.eq(0).find(".flag").attr("class");

    const num = (idx) => {
      const text = tds.eq(idx).text().replace(/[%\s]+/g, "").trim();
      if (text === "" || text === "-") return null;
      const value = Number(text);
      return Number.isNaN(value) ? null : value;
    };

    const clutchesText = tds.eq(16).text().trim();
    const clutchesMatch = clutchesText.match(/^(\d+)\/(\d+)$/);

    players.push({
      player: {
        id: href.split("/")[2] || null,
        url: href ? vlrgg_url + href : null,
        name: tds.eq(0).find(".st-pl-name").text().trim(),
        teamTag: tds.eq(0).find(".st-pl-country").text().trim() || null,
        flag: flagClass ? flagClass.split(" ")[1].replace("mod-", "") : null,
      },
      agents: tds
        .eq(1)
        .find(".st-agent")
        .map((j, agentEl) => {
          const src = $(agentEl).find("img").attr("src") || "";
          return {
            name: (src.split("/").pop() || "").split(".")[0] || null,
            img: toAbsoluteUrl(src),
            playRate: Number($(agentEl).find(".st-agent-n").text().replace("%", "")) || null,
          };
        })
        .get(),
      maps: num(2),
      rounds: num(3),
      rating: num(4),
      acs: num(5),
      kd: num(6),
      kast: num(7),
      adr: num(8),
      kpr: num(9),
      apr: num(10),
      fkfd: num(11),
      fkpr: num(12),
      fdpr: num(13),
      hs: num(14),
      clutchSuccess: num(15),
      clutches: clutchesMatch
        ? { won: Number(clutchesMatch[1]), played: Number(clutchesMatch[2]) }
        : null,
      maxKillsInMap: num(17),
      kills: num(18),
      deaths: num(19),
      assists: num(20),
      firstKills: num(21),
      firstDeaths: num(22),
    });
  });

  return {
    stage: activeStage,
    size: players.length,
    players,
  };
}

/**
 * Retrieves the agent utilization table of an event: pick rates per map plus
 * attack/defense win rates. vlr.gg does not support stage filtering here.
 * @param {string} id - The event's unique ID.
 * @param {string} theme - The vlr.gg theme variant.
 * @returns {Object} Per-map agent pick rates.
 */
async function getEventAgents(id, theme) {
  const data = await fetchOr404(
    `${vlrgg_url}/event/agents/${id}`,
    theme,
    "Event"
  );
  const $ = cheerio.load(data);

  const table = $("table.mod-pr-global").first();

  // Header: Map | # | ATK WIN | DEF WIN | one column per agent (image)
  const agentColumns = table
    .find("th")
    .slice(4)
    .map((i, th) => {
      const src = $(th).find("img").attr("src") || "";
      return {
        name: (src.split("/").pop() || "").split(".")[0] || null,
        img: toAbsoluteUrl(src),
      };
    })
    .get();

  const maps = [];
  table
    .find("tr")
    .slice(1)
    .each((i, tr) => {
      const tds = $(tr).find("td");
      if (tds.length === 0) return;

      const percent = (text) => {
        const clean = (text || "").replace(/[%\s]+/g, "");
        if (clean === "") return null;
        const value = Number(clean);
        return Number.isNaN(value) ? null : value;
      };

      // The map cell prefixes the name with a one-letter pseudo icon
      const mapCell = tds.eq(0).clone();
      mapCell.find(".map-pseudo-icon").remove();

      maps.push({
        map: mapCell.text().replace(/\s+/g, " ").trim() || "All",
        played: percent(tds.eq(1).text()),
        atkWinRate: percent(tds.eq(2).text()),
        defWinRate: percent(tds.eq(3).text()),
        agents: agentColumns.map((agent, j) => ({
          ...agent,
          pickRate: percent(tds.eq(4 + j).text()),
        })),
      });
    });

  return {
    size: maps.length,
    maps,
  };
}

module.exports = {
  getEvents,
  getEventById,
  getEventMatches,
  getEventStats,
  getEventAgents,
};
