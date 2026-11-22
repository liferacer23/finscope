import { z } from 'zod';
import { requireSession, rateLimit } from '@/lib/auth';
import { body, failure, HttpError, json } from '@/lib/http';
import { getData } from '@/lib/service';
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    await body(req);
    await rateLimit(req, 'ai-insights', 5, 60);
    if (!process.env.OPENAI_API_KEY)
      throw new HttpError(
        503,
        'AI insights are not configured. The financial insights below use transparent local rules.',
      );
    const data = await getData(session.workspaceId);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        max_tokens: 400,
        messages: [
          {
            role: 'system',
            content:
              'Summarize these aggregate personal finance figures in three short factual sentences. Do not give investment, tax, legal or personalized financial advice. Do not invent data. Figures may be incomplete. This is synthetic data when demo=true.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              demo: data.workspace.demo,
              currency: data.workspace.currency,
              summary: data.summary,
              categories: data.categories,
            }),
          },
        ],
      }),
    });
    if (!response.ok)
      throw new HttpError(502, 'AI provider unavailable. No insight was generated.');
    const result = z
      .object({
        choices: z.array(z.object({ message: z.object({ content: z.string().max(4000) }) })).min(1),
      })
      .parse(await response.json());
    return json({
      text: result.choices[0].message.content,
      source: 'OpenAI · generated from aggregate figures only',
    });
  } catch (e) {
    return failure(e);
  }
}
