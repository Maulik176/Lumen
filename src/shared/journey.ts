/**
 * Which Devvit Journeys calls a play step makes, exactly as `JOURNEY_MAP.md` lists them. Pure, so
 * the map can be tested; the client sends the calls, and the server sends the completed end.
 *
 * Only the fixed words below are ever sent. No names, ids, text or times.
 */
import type { PlayEvent } from './play';

/** The kind of attempt, sent as `actionDetails`. */
export const JOURNEY_KINDS = ['ranked', 'replay', 'archive'] as const;
export type JourneyKind = (typeof JOURNEY_KINDS)[number];

export const JOURNEY_ACTIONS = [
  'lantern_lit',
  'all_lit',
  'undo',
  'reset',
  'rotate',
  'keep_refining',
  'tutorial_skip',
] as const;
export type JourneyAction = (typeof JOURNEY_ACTIONS)[number];

export type JourneyCall =
  | { type: 'start' }
  | { type: 'progress'; progress: number; action: 'lantern_lit' | 'all_lit' }
  | { type: 'interaction'; action: JourneyAction };

/** What a journey remembers between steps. */
export type JourneyMemory = { started: boolean; allLit: boolean };

export const NEW_JOURNEY: JourneyMemory = { started: false, allLit: false };

export function isJourneyKind(value: unknown): value is JourneyKind {
  return JOURNEY_KINDS.some((kind) => kind === value);
}

export function isJourneyAction(value: unknown): value is JourneyAction {
  return JOURNEY_ACTIONS.some((action) => action === value);
}

/** The calls one play step makes, and what the journey remembers after it. */
export function journeyStep(
  memory: JourneyMemory,
  events: readonly PlayEvent[]
): { memory: JourneyMemory; calls: JourneyCall[] } {
  const calls: JourneyCall[] = [];
  let { started, allLit } = memory;
  for (const event of events) {
    // The journey starts with the first piece placed in this attempt.
    if (event.type === 'placed' && !started) {
      started = true;
      calls.push({ type: 'start' });
    }
    // The rules report only new highs, so progress never goes down.
    if (event.type === 'lit-more' && event.total > 0)
      calls.push({
        type: 'progress',
        progress: event.lit / event.total,
        action: 'lantern_lit',
      });
    // "All lit" can come back after Keep refining; only the first counts.
    if (event.type === 'all-lit' && !allLit) {
      allLit = true;
      calls.push({ type: 'progress', progress: 1, action: 'all_lit' });
    }
    if (event.type === 'undone')
      calls.push({ type: 'interaction', action: 'undo' });
    if (event.type === 'reset')
      calls.push({ type: 'interaction', action: 'reset' });
    if (event.type === 'kept-refining')
      calls.push({ type: 'interaction', action: 'keep_refining' });
  }
  return { memory: { started, allLit }, calls };
}

/**
 * True when an answer from the platform says it will not record this page's journeys: a
 * playtest build, or a published one whose journey map is not approved yet. The client then
 * stops sending, quietly. A failed request is not a refusal.
 */
export function journeyRefused(answer: unknown): boolean {
  if (typeof answer !== 'object' || answer === null) return false;
  const fields: Record<string, unknown> = { ...answer };
  const receipt = fields['receipt'];
  if (typeof receipt !== 'object' || receipt === null) return false;
  const details: Record<string, unknown> = { ...receipt };
  const status = details['status'];
  return (
    typeof status === 'string' && status.startsWith('JOURNEY_RECEIPT_DENIED')
  );
}
