function videoType(src) {
  const file = src.split("?")[0].toLowerCase();
  if (file.endsWith(".webm")) return "video/webm";
  if (file.endsWith(".ogg") || file.endsWith(".ogv")) return "video/ogg";
  if (file.endsWith(".mp4") || file.endsWith(".m4v")) return "video/mp4";
  return "";
}

function canAutoplay(hero) {
  if (!hero?.video) return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (navigator.connection?.saveData) return false;
  return true;
}

export function mountHero(section, hero) {
  section.dataset.state = "poster";

  const media = document.createElement("div");
  media.className = "hero__media";

  const poster = document.createElement("img");
  poster.className = "hero__poster";
  poster.src = hero.poster;
  poster.alt = hero.alt || "";
  poster.draggable = false;
  poster.decoding = "async";
  if (hero.width) poster.width = hero.width;
  if (hero.height) poster.height = hero.height;
  media.append(poster);
  section.append(media);

  if (!canAutoplay(hero)) return;

  const video = document.createElement("video");
  video.className = "hero__video";
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.autoplay = true;
  video.playsInline = true;
  video.preload = "auto";
  video.poster = hero.poster;
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.setAttribute("aria-hidden", "true");

  const source = document.createElement("source");
  source.src = hero.video;
  const type = videoType(hero.video);
  if (type) source.type = type;
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

  video.addEventListener("timeupdate", reveal);
  video.addEventListener("error", conceal);
  video.addEventListener("pause", () => {
    window.setTimeout(() => {
      if (video.paused) conceal();
    }, 320);
  });

  video.play().catch(conceal);
}
