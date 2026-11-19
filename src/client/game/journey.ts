/**
 * Devvit Journeys from the play screen: one journey per attempt at one island, as
 * JOURNEY_MAP.md describes. Telemetry never blocks or breaks play: every call is fire and forget,
 * and if the SDK cannot load (outside Reddit) nothing is sent.
 */
import type { TelemetryClient } from '@devvit/analytics/client/reddit';
import type { PlayEvent } from '../../shared/play';
import {
  journeyRefused,
  journeyStep,
  NEW_JOURNEY,
  type JourneyAction,
  type JourneyCall,
  type JourneyKind,
  type JourneyMemory,
} from '../../shared/journey';

type Telemetry = TelemetryClient;

export type Journey = {
  /** The island is on screen and accepts taps. Once per page. */
  ready: () => void;
  /** After every play step. */
  play: (events: readonly PlayEvent[]) => void;
  /** A tap that is not a play step: Rotate, or Skip in the tutorial. */
  tap: (action: Extract<JourneyAction, 'rotate' | 'tutorial_skip'>) => void;
  /** The header that lets the server end this journey as completed at Lock in. */
  lockInHeaders: () => Record<string, string>;
  /** Lock in was accepted: the server has ended the journey. The next attempt is a new one. */
  locked: (next: JourneyKind) => void;
  /** The player left before Lock in: the journey ends as abandoned. */
  leave: () => void;
};

let readySent = false;
/** Reddit said it will not record journeys for this build: send nothing more from this page. */
let refused = false;

export function createJourney(kind: JourneyKind, log: boolean): Journey {
  let memory: JourneyMemory = NEW_JOURNEY;
  let attempt: JourneyKind = kind;
  let client: Telemetry | null = null;
  // Calls made before the SDK has loaded wait here, in order.
  const queue: (() => Promise<unknown>)[] = [];

  const run = (call: (telemetry: Telemetry) => Promise<unknown>): void => {
    const send = async (): Promise<unknown> => {
      if (client === null || refused) return undefined;
      const answer = await call(client).catch(() => undefined);
      if (journeyRefused(answer)) refused = true;
      if (log) console.log('[journey]', JSON.stringify(answer));
      return answer;
    };
    if (client === null) queue.push(send);
    else void send();
  };

  void import('@devvit/analytics/client/reddit')
    .then(async ({ createTelemetryClient }) => {
      // Tonight's island and a past one opened over it are separate journeys, kept apart.
      client = createTelemetryClient({ storageKey: `lumen.journey.${kind}` });
      // A journey left open by an earlier page is not this attempt's.
      client.clearJourneyId();
      for (const send of queue.splice(0)) await send();
    })
    .catch(() => undefined);

  const make = (call: JourneyCall): void => {
    if (call.type === 'start') run((telemetry) => telemetry.startJourney());
    else if (call.type === 'progress')
      run((telemetry) =>
        telemetry.progress({
          progress: call.progress,
          action: call.action,
          actionDetails: attempt,
        })
      );
    else
      run((telemetry) =>
        telemetry.interaction({ action: call.action, actionDetails: attempt })
      );
  };

  return {
    ready() {
      if (readySent) return;
      readySent = true;
      run((telemetry) => telemetry.appReady());
    },
    play(events) {
      const step = journeyStep(memory, events);
      memory = step.memory;
      for (const call of step.calls) make(call);
    },
    tap(action) {
      make({ type: 'interaction', action });
    },
    lockInHeaders() {
      if (refused) return {};
      const id = client?.getActiveJourneyId();
      return id === undefined || id === '' ? {} : { 'x-devvit-journey-id': id };
    },
    locked(next) {
      memory = NEW_JOURNEY;
      attempt = next;
      run(async (telemetry) => telemetry.clearJourneyId());
    },
    leave() {
      if (!memory.started) return;
      memory = NEW_JOURNEY;
      run(async (telemetry) => {
        const answer = await telemetry.endJourney({ complete: false });
        telemetry.clearJourneyId();
        return answer;
      });
    },
  };
}

/**
 * A journey that sends nothing: a Builder island's test is not one of the journeys in
 * JOURNEY_MAP.md, so it reports no events at all.
 */
export function quietJourney(): Journey {
  return {
    ready: () => undefined,
    play: () => undefined,
    tap: () => undefined,
    lockInHeaders: () => ({}),
    locked: () => undefined,
    leave: () => undefined,
  };
}
