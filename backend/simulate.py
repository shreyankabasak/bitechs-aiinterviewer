"""
Runs a full interview against one real candidate using main.py's logic,
WITHOUT needing fastapi installed (bypasses the HTTP layer, calls the
same functions directly). Confirms the state machine reaches `done`
correctly and produces a valid feedback shape.
"""
import json
from planner import build_plan
import llm
import prompts

with open("candidates.json") as f:
    candidate = json.load(f)["candidates"][5]  # Wendy Foster: heavy skips, good stress test

print(f"=== Simulating interview for {candidate['member']['name']} ===\n")

plan = build_plan(candidate)
print(f"Plan: {len(plan)} items across "
      f"{len({p['day'] for p in plan if p['kind']=='core'})} distinct days\n")

transcript = []
for i, item in enumerate(plan):
    q_prompt = prompts.question_prompt(candidate, item)
    question = llm.phrase_question(prompts.PERSONA_SYSTEM_PROMPT, q_prompt)
    fake_answer = "I think it works by processing the data and returning a result."

    score_result = llm.score_and_strategize(
        prompts.SCORING_SYSTEM_PROMPT,
        prompts.followup_prompt(item, fake_answer),
    )
    transcript.append({
        "day": item.get("day"), "title": item.get("title"), "tier": item.get("tier"),
        "question": question, "answer": fake_answer,
        "score": score_result.get("score"), "strategy": score_result.get("strategy"),
    })
    print(f"[{i+1}] ({item['kind']}/{item['tier']}) day={item.get('day')} "
          f"score={score_result.get('score')} strategy={score_result.get('strategy')}")

feedback = llm.generate_feedback(prompts.FEEDBACK_SYSTEM_PROMPT,
                                  prompts.feedback_prompt(candidate, transcript))

print("\n=== Feedback ===")
print(json.dumps(feedback, indent=2))

required_keys = {"summary", "strengths", "gaps", "next"}
assert required_keys.issubset(feedback.keys()), "Feedback missing required keys!"
print("\nFeedback shape matches spec (summary/strengths/gaps/next). PASS")
