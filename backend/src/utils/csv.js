const fs = require('fs');
const path = require('path');

/** Parse a single CSV line (handles quoted fields). */
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * Read a CSV file into an array of row objects.
 * Skips blank lines and lines starting with #.
 */
function readCsv(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) return null;

  const raw = fs.readFileSync(abs, 'utf8');
  const lines = raw.split(/\r?\n/).filter((l) => {
    const t = l.trim();
    return t && !t.startsWith('#');
  });

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map((line) => {
    const vals = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = vals[i] ?? '';
    });
    return row;
  });
}

function parseBool(val) {
  if (!val) return false;
  const v = String(val).trim().toLowerCase();
  return v === 'true' || v === 'yes' || v === '1';
}

module.exports = { readCsv, parseBool };
