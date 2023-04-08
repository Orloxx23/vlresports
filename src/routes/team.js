const { Router } = require("express");
const router = Router();

const request = require("request-promise");
const cheerio = require("cheerio");

async function getTeam(id) {
  const $ = await request({
    uri: `https://www.vlr.gg/team/${id}`,
    transform: (body) => cheerio.load(body),
  });

  let roaster = [];

  let players = [];
  let staff = [];

  let events = [];

  $(".wf-card")
    .find(".team-roster-item")
    .map((i, el) => {
      roaster.push(el);
    });

  $(".team-summary-container-2")
    .find(".wf-card")
    .has(".team-event-item")
    .find("a")
    .map((i, el) => {
      const restults = [];
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
            restults.push(result);
          }
        });

      const event = {
        name: $(el).find(".text-of").text().trim(),
        results: restults,
        year: $(el).children("div").last().text().trim(),
      };
      events.push(event);
    });

  roaster.forEach((el) => {
    if ($(el).has(".wf-tag").text()) {
      const staffMember = {
        url: $(el).find("a").attr("href"),
        user: $(el).find(".team-roster-item-name-alias").text().trim(),
        name: $(el).find(".team-roster-item-name-real").text().trim(),
        tag: $(el).find(".wf-tag").text().trim(),
        img: $(el).find(".team-roster-item-img").find("img").attr("src"),
        country: $(el)
          .find(".team-roster-item-name-alias")
          .find("i")
          .attr("class")
          .split(" ")[1]
          .replace("mod-", ""),
      };
      staff.push(staffMember);
    } else {
      const player = {
        url: $(el).find("a").attr("href"),
        user: $(el).find(".team-roster-item-name-alias").text().trim(),
        name: $(el).find(".team-roster-item-name-real").text().trim(),
        img: $(el).find(".team-roster-item-img").find("img").attr("src"),
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

  const team = {
    players: players,
    staff: staff,
    events: events,
  };

  return team;
}

router.get("/:id", async (req, res) => {
    const { id } = req.params;
    const team = await getTeam(id);
    res.json(team);
});

module.exports = router;
