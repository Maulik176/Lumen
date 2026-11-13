import { Hono } from 'hono';
import { context } from '@devvit/web/server';
import {
  readPostData,
  toPublicIsland,
  type IslandResponse,
  type LockInResponse,
} from '../../shared/api';
import { puzzleOfDaily } from '../../shared/daily';
import { medalFor, scoreSubmission } from '../../shared/validate';
import { dayNow, islandForDay } from '../core/content';

export const api = new Hono();

/** The day this request is about: the post's own day, or today when there is no post data. */
function requestedDay(explicit: unknown): number {
  if (
    typeof explicit === 'number' &&
    Number.isInteger(explicit) &&
    explicit >= 1
  )
    return explicit;
  const post = readPostData(context.postData);
  return post?.day ?? dayNow(Date.now());
}

api.get('/island', (c) => {
  const fromQuery = Number(c.req.query('day'));
  const island = islandForDay(
    requestedDay(Number.isInteger(fromQuery) ? fromQuery : undefined)
  );
  if (island === undefined)
    return c.json<IslandResponse>({ ok: false, reason: 'not-found' }, 404);
  return c.json<IslandResponse>({ ok: true, island: toPublicIsland(island) });
});

/**
 * Lock in. The server re-traces the placements and decides the result; nothing the client says
 * about its own score is used. Milestone 5 adds the start record, storage, streaks and the sky.
 */
api.post('/lock-in', async (c) => {
  const body: unknown = await c.req.json().catch(() => null);
  if (typeof body !== 'object' || body === null) {
    return c.json<LockInResponse>({ ok: false, reason: 'bad-request' }, 400);
  }
  const fields: Record<string, unknown> = { ...body };
  const island = islandForDay(requestedDay(fields['day']));
  if (island === undefined)
    return c.json<LockInResponse>({ ok: false, reason: 'not-found' }, 404);

  const score = scoreSubmission(puzzleOfDaily(island), fields['placements']);
  if (!score.ok)
    return c.json<LockInResponse>({ ok: false, reason: score.problem }, 400);
  if (!score.solved)
    return c.json<LockInResponse>({ ok: false, reason: 'not-solved' }, 400);

  const claimed = fields['elapsedMs'];
  const elapsedMs =
    typeof claimed === 'number' && Number.isFinite(claimed) && claimed >= 0
      ? Math.round(claimed)
      : 0;
  return c.json<LockInResponse>({
    ok: true,
    day: island.day,
    pieces: score.pieces,
    par: island.par,
    medal: medalFor(score.pieces, island.par),
    elapsedMs,
  });
});
