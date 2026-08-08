import type {
  CandidateAnswer,
  FeedbackPoint,
  FeedbackSummary,
  InterviewTurn,
  QuestionCategory,
  ResponseKind,
} from "@/types/interview";
import { TOTAL_QUESTIONS } from "@/types/interview";

/**
 * Mock interview engine.
 *
 * Simulates a stateful AI interviewer: it tracks everything the candidate has
 * said so far and uses it to shape the next question. Swap the bodies of
 * `getNextQuestion` and `getFeedback` for real model calls later — the async
 * signatures are already API-shaped.
 */

const uid = () => Math.random().toString(36).slice(2, 10);

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)]!;

const STOP_WORDS = new Set([
  "the",
  "and",
  "that",
  "with",
  "this",
  "from",
  "have",
  "would",
  "there",
  "which",
  "about",
  "been",
  "were",
  "they",
  "because",
  "just",
  "really",
  "when",
  "what",
  "some",
  "into",
  "then",
  "also",
  "them",
  "than",
  "your",
  "only",
  "very",
  "much",
  "more",
  "like",
  "make",
  "made",
  "using",
  "used",
  "able",
  "after",
  "before",
  "could",
  "should",
  "while",
  "where",
  "being",
  "over",
  "most",
  "many",
  "such",
  "things",
  "thing",
  "stuff",
  "kind",
  "sort",
  "lot",
  "time",
  "team",
  "work",
  "working",
]);

function keywords(text: string, limit = 3): string[] {
  const counts = new Map<string, number>();
  for (const raw of text.toLowerCase().match(/[a-z][a-z0-9+.#-]{3,}/g) ?? []) {
    if (STOP_WORDS.has(raw)) continue;
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([word]) => word);
}

function quoteFrom(answer: CandidateAnswer | undefined, fallback: string): string {
  if (!answer) return fallback;
  const sentence =
    answer.text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 12)
      .sort((a, b) => b.length - a.length)[0] ?? answer.text.trim();
  const words = sentence.split(/\s+/);
  const clipped = words.slice(0, 18).join(" ");
  return words.length > 18 ? `${clipped}…` : clipped || fallback;
}

/* ------------------------------------------------------------------ */
/* 1. Response classification                                          */
/* ------------------------------------------------------------------ */

const CLARIFICATION_PATTERNS = [
  /don'?t (quite )?(understand|get) (the |this )?(question|it|that)/i,
  /\bcan you (please )?(repeat|rephrase|reword|clarify|explain)\b/i,
  /\bcould you (please )?(repeat|rephrase|reword|clarify|explain)\b/i,
  /\bwhat do you mean\b/i,
  /\bnot (quite )?clear\b/i,
  /\bunclear\b/i,
  /\bconfused (by|about) (the )?question\b/i,
  /\bi'?m confused\b/i,
  /\bsay that again\b/i,
  /\brephrase\b/i,
  /\bwhat exactly are you asking\b/i,
  /\bdon'?t understand\b/i,
];

const NON_ANSWER_PATTERNS = [
  /\bi (really )?don'?t know\b/i,
  /\bno idea\b/i,
  /\bnot sure\b/i,
  /\bi'?m unsure\b/i,
  /\bnever (done|worked|used|tried)\b/i,
  /\bno experience\b/i,
  /\bnot confident\b/i,
  /\bcan'?t (really )?(say|answer)\b/i,
  /\bpass\b/i,
  /\bskip (this|that)\b/i,
  /\bnothing comes to mind\b/i,
  /\bhaven'?t (done|had) (this|that|any)\b/i,
];

/** Words that signal an actual technical/decision-bearing attempt. */
const SUBSTANCE_PATTERNS =
  /\b(because|so that|instead|trade[- ]?off|decided|measured|implemented|designed|migrated|reduced|increased|debug|latency|cache|index|query|api|schema|state|render|test|deploy|metric|conversion|pipeline|customer|stakeholder|experiment|root cause)\b/i;

/**
 * Classify a candidate response before any scoring happens.
 * - `clarification` → they don't understand the question
 * - `non-answer`    → they understood but have nothing to offer
 * - `real`          → a substantive attempt, strong or weak
 */
export function classifyResponse(text: string): ResponseKind {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);

  if (CLARIFICATION_PATTERNS.some((re) => re.test(trimmed))) return "clarification";
  if (NON_ANSWER_PATTERNS.some((re) => re.test(trimmed))) return "non-answer";

  // Short and empty of technical content = non-answer.
  if (words.length < 15 && !SUBSTANCE_PATTERNS.test(trimmed) && !/\d/.test(trimmed)) {
    return "non-answer";
  }

  return "real";
}

/** A "real" answer that actually carries evidence worth praising. */
function isSubstantive(a: CandidateAnswer): boolean {
  if (a.kind !== "real") return false;
  return a.wordCount >= 35 || (/\d/.test(a.text) && SUBSTANCE_PATTERNS.test(a.text));
}

/* ------------------------------------------------------------------ */
/* 2. Question pools                                                   */
/* ------------------------------------------------------------------ */

interface QuestionTemplate {
  id: string;
  topic: string;
  build: (ctx: { role: string; focus?: string | undefined }) => string;
}

const focusLine = (focus: string | undefined, phrase: string) =>
  focus ? ` ${phrase.replace("%s", `**${focus}**`)}` : "";

