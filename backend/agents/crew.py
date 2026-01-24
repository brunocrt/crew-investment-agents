"""
Investment Recommendation Crew
-----------------------------

This module defines a CrewAI crew that orchestrates a team of agents to
research, analyse, and generate stock recommendations based on the
user‑provided strategy.  Each agent is equipped with custom tools that
wrap domain‑specific Python functions (capex research, pricing analysis,
rotation analysis) and is responsible for a single stage of the
workflow.

The crew loads its configuration from YAML files located in the
``backend/config`` directory.  These files specify the roles, goals, and
task descriptions that guide the LLM during execution.  The tools
exported here provide structured data to the agents, while the LLM
transforms that data into human‑readable reasoning and recommendations.
"""

from __future__ import annotations

import json
import os
from typing import List, Dict

from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai.tools import tool
from langchain_openai import ChatOpenAI

from ..services.capex import get_capex_growth
from ..services.pricing import get_price_spikes
from ..services.rotation import get_sector_rotation_analysis


# Define custom tools using the @tool decorator.  Each tool takes a single
# string argument and returns a JSON string containing structured results.

@tool("Capex Growth Analyzer")
def capex_tool(tickers: str) -> str:
    """Compute capital expenditure growth for a comma‑separated list of tickers.

    The input should be a comma‑delimited string of stock tickers.  The tool
    returns a JSON encoded list of dictionaries, one per ticker, with
    information about the most recent capex growth rates and whether they
    exceed 20%.
    """
    tickers_list: List[str] = [t.strip() for t in tickers.split(',') if t.strip()]
    results: List[Dict] = []
    for t in tickers_list:
        data = get_capex_growth(t)
        if data is None:
            continue
        growth = data.get('capex_growth_pct')
        strong = growth is not None and growth >= 0.20
        data['strong_signal'] = strong
        results.append(data)
    return json.dumps(results)


@tool("Pricing Power Detector")
def pricing_tool(dummy: str = "") -> str:
    """Identify instruments with significant price increases over the last 30 days.

    The input argument is unused but required by the tool interface.  The tool
    returns a JSON encoded list of dictionaries summarising price spikes
    among the default set of commodities.  Each entry includes a flag
    indicating whether the price change exceeds 5%.
    """
    results = get_price_spikes()
    for r in results:
        change = r.get('price_change_pct')
        r['spike'] = change is not None and change >= 0.05
    return json.dumps(results)


@tool("Sector Rotation Monitor")
def rotation_tool(dummy: str = "") -> str:
    """Evaluate sector rotation relative to the market over the past 30 days.

    This tool ignores its input argument.  It returns a JSON encoded list of
    sector performance metrics.  Each entry contains a flag called
    ``rotation_signal`` that is true when the sector outperforms the market
    and exhibits defensive characteristics (up on at least 40% of market
    down days).
    """
    results = get_sector_rotation_analysis()
    payload: List[Dict] = []
    for r in results:
        rotation_signal = (
            r.relative_return > 0 and r.up_on_down_days_ratio >= 0.4
        )
        payload.append(
            {
                'ticker': r.ticker,
                'name': r.name,
                'trailing_return': r.trailing_return,
                'market_return': r.market_return,
                'relative_return': r.relative_return,
                'up_on_down_days_ratio': r.up_on_down_days_ratio,
                'rotation_signal': rotation_signal,
            }
        )
    return json.dumps(payload)


class InvestmentRecommendationCrew(CrewBase):
    """Crew that manages the multi‑agent stock recommendation workflow."""

    # Paths relative to the backend package
    agents_config = 'backend/config/agents.yaml'
    tasks_config = 'backend/config/tasks.yaml'

    def __init__(self) -> None:
        # Initialize the underlying ChatOpenAI LLM
        model_name = os.getenv('OPENAI_MODEL', 'gpt-4-turbo')
        temperature = float(os.getenv('OPENAI_TEMPERATURE', '0.3'))
        self.llm = ChatOpenAI(model_name=model_name, temperature=temperature)

    # Define agents.  Each agent uses a particular tool relevant to its role.
    @agent
    def capex_researcher(self) -> Agent:
        return Agent(
            config=self.agents_config['capex_researcher'],
            tools=[capex_tool],
            llm=self.llm,
        )

    @agent
    def pricing_analyst(self) -> Agent:
        return Agent(
            config=self.agents_config['pricing_analyst'],
            tools=[pricing_tool],
            llm=self.llm,
        )

    @agent
    def rotation_analyst(self) -> Agent:
        return Agent(
            config=self.agents_config['rotation_analyst'],
            tools=[rotation_tool],
            llm=self.llm,
        )

    @agent
    def recommendation_strategist(self) -> Agent:
        return Agent(
            config=self.agents_config['recommendation_strategist'],
            tools=[],
            llm=self.llm,
        )

    # Define tasks.  Each task is assigned to an agent.
    @task
    def capex_task(self) -> Task:
        return Task(
            config=self.tasks_config['capex_task'],
            agent=self.capex_researcher(),
        )

    @task
    def pricing_task(self) -> Task:
        return Task(
            config=self.tasks_config['pricing_task'],
            agent=self.pricing_analyst(),
        )

    @task
    def rotation_task(self) -> Task:
        return Task(
            config=self.tasks_config['rotation_task'],
            agent=self.rotation_analyst(),
        )

    @task
    def recommendation_task(self) -> Task:
        return Task(
            config=self.tasks_config['recommendation_task'],
            agent=self.recommendation_strategist(),
        )

    @crew
    def crew(self) -> Crew:
        """Assemble the crew with the defined agents and tasks."""
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=2,
        )