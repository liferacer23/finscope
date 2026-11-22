import { requireSession } from '@/lib/auth';
import { execute } from '@/lib/service';
import { body, failure, json } from '@/lib/http';
import { actionInput } from '@/lib/validation';
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const input = actionInput.parse(await body(req));
    return json(await execute(session.workspaceId, input));
  } catch (e) {
    return failure(e);
  }
}
