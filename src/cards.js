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
    img.src = card.image;
    img.alt = card.alt || card.title || "";
    img.draggable = false;
    img.decoding = "async";
    el.append(img);
    ring.append(el);
    return { ...card, el, img };
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

  function ringRadius() {
    const angle = (2.5 * Math.PI) / count;
    const reach = Math.max(cardWidth() * 0.95, stage.clientWidth * 0.18);
    return reach / Math.sin(angle);
  }

  function stepSize() {
    const step = (2 * Math.PI) / count;
    return Math.max(110, ringRadius() * step * 0.55);
  }

  function render() {
    const width = cardWidth();
    const radius = ringRadius();
    const step = 360 / count;
    const active = mod(Math.round(index), count);
    ring.style.transform = `translateZ(${-(radius - width * 0.22)}px)`;

    models.forEach((card, cardIndex) => {
      const offset = wrapOffset(cardIndex, index, count);
      const angle = offset * step;
      const facing = Math.cos((angle * Math.PI) / 180);

      card.el.toggleAttribute("aria-hidden", cardIndex !== active);
      card.el.style.zIndex = "";
      const scale = clamp(0.7 + facing * 0.3, 0.7, 1);
      card.el.style.transform = `rotateY(${angle}deg) translateZ(${radius}px) rotateY(${-angle * 0.22}deg) scale(${scale})`;

      const fromBack = count / 2 - Math.abs(offset);
      const frontFade = Math.max(0.6, clamp((facing + 0.08) / 0.42, 0, 1));
      const fade = fromBack <= 1 ? 0 : fromBack < 2 ? frontFade * (fromBack - 1) : frontFade;
      card.img.style.opacity = String(fade);
      card.el.style.pointerEvents = fade < 0.05 ? "none" : "auto";
      card.img.style.filter = `brightness(${0.78 + Math.max(facing, 0) * 0.22})`;
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
