'use strict';
// Maps app://game/<path> requests onto files inside the exported web build.
// Pure and dependency-free so it is unit-tested; the security property is that
// a request can never resolve to a file outside the renderer root.
const path = require('path');

/**
 * @param {string} root absolute renderer directory
 * @param {string} urlPath the URL pathname (already percent-encoded)
 * @returns {string|null} absolute file path inside root, or null if not allowed
 */
function resolveAppPath(root, urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch { return null; }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const rel = decoded === '/' || decoded === '' ? 'index.html' : decoded.replace(/^\/+/, '');
  const abs = path.resolve(root, rel);
  const rootWithSep = path.resolve(root) + path.sep;
  if (abs !== path.resolve(root) && !abs.startsWith(rootWithSep)) return null;
  return abs;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.glb': 'model/gltf-binary', '.wav': 'audio/wav',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};
const mimeFor = (file) => MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';

module.exports = { resolveAppPath, mimeFor };
