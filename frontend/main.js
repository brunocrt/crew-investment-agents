// Simple frontend script to fetch analyses, show stats, and stream logs.

// Dynamically determine the API base URL.  When running via docker-compose,
// the frontend is served on a different port (e.g. 3000) than the backend.
// This helper replaces the current window's port with 8000 so that API
// requests target the backend container.  For example, if the page is
// loaded from http://localhost:3000, the API base becomes http://localhost:8000.
const API_BASE = (() => {
  try {
    const url = new URL(window.location.href);
    url.port = "8000";
    return url.origin;
  } catch (e) {
    return "http://localhost:8000";
  }
})();


// ----- Portfolio Management -----
// Portfolio state is persisted in localStorage under the key 'portfolio'.
// The portfolio contains an available cash balance and an invested amount.
let portfolio = { available: 10000, invested: 0 };

function loadPortfolio() {
  const saved = localStorage.getItem('portfolio');
  if (saved) {
    try {
      const obj = JSON.parse(saved);
      if (typeof obj.available === 'number' && typeof obj.invested === 'number') {
        portfolio = obj;
      }
    } catch {}
  }
  const availEl = document.getElementById('available-balance');
  const investedEl = document.getElementById('invested-balance');
  if (availEl) availEl.value = portfolio.available.toFixed(2);
  if (investedEl) investedEl.value = portfolio.invested.toFixed(2);
}

function savePortfolio() {
  const availEl = document.getElementById('available-balance');
  const investedEl = document.getElementById('invested-balance');
  let avail = parseFloat(availEl?.value);
  let invested = parseFloat(investedEl?.value);
  if (isNaN(avail)) avail = portfolio.available;
  if (isNaN(invested)) invested = portfolio.invested;
  portfolio.available = avail;
  portfolio.invested = invested;
  localStorage.setItem('portfolio', JSON.stringify(portfolio));
  if (availEl) availEl.value = portfolio.available.toFixed(2);
  if (investedEl) investedEl.value = portfolio.invested.toFixed(2);
}

function openTradeModal(rec) {
  const modal = document.getElementById('trade-modal');
  if (!modal) return;
  const titleEl = document.getElementById('trade-title');
  const descEl = document.getElementById('trade-description');
  const sharesEl = document.getElementById('trade-shares');
  const stopLossEl = document.getElementById('trade-stoploss');
  const targetEl = document.getElementById('trade-target');
  const projEl = document.getElementById('trade-projected');
  const ticker = rec.ticker;
  const price = rec.current_price || 0;
  const tradeType = (rec.rating || '').toLowerCase() === 'sell' ? 'Sell' : 'Buy';
  titleEl.textContent = `${tradeType} ${ticker}`;
  const investAmount = portfolio.available * 0.05;
  let shares = price > 0 ? Math.floor(investAmount / price) : 0;
  if (shares < 1) shares = 1;
  const stopLoss = price * 0.9;
  const target = price * 1.2;
  const dividendYield = 0.02;
  const projected = (target - price) * shares + dividendYield * price * shares;
  descEl.textContent = `Current price: $${price.toFixed(2)} | Available cash: $${portfolio.available.toFixed(2)}`;
  sharesEl.value = shares;
  stopLossEl.value = stopLoss.toFixed(2);
  targetEl.value = target.toFixed(2);
  projEl.textContent = `$${projected.toFixed(2)}`;
  modal.dataset.ticker = ticker;
  modal.dataset.price = price;
  modal.dataset.tradeType = tradeType.toLowerCase();
  modal.classList.remove('hidden');
}

function confirmTrade() {
  const modal = document.getElementById('trade-modal');
  const shares = parseInt(document.getElementById('trade-shares').value, 10);
  const price = parseFloat(modal.dataset.price || '0');
  const type = modal.dataset.tradeType;
  if (isNaN(shares) || shares <= 0 || price <= 0) {
    modal.classList.add('hidden');
    return;
  }
  const cost = shares * price;
  if (type === 'sell') {
    portfolio.available += cost;
    portfolio.invested -= cost;
  } else {
    portfolio.available -= cost;
    portfolio.invested += cost;
  }
  if (portfolio.available < 0) portfolio.available = 0;
  if (portfolio.invested < 0) portfolio.invested = 0;
  localStorage.setItem('portfolio', JSON.stringify(portfolio));
  const availEl = document.getElementById('available-balance');
  const investedEl = document.getElementById('invested-balance');
  if (availEl) availEl.value = portfolio.available.toFixed(2);
  if (investedEl) investedEl.value = portfolio.invested.toFixed(2);
  modal.classList.add('hidden');
}

