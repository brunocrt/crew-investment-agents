# Crew Investment Recommendation Agents

Crew Investment Recommendation Agents is a local investment analysis console built with CrewAI, FastAPI, SQLite, and a vanilla HTML/JavaScript frontend. It coordinates multiple agents and deterministic scoring services to evaluate stocks, show buy/sell/hold context, track portfolio positions, and preserve analysis history by user.

> Disclaimer: This project is for education and experimentation only. It is not financial advice and should not be used as the sole basis for investment decisions.

## Highlights

- Multi-agent analysis for capex growth, pricing power, sector rotation, exit risk, and recommendation synthesis.
- FastGraphs-inspired valuation context with fair value, margin of safety, valuation score, quality score, and interpretation panels.
- Deterministic scoring with configurable risk tolerance and buy/valuation thresholds.
- Authenticated frontend with default admin login and admin-only user registration.
- User-scoped analyses, recommendation history, and local portfolio state.
- Dashboard focused on investor actions: Buy Actions, Sell / Exit, Hold / Watch, plus a historical action trend chart.
- Positions page for current holdings, cost basis, latest analyzed price, market value, P/L, and quick analyze/remove actions.
- Analysis History page with search and filters for status/action type.
- Financial Settings page for portfolio balance, holdings input, candidate universe, refresh cadence, and analysis preferences.
- Agent Settings page for admin users to tune agents, tasks, LLM model, temperature, and API key override.

## Architecture

The backend is a FastAPI application using SQLAlchemy models persisted to `app.db`. Analysis runs execute as background tasks and stream logs to the frontend through WebSockets.

The frontend is a static app served from `frontend/`. It uses Tailwind via CDN, Lucide icons, session-based auth tokens, and localStorage for per-user portfolio and UI preferences.

The main backend services are:

- `backend/services/capex.py`: capital expenditure growth.
- `backend/services/pricing.py`: commodity and component price spikes.
- `backend/services/rotation.py`: sector ETF rotation versus SPY.
- `backend/services/sell.py`: fundamental, technical, and distribution-day exit signals.
- `backend/services/valuation.py`: valuation and quality profile.
- `backend/services/scoring.py`: deterministic opportunity score, confidence, rating, evidence, and risk flags.
- `backend/services/candidates.py`: candidate universe seeding, discovery, and monitor selection.

## Authentication And Users

The app requires login. By default, the backend seeds an admin account:

```text
username: admin
password: investment123
```

You can override the default seed account with:

```bash
APP_USERNAME=admin
APP_PASSWORD=your-password
```

Admin users can:

- Register users.
- View the Agent Settings page.
- View API Docs from the sidebar.
- Update agent/task/LLM configuration.

Regular users can:

- Run analyses.
- View only their own analyses and logs.
- Manage their account preferences and password.
- Track their own portfolio positions.

## Backend API

Most endpoints require a bearer token from `POST /auth/login`.

- `POST /auth/login`: authenticate and receive a token.
- `GET /auth/me`: get current user profile.
- `PATCH /auth/me`: update display name, password, and preferences.
- `GET /users`: list users, admin only.
- `POST /users`: create user, admin only.
- `DELETE /users/{id}`: delete user, admin only.
- `POST /analyses`: start an async analysis. Accepts `tickers` and `analysis_settings`.
- `GET /analyses`: list analyses visible to the current user.
- `GET /analyses/{id}`: retrieve full report JSON and metadata.
- `GET /analyses/{id}/logs`: retrieve persisted logs.
- `DELETE /analyses/{id}`: delete an analysis and related logs/history.
- `GET /history/{ticker}`: recommendation history for a ticker.
- `GET /candidates?discover=true`: list or refresh the candidate universe.
- `GET /agent-config`: fetch agent configuration, admin only.
- `PUT /agent-config`: save agent configuration, admin only.
- `WebSocket /ws/{analysis_id}?token=...`: stream live run logs.

## Analysis Flow

1. The user starts a new analysis, monitor run, position analysis, or holdings analysis.
2. The frontend sends tickers plus an analysis settings snapshot, including risk tolerance.
3. The backend creates an `Analysis` row and runs the CrewAI workflow in the background.
4. Logs are persisted and streamed live to the UI.
5. Crew output is parsed as JSON, then enriched with pricing, scoring, valuation, evidence, and risk context.
6. Missing requested tickers are added as neutral fallback cards.
7. The prior-buy guard prevents hold/sell from becoming active exit recommendations unless the user previously received a buy recommendation for that ticker.
8. The report JSON and aggregate recommendation string are persisted.
9. Recommendation history rows are saved per ticker.

Risk tolerance affects deterministic scoring. A higher dial lowers the required buy threshold and valuation threshold, while conservative settings require stronger evidence before a buy rating.

## Frontend Pages

- **Dashboard**: portfolio summary, action counts, market action trend, selected report, recommendation cards, and agent logs.
- **Positions**: current holdings, allocation, latest analyzed market value, unrealized P/L, latest rating, and quick analyze/remove actions.
- **Analysis History**: full searchable and filterable history, replacing the old long sidebar list.
- **Financial Settings**: available balance, holdings input, candidate universe, candidate refresh cadence, and risk-tolerance dial.
- **Agent Settings**: admin-only agent/task/LLM configuration, including API key override.
- **Account**: display name, password, start page preference, and admin-only user registration/list.

## Configuration

Set the OpenAI API key in `.env`:

```bash
OPENAI_API_KEY=sk-...
```

LLM behavior can also be configured from the Agent Settings page. The backend reads base configuration from:

- `backend/config/agents.yaml`
- `backend/config/tasks.yaml`
- `backend/config/llm.yaml`

Sensitive local overrides, including API key overrides, are stored in:

```text
backend/config/llm.local.yaml
```

That file is ignored by git.

## Running With Podman Or Docker Compose

```bash
docker compose up --build -d
```

The current compose setup serves:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

On Windows with Podman Desktop, the equivalent command used during development was:

```powershell
podman compose up --build -d
```

## Local Development

Install dependencies:

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Run the backend:

```bash
uvicorn backend.main:app --reload
```

Serve or open the frontend from `frontend/index.html`. In container mode, Nginx serves the frontend on port `3000`.

## Data And Storage

- Backend data is stored in SQLite at `app.db`.
- Backend analyses, logs, users, recommendation history, and candidates are database-backed.
- Frontend portfolio positions are stored per user in localStorage under `investment-console-portfolio:<user id>`.
- The old shared `portfolio` localStorage key is migrated once to the first logged-in user after upgrade.

## Useful Development Checks

```bash
node --check frontend/main.js
python -m py_compile backend/main.py backend/services/scoring.py
```

## License

This project is open source under the MIT License.