const WARMUP_POOL: QuestionTemplate[] = [
  {
    id: "w1",
    topic: "Warm-up",
    build: ({ role }) =>
      `Thanks for making time today. I'll be running your **${role}** screen — 7 questions, conversational, no trick puzzles.\n\nTo start: walk me through a project you shipped as a ${role.toLowerCase()} that you're genuinely proud of. What was the problem, and what was *your* specific contribution?`,
  },
  {
    id: "w2",
    topic: "Warm-up",
    build: ({ role }) =>
      `Good to meet you. This is your **${role}** screen — 7 questions, and I'd rather hear specifics than polish.\n\nStart me here: what are you working on right now, and what's the hardest unresolved part of it?`,
  },
  {
    id: "w3",
    topic: "Warm-up",
    build: ({ role }) =>
      `Let's get going — **${role}** screen, 7 questions, conversational throughout.\n\nFirst: pick the last twelve months of your work and tell me the one thing you'd put on a single slide. Why that one?`,
  },
  {
    id: "w4",
    topic: "Warm-up",
    build: ({ role }) =>
      `Welcome. I'll run you through a **${role}** screen — 7 questions, no gotchas.\n\nOpening one: how would a teammate describe what you're the go-to person for? Give me the story behind that reputation.`,
  },
];

const CLOSING_POOL: QuestionTemplate[] = [
  {
    id: "c1",
    topic: "Closing",
    build: ({ focus }) =>
      `Last one.${focusLine(focus, "Before we wrap, you kept coming back to %s — noted.")}\n\nIf you joined and had 90 days to make one visible impact, what would you pick, and how would you know it worked?`,
  },
  {
    id: "c2",
    topic: "Closing",
    build: ({ focus }) =>
      `Final question.${focusLine(focus, "You leaned on %s a lot — useful signal.")}\n\nWhat's the environment where you do your best work, and what's the environment where you'd stall?`,
  },
  {
    id: "c3",
    topic: "Closing",
    build: ({ role }) =>
      `We're at the last one.\n\nIf I asked your last manager where you still need to grow as a ${role.toLowerCase()}, what would they say — and do you agree with them?`,
  },
  {
    id: "c4",
    topic: "Closing",
    build: ({ focus }) =>
      `Wrapping up.${focusLine(focus, "Keep %s in mind if it helps.")}\n\nWhat should I have asked you that I didn't? Answer your own question.`,
  },
];

type CoreCategory = "core-a" | "core-b" | "scenario" | "behavioral" | "tradeoff";

type RolePool = Record<CoreCategory, QuestionTemplate[]>;

const GENERIC_POOL: RolePool = {
  "core-a": [
    {
      id: "g-a1",
      topic: "Depth",
      build: ({ role, focus }) =>
        `Let's go deeper.${focusLine(focus, "You mentioned %s — start there.")}\n\nWhat does excellent work look like in a ${role} role, and where do most people fall short of it?`,
    },
    {
      id: "g-a2",
      topic: "Craft",
      build: ({ role }) =>
        `What's a strong opinion you hold about how ${role.toLowerCase()} work should be done that others on your teams have disagreed with?`,
    },
    {
      id: "g-a3",
      topic: "Fundamentals",
      build: ({ role }) =>
        `Teach me something core to being a ${role.toLowerCase()} as if I were competent but new. Pick the concept people most often get wrong.`,
    },
  ],
  "core-b": [
    {
      id: "g-b1",
      topic: "Problem solving",
      build: ({ role }) =>
        `Describe the hardest problem you've solved as a ${role.toLowerCase()}. What made it hard, and what was your first move?`,
    },
    {
      id: "g-b2",
      topic: "Problem solving",
      build: () =>
        "Tell me about something you inherited that was in bad shape. How did you decide what to fix first?",
    },
    {
      id: "g-b3",
      topic: "Diagnosis",
      build: () =>
        "Something you own is clearly underperforming but nobody can agree why. Walk me through your first week of investigation.",
    },
  ],
  scenario: [
    {
      id: "g-s1",
      topic: "Scenario",
      build: () =>
        "Your deadline just moved forward two weeks and nothing was descoped. What are the first three things you do?",
    },
    {
      id: "g-s2",
      topic: "Scenario",
      build: () =>
        "You're two days in and realise the approach you argued for isn't going to work. What now, and who hears about it first?",
    },
    {
      id: "g-s3",
      topic: "Scenario",
      build: () =>
        'A dependency you rely on is late and the owner keeps saying "almost done". How do you handle it?',
    },
  ],
  behavioral: [
    {
      id: "g-h1",
      topic: "Collaboration",
      build: () =>
        "Describe a disagreement with a teammate you couldn't resolve quickly. How did it end, and what would you change?",
    },
    {
      id: "g-h2",
      topic: "Feedback",
      build: () =>
        "What's the most useful piece of critical feedback you've received? What did you actually change afterwards?",
    },
    {
      id: "g-h3",
      topic: "Growth",
      build: ({ focus }) =>
        `What's a skill you've deliberately built in the last year${focus ? `, perhaps around **${focus}**` : ""}? How did you practise it?`,
    },
  ],
  tradeoff: [
    {
      id: "g-t1",
      topic: "Trade-offs",
      build: () =>
        "Tell me about a decision where you had to choose speed over quality. How did you make the call, and what did it cost you later?",
    },
    {
      id: "g-t2",
      topic: "Judgment",
      build: () =>
        "When do you escalate versus absorb the problem yourself? Give me a case where you got that boundary wrong.",
    },
    {
      id: "g-t3",
      topic: "Judgment",
      build: () =>
        "Describe a time you said no to something reasonable. What was the reasoning, and how did it land?",
    },
  ],
};

