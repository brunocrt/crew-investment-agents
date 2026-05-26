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
  addHolding: document.getElementById("add-holding"),
  appView: document.getElementById("app-view"),
  agentConfigEditor: document.getElementById("agent-config-editor"),
  agentConfigList: document.getElementById("agent-config-list"),
  agentLlmApiKey: document.getElementById("agent-llm-api-key"),
  agentLlmKeyStatus: document.getElementById("agent-llm-key-status"),
  agentLlmModel: document.getElementById("agent-llm-model"),
  agentLlmTemperature: document.getElementById("agent-llm-temperature"),
  agentsNavBtn: document.getElementById("agents-nav-btn"),
  agentsView: document.getElementById("agents-view"),
  analysesList: document.getElementById("analyses-list"),
  analyzeHoldings: document.getElementById("analyze-holdings"),
  apiStatus: document.getElementById("api-status"),
  apiDocsLink: document.getElementById("api-docs-link"),
  accountCurrentPassword: document.getElementById("account-current-password"),
  accountDisplayName: document.getElementById("account-display-name"),
  accountForm: document.getElementById("account-form"),
  accountNewPassword: document.getElementById("account-new-password"),
  accountStartAgentsOption: document.getElementById("account-start-agents-option"),
  accountStartPage: document.getElementById("account-start-page"),
  accountUsername: document.getElementById("account-username"),
  adminUsersPanel: document.getElementById("admin-users-panel"),
  availableBalance: document.getElementById("available-balance"),
  candidateList: document.getElementById("candidate-list"),
  candidateRefreshMeta: document.getElementById("candidate-refresh-meta"),
  clearLogs: document.getElementById("clear-logs-btn"),
  historyActionFilter: document.getElementById("history-action-filter"),
  historyBody: document.getElementById("history-body"),
  historyClose: document.getElementById("history-close"),
  historyList: document.getElementById("history-list"),
  historyModal: document.getElementById("history-modal"),
  historyNavBtn: document.getElementById("history-nav-btn"),
  historySearch: document.getElementById("history-search"),
  historyStatusFilter: document.getElementById("history-status-filter"),
  historyTitle: document.getElementById("history-title"),
  historyView: document.getElementById("history-view"),
  holdingAverageCost: document.getElementById("holding-average-cost"),
  holdingShares: document.getElementById("holding-shares"),
  holdingsList: document.getElementById("holdings-list"),
  holdingTicker: document.getElementById("holding-ticker"),
  investedAmount: document.getElementById("invested-amount"),
  lastRefresh: document.getElementById("last-refresh"),
  loginError: document.getElementById("login-error"),
  loginForm: document.getElementById("login-form"),
  loginPassword: document.getElementById("login-password"),
  loginUsername: document.getElementById("login-username"),
  loginView: document.getElementById("login-view"),
  loggedUserName: document.getElementById("logged-user-name"),
  loggedUserRole: document.getElementById("logged-user-role"),
  logsCollapseBtn: document.getElementById("logs-collapse-btn"),
  logsConsole: document.getElementById("logs-console"),
  logsPanelBody: document.getElementById("logs-panel-body"),
  logsSubtitle: document.getElementById("logs-subtitle"),
  logoutBtn: document.getElementById("logout-btn"),
  monitorBtn: document.getElementById("monitor-btn"),
  newAnalysisBtn: document.getElementById("new-analysis-btn"),
  newUserDisplayName: document.getElementById("new-user-display-name"),
  newUserPassword: document.getElementById("new-user-password"),
  newUserRole: document.getElementById("new-user-role"),
  newUserUsername: document.getElementById("new-user-username"),
  positionsAddLink: document.getElementById("positions-add-link"),
  positionsAnalyze: document.getElementById("positions-analyze"),
  positionsCount: document.getElementById("positions-count"),
  positionsList: document.getElementById("positions-list"),
  positionsNavBtn: document.getElementById("positions-nav-btn"),
  positionsSummary: document.getElementById("positions-summary"),
  positionsView: document.getElementById("positions-view"),
  portfolioSummary: document.getElementById("portfolio-summary"),
  recommendations: document.getElementById("recommendations"),
  refreshBtn: document.getElementById("refresh-btn"),
  refreshCandidates: document.getElementById("refresh-candidates"),
  refreshUsers: document.getElementById("refresh-users"),
  reloadAgentConfig: document.getElementById("reload-agent-config"),
  reportCollapseBtn: document.getElementById("report-collapse-btn"),
  reportPanelBody: document.getElementById("report-panel-body"),
  reportSummary: document.getElementById("report-summary"),
  dashboardNavBtn: document.getElementById("dashboard-nav-btn"),
  dashboardView: document.getElementById("dashboard-view"),
  saveAnalysisSettings: document.getElementById("save-analysis-settings"),
  saveAgentConfig: document.getElementById("save-agent-config"),
  savePortfolio: document.getElementById("save-portfolio"),
  selectedAnalysisLabel: document.getElementById("selected-analysis-label"),
  selectedStatus: document.getElementById("selected-status"),
  settingMinOpportunity: document.getElementById("setting-min-opportunity"),
  settingMinValuation: document.getElementById("setting-min-valuation"),
  settingCandidateRefresh: document.getElementById("setting-candidate-refresh"),
  settingPositionSize: document.getElementById("setting-position-size"),
  settingRiskDial: document.getElementById("setting-risk-dial"),
  settingRiskLabel: document.getElementById("setting-risk-label"),
  settingRiskSummary: document.getElementById("setting-risk-summary"),
  settingRiskTolerance: document.getElementById("setting-risk-tolerance"),
  settingStopLoss: document.getElementById("setting-stop-loss"),
  settingTargetGain: document.getElementById("setting-target-gain"),
  settingsNavBtn: document.getElementById("settings-nav-btn"),
  settingsView: document.getElementById("settings-view"),
  sidebarToggle: document.getElementById("sidebar-toggle"),
  sidebarStatus: document.getElementById("sidebar-status"),
  statsContainer: document.getElementById("stats-container"),
  toastStack: document.getElementById("toast-stack"),
  tradeBody: document.getElementById("trade-body"),
  tradeCancel: document.getElementById("trade-cancel"),
  tradeConfirm: document.getElementById("trade-confirm"),
  tradeModal: document.getElementById("trade-modal"),
  tradeTitle: document.getElementById("trade-title"),
  userCreateForm: document.getElementById("user-create-form"),
  usersList: document.getElementById("users-list"),
  usersNavBtn: document.getElementById("users-nav-btn"),
  usersView: document.getElementById("users-view"),
};

let currentSocket = null;
let currentTrade = null;
let selectedAnalysisId = null;
let analysesCache = [];
let candidateUniverseCache = [];
let currentUser = loadStoredUser();
let portfolioState = loadPortfolio();
let positionMarketCache = {};
let agentConfigState = { agents: {}, tasks: {}, llm: { model: "gpt-4o", temperature: 0.3 } };
let selectedAgentKey = null;
let eventsWired = false;
let appStarted = false;
let refreshTimerId = null;
let sidebarCollapsed = localStorage.getItem("sidebar-collapsed") === "true";
let panelCollapseState = loadPanelCollapseState();
let activeView = localStorage.getItem("active-view") || "dashboard";
let analysisSettings = loadAnalysisSettings();

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

function authToken() {
  return sessionStorage.getItem("investment-console-token") || "";
}

function loadStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem("investment-console-user") || "null");
  } catch (e) {
    return null;
  }
}

function storeSession(token, user) {
  sessionStorage.setItem("investment-console-token", token);
  sessionStorage.setItem("investment-console-user", JSON.stringify(user || null));
  currentUser = user || null;
  portfolioState = loadPortfolio();
  updateLoggedUserUI();
  updatePortfolioUI(portfolioState);
}

async function saveAccount(event) {
  event.preventDefault();
  const selectedStartPage = els.accountStartPage?.value || "dashboard";
  const payload = {
    display_name: els.accountDisplayName?.value || "",
    preferences: {
      ...(currentUser?.preferences || {}),
      startPage: currentUser?.role === "admin" || selectedStartPage !== "agents" ? selectedStartPage : "dashboard",
    },
  };
  const currentPassword = els.accountCurrentPassword?.value || "";
  const newPassword = els.accountNewPassword?.value || "";
  if (newPassword) {
    payload.current_password = currentPassword;
    payload.new_password = newPassword;
  }
  try {
    const res = await apiFetch("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || "Account update failed");
    }
    const data = await res.json();
    storeSession(authToken(), data.user);
    if (els.accountCurrentPassword) els.accountCurrentPassword.value = "";
    if (els.accountNewPassword) els.accountNewPassword.value = "";
    showToast("Account updated.", "success");
  } catch (e) {
    showToast(e.message || "Could not update account.", "error");
  }
}

function clearSession() {
  sessionStorage.removeItem("investment-console-token");
  sessionStorage.removeItem("investment-console-user");
  currentUser = null;
  portfolioState = defaultPortfolio();
  updateLoggedUserUI();
  updatePortfolioUI(portfolioState);
}

function isAuthenticated() {
  return Boolean(authToken());
}

async function apiFetch(path, options = {}) {
  const token = authToken();
  if (!token) {
    throw new Error("Authentication required");
  }
  const headers = {
    ...(options.headers || {}),
  };
  if (!(options.body instanceof FormData) && options.body !== undefined) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    logout(false);
    throw new Error("Authentication required");
  }
  return res;
}

function updateLoggedUserUI() {
  const isAdmin = currentUser?.role === "admin";
  els.usersNavBtn?.classList.remove("hidden");
  els.usersNavBtn?.classList.add("flex");
  els.agentsNavBtn?.classList.toggle("hidden", !isAdmin);
  els.agentsNavBtn?.classList.toggle("flex", isAdmin);
  els.apiDocsLink?.classList.toggle("hidden", !isAdmin);
  els.apiDocsLink?.classList.toggle("flex", isAdmin);
  els.adminUsersPanel?.classList.toggle("hidden", !isAdmin);
  els.accountStartAgentsOption?.classList.toggle("hidden", !isAdmin);
  if (els.loggedUserName) {
    els.loggedUserName.textContent = currentUser?.display_name || currentUser?.username || "Not signed in";
  }
  if (els.loggedUserRole) {
    els.loggedUserRole.textContent = currentUser?.role ? `${currentUser.role} account` : "";
  }
  updateAccountForm();
}

