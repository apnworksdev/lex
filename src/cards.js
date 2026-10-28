function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function mod(value, count) {
  return ((value % count) + count) % count;
}

function wrapOffset(index, position, count) {
  let offset = index - position;
  offset = mod(offset, count);
  if (offset > count / 2) offset -= count;
  return offset;
}

export function mountCards(section, items) {
  const cards = Array.isArray(items) ? items.filter((item) => item?.image) : [];
  if (!cards.length) return;

  const marked = cards.findIndex((card) => card.active);
  let index = marked >= 0 ? marked : 0;
  let target = index;
  let dragging = false;
  let shown = -1;
  let running = false;
  let wheelTimer = 0;
  let pointer = null;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const count = cards.length;

  const stage = document.createElement("div");
  stage.className = count > 1 ? "deck__stage" : "deck__stage is-static";
  stage.tabIndex = 0;
  stage.setAttribute("role", "group");
  stage.setAttribute("aria-roledescription", "carousel");
  stage.setAttribute("aria-label", "Cards. Drag sideways, or use the arrow keys.");

  const ring = document.createElement("div");
  ring.className = "deck__ring";
  stage.append(ring);

  const models = cards.map((card, cardIndex) => {
    const el = document.createElement("article");
    el.className = "deck__card";
    el.dataset.index = String(cardIndex);

    const img = document.createElement("img");
    img.className = "deck__face";
    img.src = card.image;
    img.alt = card.alt || card.title || "";
    img.draggable = false;
    img.decoding = "async";

    const back = document.createElement("div");
    back.className = "deck__back";
    back.setAttribute("aria-hidden", "true");
    const backImg = document.createElement("img");
    backImg.src = card.image;
    backImg.alt = "";
    backImg.draggable = false;
    back.append(backImg);

    el.append(img, back);
    ring.append(el);
    return { ...card, el, img, back };
  });

  const caption = document.createElement("div");
  caption.className = "deck__caption";
  caption.setAttribute("aria-live", "polite");

  const title = document.createElement("p");
  title.className = "deck__title";
  const line = document.createElement("p");
  line.className = "deck__line";
  caption.append(title, line);

  section.append(stage, caption);

  function cardWidth() {
    const card = stage.querySelector(".deck__card");
    return card ? card.offsetWidth : 180;
  }

  function isMobile() {
    return window.matchMedia("(max-width: 720px)").matches;
  }

  function stepSize() {
    if (isMobile()) return Math.max(90, stage.clientWidth * 0.46);
    return Math.max(160, stage.clientWidth * 0.24);
  }

  function desktopPose(offset) {
    const sign = Math.sign(offset) || 0;
    const abs = Math.abs(offset);
    const stageW = stage.clientWidth;
    const width = cardWidth();
    const keys = [
      { x: 0, ry: 0, scale: 1, z: 0, opacity: 1 },
      { x: stageW * 0.36, ry: 50, scale: 0.5, z: -width * 0.12, opacity: 0.72 },
      { x: stageW * 0.24, ry: 180, scale: 0.2, z: -width * 0.45, opacity: 0.4 },
      { x: 0, ry: 180, scale: 0.1, z: -width * 1, opacity: 0 },
    ];
    const span = keys.length - 1;
    const clamped = Math.min(abs, span);
    const i = Math.min(Math.floor(clamped), span - 1);
    const t = clamped - i;
    const from = keys[i];
    const to = keys[i + 1];
    const mix = (start, end) => start + (end - start) * t;
    return {
      x: sign * mix(from.x, to.x),
      ry: sign * mix(from.ry, to.ry),
      scale: mix(from.scale, to.scale),
      z: mix(from.z, to.z),
      opacity: mix(from.opacity, to.opacity),
    };
  }

  function render() {
    const width = cardWidth();
    const mobile = isMobile();
    const active = mod(Math.round(index), count);
    ring.style.transform = "none";

    models.forEach((card, cardIndex) => {
      const offset = wrapOffset(cardIndex, index, count);

      card.el.toggleAttribute("aria-hidden", cardIndex !== active);

      if (mobile) {
        const sign = Math.sign(offset) || 0;
        const abs = Math.abs(offset);
        const edge = stage.clientWidth / 2;
        const along = Math.min(abs, 1);
        const behind = Math.min(Math.max(abs - 1, 0), 1);
        const x = sign * edge * 0.98 * along * (1 - behind);
        const ry = sign * (38 * along + 70 * behind);
        const scale = clamp(1 - along * 0.56 - behind * 0.14, 0.28, 1);
        const z = -width * (0.05 * along + 0.42 * behind);
        card.el.style.zIndex = String(100 - Math.round(abs * 10));
        card.el.style.transform = `translate3d(${x}px, 0, ${z}px) rotateY(${ry}deg) scale(${scale})`;
        const fade = abs <= 1 ? 1 : abs < 1.65 ? 1 - (abs - 1) / 0.65 : 0;
        card.img.style.opacity = String(fade);
        card.back.style.opacity = "0";
        card.el.style.pointerEvents = fade < 0.05 ? "none" : "auto";
        card.img.style.filter = `brightness(${0.84 + (abs < 0.2 ? 0.16 : 0)})`;
        return;
      }

      const pose = desktopPose(offset);
      const abs = Math.abs(offset);
      card.el.style.zIndex = String(80 - Math.round(abs * 10));
      card.el.style.transform = `translate3d(${pose.x}px, 0, ${pose.z}px) rotateY(${pose.ry}deg) scale(${pose.scale})`;
      const fade = pose.opacity;
      card.img.style.opacity = String(fade);
      card.back.style.opacity = String(fade);
      card.el.style.pointerEvents = fade < 0.05 ? "none" : "auto";
      card.img.style.filter = "brightness(1)";
    });

    if (active === shown) return;
    shown = active;
    const card = models[active];
    title.hidden = !card.title;
    line.hidden = !card.caption;
    title.textContent = card.title || "";
    line.textContent = card.caption || "";
  }

  function frame() {
    if (!dragging) {
      if (reduceMotion) {
        index = target;
      } else {
        const delta = target - index;
        if (Math.abs(delta) < 0.001) index = target;
        else index += delta * 0.18;
      }
    }

    render();

    const settled = !dragging && index === target;
    if (settled) {
      running = false;
      return;
    }
    requestAnimationFrame(frame);
  }

  function ensure() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  function nearestAbsolute(cardIndex) {
    const base = Math.round(index);
    const current = mod(base, count);
    let delta = cardIndex - current;
    if (delta > count / 2) delta -= count;
    if (delta < -count / 2) delta += count;
    return base + delta;
  }

  function flickCards(samples) {
    if (samples.length < 2) return 0;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = last.t - first.t;
    if (dt < 16) return 0;
    const velocity = (last.x - first.x) / dt;
    return clamp((-velocity * 260) / stepSize(), -1.35, 1.35);
  }

  function onPointerDown(event) {
    if (count < 2 || (event.button !== undefined && event.button !== 0)) return;
    pointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      lastX: event.clientX,
      moved: 0,
      axis: null,
      samples: [{ x: event.clientX, t: performance.now() }],
      card: event.target.closest(".deck__card"),
    };
  }

  function onPointerMove(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const totalX = event.clientX - pointer.x;
    const totalY = event.clientY - pointer.y;
    pointer.moved = Math.max(pointer.moved, Math.hypot(totalX, totalY));

    if (!pointer.axis) {
      if (pointer.moved < 8) return;
      pointer.axis = Math.abs(totalX) > Math.abs(totalY) ? "x" : "y";
      if (pointer.axis === "y") return;
      dragging = true;
      stage.classList.add("is-dragging");
      stage.setPointerCapture?.(event.pointerId);
      ensure();
    }

    if (pointer.axis !== "x") return;
    event.preventDefault();
    index -= (event.clientX - pointer.lastX) / stepSize();
    pointer.lastX = event.clientX;
    const now = performance.now();
    pointer.samples.push({ x: event.clientX, t: now });
    pointer.samples = pointer.samples.filter((sample) => now - sample.t < 90);
  }

  function onPointerUp(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const info = pointer;
    pointer = null;
    stage.classList.remove("is-dragging");

    if (info.axis === "x") {
      target = Math.round(index + flickCards(info.samples));
      dragging = false;
      ensure();
      return;
    }

    dragging = false;
    if (info.moved < 8 && info.card) {
      target = nearestAbsolute(Number(info.card.dataset.index));
      ensure();
    }
  }

  stage.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  stage.addEventListener("keydown", (event) => {
    if (count < 2) return;
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    target = Math.round(index) + direction;
    dragging = false;
    ensure();
  });

  stage.addEventListener(
    "wheel",
    (event) => {
      if (count < 2 || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      dragging = true;
      index += event.deltaX / stepSize();
      ensure();
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => {
        dragging = false;
        target = Math.round(index);
        ensure();
      }, 140);
    },
    { passive: false },
  );

  window.addEventListener("resize", () => {
    render();
  });

  render();
}
