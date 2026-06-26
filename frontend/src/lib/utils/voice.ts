export function makeMockWaveform(seed: number): number[] {
  const bars = 32;
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < bars; i++) {
    s = (s * 9301 + 49297) % 233280;
    const n = s / 233280;
    out.push(0.25 + n * 0.75);
  }
  return out;
}
