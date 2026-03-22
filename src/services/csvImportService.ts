/**
 * CSV Import Service — Parse & validate CSV files for bulk bet import
 *
 * Architecture: Pure functions, no side effects.
 * Future-ready: structured for bet_type expansion, custom column mapping, API imports.
 */

export interface CSVRow {
  event_name: string;
  fighter_a: string;
  fighter_b: string;
  selection: string;
  odds: number;
  stake: number;
  date: string;
  result: string;
}

export interface ParsedRow {
  row: CSVRow;
  lineNumber: number;
  valid: boolean;
  errors: string[];
}

export interface CSVParseResult {
  rows: ParsedRow[];
  validCount: number;
  invalidCount: number;
  headerError: string | null;
}

const REQUIRED_HEADERS = ['event_name', 'fighter_a', 'fighter_b', 'selection', 'odds', 'stake'];
const VALID_RESULTS = ['', 'W', 'L', 'C', 'pending', 'win', 'loss', 'cancelled'];

const CSV_TEMPLATE_HEADERS = 'event_name,fighter_a,fighter_b,selection,odds,stake,date,result';
const CSV_TEMPLATE_EXAMPLE = 'UFC 300,Charles Oliveira,Arman Tsarukyan,Charles Oliveira,1.85,50,2026-03-20,pending';

export function generateCSVTemplate(): string {
  return `${CSV_TEMPLATE_HEADERS}\n${CSV_TEMPLATE_EXAMPLE}`;
}

export function downloadCSVTemplate(): void {
  const csv = generateCSVTemplate();
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fightedge-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function parseLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9_]/g, '').trim();
}

function normalizeResult(raw: string): 'W' | 'L' | 'C' | '-' | '' {
  const r = raw.trim().toLowerCase();
  if (r === 'w' || r === 'win') return 'W';
  if (r === 'l' || r === 'loss') return 'L';
  if (r === 'c' || r === 'cancelled' || r === 'canceled' || r === 'nc' || r === 'no contest') return 'C';
  if (r === 'pending' || r === '-') return '-';
  return '-'; // default to pending
}

export async function parseCSVFile(file: File): Promise<CSVParseResult> {
  const text = await file.text();
  return parseCSVText(text);
}

export function parseCSVText(text: string): CSVParseResult {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);

  if (lines.length === 0) {
    return { rows: [], validCount: 0, invalidCount: 0, headerError: 'Empty file.' };
  }

  // Parse headers
  const rawHeaders = parseLine(lines[0]).map(normalizeHeader);

  // Check required headers
  const missing = REQUIRED_HEADERS.filter(h => !rawHeaders.includes(h));
  if (missing.length > 0) {
    return {
      rows: [],
      validCount: 0,
      invalidCount: 0,
      headerError: `Missing columns: ${missing.join(', ')}. Required: ${REQUIRED_HEADERS.join(', ')}`,
    };
  }

  // Map header indices
  const idx: Record<string, number> = {};
  rawHeaders.forEach((h, i) => { idx[h] = i; });

  const rows: ParsedRow[] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const fields = parseLine(lines[i]);
    const errors: string[] = [];

    const get = (key: string) => (idx[key] !== undefined ? (fields[idx[key]] || '') : '');

    const event_name = get('event_name');
    const fighter_a = get('fighter_a');
    const fighter_b = get('fighter_b');
    const selection = get('selection');
    const oddsStr = get('odds');
    const stakeStr = get('stake');
    const dateStr = get('date');
    const resultStr = get('result');

    // Validations
    if (!event_name) errors.push('Missing event_name');
    if (!fighter_a) errors.push('Missing fighter_a');
    if (!fighter_b) errors.push('Missing fighter_b');
    if (!selection) errors.push('Missing selection');

    const odds = parseFloat(oddsStr);
    if (isNaN(odds) || odds <= 1) errors.push('Odds must be a number > 1');

    const stake = parseFloat(stakeStr);
    if (isNaN(stake) || stake <= 0) errors.push('Stake must be a positive number');

    // Selection must match fighter_a or fighter_b
    if (selection && fighter_a && fighter_b) {
      const selLower = selection.toLowerCase().trim();
      const aLower = fighter_a.toLowerCase().trim();
      const bLower = fighter_b.toLowerCase().trim();
      if (selLower !== aLower && selLower !== bLower) {
        errors.push('Selection must match fighter_a or fighter_b');
      }
    }

    // Date validation (optional)
    let date = '';
    if (dateStr) {
      const d = new Date(dateStr + 'T12:00:00');
      if (isNaN(d.getTime())) {
        errors.push('Invalid date format (use YYYY-MM-DD)');
      } else {
        date = dateStr;
      }
    }

    const valid = errors.length === 0;
    if (valid) validCount++;
    else invalidCount++;

    rows.push({
      row: {
        event_name,
        fighter_a,
        fighter_b,
        selection,
        odds: isNaN(odds) ? 0 : odds,
        stake: isNaN(stake) ? 0 : stake,
        date,
        result: resultStr,
      },
      lineNumber: i + 1,
      valid,
      errors,
    });
  }

  return { rows, validCount, invalidCount, headerError: null };
}

/** Convert valid parsed rows to Bet objects ready for insertion */
export function convertToBets(rows: ParsedRow[]): Array<{
  date: string;
  created_at: string;
  event_name: string;
  fight_name: string;
  fighter: string;
  opponent: string;
  odds: number;
  stake_usd: number;
  stake_brl: number;
  result: 'W' | 'L' | 'C' | '-' | '';
  pl_usd: number;
  bankroll_before: number;
  bankroll_after: number;
  roi: number;
}> {
  return rows
    .filter(r => r.valid)
    .map(({ row }) => {
      const fighter = row.selection;
      const opponent = row.selection.toLowerCase().trim() === row.fighter_a.toLowerCase().trim()
        ? row.fighter_b
        : row.fighter_a;
      const fightName = `${row.fighter_a} vs ${row.fighter_b}`;

      const dateStr = row.date || new Date().toISOString().slice(0, 10);
      const [y, m, d] = dateStr.split('-');
      const displayDate = m && d && y ? `${m}/${d}/${y}` : dateStr;
      const isoDate = new Date(dateStr + 'T12:00:00').toISOString();

      const result = normalizeResult(row.result);
      let pl_usd = 0;
      if (result === 'W') pl_usd = row.stake * (row.odds - 1);
      else if (result === 'L') pl_usd = -row.stake;
      // C = 0

      return {
        date: displayDate,
        created_at: isoDate,
        event_name: row.event_name,
        fight_name: fightName,
        fighter,
        opponent,
        odds: row.odds,
        stake_usd: row.stake,
        stake_brl: 0,
        result,
        pl_usd,
        bankroll_before: 0,
        bankroll_after: 0,
        roi: 0,
      };
    });
}
