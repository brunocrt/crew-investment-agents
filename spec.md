Stock Recommendation System Specification
Overview

This project implements a multi‑agent stock recommendation system for identifying investment opportunities and exit signals in public markets. It uses CrewAI to coordinate several specialized agents that analyze regulatory filings, commodity prices, sector performance, and technical signals. The system exposes a FastAPI backend with REST and WebSocket endpoints, a frontend built with HTML/JavaScript that displays analyses and portfolio information, and runs entirely inside Docker containers.

The goal of the platform is to surface buy, neutral, hold or sell recommendations for equities and ETFs. Buy recommendations are based on indicators such as surging capital expenditure, commodity price spikes and sector rotation. Neutral ratings explain why a stock does not meet the buy criteria. Hold or sell ratings are only issued after a stock was previously recommended and subsequently triggers a red‑flag exit signal. Users can also maintain a simulated portfolio with available cash, view history of recommendation changes, and plan trades.

Architecture
Backend

The backend is implemented in Python with FastAPI and SQLAlchemy. It exposes the following components:

Data Models (SQLAlchemy):
Analysis: stores each analysis run with fields id, comma‑separated ticker list, status (running/completed/failed), recommendation (summary string), summary (JSON with full report), created_at and updated_at timestamps.
LogEntry: persists each line of agent output with a timestamp and a foreign key to analysis_id for streaming logs.
RecommendationHistory: records every recommendation issued for a ticker along with current price, percent change, report time and rationale. This supports a historical view of recommendation changes for each stock.
Services: small modules that wrap calls to financial data sources and compute metrics. Each service exposes a Python function used as a CrewAI tool.
capex.py: uses yfinance to fetch capital expenditure from company financial statements and calculate growth between the latest two periods.
pricing.py: downloads 30‑day closing price data for commodity futures and components; flags instruments with price spikes ≥5%.
rotation.py: downloads sector ETF prices and S&P 500 data; calculates trailing returns, relative returns, and how often a sector rises when the market falls; sets a rotation_signal if relative return is positive and the sector is up on at least 40% of down‑market days.
sell.py: evaluates exit signals for a stock. It flags red flags when inventory growth outruns revenue (fundamental peak), when price trades far above its 200‑day moving average and exhibits bearish RSI divergence (technical exhaustion), or when a stock experiences multiple distribution days (high‑volume declines) over a four‑week window.
price_info.py: fetches current stock price and 30‑day percent change.
candidates.py: returns the default watch‑list used when no tickers are supplied. The list includes industrial suppliers, utilities, sector ETFs, and major technology leaders such as NVDA, MSFT, AAPL, GOOGL, AMZN and AVGO to reflect the strong contribution of tech and communications stocks to 2025 market gains.

Agents & Tasks (CrewAI):

Agents are defined in YAML with roles and tasks. A typical crew uses four agents:

Agent	Role	Task
Capex Researcher	Analyst who reads 10‑Q filings and determines whether a company’s capital expenditure grew at least 20 %. Uses the Capex Growth Analyzer tool.	capex_task
Pricing Power Analyst	Monitors commodity and component price movements; flags instruments with price spikes ≥5 %. Uses the Pricing Power Detector tool.	pricing_task
Institutional Rotation Analyst	Evaluates sector ETFs versus the S&P 500; flags sectors that outperform the market and have defensive characteristics. Uses the Sector Rotation Monitor tool.	rotation_task
Recommendation Strategist	Synthesises the other agents’ results and uses the Sell Signal Detector tool to spot red flags. Always provides feedback on every requested ticker; assigns buy when the signals align, neutral when no strong signals exist, and hold or sell only after a prior buy and the presence of exit flags.	recommendation_task

Tasks descriptions and expected outputs are defined in backend/config/tasks.yaml. The recommendation_task instructs the LLM to produce a JSON object with a summary and a list of recommendations. The backend appends missing tickers as neutral entries and enriches each recommendation with current price, percent change, and ISO timestamp.

REST & WebSocket API (FastAPI):

POST /analyses: accepts an optional list of tickers; starts an asynchronous analysis using the crew. If no tickers are provided, it falls back to the default watch‑list from candidates.py.
GET /analyses: lists all analyses with basic metadata (tickers, created time, status, aggregated recommendation).
GET /analyses/{id}: returns detailed information, including the stored JSON summary.
GET /analyses/{id}/logs: returns persisted log entries for streaming in the UI.
DELETE /analyses/{id}: deletes an analysis and its logs.
GET /history/{ticker}: returns a chronological list of past recommendations for a given ticker, using RecommendationHistory.
WebSocket /ws/{id}: streams live logs to connected clients during a running analysis.

The backend uses asyncio to run the crew in a background task and captures stdout output line by line into LogEntry records and WebSocket broadcasts. After execution, it parses the JSON output, enriches it with price information, inserts neutral entries for any unmentioned requested tickers, updates the Analysis row with a summary and aggregated recommendation string, and writes RecommendationHistory rows for each ticker.

Frontend

The frontend is a single‑page application served by Nginx (in container) and built with vanilla HTML and JavaScript. It is styled to resemble the provided UI mock‑up and includes the following elements:

