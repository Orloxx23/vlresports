const cheerio = require("cheerio");
const { vlrgg_url } = require("../constants");
const { enrichMatchesWithTeamLogos } = require("../utils/teamLogos");
const { applyEventLogosToMatches } = require("../utils/eventLogos");
const { vlrGet } = require("../utils/vlrSession");

/**
 * Retrieves and parses match data from the VLR website.
 * @returns {Object} An object containing match details including team names, countries, match status, event name, tournament name, match image URL, and match ETA.
 */
async function getMatches(theme) {
  // Send a request to the specified URL and parse the HTML response using cheerio
  const { data } = await vlrGet(`${vlrgg_url}/matches`, theme);
  const $ = cheerio.load(data);

  // Array to store match objects
  const matches = [];

  // Iterate over each match item on the page and extract relevant information
  $(".wf-module-item.match-item").each((index, element) => {
    // Extract team names and remove unnecessary whitespace and characters
    const team1AndTeam2 = $(element)
      .find(".match-item-vs-team-name")
      .text()
      .replace(/\t/g, "")
      .trim();
    const [team1, team2] = team1AndTeam2
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item !== "");

    // Extract country codes for both teams
    const countryElements = $(element).find(".match-item-vs-team .flag");
    const countryTeam1 = countryElements
      .eq(0)
      .attr("class")
      .split(" ")[1]
      .replace("mod-", "");
    const countryTeam2 = countryElements
      .eq(1)
      .attr("class")
      .split(" ")[1]
      .replace("mod-", "");

    const teamsScores = $(element)
      .find(".match-item-vs-team-score")
      .text()
      .replace(/\t/g, "")
      .trim();
    const [pointsTeam1, pointsTeam2] = teamsScores
      .split("\n")
      .map((item) => item.trim())
      .filter((item) => item !== "");

    // Extract match status, event name, tournament name, match image URL, match ETA, and match ID
    const status = $(element).find(".ml-status").text().trim();
    const event = $(element).find(".match-item-event-series").text().trim();
    const tournament = $(element)
      .find(".match-item-event")
      .text()
      .replace(/\t/g, "")
      .trim()
      .replace(event, "")
      .trim()
      .replace(/\n/g, "");
    const img = $(element)
      .find(".match-item-icon img")
      .attr("src")
      .includes("/img/vlr")
      ? vlrgg_url + $(element).find(".match-item-icon img").attr("src")
      : "https:" + $(element).find(".match-item-icon img").attr("src");
    const matchETA = $(element).find(".ml-eta").text().trim();
    const id = $(element).attr("href").split("/")[1];

    const parent = $(element.parent);
    const dateContaier = parent.prev();
    const date = dateContaier.text().trim().replace("Today", "");
    const time = $(element).find(".match-item-time").text().trim();
    const dateAndTime = date + " " + time;
    const newDate = new Date(dateAndTime);
    let timestamp = newDate.getTime();
    timestamp = Math.floor(timestamp / 1000);
    const utcString = newDate.toUTCString();

    // Create match object and push it to the matches array
    matches.push({
      id,
      teams: [
        {
          name: team1,
          country: countryTeam1,
          score: pointsTeam1 !== "–" ? pointsTeam1 : null,
        },
        {
          name: team2,
          country: countryTeam2,
          score: pointsTeam2 !== "–" ? pointsTeam2 : null,
        },
      ],
      status,
      event,
      tournament,
      img,
      in: matchETA,
      timestamp,
      utcDate: utcString,
      utc: newDate
    });
  });

  await Promise.all([
    enrichMatchesWithTeamLogos(matches, theme),
    applyEventLogosToMatches(matches, theme),
  ]);

  // Return an object containing the number of matches and the matches array
  return {
    size: matches.length,
    matches,
  };
}

