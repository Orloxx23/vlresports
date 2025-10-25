const axios = require("axios");
const cheerio = require("cheerio");
const { vlrgg_url } = require("../constants");

async function getResults(page) {
  const { data } = await axios.get(`${vlrgg_url}/matches/results?page=${page}`);
  const $ = cheerio.load(data);

  const results = [];

  $(".wf-module-item.match-item").each((index, element) => {
    const match = {};
    match.id = $(element).attr("href").split("/")[1];
    match.teams = [];
    $(element)
      .find(".match-item-vs-team")
      .each((index, teamElement) => {
        const team = {};
        team.name = $(teamElement).find(".text-of").text().trim();
        team.score = $(teamElement)
          .find(".match-item-vs-team-score.js-spoiler")
          .text()
          .trim();
        team.country = $(teamElement)
          .find(".flag")
          .attr("class")
          .split(" ")[1]
          .replace("mod-", "");
        match.teams.push(team);
      });
    const winningScore = Math.max(...match.teams.map((team) => team.score));
    match.teams.forEach((team) => {
      team.won = team.score == winningScore;
    });
    match.status = $(element).find(".ml-status").text().trim();
    match.ago = $(element).find(".ml-eta").text().trim();
    match.event = $(element)
      .find(".match-item-event-series.text-of")
      .text()
      .trim();
    match.tournament = $(element)
      .find(".match-item-event.text-of")
      .contents()
      .last()
      .text()
      .trim();
    match.img = $(element)
      .find(".match-item-icon img")
      .attr("src")
      .includes("/img/vlr")
      ? vlrgg_url + $(element).find(".match-item-icon img").attr("src")
      : "https:" + $(element).find(".match-item-icon img").attr("src");

    results.push(match);
  });

  return {
    size: results.length,
    results,
  };
}

module.exports = {
  getResults,
};