Header and Stats: shows total analyses, active agents and completed analyses.
Portfolio Section: displays available cash (editable, default $10 k) and invested amount. Users can adjust their cash and save it to local storage. The portfolio state is used to recommend trade sizes.
Action Buttons: a New Analysis button prompts the user to enter a comma‑separated list of tickers; a Monitor Reports button runs an analysis using the default watch‑list. Each analysis runs the full Capex, Pricing, Rotation and Sell workflows.
Recent Analyses Grid: shows a card for each analysis with ticker list, creation time (converted to the user’s local timezone), current status, aggregated recommendation and a delete (×) button. Cards are colour‑coded: green for completed, blue for running, red for failed.
Log Panel: when an analysis is selected, a streaming console shows log messages from the agents in real time via WebSocket.
Report Panel: displays the parsed summary and a table of recommendations. Each row lists the ticker, rating, reason, current price, percent change and report time, and includes two action buttons:
Trade (or Sell) opens a modal that pre‑populates a recommended share quantity (5 % of available cash by default), allows the user to edit stop‑loss and target prices, shows projected gains (including a simple dividend estimate), and updates the simulated portfolio upon confirmation.
History opens a modal that fetches the recommendation history for that ticker via GET /history/{ticker}. The modal lists past ratings, prices and reasons sorted by date.
Ticker symbols in the report table link directly to their Yahoo Finance quote pages.

The frontend stores the portfolio and preferences in localStorage so they persist across sessions. It uses the browser’s Intl.DateTimeFormat API to convert UTC timestamps returned by the backend into Eastern Time (America/New_York). When the system returns a JSON summary, the frontend gracefully handles both plain JSON and JSON wrapped in triple backticks.

Deployment

The project includes a Dockerfile and a docker‑compose.yml for easy deployment:

Dockerfile: builds a lightweight Python 3.12 image, installs dependencies from requirements.txt, copies the backend and frontend files, and launches the FastAPI app via Uvicorn on port 8000.
docker‑compose.yml: defines two services:
backend: builds from the Dockerfile, exposes port 8000, and accepts environment variables such as OPENAI_API_KEY and OPENAI_MODEL (default is gpt-4o).
frontend: uses nginx:alpine to serve the static frontend directory on port 3000. It depends on the backend service so both start together.

A typical deployment sequence is:

# build images
docker-compose build

# start services
docker-compose up

# visit the frontend
open http://localhost:3000

The system also runs locally for development by starting Uvicorn for the backend (uvicorn backend.main:app --reload) and serving the frontend via a simple static server (e.g., python -m http.server in the frontend directory).

Usage Flow
Initiate Analysis: The investor clicks New Analysis and enters tickers (e.g., SNDK). The backend creates an Analysis record and starts the CrewAI workflow asynchronously.
Agent Execution:
The Capex Researcher computes capex growth for each ticker. If data is unavailable, it logs an empty result.
The Pricing Power Analyst analyzes commodity price spikes.
The Rotation Analyst compares sector ETFs to the S&P 500.
The Recommendation Strategist synthesizes these results and consults the Sell Signal Detector for stocks previously recommended. It produces a JSON report with a summary and a list of recommendations. For tickers with no signals, it now emits a neutral rating and rationale.
Persistence & Enrichment: The backend enriches each recommendation with current price and 30‑day percent change via price_info.py, appends missing neutral entries, records each recommendation in RecommendationHistory, updates the analysis status to completed, and stores the JSON in Analysis.summary.
Frontend Display: The analysis appears in the Recent Analyses grid with a status badge. Selecting the card opens the log panel and report panel. The report shows buy/neutral/hold/sell ratings, reasons, price data, and timestamps. Action buttons allow simulation of trades or viewing recommendation history.
Trade Simulation: The investor can adjust the quantity, stop‑loss and target price for a given recommendation. Confirming the trade decreases the available cash and increases the invested amount; no real orders are executed.
Recommendation History: The History button fetches all past recommendations for a ticker and displays them in a modal. This helps investors understand why a previously bought stock may have flipped from buy to hold or sell.
Replicating the System from Scratch

To recreate this system, follow these high‑level steps:

Project structure: create a monorepo with backend/ and frontend/ folders, a Dockerfile, and a docker-compose.yml. Inside the backend, set up a FastAPI application with SQLAlchemy models (Analysis, LogEntry, RecommendationHistory) and configure database initialization. Inside the frontend, create an index.html with sections for the portfolio, action buttons, analysis cards, log panel, and report panel. Write main.js to handle API calls, WebSocket connections, portfolio management, modals, and timezone conversion.
Define services: implement Python functions for capex analysis, pricing analysis, sector rotation, sell signal detection, price info, and default candidates. Each function should fetch data via yfinance or other sources, compute metrics, and return JSON-serialisable results.
Integrate CrewAI: write agent definitions (roles, descriptions) and tasks in YAML. Register each Python service as a CrewAI tool and wire them to their respective agents. Write a crew.py that uses CrewBase to combine the agents into a sequential workflow and set verbose=True for rich logging.
Implement API routes: create endpoints for creating analyses, retrieving analyses, streaming logs, deleting analyses, and fetching recommendation history. Use a ConnectionManager to manage WebSocket connections. In the analysis runner, capture stdout to persist logs and broadcast them. After running the crew, parse the JSON output, enrich recommendations with price info, insert neutral entries for all requested tickers, update the analysis record, and save recommendation history.
Build the frontend: implement a responsive grid for analyses and modals for trading and history. Use Fetch API to call backend endpoints and WebSocket to stream logs. Persist portfolio state in localStorage. Convert ISO timestamps to Eastern Time using Intl.DateTimeFormat.
Containerize: write a Dockerfile to build the backend image and ensure requirements.txt lists dependencies (fastapi, uvicorn, sqlalchemy, yfinance, crewai, etc.). Create a docker‑compose file with two services (backend and nginx‑based frontend), environment variables and port mappings.

This specification summarises the system’s design and features. With it, a developer should be able to reconstruct the codebase and rebuild a functioning instance of the stock recommendation platform.