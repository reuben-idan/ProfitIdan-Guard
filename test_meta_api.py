"""Smoke test for Meta Model API connectivity.

Not the finished agent. Run after creating .env with a real MODEL_API_KEY:

    python test_meta_api.py
"""

import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

client = OpenAI(
    base_url=os.getenv("META_API_BASE_URL", "https://api.meta.ai/v1"),
    api_key=os.environ["MODEL_API_KEY"],
)

response = client.chat.completions.create(
    model=os.getenv("MODEL_NAME", "muse-spark-1.3"),
    messages=[
        {
            "role": "user",
            "content": (
                "You are the investigation agent for ProfitPilot AI. "
                "Reply with a short JSON object containing "
                "project, status, and next_step."
            ),
        }
    ],
)
print(response.choices[0].message.content)
