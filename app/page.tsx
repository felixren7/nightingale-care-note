const glanceItems = [
  {
    tone: 'critical',
    eyebrow: 'Critical risk',
    title: 'Penicillin allergy must be confirmed before prescribing',
    reason: 'Clinician-confirmed allergy · unresolved',
    source: 'Dr Lim · 18 Aug 2026',
  },
  {
    tone: 'action',
    eyebrow: 'Open action',
    title: 'Order HbA1c and renal panel before the next review',
    reason: 'Due in 3 days · assigned to nursing team',
    source: 'Care plan · 21 Aug 2026',
  },
  {
    tone: 'context',
    eyebrow: 'What changed',
    title: 'Night cough increased from twice weekly to nightly',
    reason: 'AI scribe suggestion · awaiting confirmation',
    source: 'Patient AI session · Today, 08:42',
  },
];

const timeline = [
  {
    date: 'Today · 09:18',
    role: 'Clinician',
    title: 'Assessment & plan updated',
    body: 'Symptoms suggest worsening nocturnal asthma. Continue controller inhaler and review after spirometry.',
    accent: 'clinician',
  },
  {
    date: 'Today · 08:42',
    role: 'AI patient session',
    title: 'Pre-consult summary',
    body: 'Patient reports nightly cough, two missed workdays and uncertainty about inhaler technique.',
    accent: 'system',
  },
  {
    date: '21 Aug 2026 · 16:05',
    role: 'Staff',
    title: 'Follow-up coordination',
    body: 'Spirometry slot held for Friday. Waiting for the patient to confirm availability.',
    accent: 'staff',
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <div className="border-b border-[var(--line)] bg-[var(--navy)] text-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--mint)] text-sm font-black text-[var(--navy)]">
              N
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">Nightingale</p>
              <p className="text-[11px] text-slate-300">Shared Care Note</p>
            </div>
          </div>
          <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-100">
            SYNTHETIC DATA · Clinician view
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
        <header className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              <span>Patient record</span>
              <span className="h-1 w-1 rounded-full bg-[var(--muted)]" />
              <span>Central Clinic</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
              Maya Tan
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              36 years · Asthma review · Last contact today at 09:18
            </p>
          </div>
          <div className="flex gap-2">
            <button className="rounded-xl border border-[var(--line)] bg-white px-4 py-2.5 text-sm font-semibold shadow-sm">
              View history
            </button>
            <button className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm">
              Add care note
            </button>
          </div>
        </header>

        <section className="glance-shell mb-7 overflow-hidden rounded-[24px] border border-[var(--line)] bg-white shadow-[0_18px_50px_rgba(16,35,51,0.08)]">
          <div className="flex flex-col justify-between gap-4 border-b border-[var(--line)] bg-[linear-gradient(105deg,#102638_0%,#18394c_58%,#1e4e56_100%)] px-5 py-5 text-white sm:flex-row sm:items-center lg:px-7">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
                Consult glance · 10-second view
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">
                What needs attention now
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-200">
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_0_4px_rgba(110,231,183,0.14)]" />
              Updated from 14 care events
            </div>
          </div>

          <div className="grid gap-3 p-4 lg:grid-cols-3 lg:p-5">
            {glanceItems.map((item) => (
              <article key={item.title} className={`glance-card ${item.tone}`}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="eyebrow">{item.eyebrow}</span>
                  <span className="source-dot" aria-hidden="true" />
                </div>
                <h3 className="text-[15px] font-semibold leading-6 tracking-[-0.012em]">
                  {item.title}
                </h3>
                <p className="mt-3 text-xs leading-5 text-[var(--muted)]">{item.reason}</p>
                <button className="mt-4 text-xs font-bold text-[var(--link)]">
                  View source → {item.source}
                </button>
              </article>
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
          <section>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="section-kicker">Longitudinal timeline</p>
                <h2 className="text-xl font-semibold tracking-tight">Patient story</h2>
              </div>
              <button className="text-xs font-bold text-[var(--link)]">Filter entries</button>
            </div>
            <div className="space-y-3">
              {timeline.map((entry) => (
                <article key={`${entry.date}-${entry.title}`} className="timeline-card">
                  <div className={`timeline-mark ${entry.accent}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                        {entry.role}
                      </p>
                      <time className="text-xs text-[var(--muted)]">{entry.date}</time>
                    </div>
                    <h3 className="mt-2 font-semibold">{entry.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{entry.body}</p>
                    <div className="mt-4 flex gap-4 text-xs font-semibold text-[var(--link)]">
                      <button>Comment</button>
                      <button>Version 2</button>
                      <button>Source</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="space-y-5">
            <section className="side-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="section-kicker">Open actions</p>
                  <h2 className="text-lg font-semibold">Care coordination</h2>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">2 open</span>
              </div>
              <div className="mt-4 space-y-3">
                <label className="task-row">
                  <input type="checkbox" />
                  <span>
                    <strong>Confirm spirometry slot</strong>
                    <small>Aisha · due tomorrow</small>
                  </span>
                </label>
                <label className="task-row">
                  <input type="checkbox" />
                  <span>
                    <strong>Order HbA1c + renal panel</strong>
                    <small>Nursing team · due Friday</small>
                  </span>
                </label>
              </div>
            </section>

            <section className="side-card border-l-4 border-l-[var(--mint-strong)]">
              <p className="section-kicker">Trust signal</p>
              <h2 className="text-lg font-semibold">Every insight is traceable</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Highlights preserve the source entry, exact version and text span. AI suggestions never overwrite clinician notes.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
