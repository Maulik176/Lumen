/**
 * The Island Builder's endpoints, under /api/builder. Signed-out players can build (their draft
 * stays on the device); checking, testing and keeping a draft on the server need an account.
 */
import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import {
  cleanSnoovatar,
  type BuilderCheckResponse,
  type BuilderDraftResponse,
  type BuilderMineResponse,
  type BuilderPublishResponse,
  type BuilderTestResponse,
  type BuilderTestStartResponse,
} from '../../shared/api';
import { readDraft } from '../../shared/builder';
import { COMMUNITY } from '../../shared/config';
import { nowMs } from '../core/clock';
import {
  checkIsland,
  dailyHashes,
  finishTest,
  islandStatus,
  listMine,
  loadDraft,
  publishIsland,
  recordCheck,
  saveDraft,
  startTest,
  takeCheckTurn,
} from '../core/community';
import { resultsComment } from '../core/post';
import { KEYS, redisStore as store } from '../core/store';
import { whoIsAsking } from './api';

export const builder = new Hono();

// With the community side switched off, the Builder does not answer at all.
builder.use('*', async (c, next) => {
  if (!COMMUNITY.enabled) return c.json({ ok: false, problem: 'off' }, 404);
  await next();
});

async function body(c: {
  req: { json: () => Promise<unknown> };
}): Promise<Record<string, unknown>> {
  try {
    const value = await c.req.json();
    return typeof value === 'object' && value !== null ? { ...value } : {};
  } catch {
    return {};
  }
}

builder.get('/draft', async (c) => {
  const player = await whoIsAsking();
  const [draft, user] = await Promise.all([
    loadDraft(store, player).catch(() => null),
    player === null
      ? Promise.resolve<Record<string, string>>({})
      : store
          .hGetAll(KEYS.user(player.userId))
          .catch((): Record<string, string> => ({})),
  ]);
  const status =
    draft === null
      ? { checked: null, tested: null }
      : await islandStatus(store, player, draft).catch(() => ({
          checked: null,
          tested: null,
        }));
  return c.json<BuilderDraftResponse>({
    ok: true,
    loggedIn: player !== null,
    draft,
    status,
    tutorialDone: user['builderTutorial'] === '1',
  });
});

builder.put('/draft', async (c) => {
  const draft = readDraft((await body(c))['draft']);
  if (draft === null) return c.json({ ok: false }, 400);
  const saved = await saveDraft(store, await whoIsAsking(), draft).catch(
    () => false
  );
  return c.json({ ok: saved });
});

builder.post('/check', async (c) => {
  const player = await whoIsAsking();
  if (player === null)
    return c.json<BuilderCheckResponse>({ ok: false, problem: 'signed-out' });
  const draft = readDraft((await body(c))['draft']);
  if (draft === null)
    return c.json<BuilderCheckResponse>(
      { ok: false, problem: 'malformed' },
      400
    );
  if (!(await takeCheckTurn(store, player).catch(() => true)))
    return c.json<BuilderCheckResponse>({ ok: false, problem: 'slow-down' });
  const outcome = checkIsland(draft, {
    daily: dailyHashes(),
    clock: () => performance.now(),
  });
  // Logged so the node limit can be set from Devvit's real speed (BUILDER_PLAN.md 1.6).
  console.log(
    `Builder check: ${draft.size}x${draft.size}, ${outcome.ok ? `par ${outcome.par}` : outcome.problem}, ${outcome.nodes} nodes, ${Math.round(outcome.ms)} ms`
  );
  if (!outcome.ok)
    return c.json<BuilderCheckResponse>({
      ok: false,
      problem: outcome.problem,
    });
  await recordCheck(store, player, draft, outcome).catch(() => undefined);
  return c.json<BuilderCheckResponse>({
    ok: true,
    par: outcome.par,
    inventory: outcome.inventory,
    difficulty: outcome.difficulty,
    label: outcome.label,
  });
});

builder.post('/test-start', async (c) => {
  const player = await whoIsAsking();
  if (player === null)
    return c.json<BuilderTestStartResponse>({
      ok: false,
      problem: 'signed-out',
    });
  const draft = readDraft((await body(c))['draft']);
  const started =
    draft === null
      ? 'not-checked'
      : await startTest(store, player, draft, nowMs()).catch(
          () => 'not-checked' as const
        );
  return c.json<BuilderTestStartResponse>(
    started === 'started' ? { ok: true } : { ok: false, problem: 'not-checked' }
  );
});

builder.post('/test-solve', async (c) => {
  const player = await whoIsAsking();
  if (player === null)
    return c.json<BuilderTestResponse>({ ok: false, problem: 'signed-out' });
  const fields = await body(c);
  const draft = readDraft(fields['draft']);
  if (draft === null)
    return c.json<BuilderTestResponse>({ ok: false, problem: 'changed' });
  const outcome = await finishTest(
    store,
    player,
    draft,
    fields['placements'],
    nowMs()
  ).catch(() => ({ ok: false as const, problem: 'not-checked' as const }));
  return c.json<BuilderTestResponse>(outcome);
});

builder.post('/tutorial-done', async (c) => {
  const player = await whoIsAsking();
  if (player !== null)
    await store
      .hSet(KEYS.user(player.userId), { builderTutorial: '1' })
      .catch(() => undefined);
  return c.json({ ok: true });
});

/**
 * Publish the maker's tested island as its own post: one explicit tap in the Builder's confirm
 * panel, never anything automatic. The server checks everything again (core/community.ts).
 */
builder.post('/publish', async (c) => {
  const player = await whoIsAsking();
  const fields = await body(c);
  const subredditName = context.subredditName;
  if (subredditName === undefined)
    return c.json<BuilderPublishResponse>({ ok: false, problem: 'failed' });
  const outcome = await publishIsland(
    store,
    player,
    {
      draft: fields['draft'],
      token: fields['token'],
      avatar: cleanSnoovatar(fields['snoovatar']),
      nowMs: nowMs(),
    },
    {
      poster: {
        async post({ title, text, postData, asUser }) {
          // As the player when Reddit allows it (a playtest build posts it from the app for
          // everyone but the owner); the title and the game credit the maker either way.
          const post = asUser
            ? await reddit.submitCustomPost({
                subredditName,
                title,
                entry: 'default',
                postData,
                runAs: 'USER',
                userGeneratedContent: { text },
                textFallback: { text },
              })
            : await reddit.submitCustomPost({
                subredditName,
                title,
                entry: 'default',
                postData,
                textFallback: { text },
              });
          return {
            id: post.id,
            permalink: post.permalink,
            author: post.authorName,
          };
        },
        async results(postId, number) {
          if (postId.startsWith('t3_'))
            await resultsComment(`t3_${postId.slice(3)}`, number);
        },
      },
      daily: dailyHashes(),
      clock: () => performance.now(),
    }
  ).catch((error: unknown): BuilderPublishResponse => {
    console.error(`Publish failed: ${String(error)}`);
    return { ok: false, problem: 'failed' };
  });
  if (outcome.ok)
    console.log(`Builder publish: ${outcome.postId} by ${player?.username}`);
  return c.json<BuilderPublishResponse>(outcome);
});

/** "Your islands": what the player has published, with plays and par hits. */
builder.get('/mine', async (c) => {
  const player = await whoIsAsking();
  const islands = await listMine(store, player).catch(() => []);
  return c.json<BuilderMineResponse>({
    ok: true,
    loggedIn: player !== null,
    islands,
  });
});
