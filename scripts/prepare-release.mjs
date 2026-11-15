import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Set only the working tree package version; npm validates and normalizes SemVer.
 * @param {string} tag
 * @param {string} [cwd]
 * @returns {{ version: string, dist_tag: 'latest' | 'next' }}
 */
export function prepareRelease(tag, cwd = process.cwd()) {
  const candidate = tag.startsWith('v') ? tag.slice(1) : tag;
  // npm accepts some loose versions; reject tags that violate SemVer first.
  const match = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(candidate);
  const hasLeadingZeroPrerelease = match?.[4]?.split('.').some(identifier => /^0[0-9]+$/.test(identifier));
  if (!match || match[0] !== candidate || hasLeadingZeroPrerelease) {
    throw new Error(`Release tag must be a complete SemVer version with an optional leading v: ${tag}`);
  }

  execFileSync('npm', [
    'version', candidate, '--no-git-tag-version', '--allow-same-version', '--ignore-scripts',
  ], { cwd });

  const { version } = JSON.parse(readFileSync(resolve(cwd, 'package.json'), 'utf8'));
  if (typeof version !== 'string') throw new Error('npm did not write a package version');
  return { version, dist_tag: version.split('+', 1)[0].includes('-') ? 'next' : 'latest' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const tag = process.env.RELEASE_TAG;
  const output = process.env.GITHUB_OUTPUT;
  if (!tag || !output) throw new Error('RELEASE_TAG and GITHUB_OUTPUT are required');
  const release = prepareRelease(tag);
  appendFileSync(output, `version=${release.version}\ndist_tag=${release.dist_tag}\n`);
}
