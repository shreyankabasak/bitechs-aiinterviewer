import type {
  CandidateAnswer,
  FeedbackPoint,
  FeedbackSummary,
  InterviewTurn,
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

interface QuestionTemplate {
  topic: string;
  build: (ctx: { role: string; focus?: string | undefined }) => string;
}

const OPENER: QuestionTemplate = {
  topic: "Warm-up",
  build: ({ role }) =>
    `Thanks for making time today. I'll be running your **${role}** screen — 7 questions, conversational, no trick puzzles.\n\nTo start: walk me through a project you shipped as a ${role.toLowerCase()} that you're genuinely proud of. What was the problem, and what was *your* specific contribution?`,
};

const ROLE_TRACKS: Record<string, QuestionTemplate[]> = {
  "Frontend Developer": [
    {
      topic: "Rendering & state",
      build: ({ focus }) =>
        `Let's go deeper on the engineering.${focus ? ` You mentioned **${focus}** — hold that in mind.` : ""}\n\nHow do you decide where a piece of state should live: local component state, a shared store, or the server? Give me a concrete example where you got that call wrong the first time.`,
    },
    {
      topic: "Performance",
      build: () =>
        "A page you own has a Largest Contentful Paint of 4.2s on mid-tier mobile. Talk me through your diagnostic path — what do you measure first, and what are the two most likely culprits you'd expect to find?",
    },
    {
      topic: "Code reasoning",
      build: () =>
        "Quick code read:\n\n```tsx\nfunction Search({ query }: { query: string }) {\n  const [results, setResults] = useState<Item[]>([]);\n\n  useEffect(() => {\n    fetch(`/api/search?q=${query}`)\n      .then((r) => r.json())\n      .then(setResults);\n  }, [query]);\n\n  return <List items={results} />;\n}\n```\n\nWhat breaks in production here, and how would you fix it?",
    },
    {
      topic: "Accessibility & craft",
      build: () =>
        "You're building a custom dropdown because the design won't work with a native `<select>`. What does *done* look like — keyboard, screen reader, focus management? Where do teams usually cut corners?",
    },
    {
      topic: "Collaboration",
      build: ({ focus }) =>
        `Design hands you a spec that will cost two extra weeks for an animation nobody asked for.${focus ? ` Assume the same team dynamic you described around **${focus}**.` : ""} How do you handle that conversation?`,
    },
  ],
  "Backend Developer": [
    {
      topic: "System design",
      build: ({ focus }) =>
        `Let's talk architecture.${focus ? ` Building on your point about **${focus}**:` : ""}\n\nDesign the write path for a service ingesting 5k events/sec that must never lose an event. What are your components, and where's the durability boundary?`,
    },
    {
      topic: "Data modelling",
      build: () =>
        "When do you reach for a relational schema over a document store — and can you describe a time you picked wrong and had to migrate? What did the migration actually cost?",
    },
    {
      topic: "Debugging",
      build: () =>
        "p99 latency on one endpoint jumped from 80ms to 1.4s overnight. p50 is unchanged. What's your hypothesis list, ordered, and how do you confirm the top one?",
    },
    {
      topic: "Reliability",
      build: () =>
        'Walk me through how you\'d make this idempotent:\n\n```http\nPOST /v1/payments\n{ "amount": 4200, "currency": "usd", "customer": "cus_123" }\n```\n\nWhat happens when the client retries after a network timeout?',
    },
    {
      topic: "Ownership",
      build: ({ focus }) =>
        `Tell me about an incident you owned end to end.${focus ? ` If it relates to **${focus}**, even better.` : ""} What was the root cause, and what changed structurally afterwards?`,
    },
  ],
  "Product Manager": [
    {
      topic: "Prioritisation",
      build: ({ focus }) =>
        `Let's get into the craft.${focus ? ` You brought up **${focus}** — useful context.` : ""}\n\nYou have one engineering team and four stakeholders each convinced their request is critical. How do you decide, and how do you tell the other three?`,
    },
    {
      topic: "Discovery",
      build: () =>
        "Describe the last time customer research genuinely changed your roadmap. What was the belief before, what did you hear, and what did you kill?",
    },
    {
      topic: "Metrics",
      build: () =>
        "Activation is up 18% but 30-day retention is flat. What's your read, and what's the first experiment you run?",
    },
    {
      topic: "Trade-offs",
      build: () =>
        "Ship a rough version in two weeks, or a polished one in eight. Give me the framework you use to decide — and a case where you chose the slower path on purpose.",
    },
    {
      topic: "Influence",
      build: ({ focus }) =>
        `Tell me about a time you were wrong about a product bet${focus ? ` — ideally something near **${focus}**` : ""}. How did you find out, and how fast did you change course?`,
    },
  ],
  "Data Analyst": [
    {
      topic: "Analysis approach",
      build: ({ focus }) =>
        `Let's dig into your analytical process.${focus ? ` Keep **${focus}** in frame.` : ""}\n\nA stakeholder asks "why did signups drop last week?" You have raw event data and two hours. What do you actually do?`,
    },
    {
      topic: "SQL reasoning",
      build: () =>
        "What's wrong with this, and what would you write instead?\n\n```sql\nSELECT user_id, COUNT(*) AS orders\nFROM orders o\nLEFT JOIN refunds r ON r.order_id = o.id\nWHERE o.created_at > NOW() - INTERVAL '30 days'\nGROUP BY user_id\nORDER BY orders DESC;\n```",
    },
    {
      topic: "Rigour",
      build: () =>
        "How do you tell a real signal from noise in a small-sample A/B test? Have you ever had to talk a team out of shipping on a result you didn't trust?",
    },
    {
      topic: "Communication",
      build: () =>
        "You've found something that contradicts what leadership believes. Walk me through how you present it — structure, framing, what you lead with.",
    },
    {
      topic: "Impact",
      build: ({ focus }) =>
        `What's an analysis you did that actually changed a decision${focus ? `, ideally involving **${focus}**` : ""}? How did you know it landed?`,
    },
  ],
  Marketing: [
    {
      topic: "Positioning",
      build: ({ focus }) =>
        `Let's talk positioning.${focus ? ` You mentioned **${focus}** — hold onto that.` : ""}\n\nTake a product you've marketed: who was it *not* for, and how did that sharpen the message?`,
    },
    {
      topic: "Channels",
      build: () =>
        "You get $20k and one quarter to find a repeatable acquisition channel from scratch. What's your sequence, and what's your kill criterion for each test?",
    },
    {
      topic: "Measurement",
      build: () =>
        "Attribution is messy and your CAC number is contested. How do you build a measurement story leadership will actually trust?",
    },
    {
      topic: "Craft",
      build: () =>
        'Rewrite this headline out loud for me and explain your edit: *"We help teams do more with less using AI-powered workflow automation."*',
    },
    {
      topic: "Learning",
      build: ({ focus }) =>
        `Tell me about a campaign that flopped${focus ? ` — bonus if **${focus}** was involved` : ""}. What was the actual lesson, not the polite one?`,
    },
  ],
  Sales: [
    {
      topic: "Discovery",
      build: ({ focus }) =>
        `Let's run through your process.${focus ? ` Keep **${focus}** in mind.` : ""}\n\nWhat are the first three questions you ask on a discovery call, and what are you really listening for in each?`,
    },
    {
      topic: "Qualification",
      build: () =>
        "A prospect is enthusiastic, takes every meeting, and never moves. How long before you disqualify, and what's the signal that tells you?",
    },
    {
      topic: "Objections",
      build: () =>
        "\"Your product is 40% more expensive than the alternative we're evaluating.\" Give me your actual response — words you'd say, not a framework name.",
    },
    {
      topic: "Pipeline",
      build: () =>
        "You're at 60% of quota with five weeks left. Walk me through exactly how you spend week one.",
    },
    {
      topic: "Resilience",
      build: ({ focus }) =>
        `Tell me about the biggest deal you lost${focus ? `, especially if **${focus}** played a part` : ""}. What would you do differently?`,
    },
  ],
};

const GENERIC_TRACK: QuestionTemplate[] = [
  {
    topic: "Depth",
    build: ({ role, focus }) =>
      `Let's go deeper.${focus ? ` You mentioned **${focus}** — start there.` : ""}\n\nWhat does excellent work look like in a ${role} role, and where do most people fall short of it?`,
  },
  {
    topic: "Problem solving",
    build: ({ role }) =>
      `Describe the hardest problem you've solved as a ${role.toLowerCase()}. What made it hard, and what was your first move?`,
  },
  {
    topic: "Trade-offs",
    build: () =>
      "Tell me about a decision where you had to choose speed over quality. How did you make the call, and what did it cost you later?",
  },
  {
    topic: "Collaboration",
    build: () =>
      "Describe a disagreement with a teammate you couldn't resolve quickly. How did it end, and what would you change?",
  },
  {
    topic: "Growth",
    build: ({ focus }) =>
      `What's a skill you've deliberately built in the last year${focus ? `, perhaps around **${focus}**` : ""}? How did you practise it?`,
  },
];

const CLOSER: QuestionTemplate = {
  topic: "Closing",
  build: ({ focus }) =>
    `Last one.${focus ? ` Before we wrap, you kept coming back to **${focus}** — noted.` : ""}\n\nIf you joined and had 90 days to make one visible impact, what would you pick, and how would you know it worked?`,
};

function trackFor(role: string): QuestionTemplate[] {
  return ROLE_TRACKS[role] ?? GENERIC_TRACK;
}

export async function getNextQuestion(
  role: string,
  answers: CandidateAnswer[],
): Promise<InterviewTurn> {
  const index = answers.length + 1;
  await delay(answers.length === 0 ? 500 : 900 + Math.random() * 700);

  const focus = keywords(answers.at(-1)?.text ?? "", 1)[0];
  const track = trackFor(role);

  const template: QuestionTemplate =
    index === 1
      ? OPENER
      : index === TOTAL_QUESTIONS
        ? CLOSER
        : (track[(index - 2) % track.length] ?? GENERIC_TRACK[0]!);

  return {
    id: uid(),
    index,
    topic: template.topic,
    question: template.build({ role, focus }),
    askedAt: Date.now(),
  };
}

export async function getFeedback(
  role: string,
  turns: InterviewTurn[],
  answers: CandidateAnswer[],
): Promise<FeedbackSummary> {
  await delay(1600);

  const totalWords = answers.reduce((sum, a) => sum + a.wordCount, 0);
  const avgWords = Math.round(totalWords / Math.max(answers.length, 1));
  const sorted = [...answers].sort((a, b) => b.wordCount - a.wordCount);
  const best = sorted[0];
  const weakest = sorted.at(-1);
  const specificity = answers.filter((a) => /\d/.test(a.text)).length;
  const topics = keywords(answers.map((a) => a.text).join(" "), 3);

  const depth = Math.min(3, avgWords / 45);
  const evidence = Math.min(2.5, (specificity / Math.max(answers.length, 1)) * 2.5);
  const range = Math.min(1.5, topics.length * 0.5);
  const score = Math.max(3, Math.min(10, Math.round((4 + depth + evidence + range) * 10) / 10));

  const topicOf = (a?: CandidateAnswer) =>
    turns.find((t) => t.id === a?.turnId)?.topic ?? "the interview";

  const strengths: [FeedbackPoint, FeedbackPoint] = [
    {
      title: `Clear ownership on "${topicOf(best)}"`,
      detail:
        "You framed the problem before jumping to the solution, which made your contribution easy to isolate. That's the part interviewers are actually scoring.",
      quote: quoteFrom(best, "I owned that piece end to end."),
    },
    {
      title:
        specificity > answers.length / 2
          ? "Answers grounded in concrete detail"
          : `Consistent thread around ${topics[0] ?? "your core skill"}`,
      detail:
        specificity > answers.length / 2
          ? "You reached for numbers and named systems rather than generalities, which makes your claims checkable and memorable."
          : "You returned to the same area of strength across several answers, which reads as genuine depth rather than surface familiarity.",
      quote: quoteFrom(answers[Math.floor(answers.length / 2)], "Here's how I approached it."),
    },
  ];

  const improvements: [FeedbackPoint, FeedbackPoint] = [
    {
      title: `Thin on the "${topicOf(weakest)}" question`,
      detail: `That answer ran ~${weakest?.wordCount ?? 0} words. Add the outcome and one number — what changed, and by how much — before you stop talking.`,
      quote: quoteFrom(weakest, "I'd probably handle it case by case."),
    },
    {
      title:
        avgWords > 160
          ? "Answers run long before landing"
          : "Trade-offs stated without the alternative",
      detail:
        avgWords > 160
          ? `You averaged ${avgWords} words per answer. Lead with the one-sentence answer, then expand only if the interviewer leans in.`
          : "You named the choice you made but rarely the option you rejected. Saying what you didn't do, and why, is what signals seniority.",
      quote: quoteFrom(answers[1] ?? best, "We decided to go with that approach."),
    },
  ];

  const summary =
    score >= 8
      ? `Strong screen for ${role} — specific, structured, and easy to advocate for.`
      : score >= 6
        ? `Solid ${role} screen with real substance; depth is uneven across topics.`
        : `Promising ${role} fundamentals, but answers need more evidence and outcome.`;

  return { role, score, summary, strengths, improvements };
}
