import os
import json
import logging
from openai import OpenAI

logger = logging.getLogger(__name__)

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

    def _weighted_score(self, final_positions):
        total_weight = 0.0
        weighted_sum = 0.0
        for pos in final_positions:
            agent  = pos["agent"]
            stance = pos.get("stance", "conditional")
            weight = AGENT_WEIGHTS.get(agent, 0.17)
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

    def _majority_vote(self, final_positions):
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

    def _safe_str(self, item):
        """Convert any item to a plain string safely."""
        if isinstance(item, str):
            return item
        if isinstance(item, dict):
            return item.get("argument") or item.get("text") or item.get("content") or json.dumps(item)
        return str(item)

    def _generate_summary(self, scenario, verdict, confidence,
                          initial_positions, final_positions, debate_rounds):
        positions_text = ""
        for ip in initial_positions:
            agent = ip["agent"]
            name  = EXEC_NAMES.get(agent, agent)
            final = next((p for p in final_positions if p["agent"] == agent), ip)
            positions_text += (
                f"\n- {name}: initial={ip['stance']} -> final={final.get('stance', ip['stance'])}"
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

        prompt = (
            f"You are summarizing a high-stakes boardroom debate between real-world executives:\n"
            f"- Elon Musk (CEO) — 50% decision weight\n"
            f"- Sachin Mehra, Mastercard CFO — 17% weight\n"
            f"- Julia White, SAP CMO — 17% weight\n"
            f"- Ashley Bacon, JP Morgan CRO — 16% weight\n\n"
            f"Scenario: {scenario}\n\n"
            f"Final verdict: {verdict} (confidence: {confidence:.0%})\n\n"
            f"Executive positions:\n{positions_text}\n\n"
            f"Debate exchanges:\n{debate_text}\n\n"
            "Generate a JSON object with exactly these three keys:\n\n"
            "supporting_arguments: an array of exactly 3 items. Each item MUST be a plain string sentence. "
            "Each sentence attributes an argument to a named executive. "
            "Example format: \"Elon Musk argued that first-principles analysis shows the TAM justifies aggressive entry.\"\n\n"
            "disagreements: an array of exactly 2 items. Each item MUST be a plain string sentence. "
            "Each sentence describes a disagreement between two named executives. "
            "Example format: \"Ashley Bacon and Elon Musk disagreed sharply on regulatory timeline estimates for Southeast Asia.\"\n\n"
            "rationale: a single plain string of 3-4 sentences explaining the final decision. "
            "Must mention specific executives by name and reference the 50% CEO vote weight.\n\n"
            "CRITICAL RULES:\n"
            "- supporting_arguments must be an array of plain strings ONLY. No objects, no nested keys.\n"
            "- disagreements must be an array of plain strings ONLY. No objects, no nested keys.\n"
            "- rationale must be a single plain string. Not an object, not an array.\n"
            "- Respond with valid JSON only. No markdown fences. No extra text outside the JSON.\n\n"
            "Valid response example:\n"
            "{\"supporting_arguments\": [\"Elon Musk said X.\", \"Sachin Mehra noted Y.\", \"Julia White identified Z.\"], "
            "\"disagreements\": [\"Elon Musk and Ashley Bacon disagreed on A.\", \"Sachin Mehra challenged Julia White on B.\"], "
            "\"rationale\": \"The board reached conditional approval. Elon Musk cast the decisive vote at 50% weight...\"}"
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

            # Force everything to plain strings
            supporting = [self._safe_str(a) for a in parsed.get("supporting_arguments", [])]
            disagreements = [self._safe_str(d) for d in parsed.get("disagreements", [])]
            rationale = self._safe_str(parsed.get("rationale", ""))

            return {
                "supporting_arguments": supporting,
                "disagreements": disagreements,
                "rationale": rationale,
            }

        except Exception as e:
            logger.error(f"Summary generation failed: {e}")
            return {
                "supporting_arguments": [
                    self._safe_str(p["reasoning"]) for p in initial_positions[:3]
                ],
                "disagreements": [
                    "Elon Musk and Ashley Bacon disagreed on risk tolerance for market entry.",
                    "Sachin Mehra and Julia White had differing views on CAC projections.",
                ],
                "rationale": (
                    f"The panel reached a {verdict} with {confidence:.0%} confidence. "
                    f"Elon Musk cast the decisive vote with 50% weight. "
                    f"Ashley Bacon raised regulatory concerns while Sachin Mehra evaluated the financial model."
                ),
            }

    def aggregate(self, scenario, initial_positions, final_positions,
                  debate_rounds, mode="weighted"):
        if mode == "weighted":
            verdict, confidence = self._weighted_score(final_positions)
        else:
            verdict, confidence = self._majority_vote(final_positions)

        logger.info(f"Decision: {verdict} | Confidence: {confidence:.0%} | Mode: {mode}")

        summary = self._generate_summary(
            scenario, verdict, confidence,
            initial_positions, final_positions, debate_rounds,
        )

        return {
            "verdict":              verdict,
            "confidence":           confidence,
            "supporting_arguments": summary.get("supporting_arguments", []),
            "disagreements":        summary.get("disagreements", []),
            "rationale":            summary.get("rationale", ""),
        }