const ROLE_POOLS: Record<string, RolePool> = {
  "Frontend Developer": {
    "core-a": [
      {
        id: "fe-a1",
        topic: "Rendering & state",
        build: ({ focus }) =>
          `Let's go deeper on the engineering.${focusLine(focus, "You mentioned %s — hold that in mind.")}\n\nHow do you decide where a piece of state should live: local component state, a shared store, or the server? Give me a concrete example where you got that call wrong the first time.`,
      },
      {
        id: "fe-a2",
        topic: "Component design",
        build: () =>
          "How do you decide when a component should be split? Show me the smell that tells you a component has grown past its job.",
      },
      {
        id: "fe-a3",
        topic: "Data fetching",
        build: () =>
          "Client cache, server render, or both — how do you pick for a given screen? What breaks when teams choose wrong?",
      },
      {
        id: "fe-a4",
        topic: "Typing & safety",
        build: () =>
          "Where does TypeScript actually earn its cost in a UI codebase, and where do you see teams write types that prove nothing?",
      },
    ],
    "core-b": [
      {
        id: "fe-b1",
        topic: "Performance",
        build: () =>
          "A page you own has a Largest Contentful Paint of 4.2s on mid-tier mobile. Talk me through your diagnostic path — what do you measure first, and what are the two most likely culprits you'd expect to find?",
      },
      {
        id: "fe-b2",
        topic: "Code reasoning",
        build: () =>
          "Quick code read:\n\n```tsx\nfunction Search({ query }: { query: string }) {\n  const [results, setResults] = useState<Item[]>([]);\n\n  useEffect(() => {\n    fetch(`/api/search?q=${query}`)\n      .then((r) => r.json())\n      .then(setResults);\n  }, [query]);\n\n  return <List items={results} />;\n}\n```\n\nWhat breaks in production here, and how would you fix it?",
      },
      {
        id: "fe-b3",
        topic: "Accessibility & craft",
        build: () =>
          "You're building a custom dropdown because the design won't work with a native `<select>`. What does *done* look like — keyboard, screen reader, focus management? Where do teams usually cut corners?",
      },
      {
        id: "fe-b4",
        topic: "Rendering bugs",
        build: () =>
          "A list re-renders on every keystroke in an unrelated input and the page feels sticky. How do you confirm the cause before you touch any code?",
      },
    ],
    scenario: [
      {
        id: "fe-s1",
        topic: "Scenario",
        build: () =>
          "Checkout is throwing a white screen for ~2% of users and you can't reproduce it locally. What's your next hour?",
      },
      {
        id: "fe-s2",
        topic: "Scenario",
        build: () =>
          "A third-party script added by marketing doubled your bundle's blocking time. How do you handle it — technically and politically?",
      },
      {
        id: "fe-s3",
        topic: "Scenario",
        build: () =>
          "The design system team ships a breaking change mid-sprint. Walk me through your migration plan for a 200-component app.",
      },
    ],
    behavioral: [
      {
        id: "fe-h1",
        topic: "Collaboration",
        build: ({ focus }) =>
          `Design hands you a spec that will cost two extra weeks for an animation nobody asked for.${focusLine(focus, "Assume the same team dynamic you described around %s.")} How do you handle that conversation?`,
      },
      {
        id: "fe-h2",
        topic: "Code review",
        build: () =>
          "Tell me about a review where you pushed back hard. What was at stake, and how did you keep it about the code?",
      },
      {
        id: "fe-h3",
        topic: "Ownership",
        build: () =>
          "Describe a UI bug that was technically someone else's, but you fixed anyway. Why that one?",
      },
    ],
    tradeoff: [
      {
        id: "fe-t1",
        topic: "Trade-offs",
        build: () =>
          "When is it right to ship an inaccessible-but-working UI and follow up later? Defend your line.",
      },
      {
        id: "fe-t2",
        topic: "Trade-offs",
        build: () =>
          "Rewrite versus incremental refactor on a legacy screen — what evidence would move you to a rewrite?",
      },
      {
        id: "fe-t3",
        topic: "Judgment",
        build: () =>
          "Adding a library saves a week now but adds 40kb forever. How do you decide, and who else gets a vote?",
      },
    ],
  },

  "Backend Developer": {
    "core-a": [
      {
        id: "be-a1",
        topic: "System design",
        build: ({ focus }) =>
          `Let's talk architecture.${focusLine(focus, "Building on your point about %s:")}\n\nDesign the write path for a service ingesting 5k events/sec that must never lose an event. What are your components, and where's the durability boundary?`,
      },
      {
        id: "be-a2",
        topic: "Data modelling",
        build: () =>
          "When do you reach for a relational schema over a document store — and can you describe a time you picked wrong and had to migrate? What did the migration actually cost?",
      },
      {
        id: "be-a3",
        topic: "API design",
        build: () =>
          "You're designing a public API that other teams will build on for years. What do you get right on day one because it's expensive to change later?",
      },
      {
        id: "be-a4",
        topic: "Concurrency",
        build: () =>
          "Two requests update the same row from different services. Talk me through how you keep that correct — and what you'd never rely on.",
      },
    ],
    "core-b": [
      {
        id: "be-b1",
        topic: "Debugging",
        build: () =>
          "p99 latency on one endpoint jumped from 80ms to 1.4s overnight. p50 is unchanged. What's your hypothesis list, ordered, and how do you confirm the top one?",
      },
      {
        id: "be-b2",
        topic: "Reliability",
        build: () =>
          'Walk me through how you\'d make this idempotent:\n\n```http\nPOST /v1/payments\n{ "amount": 4200, "currency": "usd", "customer": "cus_123" }\n```\n\nWhat happens when the client retries after a network timeout?',
      },
      {
        id: "be-b3",
        topic: "Query performance",
        build: () =>
          "A query that ran in 20ms last month now takes 3s and the code hasn't changed. What do you look at, in what order?",
      },
      {
        id: "be-b4",
        topic: "Failure modes",
        build: () =>
          "Your service depends on a third-party API that starts timing out intermittently. What does correct behaviour look like for your callers?",
      },
    ],
    scenario: [
      {
        id: "be-s1",
        topic: "Scenario",
        build: () =>
          "A migration you ran half-completed and then failed in production. Nobody has run a rollback before. What do you do, in order?",
      },
      {
        id: "be-s2",
        topic: "Scenario",
        build: () =>
          "Queue depth is climbing and consumers are keeping up in CPU but not throughput. Walk me through triage.",
      },
      {
        id: "be-s3",
        topic: "Scenario",
        build: () =>
          "You discover a background job has been silently dropping 1 in 500 records for months. What's your first move, and who do you tell?",
      },
    ],
    behavioral: [
      {
        id: "be-h1",
        topic: "Ownership",
        build: ({ focus }) =>
          `Tell me about an incident you owned end to end.${focusLine(focus, "If it relates to %s, even better.")} What was the root cause, and what changed structurally afterwards?`,
      },
      {
        id: "be-h2",
        topic: "Collaboration",
        build: () =>
          "A frontend team wants an endpoint shaped in a way that will hurt you later. How does that conversation go?",
      },
      {
        id: "be-h3",
        topic: "Mentoring",
        build: () =>
          "Tell me about a time you helped someone level up on system design. What did you actually do, week to week?",
      },
    ],
    tradeoff: [
      {
        id: "be-t1",
        topic: "Trade-offs",
        build: () =>
          "Consistency versus availability on a feature your business depends on — give me a real case where you chose and what you gave up.",
      },
      {
        id: "be-t2",
        topic: "Trade-offs",
        build: () => "When is a monolith the right answer in 2026? Argue it properly.",
      },
      {
        id: "be-t3",
        topic: "Judgment",
        build: () =>
          "How much test coverage is enough before you ship a payments change? Where's your line and why there?",
      },
    ],
  },

  "Product Manager": {
    "core-a": [
      {
        id: "pm-a1",
        topic: "Prioritisation",
        build: ({ focus }) =>
          `Let's get into the craft.${focusLine(focus, "You brought up %s — useful context.")}\n\nYou have one engineering team and four stakeholders each convinced their request is critical. How do you decide, and how do you tell the other three?`,
      },
      {
        id: "pm-a2",
        topic: "Discovery",
        build: () =>
          "Describe the last time customer research genuinely changed your roadmap. What was the belief before, what did you hear, and what did you kill?",
      },
      {
        id: "pm-a3",
        topic: "Strategy",
        build: () =>
          "How do you turn a vague company goal into a roadmap a team can actually execute? Use a real example.",
      },
      {
        id: "pm-a4",
        topic: "Scoping",
        build: () =>
          "Take a feature you shipped and tell me what you cut from v1 — and how you knew it was safe to cut.",
      },
    ],
    "core-b": [
      {
        id: "pm-b1",
        topic: "Metrics",
        build: () =>
          "Activation is up 18% but 30-day retention is flat. What's your read, and what's the first experiment you run?",
      },
      {
        id: "pm-b2",
        topic: "Metrics",
        build: () =>
          "Your north-star metric is going up and support tickets are going up with it. How do you work out whether that's good?",
      },
      {
        id: "pm-b3",
        topic: "Experimentation",
        build: () =>
          "An A/B test comes back flat. Walk me through everything you check before concluding the feature doesn't matter.",
      },
      {
        id: "pm-b4",
        topic: "Requirements",
        build: () =>
          "Engineering says the spec is ambiguous three days into the sprint. What did you likely miss, and how do you fix it in the moment?",
      },
    ],
    scenario: [
      {
        id: "pm-s1",
        topic: "Scenario",
        build: () =>
          "Two weeks from launch, your biggest customer asks for a change that breaks your design. How do you handle it?",
      },
      {
        id: "pm-s2",
        topic: "Scenario",
        build: () =>
          "A competitor ships your Q3 roadmap in Q1. What actually changes in your plan, and what doesn't?",
      },
      {
        id: "pm-s3",
        topic: "Scenario",
        build: () =>
          "Your engineers say the estimate is 10 weeks; leadership budgeted 4. Walk me through the next 48 hours.",
      },
    ],
    behavioral: [
      {
        id: "pm-h1",
        topic: "Influence",
        build: ({ focus }) =>
          `Tell me about a time you were wrong about a product bet${focus ? ` — ideally something near **${focus}**` : ""}. How did you find out, and how fast did you change course?`,
      },
      {
        id: "pm-h2",
        topic: "Influence",
        build: () =>
          "Describe convincing a skeptical engineering lead to build something they thought was pointless.",
      },
      {
        id: "pm-h3",
        topic: "Conflict",
        build: () =>
          "Tell me about a stakeholder relationship that went badly. What was your part in it?",
      },
    ],
    tradeoff: [
      {
        id: "pm-t1",
        topic: "Trade-offs",
        build: () =>
          "Ship a rough version in two weeks, or a polished one in eight. Give me the framework you use to decide — and a case where you chose the slower path on purpose.",
      },
      {
        id: "pm-t2",
        topic: "Trade-offs",
        build: () =>
          "New customer acquisition versus retention of existing accounts, one quarter of capacity. How do you argue your split?",
      },
      {
        id: "pm-t3",
        topic: "Judgment",
        build: () => "When do you kill a feature that a small but loud group of users love?",
      },
    ],
  },

  "Data Analyst": {
    "core-a": [
      {
        id: "da-a1",
        topic: "Analysis approach",
        build: ({ focus }) =>
          `Let's dig into your analytical process.${focusLine(focus, "Keep %s in frame.")}\n\nA stakeholder asks "why did signups drop last week?" You have raw event data and two hours. What do you actually do?`,
      },
      {
        id: "da-a2",
        topic: "Data modelling",
        build: () =>
          "How do you structure an events table so that analysts a year from now don't have to ask you what a column means?",
      },
      {
        id: "da-a3",
        topic: "Data quality",
        build: () =>
          "You get a dashboard number that looks too good. Walk me through how you verify it before anyone else sees it.",
      },
      {
        id: "da-a4",
        topic: "Metric definition",
        build: () =>
          'Two teams report different values for "active users". How do you resolve that, and what do you ship so it doesn\'t recur?',
      },
    ],
    "core-b": [
      {
        id: "da-b1",
        topic: "SQL reasoning",
        build: () =>
          "What's wrong with this, and what would you write instead?\n\n```sql\nSELECT user_id, COUNT(*) AS orders\nFROM orders o\nLEFT JOIN refunds r ON r.order_id = o.id\nWHERE o.created_at > NOW() - INTERVAL '30 days'\nGROUP BY user_id\nORDER BY orders DESC;\n```",
      },
      {
        id: "da-b2",
        topic: "Rigour",
        build: () =>
          "How do you tell a real signal from noise in a small-sample A/B test? Have you ever had to talk a team out of shipping on a result you didn't trust?",
      },
      {
        id: "da-b3",
        topic: "SQL reasoning",
        build: () =>
          "You need last-touch attribution per user over 90 days of events. Describe the query shape and where it gets expensive.",
      },
      {
        id: "da-b4",
        topic: "Statistics",
        build: () =>
          "A cohort's average order value jumped 30%. Before you tell anyone, what alternative explanations do you rule out?",
      },
    ],
    scenario: [
      {
        id: "da-s1",
        topic: "Scenario",
        build: () =>
          "A number you published last quarter turns out to be wrong. Leadership made a decision on it. What do you do?",
      },
      {
        id: "da-s2",
        topic: "Scenario",
        build: () =>
          'Three teams ask you for "quick pulls" the same morning and all of them are blocked. How do you triage?',
      },
      {
        id: "da-s3",
        topic: "Scenario",
        build: () =>
          "Tracking broke silently two weeks ago and nobody noticed. How do you salvage the analysis you were asked for?",
      },
    ],
    behavioral: [
      {
        id: "da-h1",
        topic: "Communication",
        build: () =>
          "You've found something that contradicts what leadership believes. Walk me through how you present it — structure, framing, what you lead with.",
      },
      {
        id: "da-h2",
        topic: "Impact",
        build: ({ focus }) =>
          `What's an analysis you did that actually changed a decision${focus ? `, ideally involving **${focus}**` : ""}? How did you know it landed?`,
      },
      {
        id: "da-h3",
        topic: "Collaboration",
        build: () =>
          "Tell me about a stakeholder who kept asking the wrong question. How did you redirect them?",
      },
    ],
    tradeoff: [
      {
        id: "da-t1",
        topic: "Trade-offs",
        build: () =>
          "A rough answer today or a rigorous one on Friday. How do you decide, and how do you communicate the uncertainty?",
      },
      {
        id: "da-t2",
        topic: "Trade-offs",
        build: () =>
          "When is it worth building a proper pipeline versus a one-off script? Give me your threshold.",
      },
      {
        id: "da-t3",
        topic: "Judgment",
        build: () =>
          "How much do you let a stakeholder's hypothesis shape your analysis before it becomes bias?",
      },
    ],
  },

  Marketing: {
    "core-a": [
      {
        id: "mk-a1",
        topic: "Positioning",
        build: ({ focus }) =>
          `Let's talk positioning.${focusLine(focus, "You mentioned %s — hold onto that.")}\n\nTake a product you've marketed: who was it *not* for, and how did that sharpen the message?`,
      },
      {
        id: "mk-a2",
        topic: "Audience",
        build: () =>
          "How do you build a picture of a buyer you've never met? What do you do that isn't just reading existing personas?",
      },
      {
        id: "mk-a3",
        topic: "Messaging",
        build: () =>
          "Take a category where every competitor sounds identical. How do you find a claim that's both true and different?",
      },
      {
        id: "mk-a4",
        topic: "Craft",
        build: () =>
          'Rewrite this headline out loud for me and explain your edit: *"We help teams do more with less using AI-powered workflow automation."*',
      },
    ],
    "core-b": [
      {
        id: "mk-b1",
        topic: "Channels",
        build: () =>
          "You get $20k and one quarter to find a repeatable acquisition channel from scratch. What's your sequence, and what's your kill criterion for each test?",
      },
      {
        id: "mk-b2",
        topic: "Measurement",
        build: () =>
          "Attribution is messy and your CAC number is contested. How do you build a measurement story leadership will actually trust?",
      },
      {
        id: "mk-b3",
        topic: "Funnel",
        build: () => "Traffic is up 60% and signups are flat. What's your diagnostic order?",
      },
      {
        id: "mk-b4",
        topic: "Lifecycle",
        build: () =>
          "Design the first 14 days of onboarding email for a self-serve product. What are you actually optimising?",
      },
    ],
    scenario: [
      {
        id: "mk-s1",
        topic: "Scenario",
        build: () =>
          "A launch is in ten days and the product won't have the headline feature. What's your play?",
      },
      {
        id: "mk-s2",
        topic: "Scenario",
        build: () =>
          "Paid performance collapses the week your budget doubles. Walk me through your response.",
      },
      {
        id: "mk-s3",
        topic: "Scenario",
        build: () =>
          "Sales says the leads you send are junk. Leads are at target. How do you get to the truth?",
      },
    ],
    behavioral: [
      {
        id: "mk-h1",
        topic: "Learning",
        build: ({ focus }) =>
          `Tell me about a campaign that flopped${focus ? ` — bonus if **${focus}** was involved` : ""}. What was the actual lesson, not the polite one?`,
      },
      {
        id: "mk-h2",
        topic: "Collaboration",
        build: () =>
          "Describe working with a founder or exec who wanted the message their way. How did you land it?",
      },
      {
        id: "mk-h3",
        topic: "Ownership",
        build: () =>
          "Tell me about a number you were personally on the hook for. Did you hit it, and what did you learn either way?",
      },
    ],
    tradeoff: [
      {
        id: "mk-t1",
        topic: "Trade-offs",
        build: () =>
          "Brand versus performance when the quarter is short. How do you split, and how do you defend the brand half?",
      },
      {
        id: "mk-t2",
        topic: "Trade-offs",
        build: () =>
          "One big launch or twelve small experiments with the same budget? Argue your side.",
      },
      {
        id: "mk-t3",
        topic: "Judgment",
        build: () => "When do you cut a channel that's working but not scaling?",
      },
    ],
  },

  Sales: {
    "core-a": [
      {
        id: "sl-a1",
        topic: "Discovery",
        build: ({ focus }) =>
          `Let's run through your process.${focusLine(focus, "Keep %s in mind.")}\n\nWhat are the first three questions you ask on a discovery call, and what are you really listening for in each?`,
      },
      {
        id: "sl-a2",
        topic: "Qualification",
        build: () =>
          "A prospect is enthusiastic, takes every meeting, and never moves. How long before you disqualify, and what's the signal that tells you?",
      },
      {
        id: "sl-a3",
        topic: "Multithreading",
        build: () =>
          "Your champion is bought in but has no budget authority. What does your next two weeks look like?",
      },
      {
        id: "sl-a4",
        topic: "Value framing",
        build: () => "How do you build a business case a CFO will sign without inventing numbers?",
      },
    ],
    "core-b": [
      {
        id: "sl-b1",
        topic: "Objections",
        build: () =>
          "\"Your product is 40% more expensive than the alternative we're evaluating.\" Give me your actual response — words you'd say, not a framework name.",
      },
      {
        id: "sl-b2",
        topic: "Pipeline",
        build: () =>
          "You're at 60% of quota with five weeks left. Walk me through exactly how you spend week one.",
      },
      {
        id: "sl-b3",
        topic: "Objections",
        build: () =>
          '"We\'re going to build this internally." What do you say next, and what are you probing for?',
      },
      {
        id: "sl-b4",
        topic: "Forecasting",
        build: () =>
          "How do you decide a deal is commit versus best case? Give me the evidence you require.",
      },
    ],
    scenario: [
      {
        id: "sl-s1",
        topic: "Scenario",
        build: () =>
          "Your champion leaves the company two weeks before close. What do you do on day one?",
      },
      {
        id: "sl-s2",
        topic: "Scenario",
        build: () =>
          "Procurement demands a 30% discount on the last day of the quarter. Walk me through your response.",
      },
      {
        id: "sl-s3",
        topic: "Scenario",
        build: () =>
          "A customer is asking for a feature that doesn't exist and sales engineering says it never will. How do you play it?",
      },
    ],
    behavioral: [
      {
        id: "sl-h1",
        topic: "Resilience",
        build: ({ focus }) =>
          `Tell me about the biggest deal you lost${focus ? `, especially if **${focus}** played a part` : ""}. What would you do differently?`,
      },
      {
        id: "sl-h2",
        topic: "Coachability",
        build: () =>
          "What's the last change you made to your own process because of feedback? What happened to your numbers?",
      },
      {
        id: "sl-h3",
        topic: "Teamwork",
        build: () =>
          "Describe a deal you couldn't have won alone. What did you ask of others, and how?",
      },
    ],
    tradeoff: [
      {
        id: "sl-t1",
        topic: "Trade-offs",
        build: () =>
          "Chase the big logo or close three mid-market deals with the same effort? How do you decide?",
      },
      {
        id: "sl-t2",
        topic: "Trade-offs",
        build: () => "When do you walk away from a deal that's still technically alive?",
      },
      {
        id: "sl-t3",
        topic: "Judgment",
        build: () =>
          "How do you handle a prospect who'd be a bad fit but has budget and wants to buy?",
      },
    ],
  },
};

