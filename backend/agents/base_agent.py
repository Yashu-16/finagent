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
        if "=" in _line and not _line.startswith("#"):
            key, val = _line.split("=", 1)
            os.environ.setdefault(key.strip(), val.strip())


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
            max_tokens=700,
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

    def get_initial_position(self, scenario: str, news_context: str = "") -> dict:
        """
        Generate the agent's first take on the scenario.
        Optionally injects real news context.
        """
        news_section = f"\n\n{news_context}" if news_context else ""

        messages = [
            {"role": "system", "content": self._system_prompt()},
            {
                "role": "user",
                "content": (
                    f"Business scenario: {scenario}"
                    f"{news_section}\n\n"
                    "Provide your initial position as a JSON object with exactly these keys:\n"
                    "- stance: one of approve / reject / conditional\n"
                    "- reasoning: 2-3 sentences from your executive perspective. "
                    "If news context is provided, reference specific headlines that support your view.\n"
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

    def debate_response(
        self,
        scenario: str,
        all_positions: list,
        prior_arguments: list,
        round_number: int,
        news_context: str = "",
    ) -> dict:
        """
        Generate a debate response. Optionally injects news context.
        """
        others = ""
        for p in all_positions:
            if p.get("agent") != self.role_name:
                agent_name = p.get("agent", "Unknown")
                stance = p.get("stance", "unknown")
                reasoning = p.get("reasoning", "")
                others += f"\n- {agent_name}: stance={stance} | {reasoning}"

        my_args = [a for a in prior_arguments if a.get("agent") == self.role_name]
        my_prior = (
            "\n".join(f"- Round {a.get('round', 0)}: {a.get('argument', '')}" for a in my_args)
            if my_args else "None yet."
        )

        news_section = f"\n\nCurrent market context:\n{news_context}" if news_context else ""

        messages = [
            {"role": "system", "content": self._system_prompt()},
            {
                "role": "user",
                "content": (
                    f"Business scenario: {scenario}"
                    f"{news_section}\n\n"
                    f"=== Debate Round {round_number} ===\n\n"
                    f"Other executives positions:\n{others}\n\n"
                    f"Arguments YOU have already made (do NOT repeat these):\n{my_prior}\n\n"
                    "Your task:\n"
                    "1. Identify the executive whose argument most conflicts with your role priorities.\n"
                    "2. Respond with a NEW counter-argument. If news context is provided, cite specific "
                    "headlines to strengthen your position.\n"
                    "3. You may update your stance if genuinely persuaded.\n\n"
                    "Respond with a JSON object with exactly these keys:\n"
                    "- stance: one of approve / reject / conditional\n"
                    "- target_agent: agent you are responding to (CEO/CFO/CMO/Risk)\n"
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

    def respond_to_human(
        self,
        scenario: str,
        all_positions: list,
        prior_arguments: list,
        human_comment: str,
        news_context: str = "",
    ) -> dict:
        """
        Generate a direct response to a human stakeholder's comment,
        re-engaging the existing debate with the new input.
        """
        others = ""
        for p in all_positions:
            if p.get("agent") != self.role_name:
                others += (
                    f"\n- {p.get('agent', 'Unknown')}: "
                    f"stance={p.get('stance', 'unknown')} | "
                    f"{p.get('reasoning', '')}"
                )

        my_args = [a for a in prior_arguments if a.get("agent") == self.role_name]
        my_prior = (
            "\n".join(f"- {a.get('argument', '')}" for a in my_args)
            if my_args else "None yet."
        )

        news_section = f"\n\nCurrent market context:\n{news_context}" if news_context else ""

        messages = [
            {"role": "system", "content": self._system_prompt()},
            {
                "role": "user",
                "content": (
                    f"Business scenario: {scenario}"
                    f"{news_section}\n\n"
                    f"Other executives' positions:\n{others}\n\n"
                    f"Your prior arguments in this debate:\n{my_prior}\n\n"
                    f"=== A human stakeholder (board observer) just spoke up ===\n"
                    f"Stakeholder said: \"{human_comment}\"\n\n"
                    "Your task:\n"
                    "1. Address the stakeholder's comment DIRECTLY from your role's perspective.\n"
                    "2. Reference specific points they raised — do not give a generic answer.\n"
                    "3. Either defend your existing stance, acknowledge a valid point, "
                    "or genuinely update your stance if their argument persuades you.\n\n"
                    "Respond with a JSON object with exactly these keys:\n"
                    "- stance: one of approve / reject / conditional\n"
                    "- argument: 2-3 sentences directly addressing the stakeholder\n\n"
                    "Valid JSON only. No markdown, no extra text."
                ),
            },
        ]
        raw = self._call_llm(messages)
        result = self._parse_json_response(raw)
        result["agent"] = self.role_name
        result["target_agent"] = "human"
        return result