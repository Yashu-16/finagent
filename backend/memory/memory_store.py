import json
import logging
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)

LOGS_DIR = Path(__file__).parent.parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)


def save_session(session_id: str, data: dict) -> None:
    """Persist full simulation result to a JSON file."""
    data["saved_at"] = datetime.utcnow().isoformat()
    path = LOGS_DIR / f"{session_id}.json"
    try:
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        logger.info(f"Session {session_id} saved to {path}")
    except Exception as e:
        logger.error(f"Failed to save session {session_id}: {e}")


def load_session(session_id: str) -> dict | None:
    """Load a session log by ID. Returns None if not found."""
    path = LOGS_DIR / f"{session_id}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:
        logger.error(f"Failed to load session {session_id}: {e}")
        return None


def list_sessions() -> list[str]:
    """Return all saved session IDs."""
    return [p.stem for p in LOGS_DIR.glob("*.json")]