function poolFor(role: string): RolePool {
  return ROLE_POOLS[role] ?? GENERIC_POOL;
}

/* ------------------------------------------------------------------ */
/* 3. Session plans — a fresh, non-repeating 7-question set            */
/* ------------------------------------------------------------------ */

export interface SessionPlan {
  role: string;
  /** exactly TOTAL_QUESTIONS templates, one per slot */
  templates: QuestionTemplate[];
  signature: string;
}

const CATEGORY_ORDER: QuestionCategory[] = [
  "warmup",
  "core-a",
  "core-b",
  "scenario",
  "behavioral",
  "tradeoff",
  "closing",
];

const storageKey = (role: string) => `interview-agent:last-set:${role.toLowerCase()}`;

function readLastSignature(role: string): string | null {
  try {
    return globalThis.localStorage?.getItem(storageKey(role)) ?? null;
  } catch {
    return null;
  }
}

function writeLastSignature(role: string, signature: string): void {
  try {
    globalThis.localStorage?.setItem(storageKey(role), signature);
  } catch {
    /* storage unavailable — repetition guard degrades to random only */
  }
}

function draftPlan(role: string): QuestionTemplate[] {
  const pool = poolFor(role);
  return CATEGORY_ORDER.map((category) => {
    if (category === "warmup") return pick(WARMUP_POOL);
    if (category === "closing") return pick(CLOSING_POOL);
    return pick(pool[category as CoreCategory]);
  });
}

