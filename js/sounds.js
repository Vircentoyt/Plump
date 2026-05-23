let audioContext = null;

function getContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  return audioContext;
}

function scheduleGain(gainNode, startTime, peak, duration) {
  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(peak, startTime + 0.008);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
}

function createPinkNoiseBuffer(ctx, durationSeconds) {
  const length = Math.floor(ctx.sampleRate * durationSeconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;

  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;
    data[i] = pink * 0.22;
  }

  return buffer;
}

function pageTurnEnvelope(length) {
  const envelope = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const t = i / length;
    if (t < 0.12) {
      envelope[i] = t / 0.12;
    } else if (t < 0.58) {
      envelope[i] = 1 - ((t - 0.12) / 0.46) * 0.28;
    } else {
      envelope[i] = 0.72 * (1 - (t - 0.58) / 0.42);
    }
  }
  return envelope;
}

export function unlockSounds() {
  getContext();
}

export function playCardPlaceSound() {
  const ctx = getContext();
  if (!ctx) {
    return;
  }

  const now = ctx.currentTime;
  const duration = 0.34;
  const output = ctx.createGain();
  output.gain.value = 0.72;
  output.connect(ctx.destination);

  const rustle = ctx.createBufferSource();
  const rustleBuffer = createPinkNoiseBuffer(ctx, duration);
  const envelope = pageTurnEnvelope(rustleBuffer.length);
  const rustleData = rustleBuffer.getChannelData(0);
  for (let i = 0; i < rustleData.length; i += 1) {
    rustleData[i] *= envelope[i];
  }
  rustle.buffer = rustleBuffer;

  const rustleFilter = ctx.createBiquadFilter();
  rustleFilter.type = "bandpass";
  rustleFilter.Q.value = 0.85;
  rustleFilter.frequency.setValueAtTime(420, now);
  rustleFilter.frequency.linearRampToValueAtTime(1650, now + duration * 0.42);
  rustleFilter.frequency.linearRampToValueAtTime(520, now + duration);

  const rustleGain = ctx.createGain();
  rustleGain.gain.setValueAtTime(0.0001, now);
  rustleGain.gain.exponentialRampToValueAtTime(0.34, now + 0.03);
  rustleGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  rustle.connect(rustleFilter);
  rustleFilter.connect(rustleGain);
  rustleGain.connect(output);
  rustle.start(now);
  rustle.stop(now + duration + 0.02);

  const edge = ctx.createBufferSource();
  const edgeBuffer = createPinkNoiseBuffer(ctx, duration * 0.55);
  const edgeEnvelope = pageTurnEnvelope(edgeBuffer.length);
  const edgeData = edgeBuffer.getChannelData(0);
  for (let i = 0; i < edgeData.length; i += 1) {
    edgeData[i] *= edgeEnvelope[i] * 0.65;
  }
  edge.buffer = edgeBuffer;

  const edgeFilter = ctx.createBiquadFilter();
  edgeFilter.type = "highpass";
  edgeFilter.frequency.value = 1800;
  edgeFilter.Q.value = 0.6;

  const edgeGain = ctx.createGain();
  edgeGain.gain.setValueAtTime(0.0001, now + 0.04);
  edgeGain.gain.exponentialRampToValueAtTime(0.1, now + 0.08);
  edgeGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.72);
  edge.connect(edgeFilter);
  edgeFilter.connect(edgeGain);
  edgeGain.connect(output);
  edge.start(now + 0.04);
  edge.stop(now + duration * 0.75);

  const whoosh = ctx.createOscillator();
  const whooshGain = ctx.createGain();
  whoosh.type = "sine";
  whoosh.frequency.setValueAtTime(110, now + 0.02);
  whoosh.frequency.exponentialRampToValueAtTime(240, now + duration * 0.45);
  whoosh.frequency.exponentialRampToValueAtTime(85, now + duration);
  whooshGain.gain.setValueAtTime(0.0001, now + 0.02);
  whooshGain.gain.exponentialRampToValueAtTime(0.045, now + 0.08);
  whooshGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  whoosh.connect(whooshGain);
  whooshGain.connect(output);
  whoosh.start(now + 0.02);
  whoosh.stop(now + duration + 0.02);

  const settle = ctx.createBufferSource();
  const settleBuffer = createPinkNoiseBuffer(ctx, 0.08);
  const settleData = settleBuffer.getChannelData(0);
  for (let i = 0; i < settleData.length; i += 1) {
    settleData[i] *= 1 - i / settleData.length;
  }
  settle.buffer = settleBuffer;

  const settleFilter = ctx.createBiquadFilter();
  settleFilter.type = "lowpass";
  settleFilter.frequency.value = 900;

  const settleGain = ctx.createGain();
  scheduleGain(settleGain, now + duration * 0.62, 0.06, 0.1);
  settle.connect(settleFilter);
  settleFilter.connect(settleGain);
  settleGain.connect(output);
  settle.start(now + duration * 0.62);
  settle.stop(now + duration * 0.75);
}

