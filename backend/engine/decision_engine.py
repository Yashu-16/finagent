import os
import json
import logging
from openai import OpenAI

logger = logging.getLogger(__name__)

# Default weights (as fractions)
AGENT_WEIGHTS = {
    "CEO":  0.50,
    "CFO":  0.17,
    "CMO":  0.17,
    "Risk": 0.16,
}

STANCE_SCORES = {
    "approve":     1.0,
    "conditional": 0.5,
    "reject":      0.0,
}

EXEC_NAMES = {
    "CEO":  "Elon Musk",
    "CFO":  "Sachin Mehra (Mastercard CFO)",
    "CMO":  "Julia White (SAP CMO)",
    "Risk": "Ashley Bacon (JP Morgan CRO)",
}


class DecisionEngine:

    def __init__(self):
        self.client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))
        self.model = "gpt-4o-mini"

    def _resolve_weights(self, agent_weights: dict | None) -> dict:
        """
        Accept weights either as percentages (50, 17, 17, 16)
        or fractions (0.50, 0.17, 0.17, 0.16).
        Always return fractions.
        Falls back to AGENT_WEIGHTS if None or invalid.
        """
        if not agent_weights:
            return AGENT_WEIGHTS

        total = sum(agent_weights.values())
        if total == 0:
            return AGENT_WEIGHTS

        # If passed as percentages, convert to fractions
        if total > 1.5:
            return {k: v / 100.0 for k, v in agent_weights.items()}

        return agent_weights

    def _weighted_score(self, final_positions: list[dict], agent_weights: dict | None = None) -> tuple[str, float]:
        weights = self._resolve_weights(agent_weights)

        total_weight = 0.0
        weighted_sum = 0.0
        for pos in final_positions:
            agent  = pos["agent"]
            stance = pos.get("stance", "conditional")
            weight = weights.get(agent, AGENT_WEIGHTS.get(agent, 0.17))
            score  = STANCE_SCORES.get(stance, 0.5)
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
        counts = {"approve": 0, "conditional": 0, "reject": 0}
        for pos in final_positions:
            stance = pos.get("stance", "conditional")
            counts[stance] = counts.get(stance, 0) + 1

        winner = max(counts, key=counts.get)
        confidence = counts[winner] / len(final_positions)
        verdict_map = {
            "approve":     "Approved",
            "conditional": "Conditional Approval",
            "reject":      "Rejected",
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
        agent_weights: dict | None = None,
    ) -> dict:
        weights = self._resolve_weights(agent_weights)

        positions_text = ""
        for ip in initial_positions:
            agent = ip["agent"]
            name  = EXEC_NAMES.get(agent, agent)
            w_pct = round(weights.get(agent, AGENT_WEIGHTS.get(agent, 0.17)) * 100)
            final = next((p for p in final_positions if p["agent"] == agent), ip)
            positions_text += (
                f"\n- {name} ({w_pct}% vote weight): "
                f"initial={ip['stance']} -> final={final.get('stance', ip['stance'])}"
                f"\n  Reasoning: {ip['reasoning']}"
                f"\n  Key concern: {ip['key_concern']}"
            )

        debate_text = ""
        for r in debate_rounds:
            debate_text += f"\nRound {r['round_number']}:"
            for ex in r.get("exchanges", []):
                src = EXEC_NAMES.get(ex["agent"], ex["agent"])
                tgt = EXEC_NAMES.get(ex["target_agent"], ex["target_agent"])
                debate_text += f"\n  {src} -> {tgt}: {ex['argument']}"

        ceo_weight = round(weights.get("CEO", 0.50) * 100)

        prompt = (
            f"You are summarizing a high-stakes boardroom debate between real-world executives:\n"
            f"- Elon Musk (CEO) — {ceo_weight}% decision weight\n"
            f"- Sachin Mehra, Mastercard CFO — {round(weights.get('CFO', 0.17)*100)}% weight\n"
            f"- Julia White, SAP CMO — {round(weights.get('CMO', 0.17)*100)}% weight\n"
            f"- Ashley Bacon, JP Morgan CRO — {round(weights.get('Risk', 0.16)*100)}% weight\n\n"
            f"Scenario: {scenario}\n\n"
            f"Final verdict: {verdict} (confidence: {confidence:.0%})\n\n"
            f"Executive positions:\n{positions_text}\n\n"
            f"Debate exchanges:\n{debate_text}\n\n"
            "Generate a JSON summary with exactly these keys:\n\n"
            "supporting_arguments: array of exactly 3 plain strings. Each attributes an argument to a named executive.\n"
            "disagreements: array of exactly 2 plain strings. Each describes a disagreement between named executives.\n"
            "rationale: single plain string of 3-4 sentences explaining the final decision, mentioning executives by name and their vote weights.\n\n"
            "CRITICAL: All array items must be plain strings only. No nested objects.\n"
            "Respond with valid JSON only. No markdown."
        )

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=900,
            )
            raw = response.choices[0].message.content.strip()
            if raw.startswith("```"):
                lines = [l for l in raw.split("\n") if not l.startswith("```")]
                raw = "\n".join(lines).strip()
            parsed = json.loads(raw)

            def safe(v):
                if isinstance(v, str): return v
                if isinstance(v, dict): return v.get("argument") or v.get("text") or json.dumps(v)
                return str(v)

            return {
                "supporting_arguments": [safe(a) for a in parsed.get("supporting_arguments", [])],
                "disagreements":        [safe(d) for d in parsed.get("disagreements", [])],
                "rationale":            safe(parsed.get("rationale", "")),
            }

        except Exception as e:
            logger.error(f"Summary generation failed: {e}")
            return {
                "supporting_arguments": [p["reasoning"] for p in initial_positions[:3]],
                "disagreements": [
                    "Elon Musk and Ashley Bacon disagreed on risk tolerance.",
                    "Sachin Mehra challenged the financial projections.",
                ],
                "rationale": (
                    f"The panel reached a {verdict} with {confidence:.0%} confidence "
                    f"based on weighted agent stances."
                ),
            }

    def aggregate(
        self,
        scenario: str,
        initial_positions: list[dict],
        final_positions: list[dict],
        debate_rounds: list[dict],
        mode: str = "weighted",
        agent_weights: dict | None = None,
    ) -> dict:
        if mode == "weighted":
            verdict, confidence = self._weighted_score(final_positions, agent_weights)
        else:
            verdict, confidence = self._majority_vote(final_positions)

        logger.info(f"Decision: {verdict} | Confidence: {confidence:.0%} | Mode: {mode}")

        summary = self._generate_summary(
            scenario, verdict, confidence,
            initial_positions, final_positions, debate_rounds,
            agent_weights,
        )

        return {
            "verdict":              verdict,
            "confidence":           confidence,
            "supporting_arguments": summary.get("supporting_arguments", []),
            "disagreements":        summary.get("disagreements", []),
            "rationale":            summary.get("rationale", ""),
        }