/**
 * Build the question set for one interview. Randomised per session and
 * guaranteed never to be identical to the previous set for the same role,
 * even across a page refresh.
 */
export function createSessionPlan(role: string): SessionPlan {
  const previous = readLastSignature(role);
  let templates = draftPlan(role);
  let signature = templates.map((t) => t.id).join("|");

  for (let attempt = 0; attempt < 8 && signature === previous; attempt += 1) {
    templates = draftPlan(role);
    signature = templates.map((t) => t.id).join("|");
  }

  writeLastSignature(role, signature);
  return { role, templates, signature };
}

/* ------------------------------------------------------------------ */
/* 4. Asking questions                                                 */
/* ------------------------------------------------------------------ */

export async function getNextQuestion(
  role: string,
  answers: CandidateAnswer[],
  plan: SessionPlan,
): Promise<InterviewTurn> {
  const index = answers.length + 1;
  await delay(answers.length === 0 ? 500 : 900 + Math.random() * 700);

  const focus = keywords(answers.at(-1)?.text ?? "", 1)[0];
  const template = plan.templates[index - 1] ?? plan.templates[plan.templates.length - 1]!;

  return {
    id: uid(),
    index,
    topic: template.topic,
    question: template.build({ role, focus }),
    askedAt: Date.now(),
  };
}

