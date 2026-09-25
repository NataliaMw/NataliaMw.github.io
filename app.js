const HER_RECORDING = null;
const MIN_KEYS = 40;
const TIME_SCALE = 1 / 150;
const SENTENCE = "I build systems that decide things, and I test them before they do.";

function sampleRecording() {
  const random = seededRandom(3517);
  const events = [];
  let clock = 0;
  for (const key of SENTENCE) {
    const duration = 72 + random() * 58;
    const gap = key === " " ? 150 + random() * 140 : 55 + random() * 105;
    events.push({ key, timestamp: clock + duration, duration });
    clock += duration * 0.55 + gap;
  }
  return events;
}

const herIsRecorded = Array.isArray(HER_RECORDING) && HER_RECORDING.length >= MIN_KEYS;
const herEvents = herIsRecorded
  ? HER_RECORDING.map(([key, timestamp, duration]) => ({ key, timestamp, duration }))
  : sampleRecording();
const herProfile = analyzeKeystrokes(herEvents);
const herConfig = generateVisualConfig(herProfile);

function applyPalette() {
  const hues = herConfig.strands.map((strand) => Math.round(strand.hue));
  while (hues.length < 4) hues.push((hues[0] + 90 * hues.length) % 360);
  const root = document.documentElement.style;
  hues.slice(0, 4).forEach((hue, i) => root.setProperty(`--h${i + 1}`, hue));
  const swatches = document.getElementById("swatches");
  for (const strand of herConfig.strands) {
    const swatch = document.createElement("i");
    swatch.style.background = `hsl(${strand.hue} ${strand.saturation}% ${strand.lightness}%)`;
    swatches.appendChild(swatch);
  }
}
applyPalette();

const $ = (id) => document.getElementById(id);
const herCanvas = $("her-canvas");
const youCanvas = $("you-canvas");
const tileCanvas = $("tile-canvas");
const stage = $("stage");
const reading = $("reading");
const announce = $("announce");
const input = $("type-input");
const meter = $("meter");

$("sentence").textContent = SENTENCE;
if (!herIsRecorded) $("her-label").textContent = "Sample rhythm";
herCanvas.setAttribute("aria-label", `A generative helix drawn from ${herIsRecorded ? "Natalia's" : "a sample"} typing rhythm: ${herConfig.strands.length} strands, ${herConfig.symmetry}-fold turn`);

let youProfile = null;
let youConfig = null;
let keyEvents = [];
const pressed = new Map();

function describeHer() {
  const who = herIsRecorded ? "My rhythm" : "Sample rhythm";
  reading.innerHTML = `${who}: <em>${Math.round(herProfile.wordsPerMinute)} wpm</em>, keys held <em>${Math.round(herProfile.averageDwellTime)} ms</em>, ${herConfig.strands.length} strands.`;
}

function spreadOf(profile) {
  return Math.sqrt(Math.max(profile.flightTimeVariance, 1));
}

function describeComparison() {
  const holdDelta = Math.round(youProfile.averageDwellTime - herProfile.averageDwellTime);
  const hold = holdDelta === 0
    ? "You hold keys exactly as long as"
    : `You hold keys <em>${Math.abs(holdDelta)} ms ${holdDelta > 0 ? "longer" : "shorter"}</em> than`;
  const ratio = spreadOf(youProfile) / spreadOf(herProfile);
  const rhythm = ratio >= 1 ? `<em>${ratio.toFixed(1)}× more variable</em>` : `<em>${(1 / ratio).toFixed(1)}× steadier</em>`;
  const subject = herIsRecorded ? "I do" : "the sample";
  reading.innerHTML = `${hold} ${subject}. Your rhythm is ${rhythm}. <em>${Math.round(youProfile.wordsPerMinute)} wpm</em> vs ${Math.round(herProfile.wordsPerMinute)}.`;
}

function timingLooksReal(events) {
  const usable = events.filter((e) => e.duration >= 8 && e.duration < 1000).length;
  return usable / events.length >= 0.6;
}

