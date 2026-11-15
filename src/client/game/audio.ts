/**
 * Sound, all synthesised with WebAudio: no audio files. Nothing plays until the player has
 * tapped, there is a mute button, and the sound stops when the page is hidden.
 *
 * iOS rules this follows:
 * - An AudioContext only starts inside a real gesture: a finger lifting (touchend, pointerup) or
 *   a click. A finger landing (pointerdown, touchstart) does not count, so the context is created
 *   and resumed on release, before the tap itself is handled.
 * - Locking the phone or switching apps can leave a context "interrupted", "suspended", or
 *   worst of all "running" but silent, and none of these is reliably revived. So a context is
 *   never kept across a hidden page: it is closed when the page is hidden, and the next tap
 *   makes a fresh one (a context made inside a gesture is the one thing iOS always honours).
 * - If iOS gives no page event at all, a broken context still shows itself: its own clock
 *   (`currentTime`) stops. A tap that finds the clock where the last tap left it, with real
 *   time having passed, replaces the context too. As a last resort, a context that a tap
 *   cannot bring to "running" is replaced.
 * - A sound asked for while the context is still waking up is played once it is running, so the
 *   very first tap is heard.
 */
import { SOUND } from '../../shared/config';

const MUTE_KEY = 'lumen.muted';
/** Events that count as a user gesture for starting audio on iOS and elsewhere. */
const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'] as const;
/** If a tap's resume has not brought the context to "running" within this long, replace it. */
const REVIVE_MS = 400;
/** A running context's clock must have moved if this much real time passed between two taps. */
const STALL_MS = 250;

export type Sound = {
  /** Start or wake the audio. Called from inside a gesture; safe to call any number of times. */
  unlock: () => void;
  click: () => void;
  /** Chime number `index` of the nightfall, rising in pitch. */
  chime: (index: number) => void;
  nightPad: () => void;
  isMuted: () => boolean;
  toggleMute: () => boolean;
};

/** The parts of the page this module listens to. Passed in so tests can stand in for them. */
export type SoundHost = {
  /** Where gestures are heard. Listeners are added in the capture phase, before any game code. */
  gestures: Pick<EventTarget, 'addEventListener'>;
  /** Where `visibilitychange` is heard, and whether the page is hidden now. */
  page: Pick<EventTarget, 'addEventListener'> & { readonly hidden: boolean };
  makeContext: () => AudioContext;
  storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  /** Timers, so tests can run them by hand. */
  later: (run: () => void, ms: number) => void;
  /** Real time in milliseconds, for telling a stopped audio clock from a moving one. */
  now: () => number;
};

/** localStorage, or null where the browser refuses access to it. */
function pageStorage(): SoundHost['storage'] {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function browserHost(): SoundHost {
  const storage = pageStorage();
  return {
    gestures: window,
    page: document,
    makeContext: () => new AudioContext(),
    storage,
    later: (run, ms) => {
      window.setTimeout(run, ms);
    },
    now: () => performance.now(),
  };
}

export function createSound(host: SoundHost = browserHost()): Sound {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = false;
  try {
    muted = host.storage?.getItem(MUTE_KEY) === '1';
  } catch {
    muted = false;
  }
  /** Sounds asked for while the context was waking up. Played once it runs. */
  let waiting: (() => void)[] = [];

  const running = (): boolean =>
    context !== null && context.state === 'running';

  const flush = (): void => {
    if (!running()) return;
    const queued = waiting;
    waiting = [];
    for (const play of queued) play();
  };

  const build = (): void => {
    try {
      context = host.makeContext();
      master = context.createGain();
      master.gain.value = SOUND.masterVolume;
      master.connect(context.destination);
      context.addEventListener('statechange', flush);
    } catch {
      context = null;
      master = null;
    }
  };

  /** Ask the context to run, and play anything that was waiting once it does. */
  const wake = (): Promise<void> => {
    if (context === null) return Promise.resolve();
    if (context.state === 'running') {
      flush();
      return Promise.resolve();
    }
    return context.resume().then(flush, () => undefined);
  };

  /** One silent sample, played inside the gesture: the step that really unlocks audio on iOS. */
  const prime = (): void => {
    if (context === null || master === null) return;
    try {
      const buffer = context.createBuffer(1, 1, context.sampleRate);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(master);
      source.start(0);
    } catch {
      // Priming is a nicety; the resume below is what matters.
    }
  };

  /** Let the context go for good. The next tap makes a new one. */
  const discard = (): void => {
    const stale = context;
    context = null;
    master = null;
    waiting = [];
    seenAt = null;
    if (stale !== null) void stale.close().catch(() => undefined);
  };

  /** The audio clock and the real time at the last tap that found the context running. */
  let seenClock = 0;
  let seenAt: number | null = null;

  const unlock = (): void => {
    if (muted) return;
    if (context !== null && context.state === 'running') {
      const stalled =
        seenAt !== null &&
        context.currentTime === seenClock &&
        host.now() - seenAt > STALL_MS;
      if (!stalled) {
        seenClock = context.currentTime;
        seenAt = host.now();
        return;
      }
      // "Running" but its clock has stopped: iOS broke it. Start again, inside this tap.
      discard();
    }
    if (context === null) build();
    if (context === null) return;
    prime();
    void wake();
    // A context that iOS has interrupted sometimes never comes back. Replace it; the next tap
    // wakes the new one. Only ever for the context this tap tried to wake.
    const tried = context;
    host.later(() => {
      if (muted || context !== tried || running()) return;
      const stale = tried;
      context = null;
      master = null;
      void stale.close().catch(() => undefined);
      build();
      prime();
      void wake();
    }, REVIVE_MS);
  };

  for (const type of GESTURES) {
    host.gestures.addEventListener(type, unlock, {
      capture: true,
      passive: true,
    });
  }

  host.page.addEventListener('visibilitychange', () => {
    if (context === null) return;
    // Hidden (phone locked, app switched): the context is closed, never kept. Coming back
    // needs nothing here: the next tap builds a fresh one.
    if (host.page.hidden) discard();
  });

  /** One decaying tone. Queued if the context is still waking. */
  const tone = (
    hz: number,
    seconds: number,
    volume: number,
    type: OscillatorType,
    delay = 0
  ): void => {
    if (muted || context === null || master === null) return;
    const play = (): void => {
      if (muted || context === null || master === null) return;
      const start = context.currentTime + delay;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(hz, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(start + seconds + 0.05);
    };
    if (running()) {
      play();
      return;
    }
    waiting.push(play);
    void wake();
  };

  return {
    unlock,
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
        host.storage?.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch {
        // Storage can be unavailable; the choice then lasts for this visit only.
      }
      if (muted) {
        waiting = [];
        if (context !== null) void context.suspend().catch(() => undefined);
      } else {
        // The mute button is itself a tap, so this resume is allowed.
        unlock();
      }
      return muted;
    },
  };
}
