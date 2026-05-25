Stock Recommendation System Specification

Overview

This project implements a multi-agent stock recommendation system for identifying investment opportunities and exit signals in public markets. It uses CrewAI to coordinate specialized agents that analyze capital expenditure trends, commodity prices, sector performance, technical signals and exit risks. The system exposes a FastAPI backend with REST and WebSocket endpoints, a frontend built with HTML/JavaScript, and runs locally or inside Docker/Podman containers.

The goal of the platform is to surface buy, neutral, hold or sell recommendations for equities and ETFs. Buy recommendations are based on indicators such as surging capital expenditure, commodity price spikes and sector rotation. Neutral ratings explain why a stock does not meet the buy criteria. Hold or sell ratings are only active after a stock was previously recommended as a buy and subsequently triggers a red-flag exit signal. Otherwise, exit signals are preserved as risk evidence.

Backend

The backend is implemented in Python with FastAPI and SQLAlchemy.

Data Models:

Analysis stores each analysis run with id, comma-separated ticker list, status, recommendation summary string, JSON summary, created_at and updated_at timestamps.

LogEntry persists each line of agent output with timestamp and analysis_id. Logs are also broadcast to connected WebSocket clients in real time.

RecommendationHistory records every ticker recommendation with current price, 30-day percent change, report time and rationale. This supports historical recommendation views.

Services:

capex.py uses yfinance to fetch capital expenditure from company financial statements and calculate growth between the latest two periods.

pricing.py downloads recent closing price data for commodity futures and components and flags instruments with price spikes at or above 5%.

rotation.py downloads sector ETF and SPY price data, calculates trailing returns, relative returns and how often a sector rises when the market falls.

sell.py evaluates exit signals: fundamental peak, technical exhaustion and distribution days.

price_info.py fetches current stock price and 30-day percent change.

candidates.py returns the default monitoring universe and can rank the curated universe by recent momentum for monitoring mode.

scoring.py calculates deterministic recommendation scores for each ticker, including capex, pricing, rotation, risk components, final opportunity score, confidence, structured evidence and risk flags.

Agents And Tasks

Agents are defined in YAML and wired through CrewAI:

Capex Researcher uses the Capex Growth Analyzer tool for capex_task.

Pricing Power Analyst uses the Pricing Power Detector tool for pricing_task.

Institutional Rotation Analyst uses the Sector Rotation Monitor tool for rotation_task.

Recommendation Strategist synthesizes the previous outputs and uses the Sell Signal Detector tool for recommendation_task.

The recommendation task asks the LLM to produce a JSON object with a summary and recommendation list. The backend then normalizes, enriches and guards those recommendations.

API

POST /analyses accepts an optional list of tickers and starts an asynchronous analysis. If no tickers are provided, the backend uses the monitored candidate list.

GET /analyses lists all analyses with basic metadata.

GET /analyses/{id} returns full details, including stored JSON summary.

GET /analyses/{id}/logs returns persisted log entries.

DELETE /analyses/{id} deletes an analysis, its logs and related history rows.

GET /history/{ticker} returns chronological recommendation history for a ticker.

WebSocket /ws/{id} streams live log lines for a running analysis.

Analysis Flow

The backend creates an Analysis row with running status, executes the CrewAI workflow asynchronously, streams stdout line by line into LogEntry records and WebSocket clients, parses the crew JSON output, enriches recommendations with price info, deterministic scoring, confidence, evidence and risks, adds missing neutral entries, applies the prior-buy guard for hold/sell ratings, stores the JSON summary, updates the aggregate recommendation string and writes RecommendationHistory rows.

Frontend

The frontend is a single-page app served by Nginx in containers and built with vanilla HTML/JavaScript. It includes:

Header and stats showing total runs, running runs and completed runs.

Portfolio section with editable available cash and read-only invested amount, persisted to localStorage.

Action buttons for New Analysis and Monitor Reports with immediate loading states, status feedback and toast messages.

Recent Analyses list with status badges, selected-state styling, local timestamps and delete action.

Agent Logs panel that shows immediate local feedback and streams live WebSocket log output when an analysis is selected.

Analysis Report panel with parsed summary and an opportunity-ranked collapsed recommendation list. Recommendations are sorted by deterministic score, rating priority, confidence and ticker. Collapsed rows show ticker, rating, brief rationale, score, current price and 30-day change. Expanding a row reveals full rationale, report time, model/risk rating, structured evidence, risk flags and action buttons.

Trade modal with editable share quantity, stop-loss, target price and dividend yield. It calculates estimated cost, projected gain and dividend estimate, then updates the simulated portfolio on confirmation. No real orders are executed.

History modal that fetches GET /history/{ticker} and displays past ratings, prices and reasons sorted by date.

Ticker symbols link to Yahoo Finance quote pages.

Deployment

Dockerfile builds a Python 3.12 backend image, installs dependencies from requirements.txt, copies backend and frontend files and launches Uvicorn on port 8000.

docker-compose.yml defines:

backend, built from Dockerfile, exposed on port 8000, using .env and model configuration environment variables.

frontend, based on nginx:alpine, serving ./frontend on port 3000.

Typical deployment:

docker-compose build
docker-compose up
open http://localhost:3000

The project also runs locally for development by starting Uvicorn for the backend and serving the frontend statically.

