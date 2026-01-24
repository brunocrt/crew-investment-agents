# Crew Investment Recommendation Agents

This repository contains a multi‑agent investment recommendation system built
with [CrewAI](https://www.crewai.com/) and powered by a FastAPI backend and a
lightweight frontend.  The goal of the application is to demonstrate how
autonomous agents can collaborate to identify actionable stock ideas based on
real‑world signals such as capital expenditure trends, commodity price
movements and institutional sector rotation.

> **Disclaimer**: This project is for educational purposes only.  It does not
> constitute financial advice, and no investment decisions should be made
> solely on the output of this software.

## Features

### Multi‑Agent Analysis

The system orchestrates a team of four agents, each with a specific role:

* **Capex Researcher** – examines recent cash‑flow statements to detect
  significant increases in capital expenditures among target companies.
* **Pricing Power Analyst** – monitors commodity and component prices for
  unexpected spikes that could indicate supply shortages.
* **Institutional Rotation Analyst** – compares sector ETF performance to the
  broader market to infer where large investors are allocating capital.
* **Recommendation Strategist** – synthesises the preceding analyses into a
  concise report with buy/hold recommendations.

The agents are implemented using CrewAI’s declarative YAML configs and
custom tools that wrap Python functions.  Data is fetched via the
[yfinance](https://github.com/ranaroussi/yfinance) library and processed
into structured JSON before being passed to the language model for
reasoning.

### Backend API

The FastAPI server exposes endpoints to create new analyses, list existing
ones, retrieve detailed results and fetch logs.  Analyses run in
background tasks so that the API remains responsive.  All output printed
during agent execution is captured and persisted to an SQLite database.

* `POST /analyses` – Start a new analysis by providing a comma‑separated
  list of tickers.  Returns a UUID for the created analysis.
* `GET /analyses` – List all analyses with status and recommendation.
* `GET /analyses/{id}` – Retrieve full details for a single analysis.
* `GET /analyses/{id}/logs` – Fetch persisted log lines for an analysis.
* `GET /ws/{id}` – WebSocket endpoint that streams live logs to the client.

### Interactive Frontend

The frontend is a simple HTML/JavaScript app styled with Tailwind via
CDN.  It displays the number of analyses, counts the active agents,
shows a list of recent analyses and allows the user to launch new
analyses.  A live log console streams agent actions through a WebSocket
connection, letting you observe the decision‑making process in real time.

## Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/brunocrt/crew-investment-agents.git
   cd crew-investment-agents
   ```

2. **Install Python dependencies**

   It is recommended to use a virtual environment:

   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Configure environment variables**

   The system relies on an OpenAI API key to power the language model.  Set
   the following variables in your shell or a `.env` file:

   ```bash
   export OPENAI_API_KEY=sk-...
   # Optional: override model and temperature
   export OPENAI_MODEL=gpt-4-turbo
   export OPENAI_TEMPERATURE=0.3
   ```

4. **Run the backend**

   Start the FastAPI server via Uvicorn:

   ```bash
   uvicorn backend.main:app --reload
   ```

   The API will be served at `http://localhost:8000`.

5. **Open the frontend**

   Simply open `frontend/index.html` in your browser.  The page will
   communicate with the backend running on `localhost:8000`.  If you
   deploy the API elsewhere, adjust the `API_BASE` constant in
   `frontend/main.js` accordingly.

## Development Notes

* The backend persists data in an SQLite database located at `app.db`.  If
  you wish to start fresh, delete this file before launching the server.
* You can adjust the list of monitored commodities in
  `backend/services/pricing.py` and the sectors analysed in
  `backend/services/rotation.py`.
* CrewAI is configured with `verbose=2`, which prints step‑by‑step
  reasoning.  These logs are captured and streamed to the frontend.

## License

This project is open‑sourced under the MIT License.  See the `LICENSE`
file for details.