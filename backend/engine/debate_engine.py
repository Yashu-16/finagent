import logging
from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)


class DebateEngine:
    """
    Orchestrates multi-round debate between executive agents.
    Each round: every agent reads all current positions + memory
    and produces a new counter-argument.
    """

    def __init__(self, agents: list[BaseAgent], rounds: int = 2):
        self.agents = agents
        self.rounds = rounds

    def run(
        self,
        scenario: str,
        initial_positions: list[dict],
    ) -> tuple[list[dict], list[dict]]:
        """
        Run the full debate.

        Returns:
            debate_rounds: list of round dicts with exchanges
            final_positions: updated positions after all debate rounds
        """
        # Working copy of positions — updated as stances shift
        current_positions = [dict(p) for p in initial_positions]

        # Flat memory of all arguments made across all rounds
        argument_memory: list[dict] = []

        # Seed memory with initial positions
        for p in initial_positions:
            argument_memory.append({
                "agent": p["agent"],
                "round": 0,
                "argument": p["reasoning"],
            })

        debate_rounds = []

        for round_num in range(1, self.rounds + 1):
            logger.info(f"Debate round {round_num} starting...")
            round_exchanges = []

            for agent in self.agents:
                logger.info(f"  Round {round_num} — {agent.role_name} responding...")
                try:
                    response = agent.debate_response(
                        scenario=scenario,
                        all_positions=current_positions,
                        prior_arguments=argument_memory,
                        round_number=round_num,
                    )

                    # Validate target_agent field
                    target = response.get("target_agent", "")
                    valid_agents = [a.role_name for a in self.agents if a.role_name != agent.role_name]
                    if target not in valid_agents:
                        target = valid_agents[0]

                    exchange = {
                        "agent": agent.role_name,
                        "target_agent": target,
                        "argument": response.get("argument", ""),
                        "stance": response.get("stance", "conditional"),
                    }
                    round_exchanges.append(exchange)

                    # Update this agent stance in current positions
                    for pos in current_positions:
                        if pos["agent"] == agent.role_name:
                            pos["stance"] = exchange["stance"]
                            break

                    # Add to memory so future rounds know what was said
                    argument_memory.append({
                        "agent": agent.role_name,
                        "round": round_num,
                        "argument": exchange["argument"],
                    })

                except Exception as e:
                    logger.error(f"Debate error — {agent.role_name} round {round_num}: {e}")
                    round_exchanges.append({
                        "agent": agent.role_name,
                        "target_agent": "CEO",
                        "argument": f"[Agent error in round {round_num}]",
                        "stance": "conditional",
                    })

            debate_rounds.append({
                "round_number": round_num,
                "exchanges": round_exchanges,
            })
            logger.info(f"Debate round {round_num} complete — {len(round_exchanges)} exchanges.")

        return debate_rounds, current_positions