function parseDateString(dateStr) {
  const months = {
    January: 0,
    February: 1,
    March: 2,
    April: 3,
    May: 4,
    June: 5,
    July: 6,
    August: 7,
    September: 8,
    October: 9,
    November: 10,
    December: 11,
  };

  const parts = dateStr.split(" ");
  const dayOfWeek = parts[0].replace(",", ""); // e.g., "Sat"
  const month = months[parts[1]]; // e.g., "July" -> 6
  const day = parseInt(parts[2].replace(",", ""), 10); // e.g., "20"
  const year = parseInt(parts[3], 10); // e.g., "2024"
  const timeParts = parts[4].split(":"); // e.g., "3:00"
  let hours = parseInt(timeParts[0], 10); // e.g., "3"
  const minutes = parseInt(timeParts[1], 10); // e.g., "00"
  const ampm = parts[5]; // e.g., "AM"

  if (ampm === "PM" && hours < 12) hours += 12;
  if (ampm === "AM" && hours === 12) hours = 0;

  return new Date(Date.UTC(year, month, day, hours, minutes));
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
 * Converts vlr.gg's data-utc-ts attribute (which is US Eastern time despite
 * its name) into a unix timestamp, handling DST via Intl.
 * @param {string} utcTs - Timestamp string like "2026-08-16 11:10:00".
 * @returns {number|null} Unix timestamp in seconds, or null if unparseable.
 */
function parseVlrTimestamp(utcTs) {
  if (!utcTs) return null;
  const m = utcTs.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi, s);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  let ts = naive;
  for (let i = 0; i < 2; i++) {
    const parts = {};
    dtf.formatToParts(ts).forEach((p) => (parts[p.type] = p.value));
    const asEastern = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      parts.hour === "24" ? 0 : Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    ts += naive - asEastern;
  }
  return Math.floor(ts / 1000);
}

/**
 * Parses the picks/bans note into a structured list.
 * e.g. "FF ban Breeze; JL pick Lotus; Haven remains"
 * @param {string} note - The raw picks/bans note.
 * @returns {Array<Object>} List of { team, action, map } entries.
 */
function parsePicksBans(note) {
  if (!note) return [];
  return note
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const remains = part.match(/^(.+?)\s+remains$/i);
      if (remains) {
        return { team: null, action: "remains", map: remains[1] };
      }
      const m = part.match(/^(.+?)\s+(ban|pick)\s+(.+)$/i);
      if (m) {
        return { team: m[1], action: m[2].toLowerCase(), map: m[3] };
      }
      return { team: null, action: "note", map: part };
    });
}

/**
 * Converts a stat string to a number, stripping "%" signs.
 * @param {string} value - Raw stat text.
 * @returns {number|null} Parsed number or null when empty/invalid.
 */
function toStatNumber(value) {
  if (value === undefined || value === null) return null;
  const clean = String(value).replace("%", "").trim();
  if (clean === "" || clean === "-" || clean === "/") return null;
  const num = Number(clean);
  return Number.isNaN(num) ? null : num;
}

/**
 * Extracts player stat rows from a .vm-stats-game container.
 * @param {Object} $ - Cheerio instance.
 * @param {Object} container - The .vm-stats-game element.
 * @returns {Array<Object>} Player stats for both teams.
 */
function parseGamePlayers($, container) {
  const players = [];

  $(container)
    .find(".ovw-row")
    .not(".mod-head")
    .each((i, row) => {
      const link = $(row).find(".ovw-cell.mod-player a");
      const href = link.attr("href") || "";
      const flagClass = $(row).find(".ovw-cell.mod-player .flag").attr("class");

      const stat = (col) =>
        toStatNumber(
          $(row).find(`[data-col="${col}"] .side.mod-both`).first().text()
        );

      players.push({
        id: href.split("/")[2] || null,
        url: href ? vlrgg_url + href : null,
        name: $(row).find(".ovw-player-name").text().trim(),
        teamTag: $(row).find(".ovw-player-tag").text().trim(),
        country: $(row).find(".ovw-cell.mod-player .flag").attr("title") || null,
        flag: flagClass ? flagClass.split(" ")[1].replace("mod-", "") : null,
        agents: $(row)
          .find(".ovw-agents img")
          .map((j, img) => ({
            name: $(img).attr("title") || $(img).attr("alt"),
            img: toAbsoluteUrl($(img).attr("src")),
          }))
          .get(),
        stats: {
          rating: stat("rating2"),
          acs: stat("acs"),
          kills: stat("kills"),
          deaths: stat("deaths"),
          assists: stat("assists"),
          kast: stat("kast"),
          adr: stat("adr"),
          hs: stat("hsp"),
          firstBloods: stat("fb"),
          firstDeaths: stat("fd"),
        },
      });
    });

  return players;
}

