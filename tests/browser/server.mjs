import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

const root = resolve('public');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname.replace(
    /^\/subjects-graph\//,
    '/',
  );
  const vendor = pathname === '/__cytoscape.mjs';
  const file = vendor
    ? resolve('node_modules/cytoscape/dist/cytoscape.esm.mjs')
    : resolve(
        root,
        '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname),
      );

  if (!vendor && !file.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }

  try {
    let content = await readFile(file);
    if (file.endsWith('index.html') || file.endsWith('sw.js')) {
      content = Buffer.from(
        content
          .toString()
          .replaceAll(
            'https://unpkg.com/cytoscape@3.33.1/dist/cytoscape.esm.mjs',
            '/__cytoscape.mjs',
          ),
      );
    }
    response
      .writeHead(200, {
        'Content-Type': mime[extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      })
      .end(content);
  } catch {
    response.writeHead(404).end();
  }
}).listen(8017, '127.0.0.1');
