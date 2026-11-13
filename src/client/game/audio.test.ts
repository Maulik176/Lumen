import { describe, expect, it } from 'vitest';
import { createSound, type SoundHost } from './audio';

/**
 * A stand-in for the browser's AudioContext that behaves like iOS Safari: it starts suspended,
 * and `resume()` only works while a gesture is being handled.
 */
class FakeContext extends EventTarget {
  state: string = 'suspended';
  currentTime = 0;
  sampleRate = 44100;
  destination = {};
  tones = 0;
  closed = false;
  /** Set true for a context that iOS has broken: it never resumes again. */
  dead = false;
  constructor(private readonly inGesture: () => boolean) {
    super();
  }
  private set(state: string): void {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }
  resume(): Promise<void> {
    if (this.inGesture() && !this.dead) this.set('running');
    return this.state === 'running'
      ? Promise.resolve()
      : Promise.reject(new Error('not allowed'));
  }
  suspend(): Promise<void> {
    this.set('suspended');
    return Promise.resolve();
  }
  interrupt(): void {
    this.set('interrupted');
  }
  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
  createGain() {
    return {
      gain: {
        value: 1,
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      connect() {},
    };
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: { setValueAtTime() {} },
      connect() {},
      start: () => {
        this.tones++;
      },
      stop() {},
    };
  }
  createBuffer() {
    return {};
  }
  createBufferSource() {
    return { buffer: null, connect() {}, start() {} };
  }
}

/**
 * The fake implements only what the module touches. Tests are outside the no-casts rule's
 * purpose (it guards shipped code), but a type guard keeps even this honest.
 */
function asHost(
  host: Omit<SoundHost, 'makeContext'> & { makeContext: () => FakeContext }
): SoundHost {
  return { ...host, makeContext: () => toContext(host.makeContext()) };
}

function toContext(fake: FakeContext): AudioContext {
  return fake as unknown as AudioContext;
}

function setup() {
  let gesture = false;
  const contexts: FakeContext[] = [];
  const timers: (() => void)[] = [];
  const gestures = new EventTarget();
  const page = Object.assign(new EventTarget(), { hidden: false });
  const stored = new Map<string, string>();
  const host = {
    gestures,
    page,
    storage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
    },
    later: (run: () => void) => void timers.push(run),
    makeContext: () => {
      const context = new FakeContext(() => gesture);
      contexts.push(context);
      return context;
    },
  };
  const sound = createSound(asHost(host));
  const tap = (type = 'pointerup'): void => {
    gesture = true;
    gestures.dispatchEvent(new Event(type));
    gesture = false;
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  const runTimers = (): void => {
    for (const run of timers.splice(0)) run();
  };
  const current = (): FakeContext | undefined => contexts[contexts.length - 1];
  return {
    sound,
    tap,
    settle,
    runTimers,
    contexts,
    current,
    page,
    stored,
    setGesture: (value: boolean) => (gesture = value),
  };
}

describe('sound on iOS-like rules', () => {
  it('makes no sound and creates nothing before the first tap', () => {
    const { sound, contexts } = setup();
    sound.click();
    expect(contexts).toHaveLength(0);
  });

  it('a finger landing does not start audio; a finger lifting does', async () => {
    const { tap, current, settle } = setup();
    tap('pointerdown');
    expect(current()).toBeUndefined();
    tap('pointerup');
    await settle();
    expect(current()?.state).toBe('running');
  });

  it('the very first tap is heard', async () => {
    const { sound, tap, current, settle } = setup();
    tap();
    sound.click();
    await settle();
    expect(current()?.tones).toBeGreaterThan(0);
  });

  it('a sound asked for while waking is played once the context runs', async () => {
    const { sound, tap, current, settle, setGesture } = setup();
    tap();
    await settle();
    current()?.interrupt();
    sound.click();
    expect(current()?.tones).toBe(0);
    setGesture(true);
    await current()?.resume();
    setGesture(false);
    await settle();
    expect(current()?.tones).toBeGreaterThan(0);
  });

  it('after locking and unlocking the phone, the next tap brings sound back', async () => {
    const { sound, tap, current, settle, page } = setup();
    tap();
    await settle();
    // Phone locked: page hidden, iOS interrupts the context.
    page.hidden = true;
    page.dispatchEvent(new Event('visibilitychange'));
    current()?.interrupt();
    // Phone unlocked: the page tries to resume without a gesture, which iOS refuses.
    page.hidden = false;
    page.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(current()?.state).not.toBe('running');
    tap();
    sound.click();
    await settle();
    expect(current()?.state).toBe('running');
    expect(current()?.tones).toBeGreaterThan(0);
  });

  it('a context iOS has broken for good is replaced on the next tap', async () => {
    const { sound, tap, current, settle, runTimers, contexts } = setup();
    tap();
    await settle();
    runTimers();
    expect(contexts).toHaveLength(1);
    const first = current();
    if (first === undefined) throw new Error('no context');
    first.interrupt();
    first.dead = true;
    tap();
    await settle();
    expect(first.state).not.toBe('running');
    runTimers();
    expect(first.closed).toBe(true);
    expect(contexts).toHaveLength(2);
    // The replacement is woken by the next tap.
    tap();
    sound.click();
    await settle();
    expect(current()?.state).toBe('running');
    expect(current()?.tones).toBeGreaterThan(0);
  });

  it('suspends when the page is hidden and drops sounds queued meanwhile', async () => {
    const { sound, tap, current, settle, page } = setup();
    tap();
    await settle();
    page.hidden = true;
    page.dispatchEvent(new Event('visibilitychange'));
    expect(current()?.state).toBe('suspended');
    sound.click();
    expect(current()?.tones).toBe(0);
  });

  it('mute stops sound and is remembered; unmute (a tap) brings it back', async () => {
    const { sound, tap, current, settle, stored, setGesture } = setup();
    tap();
    await settle();
    expect(sound.toggleMute()).toBe(true);
    expect(stored.get('lumen.muted')).toBe('1');
    sound.click();
    expect(current()?.tones).toBe(0);
    tap();
    await settle();
    expect(current()?.state).toBe('suspended');
    // The mute button's own click is the gesture that unmutes.
    setGesture(true);
    expect(sound.toggleMute()).toBe(false);
    setGesture(false);
    sound.click();
    await settle();
    expect(current()?.tones).toBeGreaterThan(0);
  });
});
