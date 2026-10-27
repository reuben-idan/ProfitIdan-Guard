from pathlib import Path

import pytest

from backend.agent.tools import ToolContext

DEMO_DIR = Path(__file__).resolve().parents[2] / "data" / "demo"


@pytest.fixture(scope="module")
def ctx() -> ToolContext:
    return ToolContext.for_data(str(DEMO_DIR))