function updateAccountForm() {
  if (els.accountUsername) els.accountUsername.value = currentUser?.username || "";
  if (els.accountDisplayName) els.accountDisplayName.value = currentUser?.display_name || "";
  if (els.accountStartPage) {
    const preferredStartPage = currentUser?.preferences?.startPage || "dashboard";
    els.accountStartPage.value = currentUser?.role === "admin" || preferredStartPage !== "agents" ? preferredStartPage : "dashboard";
  }
}

function showAuthenticatedApp() {
  els.loginView?.classList.add("hidden");
  els.appView?.classList.remove("hidden");
  els.appView?.classList.add("flex");
}

function showLogin() {
  els.appView?.classList.add("hidden");
  els.appView?.classList.remove("flex");
  els.loginView?.classList.remove("hidden");
  if (els.loginUsername) els.loginUsername.value = "admin";
  if (els.loginPassword) els.loginPassword.value = "";
  refreshIcons();
}

function stopAppSession() {
  appStarted = false;
  if (refreshTimerId) {
    clearInterval(refreshTimerId);
    refreshTimerId = null;
  }
  if (currentSocket) {
    currentSocket.close();
    currentSocket = null;
  }
  selectedAnalysisId = null;
  analysesCache = [];
  candidateUniverseCache = [];
  positionMarketCache = {};
}

async function handleLogin(event) {
  event.preventDefault();
  const username = String(els.loginUsername?.value || "").trim();
  const password = String(els.loginPassword?.value || "");
  els.loginError?.classList.add("hidden");
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error("Invalid credentials");
    const data = await res.json();
    storeSession(data.token, data.user);
    showAuthenticatedApp();
    await startApp();
  } catch (e) {
    els.loginError?.classList.remove("hidden");
  }
}

function logout(showMessage = true) {
  const token = authToken();
  if (token) {
    fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  stopAppSession();
  clearSession();
  showLogin();
  if (showMessage) showToast("Signed out.", "info");
}

function applySidebarState() {
  document.body.classList.toggle("sidebar-collapsed", sidebarCollapsed);
  if (!els.sidebarToggle) return;
  els.sidebarToggle.setAttribute("aria-expanded", String(!sidebarCollapsed));
  els.sidebarToggle.title = sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar";
  els.sidebarToggle.setAttribute("aria-label", sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar");
  els.sidebarToggle.innerHTML = sidebarCollapsed
    ? icon("panel-left-open", "h-4 w-4")
    : icon("panel-left-close", "h-4 w-4");
  refreshIcons();
}

function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  localStorage.setItem("sidebar-collapsed", String(sidebarCollapsed));
  applySidebarState();
}

function setActiveView(view) {
  const allowedViews = ["settings", "positions", "history", "agents", "users"];
  activeView = allowedViews.includes(view) ? view : "dashboard";
  if (activeView === "agents" && currentUser?.role !== "admin") activeView = "dashboard";
  localStorage.setItem("active-view", activeView);
  const isSettings = activeView === "settings";
  const isPositions = activeView === "positions";
  const isHistory = activeView === "history";
  const isAgents = activeView === "agents";
  const isUsers = activeView === "users";
  els.dashboardView?.classList.toggle("hidden", activeView !== "dashboard");
  els.positionsView?.classList.toggle("hidden", !isPositions);
  els.historyView?.classList.toggle("hidden", !isHistory);
  els.settingsView?.classList.toggle("hidden", !isSettings);
  els.agentsView?.classList.toggle("hidden", !isAgents);
  els.usersView?.classList.toggle("hidden", !isUsers);
  if (isPositions) {
    renderPositionsPage();
    loadPositionMarketData();
  }
  if (isHistory) renderAnalysisHistory(analysesCache);
  if (isAgents && !Object.keys(agentConfigState.agents || {}).length) {
    loadAgentConfig();
  }
  if (isUsers) {
    updateAccountForm();
    if (currentUser?.role === "admin") loadUsers();
  }
  updateViewNav();
}

function updateViewNav() {
  [
    { button: els.dashboardNavBtn, view: "dashboard" },
    { button: els.positionsNavBtn, view: "positions" },
    { button: els.historyNavBtn, view: "history" },
    { button: els.settingsNavBtn, view: "settings" },
    { button: els.agentsNavBtn, view: "agents" },
    { button: els.usersNavBtn, view: "users" },
  ].forEach(({ button, view }) => {
    if (!button) return;
    if (view === "agents" && currentUser?.role !== "admin") {
      button.className = "view-nav-btn hidden min-w-fit items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-900 hover:text-white lg:w-full";
      return;
    }
    const active = activeView === view;
    button.className = active
      ? "view-nav-btn flex min-w-fit items-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white lg:w-full"
      : "view-nav-btn flex min-w-fit items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-900 hover:text-white lg:w-full";
  });
  refreshIcons();
}

function loadPanelCollapseState() {
  const defaults = { report: false, logs: false };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem("panel-collapse-state") || "{}") };
  } catch (e) {
    return defaults;
  }
}

function loadAnalysisSettings() {
  const defaults = {
    positionSizePct: 5,
    stopLossPct: 10,
    targetGainPct: 20,
    minOpportunityScore: 70,
    minValuationScore: 35,
    riskTolerance: "balanced",
    riskToleranceDial: 50,
    candidateRefreshCadence: "monitor",
  };
  try {
    const stored = { ...defaults, ...JSON.parse(localStorage.getItem("analysis-settings") || "{}") };
    if (!Number.isFinite(Number(stored.riskToleranceDial))) {
      stored.riskToleranceDial = dialFromRiskTolerance(stored.riskTolerance);
    }
    return stored;
  } catch (e) {
    return defaults;
  }
}

function saveAnalysisSettings() {
  const riskDial = clampNumber(els.settingRiskDial?.value, 0, 100, dialFromRiskTolerance(els.settingRiskTolerance?.value));
  analysisSettings = {
    positionSizePct: clampNumber(els.settingPositionSize?.value, 1, 100, 5),
    stopLossPct: clampNumber(els.settingStopLoss?.value, 1, 80, 10),
    targetGainPct: clampNumber(els.settingTargetGain?.value, 1, 300, 20),
    minOpportunityScore: clampNumber(els.settingMinOpportunity?.value, 0, 100, 70),
    minValuationScore: clampNumber(els.settingMinValuation?.value, 0, 100, 35),
    riskTolerance: riskToleranceFromDial(riskDial),
    riskToleranceDial: riskDial,
    candidateRefreshCadence: els.settingCandidateRefresh?.value || "monitor",
  };
  localStorage.setItem("analysis-settings", JSON.stringify(analysisSettings));
  updateAnalysisSettingsUI();
  showToast("Analysis settings saved.", "success");
}

function updateAnalysisSettingsUI() {
  const riskDial = clampNumber(analysisSettings.riskToleranceDial, 0, 100, dialFromRiskTolerance(analysisSettings.riskTolerance));
  if (els.settingPositionSize) els.settingPositionSize.value = Number(analysisSettings.positionSizePct).toFixed(1);
  if (els.settingStopLoss) els.settingStopLoss.value = Number(analysisSettings.stopLossPct).toFixed(1);
  if (els.settingTargetGain) els.settingTargetGain.value = Number(analysisSettings.targetGainPct).toFixed(1);
  if (els.settingMinOpportunity) els.settingMinOpportunity.value = Number(analysisSettings.minOpportunityScore).toFixed(0);
  if (els.settingMinValuation) els.settingMinValuation.value = Number(analysisSettings.minValuationScore).toFixed(0);
  if (els.settingRiskDial) els.settingRiskDial.value = String(riskDial);
  renderRiskToleranceDial(riskDial);
  if (els.settingCandidateRefresh) els.settingCandidateRefresh.value = analysisSettings.candidateRefreshCadence || "monitor";
  updateCandidateRefreshMeta();
}

function riskToleranceFromDial(value) {
  const dial = clampNumber(value, 0, 100, 50);
  if (dial < 34) return "conservative";
  if (dial > 66) return "aggressive";
  return "balanced";
}

function dialFromRiskTolerance(value) {
  const normalized = String(value || "balanced").toLowerCase();
  if (normalized === "conservative") return 15;
  if (normalized === "aggressive") return 85;
  return 50;
}

function interpolateRiskSetting(dial, conservative, balanced, aggressive) {
  const value = clampNumber(dial, 0, 100, 50);
  if (value <= 50) {
    const progress = value / 50;
    return conservative + (balanced - conservative) * progress;
  }
  const progress = (value - 50) / 50;
  return balanced + (aggressive - balanced) * progress;
}

function riskPreferenceProfile(dial) {
  const value = clampNumber(dial, 0, 100, 50);
  const riskTolerance = riskToleranceFromDial(value);
  const labels = {
    conservative: "Conservative",
    balanced: "Balanced",
    aggressive: "Aggressive",
  };
  const summaries = {
    conservative: "Prioritizes smaller positions, tighter stops, stronger opportunity scores, and better valuation support.",
    balanced: "Keeps default position sizing and signal thresholds in the middle of the risk range.",
    aggressive: "Allows larger positions, wider stops, higher targets, and lower signal thresholds for more opportunities.",
  };
  return {
    value,
    riskTolerance,
    label: labels[riskTolerance],
    summary: summaries[riskTolerance],
    positionSizePct: interpolateRiskSetting(value, 3, 5, 10),
    stopLossPct: interpolateRiskSetting(value, 7, 10, 16),
    targetGainPct: interpolateRiskSetting(value, 14, 20, 35),
    minOpportunityScore: interpolateRiskSetting(value, 82, 70, 58),
    minValuationScore: interpolateRiskSetting(value, 50, 35, 20),
  };
}

function renderRiskToleranceDial(dial) {
  const profile = riskPreferenceProfile(dial);
  if (els.settingRiskTolerance) els.settingRiskTolerance.value = profile.riskTolerance;
  if (els.settingRiskLabel) {
    els.settingRiskLabel.textContent = `${profile.label} (${Math.round(profile.value)})`;
    els.settingRiskLabel.className = profile.riskTolerance === "aggressive"
      ? "rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-200"
      : profile.riskTolerance === "conservative"
        ? "rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200"
        : "rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-200";
  }
  if (els.settingRiskSummary) els.settingRiskSummary.textContent = profile.summary;
}

