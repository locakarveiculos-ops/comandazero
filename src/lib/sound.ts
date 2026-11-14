"use client";

// Alerta sonoro por Web Audio API (sem arquivos). Navegadores só tocam após um clique na página.
let ctx: AudioContext | null = null;

function audio() {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  return ctx;
}

export function unlockAudio() {
  const c = audio();
  if (c?.state === "suspended") void c.resume();
}

export function chime(kind: "order" | "call" = "order") {
  const c = audio();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const notes = kind === "order" ? [880, 1174.66, 1567.98] : [660, 520];
  notes.forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const t = c.currentTime + i * 0.16;
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.42);
  });
}
