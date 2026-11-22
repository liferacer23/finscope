import { requireSession } from '@/lib/auth';
import { getData } from '@/lib/service';
import { failure, json } from '@/lib/http';
export async function GET() {
  try {
    const session = await requireSession();
    return json(await getData(session.workspaceId));
  } catch (e) {
    return failure(e);
  }
}
