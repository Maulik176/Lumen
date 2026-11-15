import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { telemetry } from '@devvit/analytics/server/reddit';
import { TELEMETRY_DEFAULT_CLIENT_BASE_PATH } from '@devvit/analytics/shared/reddit';
import { refreshClock } from './core/clock';
import { api } from './routes/api';
import { journeyRoutes } from './routes/journey';
import { forms } from './routes/forms';
import { menu } from './routes/menu';
import { scheduler, triggers } from './routes/triggers';

const app = new Hono();
// The clock is real time everywhere but the playtest subreddit; see core/clock.ts.
app.use('*', async (_c, next) => {
  await refreshClock();
  await next();
});
const internal = new Hono();

internal.route('/menu', menu);
internal.route('/form', forms);
internal.route('/triggers', triggers);
internal.route('/scheduler', scheduler);

// Journeys first: its routes sit under /api/telemetry, inside /api.
app.route(TELEMETRY_DEFAULT_CLIENT_BASE_PATH, journeyRoutes(telemetry));
app.route('/api', api);
app.route('/internal', internal);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
