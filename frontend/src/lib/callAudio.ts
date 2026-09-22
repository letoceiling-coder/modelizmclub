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

/**
 * Bind once — any tap/click unlocks audio for incoming rings.
 *
 * ПОЧЕМУ КОНТЕКСТ СТРОИТСЯ ЗАРАНЕЕ. `new AudioContext()` поднимает звуковой
 * поток и стоит дорого. Пока это делалось внутри обработчика первого нажатия,
 * первый щелчок на странице замирал. Замер 12.09 на странице объявления при
 * четырёхкратном замедлении процессора: худший кадр 232 мс, если стрелка
 * «Похожих» — первое нажатие на странице, и 61 мс, если до неё щёлкнуть в
 * любом другом месте. Профиль называл виновника прямо — 255 мс в функции,
 * которая и есть `new AudioContext()`.
 *
 * Выглядело это как рывок карусели, хотя карусель ни при чём: она просто
 * оказывалась первым, на что человек нажимает.
 *
 * Отложить построение в `requestIdleCallback` внутри обработчика не помогло:
 * простой наступает сразу после щелчка, то есть посреди анимации прокрутки, и
 * рывок остаётся (замер: 242 мс). Поэтому контекст строится один раз в простое
 * после загрузки, задолго до любого нажатия, а на нажатии остаётся только
 * `resume()` — он дешёвый.
 *
 * Строить контекст без жеста разрешено: он создаётся в состоянии `suspended` и
 * молчит, пока его не разбудят. Разрешение на звук от переноса не теряется —
 * признак взаимодействия у страницы залипающий.
 */
export function bindCallAudioUnlock(): void {
  if (unlockBound || typeof window === "undefined") return;
  unlockBound = true;

  const warmUp = (): void => {
    try {
      ensureCtx();
    } catch {
      /* звук — не то, ради чего стоит ронять страницу */
    }
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(warmUp, { timeout: 4000 });
  } else {
    window.setTimeout(warmUp, 1500);
  }

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

function playDualTone(freqs: [number, number], durationMs: number, gain = 0.12): void {
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
/**
 * Пинг нового сообщения.
 *
 * Раздражал не тон, а щелчки. `playDualTone` включает и выключает синус
 * рывком: разрыв в форме волны слышен как щелчок на каждом краю, а нот было
 * две по 90 мс — то есть четыре щелчка подряд. Замена — одна мягкая нота с
 * тихой квинтой, с нарастанием за 12 мс и затуханием до нуля.
 *
 * Тише прежнего вдвое: пинг сообщает, а не требует внимания.
 */
export function playMessagePing(): void {
  const audio = ensureCtx();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();

  const t0 = audio.currentTime;
  const master = audio.createGain();
  master.connect(audio.destination);

  /*
   * Нарастание линейное, затухание степенное — так слышит ухо. Ноль в
   * `exponentialRampToValueAtTime` недопустим, поэтому затухаем до
   * неслышимого и только потом обрываем.
   */
  master.gain.setValueAtTime(0.0001, t0);
  master.gain.linearRampToValueAtTime(0.035, t0 + 0.012);
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);

  // Ля второй октавы и квинта над ней, вдвое тише: интервал слышен как одна
  // нота с окраской, а не как два сигнала.
  for (const [freq, доля] of [
    [880, 1],
    [1320, 0.45],
  ] as const) {
    const gain = audio.createGain();
    gain.gain.value = доля;
    gain.connect(master);

    const osc = audio.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(t0);
    osc.stop(t0 + 0.34);
    activeOscillators.push(osc);

    /*
     * Уборка по ссылке, а не отбором по контексту.
     *
     * Прежняя строка (`filter(o => o.context === audio)`) не убирала ничего:
     * контекст — модульный синглтон и нигде не обнуляется, значит условие
     * истинно для всех. Массив рос на две записи с каждым сообщением, узлы
     * усиления оставались подключёнными к выходу, и `stopCallSounds` потом
     * перебирал сотни давно замолчавших осциллятров.
     */
    osc.onended = () => {
      activeOscillators = activeOscillators.filter((o) => o !== osc);
      osc.disconnect();
      gain.disconnect();
    };
  }

  setTimeout(() => master.disconnect(), 400);
}
