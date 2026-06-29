/**
 * Call UI sounds via Web Audio (no external assets).
 * Browsers block autoplay until user gesture — call unlock() after interaction.
 */

let ctx: AudioContext | null = null;
let loopTimer: ReturnType<typeof setInterval> | null = null;
let activeOscillators: OscillatorNode[] = [];
let unlockBound = false;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function unlockCallAudio(): void {
  const c = ensureCtx();
  if (c?.state === "suspended") void c.resume();
}

/** Bind once — any tap/click unlocks audio for incoming rings. */
export function bindCallAudioUnlock(): void {
  if (unlockBound || typeof window === "undefined") return;
  unlockBound = true;
  const unlock = (): void => {
    unlockCallAudio();
  };
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true });
}

function stopOscillators(): void {
  for (const o of activeOscillators) {
    try {
      o.stop();
    } catch {
      /* already stopped */
    }
  }
  activeOscillators = [];
}

export function stopCallSounds(): void {
  stopOscillators();
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
}

/**
 * Stop only the repeating ring loop (ringback / ringtone) without killing
 * one-shot cues like "connected". Used the moment a call leaves the
 * "ringing" state so the гудки/мелодия always go silent on connect.
 */
export function stopRingLoop(): void {
  if (loopTimer) {
    clearInterval(loopTimer);
    loopTimer = null;
  }
}

function playDualTone(
  freqs: [number, number],
  durationMs: number,
  gain = 0.12,
): void {
  const audio = ensureCtx();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();

  const master = audio.createGain();
  master.gain.value = gain;
  master.connect(audio.destination);
  const t0 = audio.currentTime;
  const dur = durationMs / 1000;

  for (const freq of freqs) {
    const osc = audio.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur);
    activeOscillators.push(osc);
  }

  setTimeout(() => {
    activeOscillators = activeOscillators.filter((o) => o.context === audio);
  }, durationMs + 50);
}

function playSweep(startHz: number, endHz: number, durationMs: number, gain = 0.1): void {
  const audio = ensureCtx();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();

  const osc = audio.createOscillator();
  const g = audio.createGain();
  g.gain.value = gain;
  osc.connect(g);
  g.connect(audio.destination);
  const t0 = audio.currentTime;
  const dur = durationMs / 1000;
  osc.frequency.setValueAtTime(startHz, t0);
  osc.frequency.linearRampToValueAtTime(endHz, t0 + dur);
  osc.start(t0);
  osc.stop(t0 + dur);
  activeOscillators.push(osc);
}

function startLoop(fn: () => void, intervalMs: number): void {
  stopCallSounds();
  fn();
  loopTimer = setInterval(fn, intervalMs);
}

/** Outgoing — гудки вызова (1 с тон, 3 с пауза). */
export function startRingback(): void {
  startLoop(() => playDualTone([440, 480], 1000), 4000);
}

/** Incoming — мелодия звонка (двойный ринг). */
export function startRingtone(): void {
  const ring = (): void => {
    playDualTone([480, 620], 400, 0.14);
    setTimeout(() => playDualTone([480, 620], 400, 0.14), 500);
  };
  startLoop(ring, 3000);
}

export function playConnecting(): void {
  stopCallSounds();
  playDualTone([350, 350], 120, 0.08);
}

export function playConnected(): void {
  stopCallSounds();
  playSweep(400, 800, 280, 0.12);
}

export function playDisconnected(): void {
  stopCallSounds();
  playSweep(600, 200, 350, 0.1);
}

export function playBusy(): void {
  stopCallSounds();
  for (let i = 0; i < 3; i++) {
    setTimeout(() => playDualTone([480, 480], 180, 0.15), i * 280);
  }
}

export function playRejected(): void {
  stopCallSounds();
  playDualTone([300, 300], 450, 0.12);
}

/** Short ping for a new incoming chat message. Does not stop call sounds. */
export function playMessagePing(): void {
  playDualTone([660, 880], 90, 0.07);
  setTimeout(() => playDualTone([880, 990], 90, 0.07), 110);
}
