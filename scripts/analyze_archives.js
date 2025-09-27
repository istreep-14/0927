const fs = require('fs');
const path = require('path');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return null;
  }
}

function add(set, value) {
  if (value === undefined || value === null) return;
  if (typeof value === 'string' && value.length === 0) return;
  set.add(value);
}

function analyze() {
  const root = '/workspace/samples/chess-com/archives';
  const perField = new Map();
  const counters = { games: 0, months: 0 };
  const months = [];
  for (const year of fs.readdirSync(root)) {
    const yDir = path.join(root, year);
    if (!fs.statSync(yDir).isDirectory()) continue;
    for (const mm of fs.readdirSync(yDir)) {
      if (!mm.endsWith('.json')) continue;
      const file = path.join(yDir, mm);
      const data = readJson(file);
      if (!data || !Array.isArray(data.games)) continue;
      counters.months += 1;
      months.push(`${year}/${mm.replace('.json','')}`);
      for (const g of data.games) {
        counters.games += 1;
        const fields = [
          'url','pgn','time_control','end_time','rated','accuracies','tcn','uuid','initial_setup','fen','time_class','rules','eco','tournament','match'
        ];
        for (const f of fields) {
          if (!perField.has(f)) perField.set(f, new Set());
        }
        add(perField.get('time_control'), g.time_control);
        add(perField.get('rated'), String(g.rated));
        add(perField.get('time_class'), g.time_class);
        add(perField.get('rules'), g.rules);
        if (g.accuracies) {
          add(perField.get('accuracies'), 'present');
        } else {
          add(perField.get('accuracies'), 'absent');
        }
        if (g.eco) add(perField.get('eco'), 'present'); else add(perField.get('eco'), 'absent');
        if (g.tournament) add(perField.get('tournament'), 'present'); else add(perField.get('tournament'), 'absent');
        if (g.match) add(perField.get('match'), 'present'); else add(perField.get('match'), 'absent');
        if (g.initial_setup) add(perField.get('initial_setup'), 'present'); else add(perField.get('initial_setup'), 'absent');
        if (g.tcn) add(perField.get('tcn'), 'present'); else add(perField.get('tcn'), 'absent');
        if (g.uuid) add(perField.get('uuid'), 'present'); else add(perField.get('uuid'), 'absent');
        if (g.white && typeof g.white.result === 'string') {
          if (!perField.has('white.result')) perField.set('white.result', new Set());
          add(perField.get('white.result'), g.white.result);
        }
        if (g.black && typeof g.black.result === 'string') {
          if (!perField.has('black.result')) perField.set('black.result', new Set());
          add(perField.get('black.result'), g.black.result);
        }
        if (g.white && typeof g.white.username === 'string') {
          if (!perField.has('white.username.case')) perField.set('white.username.case', new Set());
          add(perField.get('white.username.case'), /[A-Z]/.test(g.white.username) ? 'mixed' : 'lower');
        }
      }
    }
  }

  const lines = [];
  lines.push('## Hikaru monthly archives analysis');
  lines.push(`- Months analyzed: ${counters.months}`);
  lines.push(`- Total games: ${counters.games}`);
  lines.push('');
  lines.push('### Constant-like fields (observed values)');
  for (const [k, set] of Array.from(perField.entries()).sort()) {
    const vals = Array.from(set).sort();
    if (vals.length <= 20) {
      lines.push(`- ${k}: ${vals.join(', ')}`);
    } else {
      lines.push(`- ${k}: ${vals.length} distinct values`);
    }
  }
  lines.push('');
  lines.push('### Notes');
  lines.push('- time_class shows limited set across the dataset.');
  lines.push('- rules typically chess; chess960 appears occasionally.');
  lines.push('- accuracies present/absent varies by game/time period.');
  lines.push('- tournament links present for event games; absent otherwise.');
  lines.push('- tcn/uuid presence varies by period.');

  const out = '/workspace/samples/chess-com/archives/analysis.md';
  fs.writeFileSync(out, lines.join('\n'));
  console.log('Wrote', out);
}

analyze();