function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function variance(values) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return mean(values.map((v) => (v - avg) ** 2));
}

function extractDigraphs(events) {
  const digraphs = [];
  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const curr = events[i];
    const flightTime = curr.timestamp - (prev.timestamp + prev.duration);
    if (prev.key.length === 1 && curr.key.length === 1 && flightTime >= 0 && flightTime < 2000) {
      digraphs.push({ pair: `${prev.key}${curr.key}`.toLowerCase(), flightTime });
    }
  }
  return digraphs;
}

function computeRhythmSignature(events) {
  const intervals = [];
  for (let i = 1; i < events.length; i++) {
    const interval = events[i].timestamp - events[i - 1].timestamp;
    if (interval > 0 && interval < 3000) intervals.push(interval);
  }
  if (intervals.length < 8) return intervals;
  const chunkSize = Math.floor(intervals.length / 8);
  const signature = [];
  for (let i = 0; i < 8; i++) {
    const chunk = intervals.slice(i * chunkSize, (i + 1) * chunkSize);
    signature.push(mean(chunk));
  }
  return signature;
}

function computeBurstPattern(events) {
  const bursts = [];
  let currentBurst = 1;
  for (let i = 1; i < events.length; i++) {
    const gap = events[i].timestamp - events[i - 1].timestamp;
    if (gap < 200) {
      currentBurst++;
    } else {
      bursts.push(currentBurst);
      currentBurst = 1;
    }
  }
  bursts.push(currentBurst);
  return bursts;
}

function buildKeyDwellMap(events) {
  const dwellsByKey = {};
  for (const event of events) {
    const key = event.key.toLowerCase();
    if (key.length !== 1) continue;
    if (!dwellsByKey[key]) dwellsByKey[key] = [];
    dwellsByKey[key].push(event.duration);
  }
  const result = {};
  for (const [key, dwells] of Object.entries(dwellsByKey)) result[key] = mean(dwells);
  return result;
}

function analyzeKeystrokes(events) {
  const dwellTimes = events.map((e) => e.duration).filter((d) => d > 0 && d < 1000);
  const flightTimes = [];
  for (let i = 1; i < events.length; i++) {
    const flight = events[i].timestamp - (events[i - 1].timestamp + events[i - 1].duration);
    if (flight >= 0 && flight < 2000) flightTimes.push(flight);
  }
  const totalTime = events.length > 1 ? (events[events.length - 1].timestamp - events[0].timestamp) / 1000 / 60 : 1;
  const charCount = events.filter((e) => e.key.length === 1).length;
  const wordsPerMinute = charCount / 5 / Math.max(totalTime, 0.01);
  const pauseThreshold = 500;
  const pauses = flightTimes.filter((f) => f > pauseThreshold).length;
  const pauseFrequency = flightTimes.length > 0 ? pauses / flightTimes.length : 0;
  return {
    averageDwellTime: mean(dwellTimes),
    dwellTimeVariance: variance(dwellTimes),
    averageFlightTime: mean(flightTimes),
    flightTimeVariance: variance(flightTimes),
    wordsPerMinute,
    rhythmSignature: computeRhythmSignature(events),
    digraphTimings: extractDigraphs(events),
    burstPattern: computeBurstPattern(events),
    pauseFrequency,
    keyDwellMap: buildKeyDwellMap(events),
  };
}

function normalize(value, min, max) {
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function profileToSeed(profile) {
  const values = [
    profile.averageDwellTime,
    profile.averageFlightTime,
    profile.dwellTimeVariance,
    profile.wordsPerMinute,
    profile.pauseFrequency,
  ];
  return values.reduce((acc, v, i) => acc + v * (i + 1) * 7.3, 0);
}

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function generateStrands(profile) {
  const seed = profileToSeed(profile);
  const random = seededRandom(seed);
  const baseHue = (profile.averageDwellTime * 2.5 + profile.wordsPerMinute * 1.8) % 360;
  const strandCount = 3 + Math.floor(normalize(profile.dwellTimeVariance, 0, 5000) * 4);
  const strands = [];
  for (let i = 0; i < strandCount; i++) {
    const rhythmInfluence = profile.rhythmSignature[i % profile.rhythmSignature.length] || 150;
    const burstInfluence = profile.burstPattern[i % profile.burstPattern.length] || 3;
    strands.push({
      hue: (baseHue + i * (360 / strandCount) + random() * 30) % 360,
      saturation: 50 + normalize(rhythmInfluence, 50, 400) * 40,
      lightness: 45 + random() * 25,
      amplitude: 30 + burstInfluence * 8 + random() * 40,
      frequency: 0.005 + normalize(profile.averageFlightTime, 30, 300) * 0.02 + random() * 0.005,
      phase: (i * Math.PI * 2) / strandCount + random() * 0.5,
      thickness: 1.5 + normalize(profile.averageDwellTime, 50, 200) * 3 + random() * 1.5,
    });
  }
  return strands;
}

function generateVisualConfig(profile) {
  const strands = generateStrands(profile);
  const seed = profileToSeed(profile);
  const random = seededRandom(seed + 999);
  const bgLightness = 3 + random() * 5;
  const bgHue = strands[0]?.hue || 0;
  return {
    strands,
    backgroundColor: `hsl(${bgHue}, 15%, ${bgLightness}%)`,
    rotationSpeed: 0.0003 + normalize(profile.wordsPerMinute, 20, 120) * 0.001,
    symmetry: Math.floor(2 + normalize(profile.pauseFrequency, 0, 0.5) * 6),
    complexity: normalize(profile.flightTimeVariance, 0, 10000) * 0.8 + 0.2,
    particleCount: Math.floor(20 + profile.burstPattern.length * 3 + random() * 30),
  };
}

function renderToCanvas(canvas, config, profile, time) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(0, 0, width, height);
  const maxRadius = Math.min(width, height) * 0.38;
  drawBackgroundParticles(ctx, config, profile, time, centerX, centerY, maxRadius);
  drawHelixStrands(ctx, config, profile, time, centerX, centerY, maxRadius);
  drawCenterCore(ctx, config, time, centerX, centerY);
  drawRhythmRing(ctx, profile, config, time, centerX, centerY, maxRadius);
}

