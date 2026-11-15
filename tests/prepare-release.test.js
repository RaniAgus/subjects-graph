import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

describe('tag release preparation', () => {
  let fixture = '';

  beforeEach(() => {
    fixture = mkdtempSync(resolve(tmpdir(), 'subjects-graph-release-'));
    writeFileSync(resolve(fixture, 'package.json'), JSON.stringify({
      name: 'release-fixture', version: '1.0.0',
      scripts: { version: 'node -e "process.exit(42)"' },
    }));
  });

  afterEach(() => rmSync(fixture, { recursive: true, force: true }));

  it.each([
    ['1.2.4', '1.2.4', 'latest'],
    ['v1.2.4', '1.2.4', 'latest'],
    ['1.0.0', '1.0.0', 'latest'],
    ['v1.2.4-alpha.1', '1.2.4-alpha.1', 'next'],
    ['1.2.4-beta.2', '1.2.4-beta.2', 'next'],
    ['v1.2.4-rc.1', '1.2.4-rc.1', 'next'],
    ['1.2.4-custom.7', '1.2.4-custom.7', 'next'],
    ['1.2.4-0', '1.2.4-0', 'next'],
    ['v1.2.4+build.9', '1.2.4', 'latest'],
    ['1.2.4-alpha.1+build.9', '1.2.4-alpha.1', 'next'],
    ['1.2.4+001.002', '1.2.4', 'latest'],
    ['1.2.4-01alpha', '1.2.4-01alpha', 'next'],
  ])('prepares %s as %s on %s', async (tag, version, distTag) => {
    const { prepareRelease } = await import('../scripts/prepare-release.mjs');
    expect(prepareRelease(tag, fixture)).toEqual({ version, dist_tag: distTag });
    expect(JSON.parse(readFileSync(resolve(fixture, 'package.json'), 'utf8')).version).toBe(version);
    expect(existsSync(resolve(fixture, '.git'))).toBe(false);
  });

  it.each([
    '', 'patch', 'minor', 'major', 'prerelease', 'latest', 'next',
    '1', '1.2', 'v', 'vv1.2.3', 'v=1.2.3', '=1.2.3',
    '01.2.3', '1.02.3', '1.2.03', '1.2.3-01', '1.2.3-alpha.01', '1.2.3-alpha..1',
    '1.2.3+build..1', '1.2.3-alpha_1',
    '1.2.3+', '1.2.3-', '1.2.3\n', ' 1.2.3',
    '1.2.3;touch injected', '1.2.3-$(touch injected)',
  ])('rejects invalid or shorthand tag %j without changing the manifest', async tag => {
    const { prepareRelease } = await import('../scripts/prepare-release.mjs');
    const before = readFileSync(resolve(fixture, 'package.json'), 'utf8');
    expect(() => prepareRelease(tag, fixture)).toThrow();
    expect(readFileSync(resolve(fixture, 'package.json'), 'utf8')).toBe(before);
    expect(existsSync(resolve(fixture, 'injected'))).toBe(false);
  });

  it('writes normalized CLI outputs without committing or tagging', () => {
    execFileSync('git', ['init', '--quiet'], { cwd: fixture });
    execFileSync('git', ['add', 'package.json'], { cwd: fixture });
    execFileSync('git', [
      '-c', 'user.name=Release Test', '-c', 'user.email=release@example.invalid',
      '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'Fixture',
    ], { cwd: fixture });
    const before = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fixture, encoding: 'utf8' });
    const output = resolve(fixture, 'github-output');

    execFileSync(process.execPath, [resolve('scripts/prepare-release.mjs')], {
      cwd: fixture,
      env: { ...process.env, RELEASE_TAG: 'v2.3.4-custom.1+build.9', GITHUB_OUTPUT: output },
    });

    expect(JSON.parse(readFileSync(resolve(fixture, 'package.json'), 'utf8')).version).toBe('2.3.4-custom.1');
    expect(readFileSync(output, 'utf8')).toBe('version=2.3.4-custom.1\ndist_tag=next\n');
    expect(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fixture, encoding: 'utf8' })).toBe(before);
    expect(execFileSync('git', ['tag'], { cwd: fixture, encoding: 'utf8' })).toBe('');
  });
});
