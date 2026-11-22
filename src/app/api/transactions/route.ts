import { requireSession } from '@/lib/auth';
import { transactionPage } from '@/lib/service';
import { failure, json } from '@/lib/http';
export async function GET(req: Request) {
  try {
    const session = await requireSession();
    return json(await transactionPage(session.workspaceId, new URL(req.url).searchParams));
  } catch (e) {
    return failure(e);
  }
}