/**
 * Swap the question occupying a slot for a different one from the same
 * category pool. Used by the "skip / regenerate" control when a question
 * doesn't apply to the candidate's background. The slot index (and therefore
 * the "Question X of 7" counter) is unchanged; scoring rules are untouched.
 */
export async function regenerateQuestion(
  role: string,
  answers: CandidateAnswer[],
  plan: SessionPlan,
  currentTurn: InterviewTurn,
): Promise<{ turn: InterviewTurn; plan: SessionPlan }> {
  await delay(700 + Math.random() * 500);

  const slot = Math.min(Math.max(currentTurn.index, 1), plan.templates.length) - 1;
  const category = CATEGORY_ORDER[slot]!;
  const options =
    category === "warmup"
      ? WARMUP_POOL
      : category === "closing"
        ? CLOSING_POOL
        : poolFor(role)[category as CoreCategory];

  const current = plan.templates[slot];
  const alternatives = options.filter((t) => t.id !== current?.id);
  const template = alternatives.length > 0 ? pick(alternatives) : (current ?? pick(options));

  const templates = [...plan.templates];
  templates[slot] = template;
  const nextPlan: SessionPlan = {
    ...plan,
    templates,
    signature: templates.map((t) => t.id).join("|"),
  };

  const focus = keywords(answers.at(-1)?.text ?? "", 1)[0];

  return {
    plan: nextPlan,
    turn: {
      id: uid(),
      index: currentTurn.index,
      topic: template.topic,
      question: template.build({ role, focus }),
      askedAt: Date.now(),
    },
  };
}

