import { CheckCircle2, RotateCcw, Target, TrendingUp } from "lucide-react";
import type { FeedbackPoint, FeedbackSummary } from "@/types/interview";

function PointCard({ point, tone }: { point: FeedbackPoint; tone: "good" | "work" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium">{point.title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{point.detail}</p>
      <blockquote
        className={`mt-3 border-l-2 pl-3 text-sm italic leading-relaxed text-muted-foreground ${
          tone === "good" ? "border-accent" : "border-border"
        }`}
      >
        “{point.quote}”
      </blockquote>
    </div>
  );
}

export function FeedbackReport({
  feedback,
  onRestart,
}: {
  feedback: FeedbackSummary;
  onRestart: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-14 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Screen complete · {feedback.role}
      </span>

      <div className="mt-4 rounded-2xl border border-border bg-card p-6 shadow-glow">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Readiness score</p>
            <p className="mt-1 text-sm leading-relaxed">{feedback.summary}</p>
          </div>
          <div className="shrink-0 text-right">
            <span className="font-mono text-4xl font-semibold text-accent tabular-nums sm:text-5xl">
              {feedback.score.toFixed(1)}
            </span>
            <span className="text-sm text-muted-foreground">/10</span>
          </div>
        </div>
        <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-accent transition-all duration-1000 ease-out"
            style={{ width: `${feedback.score * 10}%` }}
          />
        </div>
      </div>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="h-4 w-4 text-accent" />
          Strengths
        </h2>
        <div className="mt-3 space-y-3">
          {feedback.strengths.map((p) => (
            <PointCard key={p.title} point={p} tone="good" />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Target className="h-4 w-4 text-muted-foreground" />
          Areas to improve
        </h2>
        <div className="mt-3 space-y-3">
          {feedback.improvements.map((p) => (
            <PointCard key={p.title} point={p} tone="work" />
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={onRestart}
        className="mt-10 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent text-sm font-medium text-accent-foreground transition-all hover:bg-accent/90"
      >
        <RotateCcw className="h-4 w-4" />
        Start New Interview
      </button>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <TrendingUp className="h-3.5 w-3.5" />
        Scores are generated from your answer depth, specificity and range.
      </p>
    </div>
  );
}
