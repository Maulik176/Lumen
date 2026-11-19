/**
 * Devvit Journeys over Hono. The SDK's client posts to these five routes; its own ready-made
 * router is Express-only (PLATFORM.md), so these do the same job, with two differences:
 *
 * - Only the fixed words in JOURNEY_MAP.md are passed on. Anything else is refused.
 * - The client may only end a journey as abandoned. A completed end, with its score, is sent by
 *   the server inside /api/lock-in after it has checked the answer itself.
 */
import { Hono } from 'hono';
import {
  TELEMETRY_JOURNEY_ENDPOINTS,
  TELEMETRY_UNSPECIFIED_RECEIPT,
  type JourneyReceipt,
  type TelemetryJourneyEventResponse,
  type TelemetryJourneyStartResponse,
} from '@devvit/analytics/shared/reddit';
import { isJourneyAction, isJourneyKind } from '../../shared/journey';

/** The parts of the SDK's server telemetry client these routes use. */
export type JourneyServer = {
  startJourney(): Promise<TelemetryJourneyStartResponse>;
  journeyProgress(request: {
    journeyId: string;
    progress: number;
    action: string;
    actionDetails: string;
  }): Promise<TelemetryJourneyEventResponse>;
  journeyInteraction(request: {
    journeyId: string;
    action: string;
    actionDetails: string;
  }): Promise<TelemetryJourneyEventResponse>;
  endJourney(request: {
    journeyId: string;
    complete: boolean;
    game?: { win: boolean; score: number };
  }): Promise<TelemetryJourneyEventResponse>;
  appReady(): Promise<TelemetryJourneyEventResponse>;
};

const INVALID: JourneyReceipt = {
  status: 'JOURNEY_RECEIPT_INVALID',
  message: 'Invalid: Event payload was not recorded.',
};

/** Journey ids come from the SDK; anything else that looks like one is refused. */
export function isJourneyId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[\w-]+$/.test(value)
  );
}

async function body(request: {
  json: () => Promise<unknown>;
}): Promise<Record<string, unknown>> {
  const value: unknown = await request.json().catch(() => null);
  return typeof value === 'object' && value !== null ? { ...value } : {};
}

export function journeyRoutes(server: JourneyServer): Hono {
  const routes = new Hono();
  const refuse = (error: string) =>
    new Response(JSON.stringify({ error, receipt: INVALID }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });

  routes.onError((error, c) => {
    console.error(`Journey call failed: ${String(error)}`);
    return c.json(
      {
        error: 'Internal server error',
        receipt: TELEMETRY_UNSPECIFIED_RECEIPT,
      },
      500
    );
  });

  // In a build Reddit does not record (uploaded, never published) the start comes back with no
  // journey id and a "denied" receipt. That is expected, so it is passed on as it is: the SDK
  // client reads it as "no journey" without logging a failure.
  routes.post(TELEMETRY_JOURNEY_ENDPOINTS.start, async (c) =>
    c.json(await server.startJourney())
  );

  routes.post(TELEMETRY_JOURNEY_ENDPOINTS.progress, async (c) => {
    const { journeyId, progress, action, actionDetails } = await body(c.req);
    if (!isJourneyId(journeyId)) return refuse('journeyId is required.');
    if (typeof progress !== 'number' || !(progress >= 0 && progress <= 1))
      return refuse('progress must be between 0 and 1.');
    if (action !== 'lantern_lit' && action !== 'all_lit')
      return refuse('Unknown action.');
    if (!isJourneyKind(actionDetails)) return refuse('Unknown actionDetails.');
    return c.json(
      await server.journeyProgress({
        journeyId,
        progress,
        action,
        actionDetails,
      })
    );
  });

  routes.post(TELEMETRY_JOURNEY_ENDPOINTS.interaction, async (c) => {
    const { journeyId, action, actionDetails } = await body(c.req);
    if (journeyId !== undefined && !isJourneyId(journeyId))
      return refuse('journeyId must be a journey id.');
    if (
      !isJourneyAction(action) ||
      action === 'lantern_lit' ||
      action === 'all_lit'
    )
      return refuse('Unknown action.');
    if (!isJourneyKind(actionDetails)) return refuse('Unknown actionDetails.');
    return c.json(
      await server.journeyInteraction({
        journeyId: journeyId ?? '',
        action,
        actionDetails,
      })
    );
  });

  routes.post(TELEMETRY_JOURNEY_ENDPOINTS.end, async (c) => {
    const { journeyId, complete, game } = await body(c.req);
    if (!isJourneyId(journeyId)) return refuse('journeyId is required.');
    // Only the server reports a completed journey, after checking the answer.
    if (complete === true || game !== undefined)
      return refuse('Completed journeys are reported by the server.');
    return c.json(await server.endJourney({ journeyId, complete: false }));
  });

  routes.post(TELEMETRY_JOURNEY_ENDPOINTS.appReady, async (c) =>
    c.json(await server.appReady())
  );

  return routes;
}
