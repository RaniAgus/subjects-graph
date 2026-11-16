import { afterEach, beforeEach, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { prepareRelease, parseTag } from '../scripts/prepare-release.mjs';
import { commitRelease } from '../scripts/commit-release.mjs';
import { publishRelease } from '../scripts/publish-release.mjs';

let fixture = '';
/** @param {string} path */
const read = path => readFileSync(resolve(fixture, path), 'utf8');
/** @param {string} path @param {string} text */
const write = (path, text) => writeFileSync(resolve(fixture, path), text);
/** @param {string[]} args */
const git = args => execFileSync('git', args, { cwd: fixture, encoding: 'utf8' });
beforeEach(() => {
  fixture = mkdtempSync(resolve(tmpdir(), 'joint-release-'));
  for (const dir of ['packages/angular', 'docs', 'examples/cdn']) mkdirSync(resolve(fixture, dir), { recursive: true });
  write('package.json', JSON.stringify({ name: '@raniagus/subjects-graph', version: '0.1.1' }));
  write('packages/angular/package.json', JSON.stringify({ name: '@raniagus/subjects-graph-angular', version: '0.1.0', peerDependencies: { '@raniagus/subjects-graph': '^0.1.1' }, devDependencies: { '@raniagus/subjects-graph': 'workspace:*' } }));
  write('README.md', '@raniagus/subjects-graph@0.1.1');
  write('examples/cdn/index.html', 'imports @raniagus/subjects-graph@0.1.0/dist/index.js CSS @raniagus/subjects-graph@0.1.0/dist/styles.css disponibilidad de 0.1.0 en npm');
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.name', 'Test']); git(['config', 'user.email', 'test@example.invalid']);
  git(['add', '.']); git(['commit', '-qm', 'initial']);
});
afterEach(() => rmSync(fixture, { recursive: true, force: true }));
it.each(['v0.2.0', 'v0.2.0-alpha.1', 'v1.2.3+build.4'])('synchronizes %s and preserves workspace links', tag => {
  const result = prepareRelease(tag, fixture);
  const core = JSON.parse(read('package.json'));
  const angular = JSON.parse(read('packages/angular/package.json'));
  expect(core.version).toBe(result.version);
  expect(angular.version).toBe(result.version);
  expect(angular.peerDependencies[core.name]).toBe(`^${result.version}`);
  expect(angular.devDependencies[core.name]).toBe('workspace:*');
  expect(result.dist_tag).toBe(tag.includes('-') ? 'next' : 'latest');
});
it.each(['', '0.2.0', 'angular-v0.2.0', 'v1', 'v1.2', 'v01.2.3', 'v1.02.3', 'v1.2.03', 'v1.2.3-01', 'v1.2.3-a.01', 'v1.2.3-a..1', 'v1.2.3+', 'v1.2.3\n', 'v1.2.3;touch injected'])('rejects %j without partial writes', tag => {
  const before = [read('package.json'), read('packages/angular/package.json')];
  expect(() => prepareRelease(tag, fixture)).toThrow();
  expect([read('package.json'), read('packages/angular/package.json')]).toEqual(before);
});
it('reads both manifests before any mutation', () => {
  write('packages/angular/package.json', 'broken');
  const before = read('package.json');
  expect(() => prepareRelease('v0.2.0', fixture)).toThrow(); expect(read('package.json')).toBe(before);
});
it('commits stable versions on latest main preserving later changes and all references', () => {
  git(['tag', 'v0.2.0']); write('docs/later.md', 'later main change'); git(['add', '.']); git(['commit', '-qm', 'later']);
  const parent = git(['rev-parse', 'HEAD']).trim();
  expect(commitRelease('v0.2.0', fixture)).toBe(true);
  expect(git(['rev-parse', 'HEAD^']).trim()).toBe(parent);
  expect(git(['log', '-1', '--format=%s']).trim()).toBe('chore: release v0.2.0');
  expect(read('docs/later.md')).toBe('later main change');
  expect(read('examples/cdn/index.html').match(/0\.2\.0/g)).toHaveLength(3);
  expect(read('README.md')).toContain('@0.2.0');
  expect(commitRelease('v0.1.9', fixture)).toBe(false);
  expect(commitRelease('v0.2.0', fixture)).toBe(false);
});
it('never commits prereleases', () => {
  const head = git(['rev-parse', 'HEAD']);
  expect(commitRelease('v0.2.0-alpha.1', fixture)).toBe(false);
  expect(git(['rev-parse', 'HEAD'])).toBe(head); expect(git(['status', '--porcelain'])).toBe('');
});
it('handles partial publication, failures and mismatched retries', () => {
  const sha = git(['rev-parse', 'HEAD']).trim();
  prepareRelease('v0.2.0', fixture, sha);
  const archives = ['core.tgz', 'angular.tgz'].map((name, i) => {
    const dir = resolve(fixture, `pack${i}`); mkdirSync(resolve(dir, 'package'), { recursive: true });
    writeFileSync(resolve(dir, 'package/package.json'), read(i ? 'packages/angular/package.json' : 'package.json'));
    const archive = resolve(fixture, name); execFileSync('tar', ['-czf', archive, '-C', dir, 'package']); return archive;
  });
  const head = git(['rev-parse', 'HEAD']);
  /** @type {Record<string, {version: string, gitHead: string}>} */
  const registry = {};
  /** @type {string[]} */
  const published = [];
  const names = ['@raniagus/subjects-graph', '@raniagus/subjects-graph-angular'];
  const io = {
    lookup: (/** @type {string} */ spec) => registry[spec],
    publish: (/** @type {string} */ archive) => {
      if (archive === archives[1]) throw new Error('npm failed');
      published.push(archive); registry[`${names[0]}@0.2.0`] = { version: '0.2.0', gitHead: sha };
    },
  };
  expect(() => publishRelease('v0.2.0', sha, archives, io)).toThrow('npm failed');
  expect(git(['rev-parse', 'HEAD'])).toBe(head);
  publishRelease('v0.2.0', sha, archives, { ...io, publish: archive => { published.push(archive); } });
  expect(published).toEqual(archives);
  registry[`${names[0]}@0.2.0`].gitHead = 'different';
  expect(() => publishRelease('v0.2.0', sha, archives, io)).toThrow('does not match');
  expect(() => publishRelease('v0.2.0', sha, archives.toReversed(), io)).toThrow('Invalid packed manifest');
  expect(() => publishRelease('v0.2.0', sha, archives, { ...io, lookup: () => { throw new Error('registry unavailable'); } })).toThrow('registry unavailable');
  registry[`${names[0]}@0.2.0`].gitHead = sha;
  registry[`${names[1]}@0.2.0`] = { version: '0.2.0', gitHead: sha };
  publishRelease('v0.2.0', sha, archives, { ...io, publish: () => { throw new Error('must skip existing versions'); } });
  expect(parseTag('v0.2.0-alpha.1').dist_tag).toBe('next');
});
it('does not downgrade newer documentation even when manifests lag', () => {
  write('README.md', '@raniagus/subjects-graph@0.4.0');
  const before = read('package.json');
  expect(() => commitRelease('v0.2.0', fixture)).toThrow('Refusing to downgrade');
  expect(read('package.json')).toBe(before);
  expect(read('README.md')).toContain('@0.4.0');
});
it('ignores generated files and dependency trees while updating source references', () => {
  mkdirSync(resolve(fixture, 'packages/angular/node_modules'), { recursive: true });
  mkdirSync(resolve(fixture, 'packages/angular/dist'), { recursive: true });
  write('packages/angular/node_modules/ref.js', '@raniagus/subjects-graph@9.0.0');
  write('packages/angular/dist/index.js', '@raniagus/subjects-graph@9.0.0');
  write('packages/angular/README.md', 'compatible con `0.1.1`');
  expect(commitRelease('v0.2.0', fixture)).toBe(true);
  expect(read('packages/angular/README.md')).toBe('compatible con `0.2.0`');
  expect(read('packages/angular/dist/index.js')).toContain('@9.0.0');
});
it('keeps main/PR CI separate and gates the stable commit on successful publication', () => {
  const workflow = readFileSync(resolve('.github/workflows/publish.yml'), 'utf8');
  const ci = readFileSync(resolve('.github/workflows/ci.yml'), 'utf8');
  expect(workflow).toContain("tags: ['v[0-9]*.[0-9]*.[0-9]*']");
  expect(workflow).not.toMatch(/branches:|pull_request:|angular-v/);
  expect(workflow).toContain('cancel-in-progress: false');
  expect(workflow.indexOf('prepare-release.mjs --validate')).toBeLessThan(workflow.indexOf('pnpm install'));
  expect(workflow.indexOf('publish-release.mjs /tmp/core.tgz /tmp/angular.tgz')).toBeLessThan(workflow.indexOf("if: steps.release.outputs.dist_tag == 'latest'"));
  expect(workflow).not.toMatch(/always\(\)|continue-on-error|git push.*--force/);
  expect(ci).toContain('branches: [main]'); expect(ci).toContain('pull_request:');
  expect(ci).not.toMatch(/tags:|npm publish|publish-release/);
});
