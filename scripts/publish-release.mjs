import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseTag } from './prepare-release.mjs';

/** @param {string} name @param {string} version @param {string} sha @param {(name: string) => any} lookup */
export function alreadyPublished(name, version, sha, lookup) {
  const metadata = lookup(`${name}@${version}`);
  if (!metadata) return false;
  if (metadata.version !== version || metadata.gitHead !== sha) throw new Error(`Existing ${name}@${version} does not match tag commit ${sha}`);
  return true;
}

/** @param {string} spec */
function lookup(spec) {
  try { return JSON.parse(execFileSync('npm', ['view', spec, '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })); }
  catch (error) {
    const response = JSON.parse(String(/** @type {{stdout?: string}} */ (error).stdout || '{}'));
    if (response.error?.code === 'E404') return null;
    throw error;
  }
}

/** @param {string} tag @param {string} sha @param {string[]} archives @param {{lookup: (spec: string) => any, publish: (archive: string, distTag: string) => void}} io */
export function publishRelease(tag, sha, archives, io) {
  const { version, dist_tag } = parseTag(tag);
  const names = ['@raniagus/subjects-graph', '@raniagus/subjects-graph-angular'];
  if (!sha || archives.length !== 2) throw new Error('Tag commit and two archives required');
  // Inspect BOTH archives before any publication.
  archives.forEach((archive, i) => {
    const manifest = JSON.parse(execFileSync('tar', ['-xOf', archive, 'package/package.json'], { encoding: 'utf8' }));
    if (manifest.name !== names[i] || manifest.version !== version || manifest.gitHead !== sha || manifest.private || (i === 1 && manifest.peerDependencies?.[names[0]] !== `^${version}`)) throw new Error(`Invalid packed manifest: ${archive}`);
  });
  const existing = names.map(name => alreadyPublished(name, version, sha, io.lookup));
  archives.forEach((archive, i) => { if (!existing[i]) io.publish(archive, dist_tag); });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  publishRelease(process.env.RELEASE_TAG ?? '', process.env.RELEASE_SHA ?? '', process.argv.slice(2), {
    lookup,
    publish: (archive, distTag) => { execFileSync('npm', ['publish', archive, '--access', 'public', '--tag', distTag], { stdio: 'inherit' }); },
  });
}
