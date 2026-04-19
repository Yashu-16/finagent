import os
import json
import logging
from openai import OpenAI

logger = logging.getLogger(__name__)

# Weights must match agent role_name values exactly
AGENT_WEIGHTS = {
    "CEO": 0.30,
    "CFO": 0.25,
    "CMO": 0.20,
    "Risk": 0.25,
}

STANCE_SCORES = {
    "approve": 1.0,
    "conditional": 0.5,
    "reject": 0.0,
}


class DecisionEngine:
    """
    Aggregates agent stances using weighted scoring,
    then generates an explainable final summary via LLM.
    """

    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.model = "gpt-4o-mini"

    def _weighted_score(self, final_positions: list[dict]) -> tuple[str, float]:
        """
        Compute weighted score from final agent stances.
        Returns (verdict, confidence).
        """
        total_weight = 0.0
        weighted_sum = 0.0

        for pos in final_positions:
            agent = pos["agent"]
            stance = pos.get("stance", "conditional")
            weight = AGENT_WEIGHTS.get(agent, 0.25)
            score = STANCE_SCORES.get(stance, 0.5)
            weighted_sum += weight * score
            total_weight += weight

        confidence = weighted_sum / total_weight if total_weight > 0 else 0.5

        if confidence >= 0.70:
            verdict = "Approved"
        elif confidence >= 0.45:
            verdict = "Conditional Approval"
        else:
            verdict = "Rejected"

        return verdict, round(confidence, 2)

    def _majority_vote(self, final_positions: list[dict]) -> tuple[str, float]:
        """Fallback: simple majority vote."""
        counts = {"approve": 0, "conditional": 0, "reject": 0}
        for pos in final_positions:
            stance = pos.get("stance", "conditional")
            counts[stance] = counts.get(stance, 0) + 1

        winner = max(counts, key=counts.get)
        confidence = counts[winner] / len(final_positions)

        verdict_map = {
            "approve": "Approved",
            "conditional": "Conditional Approval",
            "reject": "Rejected",
        }
        return verdict_map[winner], round(confidence, 2)

    def _generate_summary(
        self,
        scenario: str,
        verdict: str,
        confidence: float,
        initial_positions: list[dict],
        final_positions: list[dict],
        debate_rounds: list[dict],
    ) -> dict:
        """Use LLM to generate the explainable final summary."""

        positions_text = ""
        for ip in initial_positions:
            agent = ip["agent"]
            final = next((p for p in final_positions if p["agent"] == agent), ip)
            positions_text += (
                f"\n- {agent}: initial stance={ip['stance']} -> final stance={final.get('stance', ip['stance'])}"
                f"\n  Initial reasoning: {ip['reasoning']}"
                f"\n  Key concern: {ip['key_concern']}"
            )

        debate_text = ""
        for r in debate_rounds:
            debate_text += f"\nRound {r['round_number']}:"
            for ex in r.get("exchanges", []):
                debate_text += f"\n  {ex['agent']} -> {ex['target_agent']}: {ex['argument']}"

        prompt = (
            f"You are summarizing a boardroom debate between executive AI agents.\n\n"
            f"Scenario: {scenario}\n\n"
            f"Final verdict: {verdict} (confidence: {confidence:.0%})\n\n"
            f"Agent positions:\n{positions_text}\n\n"
            f"Debate exchanges:\n{debate_text}\n\n"
            "Generate a JSON summary with exactly these keys:\n"
            "- supporting_arguments: list of 3 strongest arguments FOR the decision\n"
            "- disagreements: list of 2-3 main points of contention from the debate\n"
            "- rationale: 3-4 sentence executive summary explaining the final decision and confidence level\n\n"
            "Respond with valid JSON only. No markdown, no extra text."
        )

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.4,
                max_tokens=800,
            )
            raw = response.choices[0].message.content.strip()
            cleaned = raw
            if cleaned.startswith("```"):
                lines = cleaned.split("\n")
                lines = [l for l in lines if not l.startswith("```")]
                cleaned = "\n".join(lines).strip()
            return json.loads(cleaned)
        except Exception as e:
            logger.error(f"Summary generation failed: {e}")
            return {
                "supporting_arguments": [p["reasoning"] for p in initial_positions[:3]],
                "disagreements": ["Summary generation encountered an error."],
                "rationale": f"The panel reached a {verdict} with {confidence:.0%} confidence based on weighted agent stances.",
            }

    def aggregate(
        self,
        scenario: str,
        initial_positions: list[dict],
        final_positions: list[dict],
        debate_rounds: list[dict],
        mode: str = "weighted",
    ) -> dict:
        """
        Full decision aggregation pipeline.
        Returns a dict matching the FinalDecision schema.
        """
        if mode == "weighted":
            verdict, confidence = self._weighted_score(final_positions)
        else:
            verdict, confidence = self._majority_vote(final_positions)

        logger.info(f"Decision: {verdict} | Confidence: {confidence:.0%} | Mode: {mode}")

        summary = self._generate_summary(
            scenario=scenario,
            verdict=verdict,
            confidence=confidence,
            initial_positions=initial_positions,
            final_positions=final_positions,
            debate_rounds=debate_rounds,
        )

        return {
            "verdict": verdict,
            "confidence": confidence,
            "supporting_arguments": summary.get("supporting_arguments", []),
            "disagreements": summary.get("disagreements", []),
            "rationale": summary.get("rationale", ""),
        }