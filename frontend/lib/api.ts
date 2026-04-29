const BASE_URL = "http://127.0.0.1:8000";

export interface SimulationConfig {
  debate_rounds: number;
  decision_mode: "weighted" | "majority";
  agent_weights?: Record<string, number>;
}

export interface AgentPosition {
  agent: string;
  role: string;
  stance: "approve" | "reject" | "conditional";
  reasoning: string;
  key_concern: string;
}

export interface DebateExchange {
  agent: string;
  target_agent: string;
  argument: string;
  stance: "approve" | "reject" | "conditional";
  round?: number;
}

export interface DebateRound {
  round_number: number;
  exchanges: DebateExchange[];
}

export interface FinalDecision {
  verdict: string;
  confidence: number;
  supporting_arguments: string[];
  disagreements: string[];
  rationale: string;
}

export interface SimulationResponse {
  session_id: string;
  scenario: string;
  initial_positions: AgentPosition[];
  debate_rounds: DebateRound[];
  final_decision: FinalDecision;
}

export type StreamEvent =
  | { type: "session";     session_id: string }
  | { type: "status";      text: string; agent: string | null }
  | { type: "position";    agent: string; role: string; stance: string; reasoning: string; key_concern: string }
  | { type: "round_start"; round: number }
  | { type: "exchange";    agent: string; target_agent: string; argument: string; stance: string; round: number }
  | { type: "decision";    verdict: string; confidence: number; supporting_arguments: string[]; disagreements: string[]; rationale: string }
  | { type: "done";        session_id: string }
  | { type: "error";       agent: string; message: string };

export async function streamSimulation(
  scenario: string,
  config: SimulationConfig,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const response = await fetch(`${BASE_URL}/simulate/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario, config }),
  });

  if (!response.ok) throw new Error(`Server error: ${response.status}`);
  if (!response.body) throw new Error("No response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const lines = part.trim().split("\n");
      let eventType = "";
      let dataStr = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) eventType = line.slice(7).trim();
        if (line.startsWith("data: "))  dataStr  = line.slice(6).trim();
      }
      if (eventType && dataStr) {
        try {
          const data = JSON.parse(dataStr);
          onEvent({ type: eventType, ...data } as StreamEvent);
        } catch {}
      }
    }
  }
}