const axios = require("axios");
const cheerio = require("cheerio");
const { vlrgg_url } = require("../constants");

/**
 * Retrieves and parses match data from the VLR website.
 * @returns {Object} An object containing match details including team names, countries, match status, event name, tournament name, match image URL, and match ETA.
 */
async function getMatches() {
  // Send a request to the specified URL and parse the HTML response using cheerio
  const { data } = await axios.get(`${vlrgg_url}/matches`);
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

module.exports = {
  getMatches,
};
