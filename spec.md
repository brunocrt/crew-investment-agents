# Stock Recommendation System Specification

## Overview

This project implements a user-authenticated investment analysis console for identifying buy opportunities, portfolio risks, and exit signals. It uses CrewAI agents for research and synthesis, deterministic backend services for scoring and evidence, a FastAPI API, SQLite persistence, and a static JavaScript frontend.

The product goal is to help a user answer:

- What should I consider buying?
- What current positions require attention?
- Why did the system classify a ticker as buy, hold, sell, caution, or neutral?
- How have recommendations changed across analyses?
- Which settings and risk tolerance produced a given recommendation?

The system is not a broker and does not place real trades.

## Backend

The backend is implemented in Python with FastAPI, SQLAlchemy, SQLite, and CrewAI.

### Data Models

`User`

- Stores username, display name, password hash, role, active state, preferences, and timestamps.
- Roles are `admin` and `user`.
- The default admin is seeded from `APP_USERNAME` and `APP_PASSWORD`, falling back to `admin / investment123`.

`Analysis`

- Stores an analysis run id, comma-separated ticker list, status, aggregate recommendation string, full JSON summary, owner user id, created timestamp, and updated timestamp.
- Regular users can only access their own analyses.
- Admin users can access all analyses.

`LogEntry`

- Persists each emitted analysis log line with timestamp and analysis id.
- Logs are also streamed through WebSockets during active runs.

`RecommendationHistory`

- Stores per-ticker rating, current price, percent change, report time, and reason.
- Used by ticker history modals and the Positions page.

`Candidate`

- Stores core and dynamically discovered monitor candidates with source, status, theme, sector, reason, liquidity flag, discovery score, and discovery timestamp.

### Services

`capex.py`

- Fetches capital expenditure data and calculates capex growth.

`pricing.py`

- Monitors commodity/component instruments and detects price spikes.

`rotation.py`

- Compares sector ETF returns and behavior against SPY.

`sell.py`

- Detects exit-oriented risk flags such as fundamental peak, technical exhaustion, and distribution days.

`valuation.py`

- Produces FastGraphs-inspired valuation context:
  - current P/E
  - forward P/E
  - historical normal P/E
  - target multiple
  - fair value
  - margin of safety
  - valuation label
  - valuation score
  - quality score
  - expected growth
  - profitability and leverage context

`scoring.py`

- Calculates deterministic component scores, final opportunity score, confidence, suggested rating, structured evidence, risks, and rating thresholds.
- Accepts analysis preferences, including risk tolerance and score thresholds.
- Higher risk tolerance lowers the buy and valuation thresholds.
- Conservative tolerance requires stronger opportunity and valuation support.

`candidates.py`

- Seeds core candidates.
- Discovers additional candidates.
- Scores dynamic candidates using momentum, drawdown, volatility, liquidity, and thesis relevance.
- Selects active candidates for monitor runs.

## Agents And Tasks

Agents are defined in YAML and instantiated through CrewAI.

- Capex Researcher uses the Capex Growth Analyzer tool.
- Pricing Power Analyst uses the Pricing Power Detector tool.
- Institutional Rotation Analyst uses the Sector Rotation Monitor tool.
- Recommendation Strategist synthesizes research and uses the Sell Signal Detector tool.

The recommendation task asks the LLM to return structured JSON. The backend treats that JSON as model output, then normalizes and enriches it with deterministic scoring and safeguards.

## Rating Rules

The backend enriches every recommendation with deterministic scoring. The final card rating can come from the LLM or the deterministic model, with guardrails:

- If deterministic scoring says `buy`, the backend can promote a model neutral/hold label to `buy` when no structured risks are present.
- If a ticker triggers an exit signal but the user has no prior buy recommendation for that ticker, the active rating is converted to neutral and the exit signal is preserved as risk evidence.
- If the LLM omits a requested ticker, the backend adds a neutral fallback entry.
- If LLM output is malformed, the backend stores a fallback report with neutral entries for all requested tickers.

Default balanced thresholds:

- Buy threshold: 70 opportunity score.
- Hold threshold: buy threshold minus 25, floored at 35.
- Valuation threshold: 35 valuation score.

Risk tolerance adjusts those thresholds based on the frontend risk dial.

## API

Authentication:

- `POST /auth/login`
- `GET /auth/me`
- `PATCH /auth/me`

Admin user management:

- `GET /users`
- `POST /users`
- `DELETE /users/{user_id}`

Analyses:

- `POST /analyses`
  - Body: `tickers?: string[]`, `analysis_settings?: object`
  - Starts an asynchronous analysis.
  - If tickers are empty, the backend selects monitor candidates.
- `GET /analyses`
  - Lists visible analysis metadata.
  - Includes risk tolerance metadata extracted from stored report JSON.
- `GET /analyses/{id}`
  - Returns full report JSON, analysis settings, risk tolerance, and metadata.
- `GET /analyses/{id}/logs`
  - Returns persisted logs.
- `DELETE /analyses/{id}`
  - Deletes analysis, logs, and recommendation history.