function cancelTrade() {
  const modal = document.getElementById('trade-modal');
  if (modal) modal.classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  loadPortfolio();
  const saveBtn = document.getElementById('save-portfolio-btn');
  if (saveBtn) saveBtn.addEventListener('click', savePortfolio);
  const cancelBtn = document.getElementById('trade-cancel-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', cancelTrade);
  const confirmBtn = document.getElementById('trade-confirm-btn');
  if (confirmBtn) confirmBtn.addEventListener('click', confirmTrade);
});
// ----- End Portfolio Management -----
async function fetchAnalyses() {
  const res = await fetch(`${API_BASE}/analyses`);
  const data = await res.json();
  return data;
}

function timeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function renderStats(analyses) {
  const total = analyses.length;
  const running = analyses.filter((a) => a.status === "running").length;
  const statsContainer = document.getElementById("stats-container");
  statsContainer.innerHTML = "";
  const stats = [
    { title: "Total Analyses", value: total },
    { title: "Active Agents", value: running },
    { title: "Market Status", value: "Online" },
  ];
  stats.forEach((stat) => {
    const div = document.createElement("div");
    div.className = "bg-gray-800 p-4 rounded flex flex-col justify-between";
    div.innerHTML = `<div><h4 class="text-sm text-gray-400">${stat.title}</h4><p class="text-2xl font-bold">${stat.value}</p></div>`;
    statsContainer.appendChild(div);
  });
}

