# FinAgent — AI Boardroom Simulator

> Multi-agent strategic decision simulation for financial services.  
> Four AI executives debate your business scenario and reach an explainable board-level decision — live, in a 3D voxel office.

---

## What it does

Submit any strategic business scenario and four AI executives analyse it, debate each other across multiple rounds, and collectively reach a decision with a full explainable summary.

Each agent has a distinct role, vocabulary, and risk appetite:

| Agent | Role | Vote Weight | Focus |
|-------|------|------------|-------|
| 👔 CEO | Chief Executive Officer | 30% | Strategy, growth, competitive positioning |
| 💰 CFO | Chief Financial Officer | 25% | Cost, ROI, capital efficiency |
| 📣 CMO | Chief Marketing Officer | 20% | Market demand, customer acquisition |
| 🛡️ Risk | Chief Risk Officer | 25% | Compliance, fraud, regulatory risk |

---

## Tech stack

- **Frontend** — Next.js 16 + TypeScript + Tailwind CSS
- **3D Office** — Three.js r128 (voxel Minecraft-style boardroom)
- **Backend** — Python 3.10 + FastAPI
- **Streaming** — Server-Sent Events for live chat feed
- **LLM** — OpenAI gpt-4o-mini
- **Memory** — JSON session logs (`backend/logs/`)
- **Platform** — Windows 10/11, PowerShell

---

## Prerequisites

- Python 3.10+ → https://python.org/downloads
- Node.js 18+ → https://nodejs.org
- An OpenAI API key with access to `gpt-4o-mini`
- Git (optional) → https://git-scm.com

---

## Project structure

```
finagent/
├── backend/
│   ├── agents/
│   │   ├── base_agent.py       # Shared LLM base class
│   │   ├── ceo_agent.py
│   │   ├── cfo_agent.py
│   │   ├── cmo_agent.py
│   │   └── risk_agent.py
│   ├── engine/
│   │   ├── debate_engine.py    # Multi-round debate orchestrator
│   │   └── decision_engine.py  # Weighted voting + LLM summary
│   ├── memory/
│   │   └── memory_store.py     # JSON session persistence
│   ├── models/
│   │   └── schemas.py          # Pydantic models
│   ├── logs/                   # Auto-created session files
│   ├── main.py                 # FastAPI app + all routes
│   ├── requirements.txt
│   └── .env                    # Your OPENAI_API_KEY (never commit)
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx            # Main page + streaming logic
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   └── Office3D.tsx        # Three.js voxel office scene
│   └── lib/
│       └── api.ts              # SSE streaming client + types
│
├── start.ps1                   # One-click Windows startup
└── README.md
```

---

## Local setup

### Step 1 — Get the project

```powershell
cd D:\
git clone https://github.com/your-username/finagent.git
cd finagent
```

Or download the ZIP and extract to `D:\finagent`.

---

### Step 2 — Backend setup

```powershell
cd D:\finagent\backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

> You should see `(venv)` at the start of your prompt after activation.

---

### Step 3 — Set your OpenAI API key

```powershell
$env:OPENAI_API_KEY = "sk-proj-your-actual-key-here"
```

To verify which models your key can access:

```powershell
python -c "
import os
from openai import OpenAI
client = OpenAI(api_key=os.environ['OPENAI_API_KEY'])
models = [m.id for m in client.models.list().data if 'gpt' in m.id]
print('\n'.join(sorted(models)))
"
```

---

### Step 4 — Frontend setup

```powershell
cd D:\finagent\frontend
npm install
```

Create the environment file:

```powershell
[System.IO.File]::WriteAllText("D:\finagent\frontend\.env.local", "NEXT_PUBLIC_API_URL=http://localhost:8000`n", [System.Text.Encoding]::UTF8)
```

---

## Running the project

### Option A — One-click startup

```powershell
cd D:\finagent
$env:OPENAI_API_KEY = "sk-proj-your-key"
.\start.ps1
```

This opens two PowerShell windows — one for the backend, one for the frontend.

---

### Option B — Manual startup

**Terminal 1 — Backend:**

```powershell
cd D:\finagent\backend
venv\Scripts\activate
$env:OPENAI_API_KEY = "sk-proj-your-key"
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend:**

```powershell
cd D:\finagent\frontend
npm run dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API docs | http://localhost:8000/docs |

---

## Using the app

1. Open `http://localhost:3000`
2. Type a scenario or click a **Sample** button
3. Choose debate rounds (1–3) and decision mode (Weighted / Majority)
4. Click **Convene** or press Enter
5. Watch agents light up in the 3D office with thinking bubbles as they respond
6. Live chat messages appear on the right in real time
7. Board Verdict banner appears when the simulation is complete

> A full simulation with 2 debate rounds takes approximately 30–50 seconds.

---

## Sample scenarios

- Should we launch a buy-now-pay-later product targeting millennials in Southeast Asia next quarter?
- Should we acquire a fintech startup specialising in AI-driven credit scoring for $120M?
- Should we shut down our physical branch network and go fully digital within 18 months?
- Should we partner with a cryptocurrency exchange to offer crypto-backed loans?
- Should we raise Series B funding now or wait until we reach profitability?

---

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/simulate` | Full simulation (blocking) |
| POST | `/simulate/stream` | Live streaming via SSE |
| GET | `/logs` | List all saved sessions |
| GET | `/logs/{session_id}` | Retrieve a saved session |

### SSE event types (`/simulate/stream`)

| Event | Description |
|-------|-------------|
| `session` | Session ID assigned |
| `status` | Which agent is currently thinking |
| `position` | Agent's initial stance + reasoning |
| `round_start` | Debate round beginning |
| `exchange` | Debate argument from one agent to another |
| `decision` | Final verdict, confidence, rationale |
| `done` | Simulation complete |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| API key not set | Run `$env:OPENAI_API_KEY = 'sk-...'` before starting uvicorn |
| 403 model error | Run the model check command and update `self.model` in `base_agent.py` |
| Null bytes error | Use `[System.IO.File]::WriteAllText()` with UTF8 — never `echo '' > file.py` |
| CORS error | Ensure backend is on port 8000 and frontend on port 3000 |
| Three.js not found | Run `cd frontend && npm install three@0.128.0 @types/three` |
| Port in use | `Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess \| Stop-Process` |
| venv won't activate | `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` |

---

## How it works

1. **Initial positions** — Each agent reads the scenario and returns a stance (approve / conditional / reject), reasoning, and top concern
2. **Debate rounds** — Each agent reads all other positions + memory of prior arguments, then produces a new counter-argument targeting their biggest opponent
3. **Decision aggregation** — Final stances are weighted (CEO 30%, CFO 25%, CMO 20%, Risk 25%) or majority-voted; confidence = weighted approval score
4. **Explainable summary** — A final LLM call synthesises the debate into verdict, confidence %, rationale, supporting arguments, and key disagreements

---

## Environment variables

| Variable | Location | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | PowerShell / `backend/.env` | Your OpenAI secret key |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | Backend URL (default: `http://localhost:8000`) |

---

*FinAgent — built for hackathon demonstration. Extend freely.*
