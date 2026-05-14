import os
import uuid
import json
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from models.schemas import (
    ScenarioRequest, SimulationResponse, HealthResponse,
    AgentPosition, DebateRound, DebateExchange, FinalDecision,
)
from agents.ceo_agent import CEOAgent
from agents.cfo_agent import CFOAgent
from agents.cmo_agent import CMOAgent
from agents.risk_agent import RiskAnalystAgent
from engine.debate_engine import DebateEngine
from engine.decision_engine import DecisionEngine
from engine.news_fetcher import fetch_news
from memory.memory_store import save_session, load_session, list_sessions

env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

AGENTS = [CEOAgent(), CFOAgent(), CMOAgent(), RiskAnalystAgent()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    api_key = os.getenv("OPENAI_API_KEY", "")
    news_key = os.getenv("NEWS_API_KEY", "")
    if not api_key:
        logger.warning("OPENAI_API_KEY is not set.")
    else:
        logger.info("OPENAI_API_KEY loaded successfully.")
    if not news_key:
        logger.warning("NEWS_API_KEY is not set — news injection disabled.")
    else:
        logger.info(f"NEWS_API_KEY loaded successfully ({news_key[:8]}...).")
    yield


app = FastAPI(title="Bod AI API", version="0.8.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.1.154:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    return HealthResponse(
        status="ok", version="0.8.0",
        api_key_loaded=bool(os.getenv("OPENAI_API_KEY"))
    )


def emit(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@app.post("/simulate/stream", tags=["Simulation"])
async def simulate_stream(request: ScenarioRequest):
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY not configured.")

    session_id = str(uuid.uuid4())[:8]

    async def generate():
        yield emit("session", {"session_id": session_id})

        # ── Fetch relevant news for this scenario ─────────────────────
        yield emit("status", {"text": "Fetching latest market news…", "agent": None})
        news_context = fetch_news(request.scenario)

        if news_context:
            logger.info(f"[{session_id}] News context fetched: {len(news_context)} chars")
            # Extract headlines only (skip the header line)
            headline_lines = [
                l for l in news_context.split("\n")
                if l.strip() and not l.startswith("RELEVANT")
            ]
            headlines_preview = "\n".join(headline_lines[:5])
            yield emit("news", {"headlines": headlines_preview})
        else:
            logger.info(f"[{session_id}] No news context (key not set or fetch failed)")

        # ── Phase 1: Initial positions ────────────────────────────────
        initial_positions = []

        for agent in AGENTS:
            yield emit("status", {
                "text": f"{agent.role_name} is forming a position…",
                "agent": agent.role_name,
            })
            try:
                pos = agent.get_initial_position(
                    request.scenario,
                    news_context=news_context,
                )
                clean_pos = {
                    "agent":       pos.get("agent",       agent.role_name),
                    "role":        pos.get("role",        agent.role_title),
                    "stance":      pos.get("stance",      "conditional"),
                    "reasoning":   pos.get("reasoning",   ""),
                    "key_concern": pos.get("key_concern", ""),
                }
                initial_positions.append(clean_pos)
                yield emit("position", clean_pos)
            except Exception as e:
                logger.error(f"Error from {agent.role_name}: {e}")
                yield emit("error", {"agent": agent.role_name, "message": str(e)})

        # ── Phase 2: Debate rounds ────────────────────────────────────
        raw_rounds = []
        argument_memory = [
            {"agent": p["agent"], "round": 0, "argument": p["reasoning"]}
            for p in initial_positions
        ]
        current_positions = [dict(p) for p in initial_positions]

        for round_num in range(1, request.config.debate_rounds + 1):
            yield emit("round_start", {"round": round_num})
            round_exchanges = []

            for agent in AGENTS:
                yield emit("status", {
                    "text": f"Round {round_num} — {agent.role_name} is responding…",
                    "agent": agent.role_name,
                })
                valid_agents = [a.role_name for a in AGENTS if a.role_name != agent.role_name]
                try:
                    response = agent.debate_response(
                        scenario=request.scenario,
                        all_positions=current_positions,
                        prior_arguments=argument_memory,
                        round_number=round_num,
                        news_context=news_context,
                    )
                    target = response.get("target_agent", valid_agents[0])
                    if target not in valid_agents:
                        target = valid_agents[0]

                    exchange = {
                        "agent":        agent.role_name,
                        "target_agent": target,
                        "argument":     response.get("argument", ""),
                        "stance":       response.get("stance", "conditional"),
                        "round":        round_num,
                    }
                    round_exchanges.append(exchange)

                    for p in current_positions:
                        if p["agent"] == agent.role_name:
                            p["stance"] = exchange["stance"]
                            break

                    argument_memory.append({
                        "agent":    agent.role_name,
                        "round":    round_num,
                        "argument": exchange["argument"],
                    })
                    yield emit("exchange", exchange)

                except Exception as e:
                    logger.error(f"Debate error {agent.role_name} r{round_num}: {e}")
                    fallback = {
                        "agent":        agent.role_name,
                        "target_agent": valid_agents[0],
                        "argument":     f"[Agent error in round {round_num}]",
                        "stance":       "conditional",
                        "round":        round_num,
                    }
                    round_exchanges.append(fallback)
                    yield emit("exchange", fallback)

            raw_rounds.append({"round_number": round_num, "exchanges": round_exchanges})

        # ── Phase 3: Decision ─────────────────────────────────────────
        yield emit("status", {"text": "Board is reaching a decision…", "agent": None})
        decision_engine = DecisionEngine()
        decision_data = decision_engine.aggregate(
            scenario=request.scenario,
            initial_positions=initial_positions,
            final_positions=current_positions,
            debate_rounds=raw_rounds,
            mode=request.config.decision_mode,
            agent_weights=request.config.agent_weights,
        )
        yield emit("decision", decision_data)

        save_session(session_id, {
            "session_id":        session_id,
            "scenario":          request.scenario,
            "initial_positions": initial_positions,
            "debate_rounds":     raw_rounds,
            "final_decision":    decision_data,
            "news_used":         bool(news_context),
        })
        yield emit("done", {"session_id": session_id})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/simulate", response_model=SimulationResponse, tags=["Simulation"])
async def simulate(request: ScenarioRequest):
    session_id = str(uuid.uuid4())[:8]
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY not configured.")

    news_context = fetch_news(request.scenario)

    initial_positions = []
    for agent in AGENTS:
        try:
            pos = agent.get_initial_position(request.scenario, news_context=news_context)
            initial_positions.append(AgentPosition(
                agent=pos.get("agent", agent.role_name),
                role=pos.get("role", agent.role_title),
                stance=pos.get("stance", "conditional"),
                reasoning=pos.get("reasoning", ""),
                key_concern=pos.get("key_concern", ""),
            ))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Agent {agent.role_name} failed: {e}")

    debate_engine = DebateEngine(agents=AGENTS, rounds=request.config.debate_rounds)
    raw_positions = [p.model_dump() for p in initial_positions]
    raw_rounds, final_positions = debate_engine.run(
        scenario=request.scenario,
        initial_positions=raw_positions,
    )

    debate_rounds = [
        DebateRound(
            round_number=r["round_number"],
            exchanges=[DebateExchange(**ex) for ex in r["exchanges"]],
        )
        for r in raw_rounds
    ]

    decision_engine = DecisionEngine()
    decision_data = decision_engine.aggregate(
        scenario=request.scenario,
        initial_positions=raw_positions,
        final_positions=final_positions,
        debate_rounds=raw_rounds,
        mode=request.config.decision_mode,
        agent_weights=request.config.agent_weights,
    )

    final_decision = FinalDecision(**decision_data)
    result = SimulationResponse(
        session_id=session_id,
        scenario=request.scenario,
        initial_positions=initial_positions,
        debate_rounds=debate_rounds,
        final_decision=final_decision,
    )
    save_session(session_id, result.model_dump())
    return result


class CommentRequest(BaseModel):
    scenario: str = Field(..., min_length=1, max_length=2000)
    comment: str = Field(..., min_length=1, max_length=2000)
    initial_positions: list = []
    debate_rounds: list = []


@app.post("/comment/stream", tags=["Simulation"])
async def comment_stream(request: CommentRequest):
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY not configured.")

    async def generate():
        yield emit("status", {"text": "Stakeholder comment received…", "agent": None})
        yield emit("comment_round_start", {"comment": request.comment})

        argument_memory = []
        for p in request.initial_positions:
            argument_memory.append({
                "agent": p.get("agent", "Unknown"),
                "round": 0,
                "argument": p.get("reasoning", ""),
            })
        for r in request.debate_rounds:
            for ex in r.get("exchanges", []):
                argument_memory.append({
                    "agent": ex.get("agent", "Unknown"),
                    "round": r.get("round_number", 0),
                    "argument": ex.get("argument", ""),
                })

        all_positions = list(request.initial_positions or [])

        for agent in AGENTS:
            yield emit("status", {
                "text": f"{agent.role_name} is responding to you…",
                "agent": agent.role_name,
            })
            try:
                response = agent.respond_to_human(
                    scenario=request.scenario,
                    all_positions=all_positions,
                    prior_arguments=argument_memory,
                    human_comment=request.comment,
                )
                exchange = {
                    "agent":        agent.role_name,
                    "target_agent": "human",
                    "argument":     response.get("argument", ""),
                    "stance":       response.get("stance", "conditional"),
                    "round":        0,
                }
                argument_memory.append({
                    "agent":    agent.role_name,
                    "round":    0,
                    "argument": exchange["argument"],
                })
                yield emit("exchange", exchange)
            except Exception as e:
                logger.error(f"Comment response error {agent.role_name}: {e}")
                yield emit("error", {"agent": agent.role_name, "message": str(e)})

        yield emit("done", {"session_id": ""})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/logs/{session_id}", tags=["Memory"])
async def get_session_log(session_id: str):
    data = load_session(session_id)
    if not data:
        raise HTTPException(status_code=404, detail="Session not found.")
    return data


@app.get("/logs", tags=["Memory"])
async def list_session_logs():
    return {"sessions": list_sessions()}