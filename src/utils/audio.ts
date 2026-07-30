/**
 * Impact Sound
 *
 * The project ships no audio assets, so the putt is synthesised procedurally
 * with the Web Audio API.
 *
 * A real putter makes a short, round "tock": the click of contact plus the
 * body of the head ringing briefly. That is modelled here as a very short
 * band-passed noise burst layered over three exponentially decaying sine
 * partials. Deliberately no pitch sweep — sweeping reads as something flying
 * away rather than something being struck.
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
 * Play the putter-on-ball impact.
 *
 * Tuning the feel only needs the numbers below: `level` for loudness,
 * `PARTIALS` for pitch/brightness/length.
 *
 * @param strength 0–1, scaled from the gate's rotation angle so a π rotation
 *                 is struck more firmly than a π/4 one.
 */
export function playImpact(strength: number = 1): void {
  if (muted || !ctx || ctx.state !== 'running') return;

  const context = ctx;
  const now = context.currentTime;
  const s = Math.max(0, Math.min(strength, 1));

  // A putt is a quiet sound to begin with. A firmer one is louder and, via the
  // partial levels below, slightly brighter.
  const level = 0.11 * (0.5 + 0.5 * s);

  // Nudge the pitch a few percent per shot so a run of gates doesn't sound
  // like a machine gun.
  const detune = 1 + (Math.random() - 0.5) * 0.06;

  // The head ringing: [frequency, level relative to `level`, decay seconds].
  // The upper partials fade out as the strike softens — that is what makes a
  // gentle putt read as duller rather than merely quieter.
  const partials: Array<[number, number, number]> = [
    [820, 1.0, 0.085],
    [1600, 0.55 * (0.6 + 0.4 * s), 0.045],
    [3100, 0.25 * (0.4 + 0.6 * s), 0.018],
  ];

  for (const [frequency, amp, decay] of partials) {
    const osc = context.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency * detune, now);

    const gain = context.createGain();
    gain.gain.setValueAtTime(level * amp, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(now);
    osc.stop(now + decay + 0.01);
  }

  // The click of contact. This has to scale with `s` as well: leaving it at a
  // fixed level makes a soft putt *brighter* than a firm one, because the
  // click then dominates the quietened partials.
  const noise = context.createBufferSource();
  noise.buffer = getNoiseBuffer(context);

  const bandpass = context.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.setValueAtTime(2600, now);
  bandpass.Q.setValueAtTime(0.9, now);

  const noiseGain = context.createGain();
  noiseGain.gain.setValueAtTime(level * 0.5 * (0.5 + 0.5 * s), now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.009);

  noise.connect(bandpass);
  bandpass.connect(noiseGain);
  noiseGain.connect(context.destination);
  noise.start(now);
  noise.stop(now + 0.05);
}
