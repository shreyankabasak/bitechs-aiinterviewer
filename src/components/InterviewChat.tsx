import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CornerDownLeft, Sparkle } from "lucide-react";
import type { ChatMessage } from "@/types/interview";
import { TOTAL_QUESTIONS } from "@/types/interview";

function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-3 text-[0.94rem] leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: (props) => <p {...props} />,
          strong: (props) => <strong className="font-semibold text-foreground" {...props} />,
          em: (props) => <em className="text-muted-foreground" {...props} />,
          ul: (props) => <ul className="list-disc space-y-1 pl-5" {...props} />,
          ol: (props) => <ol className="list-decimal space-y-1 pl-5" {...props} />,
          a: (props) => <a className="text-accent underline underline-offset-2" {...props} />,
          code: ({ className, children, ...rest }) => {
            const isBlock = /language-/.test(className ?? "");
            if (!isBlock) {
              return (
                <code
                  className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.82em] text-accent"
                  {...rest}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className="font-mono text-[0.82em] leading-relaxed" {...rest}>
                {children}
              </code>
            );
          },
          pre: (props) => (
            <pre
              className="overflow-x-auto rounded-lg border border-border bg-void p-3.5"
              {...props}
            />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-1">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent"
            style={{ animationDelay: `${i * 140}ms` }}
          />
        ))}
      </span>
      <span className="text-xs text-muted-foreground">Agent is thinking…</span>
    </div>
  );
}

interface Props {
  role: string;
  messages: ChatMessage[];
  questionNumber: number;
  isThinking: boolean;
  onSubmitAnswer: (text: string) => void;
}

export function InterviewChat({
  role,
  messages,
  questionNumber,
  isThinking,
  onSubmitAnswer,
}: Props) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const wordCount = useMemo(
    () => draft.trim().split(/\s+/).filter(Boolean).length,
    [draft],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isThinking]);

  useEffect(() => {
    if (!isThinking) inputRef.current?.focus();
  }, [isThinking]);

  const canSubmit = wordCount > 0 && !isThinking;

  const submit = () => {
    if (!canSubmit) return;
    onSubmitAnswer(draft.trim());
    setDraft("");
  };

  const progress = Math.min(questionNumber, TOTAL_QUESTIONS) / TOTAL_QUESTIONS;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto grid w-full max-w-3xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-card">
              <Sparkle className="h-4 w-4 text-accent" strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">Interview Agent</p>
              <p className="truncate text-xs text-muted-foreground">{role}</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground">
            Question {Math.min(questionNumber, TOTAL_QUESTIONS)} of {TOTAL_QUESTIONS}
          </span>
        </div>
        <div className="h-px w-full bg-border">
          <div
            className="h-px bg-accent transition-all duration-700 ease-out"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-5 py-8">
        {messages.map((m) =>
          m.kind === "question" ? (
            <div
              key={m.turn.id}
              className="flex max-w-[92%] flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500 sm:max-w-[80%]"
            >
              <span className="text-[0.7rem] font-medium uppercase tracking-widest text-muted-foreground">
                {m.turn.topic}
              </span>
              <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3.5">
                <Markdown>{m.turn.question}</Markdown>
              </div>
            </div>
          ) : (
            <div
              key={m.answer.id}
              className="ml-auto flex max-w-[92%] flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500 sm:max-w-[80%]"
            >
              <div className="whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-accent px-4 py-3 text-[0.94rem] leading-relaxed text-accent-foreground">
                {m.answer.text}
              </div>
              <span className="text-[0.7rem] text-muted-foreground">
                {m.answer.wordCount} words
              </span>
            </div>
          ),
        )}

        {isThinking && <ThinkingIndicator />}
        <div ref={bottomRef} />
      </main>

      <div className="sticky bottom-0 border-t border-border bg-background/85 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-5 py-4">
          <div className="rounded-xl border border-border bg-card transition-colors focus-within:border-accent/50">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={3}
              placeholder="Type your answer… (Enter to send, Shift+Enter for a new line)"
              className="max-h-56 w-full resize-none bg-transparent px-4 pt-3.5 text-[0.94rem] leading-relaxed outline-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center justify-between gap-3 px-3 pb-3">
              <span className="pl-1 text-xs tabular-nums text-muted-foreground">
                {wordCount} {wordCount === 1 ? "word" : "words"}
              </span>
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="flex h-9 items-center gap-2 rounded-md bg-accent px-3.5 text-sm font-medium text-accent-foreground transition-all hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Submit Answer
                <CornerDownLeft className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
