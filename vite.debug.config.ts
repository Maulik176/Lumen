/**
 * Local-only server: `npm run debug`.
 *   /debug.html  the 2D viewer for content/puzzles.json
 *   /game.html   the real play screen, with the API routes it needs answered here by the
 *                same shared code the Reddit server uses (add ?day=12 for another island).
 *                A ranked Lock in (only sent by a page that asks for one) is remembered by
 *                day, so reloading shows the finished island; fetch('/api/forget') clears it.
 * Not used by the Reddit build.
 */
import { readFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import {
  toCommunityPostData,
  toPostData,
  toPublicIsland,
  toSundayPostData,
  type BoardResponse,
  type BuilderCheckResponse,
  type BuilderDraftResponse,
  type BuilderMineResponse,
  type BuilderPublishResponse,
  type BuilderTestResponse,
  type BuilderTestStartResponse,
  type CardResponse,
  type CommunityCredit,
  type IslandResponse,
  type LockInResponse,
  type OtherIsland,
  type OthersResponse,
  type PastResponse,
  type SkyResponse,
} from './src/shared/api';
import { readDraft, type IslandDraft } from './src/shared/builder';
import { isCommunity } from './src/shared/community';
import { BIOMES } from './src/shared/config';
import {
  readDailyFile,
  type DailyIsland,
  type PlayableIsland,
} from './src/shared/daily';
import { isRuleKind } from './src/shared/rules';
import { checkIsland, dailyHashes } from './src/server/core/check';
import {
  creatorRow,
  creditOf,
  finishTest,
  islandStatus,
  listMine,
  loadDraft,
  lookUpIsland,
  publishIsland,
  recordCheck,
  saveDraft,
  startTest,
  takeCheckTurn,
  type IslandLookup,
  type Poster,
} from './src/server/core/community';
import { nightStart, seedCrowd } from './src/server/core/crowd';
import {
  lockIn,
  markRuleSeen,
  markTutorialDone,
  pastIslands,
  playerState,
  rankedOpen,
  readAllTime,
  readLeaderboard,
  readOthers,
  readSky,
  recordStart,
  saveProgress,
  skyCount,
  type Player,
} from './src/server/core/game';
import { memoryStore } from './src/server/core/memory-store';
import { communityShelf, refreshVotes } from './src/server/core/shelf';
import { KEYS } from './src/server/core/store';
import { runPick, type PickReddit } from './src/server/core/sunday';

/** Reads a request's JSON body, or {} when there is none. */
function readBody(
  request: import('node:http').IncomingMessage
): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let text = '';
    request.on('data', (chunk: Buffer) => {
      text += chunk.toString();
    });
    request.on('end', () => {
      try {
        const value: unknown = JSON.parse(text);
        resolve(
          typeof value === 'object' && value !== null ? { ...value } : {}
        );
      } catch {
        resolve({});
      }
    });
  });
}

