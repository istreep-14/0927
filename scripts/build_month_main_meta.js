const fs = require('fs');
const https = require('https');

const FIELDS_CSV = '/workspace/samples/chess-com/game-fields.csv';
const ME = 'ians141'; // set your username here or load from env/config

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'cursor-main-meta/1.0' } }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const chunks = []; res.on('data', d => chunks.push(d)); res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    }).on('error', reject);
  });
}

function parsePgnHeaders(pgn) {
  const headers = {}; if (!pgn) return headers;
  const lines = pgn.split(/\r?\n/);
  for (const line of lines) {
    if (!line || line[0] !== '[') break;
    const m = line.match(/^\[([^\s]+)\s+"([\s\S]*?)"\]$/);
    if (m) headers[m[1]] = m[2];
  }
  return headers;
}

function extractPgnMoves(pgn) {
  if (!pgn) return '';
  const idx = pgn.indexOf('\n\n');
  const body = idx >= 0 ? pgn.slice(idx + 2) : pgn;
  return body.replace(/\r?\n/g, ' ').trim();
}

function toLocalParts(epochSeconds) {
  if (!epochSeconds && epochSeconds !== 0) return null; const d = new Date(epochSeconds * 1000);
  return { d, date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`, time: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`, iso: d.toISOString() };
}

function parseUtcDateTime(utcDate, utcTime) { if (!utcDate || !utcTime) return null; const [Y,M,D]=utcDate.split('.').map(Number); const [h,m,s]=utcTime.split(':').map(Number); if (!Y||!M||!D) return null; return new Date(Date.UTC(Y, M-1, D, h||0, m||0, s||0)); }

function csvEscape(v) { if (v === null || v === undefined) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; }

function deriveFormat(rules, timeClass) { if (rules === 'chess') return timeClass||''; if (rules === 'chess960') return timeClass==='daily'?'daily960':'live960'; const other=['bughouse','crazyhouse','kingofthehill','threecheck','oddschess']; return other.includes(rules)?rules:''; }

function parseTimeControl(tc){ const out={base:'',inc:'',corr:''}; if(!tc)return out; if(tc.includes('/')){const parts=tc.split('/'); out.corr=parts[1]?String(parseInt(parts[1],10)):''; return out;} if(tc.includes('+')){const [b,i]=tc.split('+'); out.base=String(parseInt(b,10)); out.inc=String(parseInt(i,10)); return out;} out.base=String(parseInt(tc,10)); out.inc='0'; return out; }

function resultCategory(res){ if(!res) return ''; const r=String(res).toLowerCase(); if(r==='win') return 'win'; const draw=new Set(['draw','stalemate','agreed','repetition','insufficient','50move','timevsinsufficient']); if(draw.has(r)) return 'draw'; const lose=new Set(['lose','checkmated','resigned','timeout','abandoned','kingofthehill','threecheck','bughousepartnerlose']); if(lose.has(r)) return 'lose'; return ''; }
function scoreFromOutcome(o){ if(o==='win') return '1'; if(o==='draw') return '0.5'; if(o==='lose') return '0'; return ''; }
function endReasonFromResults(w,b){ const W=String(w||'').toLowerCase(), B=String(b||'').toLowerCase(); if(!W&&!B) return ''; if(W==='win') return B||''; if(B==='win') return W||''; return W||B; }

