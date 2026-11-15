import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = new URL('../dist/', import.meta.url);

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await build({
  absWorkingDir: root,
  entryPoints: ['public/lib/subjects-graph/index.js', 'public/lib/subjects-graph/core.js'],
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  external: ['cytoscape'],
});
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.lib.json'], {
  cwd: root,
  stdio: 'inherit',
});
await copyFile(new URL('../public/lib/subjects-graph/styles.css', import.meta.url), new URL('styles.css', dist));
await writeFile(new URL('package.json', dist), JSON.stringify({ type: 'module' }) + '\n');
