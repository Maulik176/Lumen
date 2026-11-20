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
  type CardResponse,
  type CommunityCredit,
  type BoardResponse,
  type OthersResponse,
  type IslandResponse,
  type LockInResponse,
  type OtherIsland,
  type PastResponse,
  type SkyResponse,
} from './src/shared/api';
import type { Placement } from './src/shared/types';
import { BIOMES, COMMUNITY } from './src/shared/config';
import {
  fallbackName,
  isCommunity,
  nameFiltered,
} from './src/shared/community';
import {
  readDailyFile,
  type DailyIsland,
  type PlayableIsland,
} from './src/shared/daily';
import { validatePlacements } from './src/shared/validate';

import { readDraft } from './src/shared/builder';
import { checkIsland, dailyHashes } from './src/server/core/check';
import {
  checkKey,
  draftPuzzleText,
  nameProblem,
  type DifficultyLabel,
  type IslandDraft,
} from './src/shared/builder';
import { puzzleFromText } from './src/shared/puzzle-text';
import { isRuleKind } from './src/shared/rules';
import { trace } from './src/shared/trace';
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
import { KEYS } from './src/server/core/store';

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
  /** Islands published locally, served as community islands (numbers from numberBase up). */
  const localIslands: {
    index: number;
    draft: IslandDraft;
    par: number;
    label: DifficultyLabel;
    inventory: { mirrors: number; prisms: number };
    creatorPieces: number;
    solution: Placement[];
    created: number;
    maker: string;
  }[] = [];
  /** A day, the hero island, or a community island published here. */
  const islandAt = (
    day: number
  ):
    | { island: PlayableIsland; credit: CommunityCredit | undefined }
    | undefined => {
    if (isCommunity(day)) {
      const local = localIslands[day - COMMUNITY.numberBase - 1];
      if (local === undefined) return undefined;
      const { draft } = local;
      return {
        island: {
          day,
          date: '2026-11-25',
          weekday: 'wednesday',
          biome: draft.biome,
          name: draft.name,
          rows: draft.rows,
          inventory: local.inventory,
          sourceColours: draftPuzzleText(draft, local.inventory).sourceColours,
          par: local.par,
          solution: local.solution,
        },
        credit: { maker: local.maker, makerAvatar: '', label: local.label },
      };
    }
    const island =
      day >= 900 && day < 900 + BIOMES.length
        ? heroIsland(day)
        : load().days[day - 1];
    return island === undefined ? undefined : { island, credit: undefined };
  };
  return {
    name: 'lumen-local-api',
    configureServer(server) {
      const reply = (
        response: import('node:http').ServerResponse,
        body: unknown
      ): void => {
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(body));
      };
      const askedDay = (request: IncomingMessage, name = 'day'): number =>
        Number(
          new URL(request.url ?? '', 'http://localhost').searchParams.get(
            name
          ) ?? '1'
        );
      /** On a community island made here: the maker's own test, pinned first in the list. */
      const creatorOf = (day: number): OtherIsland | null => {
        if (!isCommunity(day)) return null;
        const local = localIslands[day - COMMUNITY.numberBase - 1];
        if (local === undefined) return null;
        return {
          rank: null,
          username: local.maker,
          snoovatar: '',
          pieces: local.creatorPieces,
          timeMs: 52_000,
          placements: local.solution,
        };
      };
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

      server.middlewares.use('/api/card', (request, response) => {
        const day = askedDay(request);
        const found = islandAt(day);
        if (found === undefined)
          return reply(response, { ok: false, reason: 'not-found' });
        const { island, credit } = found;
        void Promise.all([
          playerState(store, playerOf(request), day),
          skyCount(store, day),
        ]).then(([me, count]) => {
          const body: CardResponse = {
            ok: true,
            ...nightAt(day, request),
            post:
              credit === undefined
                ? toPostData(island)
                : toCommunityPostData(island, credit),
            skyCount: count,
            nextInMs: credit === undefined ? 5 * 3_600_000 + 12 * 60_000 : null,
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
          };
          reply(response, body);
        });
      });
      server.middlewares.use('/api/progress', (request, response) => {
        void readBody(request).then(async (fields) => {
          const island = islandAt(Number(fields['day']))?.island;
          if (island !== undefined)
            await saveProgress(
              store,
              playerOf(request),
              island,
              fields['placements']
            );
          reply(response, { ok: true });
        });
      });
      server.middlewares.use('/api/forget', (_request, response) => {
        store = memoryStore();
        reply(response, { ok: true });
      });
      /**
       * A realistic crowd on one island, played through the real Lock in (src/server/core/crowd.ts):
       * fetch('/api/dev/crowd?day=1&players=8&seed=a') adds players p0, p1... (prefix= to rename
       * them); most place the par answer. Then open the game as any of them with ?user=p0.
       */
      server.middlewares.use('/api/dev/crowd', (request, response) => {
        const asked = new URL(request.url ?? '', 'http://localhost')
          .searchParams;
        const island = islandAt(Number(asked.get('day') ?? '1'))?.island;
        if (island === undefined)
          return reply(response, { ok: false, reason: 'not-found' });
        void seedCrowd(store, island, {
          players: Number(asked.get('players') ?? '8'),
          seed: asked.get('seed') ?? 'local',
          resets: Number(asked.get('resets') ?? '0'),
          tooFast: asked.get('fast') === '1',
          practiceShare: Number(asked.get('practice') ?? '0.1'),
          parShare: Number(asked.get('par') ?? '0.6'),
          prefix: asked.get('prefix') ?? 'p',
          lastDay: days(),
        }).then((night) =>
          reply(response, {
            ok: true,
            players: night.players.map((p) => ({
              username: p.username,
              ranked: p.ranked,
              pieces: p.board.length,
            })),
          })
        );
      });
      /**
       * A community island made here without the Builder, for checks that need one quickly:
       * fetch('/api/dev/island?day=2&maker=mohak&name=Blossom%20Island%20%233') serves day 2's
       * island as a community island by u/mohak. Answers its island number.
       */
      server.middlewares.use('/api/dev/island', (request, response) => {
        const asked = new URL(request.url ?? '', 'http://localhost').searchParams;
        const from = load().days[Number(asked.get('day') ?? '2') - 1];
        if (from === undefined)
          return reply(response, { ok: false, reason: 'not-found' });
        const index = localIslands.length + 1;
        const biome = asked.get('biome');
        localIslands.push({
          index,
          created: Date.now(),
          solution: from.solution,
          draft: {
            size: from.rows.length,
            biome: BIOMES.find((b) => b === biome) ?? from.biome,
            name: asked.get('name') ?? fallbackName(from.biome, index),
            spare: 0,
            rows: from.rows,
          },
          par: from.par,
          label: 'gentle',
          inventory: from.inventory,
          creatorPieces: from.par,
          maker: asked.get('maker') ?? 'you',
        });
        reply(response, { ok: true, day: COMMUNITY.numberBase + index });
      });
      server.middlewares.use('/api/leaderboard', (request, response) => {
        const day = askedDay(request);
        const scope = new URL(
          request.url ?? '',
          'http://localhost'
        ).searchParams.get('scope');
        const username = playerOf(request)?.username ?? null;
        void (
          scope === 'alltime'
            ? readAllTime(store, username).then((board): BoardResponse => ({
                ok: true,
                scope: 'alltime',
                ...board,
              }))
            : readLeaderboard(store, day, username).then(
                (board): BoardResponse => ({ ok: true, scope: 'day', ...board })
              )
        ).then((body) => reply(response, body));
      });
      server.middlewares.use('/api/others', (request, response) => {
        const day = askedDay(request);
        const island = islandAt(day)?.island;
        if (island === undefined)
          return reply(response, { ok: false, reason: 'not-found' });
        void readOthers(
          store,
          playerOf(request),
          island,
          nowFor(island, request),
          days(),
          creatorOf(day)
        ).then((others) => {
          const body: OthersResponse = others.ok
            ? { ...others, day }
            : { ok: false, reason: 'locked' };
          reply(response, body);
        });
      });
      server.middlewares.use('/api/past', (request, response) => {
        const before = askedDay(request, 'before');
        const islands = load()
          .days.filter((island) => island.day < before)
          .reverse();
        void pastIslands(store, playerOf(request), islands).then((list) => {
          const body: PastResponse = { ok: true, islands: list };
          reply(response, body);
        });
      });
      server.middlewares.use('/api/island', (request, response) => {
        const asked = new URL(request.url ?? '', 'http://localhost')
          .searchParams;
        const day = Number(asked.get('day') ?? '1');
        // Days 900 to 904 are the hand-made hero island, one per biome (see scripts/hero.mjs).
        const found = islandAt(day);
        if (found === undefined)
          return reply(response, { ok: false, reason: 'not-found' });
        const { island, credit } = found;
        const player = playerOf(request);
        const at = nightAt(day, request);
        void Promise.all([
          playerState(store, player, day, island),
          skyCount(store, day),
        ]).then(([me, count]) => {
          const body: IslandResponse = {
            ok: true,
            island: toPublicIsland(island, credit),
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
          reply(response, body);
        });
      });
      server.middlewares.use('/api/sky', (request, response) => {
        const day = askedDay(request);
        void readSky(store, day).then((sky) => {
          const body: SkyResponse = { ok: true, day, ...sky };
          reply(response, body);
        });
      });
      // The Island Builder, with the real check and test proof on an in-memory store. The local
      // player is signed in as "you". ?signedout=1 on the page is not modelled here.
      // The local player is signed in. The check is the server's own; the test proof is kept here.
      let builderDraft: unknown = null;
      let builderTutorial = false;
      let builderChecked: {
        key: string;
        par: number;
        label: string;
        inventory: { mirrors: number; prisms: number };
        tested: number | null;
      } | null = null;
      const send = (
        response: import('node:http').ServerResponse,
        body: unknown
      ): void => {
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify(body));
      };
      server.middlewares.use('/api/builder/draft', (request, response) => {
        if (request.method === 'PUT') {
          void readBody(request).then((body) => {
            const draft = readDraft(body['draft']);
            if (draft !== null) builderDraft = draft;
            send(response, { ok: draft !== null });
          });
          return;
        }
        const draft = readDraft(builderDraft);
        const same =
          draft !== null &&
          builderChecked !== null &&
          checkKey(draft) === builderChecked.key;
        send(response, {
          ok: true,
          loggedIn: true,
          draft,
          status: {
            checked:
              same && builderChecked !== null
                ? {
                    par: builderChecked.par,
                    inventory: builderChecked.inventory,
                    label: builderChecked.label,
                  }
                : null,
            tested:
              same && builderChecked?.tested != null
                ? { pieces: builderChecked.tested }
                : null,
          },
          tutorialDone: builderTutorial,
        });
      });
      server.middlewares.use('/api/builder/check', (request, response) => {
        void readBody(request).then((body) => {
          const draft = readDraft(body['draft']);
          if (draft === null)
            return send(response, { ok: false, problem: 'malformed' });
          const outcome = checkIsland(draft, {
            daily: dailyHashes(),
            clock: () => performance.now(),
          });
          console.log(
            `[builder] check ${draft.size}x${draft.size}: ${outcome.ok ? `par ${outcome.par}` : outcome.problem}, ${outcome.nodes} nodes, ${Math.round(outcome.ms)} ms`
          );
          if (!outcome.ok)
            return send(response, { ok: false, problem: outcome.problem });
          builderChecked = {
            key: checkKey(draft),
            par: outcome.par,
            label: outcome.label,
            inventory: outcome.inventory,
            tested: null,
          };
          send(response, {
            ok: true,
            par: outcome.par,
            inventory: outcome.inventory,
            difficulty: outcome.difficulty,
            label: outcome.label,
          });
        });
      });
      server.middlewares.use('/api/builder/test-start', (request, response) => {
        void readBody(request).then((body) => {
          const draft = readDraft(body['draft']);
          const ok =
            draft !== null &&
            builderChecked !== null &&
            checkKey(draft) === builderChecked.key;
          if (ok && builderChecked !== null) builderChecked.tested = null;
          send(response, ok ? { ok } : { ok, problem: 'not-checked' });
        });
      });
      server.middlewares.use('/api/builder/test-solve', (request, response) => {
        void readBody(request).then((body) => {
          const draft = readDraft(body['draft']);
          if (
            draft === null ||
            builderChecked === null ||
            checkKey(draft) !== builderChecked.key
          )
            return send(response, { ok: false, problem: 'changed' });
          const puzzle = puzzleFromText(
            draftPuzzleText(draft, builderChecked.inventory)
          );
          const check = validatePlacements(puzzle, body['placements']);
          if (!check.ok)
            return send(response, { ok: false, problem: 'bad-pieces' });
          if (!trace(puzzle, check.placements).solved)
            return send(response, { ok: false, problem: 'not-lit' });
          builderChecked.tested = check.placements.length;
          send(response, { ok: true, pieces: check.placements.length, ms: 0 });
        });
      });
      // Publishing, locally: the island joins a list served as a community island at
      // /game.html?day=<COMMUNITY.numberBase + k>; `?user=name` plays it as someone else.
      const tokens = new Map<string, unknown>();
      server.middlewares.use('/api/builder/publish', (request, response) => {
        void readBody(request).then((body) => {
          const token = String(body['token'] ?? '');
          const earlier = tokens.get(token);
          if (earlier !== undefined) return send(response, earlier);
          const draft = readDraft(body['draft']);
          if (
            draft === null ||
            builderChecked === null ||
            checkKey(draft) !== builderChecked.key
          )
            return send(response, { ok: false, problem: 'not-checked' });
          if (builderChecked.tested === null)
            return send(response, { ok: false, problem: 'not-tested' });
          const name = draft.name.trim();
          if (name !== '' && (nameProblem(name) !== null || nameFiltered(name)))
            return send(response, { ok: false, problem: 'name' });
          const index = localIslands.length + 1;
          const label = builderChecked.label;
          const rechecked = checkIsland(draft, {
            daily: dailyHashes(),
            clock: () => performance.now(),
          });
          localIslands.push({
            index,
            created: Date.now(),
            solution: rechecked.ok ? rechecked.solution : [],
            draft: { ...draft, name: name || fallbackName(draft.biome, index) },
            par: builderChecked.par,
            label:
              label === 'tricky' || label === 'fiendish' ? label : 'gentle',
            inventory: builderChecked.inventory,
            creatorPieces: builderChecked.tested,
            maker: playerOf(request)?.username ?? 'you',
          });
          const answer = {
            ok: true,
            postId: `t3_local${index}`,
            permalink: `/r/lumen_game_dev/comments/local${index}/`,
            url: `http://localhost:5199/game.html?day=${COMMUNITY.numberBase + index}`,
          };
          tokens.set(token, answer);
          builderDraft = null;
          builderChecked = null;
          // A real publish takes a moment (check, post, comment): so does this one.
          setTimeout(() => send(response, answer), 700);
        });
      });
      // Your islands: the maker's own, with real plays and par hits from the store.
      server.middlewares.use('/api/builder/mine', (request, response) => {
        const maker = playerOf(request)?.username ?? null;
        const mine = localIslands.filter((island) => island.maker === maker);
        void Promise.all(
          mine.map(async (island) => {
            const number = COMMUNITY.numberBase + island.index;
            const [plays, stats] = await Promise.all([
              skyCount(store, number),
              store.hGetAll(KEYS.stats(number)),
            ]);
            return {
              name: island.draft.name,
              biome: island.draft.biome,
              rows: island.draft.rows,
              created: island.created,
              plays,
              parHits: Math.min(plays, Number(stats['parHits'] ?? 0) || 0),
              active: true,
              url: `http://localhost:5199/game.html?day=${number}`,
            };
          })
        ).then((islands) =>
          send(response, {
            ok: true,
            loggedIn: maker !== null,
            islands: islands.reverse(),
          })
        );
      });
      server.middlewares.use(
        '/api/builder/tutorial-done',
        (_request, response) => {
          builderTutorial = true;
          send(response, { ok: true });
        }
      );
      server.middlewares.use('/api/start', (request, response) => {
        void readBody(request).then(async (fields) => {
          const island = islandAt(Number(fields['day']))?.island;
          if (island !== undefined)
            await recordStart(
              store,
              playerOf(request),
              island.day,
              nowFor(island, request)
            );
          reply(response, { ok: true });
        });
      });
      server.middlewares.use('/api/rule-seen', (request, response) => {
        void readBody(request).then(async (fields) => {
          const rule = fields['rule'];
          if (rule === 'sky' || isRuleKind(rule))
            await markRuleSeen(store, playerOf(request), rule);
          reply(response, { ok: true });
        });
      });
      server.middlewares.use('/api/tutorial-done', (request, response) => {
        void markTutorialDone(store, playerOf(request)).then(() =>
          reply(response, { ok: true })
        );
      });
      // The real Lock in: the server re-traces the pieces, times it from /api/start, ranks it.
      server.middlewares.use('/api/lock-in', (request, response) => {
        void readBody(request).then(async (fields) => {
          const island = islandAt(Number(fields['day']))?.island;
          if (island === undefined)
            return reply(response, { ok: false, reason: 'not-found' });
          const outcome = await lockIn(
            store,
            playerOf(request),
            {
              island,
              placements: fields['placements'],
              snoovatar: fields['snoovatar'],
              wantsRanked: fields['ranked'] !== false,
              postDay: island.day,
              lastDay: days(),
              nowMs: nowFor(island, request),
            },
            { onRanked: async () => undefined }
          );
          const body: LockInResponse = outcome.ok
            ? { ok: true, ...outcome.result }
            : { ok: false, reason: outcome.reason };
          reply(response, body);
        });
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
