/**
 * Impact Sound
 *
 * The project ships no audio assets, so the club's impact is synthesised
 * procedurally with the Web Audio API: a square-wave chirp for the retro
 * "thock" plus a short filtered noise burst for the click of the strike.
 */

const MUTE_KEY = 'bloch-golf:muted';

let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Create (or resume) the AudioContext. Browsers only allow this from a user
 * gesture, so call it from an input handler before any sound is needed.
 *
 * Safe to call repeatedly — it returns true once the context is running, which
 * lets callers stop retrying.
 */
export function primeAudio(): boolean {
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return false;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    return ctx.state === 'running';
  } catch {
    ctx = null;
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  } catch {
    // Storage unavailable (private mode) — the setting just won't persist.
  }
}

/** Short burst of white noise, built once and reused for every strike. */
function getNoiseBuffer(context: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    const length = Math.floor(context.sampleRate * 0.05);
    noiseBuffer = context.createBuffer(1, length, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  return noiseBuffer;
}

/**
 * Play the club-on-ball impact.
 *
 * @param strength 0–1, scaled from the gate's rotation angle so a π rotation
 *                 hits harder than a π/4 one.
 */
export function playImpact(strength: number = 1): void {
  if (muted || !ctx || ctx.state !== 'running') return;

  const context = ctx;
  const now = context.currentTime;
  const gain = 0.18 * Math.max(0.35, Math.min(strength, 1));

  const master = context.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.linearRampToValueAtTime(gain, now + 0.001);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
  master.connect(context.destination);

  // Pitch-swept square wave — the body of the "thock"
  const osc = context.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(300, now + 0.07);
  osc.connect(master);
  osc.start(now);
  osc.stop(now + 0.14);

  // Filtered noise transient — the click of contact
  const noise = context.createBufferSource();
  noise.buffer = getNoiseBuffer(context);

  const bandpass = context.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.setValueAtTime(3000, now);
  bandpass.Q.setValueAtTime(1.2, now);

  const noiseGain = context.createGain();
  noiseGain.gain.setValueAtTime(gain * 0.9, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

  noise.connect(bandpass);
  bandpass.connect(noiseGain);
  noiseGain.connect(context.destination);
  noise.start(now);
  noise.stop(now + 0.05);
}
