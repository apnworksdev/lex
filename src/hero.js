function videoType(src) {
  const file = src.split("?")[0].toLowerCase();
  if (file.endsWith(".webm")) return "video/webm";
  if (file.endsWith(".ogg") || file.endsWith(".ogv")) return "video/ogg";
  if (file.endsWith(".mp4") || file.endsWith(".m4v")) return "video/mp4";
  return "";
}

function filled(value) {
  return typeof value === "string" && value.trim() !== "";
}

function prefersStill() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  if (navigator.connection?.saveData) return true;
  return false;
}

function chooseHero(hero) {
  const mobile = window.matchMedia("(max-width: 720px)").matches;
  const video = mobile && filled(hero.videoMobile) ? hero.videoMobile.trim() : hero.video;
  const poster = mobile && filled(hero.posterMobile) ? hero.posterMobile.trim() : hero.poster;
  const mobilePoster = mobile && filled(hero.posterMobile);
  return {
    video: filled(video) ? video.trim() : "",
    poster,
    width: mobilePoster ? hero.widthMobile : hero.width,
    height: mobilePoster ? hero.heightMobile : hero.height,
  };
}

function applyFrame(img, choice) {
  if (img.getAttribute("src") !== choice.poster) img.src = choice.poster;
  if (choice.width) img.width = choice.width;
  else img.removeAttribute("width");
  if (choice.height) img.height = choice.height;
  else img.removeAttribute("height");
}

export function mountHero(section, hero) {
  section.dataset.state = "poster";

  const media = document.createElement("div");
  media.className = "hero__media";

  const poster = document.createElement("img");
  poster.className = "hero__poster";
  poster.alt = hero.alt || "";
  poster.draggable = false;
  poster.decoding = "async";
  let current = chooseHero(hero);
  applyFrame(poster, current);
  media.append(poster);
  section.append(media);

  const query = window.matchMedia("(max-width: 720px)");
  let syncVideo = () => {};

  query.addEventListener("change", () => {
    const next = chooseHero(hero);
    const videoChanged = next.video !== current.video;
    const posterChanged = next.poster !== current.poster;
    current = next;
    if (posterChanged) applyFrame(poster, current);
    if (videoChanged) syncVideo();
  });

  if (prefersStill() || !current.video) return;

  const video = document.createElement("video");
  video.className = "hero__video";
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.autoplay = true;
  video.playsInline = true;
  video.preload = "auto";
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.setAttribute("aria-hidden", "true");

  const source = document.createElement("source");
  video.append(source);
  media.append(video);

  const reveal = () => {
    if (video.paused || video.currentTime < 0.05) return;
    media.classList.add("is-playing");
    section.dataset.state = "playing";
  };

  const conceal = () => {
    media.classList.remove("is-playing");
    section.dataset.state = "poster";
  };

  syncVideo = () => {
    if (!current.video) {
      conceal();
      video.removeAttribute("src");
      source.removeAttribute("src");
      video.load();
      return;
    }
    source.src = current.video;
    const type = videoType(current.video);
    if (type) source.type = type;
    else source.removeAttribute("type");
    video.poster = current.poster;
    conceal();
    video.load();
    video.play().catch(conceal);
  };

  video.addEventListener("timeupdate", reveal);
  video.addEventListener("error", conceal);
  video.addEventListener("pause", () => {
    window.setTimeout(() => {
      if (video.paused) conceal();
    }, 320);
  });

  syncVideo();
}
