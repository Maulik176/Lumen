import { defineConfig, type Plugin } from 'vite';
import { devvit } from '@devvit/start/vite';

/**
 * During playtest, scripts/dev-build.ts sets LUMEN_STAGE_DIR so the watch build writes into a
 * staging folder; only a build that passes the check is copied into dist/. (Vite empties its
 * output folder on every rebuild, and playtest would otherwise upload that empty moment.)
 * Runs after the devvit plugin so its output folders are the ones replaced.
 */
function stageOutput(): Plugin {
  return {
    name: 'lumen-stage-output',
    enforce: 'post',
    config() {
      const stage = process.env['LUMEN_STAGE_DIR'];
      if (stage === undefined || stage === '') return;
      return {
        environments: {
          client: { build: { outDir: `${stage}/client`, emptyOutDir: true } },
          server: { build: { outDir: `${stage}/server`, emptyOutDir: true } },
        },
      };
    },
  };
}

export default defineConfig({
  plugins: [devvit(), stageOutput()],
});
