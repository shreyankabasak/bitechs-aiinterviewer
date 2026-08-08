from typing import Optional, List
from pydantic import BaseModel


class InterviewRequest(BaseModel):
    sessionId: str
    candidate: Optional[dict] = None   # present on the FIRST call only
    message: Optional[str] = None      # present on every call AFTER the first


class Feedback(BaseModel):
    summary: str
    strengths: List[str]
    gaps: List[str]
    next: List[str]
    score: Optional[float] = None   # bonus field for the frontend's /10 readiness display


class InterviewResponse(BaseModel):
    reply: str
    done: bool
    feedback: Optional[Feedback] = None
    totalQuestions: Optional[int] = None   # bonus field so frontend can render "Question X of N" accurately
    questionNumber: Optional[int] = None
