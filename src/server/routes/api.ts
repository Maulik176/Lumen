import { Hono } from 'hono';
import { context, realtime, reddit } from '@devvit/web/server';
import {
  readPostData,
  toPublicIsland,
  type IslandResponse,
  type BoardResponse,
  type LockInResponse,
  type PastResponse,
  type SkyResponse,
} from '../../shared/api';
import { COPY, PAST } from '../../shared/config';
import type { DailyIsland } from '../../shared/daily';
import { flairText } from '../../shared/streak';
import { islandForDay, lastDay } from '../core/content';
import {
  currentDay,
  lockIn,
  markTutorialDone,
  pastIslands,
  playerState,
  readAllTime,
  readLeaderboard,
  rankedOpen,
  readSky,
  recordStart,
  skyCount,
  type Effects,
  type Player,
} from '../core/game';
import { redisStore as store } from '../core/store';

export const api = new Hono();

const MEDAL_NAME = {
  lamplighter: COPY.medalLamplighter,
  glow: COPY.medalGlow,
  spark: COPY.medalSpark,
} as const;

/** Realtime channel for a night's sky. Letters, digits and underscores only. */
export const skyChannel = (day: number): string => `sky_${day}`;

/** Who is asking, or null when logged out. */
async function whoIsAsking(): Promise<Player> {
  const userId = context.userId;
  if (userId === undefined) return null;
  const username = await reddit.getCurrentUsername().catch(() => undefined);
  return username === undefined ? null : { userId, username };
}

function postDay(): number | undefined {
  return readPostData(context.postData)?.day;
}

/** The day this request is about: one asked for, else the post's own, else today. */
function requestedDay(explicit: unknown): number {
  if (
    typeof explicit === 'number' &&
    Number.isInteger(explicit) &&
    explicit >= 1
  )
    return explicit;
  return postDay() ?? currentDay(Date.now(), lastDay());
}

async function body(request: {
  json: () => Promise<unknown>;
}): Promise<Record<string, unknown>> {
  const value: unknown = await request.json().catch(() => null);
  return typeof value === 'object' && value !== null ? { ...value } : {};
}

/** After a ranked solve: flair and the sky broadcast. Both are decoration and may fail quietly. */
const effects: Effects = {
  async onRanked({ player, result, lantern }) {
    await Promise.allSettled([
      realtime.send(skyChannel(result.day), lantern),
      context.subredditName === undefined
        ? Promise.resolve()
        : reddit.setUserFlair({
            subredditName: context.subredditName,
            username: player.username,
            text: flairText(MEDAL_NAME[result.medal], result.streak),
          }),
    ]);
  },
};

api.get('/island', async (c) => {
  const fromQuery = Number(c.req.query('day'));
  const day = requestedDay(Number.isInteger(fromQuery) ? fromQuery : undefined);
  const island = islandForDay(day);
  if (island === undefined)
    return c.json<IslandResponse>({ ok: false, reason: 'not-found' }, 404);
  const player = await whoIsAsking();
  const [me, count] = await Promise.all([
    playerState(store, player, day, island),
    skyCount(store, day),
  ]);
  const open =
    postDay() === day &&
    rankedOpen(day, Date.now(), lastDay(), undefined) &&
    me.result === null;
  return c.json<IslandResponse>({
    ok: true,
    island: toPublicIsland(island),
    me,
    rankedOpen: open && me.loggedIn,
    skyCount: count,
  });
});

api.post('/start', async (c) => {
  const fields = await body(c.req);
  const day = requestedDay(fields['day']);
  if (islandForDay(day) !== undefined && postDay() === day) {
    await recordStart(store, await whoIsAsking(), day, Date.now()).catch(
      () => undefined
    );
  }
  return c.json({ ok: true });
});

api.post('/tutorial-done', async (c) => {
  await markTutorialDone(store, await whoIsAsking()).catch(() => undefined);
  return c.json({ ok: true });
});

api.post('/lock-in', async (c) => {
  const fields = await body(c.req);
  const island = islandForDay(requestedDay(fields['day']));
  if (island === undefined)
    return c.json<LockInResponse>({ ok: false, reason: 'not-found' }, 404);
  const outcome = await lockIn(
    store,
    await whoIsAsking(),
    {
      island,
      placements: fields['placements'],
      snoovatar: fields['snoovatar'],
      wantsRanked: fields['ranked'] !== false,
      postDay: postDay(),
      lastDay: lastDay(),
      nowMs: Date.now(),
    },
    effects
  );
  if (!outcome.ok)
    return c.json<LockInResponse>({ ok: false, reason: outcome.reason }, 400);
  return c.json<LockInResponse>({ ok: true, ...outcome.result });
});

api.get('/sky', async (c) => {
  const fromQuery = Number(c.req.query('day'));
  const day = requestedDay(Number.isInteger(fromQuery) ? fromQuery : undefined);
  const sky = await readSky(store, day);
  return c.json<SkyResponse>({ ok: true, day, ...sky });
});

/** Islands before the given day (the post's own by default), newest first. */
api.get('/past', async (c) => {
  const fromQuery = Number(c.req.query('before'));
  const before = requestedDay(
    Number.isInteger(fromQuery) ? fromQuery : undefined
  );
  const islands: DailyIsland[] = [];
  for (let day = before - 1; day >= 1 && islands.length < PAST.max; day--) {
    const island = islandForDay(day);
    if (island !== undefined) islands.push(island);
  }
  const list = await pastIslands(store, await whoIsAsking(), islands).catch(
    () => pastIslands(store, null, islands)
  );
  return c.json<PastResponse>({ ok: true, islands: list });
});

/** Tonight's board (scope=day, the default) or the all-time board (scope=alltime). */
api.get('/leaderboard', async (c) => {
  const fromQuery = Number(c.req.query('day'));
  const day = requestedDay(Number.isInteger(fromQuery) ? fromQuery : undefined);
  const username = (await whoIsAsking())?.username ?? null;
  if (c.req.query('scope') === 'alltime') {
    const board = await readAllTime(store, username);
    return c.json<BoardResponse>({ ok: true, scope: 'alltime', ...board });
  }
  const board = await readLeaderboard(store, day, username);
  return c.json<BoardResponse>({ ok: true, scope: 'day', ...board });
});
