import { useState } from "react";
import { ChevronDown, Sparkle, ArrowRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PRESET_ROLES = [
  "Frontend Developer",
  "Backend Developer",
  "Product Manager",
  "Data Analyst",
  "Marketing",
  "Sales",
] as const;

const CUSTOM = "__custom__";

export function RoleSelector({ onStart }: { onStart: (role: string) => void }) {
  const [selected, setSelected] = useState<string>(PRESET_ROLES[0]);
  const [customRole, setCustomRole] = useState("");

  const isCustom = selected === CUSTOM;
  const role = isCustom ? customRole.trim() : selected;
  const canStart = role.length > 1;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-5 py-16">
      <div className="animate-in fade-in slide-in-from-bottom-3 duration-500">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-card shadow-glow">
            <Sparkle className="h-5 w-5 text-accent" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">Interview Agent</h1>
            <p className="truncate text-sm text-muted-foreground">AI Technical Screener</p>
          </div>
        </div>

        <p className="mt-8 text-balance text-[1.65rem] font-medium leading-tight tracking-tight sm:text-4xl">
          Seven questions.
          <br />
          <span className="text-muted-foreground">One honest readout.</span>
        </p>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
          A live mock screen that adapts to what you say, then scores your readiness with specific
          strengths and gaps — quoted from your own answers.
        </p>

        <div className="mt-10 rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
          <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Interviewing for
          </label>

          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="mt-3 h-11 w-full border-border bg-secondary text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESET_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
              <SelectItem value={CUSTOM}>Custom role…</SelectItem>
            </SelectContent>
          </Select>

          {isCustom && (
            <input
              autoFocus
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canStart) onStart(role);
              }}
              placeholder="e.g. Solutions Architect"
              className="mt-3 h-11 w-full animate-in fade-in slide-in-from-top-1 rounded-md border border-border bg-secondary px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-accent/60"
            />
          )}

          <button
            type="button"
            disabled={!canStart}
            onClick={() => onStart(role)}
            className="group mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent text-sm font-medium text-accent-foreground transition-all hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Start Interview
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        <p className="mt-5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ChevronDown className="h-3.5 w-3.5" />
          Takes about 10 minutes. Nothing is stored.
        </p>
      </div>
    </div>
  );
}