function localApi(): Plugin {
  const load = () =>
    readDailyFile(
      JSON.parse(
        readFileSync(
          join(import.meta.dirname, 'content', 'puzzles.json'),
          'utf8'
        )
      )
    );
  const heroIsland = (day: number): DailyIsland | undefined => {
    const first = load().days[0];
    const hero: unknown = JSON.parse(
      readFileSync(join(import.meta.dirname, 'content', 'hero.json'), 'utf8')
    );
    if (first === undefined || typeof hero !== 'object' || hero === null)
      return undefined;
    const rows = 'rows' in hero ? hero.rows : undefined;
    if (
      !Array.isArray(rows) ||
      !rows.every((row): row is string => typeof row === 'string')
    )
      return undefined;
    return {
      ...first,
      day,
      biome: BIOMES[day - 900] ?? 'moss',
      name: 'Yellow Dusk',
      rows,
      inventory: { mirrors: 3, prisms: 1 },
      sourceColours: [],
      par: 3,
      solution: [],
    };
  };
  /**
   * The stand-in's Redis. Everything a player can see about other players (Lock in, the board,
   * See others' islands, the sky, every count) runs the real game code on it, as on Reddit, so
   * a local judge pass looks at what a real post would hold (Nov 20: a made-up list here hid
   * a bug that grouped boards caused). `fetch('/api/forget')` empties it.
   */
  let store = memoryStore();
  const boot = Date.now();
  /** The page that asked: the stand-in reads ?user=, ?signedout=1 and ?night=past from it. */
  const pageOf = (request: IncomingMessage): URLSearchParams =>
    new URL(request.headers.referer ?? 'http://localhost/', 'http://localhost')
      .searchParams;
  /** Who is asking: the page's ?user= (default "you"), or nobody with ?signedout=1. */
  const playerOf = (request: IncomingMessage): Player => {
    const page = pageOf(request);
    if (page.get('signedout') === '1') return null;
    const name = page.get('user') ?? 'you';
    return { userId: `t2_${name}`, username: name };
  };
  /**
   * The moment it is for an island: inside its own night, moving with real time so Lock in
   * times are real; ?night=past on the page reads it the next day, when the night is over.
   */
  const nowFor = (island: PlayableIsland, request: IncomingMessage): number =>
    nightStart(island) +
    3_600_000 +
    ((Date.now() - boot) % (20 * 3_600_000)) +
    (pageOf(request).get('night') === 'past' ? 86_400_000 : 0);
  const days = (): number => load().days.length;
  /** "?at=2026-11-26T12:00Z" on the page: the moment the Community view and dev tools use. */
  const momentOf = (request: IncomingMessage): number => {
    const at = Date.parse(pageOf(request).get('at') ?? '');
    return Number.isFinite(at) ? at : Date.now();
  };

  /** Posts made here: a local address that opens the island itself. */
  const localPoster: Poster = {
    async post({ postData }) {
      return {
        id: `t3_local${postData.day}`,
        permalink: `http://localhost:5199/game.html?day=${postData.day}`,
        author: 'lumen-game',
      };
    },
    async results() {},
  };
  /** Reddit for the Sunday pick and the scores: votes set by hand, everything else logged. */
  const votes = new Map<string, number>();
  const redditLog: string[] = [];
  let comments = 0;
  const pickReddit: PickReddit = {
    async readPosts(postIds) {
      return new Map(
        postIds.map((id) => [id, { score: votes.get(id) ?? 1, live: true }])
      );
    },
    async comment(postId, text) {
      comments++;
      redditLog.push(`comment on ${postId}: ${text}`);
      return `t1_local${comments}`;
    },
    async editComment(id, text) {
      redditLog.push(`edit ${id}: ${text}`);
    },
    async deleteComment(id) {
      redditLog.push(`delete ${id}`);
    },
    async flair(username, text) {
      redditLog.push(`flair u/${username}: ${text}`);
    },
    subreddit: 'lumen_game_dev',
  };
  const pickOptions = {
    daily: dailyHashes(),
    clock: () => performance.now(),
    log: (line: string) => redditLog.push(line),
  };

  /** The island behind a number as the real server finds it (Sunday's pick, community islands), or the hand-made hero island (900 up). */
  const islandAt = async (day: number): Promise<IslandLookup> => {
    if (day >= 900 && day < 900 + BIOMES.length) {
      const hero = heroIsland(day);
      return hero === undefined
        ? { ok: false, reason: 'not-found' }
        : { ok: true, island: hero, record: null, pick: null };
    }
    return lookUpIsland(store, day);
  };
  type Found = Extract<IslandLookup, { ok: true }>;
  /** A Sunday picked from the community: its maker, as the client may see it. */
  const madeByOf = (found: Found): CommunityCredit | undefined => {
    const winner = found.pick?.winner;
    if (winner === undefined || winner === null) return undefined;
    const { maker, makerAvatar, label } = winner.credit;
    return { maker, makerAvatar, label };
  };
  /** The maker's own test, pinned first: a community island's, or a Sunday pick's. */
  const creatorOf = (found: Found): OtherIsland | null =>
    found.record !== null
      ? creatorRow(found.record)
      : (found.pick?.winner?.creator ?? null);

  /** Publish a daily layout as a community island through the real publish flow. */
  const publishLocal = async (
    from: DailyIsland,
    maker: Player,
    name: string,
    biome: IslandDraft['biome'],
    nowMs: number
  ): Promise<number | null> => {
    if (maker === null) return null;
    // Mirrored left to right: an island of its own, not a copy of a daily one (which the
    // server refuses to publish or pick, as it should).
    const swap: Record<string, string> = {
      '/': '\\',
      '\\': '/',
      '<': '>',
      '>': '<',
    };
    const draft: IslandDraft = {
      size: from.rows.length,
      biome,
      name,
      spare: 1,
      rows: from.rows.map((row) =>
        [...row]
          .reverse()
          .map((tile) => swap[tile] ?? tile)
          .join('')
      ),
    };
    const never = new Set<string>();
    const checked = checkIsland(draft, { daily: never, clock: () => 0 });
    if (!checked.ok) return null;
    await recordCheck(store, maker, draft, checked);
    await startTest(store, maker, draft, nowMs - 60_000);
    await finishTest(store, maker, draft, checked.solution, nowMs);
    const answer = await publishIsland(
      store,
      maker,
      { draft, token: `local${Date.now()}x${from.day}`, avatar: '', nowMs },
      { poster: localPoster, daily: never, clock: () => 0 }
    );
    return answer.ok ? Number(answer.postId.replace('t3_local', '')) : null;
  };

  return {
    name: 'lumen-local-api',
    configureServer(server) {
      const reply = (
        response: import('node:http').ServerResponse,
        body: unknown,
        status = 200
      ): void => {
        response.statusCode = status;
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(body));
      };
      const askedDay = (request: IncomingMessage, name = 'day'): number =>
        Number(
          new URL(request.url ?? '', 'http://localhost').searchParams.get(
            name
          ) ?? '1'
        );
      /** Where a post's night stands, as the real server says: tonight, or past with ?night=past. */
      const nightAt = (
        day: number,
        request: IncomingMessage
      ): { night: 'tonight' | 'past'; tonightPost: string | null } =>
        !isCommunity(day) && pageOf(request).get('night') === 'past'
          ? { night: 'past', tonightPost: 't3_local' }
          : {
              night: 'tonight',
              tonightPost: isCommunity(day) ? 't3_local' : null,
            };
      /** One handler: errors answer 500 with the message, so a broken check is never silent. */
      const handle = (
        path: string,
        run: (
          request: IncomingMessage
        ) => Promise<{ body: unknown; status?: number }>
      ): void => {
        server.middlewares.use(path, (request, response) => {
          run(request).then(
            ({ body, status }) => reply(response, body, status),
            (error: unknown) =>
              reply(response, { ok: false, error: String(error) }, 500)
          );
        });
      };

      handle('/api/card', async (request) => {
        const day = askedDay(request);
        const found = await islandAt(day);
        if (!found.ok)
          return { body: { ok: false, reason: found.reason }, status: 404 };
        const { island, record } = found;
        const madeBy = madeByOf(found);
        const [me, count] = await Promise.all([
          playerState(store, playerOf(request), day),
          skyCount(store, day),
        ]);
        const body: CardResponse = {
          ok: true,
          ...nightAt(day, request),
          post:
            record !== null
              ? toCommunityPostData(island, creditOf(record))
              : madeBy !== undefined
                ? toSundayPostData(island, madeBy)
                : toPostData(island),
          skyCount: count,
          nextInMs: record === null ? 5 * 3_600_000 + 12 * 60_000 : null,
          streak: me.streak,
          result:
            me.result === null
              ? null
              : {
                  pieces: me.result.pieces,
                  par: me.result.par,
                  rank: me.result.rank,
                  streak: me.result.streak,
                },
          ...(record !== null && record.sunday > 0
            ? { chosenFor: record.sunday }
            : {}),
        };
        return { body };
      });
      handle('/api/progress', async (request) => {
        const fields = await readBody(request);
        const found = await islandAt(Number(fields['day']));
        if (found.ok)
          await saveProgress(
            store,
            playerOf(request),
            found.island,
            fields['placements']
          );
        return { body: { ok: true } };
      });
      handle('/api/forget', async () => {
        store = memoryStore();
        votes.clear();
        redditLog.length = 0;
        return { body: { ok: true } };
      });
      /**
       * A realistic crowd on one island, played through the real Lock in (src/server/core/crowd.ts):
       * fetch('/api/dev/crowd?day=1&players=8&seed=a') adds players p0, p1... (prefix= to rename
       * them, maker=p0 on a picked Sunday makes p0 its maker); most place the par answer. Then
       * open the game as any of them with ?user=p0.
       */
      handle('/api/dev/crowd', async (request) => {
        const asked = new URL(request.url ?? '', 'http://localhost')
          .searchParams;
        const found = await islandAt(Number(asked.get('day') ?? '1'));
        if (!found.ok) return { body: { ok: false, reason: found.reason } };
        const maker = asked.get('maker');
        const night = await seedCrowd(store, found.island, {
          players: Number(asked.get('players') ?? '8'),
          seed: asked.get('seed') ?? 'local',
          resets: Number(asked.get('resets') ?? '0'),
          tooFast: asked.get('fast') === '1',
          practiceShare: Number(asked.get('practice') ?? '0.1'),
          parShare: Number(asked.get('par') ?? '0.6'),
          boards: Number(asked.get('boards') ?? '4'),
          prefix: asked.get('prefix') ?? 'p',
          lastDay: days(),
          ...(maker === null ? {} : { maker }),
        });
        return {
          body: {
            ok: true,
            players: night.players.map((p) => ({
              username: p.username,
              ranked: p.ranked,
              kept: p.kept,
              pieces: p.board.length,
            })),
          },
        };
      });
      /**
       * A community island through the real publish flow, from a daily layout:
       * fetch('/api/dev/island?day=2&maker=mohak&name=Blossom%20Island%20%233&biome=blossom
       * &at=2026-11-25T12:00Z'). Answers its island number.
       */
      handle('/api/dev/island', async (request) => {
        const asked = new URL(request.url ?? '', 'http://localhost')
          .searchParams;
        const from = load().days[Number(asked.get('day') ?? '2') - 1];
        if (from === undefined) return { body: { ok: false } };
        const name = asked.get('maker') ?? 'you';
        const biome =
          BIOMES.find((b) => b === asked.get('biome')) ?? from.biome;
        const at = Date.parse(asked.get('at') ?? '');
        const number = await publishLocal(
          from,
          { userId: `t2_${name}`, username: name },
          asked.get('name') ?? `${name}'s isle`,
          biome,
          Number.isFinite(at) ? at : Date.now()
        );
        return { body: { ok: number !== null, day: number } };
      });
      /** Votes for a community island's post: fetch('/api/dev/score?day=1000001&score=5'). */
      handle('/api/dev/score', async (request) => {
        const day = askedDay(request);
        const score = Number(
          new URL(request.url ?? '', 'http://localhost').searchParams.get(
            'score'
          ) ?? '1'
        );
        votes.set(`t3_local${day}`, score);
        await refreshVotes(store, pickReddit, momentOf(request));
        return { body: { ok: true } };
      });
      /**
       * The Sunday pick, as the dev menu runs it (every island so far in the running):
       * fetch('/api/dev/pick?day=6'). Answers the pick's log line; /api/dev/log has the comment
       * and flair it wrote.
       */
      handle('/api/dev/pick', async (request) => {
        const report = await runPick(
          store,
          pickReddit,
          askedDay(request),
          momentOf(request),
          { ...pickOptions, dev: true, force: true }
        );
        return {
          body: { ok: true, outcome: report.outcome, line: report.line },
        };
      });
      handle('/api/dev/log', async () => ({
        body: { ok: true, log: redditLog },
      }));
      handle('/api/community', async (request) => {
        const after = Number(
          new URL(request.url ?? '', 'http://localhost').searchParams.get(
            'after'
          ) ?? 0
        );
        const shelf = await communityShelf(store, momentOf(request), after);
        return { body: shelf, status: shelf.ok ? 200 : 404 };
      });
      handle('/api/leaderboard', async (request) => {
        const day = askedDay(request);
        const scope = new URL(
          request.url ?? '',
          'http://localhost'
        ).searchParams.get('scope');
        const username = playerOf(request)?.username ?? null;
        const body: BoardResponse =
          scope === 'alltime'
            ? {
                ok: true,
                scope: 'alltime',
                ...(await readAllTime(store, username)),
              }
            : {
                ok: true,
                scope: 'day',
                ...(await readLeaderboard(store, day, username)),
              };
        return { body };
      });
      handle('/api/others', async (request) => {
        const day = askedDay(request);
        const found = await islandAt(day);
        if (!found.ok)
          return { body: { ok: false, reason: 'not-found' }, status: 404 };
        const others = await readOthers(
          store,
          playerOf(request),
          found.island,
          nowFor(found.island, request),
          days(),
          creatorOf(found)
        );
        const body: OthersResponse = others.ok
          ? { ...others, day }
          : { ok: false, reason: 'locked' };
        return { body, status: others.ok ? 200 : 403 };
      });
      handle('/api/past', async (request) => {
        const before = askedDay(request, 'before');
        const islands: PlayableIsland[] = [];
        const makers = new Map<
          number,
          { maker: string; makerAvatar: string }
        >();
        for (let day = before - 1; day >= 1; day--) {
          const found = await islandAt(day);
          if (!found.ok) continue;
          islands.push(found.island);
          const credit = madeByOf(found);
          if (credit !== undefined)
            makers.set(day, {
              maker: credit.maker,
              makerAvatar: credit.makerAvatar,
            });
        }
        const body: PastResponse = {
          ok: true,
          islands: await pastIslands(store, playerOf(request), islands, makers),
        };
        return { body };
      });
      handle('/api/island', async (request) => {
        const asked = new URL(request.url ?? '', 'http://localhost')
          .searchParams;
        const day = Number(asked.get('day') ?? '1');
        const found = await islandAt(day);
        if (!found.ok)
          return { body: { ok: false, reason: found.reason }, status: 404 };
        const { island, record } = found;
        const player = playerOf(request);
        const at = nightAt(day, request);
        const [me, count] = await Promise.all([
          playerState(store, player, day, island),
          skyCount(store, day),
        ]);
        const body: IslandResponse = {
          ok: true,
          island: toPublicIsland(
            island,
            record === null ? undefined : creditOf(record),
            madeByOf(found)
          ),
          me,
          rankedOpen:
            me.loggedIn &&
            me.result === null &&
            at.night === 'tonight' &&
            rankedOpen(day, nowFor(island, request), days(), undefined),
          skyCount: count,
          ...at,
          sharedUrl: null,
          ...(asked.get('styles') === '1' ? { stylePreview: true } : {}),
          ...(asked.get('trailer') === '1'
            ? { trailer: { solution: island.solution } }
            : {}),
        };
        return { body };
      });
      handle('/api/sky', async (request) => {
        const day = askedDay(request);
        const body: SkyResponse = {
          ok: true,
          day,
          ...(await readSky(store, day)),
        };
        return { body };
      });

      // The Island Builder: the real server code on the same store (src/server/routes/builder.ts).
      handle('/api/builder/draft', async (request) => {
        const player = playerOf(request);
        if (request.method === 'PUT') {
          const draft = readDraft((await readBody(request))['draft']);
          if (draft === null) return { body: { ok: false }, status: 400 };
          return { body: { ok: await saveDraft(store, player, draft) } };
        }
        const draft = await loadDraft(store, player);
        const user =
          player === null ? {} : await store.hGetAll(KEYS.user(player.userId));
        const body: BuilderDraftResponse = {
          ok: true,
          loggedIn: player !== null,
          draft,
          status:
            draft === null
              ? { checked: null, tested: null }
              : await islandStatus(store, player, draft),
          tutorialDone: user['builderTutorial'] === '1',
        };
        return { body };
      });
      handle('/api/builder/check', async (request) => {
        const player = playerOf(request);
        if (player === null)
          return { body: { ok: false, problem: 'signed-out' } };
        const draft = readDraft((await readBody(request))['draft']);
        if (draft === null)
          return { body: { ok: false, problem: 'malformed' }, status: 400 };
        if (!(await takeCheckTurn(store, player)))
          return { body: { ok: false, problem: 'slow-down' } };
        const outcome = checkIsland(draft, {
          daily: dailyHashes(),
          clock: () => performance.now(),
        });
        if (!outcome.ok)
          return { body: { ok: false, problem: outcome.problem } };
        await recordCheck(store, player, draft, outcome);
        const body: BuilderCheckResponse = {
          ok: true,
          par: outcome.par,
          inventory: outcome.inventory,
          difficulty: outcome.difficulty,
          label: outcome.label,
        };
        return { body };
      });
      handle('/api/builder/test-start', async (request) => {
        const player = playerOf(request);
        const draft = readDraft((await readBody(request))['draft']);
        const started =
          player === null || draft === null
            ? 'not-checked'
            : await startTest(store, player, draft, Date.now());
        const body: BuilderTestStartResponse =
          started === 'started'
            ? { ok: true }
            : { ok: false, problem: 'not-checked' };
        return { body };
      });
      handle('/api/builder/test-solve', async (request) => {
        const player = playerOf(request);
        if (player === null)
          return { body: { ok: false, problem: 'signed-out' } };
        const fields = await readBody(request);
        const draft = readDraft(fields['draft']);
        if (draft === null) return { body: { ok: false, problem: 'changed' } };
        const body: BuilderTestResponse = await finishTest(
          store,
          player,
          draft,
          fields['placements'],
          Date.now()
        );
        return { body };
      });
      handle('/api/builder/publish', async (request) => {
        const fields = await readBody(request);
        const body: BuilderPublishResponse = await publishIsland(
          store,
          playerOf(request),
          {
            draft: fields['draft'],
            token: fields['token'],
            avatar: '',
            nowMs: Date.now(),
          },
          { poster: localPoster, daily: dailyHashes(), clock: () => 0 }
        );
        // A real publish takes a moment (check, post, comment): so does this one.
        await new Promise((done) => setTimeout(done, 700));
        return { body };
      });
      handle('/api/builder/mine', async (request) => {
        const player = playerOf(request);
        const body: BuilderMineResponse = {
          ok: true,
          loggedIn: player !== null,
          islands: await listMine(store, player),
        };
        return { body };
      });
      handle('/api/builder/tutorial-done', async (request) => {
        const player = playerOf(request);
        if (player !== null)
          await store.hSet(KEYS.user(player.userId), { builderTutorial: '1' });
        return { body: { ok: true } };
      });

      handle('/api/start', async (request) => {
        const fields = await readBody(request);
        const found = await islandAt(Number(fields['day']));
        if (found.ok)
          await recordStart(
            store,
            playerOf(request),
            found.island.day,
            nowFor(found.island, request)
          );
        return { body: { ok: true } };
      });
      handle('/api/rule-seen', async (request) => {
        const rule = (await readBody(request))['rule'];
        if (rule === 'sky' || isRuleKind(rule))
          await markRuleSeen(store, playerOf(request), rule);
        return { body: { ok: true } };
      });
      handle('/api/tutorial-done', async (request) => {
        await markTutorialDone(store, playerOf(request));
        return { body: { ok: true } };
      });
      // The real Lock in: the server re-traces the pieces, times it from /api/start, ranks it.
      handle('/api/lock-in', async (request) => {
        const fields = await readBody(request);
        const found = await islandAt(Number(fields['day']));
        if (!found.ok) return { body: { ok: false, reason: 'not-found' } };
        const makerId = found.pick?.winner?.credit.makerId;
        const outcome = await lockIn(
          store,
          playerOf(request),
          {
            island: found.island,
            placements: fields['placements'],
            snoovatar: fields['snoovatar'],
            wantsRanked: fields['ranked'] !== false,
            postDay: found.island.day,
            lastDay: days(),
            nowMs: nowFor(found.island, request),
            ...(makerId === undefined ? {} : { makerId }),
          },
          { onRanked: async () => undefined }
        );
        const body: LockInResponse = outcome.ok
          ? { ok: true, ...outcome.result }
          : { ok: false, reason: outcome.reason };
        return { body };
      });
    },
  };
}

export default defineConfig({
  root: 'src/client',
  publicDir: '../../content',
  plugins: [localApi()],
  server: { port: 5199, open: '/debug.html', fs: { allow: ['../..'] } },
});
