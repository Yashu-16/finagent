import os
import json
import logging
from openai import OpenAI

logger = logging.getLogger(__name__)


class BaseAgent:
    role_name: str = "Agent"
    role_title: str = "Executive"
    weight: float = 0.25

    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.model = "gpt-4o-mini"

    def _system_prompt(self) -> str:
        raise NotImplementedError("Subclasses must implement _system_prompt()")

    def _call_llm(self, messages: list[dict]) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.7,
            max_tokens=600,
        )
        return response.choices[0].message.content.strip()

    def _parse_json_response(self, raw: str) -> dict:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            lines = [l for l in lines if not l.startswith("```")]
            cleaned = "\n".join(lines).strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error for {self.role_name}: {e}\nRaw: {raw}")
            return {
                "stance": "conditional",
                "reasoning": raw[:300],
                "key_concern": "Unable to parse structured response.",
            }

    def get_initial_position(self, scenario: str) -> dict:
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

    def debate_response(
        self,
        scenario: str,
        all_positions: list[dict],
        prior_arguments: list[dict],
        round_number: int,
    ) -> dict:
        """
        Generate a debate response reacting to other agents positions.
        Receives full context of what everyone has said so far.
        Returns: { stance, argument, target_agent }
        """
        # Build a summary of all other agents current positions
        others_summary = ""
        for p in all_positions:
            if p["agent"] != self.role_name:
                others_summary += (
                    f"\n- {p['agent']} ({p['role']}): stance={p['stance']} | "
                    f"{p['reasoning']} | concern: {p['key_concern']}"
                )

        # Build memory of what this agent has already argued
        my_prior = ""
        my_arguments = [a for a in prior_arguments if a["agent"] == self.role_name]
        if my_arguments:
            my_prior = "\n".join(
                f"- Round {a['round']}: {a['argument']}" for a in my_arguments
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
                    f"Other executives positions:\n{others_summary}\n\n"
                    f"Arguments YOU have already made (do NOT repeat these):\n{my_prior}\n\n"
                    "Your task:\n"
                    "1. Identify the executive whose argument most conflicts with your role's priorities.\n"
                    "2. Respond with a NEW counter-argument from your perspective.\n"
                    "3. You may update your stance if genuinely persuaded by the debate.\n\n"
                    "Respond with a JSON object with exactly these keys:\n"
                    "- stance: one of approve / reject / conditional\n"
                    "- target_agent: the agent name you are responding to (CEO/CFO/CMO/Risk)\n"
                    "- argument: your counter-argument in 2-3 sentences, must be different from your prior arguments\n\n"
                    "Respond with valid JSON only. No markdown, no extra text."
                ),
            },
        ]
        raw = self._call_llm(messages)
        result = self._parse_json_response(raw)
        result["agent"] = self.role_name
        result["round"] = round_number
        return result