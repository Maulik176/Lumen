import { describe, expect, it } from 'vitest';
import { journeyRoutes, type JourneyServer } from './journey';

const receipt = {
  status: 'JOURNEY_RECEIPT_DENIED_PLAYTEST',
  message: 'playtest',
} as const;

function stub(): { server: JourneyServer; sent: unknown[] } {
  const sent: unknown[] = [];
  const server: JourneyServer = {
    async startJourney() {
      sent.push('start');
      return { journeyId: 'j-1', receipt };
    },
    async journeyProgress(request) {
      sent.push(request);
      return { receipt };
    },
    async journeyInteraction(request) {
      sent.push(request);
      return { receipt };
    },
    async endJourney(request) {
      sent.push(request);
      return { receipt };
    },
    async appReady() {
      sent.push('ready');
      return { receipt };
    },
  };
  return { server, sent };
}

const post = (path: string, body?: unknown): Request =>
  new Request(`http://local${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

describe('journey routes', () => {
  it('pass on the fixed words from JOURNEY_MAP.md', async () => {
    const { server, sent } = stub();
    const routes = journeyRoutes(server);
    expect((await routes.fetch(post('/journey/app-ready'))).status).toBe(200);
    const start = await routes.fetch(post('/journey/start'));
    expect(await start.json()).toEqual({ journeyId: 'j-1', receipt });
    await routes.fetch(
      post('/journey/progress', {
        journeyId: 'j-1',
        progress: 0.5,
        action: 'lantern_lit',
        actionDetails: 'ranked',
      })
    );
    await routes.fetch(
      post('/journey/interaction', {
        action: 'rotate',
        actionDetails: 'archive',
      })
    );
    await routes.fetch(post('/journey/end', { journeyId: 'j-1' }));
    expect(sent).toEqual([
      'ready',
      'start',
      {
        journeyId: 'j-1',
        progress: 0.5,
        action: 'lantern_lit',
        actionDetails: 'ranked',
      },
      { journeyId: '', action: 'rotate', actionDetails: 'archive' },
      { journeyId: 'j-1', complete: false },
    ]);
  });

  it('refuse anything else, and a completed end from the client', async () => {
    const { server, sent } = stub();
    const routes = journeyRoutes(server);
    const refused = [
      post('/journey/interaction', {
        action: 'u/someone',
        actionDetails: 'ranked',
      }),
      post('/journey/interaction', {
        action: 'undo',
        actionDetails: 'free text',
      }),
      post('/journey/progress', {
        journeyId: 'j-1',
        progress: 2,
        action: 'lantern_lit',
        actionDetails: 'ranked',
      }),
      post('/journey/end', {
        journeyId: 'j-1',
        complete: true,
        game: { win: true, score: 1 },
      }),
    ];
    for (const request of refused)
      expect((await routes.fetch(request)).status).toBe(400);
    expect(sent).toEqual([]);
  });
});
