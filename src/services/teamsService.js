const request = require("request-promise");
const cheerio = require("cheerio");
const { vlrgg_url } = require("../constants");

/**
 * Retrieves team information from the VLR website.
 * @param {string} id - Team ID.
 * @returns {Object} - Team information.
 */
async function getTeam(id) {
  const $ = await request({
    uri: `https://www.vlr.gg/team/${id}`,
    transform: (body) => cheerio.load(body),
  });

  const $matches = await request({
    uri: `https://www.vlr.gg/team/matches/${id}/?group=completed`,
    transform: (body) => cheerio.load(body),
  });

  let roster = [];
  let players = [];
  let staff = [];

  let events = [];

  let results = [];
  let upcoming = [];

  const info = {
    name: $(".team-header").find(".team-header-name h1").text().trim(),
    tag: $(".team-header").find(".team-header-name h2").text().trim(),
    logo:
      "https:" + $(".team-header").find(".team-header-logo img").attr("src"),
  };

  // Extract roster information
  $(".wf-card")
    .find(".team-roster-item")
    .map((i, el) => {
      roster.push(el);
    });

  // Extract events information
  $(".team-summary-container-2")
    .find(".wf-card")
    .has(".team-event-item")
    .find("a")
    .map((i, el) => {
      const results = [];
      $(el)
        .children("div")
        .first()
        .children("div")
        .map((i, el) => {
          const result = $(el)
            .not(".text-of")
            .find("span")
            .first()
            .text()
            .trim()
            .split("\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t\t")
            .join("")
            .replace("–", " -  ");

          if (result !== "") {
            results.push(result);
          }
        });

      const event = {
        name: $(el).find(".text-of").text().trim(),
        results: results,
        year: $(el).children("div").last().text().trim(),
      };
      events.push(event);
    });

  // Separate players and staff members in the roster
  roster.forEach((el) => {
    if ($(el).has(".wf-tag").text()) {
      // Staff member
      const staffMember = {
        url: vlrgg_url + $(el).find("a").attr("href"),
        user: $(el).find(".team-roster-item-name-alias").text().trim(),
        name: $(el).find(".team-roster-item-name-real").text().trim(),
        tag: $(el).find(".wf-tag").text().trim(),
        img: $(el)
          .find(".team-roster-item-img")
          .find("img")
          .attr("src")
          .includes("owcdn")
          ? "https:" +
            $(el).find(".team-roster-item-img").find("img").attr("src")
          : vlrgg_url +
            $(el).find(".team-roster-item-img").find("img").attr("src"),
        country: $(el)
          .find(".team-roster-item-name-alias")
          .find("i")
          .attr("class")
          .split(" ")[1]
          .replace("mod-", ""),
      };
      staff.push(staffMember);
    } else {
      // Player
      const player = {
        url: vlrgg_url + $(el).find("a").attr("href"),
        user: $(el).find(".team-roster-item-name-alias").text().trim(),
        name: $(el).find(".team-roster-item-name-real").text().trim(),
        img: $(el)
          .find(".team-roster-item-img")
          .find("img")
          .attr("src")
          .includes("owcdn")
          ? "https:" +
            $(el).find(".team-roster-item-img").find("img").attr("src")
          : vlrgg_url +
            $(el).find(".team-roster-item-img").find("img").attr("src"),
        country: $(el)
          .find(".team-roster-item-name-alias")
          .find("i")
          .attr("class")
          .split(" ")[1]
          .replace("mod-", ""),
      };
      players.push(player);
    }
  });

  // Extract upcoming matches information
  $(".mod-tbd")
    .parent()
    .map((i, el) => {
      const event_logo =
        "https:" + $(el).find("div").first().find("img").attr("src");
      const event_name = $(el)
        .find(".m-item-event")
        .find(".text-of")
        .text()
        .trim();
      const team1 = {
        name: $(el)
          .find(".m-item-team")
          .first()
          .find(".m-item-team-name")
          .text()
          .trim(),
        tag: $(el)
          .find(".m-item-team")
          .first()
          .find(".m-item-team-tag")
          .text()
          .trim(),
        logo: "https:" + $(el).find(".m-item-logo img").first().attr("src"),
      };
      const team2 = {
        name: $(el)
          .find(".m-item-team")
          .last()
          .find(".m-item-team-name")
          .text()
          .trim(),
        tag: $(el)
          .find(".m-item-team")
          .last()
          .find(".m-item-team-tag")
          .text()
          .trim(),
        logo: "https:" + $(el).find(".m-item-logo img").last().attr("src"),
      };
      const match = {
        event: {
          name: event_name,
          logo: event_logo,
        },
        teams: [team1, team2],
      };
      upcoming.push(match);
    });

  // Extract past matches information
  $matches(".m-item-result")
    .not(".m-item-games-result")
    .parent()
    .map((i, el) => {
      const event_logo =
        "https:" + $(el).find(".m-item-thumb").find("img").attr("src");
      const event_name = $(el)
        .find(".m-item-event")
        .find(".text-of")
        .text()
        .trim();
      const team1 = {
        name: $(el)
          .find(".m-item-team")
          .first()
          .find(".m-item-team-name")
          .text()
          .trim(),
        tag: $(el)
          .find(".m-item-team")
          .first()
          .find(".m-item-team-tag")
          .text()
          .trim(),
        logo: "https:"+$(el).find(".m-item-logo img").first().attr("src"),
        points: $(el).find(".m-item-result").find("span").first().text().trim()
      };
      const team2 = {
        name: $(el)
          .find(".m-item-team")
          .last()
          .find(".m-item-team-name")
          .text()
          .trim(),
        tag: $(el)
          .find(".m-item-team")
          .last()
          .find(".m-item-team-tag")
          .text()
          .trim(),
        logo: "https:"+$(el).find(".m-item-logo img").last().attr("src"),
        points: $(el).find(".m-item-result").find("span").last().text().trim()
      };
      const match = {
        event: {
          name: event_name,
          logo: event_logo,
        },
        teams: [team1, team2],
      };
      results.push(match);
    });

  const team = {
    info,
    players,
    staff,
    events,
    results,
    upcoming,
  };

  return team;
}

module.exports = {
  getTeam,
};