export function playLaserSound() {
  const ctx = getContext();
  if (!ctx) {
    return;
  }

  const now = ctx.currentTime;
  const output = ctx.createGain();
  output.gain.value = 0.62;
  output.connect(ctx.destination);

  const beam = ctx.createOscillator();
  const beamGain = ctx.createGain();
  beam.type = "sawtooth";
  beam.frequency.setValueAtTime(980, now);
  beam.frequency.exponentialRampToValueAtTime(180, now + 0.28);
  scheduleGain(beamGain, now, 0.18, 0.32);
  beam.connect(beamGain);
  beamGain.connect(output);
  beam.start(now);
  beam.stop(now + 0.34);

  const zap = ctx.createOscillator();
  const zapGain = ctx.createGain();
  zap.type = "square";
  zap.frequency.setValueAtTime(2200, now);
  zap.frequency.exponentialRampToValueAtTime(420, now + 0.16);
  scheduleGain(zapGain, now, 0.08, 0.18);
  zap.connect(zapGain);
  zapGain.connect(output);
  zap.start(now);
  zap.stop(now + 0.2);

  const noise = ctx.createBufferSource();
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.22), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  noise.buffer = buffer;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "highpass";
  noiseFilter.frequency.value = 1200;

  const noiseGain = ctx.createGain();
  scheduleGain(noiseGain, now + 0.02, 0.1, 0.2);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(output);
  noise.start(now + 0.02);
  noise.stop(now + 0.24);

  const impact = ctx.createOscillator();
  const impactGain = ctx.createGain();
  impact.type = "triangle";
  impact.frequency.setValueAtTime(520, now + 0.18);
  impact.frequency.exponentialRampToValueAtTime(90, now + 0.42);
  scheduleGain(impactGain, now + 0.18, 0.14, 0.28);
  impact.connect(impactGain);
  impactGain.connect(output);
  impact.start(now + 0.18);
  impact.stop(now + 0.48);
}

export function playMinecraftMenuClickSound() {
  const ctx = getContext();
  if (!ctx) {
    return;
  }

  const now = ctx.currentTime + 0.001;
  const pitch = 0.92 + Math.random() * 0.18;
  const output = ctx.createGain();
  output.gain.value = 0.88;
  output.connect(ctx.destination);

  const tick = ctx.createOscillator();
  const tickGain = ctx.createGain();
  tick.type = "square";
  tick.frequency.setValueAtTime(780 * pitch, now);
  tickGain.gain.setValueAtTime(0.0001, now);
  tickGain.gain.linearRampToValueAtTime(0.28, now + 0.0008);
  tickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);
  tick.connect(tickGain);
  tickGain.connect(output);
  tick.start(now);
  tick.stop(now + 0.038);

  const bite = ctx.createOscillator();
  const biteGain = ctx.createGain();
  bite.type = "square";
  bite.frequency.setValueAtTime(1180 * pitch, now);
  biteGain.gain.setValueAtTime(0.0001, now);
  biteGain.gain.linearRampToValueAtTime(0.12, now + 0.0006);
  biteGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);
  bite.connect(biteGain);
  biteGain.connect(output);
  bite.start(now);
  bite.stop(now + 0.026);

  const snap = ctx.createBufferSource();
  const snapBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.026), ctx.sampleRate);
  const snapData = snapBuffer.getChannelData(0);
  for (let i = 0; i < snapData.length; i += 1) {
    const decay = 1 - i / snapData.length;
    snapData[i] = (Math.random() * 2 - 1) * decay * decay * decay;
  }
  snap.buffer = snapBuffer;

  const snapFilter = ctx.createBiquadFilter();
  snapFilter.type = "bandpass";
  snapFilter.frequency.value = 1450 * pitch;
  snapFilter.Q.value = 1.35;

  const snapGain = ctx.createGain();
  snapGain.gain.setValueAtTime(0.0001, now);
  snapGain.gain.linearRampToValueAtTime(0.24, now + 0.0005);
  snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.024);
  snap.connect(snapFilter);
  snapFilter.connect(snapGain);
  snapGain.connect(output);
  snap.start(now);
  snap.stop(now + 0.028);

  const thump = ctx.createOscillator();
  const thumpGain = ctx.createGain();
  thump.type = "square";
  thump.frequency.setValueAtTime(155 * pitch, now);
  thumpGain.gain.setValueAtTime(0.0001, now);
  thumpGain.gain.linearRampToValueAtTime(0.14, now + 0.0006);
  thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.026);
  thump.connect(thumpGain);
  thumpGain.connect(output);
  thump.start(now);
  thump.stop(now + 0.03);
}
