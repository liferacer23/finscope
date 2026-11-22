import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'FinScope — See the bigger financial picture', template: '%s · FinScope' },
  description:
    'A financial intelligence workspace with precision accounting, statement imports, budgets and isolated demos.',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
