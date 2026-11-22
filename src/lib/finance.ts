import Decimal from 'decimal.js';
export type MoneyRow = {
  amount: Decimal.Value;
  kind: string;
  category: string;
  date: Date | string;
  merchant: string;
};
export type DatedRate = {
  from: string;
  to: string;
  date: Date | string;
  rate: Decimal.Value;
  source: string;
};
export function convert(
  amount: Decimal.Value,
  from: string,
  to: string,
  date: string,
  rates: DatedRate[],
) {
  if (from === to) return new Decimal(amount);
  const direct = rates
    .filter(
      (r) => r.from === from && r.to === to && new Date(r.date).toISOString().slice(0, 10) <= date,
    )
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))[0];
  if (direct) return new Decimal(amount).mul(direct.rate);
  const inverse = rates
    .filter(
      (r) => r.to === from && r.from === to && new Date(r.date).toISOString().slice(0, 10) <= date,
    )
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))[0];
  return inverse ? new Decimal(amount).div(inverse.rate) : null;
}
export function summarize(rows: MoneyRow[]) {
  let income = new Decimal(0),
    spending = new Decimal(0);
  for (const t of rows) {
    if (t.kind === 'income') income = income.plus(t.amount);
    if (t.kind === 'expense' || t.kind === 'refund') spending = spending.minus(t.amount);
  }
  return {
    income: income.toFixed(2),
    spending: spending.toFixed(2),
    net: income.minus(spending).toFixed(2),
    savingsRate: income.gt(0) ? income.minus(spending).div(income).mul(100).toFixed(1) : null,
  };
}
export function forecast(
  start: Decimal.Value,
  income: Decimal.Value,
  spend: Decimal.Value,
  months: number,
  annualRate: Decimal.Value = '0',
) {
  if (!Number.isInteger(months) || months < 1 || months > 120)
    throw new Error('Forecast horizon must be 1–120 months.');
  const monthly = new Decimal(annualRate).div(1200);
  return [
    { label: 'Conservative', income: '0.9', spend: '1.1' },
    { label: 'Expected', income: '1', spend: '1' },
    { label: 'Optimistic', income: '1.1', spend: '0.9' },
  ].map((s) => {
    let balance = new Decimal(start);
    const points = [{ month: 0, balance: balance.toFixed(2) }];
    for (let m = 1; m <= months; m++) {
      balance = balance
        .plus(new Decimal(income).mul(s.income))
        .minus(new Decimal(spend).mul(s.spend))
        .mul(monthly.plus(1));
      points.push({ month: m, balance: balance.toFixed(2) });
    }
    return { label: s.label, points };
  });
}
export function recurring(rows: MoneyRow[]) {
  const groups = new Map<string, MoneyRow[]>();
  for (const t of rows)
    if (t.kind === 'expense') {
      const key = t.merchant.toLowerCase();
      groups.set(key, [...(groups.get(key) || []), t]);
    }
  return [...groups.entries()].flatMap(([merchant, items]) => {
    const sorted = items.sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 3);
    if (sorted.length < 3) return [];
    const amounts = sorted.map((t) => new Decimal(t.amount).abs());
    const average = amounts.reduce((s, v) => s.plus(v), new Decimal(0)).div(3);
    const gaps = [0, 1].map(
      (i) => (+new Date(sorted[i].date) - +new Date(sorted[i + 1].date)) / 86400000,
    );
    if (
      !gaps.every((g) => g >= 25 && g <= 35) ||
      !amounts.every((a) => a.minus(average).abs().lte(average.mul('0.12')))
    )
      return [];
    return [
      {
        merchant,
        amount: average.toFixed(2),
        next: new Date(+new Date(sorted[0].date) + 30 * 86400000).toISOString().slice(0, 10),
      },
    ];
  });
}
export function safeCsvCell(value: unknown) {
  let s = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(s) && !/^[-+]?\d+(\.\d+)?$/.test(s)) s = "'" + s;
  return `"${s.replaceAll('"', '""')}"`;
}