function applyRiskToleranceDial(value) {
  const profile = riskPreferenceProfile(value);
  if (els.settingRiskDial) els.settingRiskDial.value = String(Math.round(profile.value));
  if (els.settingPositionSize) els.settingPositionSize.value = profile.positionSizePct.toFixed(1);
  if (els.settingStopLoss) els.settingStopLoss.value = profile.stopLossPct.toFixed(1);
  if (els.settingTargetGain) els.settingTargetGain.value = profile.targetGainPct.toFixed(1);
  if (els.settingMinOpportunity) els.settingMinOpportunity.value = profile.minOpportunityScore.toFixed(0);
  if (els.settingMinValuation) els.settingMinValuation.value = profile.minValuationScore.toFixed(0);
  renderRiskToleranceDial(profile.value);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function candidateRefreshIntervalMs() {
  const cadence = analysisSettings.candidateRefreshCadence || "monitor";
  if (cadence === "daily") return 24 * 60 * 60 * 1000;
  if (cadence === "weekly") return 7 * 24 * 60 * 60 * 1000;
  return null;
}

function candidateRefreshLabel() {
  const cadence = analysisSettings.candidateRefreshCadence || "monitor";
  const labels = {
    monitor: "Refreshes when a monitor/default analysis runs.",
    daily: "Auto-discovery runs at most once per day.",
    weekly: "Auto-discovery runs at most once per week.",
    manual: "Discovery runs only when you press Refresh Universe.",
  };
  return labels[cadence] || labels.monitor;
}

function shouldDiscoverCandidates(force = false) {
  if (force) return true;
  const interval = candidateRefreshIntervalMs();
  if (!interval) return false;
  const last = Number(localStorage.getItem("candidate-universe-last-discovery") || 0);
  return !last || Date.now() - last >= interval;
}

function markCandidateDiscovery() {
  localStorage.setItem("candidate-universe-last-discovery", String(Date.now()));
  updateCandidateRefreshMeta();
}

function updateCandidateRefreshMeta() {
  if (!els.candidateRefreshMeta) return;
  const last = Number(localStorage.getItem("candidate-universe-last-discovery") || 0);
  const lastText = last ? ` Last discovery: ${formatDateTime(new Date(last))}.` : " No discovery refresh recorded yet.";
  els.candidateRefreshMeta.textContent = `${candidateRefreshLabel()}${lastText}`;
}

function savePanelCollapseState() {
  localStorage.setItem("panel-collapse-state", JSON.stringify(panelCollapseState));
}

function applyCollapsiblePanelState(panelName) {
  const isCollapsed = Boolean(panelCollapseState[panelName]);
  const body = panelName === "report" ? els.reportPanelBody : els.logsPanelBody;
  const button = panelName === "report" ? els.reportCollapseBtn : els.logsCollapseBtn;
  if (!body || !button) return;
  body.classList.toggle("hidden", isCollapsed);
  button.setAttribute("aria-expanded", String(!isCollapsed));
  button.title = isCollapsed ? `Expand ${panelName}` : `Collapse ${panelName}`;
  button.innerHTML = isCollapsed
    ? icon("chevron-down", "h-4 w-4")
    : icon("chevron-up", "h-4 w-4");
  refreshIcons();
}

function togglePanel(panelName) {
  panelCollapseState[panelName] = !panelCollapseState[panelName];
  savePanelCollapseState();
  applyCollapsiblePanelState(panelName);
}

function applyPanelCollapseStates() {
  applyCollapsiblePanelState("report");
  applyCollapsiblePanelState("logs");
}

function formatDateTime(timestamp) {
  if (!timestamp) return "";
  const date = parseTimestamp(timestamp);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function timeAgo(timestamp) {
  const date = parseTimestamp(timestamp);
  if (!date) return "";
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function parseTimestamp(timestamp) {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  const text = String(timestamp);
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(text);
  const normalized = hasTimezone ? text : `${text}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
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

function defaultPortfolio() {
  return { available: 10000, invested: 0, positions: [] };
}

function portfolioStorageKey(user = currentUser) {
  const userKey = user?.id ?? user?.username;
  return userKey ? `investment-console-portfolio:${userKey}` : null;
}

function migrateLegacyPortfolio(user = currentUser) {
  const key = portfolioStorageKey(user);
  if (!key || localStorage.getItem(key)) return;
  const legacy = localStorage.getItem("portfolio");
  if (!legacy) return;
  localStorage.setItem(key, legacy);
  localStorage.removeItem("portfolio");
}

function loadPortfolio(user = currentUser) {
  const defaults = defaultPortfolio();
  const key = portfolioStorageKey(user);
  if (!key) return defaults;
  migrateLegacyPortfolio(user);
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return normalizePortfolio(JSON.parse(stored));
    } catch (e) {
      return defaults;
    }
  }
  return defaults;
}

function normalizeTicker(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizePosition(position) {
  const ticker = normalizeTicker(position?.ticker);
  const shares = Number(position?.shares);
  const averageCost = Number(position?.averageCost ?? position?.average_cost ?? position?.avgCost);
  if (!ticker || !Number.isFinite(shares) || shares <= 0 || !Number.isFinite(averageCost) || averageCost < 0) {
    return null;
  }
  return { ticker, shares, averageCost };
}

function portfolioPositions(portfolio = portfolioState) {
  return Array.isArray(portfolio?.positions)
    ? portfolio.positions.map(normalizePosition).filter(Boolean)
    : [];
}

function uniqueTickers(values) {
  return [...new Set((values || []).map(normalizeTicker).filter(Boolean))];
}

function portfolioTickers() {
  return portfolioPositions().map((position) => position.ticker);
}

function activeCandidateTickers() {
  return uniqueTickers(
    candidateUniverseCache
      .filter((candidate) => {
        const status = String(candidate.status || candidate.source || "discovered").toLowerCase();
        return candidate.liquidity_ok !== false && status !== "archived" && status !== "rejected";
      })
      .map((candidate) => candidate.ticker)
  );
}

function calculateInvested(portfolio = portfolioState) {
  const positions = portfolioPositions(portfolio);
  if (Array.isArray(portfolio?.positions)) {
    return positions.reduce((sum, position) => sum + position.shares * position.averageCost, 0);
  }
  return Number(portfolio?.invested || 0);
}

function normalizePortfolio(portfolio) {
  const available = Number(portfolio?.available);
  const positions = portfolioPositions(portfolio);
  const normalized = {
    available: Number.isFinite(available) ? available : 10000,
    positions,
  };
  normalized.invested = calculateInvested({ ...portfolio, positions });
  return normalized;
}

function savePortfolioState(portfolio) {
  const key = portfolioStorageKey();
  if (!key) return;
  localStorage.setItem(key, JSON.stringify(normalizePortfolio(portfolio)));
}

function updatePortfolioUI(portfolio) {
  portfolioState = normalizePortfolio(portfolio);
  els.availableBalance.value = Number(portfolioState.available || 0).toFixed(2);
  els.investedAmount.value = Number(calculateInvested(portfolioState)).toFixed(2);
  renderPortfolioSummary(portfolioState);
  renderHoldings(portfolioState);
  renderPositionsPage();
}

function renderPortfolioSummary(portfolio) {
  if (!els.portfolioSummary) return;
  const available = Number(portfolio.available || 0);
  const invested = Number(portfolio.invested || 0);
  const total = available + invested;
  const investedPct = total > 0 ? invested / total : 0;
  const availablePct = total > 0 ? available / total : 0;
  const summary = [
    { title: "Available Funds", value: money(available), meta: `${compactPercent(availablePct)} of portfolio`, icon: "wallet", accent: "text-emerald-300" },
    { title: "Invested Funds", value: money(invested), meta: `${compactPercent(investedPct)} deployed`, icon: "briefcase-business", accent: "text-cyan-300" },
    { title: "Total Tracked", value: money(total), meta: "Simulated portfolio value", icon: "landmark", accent: "text-slate-300" },
  ];
  els.portfolioSummary.innerHTML = summary
    .map((item) => `
      <article class="panel rounded-lg p-4">
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm text-slate-400">${escapeHtml(item.title)}</span>
          ${icon(item.icon, `h-5 w-5 ${item.accent}`)}
        </div>
        <div class="mt-3 flex flex-wrap items-end justify-between gap-2">
          <p class="text-2xl font-semibold text-white">${escapeHtml(item.value)}</p>
          <p class="pb-1 text-xs text-slate-500">${escapeHtml(item.meta)}</p>
        </div>
      </article>
    `)
    .join("");
  refreshIcons();
}

function latestMarketForPosition(ticker) {
  return positionMarketCache[normalizeTicker(ticker)] || null;
}

async function loadPositionMarketData() {
  if (!isAuthenticated()) return;
  const tickers = portfolioTickers().filter((ticker) => !positionMarketCache[ticker]);
  if (!tickers.length) return;
  await Promise.all(tickers.map(async (ticker) => {
    try {
      const res = await apiFetch(`/history/${encodeURIComponent(ticker)}`);
      if (!res.ok) return;
      const history = await res.json();
      const latest = [...history]
        .filter((entry) => entry.current_price !== null && entry.current_price !== undefined)
        .sort((a, b) => new Date(b.report_time || b.created_at) - new Date(a.report_time || a.created_at))[0];
      positionMarketCache[ticker] = latest || { ticker };
    } catch (e) {
      positionMarketCache[ticker] = { ticker };
    }
  }));
  renderPositionsPage();
}

function renderPositionsPage() {
  if (!els.positionsList || !els.positionsSummary) return;
  const positions = portfolioPositions();
  if (els.positionsCount) {
    els.positionsCount.textContent = `${positions.length} position${positions.length === 1 ? "" : "s"}`;
  }
  if (!positions.length) {
    els.positionsSummary.innerHTML = [
      positionSummaryCard("Tracked Cost", money(0), "No holdings yet", "briefcase-business", "text-cyan-300"),
      positionSummaryCard("Market Value", "N/A", "Run analysis to capture prices", "line-chart", "text-slate-300"),
      positionSummaryCard("Unrealized P/L", "N/A", "Waiting for market values", "activity", "text-slate-300"),
    ].join("");
    els.positionsList.innerHTML = `
      <div class="p-8 text-center text-sm text-slate-500">
        ${icon("briefcase-business", "mx-auto mb-3 h-6 w-6 text-slate-600")}
        No positions tracked yet. Add holdings from Financial Settings or plan a buy trade from a recommendation.
      </div>
    `;
    refreshIcons();
    return;
  }

  const rows = positions.map(positionViewModel);
  const costBasis = rows.reduce((sum, row) => sum + row.costBasis, 0);
  const marketKnown = rows.filter((row) => row.marketValue !== null);
  const marketValue = marketKnown.reduce((sum, row) => sum + row.marketValue, 0);
  const gainLoss = marketKnown.length ? marketValue - marketKnown.reduce((sum, row) => sum + row.costBasis, 0) : null;
  const gainLossPct = gainLoss !== null && costBasis > 0 ? gainLoss / costBasis : null;

  els.positionsSummary.innerHTML = [
    positionSummaryCard("Tracked Cost", money(costBasis), `${positions.length} holdings`, "briefcase-business", "text-cyan-300"),
    positionSummaryCard("Market Value", marketKnown.length ? money(marketValue) : "N/A", marketKnown.length ? `${marketKnown.length} priced from history` : "Run analysis to capture prices", "line-chart", "text-emerald-300"),
    positionSummaryCard("Unrealized P/L", gainLoss === null ? "N/A" : money(gainLoss), gainLossPct === null ? "Waiting for prices" : compactPercent(gainLossPct), gainLoss === null || gainLoss >= 0 ? "trending-up" : "trending-down", gainLoss === null ? "text-slate-300" : gainLoss >= 0 ? "text-emerald-300" : "text-rose-300"),
  ].join("");

  els.positionsList.innerHTML = rows.map(renderPositionRow).join("");
  els.positionsList.querySelectorAll(".position-analyze").forEach((button) => {
    button.addEventListener("click", async () => {
      setActiveView("dashboard");
      await createAnalysis([button.dataset.ticker]);
    });
  });
  els.positionsList.querySelectorAll(".position-remove").forEach((button) => {
    button.addEventListener("click", () => removePortfolioPosition(button.dataset.ticker));
  });
  refreshIcons();
}

function positionSummaryCard(title, value, meta, iconName, accent) {
  return `
    <article class="rounded-md border border-slate-800 bg-slate-950/50 p-3">
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs text-slate-500">${escapeHtml(title)}</span>
        ${icon(iconName, `h-4 w-4 ${accent}`)}
      </div>
      <p class="mt-2 text-xl font-semibold text-white">${escapeHtml(value)}</p>
      <p class="mt-1 text-xs text-slate-500">${escapeHtml(meta)}</p>
    </article>
  `;
}

function positionViewModel(position) {
  const market = latestMarketForPosition(position.ticker);
  const latestPrice = Number(market?.current_price);
  const hasPrice = Number.isFinite(latestPrice) && latestPrice > 0;
  const costBasis = position.shares * position.averageCost;
  const marketValue = hasPrice ? position.shares * latestPrice : null;
  const gainLoss = marketValue !== null ? marketValue - costBasis : null;
  const gainLossPct = gainLoss !== null && costBasis > 0 ? gainLoss / costBasis : null;
  return {
    ...position,
    costBasis,
    latestPrice: hasPrice ? latestPrice : null,
    marketValue,
    gainLoss,
    gainLossPct,
    latestRating: market?.rating || null,
    latestReason: market?.reason || "",
    lastAnalyzed: market?.report_time || market?.created_at || null,
  };
}

function renderPositionRow(row) {
  const totalBasis = calculateInvested(portfolioState);
  const allocation = totalBasis > 0 ? row.costBasis / totalBasis : 0;
  const gainClass = row.gainLoss === null || row.gainLoss === 0 ? "text-slate-200" : row.gainLoss > 0 ? "text-emerald-300" : "text-rose-300";
  return `
    <article class="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_260px_220px_auto] lg:items-center">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <a href="https://finance.yahoo.com/quote/${encodeURIComponent(row.ticker)}" target="_blank" class="text-base font-semibold text-cyan-200 hover:text-cyan-100">${escapeHtml(row.ticker)}</a>
          ${row.latestRating ? ratingBadge(row.latestRating) : `<span class="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-300">not analyzed</span>`}
        </div>
        <p class="mt-1 text-xs text-slate-500">${escapeHtml(row.latestReason ? shortReason(row.latestReason) : "No recommendation history captured yet.")}</p>
        <p class="mt-2 text-xs text-slate-600">${row.lastAnalyzed ? `Last analyzed ${formatDateTime(row.lastAnalyzed)}` : "Analyze this position to capture latest market context."}</p>
      </div>
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="rounded-md bg-slate-950/60 p-2"><span class="block text-slate-500">Shares</span>${row.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
        <div class="rounded-md bg-slate-950/60 p-2"><span class="block text-slate-500">Avg Cost</span>${escapeHtml(money(row.averageCost))}</div>
        <div class="rounded-md bg-slate-950/60 p-2"><span class="block text-slate-500">Cost Basis</span>${escapeHtml(money(row.costBasis))}</div>
        <div class="rounded-md bg-slate-950/60 p-2"><span class="block text-slate-500">Allocation</span>${escapeHtml(compactPercent(allocation))}</div>
      </div>
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="rounded-md bg-slate-950/60 p-2"><span class="block text-slate-500">Latest Price</span>${escapeHtml(row.latestPrice === null ? "N/A" : money(row.latestPrice))}</div>
        <div class="rounded-md bg-slate-950/60 p-2"><span class="block text-slate-500">Market Value</span>${escapeHtml(row.marketValue === null ? "N/A" : money(row.marketValue))}</div>
        <div class="col-span-2 rounded-md bg-slate-950/60 p-2"><span class="block text-slate-500">Unrealized P/L</span><span class="${gainClass}">${escapeHtml(row.gainLoss === null ? "N/A" : `${money(row.gainLoss)} (${compactPercent(row.gainLossPct)})`)}</span></div>
      </div>
      <div class="flex flex-wrap justify-start gap-2 lg:justify-end">
        <button data-ticker="${escapeHtml(row.ticker)}" class="position-analyze inline-flex items-center gap-2 rounded-md bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400">
          ${icon("activity", "h-4 w-4")}
          Analyze
        </button>
        <button data-ticker="${escapeHtml(row.ticker)}" class="position-remove inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 text-slate-300 hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200" title="Remove position">
          ${icon("trash-2", "h-4 w-4")}
        </button>
      </div>
    </article>
  `;
}

function findPortfolioPosition(ticker) {
  const normalizedTicker = normalizeTicker(ticker);
  return portfolioPositions().find((position) => position.ticker === normalizedTicker) || null;
}

function upsertPortfolioPosition(position) {
  const normalized = normalizePosition(position);
  if (!normalized) return false;
  const positions = portfolioPositions().filter((item) => item.ticker !== normalized.ticker);
  positions.push(normalized);
  positions.sort((a, b) => a.ticker.localeCompare(b.ticker));
  portfolioState = normalizePortfolio({ ...portfolioState, positions });
  savePortfolioState(portfolioState);
  updatePortfolioUI(portfolioState);
  return true;
}

function removePortfolioPosition(ticker) {
  const normalizedTicker = normalizeTicker(ticker);
  portfolioState = normalizePortfolio({
    ...portfolioState,
    positions: portfolioPositions().filter((position) => position.ticker !== normalizedTicker),
  });
  savePortfolioState(portfolioState);
  updatePortfolioUI(portfolioState);
}

function addPositionFromTrade(trade) {
  const ticker = normalizeTicker(trade?.ticker);
  const shares = Number(trade?.shares || 0);
  const price = Number(trade?.price || 0);
  if (!ticker || shares <= 0 || price < 0) return;
  const existing = findPortfolioPosition(ticker);
  const existingShares = Number(existing?.shares || 0);
  const totalShares = existingShares + shares;
  const existingCost = existingShares * Number(existing?.averageCost || 0);
  const newCost = shares * price;
  const averageCost = totalShares > 0 ? (existingCost + newCost) / totalShares : price;
  upsertPortfolioPosition({ ticker, shares: totalShares, averageCost });
}

function renderHoldings(portfolio) {
  if (!els.holdingsList) return;
  const positions = portfolioPositions(portfolio);
  if (!positions.length) {
    els.holdingsList.innerHTML = `
      <div class="rounded-md border border-slate-800 bg-slate-950/50 p-3 text-sm text-slate-500">
        No existing holdings tracked yet.
      </div>
    `;
    return;
  }

  els.holdingsList.innerHTML = positions
    .map((position) => {
      const costBasis = position.shares * position.averageCost;
      return `
        <article class="min-w-0 rounded-md border border-slate-800 bg-slate-950/50 p-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="font-semibold text-white">${escapeHtml(position.ticker)}</div>
              <div class="mt-1 text-xs text-slate-500">${position.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares at ${escapeHtml(money(position.averageCost))}</div>
            </div>
            <div class="flex items-center gap-3">
              <div class="text-right text-xs">
                <span class="block text-slate-500">Cost Basis</span>
                <span class="font-semibold text-slate-200">${escapeHtml(money(costBasis))}</span>
              </div>
              <button data-ticker="${escapeHtml(position.ticker)}" class="remove-holding inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-red-950/40 hover:text-red-200" title="Remove holding">
                ${icon("trash-2", "h-4 w-4")}
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  els.holdingsList.querySelectorAll(".remove-holding").forEach((button) => {
    button.addEventListener("click", () => removePortfolioPosition(button.dataset.ticker));
  });
  refreshIcons();
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
  const res = await apiFetch("/analyses");
  if (!res.ok) throw new Error("Unable to fetch analyses");
  return res.json();
}

async function fetchCandidates(options = {}) {
  const discover = Boolean(options.discover);
  const res = await apiFetch(`/candidates${discover ? "?discover=true" : ""}`);
  if (!res.ok) throw new Error("Unable to fetch candidates");
  const candidates = await res.json();
  if (discover) markCandidateDiscovery();
  return candidates;
}

async function fetchAgentConfig() {
  const res = await apiFetch("/agent-config");
  if (!res.ok) throw new Error("Unable to fetch agent config");
  return res.json();
}

async function fetchUsers() {
  const res = await apiFetch("/users");
  if (!res.ok) throw new Error("Unable to fetch users");
  return res.json();
}

async function loadUsers() {
  if (!els.usersList || currentUser?.role !== "admin") return;
  els.usersList.innerHTML = `<p class="text-sm text-slate-500">Loading users...</p>`;
  try {
    const users = await fetchUsers();
    renderUsers(users);
  } catch (e) {
    els.usersList.innerHTML = `<p class="text-sm text-red-300">Unable to load users.</p>`;
  }
}

function renderUsers(users) {
  if (!els.usersList) return;
  if (!users.length) {
    els.usersList.innerHTML = `<p class="text-sm text-slate-500">No users found.</p>`;
    return;
  }
  els.usersList.innerHTML = users
    .map((user) => `
      <article class="rounded-md border border-slate-800 bg-slate-950/50 p-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="font-semibold text-white">${escapeHtml(user.display_name || user.username)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(user.username)}</div>
          </div>
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span class="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 font-semibold text-cyan-200">${escapeHtml(user.role)}</span>
            <span class="text-slate-500">${user.is_active ? "Active" : "Inactive"}</span>
          </div>
        </div>
      </article>
    `)
    .join("");
}

async function createUser(event) {
  event.preventDefault();
  const payload = {
    username: els.newUserUsername?.value || "",
    display_name: els.newUserDisplayName?.value || "",
    password: els.newUserPassword?.value || "",
    role: els.newUserRole?.value || "user",
  };
  try {
    const res = await apiFetch("/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || "Create user failed");
    }
    if (els.newUserUsername) els.newUserUsername.value = "";
    if (els.newUserDisplayName) els.newUserDisplayName.value = "";
    if (els.newUserPassword) els.newUserPassword.value = "";
    if (els.newUserRole) els.newUserRole.value = "user";
    showToast("User created.", "success");
    await loadUsers();
  } catch (e) {
    showToast(e.message || "Could not create user.", "error");
  }
}

function agentTaskKey(agentKey) {
  const explicit = {
    capex_researcher: "capex_task",
    pricing_analyst: "pricing_task",
    rotation_analyst: "rotation_task",
    recommendation_strategist: "recommendation_task",
  };
  return explicit[agentKey] || agentKey.replace(/_(researcher|analyst|strategist|agent)$/, "_task");
}

function agentDisplayName(key) {
  return String(key || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function loadAgentConfig() {
  if (!els.agentConfigEditor) return;
  els.agentConfigEditor.innerHTML = `
    <div class="panel rounded-lg p-5 text-sm text-slate-500">
      Loading agent configuration...
    </div>
  `;
  try {
    agentConfigState = await fetchAgentConfig();
    selectedAgentKey = selectedAgentKey || Object.keys(agentConfigState.agents || {})[0] || null;
    renderAgentConfigUI();
  } catch (e) {
    els.agentConfigEditor.innerHTML = `
      <div class="panel rounded-lg p-5 text-sm text-red-300">
        Unable to load agent configuration.
      </div>
    `;
    showToast("Could not load agent settings.", "error");
  }
}

function renderAgentConfigUI() {
  renderAgentConfigList();
  renderSelectedAgentEditor();
  if (els.agentLlmModel) els.agentLlmModel.value = agentConfigState.llm?.model || "gpt-4o";
  if (els.agentLlmTemperature) els.agentLlmTemperature.value = Number(agentConfigState.llm?.temperature ?? 0.3).toFixed(1);
  if (els.agentLlmApiKey) els.agentLlmApiKey.value = "";
  if (els.agentLlmKeyStatus) {
    const source = agentConfigState.llm?.api_key_source || "missing";
    const configured = Boolean(agentConfigState.llm?.api_key_configured);
    const label = configured
      ? `API key configured from ${source === "settings" ? "Agent Settings override" : ".env file"}.`
      : "No API key configured. Add one here or set OPENAI_API_KEY in .env.";
    els.agentLlmKeyStatus.textContent = label;
    els.agentLlmKeyStatus.className = configured ? "text-xs text-emerald-300" : "text-xs text-amber-300";
  }
  refreshIcons();
}

function renderAgentConfigList() {
  if (!els.agentConfigList) return;
  const agentKeys = Object.keys(agentConfigState.agents || {});
  if (!agentKeys.length) {
    els.agentConfigList.innerHTML = `<p class="text-sm text-slate-500">No agents configured.</p>`;
    return;
  }
  els.agentConfigList.innerHTML = agentKeys
    .map((key) => {
      const agent = agentConfigState.agents[key] || {};
      const active = key === selectedAgentKey;
      return `
        <button data-agent-key="${escapeHtml(key)}" class="agent-config-tab w-full rounded-md border px-3 py-2 text-left text-sm ${active ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100" : "border-slate-800 bg-slate-950/50 text-slate-300 hover:bg-slate-900"}">
          <span class="block font-semibold">${escapeHtml(agent.role || agentDisplayName(key))}</span>
          <span class="mt-1 block truncate text-xs text-slate-500">${escapeHtml(key)}</span>
        </button>
      `;
    })
    .join("");
  els.agentConfigList.querySelectorAll(".agent-config-tab").forEach((button) => {
    button.addEventListener("click", () => {
      persistSelectedAgentEditor();
      selectedAgentKey = button.dataset.agentKey;
      renderAgentConfigUI();
    });
  });
}

function renderSelectedAgentEditor() {
  if (!els.agentConfigEditor) return;
  if (!selectedAgentKey) {
    els.agentConfigEditor.innerHTML = `
      <div class="panel rounded-lg p-5 text-sm text-slate-500">
        Select an agent to edit.
      </div>
    `;
    return;
  }
  const agent = agentConfigState.agents[selectedAgentKey] || {};
  const taskKey = agentTaskKey(selectedAgentKey);
  const task = agentConfigState.tasks?.[taskKey] || {};
  els.agentConfigEditor.innerHTML = `
    <section class="panel rounded-lg p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-base font-semibold text-white">${escapeHtml(agent.role || agentDisplayName(selectedAgentKey))}</h3>
          <p class="mt-1 text-xs text-slate-500">${escapeHtml(selectedAgentKey)} / ${escapeHtml(taskKey)}</p>
        </div>
        <label class="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
          <input id="agent-verbose" type="checkbox" class="h-4 w-4 accent-cyan-400" ${agent.verbose ? "checked" : ""} />
          Verbose
        </label>
      </div>
      <div class="mt-4 grid grid-cols-1 gap-3">
        <label class="block">
          <span class="text-xs text-slate-400">Role</span>
          <input id="agent-role" type="text" value="${escapeHtml(agent.role || "")}" class="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400" />
        </label>
        <label class="block">
          <span class="text-xs text-slate-400">Goal Prompt</span>
          <textarea id="agent-goal" rows="5" class="mt-1 w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm leading-6 text-white outline-none focus:border-cyan-400">${escapeHtml(agent.goal || "")}</textarea>
        </label>
        <label class="block">
          <span class="text-xs text-slate-400">Backstory / Behavior</span>
          <textarea id="agent-backstory" rows="4" class="mt-1 w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm leading-6 text-white outline-none focus:border-cyan-400">${escapeHtml(agent.backstory || "")}</textarea>
        </label>
      </div>
    </section>
    <section class="panel rounded-lg p-4">
      <h3 class="text-base font-semibold text-white">Task Prompt</h3>
      <div class="mt-4 grid grid-cols-1 gap-3">
        <label class="block">
          <span class="text-xs text-slate-400">Description</span>
          <textarea id="task-description" rows="10" class="mt-1 w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm leading-6 text-white outline-none focus:border-cyan-400">${escapeHtml(task.description || "")}</textarea>
        </label>
        <label class="block">
          <span class="text-xs text-slate-400">Expected Output</span>
          <textarea id="task-expected-output" rows="5" class="mt-1 w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm leading-6 text-white outline-none focus:border-cyan-400">${escapeHtml(task.expected_output || "")}</textarea>
        </label>
      </div>
    </section>
  `;
}

function persistSelectedAgentEditor() {
  if (!selectedAgentKey || !els.agentConfigEditor || !document.getElementById("agent-role")) return;
  const taskKey = agentTaskKey(selectedAgentKey);
  agentConfigState.agents[selectedAgentKey] = {
    ...(agentConfigState.agents[selectedAgentKey] || {}),
    role: document.getElementById("agent-role").value,
    goal: document.getElementById("agent-goal").value,
    backstory: document.getElementById("agent-backstory").value,
    allow_delegation: Boolean(agentConfigState.agents[selectedAgentKey]?.allow_delegation),
    verbose: document.getElementById("agent-verbose").checked,
  };
  agentConfigState.tasks[taskKey] = {
    ...(agentConfigState.tasks[taskKey] || {}),
    description: document.getElementById("task-description").value,
    expected_output: document.getElementById("task-expected-output").value,
  };
}

async function saveAgentConfig() {
  persistSelectedAgentEditor();
  agentConfigState.llm = {
    model: els.agentLlmModel?.value || "gpt-4o",
    temperature: clampNumber(els.agentLlmTemperature?.value, 0, 2, 0.3),
  };
  const apiKey = String(els.agentLlmApiKey?.value || "").trim();
  if (apiKey) {
    agentConfigState.llm.api_key = apiKey;
  }
  setButtonLoading(els.saveAgentConfig, true, "Saving");
  try {
    const res = await apiFetch("/agent-config", {
      method: "PUT",
      body: JSON.stringify(agentConfigState),
    });
    if (!res.ok) throw new Error("Save failed");
    const saved = await res.json();
    agentConfigState.llm = saved.llm || agentConfigState.llm;
    renderAgentConfigUI();
    showToast("Agent settings saved. New analysis runs will use them.", "success");
  } catch (e) {
    showToast("Could not save agent settings.", "error");
  } finally {
    setButtonLoading(els.saveAgentConfig, false);
  }
}

async function refresh(options = {}) {
  if (!isAuthenticated()) return [];
  try {
    if (options.spinRefresh) setButtonLoading(els.refreshBtn, true);
    if (options.spinCandidates) setButtonLoading(els.refreshCandidates, true, "Refreshing");
    const discoverCandidates = shouldDiscoverCandidates(Boolean(options.discoverCandidates));
    const [analyses, candidates] = await Promise.all([fetchAnalyses(), fetchCandidates({ discover: discoverCandidates })]);
    analysesCache = analyses;
    candidateUniverseCache = Array.isArray(candidates) ? candidates : [];
    renderStats(analyses);
    renderAnalyses(analyses);
    renderAnalysisHistory(analyses);
    renderCandidateUniverse(candidates);
    els.lastRefresh.textContent = `Updated ${formatDateTime(new Date())}`;
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
    if (options.spinCandidates) setButtonLoading(els.refreshCandidates, false);
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
  const completedRuns = analyses.filter((analysis) => analysis.status === "completed");
  const latestCompleted = [...completedRuns].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  const latestCounts = recommendationActionCounts(latestCompleted?.recommendation || "");
  const running = analyses.filter((analysis) => analysis.status === "running").length;
  const failed = analyses.filter((analysis) => analysis.status === "failed").length;
  const trendRuns = completedRuns
    .filter((analysis) => analysis.recommendation)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(-8);
  const actionCards = [
    { title: "Buy Actions", value: latestCounts.buy, meta: latestCounts.buy ? "Candidates to review for entry" : "No new buys in latest run", icon: "shopping-cart", tone: "border-emerald-400/25 bg-emerald-950/20 text-emerald-200" },
    { title: "Sell / Exit", value: latestCounts.sell, meta: latestCounts.sell ? "Positions needing exit review" : "No active sell actions", icon: "badge-alert", tone: "border-red-400/25 bg-red-950/20 text-red-200" },
    { title: "Hold / Watch", value: latestCounts.hold + latestCounts.neutral, meta: `${latestCounts.hold} hold, ${latestCounts.neutral} neutral`, icon: "eye", tone: "border-amber-400/25 bg-amber-950/20 text-amber-200" },
  ];

  els.statsContainer.innerHTML = `
    <section class="col-span-full grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        ${actionCards.map(renderActionStatCard).join("")}
      </div>
      <article class="panel rounded-lg p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 class="text-sm font-semibold text-white">Market Action Trend</h3>
            <p class="mt-1 text-xs text-slate-500">${trendRuns.length ? "Recommendation mix across recent completed analyses, colored by saved risk tolerance." : "Run more analyses to build the trend."}</p>
          </div>
          <div class="flex items-center gap-3 text-[11px] text-slate-400">
            <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-emerald-300"></span>Buy</span>
            <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-red-300"></span>Sell</span>
            <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-amber-300"></span>Hold</span>
            <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full border border-cyan-300"></span>Risk</span>
          </div>
        </div>
        ${renderActionTrendChart(trendRuns)}
        <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-800 pt-3 text-xs text-slate-500">
          <span>${analyses.length} total runs</span>
          <span>${running} running</span>
          <span>${completedRuns.length} completed</span>
          <span>${failed} failed</span>
        </div>
      </article>
    </section>
  `;
  refreshIcons();
}

function renderActionStatCard(card) {
  return `
    <article class="panel rounded-lg p-4">
      <div class="flex items-start justify-between gap-3">
        <span class="text-sm text-slate-400">${escapeHtml(card.title)}</span>
        <span class="rounded-md border p-2 ${card.tone}">${icon(card.icon, "h-4 w-4")}</span>
      </div>
      <div class="mt-5">
        <p class="text-4xl font-semibold text-white">${card.value}</p>
        <p class="mt-2 text-xs leading-5 text-slate-500">${escapeHtml(card.meta)}</p>
      </div>
    </article>
  `;
}

function recommendationActionCounts(recommendation) {
  const counts = { buy: 0, sell: 0, hold: 0, neutral: 0 };
  String(recommendation || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const rating = String(item.split(":")[1] || item).trim().toLowerCase();
      if (rating.includes("buy")) counts.buy += 1;
      else if (rating.includes("sell")) counts.sell += 1;
      else if (rating.includes("hold")) counts.hold += 1;
      else counts.neutral += 1;
    });
  return counts;
}

function renderActionTrendChart(runs) {
  if (!runs.length) {
    return `
      <div class="mt-4 flex h-36 items-center justify-center rounded-md border border-slate-800 bg-slate-950/40 text-sm text-slate-500">
        No completed recommendation history yet.
      </div>
    `;
  }
  const points = runs.map((analysis) => ({
    label: formatDateTime(analysis.created_at),
    risk: analysis.risk_tolerance || analysisRiskSettings(analysis).riskTolerance,
    riskDial: analysis.risk_tolerance_dial ?? analysisRiskSettings(analysis).riskToleranceDial,
    counts: recommendationActionCounts(analysis.recommendation),
  }));
  const maxCount = Math.max(1, ...points.map((point) => point.counts.buy + point.counts.sell + point.counts.hold + point.counts.neutral));
  const width = 420;
  const height = 150;
  const chartTop = 18;
  const chartBottom = 122;
  const barWidth = Math.min(30, Math.max(16, Math.floor(250 / points.length)));
  const gap = points.length > 1 ? (width - 56 - barWidth * points.length) / (points.length - 1) : 0;
  const barGroups = points.map((point, index) => renderActionTrendBar(point, index, { barWidth, chartTop, chartBottom, gap, maxCount })).join("");
  return `
    <div class="mt-4 overflow-hidden rounded-md border border-slate-800 bg-slate-950/40 p-2">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Historical recommendation action mix" class="h-40 w-full">
        <line x1="20" y1="${chartBottom}" x2="${width - 18}" y2="${chartBottom}" stroke="#334155" stroke-width="1" />
        <line x1="20" y1="${chartTop}" x2="${width - 18}" y2="${chartTop}" stroke="#1e293b" stroke-width="1" stroke-dasharray="4 4" />
        ${barGroups}
      </svg>
    </div>
  `;
}

function renderActionTrendBar(point, index, options) {
  const { barWidth, chartTop, chartBottom, gap, maxCount } = options;
  const x = 28 + index * (barWidth + gap);
  const scale = (chartBottom - chartTop) / maxCount;
  const neutralHeight = point.counts.neutral * scale;
  const holdHeight = point.counts.hold * scale;
  const sellHeight = point.counts.sell * scale;
  const buyHeight = point.counts.buy * scale;
  let y = chartBottom;
  const neutralRect = svgRect(x, y - neutralHeight, barWidth, neutralHeight, "#64748b", 0.35);
  y -= neutralHeight;
  const holdRect = svgRect(x, y - holdHeight, barWidth, holdHeight, "#fbbf24", 0.82);
  y -= holdHeight;
  const sellRect = svgRect(x, y - sellHeight, barWidth, sellHeight, "#f87171", 0.86);
  y -= sellHeight;
  const buyRect = svgRect(x, y - buyHeight, barWidth, buyHeight, "#34d399", 0.9);
  const total = point.counts.buy + point.counts.sell + point.counts.hold + point.counts.neutral;
  const riskColor = riskToleranceColor(point.risk);
  return `
    <g>
      <title>${escapeHtml(point.label)}: ${point.counts.buy} buy, ${point.counts.sell} sell, ${point.counts.hold} hold, ${point.counts.neutral} neutral. Risk tolerance ${escapeHtml(riskToleranceLabel(point.risk))}${point.riskDial !== undefined && point.riskDial !== null ? ` ${escapeHtml(Math.round(Number(point.riskDial)).toString())}` : ""}</title>
      ${neutralRect}${holdRect}${sellRect}${buyRect}
      <circle cx="${(x + barWidth / 2).toFixed(2)}" cy="10" r="4" fill="${riskColor}" />
      <text x="${x + barWidth / 2}" y="142" text-anchor="middle" fill="#64748b" font-size="10">${total}</text>
    </g>
  `;
}

function riskToleranceColor(value) {
  const normalized = String(value || "balanced").toLowerCase();
  if (normalized === "conservative") return "#34d399";
  if (normalized === "aggressive") return "#f59e0b";
  return "#22d3ee";
}

function svgRect(x, y, width, height, color, opacity) {
  if (!Number.isFinite(height) || height <= 0.2) return "";
  return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${width.toFixed(2)}" height="${height.toFixed(2)}" rx="3" fill="${color}" opacity="${opacity}" />`;
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

  const sortedAnalyses = [...analyses].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  sortedAnalyses.slice(0, 5).forEach((analysis) => {
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
  if (sortedAnalyses.length > 5) {
    const historyButton = document.createElement("button");
    historyButton.type = "button";
    historyButton.className = "w-full rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm font-semibold text-cyan-200 hover:border-cyan-400/30 hover:bg-cyan-400/10";
    historyButton.innerHTML = `View all ${sortedAnalyses.length} analyses`;
    historyButton.addEventListener("click", () => setActiveView("history"));
    els.analysesList.appendChild(historyButton);
  }
  refreshIcons();
}

function renderAnalysisHistory(analyses) {
  if (!els.historyList) return;
  const query = String(els.historySearch?.value || "").trim().toLowerCase();
  const statusFilter = els.historyStatusFilter?.value || "all";
  const actionFilter = els.historyActionFilter?.value || "all";
  const sorted = [...(analyses || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const filtered = sorted.filter((analysis) => {
    const status = String(analysis.status || "pending").toLowerCase();
    const counts = recommendationActionCounts(analysis.recommendation || "");
    const searchable = `${analysis.tickers || ""} ${analysis.recommendation || ""} ${status}`.toLowerCase();
    const matchesQuery = !query || searchable.includes(query);
    const matchesStatus = statusFilter === "all" || status === statusFilter;
    const matchesAction = actionFilter === "all" || counts[actionFilter] > 0;
    return matchesQuery && matchesStatus && matchesAction;
  });

  if (!filtered.length) {
    els.historyList.innerHTML = `
      <div class="p-8 text-center text-sm text-slate-500">
        ${icon("search-x", "mx-auto mb-3 h-6 w-6 text-slate-600")}
        No analyses match the current filters.
      </div>
    `;
    refreshIcons();
    return;
  }

  els.historyList.innerHTML = filtered.map(renderAnalysisHistoryRow).join("");
  els.historyList.querySelectorAll(".history-open-analysis").forEach((button) => {
    button.addEventListener("click", () => selectAnalysis(button.dataset.id));
  });
  els.historyList.querySelectorAll(".history-delete-analysis").forEach((button) => {
    button.addEventListener("click", () => deleteAnalysis(button.dataset.id));
  });
  refreshIcons();
}

function renderAnalysisHistoryRow(analysis) {
  const counts = recommendationActionCounts(analysis.recommendation || "");
  const selected = analysis.id === selectedAnalysisId;
  return `
    <article class="grid gap-3 px-4 py-4 transition ${selected ? "bg-cyan-400/5" : "hover:bg-slate-900/40"} lg:grid-cols-[minmax(0,1.3fr)_180px_220px_auto] lg:items-center">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h4 class="truncate text-sm font-semibold text-white">${escapeHtml(analysis.tickers || "Untitled analysis")}</h4>
          ${statusBadge(analysis.status)}
        </div>
        <p class="mt-1 text-xs text-slate-500">${formatDateTime(analysis.created_at)} · ${timeAgo(analysis.created_at)}</p>
        ${renderHistoryRiskPill(analysis)}
        <p class="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">${escapeHtml(analysis.recommendation || "Pending recommendation")}</p>
      </div>
      <div class="grid grid-cols-4 gap-2 text-center text-xs">
        ${historyCountPill("Buy", counts.buy, "text-emerald-200 border-emerald-400/20 bg-emerald-400/10")}
        ${historyCountPill("Sell", counts.sell, "text-red-200 border-red-400/20 bg-red-400/10")}
        ${historyCountPill("Hold", counts.hold, "text-amber-200 border-amber-400/20 bg-amber-400/10")}
        ${historyCountPill("Neutral", counts.neutral, "text-slate-200 border-slate-400/20 bg-slate-400/10")}
      </div>
      <div class="text-xs text-slate-500">
        <div>${escapeHtml((analysis.id || "").slice(0, 8))}</div>
        <div class="mt-1">${escapeHtml(analysis.updated_at ? `Updated ${formatDateTime(analysis.updated_at)}` : "No update time")}</div>
      </div>
      <div class="flex flex-wrap justify-start gap-2 lg:justify-end">
        <button data-id="${escapeHtml(analysis.id)}" class="history-open-analysis inline-flex items-center gap-2 rounded-md bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400">
          ${icon("file-search", "h-4 w-4")}
          Open
        </button>
        <button data-id="${escapeHtml(analysis.id)}" class="history-delete-analysis inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 text-slate-300 hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200" title="Delete analysis">
          ${icon("trash-2", "h-4 w-4")}
        </button>
      </div>
    </article>
  `;
}

function renderHistoryRiskPill(analysis) {
  const settings = analysisRiskSettings(analysis);
  const risk = analysis.risk_tolerance || settings.riskTolerance;
  if (!risk) return "";
  const dial = analysis.risk_tolerance_dial ?? settings.riskToleranceDial;
  return `
    <span class="mt-2 inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/70 px-2 py-0.5 text-[11px] text-slate-300">
      <span class="h-2 w-2 rounded-full" style="background:${riskToleranceColor(risk)}"></span>
      ${escapeHtml(riskToleranceLabel(risk))}${dial !== undefined && dial !== null ? ` ${escapeHtml(Math.round(Number(dial)).toString())}` : ""}
    </span>
  `;
}

function historyCountPill(label, value, classes) {
  return `
    <div class="rounded-md border px-2 py-1 ${classes}">
      <span class="block font-semibold">${value}</span>
      <span class="text-[10px] opacity-80">${label}</span>
    </div>
  `;
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
  if (activeView === "history") setActiveView("dashboard");
  const analysis = analysesCache.find((item) => item.id === id);
  if (analysis) updateSelectedStatus(analysis);
  renderAnalyses(analysesCache);
  renderAnalysisHistory(analysesCache);
  setReportLoading("Loading report...");
  els.logsConsole.innerHTML = "";

  if (currentSocket) {
    currentSocket.close();
    currentSocket = null;
  }

  try {
    const logsRes = await apiFetch(`/analyses/${id}/logs`);
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
  if (!isAuthenticated()) return;
  const wsBase = API_BASE.replace(/^http/, "ws");
  const socket = new WebSocket(`${wsBase}/ws/${id}?token=${encodeURIComponent(authToken())}`);
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
  const res = await apiFetch(`/analyses/${analysisId}`);
  if (!res.ok) throw new Error("Unable to fetch analysis");
  const analysis = await res.json();
  updateSelectedStatus(analysis);

  let summaryText = analysis.summary || "";
  let recs = [];
  const parsedReport = parseReportPayload(summaryText);
  if (parsedReport) {
    summaryText = parsedReport.summary || stripJsonFromReport(summaryText);
    recs = Array.isArray(parsedReport.recommendations) ? parsedReport.recommendations : [];
  }
  analysis.analysis_settings = analysis.analysis_settings || parsedReport?.analysis_settings || {};
  if (!recs.length && analysis.recommendation) {
    recs = analysis.recommendation.split(",").map((item) => {
      const parts = item.trim().split(":");
      return { ticker: parts[0]?.trim(), rating: parts[1]?.trim(), reason: "" };
    });
  }
  recs = ensureRequestedTickerCards(recs, analysis);

  els.reportSummary.innerHTML = summaryText
    ? `${renderAnalysisPreferenceSnapshot(analysis)}<p class="mt-3 whitespace-pre-wrap">${escapeHtml(summaryText)}</p>`
    : `<p class="text-slate-500">${analysis.status === "running" ? "Report is being prepared." : "No summary available."}</p>`;
  renderRecommendations(recs);
  await refresh();
}

function ensureRequestedTickerCards(recs, analysis) {
  const rows = Array.isArray(recs) ? recs.filter(Boolean) : [];
  const existing = new Set(rows.map((rec) => normalizeTicker(rec.ticker)).filter(Boolean));
  const requested = String(analysis?.tickers || "")
    .split(",")
    .map(normalizeTicker)
    .filter(Boolean);

  requested.forEach((ticker) => {
    if (existing.has(ticker)) return;
    const position = findPortfolioPosition(ticker);
    rows.push({
      ticker,
      rating: "neutral",
      reason: position
        ? "This stock is tracked in your portfolio, but the analysis output did not include a dedicated recommendation for it. Review it as a monitored holding and rerun holdings analysis for a fresh signal."
        : "This ticker was included in the analysis request, but no dedicated recommendation was returned.",
      report_time: analysis?.updated_at || analysis?.created_at,
      evidence: position ? [{ type: "portfolio_holding", signal: "Tracked holding included in the analysis request." }] : [],
      risks: position ? [{ type: "missing_model_card", signal: "No dedicated model recommendation was returned for this owned position." }] : [],
    });
    existing.add(ticker);
  });

  return rows;
}

function analysisRiskSettings(analysis) {
  return analysis?.analysis_settings || {};
}

function riskToleranceLabel(value) {
  const normalized = String(value || "balanced").toLowerCase();
  if (normalized === "conservative") return "Conservative";
  if (normalized === "aggressive") return "Aggressive";
  return "Balanced";
}

function renderAnalysisPreferenceSnapshot(analysis) {
  const settings = analysisRiskSettings(analysis);
  const risk = settings.riskTolerance || analysis?.risk_tolerance;
  if (!risk) return "";
  const dial = settings.riskToleranceDial ?? analysis?.risk_tolerance_dial;
  return `
    <div class="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
      ${icon("sliders-horizontal", "h-4 w-4")}
      <span class="font-semibold">Risk tolerance: ${escapeHtml(riskToleranceLabel(risk))}${dial !== undefined && dial !== null ? ` (${escapeHtml(Math.round(Number(dial)).toString())})` : ""}</span>
      ${settings.minOpportunityScore !== undefined ? `<span class="text-cyan-200/80">Buy threshold ${escapeHtml(Number(settings.minOpportunityScore).toFixed(0))}</span>` : ""}
      ${settings.minValuationScore !== undefined ? `<span class="text-cyan-200/80">Value threshold ${escapeHtml(Number(settings.minValuationScore).toFixed(0))}</span>` : ""}
    </div>
  `;
}

function parseReportPayload(text) {
  const candidates = extractJsonCandidates(text);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.recommendations)) {
        return parsed;
      }
    } catch (e) {
      // Try the next candidate.
    }
  }
  return null;
}

function extractJsonCandidates(text) {
  const value = String(text || "").trim();
  const candidates = [];
  const fenced = [...value.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((match) => match[1].trim());
  candidates.push(...fenced);
  if (value.startsWith("{")) candidates.push(value);

  const firstBrace = value.indexOf("{");
  if (firstBrace >= 0) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = firstBrace; i < value.length; i += 1) {
      const char = value[i];
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }
      if (char === '"') {
        inString = true;
      } else if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          candidates.push(value.slice(firstBrace, i + 1));
          break;
        }
      }
    }
  }
  return [...new Set(candidates.filter(Boolean))];
}

function stripJsonFromReport(text) {
  const value = String(text || "");
  return value
    .replace(/```(?:json)?\s*[\s\S]*?```/gi, "")
    .replace(/### Recommendations\s*$/i, "")
    .trim();
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
    { key: "exit", title: "Exit Risk", description: "Hold/sell signals for stocks you own or positions with prior buy history.", rows: [] },
    { key: "caution", title: "Caution", description: "Warning flags on monitored candidates that are not current exit actions.", rows: [] },
    { key: "watchlist", title: "Watchlist / Neutral", description: "Evaluated candidates that do not currently meet buy criteria.", rows: [] },
  ];
  const byKey = Object.fromEntries(groups.map((group) => [group.key, group]));

  sortedRecs.forEach((rec, index) => {
    const rating = String(rec.rating || "neutral").toLowerCase();
    const hasRisk = rec.risk_rating || (Array.isArray(rec.risks) && rec.risks.length);
    const isOwned = Boolean(findPortfolioPosition(rec.ticker));
    if (rating === "buy") {
      byKey.buy.rows.push({ rec, index });
    } else if (rating === "sell" || rating === "hold" || (isOwned && hasRisk)) {
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
  const opportunityStyles = signalStylesForScore(Number(rec.score), { good: Number(analysisSettings.minOpportunityScore || 70), weak: 45 }, "Opportunity");
  const confidenceStyles = signalStylesForScore(Number(rec.confidence), { good: 0.75, weak: 0.45 }, "Confidence");
  const riskStyles = risks.length || rec.risk_rating ? signalToneStyles("bad", "Risk present", "octagon-alert") : signalToneStyles("good", "No major risk", "shield-check");
  const isBuy = String(rec.rating || "").toLowerCase() === "buy";
  const heldPosition = findPortfolioPosition(rec.ticker);

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
                ${heldPosition ? `<span class="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-200">Owned</span>` : ""}
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
          ${renderPositionContext(rec, heldPosition)}
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

function renderPositionContext(rec, position) {
  if (!position) return "";
  const price = Number(rec.current_price || 0);
  const costBasis = position.shares * position.averageCost;
  const marketValue = price > 0 ? position.shares * price : null;
  const gainLoss = marketValue !== null ? marketValue - costBasis : null;
  const gainLossPct = gainLoss !== null && costBasis > 0 ? gainLoss / costBasis : null;
  const rating = String(rec.rating || "neutral").toLowerCase();
  const hasRisk = rec.risk_rating || (Array.isArray(rec.risks) && rec.risks.length);
  let action = signalToneStyles("neutral", "Monitor position", "eye");
  let message = "This holding is tracked in your portfolio. Use the analysis below to decide whether to hold, add, or trim.";
  if (rating === "sell") {
    action = signalToneStyles("bad", "Review sell signal", "octagon-alert");
    message = "The analysis is flagging an active sell signal for a stock you already own. Review the risk evidence before continuing to hold.";
  } else if (rating === "hold" || hasRisk) {
    action = signalToneStyles("weak", "Hold with caution", "triangle-alert");
    message = "This position has caution signals. It may still be worth holding, but the risk evidence deserves attention.";
  } else if (rating === "buy") {
    action = signalToneStyles("good", "Add candidate", "circle-check");
    message = "You already own this stock and the current analysis still sees constructive opportunity.";
  }

  const gainClass = gainLoss === null || gainLoss === 0 ? "text-slate-200" : gainLoss > 0 ? "text-emerald-300" : "text-rose-300";
  const gainText = gainLoss === null
    ? "N/A"
    : `${money(gainLoss)} (${gainLossPct === null ? "N/A" : compactPercent(gainLossPct)})`;

  return `
    <div class="mt-4 rounded-md border ${action.panel} p-3 text-xs text-slate-300">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="font-semibold text-cyan-200">Portfolio position</div>
        <div class="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${action.badge}">
          ${icon(action.icon, "h-3.5 w-3.5")}
          <span>${escapeHtml(action.label)}</span>
        </div>
      </div>
      <p class="mt-2 leading-5 text-slate-300">${escapeHtml(message)}</p>
      <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div class="rounded-md bg-slate-900/80 p-2"><span class="block text-slate-500">Shares</span>${position.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
        <div class="rounded-md bg-slate-900/80 p-2"><span class="block text-slate-500">Avg Cost</span>${escapeHtml(money(position.averageCost))}</div>
        <div class="rounded-md bg-slate-900/80 p-2"><span class="block text-slate-500">Cost Basis</span>${escapeHtml(money(costBasis))}</div>
        <div class="rounded-md bg-slate-900/80 p-2"><span class="block text-slate-500">Market Value</span>${escapeHtml(marketValue === null ? "N/A" : money(marketValue))}</div>
        <div class="rounded-md bg-slate-900/80 p-2"><span class="block text-slate-500">Unrealized P/L</span><span class="${gainClass}">${escapeHtml(gainText)}</span></div>
      </div>
    </div>
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
  const ownedTickers = portfolioTickers();
  let requestTickers = uniqueTickers([...(tickers || []), ...ownedTickers]);
  setButtonLoading(button, true, label);
  setActionStatus(options.monitor ? "Starting monitor run..." : "Starting analysis...", "info");
  showToast(options.monitor ? "Monitor run requested." : "Analysis requested.", "info");
  setReportLoading("Creating analysis run...");
  els.logsConsole.innerHTML = "";
  appendLog("Analysis request sent. Waiting for backend acknowledgement...");

  try {
    if (options.monitor) {
      let universeTickers = activeCandidateTickers();
      if (!universeTickers.length) {
        const candidates = await fetchCandidates();
        candidateUniverseCache = Array.isArray(candidates) ? candidates : [];
        universeTickers = activeCandidateTickers();
      }
      requestTickers = uniqueTickers([...universeTickers, ...ownedTickers]);
    }
    if (ownedTickers.length && requestTickers.length) {
      appendLog(`Portfolio holdings included: ${ownedTickers.join(", ")}`);
    }
    const res = await apiFetch("/analyses", {
      method: "POST",
      body: JSON.stringify({ tickers: requestTickers, analysis_settings: analysisSettings }),
    });
    if (!res.ok) throw new Error("Analysis request failed");
    const data = await res.json();
    if (!data.analysis_id) throw new Error("Backend did not return an analysis id");

    selectedAnalysisId = data.analysis_id;
    appendLog(`Analysis queued: ${data.analysis_id}`);
    setActionStatus("Analysis queued. Connecting to live logs...", "success");
    showToast("Analysis started.", "success");
    if (options.monitor || !requestTickers.length) {
      markCandidateDiscovery();
    }
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
  const maxSpend = Number(portfolioState.available || 0) * (Number(analysisSettings.positionSizePct || 5) / 100);
  const shares = price > 0 ? Math.floor(maxSpend / price) : 0;
  const stopPrice = price ? price * (1 - Number(analysisSettings.stopLossPct || 10) / 100) : 0;
  const targetPrice = price ? price * (1 + Number(analysisSettings.targetGainPct || 20) / 100) : 0;
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
    const res = await apiFetch(`/history/${ticker}`);
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
    const res = await apiFetch(`/analyses/${id}`, { method: "DELETE" });
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
  if (eventsWired) return;
  eventsWired = true;
  els.loginForm?.addEventListener("submit", handleLogin);
  els.logoutBtn?.addEventListener("click", logout);
  els.dashboardNavBtn?.addEventListener("click", () => setActiveView("dashboard"));
  els.positionsNavBtn?.addEventListener("click", () => setActiveView("positions"));
  els.historyNavBtn?.addEventListener("click", () => setActiveView("history"));
  els.settingsNavBtn?.addEventListener("click", () => setActiveView("settings"));
  els.agentsNavBtn?.addEventListener("click", () => setActiveView("agents"));
  els.usersNavBtn?.addEventListener("click", () => setActiveView("users"));
  if (els.sidebarToggle) {
    els.sidebarToggle.addEventListener("click", toggleSidebar);
  }
  if (els.reportCollapseBtn) {
    els.reportCollapseBtn.addEventListener("click", () => togglePanel("report"));
  }
  if (els.logsCollapseBtn) {
    els.logsCollapseBtn.addEventListener("click", () => togglePanel("logs"));
  }
  els.newAnalysisBtn.addEventListener("click", newAnalysis);
  els.monitorBtn.addEventListener("click", startMonitoring);
  els.refreshBtn.addEventListener("click", () => refresh({ spinRefresh: true }));
  els.refreshCandidates?.addEventListener("click", () => refresh({ discoverCandidates: true, spinCandidates: true }));
  els.reloadAgentConfig?.addEventListener("click", () => loadAgentConfig());
  els.saveAgentConfig?.addEventListener("click", saveAgentConfig);
  els.refreshUsers?.addEventListener("click", loadUsers);
  els.userCreateForm?.addEventListener("submit", createUser);
  els.accountForm?.addEventListener("submit", saveAccount);
  els.settingRiskDial?.addEventListener("input", () => applyRiskToleranceDial(els.settingRiskDial.value));
  els.historySearch?.addEventListener("input", () => renderAnalysisHistory(analysesCache));
  els.historyStatusFilter?.addEventListener("change", () => renderAnalysisHistory(analysesCache));
  els.historyActionFilter?.addEventListener("change", () => renderAnalysisHistory(analysesCache));
  els.positionsAnalyze?.addEventListener("click", async () => {
    const tickers = portfolioTickers();
    if (!tickers.length) {
      showToast("Add at least one position before running analysis.", "error");
      return;
    }
    setActiveView("dashboard");
    await createAnalysis(tickers);
  });
  els.positionsAddLink?.addEventListener("click", () => setActiveView("settings"));
  els.clearLogs.addEventListener("click", () => {
    els.logsConsole.innerHTML = "";
    appendLog("Logs cleared locally.");
  });
  els.savePortfolio.addEventListener("click", () => {
    const available = parseFloat(els.availableBalance.value);
    if (!Number.isFinite(available)) {
      showToast("Portfolio values are invalid.", "error");
      return;
    }
    portfolioState = normalizePortfolio({ ...portfolioState, available });
    savePortfolioState(portfolioState);
    updatePortfolioUI(portfolioState);
    showToast("Portfolio saved.", "success");
  });
  els.addHolding?.addEventListener("click", () => {
    const position = {
      ticker: els.holdingTicker?.value,
      shares: Number(els.holdingShares?.value || 0),
      averageCost: Number(els.holdingAverageCost?.value || 0),
    };
    if (!upsertPortfolioPosition(position)) {
      showToast("Enter a ticker, share count, and average cost.", "error");
      return;
    }
    if (els.holdingTicker) els.holdingTicker.value = "";
    if (els.holdingShares) els.holdingShares.value = "";
    if (els.holdingAverageCost) els.holdingAverageCost.value = "";
    showToast(`${normalizeTicker(position.ticker)} holding saved.`, "success");
  });
  els.analyzeHoldings?.addEventListener("click", async () => {
    const tickers = portfolioTickers();
    if (!tickers.length) {
      showToast("Add at least one holding before running analysis.", "error");
      return;
    }
    setActiveView("dashboard");
    await createAnalysis(tickers);
  });
  els.saveAnalysisSettings?.addEventListener("click", saveAnalysisSettings);
  els.tradeCancel.addEventListener("click", () => closeModal(els.tradeModal));
  els.tradeConfirm.addEventListener("click", () => {
    if (currentTrade && currentTrade.shares > 0) {
      portfolioState.available = Math.max(0, Number(portfolioState.available || 0) - currentTrade.cost);
      addPositionFromTrade(currentTrade);
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

async function startApp() {
  if (appStarted) return;
  appStarted = true;
  updateLoggedUserUI();
  if (!localStorage.getItem("active-view") && currentUser?.preferences?.startPage) {
    activeView = currentUser.preferences.startPage;
  }
  applySidebarState();
  applyPanelCollapseStates();
  setActiveView(activeView);
  refreshIcons();
  updateAnalysisSettingsUI();
  updatePortfolioUI(portfolioState);
  setApiStatus("checking", "Checking");
  setEmptyReport("Select or start an analysis.");
  els.logsConsole.innerHTML = `<div class="text-slate-500">Agent output will stream here.</div>`;
  try {
    await refresh();
  } catch (e) {
    setEmptyReport("Backend is unavailable.");
  }
  if (refreshTimerId) clearInterval(refreshTimerId);
  refreshTimerId = setInterval(async () => {
    if (!isAuthenticated()) {
      stopAppSession();
      return;
    }
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

async function init() {
  wireEvents();
  if (!isAuthenticated()) {
    showLogin();
    return;
  }
  currentUser = loadStoredUser();
  showAuthenticatedApp();
  await startApp();
}

init();