- `WebSocket /ws/{id}?token=...`
  - Streams live logs.

History:

- `GET /history/{ticker}`
  - Returns chronological recommendation history for a ticker, scoped by user.

Candidate universe:

- `GET /candidates`
- `GET /candidates?discover=true`

Agent configuration, admin only:

- `GET /agent-config`
- `PUT /agent-config`

## Analysis Flow

1. User starts an analysis from Dashboard, Positions, Financial Settings, or Monitor Reports.
2. Frontend sends tickers and `analysis_settings`.
3. Backend creates an `Analysis` row with `running` status.
4. CrewAI runs in a background task.
5. Stdout is captured and streamed to WebSocket clients and persisted as `LogEntry`.
6. Crew result is parsed as JSON.
7. Backend attaches the analysis settings snapshot to the stored report.
8. Backend enriches recommendations with:
   - current price
   - 30-day price change
   - deterministic score
   - confidence
   - valuation profile
   - score breakdown
   - evidence
   - risks
   - rating thresholds
9. Backend applies rating guardrails and fallback entries.
10. Analysis status becomes `completed`, recommendation summary is persisted, and `RecommendationHistory` rows are created.

## Frontend

The frontend is a single-page application using static HTML, JavaScript, Tailwind CDN, and Lucide icons.

### Login

- Displays a branded image-style background.
- Authenticates against the backend.
- Stores a bearer token and user profile in `sessionStorage`.
- Logout clears the session, closes live WebSockets, and stops background refresh timers.

### Dashboard

- Shows portfolio summary.
- Focuses on investor actions:
  - Buy Actions
  - Sell / Exit
  - Hold / Watch
- Shows a Market Action Trend chart using recent completed analyses.
- Trend bars show recommendation mix and include a marker for risk tolerance used by each analysis.
- Contains selected Analysis Report and collapsible Agent Logs panels.

### Recommendation Cards

Cards are grouped by actionability:

- Buy Candidates
- Exit Risk
- Caution
- Watchlist / Neutral

Each card displays:

- ticker and rating
- owned badge when applicable
- opportunity score
- valuation score
- current price
- 30-day price change
- report timestamp
- valuation context and interpretation
- evidence and risk panel
- portfolio position context when owned
- trade planning button for buy ratings
- ticker history button

Color coding:

- Green: supportive/good signals.
- Yellow: weak/mixed signals.
- Red: risk/bad signals.
- White/slate: neutral context.

### Positions Page

Shows current tracked positions for the logged-in user:

- ticker
- latest recommendation status
- shares
- average cost
- cost basis
- allocation
- latest analyzed price
- market value
- unrealized P/L
- last analyzed timestamp
- quick Analyze and Remove actions

Market values use the latest price captured in recommendation history. They are not live brokerage values.

### Analysis History Page

Provides a full-page long-term analysis history:

- search by ticker or recommendation text
- filter by status
- filter by action type
- open report
- delete analysis
- per-run Buy/Sell/Hold/Neutral counts
- saved risk tolerance display

The sidebar only shows the five most recent analyses and a link to the full history page.

### Financial Settings

Includes:

- available balance
- invested amount
- holding creation/update form
- candidate universe and refresh button
- candidate refresh cadence:
  - on monitor run
  - daily
  - weekly
  - manual only
- risk tolerance dial:
  - lower risk
  - balanced
  - higher risk
- derived thresholds:
  - max position size
  - stop loss
  - target gain
  - minimum opportunity score
  - minimum valuation score

### Agent Settings

Admin-only page for:

- agent roles
- goals
- backstories
- task descriptions
- expected outputs
- LLM model
- LLM temperature
- LLM API key override

The system loads from `.env` by default, then can be overridden from the settings page.

### Account Page

All users can:

- update display name
- update password
- set preferred start page

Admins additionally see:

- create-user form
- user list

## Portfolio Isolation

Analyses and recommendation history are stored server-side and scoped by user.

Portfolio holdings are stored client-side per user in localStorage:

```text
investment-console-portfolio:<user id>
```

The legacy shared `portfolio` key is migrated once to the first logged-in user after upgrade and then removed.

## Configuration

Environment:

- `OPENAI_API_KEY`
- `APP_USERNAME`
- `APP_PASSWORD`

Config files:

- `backend/config/agents.yaml`
- `backend/config/tasks.yaml`
- `backend/config/llm.yaml`
- `backend/config/llm.local.yaml`

`llm.local.yaml` is used for local overrides and secrets and is ignored by git.

## Deployment

The project runs with Docker Compose or Podman Compose.

Services:

- backend: FastAPI/Uvicorn on port `8000`
- frontend: Nginx static server on port `3000`

Typical command:

```bash
docker compose up --build -d
```

Development checks:

```bash
node --check frontend/main.js
python -m py_compile backend/main.py backend/services/scoring.py
```

## Non-Goals

- The application does not execute real trades.
- Portfolio values are simulated/tracked, not broker-synchronized.
- Latest position prices come from recommendation history, not a live quote stream.
- The system is not investment advice.