/**
 * Extracts the round-by-round timeline from a .vm-stats-game container.
 * Each winning square carries mod-win, the side it was won on (mod-t/mod-ct)
 * and an icon with the win method (elim, boom, defuse, time).
 * @param {Object} $ - Cheerio instance.
 * @param {Object} container - The .vm-stats-game element.
 * @returns {Array<Object>} Rounds with number, running score, winner and method.
 */
function parseGameRounds($, container) {
  const teamTags = $(container)
    .find(".vlr-rounds .team")
    .map((i, el) => $(el).text().trim())
    .get();

  const rounds = [];

  $(container)
    .find(".vlr-rounds .vlr-rounds-row-col")
    .each((i, col) => {
      const number = toStatNumber($(col).find(".rnd-num").text());
      if (number === null) return; // header/spacer column

      const squares = $(col).find(".rnd-sq");
      let winnerIndex = -1;
      squares.each((j, sq) => {
        if ($(sq).hasClass("mod-win")) winnerIndex = j;
      });
      if (winnerIndex === -1) return; // round not played

      const winnerSq = squares.eq(winnerIndex);
      const methodImg = winnerSq.find("img").attr("src") || "";
      const methodMatch = methodImg.match(/round\/([a-z]+)\./);

      rounds.push({
        number,
        score: $(col).attr("title") || null,
        winner: teamTags[winnerIndex] || null,
        side: winnerSq.hasClass("mod-t")
          ? "t"
          : winnerSq.hasClass("mod-ct")
          ? "ct"
          : null,
        method: methodMatch ? methodMatch[1] : null,
        methodIcon: toAbsoluteUrl(methodImg) || null,
      });
    });

  return rounds;
}

/**
 * Extracts a player's name and team tag from a matrix/adv-stats cell.
 * @param {Object} $ - Cheerio instance.
 * @param {Object} cell - The td element containing the player info.
 * @returns {Object} { name, teamTag }
 */
function parseMatrixPlayer($, cell) {
  const clone = $(cell).clone();
  clone.find(".team-tag").remove();
  clone.find("img").remove();
  return {
    name: clone.text().replace(/\s+/g, " ").trim(),
    teamTag: $(cell).find(".team-tag").text().trim(),
  };
}

/**
 * Parses a duel matrix table (kills, operator kills or first kills/deaths).
 * Each cell holds three values: player kills, opponent kills, and the diff.
 * @param {Object} $ - Cheerio instance.
 * @param {Object} table - The table.mod-matrix element.
 * @returns {Array<Object>} One entry per row player with their duel records.
 */
function parseDuelMatrix($, table) {
  const opponents = [];
  const rows = [];

  $(table)
    .find("tr")
    .each((i, tr) => {
      const tds = $(tr).find("td");
      if (i === 0) {
        tds.slice(1).each((j, td) => {
          opponents.push(parseMatrixPlayer($, td));
        });
        return;
      }

      const player = parseMatrixPlayer($, tds.eq(0));
      const records = [];
      tds.slice(1).each((j, td) => {
        const values = $(td)
          .find(".stats-sq")
          .map((k, sq) => toStatNumber($(sq).text()))
          .get();
        records.push({
          ...opponents[j],
          kills: values[0] !== undefined && values[0] !== null ? values[0] : 0,
          deaths: values[1] !== undefined && values[1] !== null ? values[1] : 0,
          diff: values[2] !== undefined && values[2] !== null ? values[2] : 0,
        });
      });
      rows.push({ ...player, records });
    });

  return rows;
}

/**
 * Parses the performance tab content of a .vm-stats-game container:
 * multikills, clutches, econ rating, plants/defuses and the duel matrices.
 * @param {Object} $ - Cheerio instance.
 * @param {Object} container - The .vm-stats-game element.
 * @returns {Object} { players, killMatrix, opKillMatrix, firstKillMatrix }
 */
