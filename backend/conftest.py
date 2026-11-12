"""Makes `backend/` importable from tests and resets in-memory state."""
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(__file__))
os.environ.pop("GROQ_API_KEY", None)  # tests must never hit the real LLM


@pytest.fixture(autouse=True)
def clean_sessions():
    import main
    main.SESSIONS.clear()
    yield
    main.SESSIONS.clear()
