import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** @param {string} tag */
export function parseTag(tag) {
  const match = /^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(tag);
  if (!match || match[0] !== tag || match[4]?.split('.').some(id => /^0[0-9]+$/.test(id))) {
    throw new Error(`Release tag must be strict SemVer prefixed with v: ${tag}`);
  }
  // npm versions do not retain build metadata.
  return { version: tag.slice(1).split('+')[0], dist_tag: /** @type {'latest' | 'next'} */ (match[4] ? 'next' : 'latest') };
}

/** @param {string} tag @param {string} [cwd] @param {string} [gitHead] */
export function prepareRelease(tag, cwd = process.cwd(), gitHead) {
  const release = parseTag(tag);
  const paths = ['package.json', 'packages/angular/package.json'];
  const manifests = paths.map(path => JSON.parse(readFileSync(resolve(cwd, path), 'utf8')));
  manifests[0].version = manifests[1].version = release.version;
  manifests[1].peerDependencies['@raniagus/subjects-graph'] = `^${release.version}`;
  for (const manifest of manifests) {
    if (gitHead) manifest.gitHead = gitHead;
    else delete manifest.gitHead;
  }
  // Read and validate both inputs before writing either one.
  paths.forEach((path, i) => writeFileSync(resolve(cwd, path), `${JSON.stringify(manifests[i], null, 2)}\n`));
  return release;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const release = process.argv.includes('--validate') ? parseTag(process.env.RELEASE_TAG ?? '') : prepareRelease(process.env.RELEASE_TAG ?? '', process.cwd(), process.env.RELEASE_SHA);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${release.version}\ndist_tag=${release.dist_tag}\n`);
}
