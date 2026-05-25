const API_BASE = (() => {
  try {
    const url = new URL(window.location.href);
    url.port = "8000";
    return url.origin;
  } catch (e) {
    return "http://localhost:8000";
  }
})();

const els = {
  actionStatus: document.getElementById("action-status"),
  analysesList: document.getElementById("analyses-list"),
  apiStatus: document.getElementById("api-status"),
  availableBalance: document.getElementById("available-balance"),
  clearLogs: document.getElementById("clear-logs-btn"),
  historyBody: document.getElementById("history-body"),
  historyClose: document.getElementById("history-close"),
  historyModal: document.getElementById("history-modal"),
  historyTitle: document.getElementById("history-title"),
  investedAmount: document.getElementById("invested-amount"),
  lastRefresh: document.getElementById("last-refresh"),
  logsConsole: document.getElementById("logs-console"),
  logsSubtitle: document.getElementById("logs-subtitle"),
  monitorBtn: document.getElementById("monitor-btn"),
  newAnalysisBtn: document.getElementById("new-analysis-btn"),
  recommendations: document.getElementById("recommendations"),
  refreshBtn: document.getElementById("refresh-btn"),
  reportSummary: document.getElementById("report-summary"),
  savePortfolio: document.getElementById("save-portfolio"),
  selectedAnalysisLabel: document.getElementById("selected-analysis-label"),
  selectedStatus: document.getElementById("selected-status"),
  sidebarStatus: document.getElementById("sidebar-status"),
  statsContainer: document.getElementById("stats-container"),
  toastStack: document.getElementById("toast-stack"),
  tradeBody: document.getElementById("trade-body"),
  tradeCancel: document.getElementById("trade-cancel"),
  tradeConfirm: document.getElementById("trade-confirm"),
  tradeModal: document.getElementById("trade-modal"),
  tradeTitle: document.getElementById("trade-title"),
};

let currentSocket = null;
let currentTrade = null;
let selectedAnalysisId = null;
let analysesCache = [];
let portfolioState = loadPortfolio();

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function icon(name, className = "h-4 w-4") {
  return `<i data-lucide="${name}" class="${className}"></i>`;
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function formatDateTime(timestamp) {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function timeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(number);
}

function percent(value) {
  if (value === null || value === undefined || value === "") return "";
  return `${(Number(value) * 100).toFixed(2)}%`;
}

function loadPortfolio() {
  const stored = localStorage.getItem("portfolio");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      return { available: 10000, invested: 0 };
    }
  }
  return { available: 10000, invested: 0 };
}

function savePortfolioState(portfolio) {
  localStorage.setItem("portfolio", JSON.stringify(portfolio));
}

function updatePortfolioUI(portfolio) {
  els.availableBalance.value = Number(portfolio.available || 0).toFixed(2);
  els.investedAmount.value = Number(portfolio.invested || 0).toFixed(2);
}

function setApiStatus(state, label) {
  const styles = {
    online: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    offline: "border-red-400/30 bg-red-400/10 text-red-200",
    checking: "border-slate-700 bg-slate-900 text-slate-300",
  };
  els.apiStatus.className = `rounded-full border px-3 py-1 text-xs ${styles[state] || styles.checking}`;
  els.apiStatus.textContent = label;
}

function showToast(message, type = "info") {
  const styles = {
    info: "border-cyan-400/30 bg-cyan-950/95 text-cyan-100",
    success: "border-emerald-400/30 bg-emerald-950/95 text-emerald-100",
    error: "border-red-400/30 bg-red-950/95 text-red-100",
  };
  const toast = document.createElement("div");
  toast.className = `rounded-md border px-4 py-3 text-sm shadow-xl ${styles[type] || styles.info}`;
  toast.textContent = message;
  els.toastStack.appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
}

function setActionStatus(message, state = "info") {
  if (!message) {
    els.actionStatus.classList.add("hidden");
    els.sidebarStatus.textContent = selectedAnalysisId ? "Analysis selected." : "No analysis selected.";
    return;
  }
  const styles = {
    info: "border-cyan-400/30 bg-cyan-400/10 text-cyan-100",
    success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
    error: "border-red-400/30 bg-red-400/10 text-red-100",
  };
  els.actionStatus.className = `mt-5 rounded-md border px-4 py-3 text-sm ${styles[state] || styles.info}`;
  els.actionStatus.textContent = message;
  els.sidebarStatus.textContent = message;
}

function setButtonLoading(button, isLoading, label) {
  if (!button) return;
  const text = button.querySelector("span");
  if (isLoading) {
    button.dataset.originalLabel = text ? text.textContent : button.textContent;
    button.disabled = true;
    button.classList.add("opacity-70");
    button.insertAdjacentHTML("afterbegin", `<span class="spinner inline-block h-4 w-4 rounded-full border-2 border-current border-r-transparent"></span>`);
    if (text && label) text.textContent = label;
  } else {
    button.disabled = false;
    button.classList.remove("opacity-70");
    const spinner = button.querySelector(".spinner");
    if (spinner) spinner.remove();
    if (text && button.dataset.originalLabel) text.textContent = button.dataset.originalLabel;
  }
}

async function fetchAnalyses() {
  const res = await fetch(`${API_BASE}/analyses`);
  if (!res.ok) throw new Error("Unable to fetch analyses");
  return res.json();
}

async function refresh(options = {}) {
  try {
    if (options.spinRefresh) setButtonLoading(els.refreshBtn, true);
    const analyses = await fetchAnalyses();
    analysesCache = analyses;
    renderStats(analyses);
    renderAnalyses(analyses);
    els.lastRefresh.textContent = `Updated ${formatDateTime(new Date().toISOString())}`;
    setApiStatus("online", "Online");

    const selected = analyses.find((item) => item.id === selectedAnalysisId);
    if (selected) updateSelectedStatus(selected);
    return analyses;
  } catch (e) {
    setApiStatus("offline", "Offline");
    showToast("Backend is not responding.", "error");
    throw e;
  } finally {
    if (options.spinRefresh) setButtonLoading(els.refreshBtn, false);
  }
}

function renderStats(analyses) {
  const total = analyses.length;
  const running = analyses.filter((a) => a.status === "running").length;
  const completed = analyses.filter((a) => a.status === "completed").length;
  const failed = analyses.filter((a) => a.status === "failed").length;
  const stats = [
    { title: "Total Runs", value: total, icon: "bar-chart-3", accent: "text-cyan-300" },
    { title: "Running", value: running, icon: "loader-circle", accent: "text-amber-300" },
    { title: "Completed", value: completed, icon: "check-circle-2", accent: "text-emerald-300", meta: failed ? `${failed} failed` : "No failures" },
  ];

  els.statsContainer.innerHTML = stats
    .map(
      (stat) => `
        <article class="panel rounded-lg p-4">
          <div class="flex items-center justify-between">
            <span class="text-sm text-slate-400">${stat.title}</span>
            ${icon(stat.icon, `h-5 w-5 ${stat.accent}`)}
          </div>
          <div class="mt-3 flex items-end justify-between gap-3">
            <p class="text-3xl font-semibold text-white">${stat.value}</p>
            ${stat.meta ? `<p class="pb-1 text-xs text-slate-500">${stat.meta}</p>` : ""}
          </div>
        </article>
      `
    )
    .join("");
  refreshIcons();
}

function statusBadge(status) {
  const styles = {
    completed: "bg-emerald-400/10 text-emerald-200 border-emerald-400/20",
    running: "bg-amber-400/10 text-amber-200 border-amber-400/20",
    failed: "bg-red-400/10 text-red-200 border-red-400/20",
    pending: "bg-slate-400/10 text-slate-200 border-slate-400/20",
  };
  return `<span class="rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status] || styles.pending}">${escapeHtml(status || "pending")}</span>`;
}

function ratingBadge(rating) {
  const normalized = String(rating || "neutral").toLowerCase();
  const styles = {
    buy: "bg-emerald-400/10 text-emerald-200 border-emerald-400/20",
    hold: "bg-amber-400/10 text-amber-200 border-amber-400/20",
    sell: "bg-red-400/10 text-red-200 border-red-400/20",
    neutral: "bg-slate-400/10 text-slate-200 border-slate-400/20",
  };
  return `<span class="rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[normalized] || styles.neutral}">${escapeHtml(normalized)}</span>`;
}

function renderAnalyses(analyses) {
  els.analysesList.innerHTML = "";
  if (!analyses.length) {
    els.analysesList.innerHTML = `
      <div class="soft-panel rounded-lg p-5 text-center text-sm text-slate-400">
        ${icon("inbox", "mx-auto mb-3 h-6 w-6 text-slate-500")}
        No analyses yet.
      </div>
    `;
    refreshIcons();
    return;
  }

  analyses.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  analyses.forEach((analysis) => {
    const card = document.createElement("button");
    const selected = analysis.id === selectedAnalysisId;
    card.type = "button";
    card.className = `w-full rounded-lg border p-4 text-left transition hover:border-cyan-400/40 hover:bg-slate-900/70 ${
      selected ? "border-cyan-400/50 bg-cyan-400/10" : "border-slate-800 bg-slate-950/40"
    }`;
    card.dataset.id = analysis.id;
    const rec = analysis.recommendation || "Pending recommendation";
    card.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h4 class="truncate text-sm font-semibold text-white">${escapeHtml(analysis.tickers)}</h4>
            ${statusBadge(analysis.status)}
          </div>
          <p class="mt-1 text-xs text-slate-500">${formatDateTime(analysis.created_at)} · ${timeAgo(analysis.created_at)}</p>
        </div>
        <button class="delete-btn inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-500/10 hover:text-red-200" title="Delete analysis">
          ${icon("trash-2", "h-4 w-4")}
        </button>
      </div>
      <p class="mt-3 line-clamp-2 text-xs leading-5 text-slate-300">${escapeHtml(rec)}</p>
    `;
    card.addEventListener("click", (event) => {
      if (event.target.closest(".delete-btn")) return;
      selectAnalysis(analysis.id);
    });
    card.querySelector(".delete-btn").addEventListener("click", (event) => {
      event.stopPropagation();
      deleteAnalysis(analysis.id);
    });
    els.analysesList.appendChild(card);
  });
  refreshIcons();
}

function setReportLoading(message) {
  els.reportSummary.innerHTML = `
    <div class="flex items-center gap-3 text-slate-400">
      <span class="spinner inline-block h-4 w-4 rounded-full border-2 border-slate-400 border-r-transparent"></span>
      <span>${escapeHtml(message)}</span>
    </div>
  `;
  els.recommendations.innerHTML = "";
}

function setEmptyReport(message) {
  els.reportSummary.innerHTML = `<p class="text-sm text-slate-500">${escapeHtml(message)}</p>`;
  els.recommendations.innerHTML = "";
}

function updateSelectedStatus(analysis) {
  els.selectedAnalysisLabel.textContent = `${analysis.tickers} · ${formatDateTime(analysis.created_at)}`;
  els.selectedStatus.classList.remove("hidden");
  els.selectedStatus.outerHTML = `<div id="selected-status" class="${statusBadgeClass(analysis.status)}">${escapeHtml(analysis.status)}</div>`;
  els.selectedStatus = document.getElementById("selected-status");
  els.logsSubtitle.textContent = analysis.status === "running" ? "Streaming live agent output." : "Showing persisted output.";
  if (analysis.status === "running") {
    setActionStatus("Agents are running. New log lines will appear automatically.", "info");
  } else if (analysis.status === "completed") {
    setActionStatus("Analysis completed.", "success");
  } else if (analysis.status === "failed") {
    setActionStatus("Analysis failed. Check logs for details.", "error");
  }
}

function statusBadgeClass(status) {
  const styles = {
    completed: "rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200",
    running: "rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200",
    failed: "rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1 text-xs font-semibold text-red-200",
    pending: "rounded-full border border-slate-400/20 bg-slate-400/10 px-3 py-1 text-xs font-semibold text-slate-200",
  };
  return styles[status] || styles.pending;
}

async function selectAnalysis(id) {
  selectedAnalysisId = id;
  const analysis = analysesCache.find((item) => item.id === id);
  if (analysis) updateSelectedStatus(analysis);
  renderAnalyses(analysesCache);
  setReportLoading("Loading report...");
  els.logsConsole.innerHTML = "";

  if (currentSocket) {
    currentSocket.close();
    currentSocket = null;
  }

  try {
    const logsRes = await fetch(`${API_BASE}/analyses/${id}/logs`);
    const logs = await logsRes.json();
    if (logs.length) {
      logs.forEach((entry) => appendLog(entry.message));
    } else {
      appendLog("Run selected. Waiting for agent output...");
    }

    openLogSocket(id);
    await displayReport(id);
  } catch (e) {
    setEmptyReport("Unable to load this analysis.");
    showToast("Could not load analysis details.", "error");
  }
}

function openLogSocket(id) {
  const wsBase = API_BASE.replace(/^http/, "ws");
  const socket = new WebSocket(`${wsBase}/ws/${id}`);
  socket.onopen = () => appendLog("Live log stream connected.");
  socket.onmessage = (event) => appendLog(event.data);
  socket.onerror = () => appendLog("Live log stream encountered a connection issue.");
  socket.onclose = () => appendLog("Live log stream closed.");
  currentSocket = socket;
}

function appendLog(message) {
  const div = document.createElement("div");
  div.className = "border-b border-slate-900/80 py-1 last:border-0";
  div.textContent = message;
  els.logsConsole.appendChild(div);
  els.logsConsole.scrollTop = els.logsConsole.scrollHeight;
}

async function displayReport(analysisId) {
  const res = await fetch(`${API_BASE}/analyses/${analysisId}`);
  if (!res.ok) throw new Error("Unable to fetch analysis");
  const analysis = await res.json();
  updateSelectedStatus(analysis);

  let summaryText = analysis.summary || "";
  let recs = [];
  const trimmedSummary = summaryText.trim();
  if (trimmedSummary.startsWith("```")) {
    summaryText = trimmedSummary.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }
  if (summaryText && summaryText.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(summaryText);
      summaryText = parsed.summary || summaryText;
      recs = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
    } catch (e) {
      recs = [];
    }
  }
  if (!recs.length && analysis.recommendation) {
    recs = analysis.recommendation.split(",").map((item) => {
      const parts = item.trim().split(":");
      return { ticker: parts[0]?.trim(), rating: parts[1]?.trim(), reason: "" };
    });
  }

  els.reportSummary.innerHTML = summaryText
    ? `<p class="whitespace-pre-wrap">${escapeHtml(summaryText)}</p>`
    : `<p class="text-slate-500">${analysis.status === "running" ? "Report is being prepared." : "No summary available."}</p>`;
  renderRecommendations(recs);
  await refresh();
}

function renderRecommendations(recs) {
  if (!recs.length) {
    els.recommendations.innerHTML = `
      <div class="soft-panel rounded-lg p-5 text-sm text-slate-500">
        Recommendations will appear here when the agents finish.
      </div>
    `;
    return;
  }

  const sortedRecs = [...recs].sort(compareRecommendations);
  els.recommendations.innerHTML = `
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
      <span>Sorted by strongest opportunity first.</span>
      <span>${sortedRecs.length} recommendation${sortedRecs.length === 1 ? "" : "s"}</span>
    </div>
    <div class="space-y-2">
      ${sortedRecs.map(renderRecommendationCard).join("")}
    </div>
  `;

  els.recommendations.querySelectorAll(".trade-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const rec = sortedRecs[Number(button.dataset.index)];
      openTradeModal(rec);
    });
  });
  els.recommendations.querySelectorAll(".history-btn").forEach((button) => {
    button.addEventListener("click", () => openHistoryModal(button.dataset.ticker));
  });
  refreshIcons();
}

function compareRecommendations(a, b) {
  const ratingRank = { buy: 4, hold: 3, neutral: 2, sell: 1 };
  const scoreA = Number.isFinite(Number(a.score)) ? Number(a.score) : -1;
  const scoreB = Number.isFinite(Number(b.score)) ? Number(b.score) : -1;
  const ratingA = ratingRank[String(a.rating || "neutral").toLowerCase()] || 0;
  const ratingB = ratingRank[String(b.rating || "neutral").toLowerCase()] || 0;
  const confidenceA = Number.isFinite(Number(a.confidence)) ? Number(a.confidence) : 0;
  const confidenceB = Number.isFinite(Number(b.confidence)) ? Number(b.confidence) : 0;
  return scoreB - scoreA || ratingB - ratingA || confidenceB - confidenceA || String(a.ticker || "").localeCompare(String(b.ticker || ""));
}

function renderRecommendationCard(rec, index) {
  const score = rec.score !== undefined && rec.score !== null ? Number(rec.score).toFixed(0) : "N/A";
  const confidence = rec.confidence !== undefined && rec.confidence !== null ? `${Math.round(Number(rec.confidence) * 100)}%` : "N/A";
  const price = rec.current_price !== undefined && rec.current_price !== null ? money(rec.current_price) : "N/A";
  const change = percent(rec.percent_change) || "N/A";
  const reportTime = formatDateTime(rec.report_time) || "N/A";
  const evidence = Array.isArray(rec.evidence) ? rec.evidence : [];
  const risks = Array.isArray(rec.risks) ? rec.risks : [];

  return `
    <article class="soft-panel rounded-lg">
      <details class="group">
        <summary class="flex cursor-pointer list-none flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex min-w-0 items-center gap-3">
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-950 text-xs font-semibold text-slate-300">${index + 1}</span>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <a href="https://finance.yahoo.com/quote/${encodeURIComponent(rec.ticker || "")}" target="_blank" class="text-base font-semibold text-cyan-200 hover:text-cyan-100">${escapeHtml(rec.ticker || "Ticker")}</a>
                ${ratingBadge(rec.rating)}
              </div>
              <p class="mt-1 truncate text-xs text-slate-500">${escapeHtml(shortReason(rec.reason))}</p>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2 text-right text-xs sm:min-w-72">
            <div>
              <span class="block text-slate-500">Score</span>
              <span class="font-semibold text-white">${escapeHtml(score)}</span>
            </div>
            <div>
              <span class="block text-slate-500">Price</span>
              <span class="font-semibold text-white">${escapeHtml(price)}</span>
            </div>
            <div class="flex items-center justify-end gap-2">
              <div>
                <span class="block text-slate-500">30d</span>
                <span class="font-semibold text-white">${escapeHtml(change)}</span>
              </div>
              <i data-lucide="chevron-down" class="h-4 w-4 text-slate-500 transition group-open:rotate-180"></i>
            </div>
          </div>
        </summary>
        <div class="border-t border-slate-800 p-4">
          <p class="text-sm leading-6 text-slate-300">${escapeHtml(rec.reason || "No reason provided.")}</p>
          <div class="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-400 sm:grid-cols-4">
            <div class="rounded-md bg-slate-950/50 p-2"><span class="block text-slate-500">Confidence</span>${escapeHtml(confidence)}</div>
            <div class="rounded-md bg-slate-950/50 p-2"><span class="block text-slate-500">Report</span>${escapeHtml(reportTime)}</div>
            <div class="rounded-md bg-slate-950/50 p-2"><span class="block text-slate-500">Model</span>${escapeHtml(rec.model_rating || rec.rating || "N/A")}</div>
            <div class="rounded-md bg-slate-950/50 p-2"><span class="block text-slate-500">Risk</span>${escapeHtml(rec.risk_rating || "None")}</div>
          </div>
          <div class="mt-4 rounded-md border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-300">
            <div class="font-semibold text-cyan-200">Evidence and risk</div>
            <div class="mt-3 space-y-2">
          ${evidence.length ? evidence.map(renderEvidence).join("") : `<p class="text-slate-500">No structured evidence available.</p>`}
              <div class="pt-2 text-slate-400">Risks: ${risks.length ? risks.map((risk) => escapeHtml(risk.signal)).join(", ") : "None"}</div>
            </div>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <button data-index="${index}" class="trade-btn inline-flex items-center gap-2 rounded-md bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400">
              ${icon("briefcase-business", "h-4 w-4")}
              Trade
            </button>
            <button data-ticker="${escapeHtml(rec.ticker || "")}" class="history-btn inline-flex items-center gap-2 rounded-md bg-slate-700 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-600">
              ${icon("history", "h-4 w-4")}
              History
            </button>
          </div>
        </div>
      </details>
    </article>
  `;
}

function shortReason(reason) {
  const text = String(reason || "Expand to view rationale and evidence.");
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function renderEvidence(item) {
  return `
    <div class="rounded-md bg-slate-900/80 p-2">
      <div class="font-semibold text-slate-200">${escapeHtml(item.signal)}</div>
      <div class="mt-1 text-slate-400">${escapeHtml(formatEvidenceValue(item.value))}</div>
      <div class="mt-1 text-slate-500">${escapeHtml(item.detail || "")}</div>
    </div>
  `;
}

function formatEvidenceValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value.toFixed(4);
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, nestedValue]) => `${key}=${typeof nestedValue === "number" ? nestedValue.toFixed(4) : nestedValue}`)
      .join(", ");
  }
  return String(value);
}

async function createAnalysis(tickers, options = {}) {
  const button = options.monitor ? els.monitorBtn : els.newAnalysisBtn;
  const label = options.monitor ? "Starting Monitor" : "Starting";
  setButtonLoading(button, true, label);
  setActionStatus(options.monitor ? "Starting monitor run..." : "Starting analysis...", "info");
  showToast(options.monitor ? "Monitor run requested." : "Analysis requested.", "info");
  setReportLoading("Creating analysis run...");
  els.logsConsole.innerHTML = "";
  appendLog("Analysis request sent. Waiting for backend acknowledgement...");

  try {
    const res = await fetch(`${API_BASE}/analyses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers }),
    });
    if (!res.ok) throw new Error("Analysis request failed");
    const data = await res.json();
    if (!data.analysis_id) throw new Error("Backend did not return an analysis id");

    selectedAnalysisId = data.analysis_id;
    appendLog(`Analysis queued: ${data.analysis_id}`);
    setActionStatus("Analysis queued. Connecting to live logs...", "success");
    showToast("Analysis started.", "success");
    await refresh();
    await selectAnalysis(data.analysis_id);
  } catch (e) {
    setActionStatus("Could not start analysis. Check backend logs.", "error");
    showToast("Could not start analysis.", "error");
    appendLog(`Request failed: ${e.message}`);
  } finally {
    setButtonLoading(button, false);
  }
}

async function newAnalysis() {
  const input = prompt("Enter comma-separated tickers (e.g., GE, ETN, AAPL)");
  if (!input) return;
  const tickers = input.split(/[,\s]+/).map((ticker) => ticker.trim().toUpperCase()).filter(Boolean);
  if (!tickers.length) return;
  await createAnalysis(tickers);
}

async function startMonitoring() {
  await createAnalysis([], { monitor: true });
}

function openTradeModal(rec) {
  const price = Number(rec.current_price || 0);
  const maxSpend = Number(portfolioState.available || 0) * 0.05;
  const shares = price > 0 ? Math.floor(maxSpend / price) : 0;
  const spend = shares * price;
  const stopPrice = price ? price * 0.9 : 0;
  const targetPrice = price ? price * 1.2 : 0;
  const projectedGain = price && shares ? (targetPrice - price) * shares : 0;
  els.tradeTitle.textContent = `Trade ${String(rec.rating || "").toUpperCase()} - ${rec.ticker}`;
  els.tradeBody.innerHTML = `
    <div class="grid grid-cols-2 gap-2">
      <div class="rounded-md bg-slate-950/60 p-3"><span class="block text-xs text-slate-500">Current Price</span>${money(price)}</div>
      <div class="rounded-md bg-slate-950/60 p-3"><span class="block text-xs text-slate-500">Shares</span>${shares}</div>
      <div class="rounded-md bg-slate-950/60 p-3"><span class="block text-xs text-slate-500">Estimated Cost</span>${money(spend)}</div>
      <div class="rounded-md bg-slate-950/60 p-3"><span class="block text-xs text-slate-500">Projected Gain</span>${money(projectedGain)}</div>
      <div class="rounded-md bg-slate-950/60 p-3"><span class="block text-xs text-slate-500">Stop Loss</span>${money(stopPrice)}</div>
      <div class="rounded-md bg-slate-950/60 p-3"><span class="block text-xs text-slate-500">Target</span>${money(targetPrice)}</div>
    </div>
    <p class="mt-3 leading-6">${escapeHtml(rec.reason || "No specific reason provided.")}</p>
  `;
  currentTrade = { ticker: rec.ticker, shares, cost: spend };
  openModal(els.tradeModal);
}

function openModal(modal) {
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  refreshIcons();
}

function closeModal(modal) {
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

async function openHistoryModal(ticker) {
  els.historyTitle.textContent = `Recommendation History - ${ticker}`;
  els.historyBody.innerHTML = `<div class="flex items-center gap-2 text-slate-400"><span class="spinner inline-block h-4 w-4 rounded-full border-2 border-slate-400 border-r-transparent"></span>Loading history...</div>`;
  openModal(els.historyModal);
  try {
    const res = await fetch(`${API_BASE}/history/${ticker}`);
    if (!res.ok) throw new Error("History unavailable");
    const history = await res.json();
    if (!history.length) {
      els.historyBody.innerHTML = `<p class="text-slate-500">No recommendation history yet.</p>`;
      return;
    }
    els.historyBody.innerHTML = `
      <div class="space-y-3">
        ${history
          .map(
            (entry) => `
              <article class="soft-panel rounded-lg p-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="text-sm font-semibold text-white">${formatDateTime(entry.report_time || entry.created_at)}</div>
                  ${ratingBadge(entry.rating)}
                </div>
                <div class="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                  <span>${money(entry.current_price)}</span>
                  <span>${percent(entry.percent_change)}</span>
                </div>
                <p class="mt-2 text-sm leading-6 text-slate-300">${escapeHtml(entry.reason || "")}</p>
              </article>
            `
          )
          .join("")}
      </div>
    `;
  } catch (e) {
    els.historyBody.innerHTML = `<p class="text-red-300">Unable to load history.</p>`;
  }
}

async function deleteAnalysis(id) {
  if (!confirm("Delete this analysis?")) return;
  showToast("Deleting analysis...", "info");
  try {
    const res = await fetch(`${API_BASE}/analyses/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");
    if (selectedAnalysisId === id) {
      selectedAnalysisId = null;
      setEmptyReport("Select or start an analysis.");
      els.logsConsole.innerHTML = "";
      els.selectedAnalysisLabel.textContent = "Select or start an analysis.";
      els.selectedStatus.classList.add("hidden");
    }
    await refresh();
    showToast("Analysis deleted.", "success");
  } catch (e) {
    showToast("Could not delete analysis.", "error");
  }
}

function wireEvents() {
  els.newAnalysisBtn.addEventListener("click", newAnalysis);
  els.monitorBtn.addEventListener("click", startMonitoring);
  els.refreshBtn.addEventListener("click", () => refresh({ spinRefresh: true }));
  els.clearLogs.addEventListener("click", () => {
    els.logsConsole.innerHTML = "";
    appendLog("Logs cleared locally.");
  });
  els.savePortfolio.addEventListener("click", () => {
    const available = parseFloat(els.availableBalance.value);
    const invested = parseFloat(els.investedAmount.value);
    if (!Number.isFinite(available) || !Number.isFinite(invested)) {
      showToast("Portfolio values are invalid.", "error");
      return;
    }
    portfolioState = { available, invested };
    savePortfolioState(portfolioState);
    updatePortfolioUI(portfolioState);
    showToast("Portfolio saved.", "success");
  });
  els.tradeCancel.addEventListener("click", () => closeModal(els.tradeModal));
  els.tradeConfirm.addEventListener("click", () => {
    if (currentTrade && currentTrade.shares > 0) {
      portfolioState.available = Math.max(0, Number(portfolioState.available || 0) - currentTrade.cost);
      portfolioState.invested = Number(portfolioState.invested || 0) + currentTrade.cost;
      savePortfolioState(portfolioState);
      updatePortfolioUI(portfolioState);
      showToast(`${currentTrade.shares} shares of ${currentTrade.ticker} added to the simulation.`, "success");
    } else {
      showToast("No shares available for this simulated trade.", "error");
    }
    closeModal(els.tradeModal);
    currentTrade = null;
  });
  els.historyClose.addEventListener("click", () => closeModal(els.historyModal));
  document.querySelectorAll(".modal-close").forEach((button) => {
    button.addEventListener("click", () => closeModal(document.getElementById(button.dataset.modal)));
  });
}

async function init() {
  refreshIcons();
  updatePortfolioUI(portfolioState);
  setApiStatus("checking", "Checking");
  setEmptyReport("Select or start an analysis.");
  els.logsConsole.innerHTML = `<div class="text-slate-500">Agent output will stream here.</div>`;
  wireEvents();
  try {
    await refresh();
  } catch (e) {
    setEmptyReport("Backend is unavailable.");
  }
  setInterval(async () => {
    try {
      await refresh();
      if (selectedAnalysisId) {
        const selected = analysesCache.find((analysis) => analysis.id === selectedAnalysisId);
        if (selected?.status === "running") {
          await displayReport(selectedAnalysisId);
        }
      }
    } catch (e) {
      // Status is already surfaced by refresh().
    }
  }, 8000);
}

init();