function drawBackgroundParticles(ctx, config, profile, time, cx, cy, radius) {
  const seed = profileToSeed(profile);
  const random = seededRandom(seed + 42);
  for (let i = 0; i < config.particleCount; i++) {
    const angle = random() * Math.PI * 2 + time * config.rotationSpeed * (i % 2 === 0 ? 1 : -1);
    const dist = random() * radius * 1.2;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const size = 1 + random() * 2;
    const opacity = 0.1 + random() * 0.3;
    const strand = config.strands[i % config.strands.length];
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${strand.hue}, ${strand.saturation}%, ${strand.lightness}%, ${opacity})`;
    ctx.fill();
  }
}

function drawHelixStrands(ctx, config, profile, time, cx, cy, maxRadius) {
  const steps = 300;
  const totalAngle = Math.PI * 2 * config.symmetry;
  for (const strand of config.strands) {
    ctx.beginPath();
    ctx.lineWidth = strand.thickness;
    ctx.strokeStyle = `hsla(${strand.hue}, ${strand.saturation}%, ${strand.lightness}%, 0.7)`;
    ctx.shadowColor = `hsla(${strand.hue}, ${strand.saturation}%, ${strand.lightness + 20}%, 0.4)`;
    ctx.shadowBlur = 8;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const baseAngle = t * totalAngle + time * config.rotationSpeed * 50 + strand.phase;
      const radiusOscillation = Math.sin(t * Math.PI * 4 + time * 0.001 + strand.phase) * strand.amplitude;
      const currentRadius = t * maxRadius + radiusOscillation;
      const x = cx + Math.cos(baseAngle) * currentRadius;
      const y = cy + Math.sin(baseAngle) * currentRadius;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  drawConnectorBridges(ctx, config, profile, time, cx, cy, maxRadius);
}

function drawConnectorBridges(ctx, config, profile, time, cx, cy, maxRadius) {
  if (config.strands.length < 2) return;
  const bridgeCount = Math.min(profile.digraphTimings.length, 40);
  const totalAngle = Math.PI * 2 * config.symmetry;
  for (let b = 0; b < bridgeCount; b++) {
    const digraph = profile.digraphTimings[b];
    const t = (b + 1) / (bridgeCount + 1);
    const strand1 = config.strands[0];
    const strand2 = config.strands[1 % config.strands.length];
    const baseAngle = t * totalAngle + time * config.rotationSpeed * 50;
    const r1 = t * maxRadius + Math.sin(t * Math.PI * 4 + time * 0.001 + strand1.phase) * strand1.amplitude;
    const r2 = t * maxRadius + Math.sin(t * Math.PI * 4 + time * 0.001 + strand2.phase) * strand2.amplitude;
    const x1 = cx + Math.cos(baseAngle + strand1.phase) * r1;
    const y1 = cy + Math.sin(baseAngle + strand1.phase) * r1;
    const x2 = cx + Math.cos(baseAngle + strand2.phase) * r2;
    const y2 = cy + Math.sin(baseAngle + strand2.phase) * r2;
    const opacity = normalize(digraph.flightTime, 30, 300) * 0.3 + 0.05;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = `hsla(${(strand1.hue + strand2.hue) / 2}, 60%, 60%, ${opacity})`;
    ctx.lineWidth = 0.5 + normalize(digraph.flightTime, 30, 300) * 1.5;
    ctx.stroke();
  }
}

function drawCenterCore(ctx, config, time, cx, cy) {
  const coreRadius = 4 + Math.sin(time * 0.002) * 2;
  const primaryStrand = config.strands[0];
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius * 4);
  gradient.addColorStop(0, `hsla(${primaryStrand.hue}, ${primaryStrand.saturation}%, 80%, 0.8)`);
  gradient.addColorStop(0.5, `hsla(${primaryStrand.hue}, ${primaryStrand.saturation}%, 60%, 0.2)`);
  gradient.addColorStop(1, "transparent");
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius * 4, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
  ctx.fillStyle = `hsla(${primaryStrand.hue}, ${primaryStrand.saturation}%, 85%, 0.9)`;
  ctx.fill();
}

function drawRhythmRing(ctx, profile, config, time, cx, cy, maxRadius) {
  if (profile.rhythmSignature.length === 0) return;
  const ringRadius = maxRadius * 1.05;
  const segments = profile.rhythmSignature.length;
  const primaryStrand = config.strands[0];
  ctx.beginPath();
  ctx.lineWidth = 1;
  ctx.strokeStyle = `hsla(${primaryStrand.hue}, ${primaryStrand.saturation}%, ${primaryStrand.lightness}%, 0.15)`;
  for (let i = 0; i <= segments; i++) {
    const idx = i % segments;
    const angle = (i / segments) * Math.PI * 2 - Math.PI / 2 + time * config.rotationSpeed * 10;
    const rhythmNorm = normalize(profile.rhythmSignature[idx], 80, 400);
    const r = ringRadius + rhythmNorm * 20 - 10;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
}