function parsePerformanceGame($, container) {
  const players = [];

  $(container)
    .find("table.mod-adv-stats tr")
    .slice(1)
    .each((i, tr) => {
      const tds = $(tr).find("td");
      const { name, teamTag } = parseMatrixPlayer($, tds.eq(0));

      const count = (idx) => {
        const value = toStatNumber(tds.eq(idx).text());
        return value === null ? 0 : value;
      };

      players.push({
        name,
        teamTag,
        agents: tds
          .eq(1)
          .find("img")
          .map((j, img) => {
            const src = $(img).attr("src") || "";
            const agentName = (src.split("/").pop() || "").split(".")[0];
            return { name: agentName, img: toAbsoluteUrl(src) };
          })
          .get(),
        multikills: { "2k": count(2), "3k": count(3), "4k": count(4), "5k": count(5) },
        clutches: {
          "1v1": count(6),
          "1v2": count(7),
          "1v3": count(8),
          "1v4": count(9),
          "1v5": count(10),
        },
        econ: count(11),
        plants: count(12),
        defuses: count(13),
      });
    });

  return {
    players,
    killMatrix: parseDuelMatrix($, $(container).find("table.mod-matrix.mod-normal").first()),
    opKillMatrix: parseDuelMatrix($, $(container).find("table.mod-matrix.mod-op").first()),
    firstKillMatrix: parseDuelMatrix($, $(container).find("table.mod-matrix.mod-fkfd").first()),
  };
}

/**
 * Parses a "total (won)" economy stat like "6 (4)".
 * @param {string} text - The raw cell text.
 * @returns {Object} { total, won }
 */
function parseWonStat(text) {
  const m = (text || "").replace(/\s+/g, " ").trim().match(/^(\d+)\s*\((\d+)\)$/);
  if (!m) return { total: toStatNumber(text) || 0, won: null };
  return { total: Number(m[1]), won: Number(m[2]) };
}

/**
 * Converts a bank string like "5.5k" to a number (5500).
 * @param {string} text - The raw bank text.
 * @returns {number|null}
 */
function parseBank(text) {
  const m = (text || "").trim().match(/^([\d.]+)k$/i);
  if (!m) return toStatNumber(text);
  return Math.round(Number(m[1]) * 1000);
}

const BUY_TYPES = {
  "": "eco",
  $: "semi-eco",
  $$: "semi-buy",
  $$$: "full-buy",
};

/**
 * Parses the economy tab content of a .vm-stats-game container: per-team
 * buy-type summary and, for played maps, the round-by-round economy.
 * @param {Object} $ - Cheerio instance.
 * @param {Object} container - The .vm-stats-game element.
 * @returns {Object} { teams, rounds }
 */
function parseEconomyGame($, container) {
  const tables = $(container).find("table.mod-econ");

  const teams = [];
  $(tables.eq(0))
    .find("tr")
    .slice(1)
    .each((i, tr) => {
      const tds = $(tr).find("td");
      teams.push({
        name: tds.eq(0).text().replace(/\s+/g, " ").trim(),
        pistolWon: toStatNumber(tds.eq(1).text()) || 0,
        eco: parseWonStat(tds.eq(2).text()),
        semiEco: parseWonStat(tds.eq(3).text()),
        semiBuy: parseWonStat(tds.eq(4).text()),
        fullBuy: parseWonStat(tds.eq(5).text()),
      });
    });

  const rounds = [];
  if (tables.length > 1) {
    $(tables.eq(1))
      .find("td")
      .each((i, td) => {
        const number = toStatNumber($(td).find(".round-num").text());
        if (number === null) return; // spacer cell

        const banks = $(td)
          .find(".bank")
          .map((j, b) => parseBank($(b).text()))
          .get();
        const squares = $(td).find(".rnd-sq");

        rounds.push({
          number,
          teams: [0, 1].map((k) => {
            const sq = squares.eq(k);
            const symbol = sq.text().trim();
            return {
              bank: banks[k] !== undefined ? banks[k] : null,
              loadout: toStatNumber(sq.attr("title")),
              buy: BUY_TYPES[symbol] !== undefined ? BUY_TYPES[symbol] : null,
              winner: sq.hasClass("mod-win"),
            };
          }),
        });
      });
  }

  return { teams, rounds };
}

