import Papa from 'papaparse';
import { dateInput, moneyInput, categories } from './validation';
export interface Statement {
  headers: string[];
  rows: string[][];
  hash: string;
  format: 'CSV' | 'PDF';
  warnings: string[];
}
export interface Mapping {
  date: string;
  description: string;
  amount: string;
  debit: string;
  credit: string;
  balance: string;
  reference: string;
  currency: string;
}
export type ImportRow = {
  date: string;
  description: string;
  merchant: string;
  amount: string;
  category: (typeof categories)[number];
  kind: 'income' | 'expense' | 'refund' | 'transfer' | 'adjustment';
  notes: string;
  reference: string;
  statementBalance?: string;
};
export async function readStatement(file: File): Promise<Statement> {
  if (!file.size || file.size > 20 * 1024 * 1024)
    throw new Error('Choose a non-empty file up to 20 MB.');
  const bytes = await file.arrayBuffer();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
  const format = file.name.toLowerCase().endsWith('.pdf')
    ? 'PDF'
    : file.name.toLowerCase().endsWith('.csv')
      ? 'CSV'
      : null;
  if (!format)
    throw new Error('Choose CSV or a text-based PDF. Scanned statements need a CSV export.');
  if (format === 'CSV') {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (text.includes('\0')) throw new Error('CSV must use UTF-8 text encoding.');
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' });
    if (parsed.errors.length)
      throw new Error(
        'The CSV contains malformed quoting or delimiters. Correct it before importing.',
      );
    const header = parsed.data.findIndex(
      (row) =>
        row.some((c) => /date/i.test(c)) &&
        row.some((c) => /description|details|merchant/i.test(c)),
    );
    if (header < 0)
      throw new Error('No transaction table found. Include Date, Description and Amount headers.');
    if (parsed.data.length > 5001 || parsed.data[header].length > 40)
      throw new Error('Split statements into at most 5,000 rows and 40 columns.');
    return {
      headers: parsed.data[header].map((s) => s.trim()),
      rows: parsed.data.slice(header + 1),
      hash,
      format,
      warnings: [],
    };
  }
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-')
    throw new Error('The file is not a valid PDF.');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes) });
  const doc = await task.promise;
  try {
    if (doc.numPages > 100) throw new Error('PDF statements are limited to 100 pages.');
    let headers: string[] = [];
    let positions: number[] = [];
    const rows: string[][] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const lines = new Map<number, { text: string; x: number }[]>();
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const y = Math.round(item.transform[5] / 3) * 3;
        lines.set(y, [...(lines.get(y) || []), { text: item.str, x: item.transform[4] }]);
      }
      let inTable = false;
      for (const [, tokens] of [...lines].sort((a, b) => b[0] - a[0])) {
        tokens.sort((a, b) => a.x - b.x);
        const text = tokens.map((t) => t.text).join(' ');
        if (
          /date/i.test(text) &&
          /description|details/i.test(text) &&
          /amount|debit|credit/i.test(text)
        ) {
          const cols = tokens.filter((t) =>
            /^(date|transaction date|description|details|amount|debit|credit|currency|balance|running balance|reference)$/i.test(
              t.text.trim(),
            ),
          );
          if (cols.length < 3)
            throw new Error('This PDF table layout is not recognized. Use a CSV export.');
          if (!headers.length) {
            headers = cols.map((c) => c.text.trim());
            positions = cols.map((c) => c.x);
          }
          inTable = true;
          continue;
        }
        if (!inTable || /^page\s+\d|^copyright|^©/i.test(text)) continue;
        const cells = headers.map(() => '');
        for (const token of tokens) {
          let col = 0;
          for (let i = 1; i < positions.length; i++) if (token.x >= positions[i] - 6) col = i;
          cells[col] += (cells[col] ? ' ' : '') + token.text;
        }
        if (cells.some((c) => c.trim())) rows.push(cells);
      }
      page.cleanup();
    }
    if (!rows.length)
      throw new Error(
        'No readable transaction table found. Scanned or unrecognized PDFs require CSV/manual entry.',
      );
    if (rows.length > 5000)
      throw new Error('Split statements into at most 5,000 transaction rows.');
    return {
      headers,
      rows,
      hash,
      format,
      warnings: [
        'Generic text-table PDF extraction. Review every row; wrapped descriptions and footers may require exclusion. No remote OCR or AI extraction is used.',
      ],
    };
  } finally {
    await task.destroy();
  }
}
export function detectMapping(headers: string[]): Mapping {
  const find = (r: RegExp) => headers.find((h) => r.test(h)) || '';
  return {
    date: find(/^(transaction\s*)?date$/i),
    description: find(/description|details|merchant/i),
    amount: find(/^(signed )?amount$/i),
    debit: find(/debit|withdrawal|money out/i),
    credit: find(/credit|deposit|money in/i),
    balance: find(/balance/i),
    reference: find(/reference|transaction id/i),
    currency: find(/^currency$/i),
  };
}
export function amount(raw: string) {
  const s = raw.trim();
  if (!s || s === '-') return undefined;
  const cleaned = s.replace(/\b(USD|EUR|GBP|JPY|CR|DR)\b/gi, '').replace(/[$€£¥\s]/g, '');
  if (!/^[-+]?\d+(\.\d{1,4})?$/.test(cleaned) && !/^\(\d+(\.\d{1,4})?\)$/.test(cleaned))
    throw new Error('Use decimal amounts without thousands separators; review ambiguous values.');
  const negative = cleaned.startsWith('(') || /DR$/i.test(s);
  const canonical = cleaned.replace(/[()+]/g, '');
  const signed = negative ? '-' + canonical.replace(/^-/, '') : canonical;
  return moneyInput.parse(signed);
}
export function normalizeRow(
  headers: string[],
  cells: string[],
  mapping: Mapping,
  currency: string,
  dateOrder: 'ISO' | 'DMY' | 'MDY',
): ImportRow {
  const get = (name: string) => (name ? cells[headers.indexOf(name)]?.trim() || '' : '');
  if (
    !mapping.date ||
    !mapping.description ||
    (!mapping.amount && !mapping.debit && !mapping.credit)
  )
    throw new Error('Map a date, description, and signed amount or debit/credit columns.');
  const used = Object.values(mapping).filter(Boolean);
  if (new Set(used).size !== used.length)
    throw new Error('A source column cannot be mapped to more than one field.');
  if (mapping.amount && (mapping.debit || mapping.credit))
    throw new Error('Choose signed amount OR debit/credit columns.');
  let date = get(mapping.date);
  if (dateOrder !== 'ISO') {
    const m = date.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (!m) throw new Error('Date does not match the selected date order.');
    date = `${m[3]}-${(dateOrder === 'DMY' ? m[2] : m[1]).padStart(2, '0')}-${(dateOrder === 'DMY' ? m[1] : m[2]).padStart(2, '0')}`;
  }
  date = dateInput.parse(date);
  const sourceCurrency = get(mapping.currency);
  if (sourceCurrency && sourceCurrency.toUpperCase() !== currency)
    throw new Error(
      `Source currency ${sourceCurrency} differs from the selected account (${currency}).`,
    );
  const description = get(mapping.description);
  if (!description || description.length > 500)
    throw new Error('Description is missing or exceeds 500 characters.');
  let value = amount(get(mapping.amount));
  if (!mapping.amount) {
    const debit = amount(get(mapping.debit));
    const credit = amount(get(mapping.credit));
    if (debit && credit && Number(debit) !== 0 && Number(credit) !== 0)
      throw new Error('Both debit and credit have a non-zero value.');
    value =
      credit && Number(credit) !== 0 ? credit : debit ? '-' + debit.replace(/^-/, '') : undefined;
  }
  if (value === undefined || Number(value) === 0) throw new Error('Amount must be non-zero.');
  const kind = Number(value) > 0 ? 'income' : 'expense';
  const category =
    kind === 'income'
      ? 'Income'
      : /rent|housing/i.test(description)
        ? 'Housing'
        : /grocery|supermarket|whole basket/i.test(description)
          ? 'Groceries'
          : /coffee|restaurant|cafe/i.test(description)
            ? 'Food & dining'
            : /spotify|netflix|figma|subscription/i.test(description)
              ? 'Subscriptions'
              : 'Other';
  return {
    date,
    description,
    merchant: description.slice(0, 100),
    amount: value,
    category,
    kind,
    notes: '',
    reference: get(mapping.reference),
    statementBalance: amount(get(mapping.balance)),
  };
}
