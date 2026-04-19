from pydantic import BaseModel, Field
from typing import Optional, Literal


class SimulationConfig(BaseModel):
    debate_rounds: int = Field(default=2, ge=1, le=5)
    decision_mode: Literal["weighted", "majority"] = "weighted"


class ScenarioRequest(BaseModel):
    scenario: str = Field(
        ...,
        min_length=10,
        max_length=2000,
        description="The business scenario to simulate"
    )
    config: Optional[SimulationConfig] = SimulationConfig()


class AgentPosition(BaseModel):
    agent: str
    role: str
    stance: Literal["approve", "reject", "conditional"]
    reasoning: str
    key_concern: str


class DebateExchange(BaseModel):
    agent: str
    target_agent: str
    argument: str
    stance: Literal["approve", "reject", "conditional"]


class DebateRound(BaseModel):
    round_number: int
    exchanges: list[DebateExchange]


class FinalDecision(BaseModel):
    verdict: str
    confidence: float = Field(ge=0.0, le=1.0)
    supporting_arguments: list[str]
    disagreements: list[str]
    rationale: str


class SimulationResponse(BaseModel):
    session_id: str
    scenario: str
    initial_positions: list[AgentPosition]
    debate_rounds: list[DebateRound]
    final_decision: FinalDecision


class HealthResponse(BaseModel):
    status: str
    version: str
    api_key_loaded: bool