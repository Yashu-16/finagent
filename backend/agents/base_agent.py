import os
import json
import logging
from pathlib import Path
from openai import OpenAI

logger = logging.getLogger(__name__)

# Auto-load key from .env at import time
_env_path = Path(__file__).parent.parent / ".env"
if _env_path.exists():
    for _line in _env_path.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if _line.startswith("OPENAI_API_KEY="):
            os.environ.setdefault("OPENAI_API_KEY", _line.split("=", 1)[1].strip())
            break


class BaseAgent:
    role_name = "Agent"
    role_title = "Executive"
    weight = 0.25

    def __init__(self):
        key = os.environ.get("OPENAI_API_KEY", "")
        if not key:
            raise RuntimeError("OPENAI_API_KEY not set")
        self.client = OpenAI(api_key=key)
        self.model = "gpt-4o-mini"

    def _system_prompt(self):
        raise NotImplementedError

    def _call_llm(self, messages):
        response = self.client.chat.completions.create(
            model=self.model, messages=messages, temperature=0.7, max_tokens=600
        )
        return response.choices[0].message.content.strip()

    def _parse_json_response(self, raw):
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = [l for l in cleaned.split("\n") if not l.startswith("```")]
            cleaned = "\n".join(lines).strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            return {"stance": "conditional", "reasoning": raw[:300], "key_concern": "Parse error"}

    def get_initial_position(self, scenario):
        messages = [
            {"role": "system", "content": self._system_prompt()},
            {"role": "user", "content": (
                f"Business scenario: {scenario}\n\n"
                "Provide your initial position as a JSON object with exactly these keys:\n"
                "- stance: one of approve / reject / conditional\n"
                "- reasoning: 2-3 sentences from your executive perspective\n"
                "- key_concern: your single biggest concern in one sentence\n\n"
                "Respond with valid JSON only. No markdown, no extra text."
            )},
        ]
        raw = self._call_llm(messages)
        result = self._parse_json_response(raw)
        result["agent"] = self.role_name
        result["role"] = self.role_title
        return result

    def debate_response(self, scenario, all_positions, prior_arguments, round_number):
        others = ""
        for p in all_positions:
            if p["agent"] != self.role_name:
                others += f"\n- {p[chr(39)+'agent'+chr(39)]}: stance={p[chr(39)+'stance'+chr(39)]} | {p[chr(39)+'reasoning'+chr(39)]}"
        my_args = [a for a in prior_arguments if a["agent"] == self.role_name]
        my_prior = "\n".join(f"- Round {a[chr(39)+'round'+chr(39)]}: {a[chr(39)+'argument'+chr(39)]}" for a in my_args) or "None yet."
        messages = [
            {"role": "system", "content": self._system_prompt()},
            {"role": "user", "content": (
                f"Business scenario: {scenario}\n\n"
                f"=== Debate Round {round_number} ===\n\n"
                f"Other executives positions:\n{others}\n\n"
                f"Arguments YOU already made (do NOT repeat):\n{my_prior}\n\n"
                "Respond with a JSON object with exactly these keys:\n"
                "- stance: approve / reject / conditional\n"
                "- target_agent: agent you are responding to (CEO/CFO/CMO/Risk)\n"
                "- argument: your counter-argument in 2-3 sentences\n\n"
                "Valid JSON only. No markdown."
            )},
        ]
        raw = self._call_llm(messages)
        result = self._parse_json_response(raw)
        result["agent"] = self.role_name
        result["round"] = round_number
        return result
