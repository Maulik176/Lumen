/**
 * Sound, all synthesised with WebAudio: no audio files. Nothing plays until the player has
 * tapped, there is a mute button, and the sound stops when the page is hidden.
 */
import { SOUND } from '../../shared/config';

const MUTE_KEY = 'lumen.muted';

export type Sound = {
  /** Call on the first tap. Safe to call again. */
  unlock: () => void;
  click: () => void;
  /** Chime number `index` of the nightfall, rising in pitch. */
  chime: (index: number) => void;
  nightPad: () => void;
  isMuted: () => boolean;
  toggleMute: () => boolean;
};

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function createSound(): Sound {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = readMuted();

  const ready = (): { context: AudioContext; master: GainNode } | null => {
    if (
      context === null ||
      master === null ||
      muted ||
      context.state !== 'running'
    )
      return null;
    return { context, master };
  };

  /** One decaying tone. */
  const tone = (
    hz: number,
    seconds: number,
    volume: number,
    type: OscillatorType,
    delay = 0
  ): void => {
    const audio = ready();
    if (audio === null) return;
    const start = audio.context.currentTime + delay;
    const oscillator = audio.context.createOscillator();
    const gain = audio.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(hz, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    oscillator.connect(gain);
    gain.connect(audio.master);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.05);
  };

  document.addEventListener('visibilitychange', () => {
    if (context === null) return;
    if (document.hidden) void context.suspend();
    else if (!muted) void context.resume();
  });

  return {
    unlock() {
      if (context === null) {
        try {
          context = new AudioContext();
          master = context.createGain();
          master.gain.value = SOUND.masterVolume;
          master.connect(context.destination);
        } catch {
          context = null;
          master = null;
          return;
        }
      }
      if (!muted && context.state === 'suspended') void context.resume();
    },
    click() {
      tone(SOUND.clickHz, SOUND.clickSeconds, 0.5, 'triangle');
      tone(SOUND.clickHz * 0.5, SOUND.clickSeconds * 1.4, 0.3, 'sine');
    },
    chime(index) {
      const step =
        SOUND.chimeSteps[Math.min(index, SOUND.chimeSteps.length - 1)] ?? 0;
      const hz = SOUND.chimeBaseHz * Math.pow(2, step / 12);
      tone(hz, SOUND.chimeSeconds, 0.5, 'sine');
      tone(hz * 2, SOUND.chimeSeconds * 0.6, 0.16, 'sine');
      tone(hz * 3, SOUND.chimeSeconds * 0.35, 0.06, 'sine');
    },
    nightPad() {
      tone(SOUND.padHz, SOUND.padSeconds, SOUND.padVolume, 'sine');
      tone(
        SOUND.padHz * 1.5,
        SOUND.padSeconds,
        SOUND.padVolume * 0.6,
        'sine',
        0.2
      );
      tone(
        SOUND.padHz * 2.01,
        SOUND.padSeconds,
        SOUND.padVolume * 0.35,
        'triangle',
        0.4
      );
    },
    isMuted: () => muted,
    toggleMute() {
      muted = !muted;
      try {
        localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch {
        // Storage can be unavailable; the choice then lasts for this visit only.
      }
      if (context !== null) {
        if (muted) void context.suspend();
        else void context.resume();
      }
      return muted;
    },
  };
}
