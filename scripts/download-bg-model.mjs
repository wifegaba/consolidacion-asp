/**
 * download-bg-model.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Downloads @imgly/background-removal model chunks (isnet_quint8 + WASM runtime)
 * from the CDN and stores them in public/bg-removal/ so the Next.js app can
 * serve them locally — no internet needed at runtime in the church.
 *
 * Usage (run once, from project root):
 *   node scripts/download-bg-model.mjs
 *
 * How it works:
 *   The library fetches resources.json then downloads individual chunk files
 *   (named by their SHA-256 hash) and assembles them in-memory.
 *   We mirror that exact structure under public/bg-removal/.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT  = join(ROOT, 'public', 'bg-removal');
const BASE = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';

// ── helpers ───────────────────────────────────────────────────────────────────

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
      }
      const parts = [];
      res.on('data', c => parts.push(c));
      res.on('end',  () => resolve(Buffer.concat(parts)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

const mb = n => (n / 1024 / 1024).toFixed(1) + ' MB';

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(OUT, { recursive: true });

  // ── 1. Fetch & save resources.json ─────────────────────────────────────────
  const resJsonPath = join(OUT, 'resources.json');
  let resources;

  if (existsSync(resJsonPath)) {
    console.log('ℹ️  resources.json already exists, using cached version.');
    resources = JSON.parse(readFileSync(resJsonPath, 'utf8'));
  } else {
    console.log('📥 Fetching resources.json…');
    const buf = await get(BASE + 'resources.json');
    writeFileSync(resJsonPath, buf);
    resources = JSON.parse(buf.toString());
    console.log('  ✅ resources.json saved\n');
  }

  // ── 2. Keys we need: non-WebGPU WASM + isnet_quint8 model ──────────────────
  const TARGETS = [
    '/onnxruntime-web/ort-wasm-simd-threaded.wasm',
    '/onnxruntime-web/ort-wasm-simd-threaded.mjs',
    '/models/isnet_quint8',
  ];

  // ── 3. Collect all unique chunk hashes we need ─────────────────────────────
  const needed = new Map(); // hash → size in bytes

  for (const key of TARGETS) {
    const entry = resources[key];
    if (!entry) { console.warn(`⚠️  Key not found: ${key}`); continue; }

    const totalMb = mb(entry.size);
    console.log(`📦 ${key}  (${totalMb}, ${entry.chunks.length} chunks)`);

    for (const chunk of entry.chunks) {
      const chunkSize = chunk.offsets[1] - chunk.offsets[0];
      needed.set(chunk.name, chunkSize);
    }
  }

  // ── 4. Download each chunk once (they may be shared across files) ───────────
  console.log(`\n🔽 Downloading ${needed.size} chunk files…\n`);
  let done = 0;

  for (const [hash, expectedSize] of needed) {
    const dest = join(OUT, hash);
    done++;
    const prefix = `  [${done}/${needed.size}]`;

    if (existsSync(dest)) {
      console.log(`${prefix} ✅ ${hash.slice(0, 16)}…  (cached)`);
      continue;
    }

    process.stdout.write(`${prefix} ⬇️  ${hash.slice(0, 16)}…  ${mb(expectedSize)}  `);
    const data = await get(BASE + hash);

    if (data.length !== expectedSize) {
      throw new Error(`Size mismatch for ${hash}: expected ${expectedSize}, got ${data.length}`);
    }

    writeFileSync(dest, data);
    process.stdout.write('✅\n');
  }

  console.log('\n🎉 All files downloaded to public/bg-removal/');
  console.log('\nNow the background-removal call in AdminModal.tsx uses:');
  console.log("  publicPath: `${window.location.origin}/bg-removal/`");
  console.log('\nNo internet required at runtime — files are served by your own Next.js server.');
}

main().catch(e => {
  console.error('\n❌ Download failed:', e.message);
  process.exit(1);
});
