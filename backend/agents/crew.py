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
# CrewAI delegates model connectivity to LiteLLM behind the scenes.  To
# configure a model for your agents, you can either provide a string
# identifier (e.g., ``"gpt-4-turbo"``) or instantiate the built‑in
# ``LLM`` class.  Using ``LLM`` allows you to customise parameters such
# as temperature and base URL without pulling in heavy dependencies from
# LangChain.  See the CrewAI documentation for more details【783991777702297†L207-L263】.
from crewai import LLM  # type: ignore

from ..services.capex import get_capex_growth
from ..services.pricing import get_price_spikes
from ..services.rotation import get_sector_rotation_analysis
from ..services.sell import get_sell_signals


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


# New tool for detecting sell signals across a set of tickers
@tool("Sell Signal Detector")
def sell_signal_tool(tickers: str) -> str:
    """Evaluate exit signals for a comma‑separated list of tickers.

    The input should be a comma‑delimited string of stock tickers.  The
    tool returns a JSON encoded list of dictionaries, one per ticker,
    summarising the fundamental, technical and distribution red flags.
    Each entry contains a ``sell_signal`` boolean indicating whether any
    red flag triggered.
    """
    tickers_list: List[str] = [t.strip() for t in tickers.split(',') if t.strip()]
    results = get_sell_signals(tickers_list)
    return json.dumps(results)


@CrewBase
class InvestmentRecommendationCrew:
    """Crew that manages the multi‑agent stock recommendation workflow."""

    # Paths relative to the backend package
    agents_config = 'backend/config/agents.yaml'
    tasks_config = 'backend/config/tasks.yaml'

    def __init__(self) -> None:
        # Initialise the underlying language model.  Instead of relying on
        # LangChain’s ``ChatOpenAI``, use CrewAI’s built‑in ``LLM`` class,
        # which routes requests through LiteLLM.  This avoids dependency
        # conflicts with ``langchain`` and works out‑of‑the‑box in the
        # container environment.  The model name and temperature can be
        # customised via environment variables.  If you need to use a
        # non‑OpenAI provider or a custom API endpoint, specify
        # ``OPENAI_API_BASE`` in your environment or pass ``base_url`` when
        # constructing the LLM.
        model_name = os.getenv('OPENAI_MODEL', os.getenv('OPENAI_MODEL_NAME', 'gpt-4-turbo'))
        temperature = float(os.getenv('OPENAI_TEMPERATURE', '0.3'))
        # When the OPENAI_API_KEY is set in the environment, LiteLLM will
        # automatically authenticate requests.  Additional parameters such
        # as ``base_url`` may be provided via environment variables (e.g.
        # OPENAI_API_BASE) if you are using a custom endpoint.
        self.llm = LLM(model=model_name, temperature=temperature)

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
            tools=[sell_signal_tool],
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