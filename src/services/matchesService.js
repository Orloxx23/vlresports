const request = require("request-promise");
const cheerio = require("cheerio");
const { vlrgg_url } = require("../constants");

/**
 * Retrieves and parses match data from the VLR website.
 * @returns {Object} An object containing match details including team names, countries, match status, event name, tournament name, match image URL, and match ETA.
 */
async function getMatches() {
  // Send a request to the specified URL and parse the HTML response using cheerio
  const $ = await request({
    uri: `${vlrgg_url}/matches`,
    transform: (body) => cheerio.load(body),
  });

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

    // Create match object and push it to the matches array
    matches.push({
      id,
      teams: [
        {
          name: team1,
          country: countryTeam1,
        },
        {
          name: team2,
          country: countryTeam2,
        },
      ],
      status,
      event,
      tournament,
      img,
      in: matchETA,
    });
  });

  // Return an object containing the number of matches and the matches array
  return {
    size: matches.length,
    matches,
  };
}

module.exports = {
  getMatches,
};