function renderAnalyses(analyses) {
  const list = document.getElementById("analyses-list");
  list.innerHTML = "";
  analyses.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  analyses.forEach((analysis) => {
    const card = document.createElement("div");
    // Assign colour based on status
    let statusColour = "bg-gray-800";
    if (analysis.status === "completed") statusColour = "bg-green-800";
    else if (analysis.status === "running") statusColour = "bg-blue-800";
    else if (analysis.status === "failed") statusColour = "bg-red-800";
    card.className = `${statusColour} p-4 rounded cursor-pointer hover:bg-gray-700 relative`;
    card.dataset.id = analysis.id;
    // Format creation time as locale string
    const createdAt = new Date(analysis.created_at).toLocaleString();
    // HTML structure with delete button
    card.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <h4 class="text-lg font-semibold">${analysis.tickers}</h4>
          <p class="text-xs text-gray-400">${createdAt}</p>
          <p class="text-sm text-gray-300">Status: <span class="font-medium">${analysis.status}</span></p>
          <p class="text-sm">${analysis.recommendation ?? ""}</p>
        </div>
        <button class="delete-btn text-red-400 hover:text-red-600" title="Delete analysis">&times;</button>
      </div>`;
    // Handle card click (excluding delete button)
    card.addEventListener("click", (e) => {
      if (e.target && e.target.classList.contains("delete-btn")) return;
      selectAnalysis(analysis.id);
    });
    // Delete button handler
    const deleteBtn = card.querySelector(".delete-btn");
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteAnalysis(analysis.id);
    });
    list.appendChild(card);
  });
}

async function refresh() {
  const analyses = await fetchAnalyses();
  renderStats(analyses);
  renderAnalyses(analyses);
}

let currentSocket = null;

async function selectAnalysis(id) {
  // Close existing WebSocket
  if (currentSocket) {
    currentSocket.close();
    currentSocket = null;
  }
  // Clear logs
  const logsConsole = document.getElementById("logs-console");
  logsConsole.innerHTML = "";
  // Fetch persisted logs
  const res = await fetch(`${API_BASE}/analyses/${id}/logs`);
  const logs = await res.json();
  logs.forEach((entry) => {
    appendLog(entry.message);
  });
  // Open WebSocket for live updates
  const socket = new WebSocket(`ws://localhost:8000/ws/${id}`);
  socket.onmessage = (event) => {
    appendLog(event.data);
  };
  socket.onopen = () => {
    console.log("WebSocket connected");
  };
  socket.onclose = () => {
    console.log("WebSocket closed");
  };
  currentSocket = socket;

  // Fetch and display report summary and recommendations
  displayReport(id);
}

function appendLog(message) {
  const logsConsole = document.getElementById("logs-console");
  const div = document.createElement("div");
  div.textContent = message;
  logsConsole.appendChild(div);
  logsConsole.scrollTop = logsConsole.scrollHeight;
}

// Display the analysis summary and recommendations in the report panel
async function displayReport(analysisId) {
  try {
    const res = await fetch(`${API_BASE}/analyses/${analysisId}`);
    const analysis = await res.json();
    const summaryDiv = document.getElementById("report-summary");
    const recDiv = document.getElementById("recommendations");
    summaryDiv.textContent = "";
    recDiv.innerHTML = "";
    if (!analysis) return;
    let summaryText = analysis.summary || "";
    let recs = [];
    // Attempt to parse JSON summary to extract recommendations and summary
    if (summaryText && summaryText.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(summaryText);
        if (parsed.summary) {
          summaryText = parsed.summary;
        }
        if (Array.isArray(parsed.recommendations)) {
          recs = parsed.recommendations;
        }
      } catch (e) {
        // not JSON, leave summaryText as is
      }
    }
    // Fallback: if recommendations field stored separately on analysis, parse comma list
    if (!recs.length && analysis.recommendation) {
      recs = analysis.recommendation.split(",").map((s) => {
        const parts = s.trim().split(":");
        return {
          ticker: parts[0].trim(),
          rating: parts[1] ? parts[1].trim() : "",
          reason: "",
        };
      });
    }
    summaryDiv.textContent = summaryText;
    // Render recommendations table if any
    if (recs.length) {
      const table = document.createElement("table");
      table.className = "min-w-full text-left text-sm";
      const thead = document.createElement("thead");
      thead.innerHTML = `<tr>
        <th class="px-2 py-1 border-b">Ticker</th>
        <th class="px-2 py-1 border-b">Rating</th>
        <th class="px-2 py-1 border-b">Price</th>
        <th class="px-2 py-1 border-b">% Change (30d)</th>
        <th class="px-2 py-1 border-b">Report Time</th>
        <th class="px-2 py-1 border-b">Reason</th>
        <th class="px-2 py-1 border-b">Action</th>
      </tr>`;
      table.appendChild(thead);
      const tbody = document.createElement("tbody");
      recs.forEach((rec) => {
        const tr = document.createElement('tr');
        const tickerLink = `https://finance.yahoo.com/quote/${rec.ticker}`;
        const price = rec.current_price !== undefined ? parseFloat(rec.current_price).toFixed(2) : '';
        const pct = rec.percent_change !== undefined && rec.percent_change !== null ? (rec.percent_change * 100).toFixed(2) + '%' : '';
        const reportTime = rec.report_time ? new Date(rec.report_time).toLocaleString() : '';
        tr.innerHTML = `
          <td class="px-2 py-1 border-b"><a href="${rec.ticker ? `https://finance.yahoo.com/quote/${rec.ticker}` : ''}" target="_blank" class="text-blue-400 underline">${rec.ticker}</a></td>
          <td class="px-2 py-1 border-b">${rec.rating}</td>
          <td class="px-2 py-1 border-b">${price}</td>
          <td class="px-2 py-1 border-b">${pct}</td>
          <td class="px-2 py-1 border-b">${reportTime}</td>
          <td class="px-2 py-1 border-b">${rec.reason || ''}</td>
        `;
        const actionTd = document.createElement('td');
        const btn = document.createElement('button');
        btn.textContent = (rec.rating || '').toLowerCase() === 'sell' ? 'Sell' : 'Trade';
        btn.className = 'bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded';
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          openTradeModal(rec);
        });
        actionTd.appendChild(btn);
        tr.appendChild(actionTd);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      recDiv.appendChild(table);
    }
  } catch (e) {
    console.error("Error displaying report", e);
  }
}

async function newAnalysis() {
  const input = prompt("Enter comma-separated tickers (e.g., GE,ETN)");
  if (!input) return;
  const tickers = input
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter((t) => t);
  if (tickers.length === 0) return;
  const res = await fetch(`${API_BASE}/analyses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tickers }),
  });
  const data = await res.json();
  // Refresh list and auto-select new analysis
  setTimeout(refresh, 500);
  if (data.analysis_id) {
    setTimeout(() => selectAnalysis(data.analysis_id), 1000);
  }
}

document.getElementById("new-analysis-btn").addEventListener("click", newAnalysis);

// Launch monitoring mode without specifying tickers
async function startMonitoring() {
  const res = await fetch(`${API_BASE}/analyses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tickers: [] }),
  });
  const data = await res.json();
  // Refresh list and auto-select new analysis
  setTimeout(refresh, 500);
  if (data.analysis_id) {
    setTimeout(() => selectAnalysis(data.analysis_id), 1000);
  }
}

document.getElementById("monitor-btn").addEventListener("click", startMonitoring);

// Initial load
refresh();
// Poll for updates every 30 seconds
setInterval(refresh, 30000);

// Delete an analysis by ID
async function deleteAnalysis(id) {
  try {
    const res = await fetch(`${API_BASE}/analyses/${id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    // Refresh list and clear selection if current analysis is deleted
    refresh();
    const summaryDiv = document.getElementById("report-summary");
    const recDiv = document.getElementById("recommendations");
    if (summaryDiv && recDiv) {
      summaryDiv.textContent = "";
      recDiv.innerHTML = "";
    }
    const logsConsole = document.getElementById("logs-console");
    if (logsConsole) logsConsole.innerHTML = "";
  } catch (e) {
    console.error("Error deleting analysis", e);
  }
}