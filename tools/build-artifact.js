// Builds dist/index.html for publishing as a claude.ai Artifact.
// The Artifact host wraps the page in its own <!doctype><html><head><body> skeleton (with a viewport meta),
// so this keeps only <title>, stylesheet links and the body content. Scripts and CSS are published
// alongside as separate files (see the `files` list printed at the end).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const title = src.match(/<title>[\s\S]*?<\/title>/)[0];
const links = [...src.matchAll(/<link [^>]*rel="(?:stylesheet|preconnect)"[^>]*>/g)].map((m) => m[0]);
const body = src.match(/<body>([\s\S]*)<\/body>/)[1].trim();

// Artifact viewers can be light-themed; the game is a single dark design, so paint the ground explicitly.
const page = [title, ...links, '<style>html, body { background: #07050b; color-scheme: dark; }</style>', body, ''].join('\n');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), page);

const files = { 'style.css': 'style.css' };
for (const f of fs.readdirSync(path.join(root, 'src')).filter((f) => f.endsWith('.js'))) files[`src/${f}`] = `src/${f}`;
console.log(JSON.stringify(files, null, 2));