function refreshVisitor() {
  meter.textContent = keyEvents.length >= MIN_KEYS ? `${keyEvents.length} keys` : `${keyEvents.length} / ${MIN_KEYS}`;
  if (keyEvents.length < MIN_KEYS) return;
  if (!timingLooksReal(keyEvents)) {
    $("quality-note").hidden = false;
    return;
  }
  const firstSplit = !youProfile;
  youProfile = analyzeKeystrokes(keyEvents);
  youConfig = generateVisualConfig(youProfile);
  $("you-panel").hidden = false;
  stage.classList.add("split");
  describeComparison();
  youCanvas.setAttribute("aria-label", `A generative helix drawn from your typing rhythm: ${youConfig.strands.length} strands, ${youConfig.symmetry}-fold turn`);
  if (firstSplit) announce.textContent = reading.textContent;
  paint();
  if (recording) $("record-out").value = `const HER_RECORDING = ${JSON.stringify(keyEvents.map((e) => [e.key, Math.round(e.timestamp), Math.round(e.duration)]))};`;
}

function keyId(event) {
  return event.code || event.key;
}

input.addEventListener("keydown", (event) => {
  if (event.repeat || event.isComposing || event.key === "Unidentified" || event.key === "Process") return;
  if (!pressed.has(keyId(event))) pressed.set(keyId(event), { key: event.key, down: performance.now() });
});

input.addEventListener("keyup", (event) => {
  const start = pressed.get(keyId(event));
  if (!start) return;
  pressed.delete(keyId(event));
  const now = performance.now();
  keyEvents.push({ key: start.key, timestamp: now, duration: now - start.down });
  refreshVisitor();
});

$("reset").addEventListener("click", () => {
  keyEvents = [];
  pressed.clear();
  youProfile = null;
  youConfig = null;
  input.value = "";
  $("quality-note").hidden = true;
  $("you-panel").hidden = true;
  announce.textContent = "";
  stage.classList.remove("split");
  meter.textContent = `0 / ${MIN_KEYS}`;
  describeHer();
  paint();
  input.focus();
});

if (!window.matchMedia("(any-pointer: fine)").matches) {
  $("typer").hidden = true;
  $("touch-note").hidden = false;
}

const recording = location.hash === "#record";
if (recording) $("record").hidden = false;

$("record-copy").addEventListener("click", async (event) => {
  try {
    await navigator.clipboard.writeText($("record-out").value);
    event.currentTarget.textContent = "Copied";
  } catch {
    $("record-out").select();
  }
});

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let still = reducedMotion;
let visible = true;
let clock = 30000;
let lastNow = null;

function paint() {
  renderToCanvas(herCanvas, herConfig, herProfile, clock * TIME_SCALE);
  if (youConfig) renderToCanvas(youCanvas, youConfig, youProfile, clock * TIME_SCALE);
}

function loop(now) {
  if (still || !visible || document.hidden) {
    lastNow = null;
    return;
  }
  if (lastNow === null) lastNow = now;
  const delta = now - lastNow;
  if (delta >= 33) {
    clock += delta;
    lastNow = now;
    paint();
  }
  requestAnimationFrame(loop);
}

function resume() {
  if (!still && visible && !document.hidden) requestAnimationFrame(loop);
}

const motionToggle = $("motion-toggle");
function setStill(next) {
  still = next;
  document.documentElement.classList.toggle("still", still);
  motionToggle.setAttribute("aria-pressed", String(still));
  motionToggle.textContent = still ? "Play motion" : "Pause motion";
  resume();
}
motionToggle.addEventListener("click", () => setStill(!still));

new IntersectionObserver((entries) => {
  visible = entries[0].isIntersecting;
  resume();
}).observe(stage);
document.addEventListener("visibilitychange", resume);

describeHer();
paint();
renderToCanvas(tileCanvas, herConfig, herProfile, clock * TIME_SCALE);
setStill(still);

const flowDetail = $("flow-detail");
const nodes = [...document.querySelectorAll(".node")];
function selectNode(node) {
  for (const other of nodes) other.setAttribute("aria-pressed", String(other === node));
  flowDetail.textContent = node.dataset.detail;
}
for (const node of nodes) node.addEventListener("click", () => selectNode(node));
selectNode(nodes[1]);

