import { z } from 'zod';
import { requireSession } from '@/lib/auth';
import { body, failure, HttpError, json } from '@/lib/http';
import { iso } from '@/lib/service';
import { currencyInput, dateInput } from '@/lib/validation';
export async function POST(req: Request) {
  try {
    await requireSession();
    const input = z
      .object({ from: currencyInput, to: currencyInput, date: dateInput })
      .parse(await body(req));
    if (input.from === input.to || input.date > iso(new Date()))
      throw new HttpError(400, 'Choose different currencies and a historical date.');
    const response = await fetch(
      `https://api.frankfurter.dev/v1/${input.date}?base=${input.from}&symbols=${input.to}`,
      { signal: AbortSignal.timeout(8000), cache: 'no-store' },
    );
    if (!response.ok)
      throw new HttpError(
        502,
        'The exchange-rate provider is unavailable. You can enter a verified dated rate manually.',
      );
    const result = z
      .object({ date: dateInput, rates: z.record(z.string(), z.number().positive()) })
      .parse(await response.json());
    const rate = result.rates[input.to];
    if (!rate) throw new HttpError(502, 'No rate is available for that pair.');
    return json({
      message: `Fetched ${input.from}/${input.to} reference rate dated ${result.date}.`,
      date: result.date,
      rate,
    });
  } catch (e) {
    return failure(e);
  }
}
