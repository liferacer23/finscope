import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convert, forecast, recurring, safeCsvCell, summarize } from '../src/lib/finance';
import { dateInput, moneyInput } from '../src/lib/validation';
import { detectMapping, normalizeRow, readStatement } from '../src/lib/imports';
import { hashPassword, verifyPassword } from '../src/lib/auth';
const row = (
  amount: string,
  kind = 'expense',
  date = '2026-01-01',
  merchant = 'Synthetic merchant',
) => ({ amount, kind, date, merchant, category: 'Other' });
test('decimal cash flow is exact, excludes transfers/adjustments and nets refunds', () => {
  assert.deepEqual(
    summarize([
      row('0.10', 'income'),
      row('0.20', 'income'),
      row('-0.10'),
      row('0.05', 'refund'),
      row('-100', 'transfer'),
      row('900', 'adjustment'),
    ]),
    { income: '0.30', spending: '0.05', net: '0.25', savingsRate: '83.3' },
  );
});
test('conversion uses dated direct or inverse rates and discloses unavailable coverage', () => {
  const rates = [
    { from: 'EUR', to: 'USD', date: '2026-01-01', rate: '1.1', source: 'Test' },
    { from: 'EUR', to: 'USD', date: '2026-02-01', rate: '1.2', source: 'Test' },
  ];
  assert.equal(convert('100', 'EUR', 'USD', '2026-01-20', rates)?.toString(), '110');
  assert.equal(convert('110', 'USD', 'EUR', '2026-01-20', rates)?.toString(), '100');
  assert.equal(convert('100', 'EUR', 'USD', '2025-12-31', rates), null);
  assert.equal(convert('100', 'GBP', 'USD', '2026-01-20', rates), null);
});
test('forecast compounds after cash flow and uses distinct deterministic scenarios', () => {
  const scenarios = forecast('1000', '100', '50', 2, '12');
  assert.equal(scenarios[1].points[1].balance, '1060.50');
  assert.equal(scenarios[1].points[2].balance, '1121.61');
  assert.ok(Number(scenarios[0].points[2].balance) < Number(scenarios[2].points[2].balance));
  assert.throws(() => forecast('100', '10', '5', 0));
});
test('recurrence requires three similarly priced monthly payments', () => {
  const records = [
    row('-12', 'expense', '2026-01-02'),
    row('-12', 'expense', '2026-02-02'),
    row('-12', 'expense', '2026-03-02'),
  ];
  assert.equal(recurring(records).length, 1);
  assert.equal(recurring(records.slice(0, 2)).length, 0);
  assert.equal(recurring([...records.slice(0, 2), row('-100', 'expense', '2026-03-02')]).length, 0);
});
test('CSV formula mitigation preserves signed decimal amounts and quotes', () => {
  assert.equal(safeCsvCell('-12.50'), '"-12.50"');
  assert.equal(safeCsvCell('=cmd()'), '"\'=cmd()"');
  assert.equal(safeCsvCell('  +cmd()'), '"\'  +cmd()"');
  assert.equal(safeCsvCell('A "quote"'), '"A ""quote"""');
});
test('calendar and money validation reject impossible dates and ambiguous numbers', () => {
  assert.equal(dateInput.safeParse('2026-02-31').success, false);
  assert.equal(dateInput.safeParse('2024-02-29').success, true);
  assert.equal(moneyInput.safeParse('1,000.50').success, false);
  assert.equal(moneyInput.safeParse('NaN').success, false);
});
test('CSV import preserves signed source values, mappings and references', async () => {
  const statement = await readStatement(
    new File(
      [
        'Date,Description,Amount,Currency,Reference\n2026-01-01,Synthetic coffee,-4.25,USD,test-1\n',
      ],
      'synthetic.csv',
    ),
  );
  assert.match(statement.hash, /^[a-f0-9]{64}$/);
  const mapping = detectMapping(statement.headers);
  const result = normalizeRow(statement.headers, statement.rows[0], mapping, 'USD', 'ISO');
  assert.equal(result.amount, '-4.25');
  assert.equal(result.description, 'Synthetic coffee');
  assert.equal(result.reference, 'test-1');
  assert.throws(
    () => normalizeRow(statement.headers, statement.rows[0], mapping, 'EUR', 'ISO'),
    /currency/,
  );
  assert.throws(() =>
    normalizeRow(
      statement.headers,
      statement.rows[0],
      { ...mapping, debit: 'Amount' },
      'USD',
      'ISO',
    ),
  );
});
test('file pipeline rejects empty, unsupported and malformed UTF-8 inputs', async () => {
  await assert.rejects(() => readStatement(new File([], 'empty.csv')), /non-empty/);
  await assert.rejects(() => readStatement(new File(['bad'], 'fake.exe')), /Choose CSV/);
  await assert.rejects(() => readStatement(new File([new Uint8Array([255, 254])], 'bad.csv')));
});
test('passwords use salted slow hashing and reject incorrect credentials', async () => {
  const a = await hashPassword('long synthetic password'),
    b = await hashPassword('long synthetic password');
  assert.notEqual(a, b);
  assert.equal(await verifyPassword('long synthetic password', a), true);
  assert.equal(await verifyPassword('incorrect password', a), false);
});