const START = 2019;
const MONTHS = 8 * 12;
const NOW = { y: 2026, m: 9 };
const ROLES = [
  { name: "Tech Lead, Jelou AI", note: "Apr 2023 – now", from: [2023, 4], to: null, tone: "t1", tech: "Python TypeScript FastAPI NestJS LangGraph Pinecone PyTorch OpenAI Claude" },
  { name: "Lab Technician, ESPOL", note: "May 2023 – now", from: [2023, 5], to: null, tone: "t2", tech: "Python Docker" },
  { name: "Security Intern, Telconet", note: "Feb – Aug 2022", from: [2022, 2], to: [2022, 8], tone: "t4", tech: "Angular" },
  { name: "BSc Computer Science, ESPOL", note: "2019 – 2023", from: [2019, 1], to: [2023, 12], tone: "t3", tech: "Python Java C" },
  { name: "Hackathon builds", note: "2026", marks: [[2026, 7]], tone: "t1", tech: "Node.js OpenAI TypeScript" },
];

function monthIndex([year, month]) {
  return (year - START) * 12 + (month - 1);
}

function buildTimeline() {
  const box = $("timeline");
  const axis = document.createElement("div");
  axis.className = "tl-axis";
  axis.setAttribute("aria-hidden", "true");
  for (let year = START; year < START + 8; year++) axis.insertAdjacentHTML("beforeend", `<span>${year}</span>`);
  box.appendChild(axis);
  for (const role of ROLES) {
    const row = document.createElement("div");
    row.className = "tl-row";
    row.setAttribute("role", "listitem");
    row.innerHTML = `<div class="tl-name">${role.name}<small>${role.note}</small></div><div class="tl-track"></div>`;
    const track = row.querySelector(".tl-track");
    if (role.marks) {
      for (const mark of role.marks) {
        const tick = document.createElement("span");
        tick.className = `tl-mark ${role.tone}`;
        tick.dataset.tech = role.tech;
        tick.style.left = `${(monthIndex(mark) / MONTHS) * 100}%`;
        track.appendChild(tick);
      }
    } else {
      const bar = document.createElement("span");
      const end = role.to ? monthIndex(role.to) + 1 : monthIndex([NOW.y, NOW.m]) + 1;
      bar.className = `tl-bar ${role.tone}${role.to ? "" : " open"}`;
      bar.dataset.tech = role.tech;
      bar.style.left = `${(monthIndex(role.from) / MONTHS) * 100}%`;
      bar.style.width = `${((end - monthIndex(role.from)) / MONTHS) * 100}%`;
      track.appendChild(bar);
    }
    box.appendChild(row);
  }
}
buildTimeline();

const TECH = ["Python", "TypeScript", "LangGraph", "FastAPI", "NestJS", "Pinecone", "OpenAI", "Claude", "Next.js", "Node.js", "Three.js", "D3", "Canvas", "Angular"];
const chips = $("chips");
const status = $("filter-status");

function applyFilter(tech) {
  const tagged = [...document.querySelectorAll("[data-tech]")];
  let hits = 0;
  for (const element of tagged) {
    const hit = Boolean(tech) && element.dataset.tech.split(" ").includes(tech);
    element.classList.toggle("is-hit", hit);
    element.classList.toggle("is-dim", Boolean(tech) && !hit);
    if (hit) hits++;
  }
  status.textContent = tech ? `${tech} lights up ${hits} ${hits === 1 ? "place" : "places"} on this page` : "";
}

for (const tech of TECH) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "chip";
  chip.textContent = tech;
  chip.setAttribute("aria-pressed", "false");
  chip.addEventListener("click", () => {
    const active = chip.getAttribute("aria-pressed") === "true";
    for (const other of chips.children) other.setAttribute("aria-pressed", "false");
    chip.setAttribute("aria-pressed", String(!active));
    applyFilter(active ? null : tech);
  });
  chips.appendChild(chip);
}

const plainToggle = $("plain-toggle");
function setPlain(on) {
  document.documentElement.classList.toggle("plain", on);
  $("resume").hidden = !on;
  plainToggle.setAttribute("aria-pressed", String(on));
  plainToggle.textContent = on ? "Visual page" : "Plain résumé";
  if (on) applyFilter(null);
  try { localStorage.setItem("plain", on ? "1" : "0"); } catch {}
}
plainToggle.addEventListener("click", () => setPlain(!document.documentElement.classList.contains("plain")));
try { if (localStorage.getItem("plain") === "1") setPlain(true); } catch {}
