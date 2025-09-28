const fs = require('fs');
const path = require('path');
const https = require('https');

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'cursor-fetcher/1.0' } }, (res) => {
      const { statusCode } = res;
      if (statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    }).on('error', reject);
  });
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function* months(startY, startM, endY, endM) {
  let y = startY;
  let m = startM;
  while (y < endY || (y === endY && m <= endM)) {
    yield { y, m };
    m += 1;
    if (m === 13) { m = 1; y += 1; }
  }
}

async function main() {
  const outRoot = '/workspace/samples/chess-com/archives';
  ensureDir(outRoot);
  const username = 'hikaru';
  const start = { y: 2018, m: 5 };
  const end = { y: 2025, m: 9 };
  const failures = [];
  for (const { y, m } of months(start.y, start.m, end.y, end.m)) {
    const ym = `${y}/${String(m).padStart(2, '0')}`;
    const url = `https://api.chess.com/pub/player/${username}/games/${ym}`;
    const outDir = path.join(outRoot, String(y));
    const outFile = path.join(outDir, `${String(m).padStart(2, '0')}.json`);
    ensureDir(outDir);
    try {
      const body = await fetch(url);
      fs.writeFileSync(outFile, body);
      console.log('Saved', ym);
    } catch (e) {
      console.error('Fail', ym, e.message);
      failures.push({ y, m, error: e.message });
    }
  }
  fs.writeFileSync(path.join(outRoot, 'failures.json'), JSON.stringify(failures, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });

