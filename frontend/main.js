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
    card.className = "bg-gray-800 p-4 rounded cursor-pointer hover:bg-gray-700";
    card.dataset.id = analysis.id;
    card.innerHTML = `<div class="flex justify-between"><div><h4 class="text-lg font-semibold">${analysis.tickers}</h4><p class="text-sm text-gray-400">${timeAgo(analysis.created_at)}</p></div><div class="text-right"><p class="text-sm">Status: <span class="font-medium">${analysis.status}</span></p><p class="text-sm">${analysis.recommendation ?? ""}</p></div></div>`;
    card.addEventListener("click", () => selectAnalysis(analysis.id));
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
}

function appendLog(message) {
  const logsConsole = document.getElementById("logs-console");
  const div = document.createElement("div");
  div.textContent = message;
  logsConsole.appendChild(div);
  logsConsole.scrollTop = logsConsole.scrollHeight;
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