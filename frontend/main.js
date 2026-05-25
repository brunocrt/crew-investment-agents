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
  candidateList: document.getElementById("candidate-list"),
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

function compactPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "N/A";
  return `${(number * 100).toFixed(1)}%`;
}

function multiple(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "N/A";
  return `${number.toFixed(1)}x`;
}

function priceChangeLabel(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "N/A";
  if (number === 0) return "0.00% flat";
  return `${Math.abs(number * 100).toFixed(2)}% ${number > 0 ? "up" : "down"}`;
}

function priceChangeClass(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return "text-slate-200";
  return number > 0 ? "text-emerald-300" : "text-rose-300";
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

async function fetchCandidates() {
  const res = await fetch(`${API_BASE}/candidates`);
  if (!res.ok) throw new Error("Unable to fetch candidates");
  return res.json();
}

async function refresh(options = {}) {
  try {
    if (options.spinRefresh) setButtonLoading(els.refreshBtn, true);
    const [analyses, candidates] = await Promise.all([fetchAnalyses(), fetchCandidates()]);
    analysesCache = analyses;
    renderStats(analyses);
    renderAnalyses(analyses);
    renderCandidateUniverse(candidates);
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

function renderCandidateUniverse(candidates) {
  if (!els.candidateList) return;
  if (!candidates.length) {
    els.candidateList.innerHTML = `<p class="text-sm text-slate-500">No candidates loaded yet.</p>`;
    return;
  }

  const groups = [
    { key: "core", title: "Core", rows: [] },
    { key: "discovered", title: "Discovered", rows: [] },
    { key: "promoted", title: "Promoted", rows: [] },
  ];
  const byKey = Object.fromEntries(groups.map((group) => [group.key, group]));
  candidates.forEach((candidate) => {
    const status = String(candidate.status || candidate.source || "discovered").toLowerCase();
    const target = byKey[status] || byKey.discovered;
    if (candidate.liquidity_ok !== false && status !== "archived" && status !== "rejected") {
      target.rows.push(candidate);
    }
  });

  els.candidateList.innerHTML = groups
    .filter((group) => group.rows.length)
    .map((group) => `
      <div>
        <div class="mb-2 flex items-center justify-between text-xs">
          <span class="font-semibold text-slate-300">${escapeHtml(group.title)}</span>
          <span class="text-slate-500">${group.rows.length}</span>
        </div>
        <div class="space-y-1">
          ${group.rows.slice(0, 8).map(renderCandidateRow).join("")}
        </div>
      </div>
    `)
    .join("");
  refreshIcons();
}

function renderCandidateRow(candidate) {
  const score = Number.isFinite(Number(candidate.discovery_score)) ? Number(candidate.discovery_score).toFixed(0) : "N/A";
  const theme = candidate.theme || candidate.sector || "Unclassified";
  return `
    <div class="soft-panel rounded-md px-3 py-2">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-semibold text-white">${escapeHtml(candidate.ticker)}</span>
        <span class="text-xs text-cyan-200">${escapeHtml(score)}</span>
      </div>
      <p class="mt-1 truncate text-xs text-slate-500" title="${escapeHtml(candidate.reason || theme)}">${escapeHtml(theme)}</p>
    </div>
  `;
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
        Candidate evaluations will appear here when the agents finish.
      </div>
    `;
    return;
  }

  const sortedRecs = [...recs].sort(compareRecommendations);
  const groupedRecs = groupRecommendationRows(sortedRecs);
  els.recommendations.innerHTML = `
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
      <span>Grouped by actionability, ordered by strongest opportunity first.</span>
      <span>${sortedRecs.length} candidate${sortedRecs.length === 1 ? "" : "s"} evaluated</span>
    </div>
    <div class="space-y-4">
      ${groupedRecs.map(renderRecommendationGroup).join("")}
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

function groupRecommendationRows(sortedRecs) {
  const groups = [
    { key: "buy", title: "Buy Candidates", description: "Actionable opportunities that meet the buy threshold.", rows: [] },
    { key: "exit", title: "Exit Risk", description: "Active hold/sell signals for positions with prior buy history.", rows: [] },
    { key: "caution", title: "Caution", description: "Warning flags on monitored candidates that are not current exit actions.", rows: [] },
    { key: "watchlist", title: "Watchlist / Neutral", description: "Evaluated candidates that do not currently meet buy criteria.", rows: [] },
  ];
  const byKey = Object.fromEntries(groups.map((group) => [group.key, group]));

  sortedRecs.forEach((rec, index) => {
    const rating = String(rec.rating || "neutral").toLowerCase();
    const hasRisk = rec.risk_rating || (Array.isArray(rec.risks) && rec.risks.length);
    if (rating === "buy") {
      byKey.buy.rows.push({ rec, index });
    } else if (rating === "sell" || rating === "hold") {
      byKey.exit.rows.push({ rec, index });
    } else if (hasRisk) {
      byKey.caution.rows.push({ rec, index });
    } else {
      byKey.watchlist.rows.push({ rec, index });
    }
  });

  return groups.filter((group) => group.rows.length);
}

function renderRecommendationGroup(group) {
  return `
    <section>
      <div class="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h4 class="text-sm font-semibold text-white">${escapeHtml(group.title)}</h4>
          <p class="text-xs text-slate-500">${escapeHtml(group.description)}</p>
        </div>
        <span class="text-xs text-slate-500">${group.rows.length}</span>
      </div>
      <div class="space-y-2">
        ${group.rows.map(({ rec, index }) => renderRecommendationCard(rec, index)).join("")}
      </div>
    </section>
  `;
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
  const change = priceChangeLabel(rec.percent_change);
  const changeClass = priceChangeClass(rec.percent_change);
  const changeTitle = rec.price_change_start_date && rec.price_change_end_date
    ? `From ${rec.price_change_start_date} to ${rec.price_change_end_date}`
    : "Latest close versus roughly 30 calendar days earlier";
  const reportTime = formatDateTime(rec.report_time) || "N/A";
  const evidence = Array.isArray(rec.evidence) ? rec.evidence : [];
  const risks = Array.isArray(rec.risks) ? rec.risks : [];
  const valuation = rec.valuation && typeof rec.valuation === "object" ? rec.valuation : null;
  const valuationLabel = valuation?.label || "N/A";
  const valuationScore = valuation && Number.isFinite(Number(valuation.valuation_score)) ? Number(valuation.valuation_score) * 100 : null;
  const valuationDisplay = valuationScore !== null ? `${valuationScore.toFixed(0)}` : "N/A";
  const opportunityStyles = signalStylesForScore(Number(rec.score), { good: 70, weak: 45 }, "Opportunity");
  const confidenceStyles = signalStylesForScore(Number(rec.confidence), { good: 0.75, weak: 0.45 }, "Confidence");
  const riskStyles = risks.length || rec.risk_rating ? signalToneStyles("bad", "Risk present", "octagon-alert") : signalToneStyles("good", "No major risk", "shield-check");
  const isBuy = String(rec.rating || "").toLowerCase() === "buy";

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
          <div class="grid grid-cols-4 gap-2 text-right text-xs sm:min-w-96">
            <div>
              <span class="block text-slate-500">Opportunity</span>
              <span class="font-semibold text-white">${escapeHtml(score)}</span>
            </div>
            <div>
              <span class="block text-slate-500">Value</span>
              <span class="font-semibold text-white" title="${escapeHtml(valuationLabel)}">${escapeHtml(valuationDisplay)}</span>
            </div>
            <div>
              <span class="block text-slate-500">Price</span>
              <span class="font-semibold text-white">${escapeHtml(price)}</span>
            </div>
            <div class="flex items-center justify-end gap-2">
              <div>
                <span class="block text-slate-500">30d</span>
                <span class="font-semibold ${changeClass}" title="${escapeHtml(changeTitle)}">${escapeHtml(change)}</span>
              </div>
              <i data-lucide="chevron-down" class="h-4 w-4 text-slate-500 transition group-open:rotate-180"></i>
            </div>
          </div>
        </summary>
        <div class="border-t border-slate-800 p-4">
          <p class="text-sm leading-6 text-slate-300">${escapeHtml(rec.reason || "No reason provided.")}</p>
          <div class="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-5">
            <div class="rounded-md border p-2 ${opportunityStyles.card}"><span class="block text-slate-500">Opportunity</span>${escapeHtml(score)}</div>
            <div class="rounded-md border p-2 ${confidenceStyles.card}"><span class="block text-slate-500">Confidence</span>${escapeHtml(confidence)}</div>
            <div class="rounded-md border p-2 ${valuationCardClass(valuation)}"><span class="block text-slate-500">Valuation</span>${escapeHtml(valuationLabel)}</div>
            <div class="rounded-md border p-2 ${riskStyles.card}"><span class="block text-slate-500">Risk</span>${escapeHtml(rec.risk_rating || (risks.length ? "Present" : "None"))}</div>
            <div class="rounded-md border border-slate-800 bg-slate-950/50 p-2"><span class="block text-slate-500">Report</span>${escapeHtml(reportTime)}</div>
          </div>
          ${renderValuationPanel(valuation)}
          ${renderEvidenceAndRisk(evidence, risks)}
          <div class="mt-4 flex flex-wrap gap-2">
            <button data-index="${index}" ${isBuy ? "" : "disabled"} class="trade-btn inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold ${isBuy ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : "cursor-not-allowed bg-slate-800 text-slate-500"}">
              ${icon("briefcase-business", "h-4 w-4")}
              ${isBuy ? "Plan Trade" : "No Trade"}
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

function signalToneStyles(tone, label, iconName) {
  const base = {
    good: {
      label,
      icon: iconName || "circle-check",
      panel: "border-emerald-400/30 bg-emerald-950/20",
      card: "border-emerald-400/20 bg-emerald-950/25",
      badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    },
    bad: {
      label,
      icon: iconName || "octagon-alert",
      panel: "border-red-400/30 bg-red-950/20",
      card: "border-red-400/20 bg-red-950/25",
      badge: "border-red-400/30 bg-red-400/10 text-red-200",
    },
    weak: {
      label,
      icon: iconName || "triangle-alert",
      panel: "border-amber-400/30 bg-amber-950/20",
      card: "border-amber-400/20 bg-amber-950/25",
      badge: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    },
    neutral: {
      label,
      icon: iconName || "circle-minus",
      panel: "border-slate-500/30 bg-white/5",
      card: "border-slate-500/25 bg-white/5",
      badge: "border-slate-400/30 bg-white/10 text-slate-100",
    },
  };
  return base[tone] || base.neutral;
}

function signalStylesForScore(value, thresholds, label) {
  if (!Number.isFinite(value)) return signalToneStyles("neutral", `${label} unavailable`);
  if (value >= thresholds.good) return signalToneStyles("good", `Strong ${label.toLowerCase()}`);
  if (value >= thresholds.weak) return signalToneStyles("weak", `Weak ${label.toLowerCase()}`);
  return signalToneStyles("bad", `Low ${label.toLowerCase()}`);
}

function valuationCardClass(valuation) {
  if (!valuation) return signalToneStyles("neutral", "Valuation unavailable").card;
  return valuationSignalStyles(valuationSignal(valuation)).card;
}

function renderValuationPanel(valuation) {
  if (!valuation) return "";
  const margin = valuation.margin_of_safety !== null && valuation.margin_of_safety !== undefined
    ? compactPercent(valuation.margin_of_safety)
    : "N/A";
  const quality = Number.isFinite(Number(valuation.quality_score)) ? `${(Number(valuation.quality_score) * 100).toFixed(0)}` : "N/A";
  const interpretation = interpretValuation(valuation);
  const signal = valuationSignal(valuation);
  const signalStyles = valuationSignalStyles(signal);
  return `
    <div class="mt-4 rounded-md border ${signalStyles.panel} p-3 text-xs text-slate-300">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="font-semibold text-cyan-200">Valuation context</div>
        <div class="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${signalStyles.badge}">
          ${icon(signalStyles.icon, "h-3.5 w-3.5")}
          <span>${escapeHtml(signalStyles.label)}</span>
        </div>
      </div>
      <div class="mt-3 grid gap-2 sm:grid-cols-3">
        <div class="rounded-md border p-3 ${signalStyles.card}">
          <span class="block text-slate-500">Interpretation</span>
          <p class="mt-1 leading-5 text-slate-200">${escapeHtml(interpretation.summary)}</p>
        </div>
        <div class="rounded-md border p-3 ${signalStyles.card}">
          <span class="block text-slate-500">Opportunity Read</span>
          <p class="mt-1 leading-5 text-slate-200">${escapeHtml(interpretation.opportunity)}</p>
        </div>
        <div class="rounded-md border p-3 ${signalStyles.card}">
          <span class="block text-slate-500">Caution</span>
          <p class="mt-1 leading-5 text-slate-200">${escapeHtml(interpretation.caution)}</p>
        </div>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div class="rounded-md bg-slate-900/80 p-2"><span class="block text-slate-500">P/E</span>${escapeHtml(multiple(valuation.current_pe))}</div>
        <div class="rounded-md bg-slate-900/80 p-2"><span class="block text-slate-500">Normal P/E</span>${escapeHtml(multiple(valuation.normal_pe))}</div>
        <div class="rounded-md bg-slate-900/80 p-2"><span class="block text-slate-500">Fair Value</span>${escapeHtml(money(valuation.fair_value) || "N/A")}</div>
        <div class="rounded-md bg-slate-900/80 p-2"><span class="block text-slate-500">Upside</span>${escapeHtml(margin)}</div>
        <div class="rounded-md bg-slate-900/80 p-2"><span class="block text-slate-500">Forward P/E</span>${escapeHtml(multiple(valuation.forward_pe))}</div>
        <div class="rounded-md bg-slate-900/80 p-2"><span class="block text-slate-500">Target Multiple</span>${escapeHtml(multiple(valuation.target_multiple))}</div>
        <div class="rounded-md bg-slate-900/80 p-2"><span class="block text-slate-500">Growth</span>${escapeHtml(compactPercent(valuation.expected_growth ?? valuation.revenue_growth))}</div>
        <div class="rounded-md bg-slate-900/80 p-2"><span class="block text-slate-500">Quality</span>${escapeHtml(quality)}</div>
      </div>
    </div>
  `;
}

function valuationSignal(valuation) {
  if (!valuation.has_valuation) return "neutral";
  const label = String(valuation.label || "").toLowerCase();
  const score = Number(valuation.valuation_score);
  const margin = Number(valuation.margin_of_safety);
  if (label.includes("undervalued") || (Number.isFinite(score) && score >= 0.7) || (Number.isFinite(margin) && margin >= 0.2)) {
    return "good";
  }
  if (label.includes("expensive") || (Number.isFinite(score) && score < 0.25) || (Number.isFinite(margin) && margin < -0.1)) {
    return "bad";
  }
  if (label.includes("fairly") || (Number.isFinite(score) && score < 0.45)) {
    return "weak";
  }
  return "neutral";
}

function valuationSignalStyles(signal) {
  const labels = {
    good: "Good valuation signal",
    bad: "Bad valuation signal",
    weak: "Weak valuation signal",
    neutral: "Neutral valuation signal",
  };
  const icons = {
    good: "circle-check",
    bad: "octagon-alert",
    weak: "triangle-alert",
    neutral: "circle-minus",
  };
  return signalToneStyles(signal, labels[signal] || labels.neutral, icons[signal] || icons.neutral);
}

function interpretValuation(valuation) {
  const label = String(valuation.label || "").toLowerCase();
  const margin = Number(valuation.margin_of_safety);
  const valuationScore = Number(valuation.valuation_score);
  const qualityScore = Number(valuation.quality_score);
  const hasMargin = Number.isFinite(margin);
  const hasQuality = Number.isFinite(qualityScore);
  const qualityText = hasQuality && qualityScore >= 0.75
    ? "business quality looks strong"
    : hasQuality && qualityScore >= 0.45
      ? "business quality looks acceptable"
      : hasQuality
        ? "business quality looks weak"
        : "business quality is not available";

  if (!valuation.has_valuation) {
    return {
      summary: "There is not enough earnings data to anchor price to fundamentals.",
      opportunity: "Treat this as a signal-driven watchlist item, not a valuation-backed idea.",
      caution: "Use price, sector, and risk signals until earnings data is available.",
    };
  }

  if (label.includes("undervalued")) {
    return {
      summary: `Price is below the estimated fair-value anchor and ${qualityText}.`,
      opportunity: hasMargin
        ? `The model sees about ${compactPercent(margin)} upside to fair value before considering new growth surprises.`
        : "The model sees valuation support, but upside could not be estimated.",
      caution: "Confirm that earnings estimates are realistic; fair value falls if growth disappoints.",
    };
  }

  if (label.includes("reasonable")) {
    return {
      summary: `Valuation is supportive but not deeply discounted, and ${qualityText}.`,
      opportunity: hasMargin
        ? `There is about ${compactPercent(margin)} estimated upside to fair value.`
        : "The stock is not obviously expensive on the available fundamentals.",
      caution: "Prefer this when other signals are strong; valuation alone is not the whole case.",
    };
  }

  if (label.includes("fairly")) {
    return {
      summary: `Price is close to the model's fair-value range, and ${qualityText}.`,
      opportunity: "This can still be attractive if capex, sector rotation, or pricing-power signals improve.",
      caution: "There is limited valuation cushion, so execution and earnings quality matter more.",
    };
  }

  const scoreText = Number.isFinite(valuationScore) ? `valuation score is ${(valuationScore * 100).toFixed(0)}` : "valuation score is low";
  return {
    summary: `Price looks stretched versus the fundamental anchor; ${scoreText}, while ${qualityText}.`,
    opportunity: "A good company can still be a poor entry if the current price already discounts too much growth.",
    caution: hasMargin
      ? `The model estimates ${compactPercent(margin)} margin of safety, so wait for a better price or stronger evidence.`
      : "Wait for either a better price or clearer earnings support.",
  };
}

function shortReason(reason) {
  const text = String(reason || "Expand to view rationale and evidence.");
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function renderEvidenceAndRisk(evidence, risks) {
  const riskStyles = risks.length ? signalToneStyles("bad", "Risk present", "octagon-alert") : signalToneStyles("good", "No major risk", "shield-check");
  const riskText = risks.length ? risks.map(renderRiskLabel).join(", ") : "None detected";
  return `
    <div class="mt-4 rounded-md border ${riskStyles.panel} p-3 text-xs text-slate-300">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="font-semibold text-cyan-200">Evidence and risk</div>
        <div class="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${riskStyles.badge}">
          ${icon(riskStyles.icon, "h-3.5 w-3.5")}
          <span>${escapeHtml(riskStyles.label)}</span>
        </div>
      </div>
      <div class="mt-3 space-y-2">
        ${evidence.length ? evidence.map(renderEvidence).join("") : `<p class="rounded-md border border-slate-500/25 bg-white/5 p-2 text-slate-500">No structured evidence available.</p>`}
        <div class="rounded-md border p-2 ${riskStyles.card}">
          <div class="font-semibold text-slate-200">Risks</div>
          <div class="mt-1 text-slate-400">${riskText}</div>
        </div>
      </div>
    </div>
  `;
}

function renderRiskLabel(risk) {
  const label = formatEvidenceSignal(risk.signal);
  const description = riskDescription(risk.signal, risk.detail);
  return `<span class="cursor-help underline decoration-slate-500/60 decoration-dotted underline-offset-2" title="${escapeHtml(description)}">${escapeHtml(label)}</span>`;
}

function riskDescription(signal, fallback) {
  const normalized = String(signal || "").toLowerCase();
  const descriptions = {
    distribution_days: "Recent down days happened on elevated volume, which can indicate institutional selling pressure.",
    distribution: "Recent down days happened on elevated volume, which can indicate institutional selling pressure.",
    technical_exhaustion: "Price behavior looks stretched or weakening, suggesting the trend may be losing momentum.",
    fundamental_peak: "Fundamental momentum may be peaking, so future growth could slow or disappoint.",
    sell_signal: "A sell-oriented risk signal was detected by the exit-risk model.",
  };
  return descriptions[normalized] || fallback || "Risk flag detected by the sell-signal model.";
}

function renderEvidence(item) {
  const styles = evidenceStyles(item);
  return `
    <div class="rounded-md border p-2 ${styles.card}">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="font-semibold text-slate-200">${escapeHtml(formatEvidenceSignal(item.signal))}</div>
        <span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${styles.badge}">
          ${icon(styles.icon, "h-3 w-3")}
          ${escapeHtml(styles.label)}
        </span>
      </div>
      <div class="mt-1 text-slate-400">${escapeHtml(formatEvidenceValue(item.value))}</div>
      <div class="mt-1 text-slate-500">${escapeHtml(item.detail || "")}</div>
    </div>
  `;
}

function formatEvidenceSignal(signal) {
  return String(signal || "")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function evidenceStyles(item) {
  const signal = String(item.signal || "").toLowerCase();
  const value = item.value;
  if (signal.includes("risk") || signal.includes("sell") || signal.includes("exhaustion") || signal.includes("distribution")) {
    return signalToneStyles("bad", "Risk", "octagon-alert");
  }
  if (signal.includes("valuation")) {
    const label = String(value?.label || "").toLowerCase();
    if (label.includes("undervalued") || Number(value?.margin_of_safety) >= 0.2) return signalToneStyles("good", "Supportive", "circle-check");
    if (label.includes("expensive") || Number(value?.margin_of_safety) < -0.1) return signalToneStyles("bad", "Concerning", "octagon-alert");
    if (label.includes("fairly")) return signalToneStyles("weak", "Mixed", "triangle-alert");
    return signalToneStyles("neutral", "Neutral", "circle-minus");
  }
  if (signal.includes("quality")) {
    const quality = Number(value?.quality_score);
    if (Number.isFinite(quality) && quality >= 0.75) return signalToneStyles("good", "Strong", "circle-check");
    if (Number.isFinite(quality) && quality >= 0.45) return signalToneStyles("weak", "Acceptable", "triangle-alert");
    if (Number.isFinite(quality)) return signalToneStyles("bad", "Weak", "octagon-alert");
    return signalToneStyles("neutral", "Neutral", "circle-minus");
  }
  if (signal.includes("capex") || signal.includes("pricing") || signal.includes("rotation")) {
    return signalToneStyles("good", "Positive", "circle-check");
  }
  return signalToneStyles("neutral", "Context", "circle-minus");
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
  const stopPrice = price ? price * 0.9 : 0;
  const targetPrice = price ? price * 1.2 : 0;
  els.tradeTitle.textContent = `Trade ${String(rec.rating || "").toUpperCase()} - ${rec.ticker}`;
  els.tradeBody.innerHTML = `
    <div class="rounded-md bg-slate-950/60 p-3 text-sm">
      <span class="block text-xs text-slate-500">Current Price</span>
      <span class="font-semibold text-white">${money(price)}</span>
    </div>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label class="block">
        <span class="text-xs text-slate-500">Shares</span>
        <input id="trade-shares" min="0" step="1" type="number" value="${shares}" class="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400" />
      </label>
      <label class="block">
        <span class="text-xs text-slate-500">Stop Loss</span>
        <input id="trade-stop" min="0" step="0.01" type="number" value="${stopPrice.toFixed(2)}" class="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400" />
      </label>
      <label class="block">
        <span class="text-xs text-slate-500">Target Price</span>
        <input id="trade-target" min="0" step="0.01" type="number" value="${targetPrice.toFixed(2)}" class="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400" />
      </label>
      <label class="block">
        <span class="text-xs text-slate-500">Dividend Yield %</span>
        <input id="trade-dividend" min="0" step="0.01" type="number" value="0.00" class="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400" />
      </label>
    </div>
    <div class="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
      <div class="rounded-md bg-slate-950/60 p-3"><span class="block text-xs text-slate-500">Estimated Cost</span><span id="trade-cost" class="font-semibold text-white"></span></div>
      <div class="rounded-md bg-slate-950/60 p-3"><span class="block text-xs text-slate-500">Projected Gain</span><span id="trade-gain" class="font-semibold text-white"></span></div>
      <div class="rounded-md bg-slate-950/60 p-3"><span class="block text-xs text-slate-500">Dividend Est.</span><span id="trade-dividend-estimate" class="font-semibold text-white"></span></div>
    </div>
    <p class="mt-3 leading-6">${escapeHtml(rec.reason || "No specific reason provided.")}</p>
  `;
  currentTrade = { ticker: rec.ticker, price };
  wireTradeCalculator();
  openModal(els.tradeModal);
}

function wireTradeCalculator() {
  const sharesInput = document.getElementById("trade-shares");
  const stopInput = document.getElementById("trade-stop");
  const targetInput = document.getElementById("trade-target");
  const dividendInput = document.getElementById("trade-dividend");
  const costEl = document.getElementById("trade-cost");
  const gainEl = document.getElementById("trade-gain");
  const dividendEl = document.getElementById("trade-dividend-estimate");

  const calculate = () => {
    const shares = Math.max(0, Math.floor(Number(sharesInput.value || 0)));
    const target = Math.max(0, Number(targetInput.value || 0));
    const dividendYield = Math.max(0, Number(dividendInput.value || 0)) / 100;
    const cost = shares * currentTrade.price;
    const projectedGain = Math.max(0, target - currentTrade.price) * shares;
    const dividendEstimate = cost * dividendYield;
    costEl.textContent = money(cost);
    gainEl.textContent = money(projectedGain);
    dividendEl.textContent = money(dividendEstimate);
    currentTrade = {
      ...currentTrade,
      shares,
      cost,
      stopPrice: Math.max(0, Number(stopInput.value || 0)),
      targetPrice: target,
      dividendYield,
      projectedGain,
      dividendEstimate,
    };
  };

  [sharesInput, stopInput, targetInput, dividendInput].forEach((input) => {
    input.addEventListener("input", calculate);
  });
  calculate();
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
                  <span class="${priceChangeClass(entry.percent_change)}">${priceChangeLabel(entry.percent_change)}</span>
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
