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
        _line = _line.strip().lstrip("\ufeff")
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
            model=self.model,
            messages=messages,
            temperature=0.7,
            max_tokens=600,
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
            return {
                "stance": "conditional",
                "reasoning": raw[:300],
                "key_concern": "Parse error",
            }

    def get_initial_position(self, scenario):
        messages = [
            {"role": "system", "content": self._system_prompt()},
            {
                "role": "user",
                "content": (
                    f"Business scenario: {scenario}\n\n"
                    "Provide your initial position as a JSON object with exactly these keys:\n"
                    "- stance: one of approve / reject / conditional\n"
                    "- reasoning: 2-3 sentences from your executive perspective\n"
                    "- key_concern: your single biggest concern in one sentence\n\n"
                    "Respond with valid JSON only. No markdown, no extra text."
                ),
            },
        ]
        raw = self._call_llm(messages)
        result = self._parse_json_response(raw)
        result["agent"] = self.role_name
        result["role"] = self.role_title
        return result

    def debate_response(self, scenario, all_positions, prior_arguments, round_number):
        # Build summary of other agents positions
        others = ""
        for p in all_positions:
            if p.get("agent") != self.role_name:
                agent_name = p.get("agent", "Unknown")
                stance = p.get("stance", "unknown")
                reasoning = p.get("reasoning", "")
                others += f"\n- {agent_name}: stance={stance} | {reasoning}"

        # Build memory of this agents prior arguments
        my_args = [a for a in prior_arguments if a.get("agent") == self.role_name]
        if my_args:
            my_prior = "\n".join(
                f"- Round {a.get('round', 0)}: {a.get('argument', '')}"
                for a in my_args
            )
        else:
            my_prior = "None yet."

        messages = [
            {"role": "system", "content": self._system_prompt()},
            {
                "role": "user",
                "content": (
                    f"Business scenario: {scenario}\n\n"
                    f"=== Debate Round {round_number} ===\n\n"
                    f"Other executives positions:\n{others}\n\n"
                    f"Arguments YOU have already made (do NOT repeat these):\n{my_prior}\n\n"
                    "Your task:\n"
                    "1. Identify the executive whose argument most conflicts with your role priorities.\n"
                    "2. Respond with a NEW counter-argument from your perspective.\n"
                    "3. You may update your stance if genuinely persuaded.\n\n"
                    "Respond with a JSON object with exactly these keys:\n"
                    "- stance: one of approve / reject / conditional\n"
                    "- target_agent: the agent name you are responding to (CEO/CFO/CMO/Risk)\n"
                    "- argument: your counter-argument in 2-3 sentences\n\n"
                    "Valid JSON only. No markdown, no extra text."
                ),
            },
        ]
        raw = self._call_llm(messages)
        result = self._parse_json_response(raw)
        result["agent"] = self.role_name
        result["round"] = round_number
        return result