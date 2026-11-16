import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseTag, prepareRelease } from './prepare-release.mjs';

/** @param {string} a @param {string} b */
function compare(a, b) {
  const left = a.split('-')[0].split('.').map(BigInt);
  const right = b.split('-')[0].split('.').map(BigInt);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  return a.includes('-') ? -1 : 0;
}

/** Commit versions on the current release checkout. @param {string} tag @param {string} [cwd] */
export function commitRelease(tag, cwd = process.cwd()) {
  const { version, dist_tag } = parseTag(tag);
  if (dist_tag !== 'latest') return false;
  const git = (/** @type {string[]} */ args) => execFileSync('git', args, { cwd, encoding: 'utf8' });
  const versions = ['package.json', 'packages/angular/package.json'].map(path => JSON.parse(readFileSync(resolve(cwd, path), 'utf8')).version);
  if (versions.some(current => compare(current, version) > 0)) return false;
  const files = ['package.json', 'packages/angular/package.json'];
  /** @type {Map<string, string>} */
  const updates = new Map();
  /** @param {string} dir */
  function update(dir) {
    for (const entry of readdirSync(resolve(cwd, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory() && !['node_modules', 'dist', '.angular'].includes(entry.name)) update(path);
      else if (entry.isFile() && /\.(md|html|js)$/.test(path)) {
        const before = readFileSync(resolve(cwd, path), 'utf8');
        const after = before.replace(/(@raniagus\/subjects-graph(?:-angular)?@)\d+\.\d+\.\d+(?:-[\w.-]+)?/g, `$1${version}`)
          .replace(/(disponibilidad de )\d+\.\d+\.\d+(?:-[\w.-]+)?( en npm)/g, `$1${version}$2`)
          .replace(/(compatible con `)\d+\.\d+\.\d+(`)/g, `$1${version}$2`);
        for (const ref of before.matchAll(/@raniagus\/subjects-graph(?:-angular)?@(\d+\.\d+\.\d+(?:-[\w.-]+)?)/g)) {
          if (compare(ref[1], version) > 0) throw new Error(`Refusing to downgrade ${path}: ${ref[1]}`);
        }
        if (after !== before) updates.set(path, after);
      }
    }
  }
  for (const dir of ['docs', 'examples', 'packages/angular']) update(dir);
  const before = readFileSync(resolve(cwd, 'README.md'), 'utf8');
  const after = before.replace(/(@raniagus\/subjects-graph(?:-angular)?@)\d+\.\d+\.\d+(?:-[\w.-]+)?/g, `$1${version}`);
  for (const ref of before.matchAll(/@raniagus\/subjects-graph(?:-angular)?@(\d+\.\d+\.\d+(?:-[\w.-]+)?)/g)) {
    if (compare(ref[1], version) > 0) throw new Error(`Refusing to downgrade README.md: ${ref[1]}`);
  }
  if (after !== before) updates.set('README.md', after);
  prepareRelease(tag, cwd);
  for (const [path, text] of updates) { writeFileSync(resolve(cwd, path), text); files.push(path); }
  // Workspace links mean version/peer changes do not alter this pnpm lockfile.
  git(['add', '--', ...files]);
  if (!git(['diff', '--cached', '--name-only']).trim()) return false;
  git(['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com', 'commit', '-m', `chore: release ${tag}`]);
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) commitRelease(process.env.RELEASE_TAG ?? '');
