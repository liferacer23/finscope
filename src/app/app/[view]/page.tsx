import { notFound, redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { HttpError } from '@/lib/http';
import { Workspace } from '@/components/workspace';
export const dynamic = 'force-dynamic';
export default async function Page({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  if (
    ![
      'overview',
      'transactions',
      'accounts',
      'imports',
      'budgets',
      'goals',
      'insights',
      'forecast',
      'settings',
    ].includes(view)
  )
    notFound();
  try {
    await requireSession();
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) redirect('/sign-in');
    throw e;
  }
  return <Workspace view={view} />;
}
