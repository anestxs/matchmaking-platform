import { HomeActions } from '@/components/home-actions';
import { Logo } from '@/components/logo';

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col justify-center overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/2 size-144 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
        <div className="absolute top-1/3 -right-40 size-96 rounded-full bg-accent/15 blur-3xl" />
      </div>

      <section className="relative mx-auto flex w-full max-w-3xl flex-col items-center gap-7 px-6 py-16 text-center animate-rise-in motion-reduce:animate-none">
        <div className="relative size-20 overflow-hidden rounded-[22%] shadow-2xl shadow-brand/25">
          <Logo size={80} priority />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 animate-shimmer bg-linear-100 from-transparent via-shine/35 to-transparent motion-reduce:hidden"
          />
        </div>

        <span className="inline-flex items-center gap-2.5 rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-muted">
          <span aria-hidden className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75 [animation-duration:2.5s] motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          Rating updates after every match
        </span>

        <h1 className="text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
          Queue with players
          <br />
          <span className="bg-linear-to-r from-brand to-accent bg-clip-text text-transparent">
            at your level
          </span>
        </h1>

        <p className="max-w-xl text-lg text-pretty text-muted">
          Build a party, queue by skill rating, and play ranked matches and tournaments. Ratings
          move with every result, so the next game is tuned to how you actually play.
        </p>

        <HomeActions />
      </section>
    </main>
  );
}
