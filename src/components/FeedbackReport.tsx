import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { CheckCircle2, Copy, Check, Download, RotateCcw, Target, TrendingUp } from "lucide-react";
import type { FeedbackPoint, FeedbackSummary } from "@/types/interview";

function PointCard({ point, tone }: { point: FeedbackPoint; tone: "good" | "work" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium">{point.title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{point.detail}</p>
      <p className="mt-3 text-[0.7rem] font-medium uppercase tracking-widest text-muted-foreground">
        {point.source
          ? `Scored against your answer to Q${point.source.index} · ${point.source.topic}`
          : "From your own answer"}
      </p>
      <blockquote
        className={`mt-1.5 break-words border-l-2 pl-3 text-sm italic leading-relaxed text-muted-foreground ${
          tone === "good" ? "border-accent" : "border-border"
        }`}
      >
        “{point.quote}”
      </blockquote>
    </div>
  );
}

function buildSummaryText(feedback: FeedbackSummary): string {
  const line = (p: FeedbackPoint) =>
    `- ${p.title}${p.source ? ` (Q${p.source.index} · ${p.source.topic})` : ""}\n  "${p.quote}"`;

  return [
    `Interview Agent — ${feedback.role}`,
    `Readiness score: ${feedback.score.toFixed(1)}/10`,
    "",
    feedback.summary,
    "",
    "Strengths:",
    feedback.strengths.length > 0
      ? feedback.strengths.map(line).join("\n")
      : `- ${feedback.strengthsNote ?? "Not enough substantive answers to identify clear strengths."}`,
    "",
    "Areas to improve:",
    feedback.improvements.map(line).join("\n"),
  ].join("\n");
}

export function FeedbackReport({
  feedback,
  onRestart,
}: {
  feedback: FeedbackSummary;
  onRestart: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildSummaryText(feedback));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the summary is still visible on screen */
    }
  };

  const downloadImage = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: getComputedStyle(document.body).backgroundColor,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `interview-agent-${feedback.role.toLowerCase().replace(/\s+/g, "-")}.png`;
      a.click();
    } catch {
      /* export unsupported — copy summary still works */
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-14 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <div ref={cardRef} className="bg-background">
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
          <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
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
            {feedback.strengths.length > 0 ? (
              feedback.strengths.map((p) => <PointCard key={p.title} point={p} tone="good" />)
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-card/50 p-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feedback.strengthsNote ??
                    "Not enough substantive answers this round to identify clear strengths."}
                </p>
              </div>
            )}
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
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={copySummary}
          className="flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-card text-sm font-medium transition-colors hover:border-accent/50"
        >
          {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
          {copied ? "Summary copied" : "Copy summary"}
        </button>
        <button
          type="button"
          onClick={downloadImage}
          disabled={downloading}
          className="flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-card text-sm font-medium transition-colors hover:border-accent/50 disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          {downloading ? "Rendering…" : "Download as image"}
        </button>
      </div>

      <button
        type="button"
        onClick={onRestart}
        className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent text-sm font-medium text-accent-foreground transition-all hover:bg-accent/90"
      >
        <RotateCcw className="h-4 w-4" />
        Start New Interview
      </button>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <TrendingUp className="h-3.5 w-3.5 shrink-0" />
        Every point above is scored against the exact answer text it quotes.
      </p>
    </div>
  );
}
