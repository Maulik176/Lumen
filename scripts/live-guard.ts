/**
 * `npm run dev` starts `devvit playtest`, which uploads on every save. Before launch that is the
 * point. After launch r/lumen_game_dev is where players and judges play, so every upload is live:
 * the watcher refuses to start unless the release script runs it (docs/LAUNCH.md).
 */
import { LAUNCH } from '../src/shared/config';

if (LAUNCH.launched && process.env['LUMEN_RELEASE'] !== '1') {
  console.error(
    'Lumen has launched: a playtest watcher would upload every save, live for players and ' +
      'judges. Use `npm run release` (docs/LAUNCH.md, "Release routine").'
  );
  process.exit(1);
}