function buildMaps(game) {
  const pgn = game.pgn || '';
  const ph = parsePgnHeaders(pgn);
  const movetext = extractPgnMoves(pgn);
  const timeClass = game.time_class || '';
  const rules = game.rules || '';
  const type = timeClass==='daily'?'daily':'live';
  const format = deriveFormat(rules, timeClass);
  const tc = parseTimeControl(game.time_control || '');
  const wp = game.white || {};
  const bp = game.black || {};
  const meIsWhite = (wp.username||'').toLowerCase()===ME.toLowerCase();
  const meIsBlack = (bp.username||'').toLowerCase()===ME.toLowerCase();
  const my = meIsWhite?wp:(meIsBlack?bp:{});
  const opp = meIsWhite?bp:(meIsBlack?wp:{});
  const endParts = toLocalParts(game.end_time);
  let startDate = null; if (game.start_time) startDate = new Date(game.start_time*1000); else if (ph.UTCDate && ph.UTCTime) startDate = parseUtcDateTime(ph.UTCDate, ph.UTCTime);
  const sp = startDate ? toLocalParts(startDate.getTime()/1000) : null;
  const end_dt = endParts ? `${endParts.date} ${endParts.time}` : '';
  const start_dt = sp ? `${sp.date} ${sp.time}` : '';
  const duration = (endParts && startDate) ? String(Math.max(0, Math.floor((endParts.d - startDate)/1000))) : '';
  const url = game.url || '';
  const url_numeric_id = (url.match(/(\d+)$/)||[])[1]||'';

  const main = {
    game_uuid: game.uuid || '',
    url,
    end_dt,
    format,
    my_color: meIsWhite?'white':(meIsBlack?'black':''),
    my_rating: my.rating!=null?String(my.rating):'',
    opp_username: opp.username||'',
    opp_rating: opp.rating!=null?String(opp.rating):'',
    my_outcome: resultCategory(my.result),
    end_reason: endReasonFromResults(wp.result, bp.result),
  };

  const meta = {
    game_uuid: main.game_uuid,
    movetext,
    time_control: game.time_control || '',
    tc_base: tc.base,
    tc_inc: tc.inc,
    tc_corr: tc.corr,
    eco_code: ph.ECO || '',
    eco_url: game.eco || '',
    start_dt,
    start_date: sp?sp.date:'',
    start_time: sp?sp.time:'',
    end_date: endParts?endParts.date:'',
    end_time: endParts?endParts.time:'',
    duration,
    rated: game.rated===true?'true':(game.rated===false?'false':''),
    time_class: timeClass,
    rules,
    type,
    url_numeric_id,
    utc_date: ph.UTCDate||'',
    utc_time: ph.UTCTime||'',
    viewer_link: ph.Link||'',
    tournament_link: game.tournament||'',
    match_link: game.match||'',
    'white.username': wp.username||'',
    'white.uuid': wp.uuid||'',
    'white.id': wp['@id']||'',
    'white.rating': wp.rating!=null?String(wp.rating):'',
    'white.result': wp.result||'',
    'black.username': bp.username||'',
    'black.uuid': bp.uuid||'',
    'black.id': bp['@id']||'',
    'black.rating': bp.rating!=null?String(bp.rating):'',
    'black.result': bp.result||'',
    my_username: my.username||'',
    my_uuid: my.uuid||'',
    my_id: my['@id']||'',
    my_rating: main.my_rating,
    my_result: my.result||'',
    my_expected_score: (meIsWhite && wp.rating!=null && bp.rating!=null)?(1/(1+Math.pow(10,(bp.rating-wp.rating)/400))).toFixed(4): (meIsBlack && wp.rating!=null && bp.rating!=null)?(1/(1+Math.pow(10,(wp.rating-bp.rating)/400))).toFixed(4):'',
    my_outcome: main.my_outcome,
    my_score: scoreFromOutcome(main.my_outcome),
    opp_username: opp.username||'',
    opp_uuid: opp.uuid||'',
    opp_id: opp['@id']||'',
    opp_rating: main.opp_rating,
    opp_result: opp.result||'',
    opp_expected_score: (meIsWhite && wp.rating!=null && bp.rating!=null)?(1/(1+Math.pow(10,(wp.rating-bp.rating)/400))).toFixed(4): (meIsBlack && wp.rating!=null && bp.rating!=null)?(1/(1+Math.pow(10,(bp.rating-wp.rating)/400))).toFixed(4):'',
    opp_outcome: resultCategory(opp.result),
    opp_score: scoreFromOutcome(resultCategory(opp.result)),
    my_color: main.my_color,
    opp_color: meIsWhite?'black':(meIsBlack?'white':''),
    'accuracies.white': game.accuracies&&game.accuracies.white!=null?String(game.accuracies.white):'',
    'accuracies.black': game.accuracies&&game.accuracies.black!=null?String(game.accuracies.black):'',
    san_moves: '',
    clock_times: '',
    time_spent: '',
  };
  return { main, meta };
}

async function buildMonth(username, y, m, outBasePath){
  const lines = fs.readFileSync(FIELDS_CSV,'utf8').trim().split(/\n/).slice(1).filter(l=>l && !l.startsWith('#'));
  const names = lines.map(l=>l.split(',')[0]);
  const scopes = lines.map(l=>l.substring(l.lastIndexOf(',')+1).trim());
  const mainFields = names.filter((_,i)=>scopes[i]==='main');
  const metaFields = names.filter((_,i)=>scopes[i]==='meta');

  const url=`https://api.chess.com/pub/player/${username}/games/${y}/${String(m).padStart(2,'0')}`;
  const json=JSON.parse(await fetch(url));
  const games=(json.games||[]);

  const mainRows=[mainFields.join(',')];
  const metaRows=[metaFields.join(',')];
  for(const g of games){
    const { main, meta } = buildMaps(g);
    mainRows.push(mainFields.map(f=>csvEscape(main[f]!==undefined?main[f]:'')).join(','));
    metaRows.push(metaFields.map(f=>csvEscape(meta[f]!==undefined?meta[f]:'')).join(','));
  }
  fs.writeFileSync(outBasePath+`.main.csv`, mainRows.join('\n')+'\n');
  fs.writeFileSync(outBasePath+`.meta.csv`, metaRows.join('\n')+'\n');
  console.log('Wrote', outBasePath+`.main.csv`, 'and', outBasePath+`.meta.csv`, 'rows:', games.length);
}

async function main(){
  const username='ians141';
  const y=2025, m=9;
  const outBase = `/workspace/samples/chess-com/${username}_${y}-${String(m).padStart(2,'0')}`;
  await buildMonth(username, y, m, outBase);
}

main().catch(e=>{ console.error(e); process.exit(1); });

