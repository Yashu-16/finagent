import os
import uuid
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from models.schemas import (
    ScenarioRequest,
    SimulationResponse,
    HealthResponse,
    AgentPosition,
    DebateRound,
    DebateExchange,
    FinalDecision,
)
from agents.ceo_agent import CEOAgent
from agents.cfo_agent import CFOAgent
from agents.cmo_agent import CMOAgent
from agents.risk_agent import RiskAnalystAgent
from engine.debate_engine import DebateEngine
from engine.decision_engine import DecisionEngine
from memory.memory_store import save_session, load_session, list_sessions

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)

AGENTS = [CEOAgent(), CFOAgent(), CMOAgent(), RiskAnalystAgent()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        logger.warning("OPENAI_API_KEY is not set.")
    else:
        logger.info("OPENAI_API_KEY loaded successfully.")
    yield
    logger.info("FinAgent backend shutting down.")


app = FastAPI(
    title="FinAgent API",
    description="Multi-agent AI system for strategic financial decision simulation",
    version="0.4.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    api_key = os.getenv("OPENAI_API_KEY", "")
    return HealthResponse(
        status="ok",
        version="0.4.0",
        api_key_loaded=bool(api_key),
    )


@app.post("/simulate", response_model=SimulationResponse, tags=["Simulation"])
async def simulate(request: ScenarioRequest):
    session_id = str(uuid.uuid4())[:8]
    logger.info(f"[{session_id}] Simulation started: {request.scenario[:60]}...")

    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="OPENAI_API_KEY is not configured on the server."
        )

    # Step 1 — Initial positions
    initial_positions = []
    for agent in AGENTS:
        logger.info(f"[{session_id}] Getting position from {agent.role_name}...")
        try:
            position = agent.get_initial_position(request.scenario)
            initial_positions.append(
                AgentPosition(
                    agent=position["agent"],
                    role=position["role"],
                    stance=position.get("stance", "conditional"),
                    reasoning=position.get("reasoning", ""),
                    key_concern=position.get("key_concern", ""),
                )
            )
        except Exception as e:
            logger.error(f"[{session_id}] Error from {agent.role_name}: {e}")
            raise HTTPException(status_code=500, detail=f"Agent {agent.role_name} failed: {str(e)}")

    logger.info(f"[{session_id}] All initial positions collected.")

    # Step 2 — Debate
    logger.info(f"[{session_id}] Starting debate — {request.config.debate_rounds} round(s)...")
    debate_engine = DebateEngine(agents=AGENTS, rounds=request.config.debate_rounds)
    raw_positions = [p.model_dump() for p in initial_positions]
    raw_rounds, final_positions = debate_engine.run(
        scenario=request.scenario,
        initial_positions=raw_positions,
    )

    debate_rounds = []
    for r in raw_rounds:
        exchanges = [
            DebateExchange(
                agent=ex["agent"],
                target_agent=ex["target_agent"],
                argument=ex["argument"],
                stance=ex["stance"],
            )
            for ex in r["exchanges"]
        ]
        debate_rounds.append(DebateRound(round_number=r["round_number"], exchanges=exchanges))

    logger.info(f"[{session_id}] Debate complete.")

    # Step 3 — Decision
    logger.info(f"[{session_id}] Aggregating decision...")
    decision_engine = DecisionEngine()
    decision_data = decision_engine.aggregate(
        scenario=request.scenario,
        initial_positions=raw_positions,
        final_positions=final_positions,
        debate_rounds=raw_rounds,
        mode=request.config.decision_mode,
    )

    final_decision = FinalDecision(
        verdict=decision_data["verdict"],
        confidence=decision_data["confidence"],
        supporting_arguments=decision_data["supporting_arguments"],
        disagreements=decision_data["disagreements"],
        rationale=decision_data["rationale"],
    )

    logger.info(f"[{session_id}] Decision: {final_decision.verdict} ({final_decision.confidence:.0%})")

    # Step 4 — Persist to memory
    result = SimulationResponse(
        session_id=session_id,
        scenario=request.scenario,
        initial_positions=initial_positions,
        debate_rounds=debate_rounds,
        final_decision=final_decision,
    )
    save_session(session_id, result.model_dump())

    return result


@app.get("/logs/{session_id}", tags=["Memory"])
async def get_session_log(session_id: str):
    """Retrieve a saved simulation session by ID."""
    data = load_session(session_id)
    if data is None:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found.")
    return data


@app.get("/logs", tags=["Memory"])
async def list_session_logs():
    """List all saved simulation session IDs."""
    return {"sessions": list_sessions()}