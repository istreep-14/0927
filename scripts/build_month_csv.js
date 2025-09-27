const fs = require('fs');
const https = require('https');

const FIELDS_CSV = '/workspace/samples/chess-com/game-fields.csv';

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'cursor-month-builder/1.0' } }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const chunks = []; res.on('data', d => chunks.push(d)); res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    }).on('error', reject);
  });
}

function parsePgnHeaders(pgn) {
  const headers = {}; if (!pgn) return headers;
  const lines = pgn.split(/\r?\n/);
  for (const line of lines) { if (!line || line[0] !== '[') break; const m = line.match(/^\[([^\s]+)\s+"([\s\S]*?)"\]$/); if (m) headers[m[1]] = m[2]; }
  return headers;
}

function extractPgnMoves(pgn) {
  if (!pgn) return ''; const idx = pgn.indexOf('\n\n'); const body = idx >= 0 ? pgn.slice(idx + 2) : pgn; return body.replace(/\r?\n/g, ' ').trim();
}

function toLocalParts(epochSeconds) {
  if (!epochSeconds && epochSeconds !== 0) return null; const d = new Date(epochSeconds * 1000);
  return { d, date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`, time: `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`, iso: d.toISOString() };
}

function parseUtcDateTime(utcDate, utcTime) { if (!utcDate || !utcTime) return null; const [Y,M,D]=utcDate.split('.').map(Number); const [h,m,s]=utcTime.split(':').map(Number); if (!Y||!M||!D) return null; return new Date(Date.UTC(Y, M-1, D, h||0, m||0, s||0)); }

function csvEscape(value) { if (value === null || value === undefined) return ''; const s = String(value); return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; }

function deriveFormat(rules, timeClass) { if (rules === 'chess') return timeClass||''; if (rules === 'chess960') return timeClass==='daily'?'daily960':'live960'; const other=['bughouse','crazyhouse','kingofthehill','threecheck','oddschess']; return other.includes(rules)?rules:''; }

function parseTimeControl(tc){ const out={base:'',inc:'',corr:''}; if(!tc)return out; if(tc.includes('/')){const parts=tc.split('/'); out.corr=parts[1]?String(parseInt(parts[1],10)):''; return out;} if(tc.includes('+')){const [b,i]=tc.split('+'); out.base=String(parseInt(b,10)); out.inc=String(parseInt(i,10)); return out;} out.base=String(parseInt(tc,10)); out.inc='0'; return out; }

function deriveWinner(whiteRes, blackRes){ if(whiteRes==='win'||blackRes==='lose')return'white'; if(blackRes==='win'||whiteRes==='lose')return'black'; return ''; }

function resultCategory(res){
  if(!res) return '';
  const r = String(res).toLowerCase();
  if (r === 'win') return 'win';
  const drawSet = new Set(['draw','stalemate','agreed','repetition','insufficient','50move','timevsinsufficient']);
  if (drawSet.has(r)) return 'draw';
  const lossSet = new Set(['lose','checkmated','resigned','timeout','abandoned','kingofthehill','threecheck','bughousepartnerlose']);
  if (lossSet.has(r)) return 'lose';
  return '';
}
function scoreFromOutcome(outcome){ if(outcome==='win')return'1'; if(outcome==='draw')return'0.5'; if(outcome==='lose')return'0'; return ''; }

function countMoves(pgnMoves){ if(!pgnMoves)return''; const matches=pgnMoves.match(/\b\d+\./g); return matches?String(matches.length):'0'; }

function endReasonFromResults(whiteRes, blackRes){
  const w = String(whiteRes||'').toLowerCase();
  const b = String(blackRes||'').toLowerCase();
  if (!w && !b) return '';
  if (w === 'win') return b || '';
  if (b === 'win') return w || '';
  // likely a draw; pick one (should be the same)
  return w || b;
}

function valueMapForGame(game, fields){
  const pgn=game.pgn||''; const ph=parsePgnHeaders(pgn); const pgnMoves=extractPgnMoves(pgn).replace(/\s+/g,' ').trim();
  const timeClass=game.time_class||''; const rules=game.rules||''; const drv_type=timeClass==='daily'?'daily':'live'; const drv_format=deriveFormat(rules,timeClass); const tc=parseTimeControl(game.time_control||'');
  const endParts=toLocalParts(game.end_time); let startDate=null; if(game.start_time) startDate=new Date(game.start_time*1000); else if(ph.UTCDate&&ph.UTCTime) startDate=parseUtcDateTime(ph.UTCDate,ph.UTCTime);
  const drv_end=endParts?`${endParts.date} ${endParts.time}`:''; const drv_end_date=endParts?endParts.date:''; const drv_end_time=endParts?endParts.time:''; const drv_end_iso=endParts?endParts.iso:'';
  const drv_start=startDate?`${toLocalParts(startDate.getTime()/1000).date} ${toLocalParts(startDate.getTime()/1000).time}`:''; const sp=startDate?toLocalParts(startDate.getTime()/1000):null; const drv_start_date=sp?sp.date:''; const drv_start_time=sp?sp.time:'';
  const drv_duration=(endParts&&startDate)?String(Math.max(0, Math.floor((endParts.d - startDate)/1000))):'';
  const white=game.white||{}; const black=game.black||{};

  const meIsWhite = (white.username || '').toLowerCase() === ME.toLowerCase();
  const meIsBlack = (black.username || '').toLowerCase() === ME.toLowerCase();
  const my = meIsWhite ? white : meIsBlack ? black : {};
  const opp = meIsWhite ? black : meIsBlack ? white : {};
  const drv_my_outcome = resultCategory(my.result);
  const drv_my_score = scoreFromOutcome(drv_my_outcome);
  const drv_opp_outcome = resultCategory(opp.result);
  const drv_opp_score = scoreFromOutcome(drv_opp_outcome);
  const drv_my_color = meIsWhite ? 'white' : (meIsBlack ? 'black' : '');
  const drv_opp_color = meIsWhite ? 'black' : (meIsBlack ? 'white' : '');
  const drv_end_reason = endReasonFromResults(white.result, black.result);
  const map={
    url:game.url||'', pgn:(pgn||'').replace(/\r?\n/g,'\\n'), time_control:game.time_control||'', start_time:game.start_time||'', end_time:game.end_time||'', rated:game.rated===true?'true':(game.rated===false?'false':''),
    'accuracies.white':game.accuracies&&game.accuracies.white!=null?String(game.accuracies.white):'', 'accuracies.black':game.accuracies&&game.accuracies.black!=null?String(game.accuracies.black):'', tcn:game.tcn||'', uuid:game.uuid||'', initial_setup:game.initial_setup||'', fen:game.fen||'', time_class:timeClass, rules:rules,
    drv_type, drv_format, drv_base_time:tc.base, drv_increment_time:tc.inc, drv_correspondence_time:tc.corr,
    'white.rating':white.rating!=null?String(white.rating):'', 'white.result':white.result||'', 'white.@id':white['@id']||'', 'white.username':white.username||'', 'white.uuid':white.uuid||'',
    'black.rating':black.rating!=null?String(black.rating):'', 'black.result':black.result||'', 'black.@id':black['@id']||'', 'black.username':black.username||'', 'black.uuid':black.uuid||'',
    eco:game.eco||'', tournament:game.tournament||'', match:game.match||'', pgn_event:ph.Event||'', pgn_site:ph.Site||'', pgn_date:ph.Date||'', pgn_round:ph.Round||'', pgn_white:ph.White||'', pgn_black:ph.Black||'', pgn_result:ph.Result||'', pgn_eco_code:ph.ECO||'', pgn_eco_url:ph.ECOUrl||'', pgn_time_control:ph.TimeControl||'', pgn_termination:ph.Termination||'', pgn_start_time:ph.StartTime||'', pgn_end_date:ph.EndDate||'', pgn_end_time:ph.EndTime||'', pgn_link:ph.Link||'', pgn_opening:ph.Opening||'', pgn_variation:ph.Variation||'', pgn_current_position:ph.CurrentPosition||'', pgn_timezone:ph.Timezone||'', pgn_utc_date:ph.UTCDate||'', pgn_utc_time:ph.UTCTime||'', pgn_white_elo:ph.WhiteElo||'', pgn_black_elo:ph.BlackElo||'', pgn_setup:ph.SetUp||'', pgn_fen:ph.FEN||'', pgn_moves:pgnMoves,
    drv_end, drv_end_iso, drv_start, drv_end_date, drv_end_time, drv_start_date, drv_start_time, drv_duration,
    drv_white_outcome: resultCategory(white.result),
    drv_white_score: scoreFromOutcome(resultCategory(white.result)),
    drv_black_outcome: resultCategory(black.result),
    drv_black_score: scoreFromOutcome(resultCategory(black.result)),
    drv_end_reason: drv_end_reason,
    drv_my_username: my.username||'',
    drv_my_uuid: my.uuid||'',
    drv_my_rating: my.rating!=null?String(my.rating):'',
    drv_my_result: my.result||'',
    drv_my_at_id: my['@id']||'',
    drv_my_outcome,
    drv_my_score,
    drv_opp_username: opp.username||'',
    drv_opp_uuid: opp.uuid||'',
    drv_opp_rating: opp.rating!=null?String(opp.rating):'',
    drv_opp_result: opp.result||'',
    drv_opp_at_id: opp['@id']||'',
    drv_opp_outcome,
    drv_opp_score,
    drv_my_color,
    drv_opp_color,
  };
  return fields.map(f => csvEscape(map[f]!==undefined?map[f]:''));
}

const ME = 'ians141';

async function buildMonth(username, y, m, outPath){
  const headerFields=fs.readFileSync(FIELDS_CSV,'utf8').trim().split(/\n/).slice(1).map(l=>l.split(',')[0]);
  const url=`https://api.chess.com/pub/player/${username}/games/${y}/${String(m).padStart(2,'0')}`;
  const json=JSON.parse(await fetch(url));
  const games=(json.games||[]);
  const rows=[headerFields.join(',')];
  for(const g of games){ rows.push(valueMapForGame(g, headerFields).join(',')); }
  fs.writeFileSync(outPath, rows.join('\n')+'\n');
  console.log('Wrote', outPath, 'rows:', games.length);
}

async function main(){
  const username='ians141';
  await buildMonth(username, 2025, 7, '/workspace/samples/chess-com/ians141_2025-07.csv');
  await buildMonth(username, 2025, 8, '/workspace/samples/chess-com/ians141_2025-08.csv');
  await buildMonth(username, 2025, 9, '/workspace/samples/chess-com/ians141_2025-09.csv');
}

main().catch(e=>{ console.error(e); process.exit(1); });