/** Strip markdown/code so a question can be restated plainly. */
function plainCore(question: string): string {
  const withoutCode = question.replace(/```[\s\S]*?```/g, "").replace(/`([^`]+)`/g, "$1");
  const withoutBold = withoutCode.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
  const paragraphs = withoutBold
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (paragraphs.at(-1) ?? withoutBold).replace(/\s+/g, " ").trim();
}

/**
 * Restate the same question in simpler terms. `attempt` is 1 for the first
 * rephrase and 2 for the second (final) one. The question index is unchanged,
 * so the "Question X of 7" counter never advances for a clarification.
 */
export async function getRephrasedQuestion(
  turn: InterviewTurn,
  attempt: number,
): Promise<InterviewTurn> {
  await delay(700 + Math.random() * 500);
  const core = plainCore(turn.question);

  const question =
    attempt <= 1
      ? `No problem — let me put that a different way.\n\n${core}\n\nIf it helps, just answer the narrow version: what would you *actually do first*, and why that?`
      : `Let's make it as concrete as possible.\n\nThink of one real situation you've been in that's even loosely related, and describe it step by step: what happened, what you did, what the outcome was.\n\n(Original question: ${core})\n\nWhatever you say next, I'll take as your answer for this one — a rough attempt scores better than no attempt.`;

  return {
    id: uid(),
    index: turn.index,
    topic: turn.topic,
    question,
    askedAt: Date.now(),
    isRephrase: true,
  };
}

/* ------------------------------------------------------------------ */
/* 5. Scoring & feedback                                               */
/* ------------------------------------------------------------------ */

/** Individual 0-10 score for a single scored answer. */
function scoreAnswer(answer: CandidateAnswer, turn: InterviewTurn | undefined): number {
  if (answer.kind === "non-answer") {
    // Non-answers are capped hard: 0-2, never averaged gently into the rest.
    return Math.max(0, Math.min(2, Math.round((answer.wordCount / 12) * 10) / 10));
  }

  const depth = Math.min(4, answer.wordCount / 45);
  const specificity =
    (/\d/.test(answer.text) ? 1.5 : 0) + (SUBSTANCE_PATTERNS.test(answer.text) ? 1.5 : 0);

  const questionWords = new Set(keywords(turn?.question ?? "", 6));
  const overlap = keywords(answer.text, 8).filter((w) => questionWords.has(w)).length;
  const relevance = Math.min(2, overlap * 0.7);

  return Math.max(2.5, Math.min(10, Math.round((2.5 + depth + specificity + relevance) * 10) / 10));
}

export async function getFeedback(
  role: string,
  turns: InterviewTurn[],
  answers: CandidateAnswer[],
): Promise<FeedbackSummary> {
  await delay(1600);

  const scored = answers.filter((a) => a.kind !== "clarification");
  const nonAnswers = scored.filter((a) => a.kind === "non-answer");
  const substantive = scored.filter(isSubstantive);

  const turnOf = (a: CandidateAnswer) => turns.find((t) => t.id === a.turnId);
  const topicOf = (a?: CandidateAnswer) =>
    a ? (turnOf(a)?.topic ?? "the interview") : "the interview";

  /** Cite the exact answer a feedback point is scored against. */
  const citeOf = (a?: CandidateAnswer) => {
    const t = a ? turnOf(a) : undefined;
    return t ? { source: { index: t.index, topic: t.topic } } : {};
  };

  const perAnswer = scored.map((a) => scoreAnswer(a, turnOf(a)));
  const average = perAnswer.reduce((sum, s) => sum + s, 0) / Math.max(perAnswer.length, 1);

  let score = Math.round(average * 10) / 10;
  // Three or more non-answers means the screen failed, regardless of the rest.
  if (nonAnswers.length >= 3) score = Math.min(score, 3);
  score = Math.max(0, Math.min(10, score));

  const bySubstance = [...substantive].sort((a, b) => b.wordCount - a.wordCount);
  const avgWords = Math.round(
    substantive.reduce((s, a) => s + a.wordCount, 0) / Math.max(substantive.length, 1),
  );
  const withNumbers = substantive.filter((a) => /\d/.test(a.text)).length;
  const topics = keywords(substantive.map((a) => a.text).join(" "), 3);

  /* -- Strengths: never built from a non-answer -- */
  const strengths: FeedbackPoint[] = [];
  let strengthsNote: string | undefined;

  if (bySubstance.length >= 2) {
    const best = bySubstance[0]!;
    const second = bySubstance[1]!;
    strengths.push({
      title: `Clear ownership on "${topicOf(best)}"`,
      detail:
        "You framed the problem before jumping to the solution, which made your contribution easy to isolate. That's the part interviewers are actually scoring.",
      quote: quoteFrom(best, "I owned that piece end to end."),
      ...citeOf(best),
    });
    strengths.push({
      title:
        withNumbers > substantive.length / 2
          ? "Answers grounded in concrete detail"
          : `Consistent thread around ${topics[0] ?? "your core skill"}`,
      detail:
        withNumbers > substantive.length / 2
          ? "You reached for numbers and named systems rather than generalities, which makes your claims checkable and memorable."
          : "You returned to the same area of strength across several answers, which reads as genuine depth rather than surface familiarity.",
      quote: quoteFrom(second, "Here's how I approached it."),
      ...citeOf(second),
    });
  } else {
    strengthsNote = "Not enough substantive answers this round to identify clear strengths.";
  }

  /* -- Improvements: call out non-answers by topic -- */
  const improvements: FeedbackPoint[] = [];

  for (const a of nonAnswers.slice(0, 2)) {
    const snippet = a.text.trim().split(/\s+/).slice(0, 10).join(" ");
    improvements.push({
      title: `No attempt on "${topicOf(a)}"`,
      detail: `You answered "${topicOf(a)}" with just "${snippet}" — that gives an interviewer nothing to evaluate. Even a rough guess with your reasoning attached would score better than no attempt.`,
      quote: snippet || "…",
      ...citeOf(a),
    });
  }

  if (nonAnswers.length > 2) {
    improvements.push({
      title: `${nonAnswers.length} of ${scored.length} questions went unanswered`,
      detail:
        "At this rate an interviewer can't build a case for you at all. Pick two of these topics before your next screen and prepare one concrete story each — a real situation, what you did, what changed.",
      quote: quoteFrom(nonAnswers.at(-1), "Not sure."),
      ...citeOf(nonAnswers.at(-1)),
    });
  }

  if (improvements.length < 2) {
    const weakest = [...substantive].sort((a, b) => a.wordCount - b.wordCount)[0];
    improvements.push({
      title: weakest ? `Thin on the "${topicOf(weakest)}" question` : "Answers need more outcome",
      detail: weakest
        ? `That answer ran ~${weakest.wordCount} words. Add the outcome and one number — what changed, and by how much — before you stop talking.`
        : "Close each answer with the result: what changed, for whom, and by how much.",
      quote: quoteFrom(weakest, "I'd probably handle it case by case."),
      ...citeOf(weakest),
    });
  }

  if (improvements.length < 2 || substantive.length >= 2) {
    improvements.push({
      title:
        avgWords > 160
          ? "Answers run long before landing"
          : "Trade-offs stated without the alternative",
      detail:
        avgWords > 160
          ? `You averaged ${avgWords} words per substantive answer. Lead with the one-sentence answer, then expand only if the interviewer leans in.`
          : "You named the choice you made but rarely the option you rejected. Saying what you didn't do, and why, is what signals seniority.",
      quote: quoteFrom(bySubstance[1] ?? bySubstance[0], "We decided to go with that approach."),
      ...citeOf(bySubstance[1] ?? bySubstance[0]),
    });
  }

  const summary =
    nonAnswers.length >= 3
      ? `Capped at ${score.toFixed(1)} — ${nonAnswers.length} of ${scored.length} questions got no real attempt, which ends most ${role} screens.`
      : score >= 8
        ? `Strong screen for ${role} — specific, structured, and easy to advocate for.`
        : score >= 6
          ? `Solid ${role} screen with real substance; depth is uneven across topics.`
          : `Promising ${role} fundamentals, but answers need more evidence and outcome.`;

  return {
    role,
    score,
    summary,
    strengths,
    ...(strengthsNote ? { strengthsNote } : {}),
    improvements: improvements.slice(0, 3),
  };
}

export { TOTAL_QUESTIONS };