const MATCH_TABS = ["performance", "economy"];

/**
 * Retrieves the full details of a single match by its ID, including event
 * info, teams, score, streams, VODs, picks/bans, per-map results, and
 * per-player statistics. Optionally scrapes the performance and/or economy
 * tabs (one extra vlr.gg request each).
 * @param {string} id - The match's unique ID.
 * @param {string} theme - The vlr.gg theme variant.
 * @param {Array<string>} tabs - Extra tabs to include: "performance", "economy".
 * @returns {Object} The match details.
 */
async function getMatchById(id, theme, tabs = []) {
  const wantPerformance = tabs.includes("performance");
  const wantEconomy = tabs.includes("economy");

  let data, performanceData, economyData;
  try {
    [{ data }, performanceData, economyData] = await Promise.all([
      vlrGet(`${vlrgg_url}/${id}`, theme),
      wantPerformance
        ? vlrGet(`${vlrgg_url}/${id}/?game=all&tab=performance`, theme)
        : Promise.resolve(null),
      wantEconomy
        ? vlrGet(`${vlrgg_url}/${id}/?game=all&tab=economy`, theme)
        : Promise.resolve(null),
    ]);
  } catch (err) {
    if (err.response && err.response.status === 404) {
      const error = new Error("Match not found");
      error.statusCode = 404;
      throw error;
    }
    throw err;
  }
  const $ = cheerio.load(data);

  // Index the extra tabs' content by game id so it can be merged into maps
  const performanceByGame = {};
  if (performanceData) {
    const $p = cheerio.load(performanceData.data);
    $p(".vm-stats-game").each((i, el) => {
      const gameId = $p(el).attr("data-game-id");
      performanceByGame[gameId] = parsePerformanceGame($p, el);
    });
  }
  const economyByGame = {};
  if (economyData) {
    const $e = cheerio.load(economyData.data);
    $e(".vm-stats-game").each((i, el) => {
      const gameId = $e(el).attr("data-game-id");
      economyByGame[gameId] = parseEconomyGame($e, el);
    });
  }

  if ($(".match-header").length === 0) {
    const error = new Error("Match not found");
    error.statusCode = 404;
    throw error;
  }

  // Event info
  const eventLink = $("a.match-header-event");
  const eventHref = eventLink.attr("href") || "";
  const event = {
    id: eventHref.split("/")[2] || null,
    url: eventHref ? vlrgg_url + eventHref : null,
    name: eventLink.find("div > div").first().text().trim(),
    series: $(".match-header-event-series").text().replace(/\s+/g, " ").trim(),
    img: toAbsoluteUrl(eventLink.find("img").attr("src")),
  };

  // Date and time
  const dateElements = $(".match-header-date .moment-tz-convert");
  const date = dateElements.eq(0).text().trim() || null;
  const time = dateElements.eq(1).text().trim() || null;
  const timestamp = parseVlrTimestamp(dateElements.eq(0).attr("data-utc-ts"));
  const utcDate = timestamp ? new Date(timestamp * 1000).toUTCString() : null;

  // Status: "live", "upcoming" (with countdown) or vlr's own label ("final")
  let status;
  let eta = null;
  if ($(".match-header-vs-note.mod-live").length > 0) {
    status = "live";
  } else if ($(".match-header-vs-note.mod-upcoming").length > 0) {
    status = "upcoming";
    eta = $(".match-header-vs-note.mod-upcoming").text().trim();
  } else {
    status = $(".match-header-vs-note").first().text().trim().toLowerCase();
  }
  const format = $(".match-header-vs-note").last().text().trim();

  // Header score: [score1, colon, score2] spans (classes vary by state)
  const scoreSpans = $(".match-header-vs-score .sp-hide span");
  const score1 = scoreSpans.eq(0).text().trim();
  const score2 = scoreSpans.eq(2).text().trim();

  // Teams
  const teams = $(".match-header-link")
    .map((i, el) => {
      const href = $(el).attr("href") || "";
      return {
        id: href.split("/")[2] || null,
        url: href ? vlrgg_url + href : null,
        name: $(el).find(".wf-title-med").text().replace(/\s+/g, " ").trim(),
        img: toAbsoluteUrl($(el).find("img").attr("src")),
        score: toStatNumber(i === 0 ? score1 : score2),
      };
    })
    .get();

  // Streams and VODs
  const streams = $(".match-streams .match-streams-btn")
    .map((i, el) => {
      const link = $(el).attr("href") || $(el).find("a").attr("href") || null;
      return {
        name: $(el).text().replace(/\s+/g, " ").trim(),
        link,
      };
    })
    .get()
    .filter((stream) => stream.name || stream.link);

  const vods = $(".match-vods .wf-card a")
    .map((i, el) => ({
      name: $(el).text().replace(/\s+/g, " ").trim(),
      link: $(el).attr("href") || null,
    }))
    .get();

  // Picks and bans
  const note = $(".match-header-note").text().trim() || null;
  const picksBans = {
    note,
    list: parsePicksBans(note),
  };

  // Per-map details (skip the aggregated "all" container). The games nav
  // flags unplayed maps as mod-disabled and the in-progress map as mod-live;
  // an enabled, non-live map without a duration is a decider not yet started.
  const disabledGameIds = new Set(
    $(".vm-stats-gamesnav-item.mod-disabled")
      .map((i, el) => $(el).attr("data-game-id"))
      .get()
  );
  const liveGameIds = new Set(
    $(".vm-stats-gamesnav-item.mod-live")
      .map((i, el) => $(el).attr("data-game-id"))
      .get()
  );
  const maps = [];
  let overallPlayers = [];

  $(".vm-stats-game").each((i, el) => {
    const gameId = $(el).attr("data-game-id");

    if (gameId === "all") {
      overallPlayers = parseGamePlayers($, el);
      return;
    }

    const mapName = $(el)
      .find(".map div span")
      .first()
      .clone()
      .children()
      .remove()
      .end()
      .text()
      .trim();

    // .picked.mod-1 / .mod-2 marks which header team picked the map
    let pickedBy = null;
    if ($(el).find(".map .picked.mod-1").length > 0) {
      pickedBy = teams[0] ? teams[0].name : null;
    } else if ($(el).find(".map .picked.mod-2").length > 0) {
      pickedBy = teams[1] ? teams[1].name : null;
    }

    const duration = $(el).find(".map-duration").text().trim();
    const hasDuration = duration !== "" && duration !== "-";

    let mapStatus;
    if (liveGameIds.has(gameId)) {
      mapStatus = "live";
    } else if (mapName === "TBD" || disabledGameIds.has(gameId)) {
      mapStatus = "upcoming";
    } else if (hasDuration || status === "final") {
      mapStatus = "played";
    } else {
      mapStatus = "upcoming";
    }

    const mapTeams = $(el)
      .find(".vm-stats-game-header .team")
      .map((j, teamEl) => ({
        name: $(teamEl).find(".team-name").text().trim(),
        score:
          mapStatus === "upcoming"
            ? null
            : toStatNumber($(teamEl).find(".score").text()),
        roundsCt: toStatNumber($(teamEl).find(".mod-ct").first().text()),
        roundsT: toStatNumber($(teamEl).find(".mod-t").first().text()),
      }))
      .get();

    maps.push({
      id: gameId || null,
      name: mapName || null,
      status: mapStatus,
      pickedBy,
      duration: hasDuration ? duration : null,
      teams: mapTeams,
      rounds: parseGameRounds($, el),
      players: parseGamePlayers($, el),
      performance: wantPerformance
        ? performanceByGame[gameId] || null
        : undefined,
      economy: wantEconomy ? economyByGame[gameId] || null : undefined,
    });
  });

  return {
    id,
    url: `${vlrgg_url}/${id}`,
    event,
    status,
    in: eta,
    format,
    date,
    time,
    timestamp,
    utcDate,
    teams,
    streams,
    vods,
    picksBans,
    maps,
    players: overallPlayers,
    performance: wantPerformance ? performanceByGame["all"] || null : undefined,
    economy: wantEconomy ? economyByGame["all"] || null : undefined,
  };
}

module.exports = {
  getMatches,
  getMatchById,
  MATCH_TABS,
};
