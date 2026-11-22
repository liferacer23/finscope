import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowRight,
  ChartNoAxesCombined,
  ScanLine,
  ShieldCheck,
  Layers3,
  Globe2,
} from 'lucide-react';
import { DemoButton } from '@/components/auth';
export default function Home() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link href="/" className="wordmark">
          <span className="brand-icon">◈</span>finscope<span className="wordmark-dot">.</span>
        </Link>
        <div>
          <a href="#how-it-works">How it works</a>
          <Link href="/sign-in">Sign in</Link>
          <DemoButton small />
        </div>
      </nav>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="status-dot" /> A FRESH PERSPECTIVE ON YOUR MONEY
            </span>
            <h1>
              Less noise.
              <br />
              More <em>financial clarity.</em>
            </h1>
            <p>
              Your accounts, everyday spending and tomorrow’s possibilities. Finally, a place to see
              how it all connects.
            </p>
            <div className="hero-actions">
              <DemoButton />
              <Link className="button secondary" href="/register">
                Create your workspace <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="hero-trust">
              <ShieldCheck size={16} /> No bank login. No account needed for the demo.
            </div>
            <div className="hero-proof">
              <span>01 /</span> Thoughtful tools for a more intentional financial life.
            </div>
          </div>
          <div className="hero-preview" aria-label="Illustrative financial workspace preview">
            <div className="preview-heading">
              <span>YOUR FINANCIAL PICTURE</span>
              <span className="pill">Illustrative preview</span>
            </div>
            <p className="muted">Everything you’re building towards.</p>
            <div className="preview-total">
              $56,824<span>.32</span>
            </div>
            <div className="positive preview-change">↗ Your accounts, in perspective</div>
            <div className="preview-chart">
              <svg viewBox="0 0 440 150" role="img" aria-label="Illustrative rising savings curve">
                <defs>
                  <linearGradient id="fade" x1="0" x2="0" y1="0" y2="1">
                    <stop stopColor="#a99af8" stopOpacity=".35" />
                    <stop offset="1" stopColor="#a99af8" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 130 C45 134 38 80 85 100 S140 130 170 75 S220 95 255 55 S300 70 340 30 S395 42 440 8 L440 150 L0 150Z"
                  fill="url(#fade)"
                />
                <path
                  d="M0 130 C45 134 38 80 85 100 S140 130 170 75 S220 95 255 55 S300 70 340 30 S395 42 440 8"
                  fill="none"
                  stroke="#9180e8"
                  strokeWidth="3"
                />
              </svg>
              <div>
                <span>JUN</span>
                <span>JUL</span>
                <span>AUG</span>
                <span>SEP</span>
                <span>OCT</span>
                <span>NOV</span>
              </div>
            </div>
            <div className="preview-bottom">
              <div>
                <span className="mini-icon purple">
                  <Layers3 size={18} />
                </span>
                <small>
                  Every account.
                  <br />
                  <strong>One clear picture.</strong>
                </small>
              </div>
              <span className="mini-card">
                <Globe2 size={16} /> Multi-currency
              </span>
            </div>
            <div className="floating-note">
              <span>✦</span>
              <div>
                <strong>A little more confidence.</strong>
                <small>Built on the numbers you can verify.</small>
              </div>
            </div>
          </div>
        </section>
        <section className="landing-features" id="how-it-works">
          {[
            {
              icon: ScanLine,
              title: 'Bring your story together.',
              text: 'Import CSV and supported text-based PDFs. Review mappings, balances and duplicates before anything is saved.',
            },
            {
              icon: ChartNoAxesCombined,
              title: 'Find the signal.',
              text: 'See cash flow, category trends and recurring spending. Every figure traces back to your ledger.',
            },
            {
              icon: ShieldCheck,
              title: 'Move at your own pace.',
              text: 'Try an isolated synthetic workspace. No shared demo records, bank connections or personal data required.',
            },
          ].map((f, i) => (
            <article key={f.title}>
              <span className="feature-number">0{i + 1} —</span>
              <f.icon size={23} />
              <h2>{f.title}</h2>
              <p>{f.text}</p>
            </article>
          ))}
        </section>
        <section className="landing-cta">
          <div>
            <span className="eyebrow">A SMALL STEP. A CLEARER PICTURE.</span>
            <h2>Make room for what matters.</h2>
          </div>
          <DemoButton />
        </section>
      </main>
      <footer className="landing-footer">
        <span className="wordmark">finscope.</span>
        <p>Precision where it counts. Perspective where it matters.</p>
        <Link href="/register">
          Start your own story <ArrowRight size={15} />
        </Link>
      </footer>
    </div>
  );
}
