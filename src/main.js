import "./style.css";
import site from "./content/site.json";
import { mountHero } from "./hero.js";
import { mountCards } from "./cards.js";

const app = document.querySelector("#app");
app.className = "page";
document.title = site.title || "LEX";

if (site.hero?.poster) {
  const hero = document.createElement("header");
  hero.className = "hero";
  app.append(hero);
  mountHero(hero, site.hero);
}

const deck = document.createElement("section");
deck.className = "deck";
deck.setAttribute("aria-label", "Cards");
app.append(deck);
mountCards(deck, site.cards);

const tail = document.createElement("div");
tail.className = "tail";

if (site.comingSoon?.image) {
  const soon = document.createElement("section");
  soon.className = "soon";
  soon.append(picture(site.comingSoon));
  tail.append(soon);
}

if (site.smoke?.image) {
  const smoke = document.createElement("section");
  smoke.className = "smoke";
  smoke.setAttribute("aria-hidden", site.smoke.alt ? "false" : "true");
  tail.append(smoke);
  smoke.append(picture(site.smoke));
}

if (tail.childElementCount) app.append(tail);

function picture(spec) {
  const img = document.createElement("img");
  img.src = spec.image;
  img.alt = spec.alt ?? "";
  img.draggable = false;
  img.decoding = "async";
  if (spec.width) img.width = spec.width;
  if (spec.height) img.height = spec.height;
  return img;
}
