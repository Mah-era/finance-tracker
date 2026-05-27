const STORAGE_KEY = "personalBudgetingAppData_v1";
const LAST_INPUT_KEY = "pocketLastInput_v1";
const DRAFT_KEY = "pocketDraft_v1";
const SETTINGS_KEY = "pocketSettings_v1";

const categories = ["Food", "Transport", "Books", "Savings", "Income"];
const expenseCategories = ["Food", "Transport", "Books"];
const categoryColors = {
  Food: "#ff7b8a",
  Transport: "#73c5ff",
  Books: "#ffd166",
  Savings: "#54e0a3",
  Income: "#b59cff"
};

let transactions = [];
let selectedDate = startOfDay(new Date());
let selectedMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
let currentSection = "dashboard";
let pieFilter = "month";
let sortState = { col: "date", dir: -1 };
let savingsGoalPct = 20;

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  bindElements();
  loadData();
  loadSettings();
  bindEvents();
  setDefaultInputs();
  renderQuickCards();
  renderAll();
});

// ── Element binding ───────────────────────────────────────────────────────────
function bindElements() {
  [
    "currentMonthLabel", "sidebarMonth", "sidebarMiniSummary", "summaryCards",
    "categoryChart", "barChart", "lineChart", "categoryLegend", "breakdownTotal",
    "barMode", "barChartTitle", "trendRange", "suggestionsList", "recentTransactions",
    "calendarMonthLabel", "calendarGrid", "selectedDayTitle", "dayPreviewMetrics",
    "dayTransactions", "weekPreviewTitle", "weekPreviewMetrics", "weekCategoryBreakdown",
    "weekTransactions", "monthPreviewTitle", "monthPreviewMetrics", "monthCategoryBreakdown",
    "searchInput", "periodFilter", "categoryFilter", "typeFilter", "monthFilter",
    "historyCount", "transactionTableBody", "historyEmpty", "weeklyAnalysis",
    "monthlyAnalysis", "transactionModal", "transactionForm", "editingId",
    "transactionCategory", "transactionAmount", "transactionDate", "transactionNote",
    "formError", "modalMode", "modalTitle", "closeModal", "prevGlobalMonth",
    "nextGlobalMonth", "todayBtn", "prevCalendarMonth", "nextCalendarMonth",
    "sampleDataBtn", "resetDataBtn", "compactToggle", "exportCsvBtn",
    "quickGrid", "pieFilterTabs", "savingsGoalInput", "toastContainer",
    "exportExcelBtn", "exportPdfBtn"
  ].forEach((id) => { els[id] = document.getElementById(id); });
}

// ── Event binding ─────────────────────────────────────────────────────────────
function bindEvents() {
  document.querySelectorAll(".nav-link").forEach((btn) => {
    btn.addEventListener("click", () => switchSection(btn.dataset.section));
  });

  els.transactionForm.addEventListener("submit", saveTransactionFromForm);
  els.closeModal.addEventListener("click", closeTransactionModal);
  els.transactionModal.addEventListener("click", (e) => {
    if (e.target === els.transactionModal) closeTransactionModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.transactionModal.classList.contains("hidden")) {
      closeTransactionModal();
    }
  });

  [els.searchInput, els.periodFilter, els.categoryFilter, els.typeFilter, els.monthFilter].forEach((input) => {
    input.addEventListener("input", renderTransactions);
    input.addEventListener("change", renderTransactions);
  });

  els.barMode.addEventListener("change", renderCharts);
  els.prevGlobalMonth.addEventListener("click", () => shiftMonth(-1));
  els.nextGlobalMonth.addEventListener("click", () => shiftMonth(1));
  els.todayBtn.addEventListener("click", () => {
    selectedDate = startOfDay(new Date());
    selectedMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    renderAll();
  });
  els.prevCalendarMonth.addEventListener("click", () => shiftMonth(-1));
  els.nextCalendarMonth.addEventListener("click", () => shiftMonth(1));
  els.sampleDataBtn.addEventListener("click", loadSampleData);
  els.resetDataBtn.addEventListener("click", resetData);
  els.compactToggle.addEventListener("change", () => {
    document.body.classList.toggle("compact-mode", els.compactToggle.checked);
  });
  els.exportCsvBtn.addEventListener("click", exportCsv);
  els.exportExcelBtn.addEventListener("click", exportExcel);
  els.exportPdfBtn.addEventListener("click", exportPdf);

  els.pieFilterTabs.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      pieFilter = btn.dataset.period;
      els.pieFilterTabs.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
      renderCategoryChart();
    });
  });

  document.querySelectorAll("th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const col = th.dataset.col;
      sortState.dir = sortState.col === col ? sortState.dir * -1 : -1;
      sortState.col = col;
      renderTransactions();
    });
  });

  if (els.savingsGoalInput) {
    els.savingsGoalInput.addEventListener("change", () => {
      savingsGoalPct = Math.max(1, Math.min(100, Number(els.savingsGoalInput.value) || 20));
      saveSettings();
      renderSuggestions();
    });
  }
}

// ── Settings ──────────────────────────────────────────────────────────────────
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    savingsGoalPct = Number(s.savingsGoalPct) || 20;
    if (els.savingsGoalInput) els.savingsGoalInput.value = savingsGoalPct;
  } catch {}
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ savingsGoalPct }));
}

// ── Last-input memory ─────────────────────────────────────────────────────────
function getLastInput(category) {
  try {
    return JSON.parse(localStorage.getItem(LAST_INPUT_KEY) || "{}")[category] || null;
  } catch { return null; }
}

function saveLastInput(category, amount, note) {
  try {
    const stored = JSON.parse(localStorage.getItem(LAST_INPUT_KEY) || "{}");
    stored[category] = { amount, note };
    localStorage.setItem(LAST_INPUT_KEY, JSON.stringify(stored));
  } catch {}
}

// ── Draft recovery ────────────────────────────────────────────────────────────
function getDraft() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch { return null; }
}

function saveDraft() {
  const draft = {
    category: els.transactionCategory.value,
    amount: els.transactionAmount.value,
    date: els.transactionDate.value,
    note: els.transactionNote.value
  };
  if (!draft.amount && !draft.note) { clearDraft(); return; }
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function clearDraft() { localStorage.removeItem(DRAFT_KEY); }

// ── Quick-add cards ───────────────────────────────────────────────────────────
function renderQuickCards() {
  if (!els.quickGrid) return;
  els.quickGrid.innerHTML = categories.map((category) => {
    const type = typeForCategory(category);
    const last = getLastInput(category);
    return `
      <div class="quick-card ${type}" data-category="${category}">
        <div class="quick-card-label">
          <i class="dot" style="background:${categoryColors[category]}"></i>
          <span>${category}</span>
        </div>
        <input class="field quick-amount-input" type="number" min="1" step="1"
               placeholder="${last ? `Last: ${last.amount}` : "Amount"}"
               data-cat="${category}">
        <input class="field quick-note-input" type="text" maxlength="80"
               placeholder="${last && last.note ? last.note : "Note (optional)"}"
               data-cat="${category}">
        <button class="quick-submit-btn" data-cat="${category}">+ Add</button>
      </div>
    `;
  }).join("");

  els.quickGrid.querySelectorAll(".quick-submit-btn").forEach((btn) => {
    btn.addEventListener("click", () => quickAddCategory(btn.dataset.cat));
  });
  els.quickGrid.querySelectorAll(".quick-amount-input").forEach((input) => {
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") quickAddCategory(input.dataset.cat); });
  });
}

function quickAddCategory(category) {
  const card = els.quickGrid.querySelector(`[data-category="${category}"]`);
  if (!card) return;
  const amtInput = card.querySelector(".quick-amount-input");
  const noteInput = card.querySelector(".quick-note-input");
  const amount = Number(amtInput.value);

  if (!amount || amount <= 0) {
    amtInput.classList.remove("shake");
    void amtInput.offsetWidth;
    amtInput.classList.add("shake");
    amtInput.addEventListener("animationend", () => amtInput.classList.remove("shake"), { once: true });
    amtInput.focus();
    return;
  }

  const note = noteInput.value.trim();
  const record = {
    id: crypto.randomUUID(),
    type: typeForCategory(category),
    category,
    amount: Math.round(amount),
    date: toDateInputValue(selectedDate),
    note,
    createdAt: new Date().toISOString()
  };

  transactions.unshift(record);
  saveData();
  saveLastInput(category, Math.round(amount), note);

  amtInput.value = "";
  amtInput.placeholder = `Last: ${Math.round(amount)}`;
  if (note) noteInput.placeholder = note;
  noteInput.value = "";

  showToast(`${category} ${formatMoney(Math.round(amount))} added`, "success");
  renderAll();
}

// ── Data ──────────────────────────────────────────────────────────────────────
function setDefaultInputs() {
  els.transactionDate.value = toDateInputValue(selectedDate);
  els.monthFilter.value = toMonthInputValue(selectedMonth);
}

function loadData() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    transactions = Array.isArray(stored) ? stored.map(normalizeTransaction).filter(Boolean) : [];
  } catch { transactions = []; }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function normalizeTransaction(item) {
  if (!item || !item.id || !item.date || !item.amount || !item.category) return null;
  const category = categories.includes(item.category) ? item.category : "Food";
  return {
    id: String(item.id),
    type: typeForCategory(category),
    category,
    amount: Number(item.amount),
    date: item.date,
    note: item.note || "",
    createdAt: item.createdAt || new Date().toISOString()
  };
}

function typeForCategory(category) {
  if (category === "Income") return "income";
  if (category === "Savings") return "savings";
  return "expense";
}

// ── Navigation ────────────────────────────────────────────────────────────────
function switchSection(section) {
  currentSection = section;
  document.querySelectorAll(".section").forEach((node) => node.classList.toggle("active", node.id === section));
  document.querySelectorAll(".nav-link").forEach((node) => node.classList.toggle("active", node.dataset.section === section));
}

function shiftMonth(delta) {
  selectedMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + delta, 1);
  const day = Math.min(selectedDate.getDate(), daysInMonth(selectedMonth));
  selectedDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day);
  els.monthFilter.value = toMonthInputValue(selectedMonth);
  renderAll();
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openTransactionModal(category, id = "") {
  const existing = id ? transactions.find((t) => t.id === id) : null;
  const chosenCategory = existing ? existing.category : category;
  const draft = !existing ? getDraft() : null;

  els.editingId.value = existing ? existing.id : "";
  els.transactionCategory.value = chosenCategory;
  els.formError.textContent = "";
  els.modalMode.textContent = existing ? "Edit record" : "Quick add";
  els.modalTitle.textContent = existing ? `Edit ${chosenCategory}` : `Add ${chosenCategory}`;

  if (existing) {
    els.transactionAmount.value = existing.amount;
    els.transactionDate.value = existing.date;
    els.transactionNote.value = existing.note;
  } else if (draft && draft.category === chosenCategory) {
    els.transactionAmount.value = draft.amount;
    els.transactionDate.value = draft.date || toDateInputValue(selectedDate);
    els.transactionNote.value = draft.note;
    showToast("Draft restored", "info");
  } else {
    els.transactionAmount.value = "";
    els.transactionDate.value = toDateInputValue(selectedDate);
    els.transactionNote.value = "";
  }

  els.transactionModal.classList.remove("hidden");
  els.transactionModal.setAttribute("aria-hidden", "false");
  setTimeout(() => els.transactionAmount.focus(), 20);
}

function closeTransactionModal({ skipDraft = false } = {}) {
  if (!skipDraft && !els.editingId.value && (els.transactionAmount.value || els.transactionNote.value.trim())) {
    saveDraft();
  }
  els.transactionModal.classList.add("hidden");
  els.transactionModal.setAttribute("aria-hidden", "true");
  els.transactionForm.reset();
  els.editingId.value = "";
  els.formError.textContent = "";
  setDefaultInputs();
}

function saveTransactionFromForm(event) {
  event.preventDefault();
  const category = els.transactionCategory.value;
  const amount = Number(els.transactionAmount.value);
  const date = els.transactionDate.value;
  const note = els.transactionNote.value.trim();

  if (!categories.includes(category)) { showFormError("Please choose a valid category."); return; }
  if (!Number.isFinite(amount) || amount <= 0) { showFormError("Enter an amount greater than zero."); return; }
  if (!date || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) { showFormError("Choose a valid date."); return; }

  const id = els.editingId.value;
  const record = {
    id: id || crypto.randomUUID(),
    type: typeForCategory(category),
    category,
    amount: Math.round(amount),
    date,
    note,
    createdAt: id ? transactions.find((t) => t.id === id)?.createdAt || new Date().toISOString() : new Date().toISOString()
  };

  if (id) {
    transactions = transactions.map((t) => (t.id === id ? record : t));
    showToast(`${category} updated`, "success");
  } else {
    transactions.unshift(record);
    showToast(`${category} ${formatMoney(record.amount)} saved`, "success");
  }

  clearDraft();
  selectedDate = parseLocalDate(date);
  selectedMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  els.monthFilter.value = toMonthInputValue(selectedMonth);
  saveData();
  closeTransactionModal({ skipDraft: true });
  renderAll();
}

function showFormError(msg) { els.formError.textContent = msg; }

function editTransaction(id) {
  const t = transactions.find((item) => item.id === id);
  if (t) openTransactionModal(t.category, id);
}

function deleteTransaction(id) {
  const t = transactions.find((item) => item.id === id);
  if (!t) return;
  if (!confirm(`Delete this ${t.category} transaction?`)) return;
  transactions = transactions.filter((item) => item.id !== id);
  saveData();
  showToast(`${t.category} deleted`, "error");
  renderAll();
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(message, type = "success") {
  if (!els.toastContainer) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  els.toastContainer.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add("visible")));
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

// ── CSV export ────────────────────────────────────────────────────────────────
function exportCsv() {
  const filtered = getFilteredTransactions();
  if (!filtered.length) { showToast("No records to export", "info"); return; }
  const header = ["Date", "Type", "Category", "Note", "Amount"];
  const rows = filtered.map((t) => [
    t.date, t.type, t.category,
    `"${(t.note || "").replaceAll('"', '""')}"`,
    t.amount
  ]);
  const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `maheras-pocket-${toMonthInputValue(selectedMonth)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Exported ${filtered.length} records`, "success");
}

function exportExcel() {
  const filtered = getFilteredTransactions();
  if (!filtered.length) { showToast("No records to export", "info"); return; }
  if (typeof XLSX === "undefined") { showToast("Excel library not loaded", "error"); return; }
  const sorted = sortTransactions(filtered);
  const rows = sorted.map((t) => ({
    Date: t.date,
    Type: capitalize(t.type),
    Category: t.category,
    Note: t.note || "",
    Amount: t.amount
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 30 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transactions");
  XLSX.writeFile(wb, `maheras-pocket-${toMonthInputValue(selectedMonth)}.xlsx`);
  showToast(`Exported ${sorted.length} records to Excel`, "success");
}

function exportPdf() {
  window.print();
}

// ── Render all ────────────────────────────────────────────────────────────────
function renderAll() {
  renderHeader();
  renderSummary();
  renderCharts();
  renderSuggestions();
  renderCalendar();
  renderPreviews();
  renderTransactions();
  renderAnalysis();
}

function renderHeader() {
  const monthName = selectedMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  els.currentMonthLabel.textContent = monthName;
  els.sidebarMonth.textContent = monthName;
  els.calendarMonthLabel.textContent = monthName;
  const totals = getTotals(getMonthRange(selectedMonth));
  els.sidebarMiniSummary.textContent = `${formatMoney(totals.net)} net result`;
}

function renderSummary() {
  const monthTotals = getTotals(getMonthRange(selectedMonth));
  const weekTotals = getTotals(getWeekRange(selectedDate));
  const cards = [
    ["Total income this month", monthTotals.income, "Income recorded for the selected month", "positive"],
    ["Total expenses this month", monthTotals.expense, "Food, Transport, and Books spending", "negative"],
    ["Total savings this month", monthTotals.savings, "Savings transactions tracked separately", "positive"],
    ["Net balance this month", monthTotals.net, "Income minus expenses and savings", monthTotals.net >= 0 ? "positive" : "negative"],
    ["Weekly spending", weekTotals.expense, "Expenses in the selected week", "neutral"],
    ["Monthly spending", monthTotals.expense, "All selected-month expenses", "neutral"],
    ["Category-wise leader", highestExpenseCategory(getTransactionsInRange(getMonthRange(selectedMonth))).label, "Highest expense category this month", "neutral"],
    ["Transaction count", String(getTransactionsInRange(getMonthRange(selectedMonth)).length), "Records in selected month", "neutral"]
  ];
  els.summaryCards.innerHTML = cards.map(([label, value, helper, tone]) => `
    <article class="summary-card">
      <p class="eyebrow">${label}</p>
      <strong class="${tone}">${typeof value === "number" ? formatMoney(value) : value}</strong>
      <small>${helper}</small>
    </article>
  `).join("");
}

function renderCharts() {
  renderCategoryChart();
  renderBarChart();
  renderLineChart();
}

// ── Category donut with period filter ─────────────────────────────────────────
function renderCategoryChart() {
  const canvas = els.categoryChart;
  const ctx = canvas.getContext("2d");
  let range;
  if (pieFilter === "day") range = getDayRange(selectedDate);
  else if (pieFilter === "week") range = getWeekRange(selectedDate);
  else range = getMonthRange(selectedMonth);

  const data = getCategoryTotals(getTransactionsInRange(range), expenseCategories);
  const total = Object.values(data).reduce((s, a) => s + a, 0);
  clearCanvas(ctx, canvas);
  els.breakdownTotal.textContent = formatMoney(total);

  if (!total) {
    drawEmptyChart(ctx, canvas, "No expense data");
    els.categoryLegend.innerHTML = "";
    return;
  }

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = Math.min(canvas.width, canvas.height) * 0.34;
  let start = -Math.PI / 2;

  Object.entries(data).forEach(([cat, amount]) => {
    if (!amount) return;
    const slice = (amount / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, start + slice);
    ctx.closePath();
    ctx.fillStyle = categoryColors[cat];
    ctx.fill();
    start += slice;
  });

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.58, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#f4f8fb";
  ctx.font = "700 18px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(formatMoney(total), cx, cy + 7);

  els.categoryLegend.innerHTML = Object.entries(data).map(([cat, amount]) => `
    <div class="legend-item">
      <span><i class="dot" style="background:${categoryColors[cat]}"></i>${cat}</span>
      <strong>${formatMoney(amount)}</strong>
    </div>
  `).join("");
}

// ── Bar chart: expense vs savings ─────────────────────────────────────────────
function renderBarChart() {
  const canvas = els.barChart;
  const ctx = canvas.getContext("2d");
  clearCanvas(ctx, canvas);
  const mode = els.barMode.value;
  const groups = mode === "daily" ? buildDailyGroups() : mode === "weekly" ? buildWeeklyGroups() : buildMonthlyGroups();
  drawGroupedBarChart(ctx, canvas, groups);
}

function buildDailyGroups() {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(startOfDay(new Date()), -(6 - i));
    const t = getTotals(getDayRange(date));
    return { label: date.toLocaleDateString("en-US", { weekday: "short" }), expense: t.expense, savings: t.savings, income: t.income };
  });
}

function buildWeeklyGroups() {
  const thisWeekStart = getWeekRange(new Date()).start;
  return Array.from({ length: 8 }, (_, i) => {
    const ws = addDays(thisWeekStart, -(7 - i) * 7);
    const t = getTotals({ start: ws, end: addDays(ws, 7) });
    return { label: ws.toLocaleDateString("en-US", { month: "short", day: "numeric" }), expense: t.expense, savings: t.savings, income: t.income };
  });
}

function buildMonthlyGroups() {
  return Array.from({ length: 6 }, (_, i) => {
    const start = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 5 + i, 1);
    const t = getTotals(getMonthRange(start));
    return { label: start.toLocaleDateString("en-US", { month: "short" }), expense: t.expense, savings: t.savings, income: t.income };
  });
}

function drawGroupedBarChart(ctx, canvas, groups) {
  if (!groups.some((g) => g.expense > 0 || g.savings > 0 || g.income > 0)) {
    drawEmptyChart(ctx, canvas, "No data in this period");
    return;
  }
  const pad = { top: 28, right: 16, bottom: 48, left: 56 };
  const W = canvas.width - pad.left - pad.right;
  const H = canvas.height - pad.top - pad.bottom;
  const max = Math.max(...groups.map((g) => Math.max(g.expense, g.savings, g.income)), 1);
  const groupW = W / groups.length;
  const gap = 2;
  const barW = Math.max(5, (groupW - gap * 4) / 3);

  drawGrid(ctx, canvas, pad, max);

  groups.forEach((g, i) => {
    const totalBarW = barW * 3 + gap * 2;
    const gx = pad.left + i * groupW + (groupW - totalBarW) / 2;

    const bars = [
      { value: g.expense, c0: "#ff7b8a", c1: "rgba(255,123,138,0.3)" },
      { value: g.savings, c0: "#54e0a3", c1: "rgba(84,224,163,0.3)" },
      { value: g.income,  c0: "#b59cff", c1: "rgba(181,156,255,0.3)" }
    ];

    bars.forEach((b, bi) => {
      if (!b.value) return;
      const bh = (b.value / max) * H;
      const by = pad.top + H - bh;
      const bx = gx + bi * (barW + gap);
      const gr = ctx.createLinearGradient(0, by, 0, by + bh);
      gr.addColorStop(0, b.c0);
      gr.addColorStop(1, b.c1);
      ctx.fillStyle = gr;
      roundRect(ctx, bx, by, barW, bh, 4);
      ctx.fill();
    });

    ctx.fillStyle = "#7fa8d0";
    ctx.font = "10px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(g.label, pad.left + i * groupW + groupW / 2, canvas.height - 16);
  });
}

// ── Line chart ────────────────────────────────────────────────────────────────
function renderLineChart() {
  const canvas = els.lineChart;
  const ctx = canvas.getContext("2d");
  clearCanvas(ctx, canvas);
  els.trendRange.textContent = selectedMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const days = daysInMonth(selectedMonth);
  const points = Array.from({ length: days }, (_, i) => {
    const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), i + 1);
    return { label: String(i + 1), value: getTotals(getDayRange(date)).expense };
  });
  drawLineChart(ctx, canvas, points);
}

function drawLineChart(ctx, canvas, points) {
  if (!points.some((p) => p.value > 0)) {
    drawEmptyChart(ctx, canvas, "No spending trend yet");
    return;
  }
  const pad = { top: 26, right: 28, bottom: 40, left: 58 };
  const W = canvas.width - pad.left - pad.right;
  const H = canvas.height - pad.top - pad.bottom;
  const max = Math.max(...points.map((p) => p.value), 1);
  drawGrid(ctx, canvas, pad, max);

  ctx.beginPath();
  points.forEach((p, i) => {
    const x = pad.left + (i / Math.max(points.length - 1, 1)) * W;
    const y = pad.top + H - (p.value / max) * H;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#73c5ff";
  ctx.lineWidth = 3;
  ctx.stroke();

  points.forEach((p, i) => {
    if (!p.value) return;
    const x = pad.left + (i / Math.max(points.length - 1, 1)) * W;
    const y = pad.top + H - (p.value / max) * H;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#54e0a3";
    ctx.fill();
  });
}

function drawGrid(ctx, canvas, pad, max) {
  const W = canvas.width - pad.left - pad.right;
  const H = canvas.height - pad.top - pad.bottom;
  ctx.strokeStyle = "rgba(255,255,255,0.09)";
  ctx.fillStyle = "#9fb0c0";
  ctx.font = "11px system-ui";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (H / 4) * i;
    const value = max - (max / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + W, y);
    ctx.stroke();
    ctx.fillText(shortMoney(value), pad.left - 8, y + 4);
  }
}

function drawEmptyChart(ctx, canvas, text) {
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  roundRect(ctx, 20, 20, canvas.width - 40, canvas.height - 40, 16);
  ctx.fill();
  ctx.fillStyle = "#9fb0c0";
  ctx.font = "700 15px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
}

function clearCanvas(ctx, canvas) { ctx.clearRect(0, 0, canvas.width, canvas.height); }

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// ── Smart suggestions ─────────────────────────────────────────────────────────
function renderSuggestions() {
  const monthRange = getMonthRange(selectedMonth);
  const prevMonthRange = getMonthRange(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1));
  const weekRange = getWeekRange(selectedDate);
  const prevWeekRange = getPreviousWeekRange(selectedDate);

  const curr = getTotals(monthRange);
  const prev = getTotals(prevMonthRange);
  const currWeek = getTotals(weekRange);
  const prevWeek = getTotals(prevWeekRange);
  const monthTx = getTransactionsInRange(monthRange);
  const catTotals = getCategoryTotals(monthTx, expenseCategories);
  const prevCatTotals = getCategoryTotals(getTransactionsInRange(prevMonthRange), expenseCategories);
  const tips = [];

  function push(icon, text, tone) { tips.push({ icon, text, tone }); }

  if (curr.expense === 0 && curr.income === 0 && curr.savings === 0) {
    push("💡", "Add a few records to unlock insights. Your dashboard will shape itself immediately.", "neutral");
    flush(); return;
  }

  // 1. Savings rate vs goal
  if (curr.income > 0) {
    const actual = Math.round((curr.savings / curr.income) * 100);
    const needed = Math.round(curr.income * savingsGoalPct / 100);
    const gap = needed - curr.savings;
    if (actual >= savingsGoalPct) {
      push("✅", `Savings rate is ${actual}% — above your ${savingsGoalPct}% goal (${formatMoney(curr.savings)} of ${formatMoney(curr.income)}). Great discipline!`, "positive");
    } else {
      push("🎯", `Savings rate is ${actual}% vs your ${savingsGoalPct}% goal. Save ${formatMoney(gap)} more this month to hit the target.`, "warning");
    }
  }

  // 2. Overspending alert
  if (curr.income > 0 && curr.expense + curr.savings > curr.income) {
    const over = curr.expense + curr.savings - curr.income;
    push("🚨", `Outflow (${formatMoney(curr.expense + curr.savings)}) exceeds income (${formatMoney(curr.income)}) by ${formatMoney(over)} this month.`, "danger");
  }

  // 3. Projected month-end
  const today = new Date();
  const isCurrentMonth = today.getMonth() === selectedMonth.getMonth() && today.getFullYear() === selectedMonth.getFullYear();
  if (isCurrentMonth && curr.expense > 0) {
    const dayNum = today.getDate();
    const totalDays = daysInMonth(selectedMonth);
    const projected = Math.round((curr.expense / dayNum) * totalDays);
    if (projected > curr.expense) {
      push("📅", `Day ${dayNum}/${totalDays}: at current pace you'll spend ${formatMoney(projected)} by month end — ${formatMoney(projected - curr.expense)} more than now.`, "neutral");
    }
  }

  // 4. Week-over-week category trends
  expenseCategories.forEach((cat) => {
    const thisWk = getTransactionsInRange(weekRange).filter((t) => t.category === cat).reduce((s, t) => s + t.amount, 0);
    const prevWk = getTransactionsInRange(prevWeekRange).filter((t) => t.category === cat).reduce((s, t) => s + t.amount, 0);
    if (prevWk > 0 && thisWk > 0) {
      const pct = Math.round(((thisWk - prevWk) / prevWk) * 100);
      if (pct >= 40) push("⚠️", `${cat} is up ${pct}% this week: ${formatMoney(thisWk)} vs ${formatMoney(prevWk)} last week.`, "warning");
      if (pct <= -30) push("📉", `${cat} down ${Math.abs(pct)}% this week: ${formatMoney(thisWk)} vs ${formatMoney(prevWk)} last week. Nice control!`, "positive");
    }
  });

  // 5. Month-over-month category spikes
  expenseCategories.forEach((cat) => {
    const thisM = catTotals[cat];
    const prevM = prevCatTotals[cat];
    if (prevM > 0 && thisM > 0) {
      const pct = Math.round(((thisM - prevM) / prevM) * 100);
      if (pct >= 50) push("📊", `${cat} up ${pct}% this month vs last (${formatMoney(thisM)} vs ${formatMoney(prevM)}).`, "warning");
    }
  });

  // 6. Unusual single transactions (> 2.5× category average)
  monthTx.filter((t) => t.type === "expense").forEach((t) => {
    const catTx = monthTx.filter((x) => x.category === t.category);
    if (catTx.length < 2) return;
    const avg = catTx.reduce((s, x) => s + x.amount, 0) / catTx.length;
    if (t.amount > avg * 2.5 && t.amount > 500) {
      push("🔍", `Unusual ${t.category} entry on ${formatShortDate(parseLocalDate(t.date))}: ${formatMoney(t.amount)} is ${Math.round(t.amount / avg)}× your average (${formatMoney(Math.round(avg))}).`, "warning");
    }
  });

  // 7. Positive net — encourage investing surplus
  if (curr.net > 0 && !tips.some((s) => s.tone === "danger")) {
    push("🌱", `Net result is ${formatMoney(curr.net)} positive this month. Consider moving part of the surplus into long-term savings.`, "positive");
  }

  flush();

  function flush() {
    els.suggestionsList.innerHTML = tips.slice(0, 6).map((s) =>
      `<div class="suggestion suggestion-${s.tone}"><span class="suggestion-icon">${s.icon}</span><span>${s.text}</span></div>`
    ).join("") || `<div class="suggestion suggestion-neutral"><span class="suggestion-icon">💡</span><span>No insights yet for this period.</span></div>`;
  }
}

// ── Calendar ──────────────────────────────────────────────────────────────────
function renderCalendar() {
  const start = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - start.getDay());
  const todayVal = toDateInputValue(new Date());
  const selVal = toDateInputValue(selectedDate);
  const cells = [];

  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    const val = toDateInputValue(date);
    const totals = getTotals(getDayRange(date));
    const outside = date.getMonth() !== selectedMonth.getMonth();
    cells.push(`
      <button class="day-cell${outside ? " outside" : ""}${val === todayVal ? " today" : ""}${val === selVal ? " selected" : ""}" data-date="${val}">
        <span class="date-number">${date.getDate()} <small>${totals.net ? formatMoney(totals.net) : ""}</small></span>
        <span class="day-lines">
          <span class="positive">In ${formatMoney(totals.income)}</span>
          <span class="negative">Ex ${formatMoney(totals.expense)}</span>
          <span class="positive">Save ${formatMoney(totals.savings)}</span>
          <span>Net ${formatMoney(totals.net)}</span>
        </span>
      </button>`);
  }

  els.calendarGrid.innerHTML = cells.join("");
  els.calendarGrid.querySelectorAll("[data-date]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedDate = parseLocalDate(btn.dataset.date);
      selectedMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      els.monthFilter.value = toMonthInputValue(selectedMonth);
      renderAll();
    });
  });
}

// ── Previews ──────────────────────────────────────────────────────────────────
function renderPreviews() {
  const dayRange = getDayRange(selectedDate);
  const weekRange = getWeekRange(selectedDate);
  const monthRange = getMonthRange(selectedMonth);

  els.selectedDayTitle.textContent = selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  els.dayPreviewMetrics.innerHTML = renderMetricPills(getTotals(dayRange));
  els.dayTransactions.innerHTML = renderTransactionCards(getTransactionsInRange(dayRange), "No transactions for this day.");

  els.weekPreviewTitle.textContent = `${formatShortDate(weekRange.start)} – ${formatShortDate(addDays(weekRange.end, -1))}`;
  els.weekPreviewMetrics.innerHTML = renderMetricPills(getTotals(weekRange));
  els.weekCategoryBreakdown.innerHTML = renderCategoryBars(getCategoryTotals(getTransactionsInRange(weekRange), expenseCategories));
  els.weekTransactions.innerHTML = renderTransactionCards(getTransactionsInRange(weekRange), "No transactions for this week.");

  els.monthPreviewTitle.textContent = selectedMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  els.monthPreviewMetrics.innerHTML = renderMetricPills(getTotals(monthRange));
  els.monthCategoryBreakdown.innerHTML = renderCategoryBars(getCategoryTotals(getTransactionsInRange(monthRange), categories));
}

function renderMetricPills(totals) {
  return [
    ["Income", totals.income, "positive"],
    ["Expense", totals.expense, "negative"],
    ["Savings", totals.savings, "positive"],
    ["Net", totals.net, totals.net >= 0 ? "positive" : "negative"]
  ].map(([label, value, tone]) =>
    `<div class="metric-pill"><span>${label}</span><strong class="${tone}">${formatMoney(value)}</strong></div>`
  ).join("");
}

function renderCategoryBars(data) {
  const max = Math.max(...Object.values(data), 1);
  return Object.entries(data).map(([cat, amount]) => `
    <div class="category-row">
      <div class="category-label"><span>${cat}</span><strong>${formatMoney(amount)}</strong></div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round((amount / max) * 100)}%;background:${categoryColors[cat]}"></div></div>
    </div>`).join("");
}

// ── Transactions ──────────────────────────────────────────────────────────────
function renderTransactions() {
  const filtered = getFilteredTransactions();
  const sorted = sortTransactions(filtered);
  els.historyCount.textContent = `${sorted.length} record${sorted.length === 1 ? "" : "s"}`;
  els.transactionTableBody.innerHTML = sorted.map((t) => `
    <tr>
      <td>${formatShortDate(parseLocalDate(t.date))}</td>
      <td class="${toneForType(t.type)}">${capitalize(t.type)}</td>
      <td><i class="dot" style="background:${categoryColors[t.category]}"></i>${t.category}</td>
      <td>${escapeHtml(t.note || "—")}</td>
      <td>${formatMoney(t.amount)}</td>
      <td>
        <div class="row-actions">
          <button class="small-btn" data-edit="${t.id}">Edit</button>
          <button class="small-btn" data-delete="${t.id}">Delete</button>
        </div>
      </td>
    </tr>`).join("");

  els.historyEmpty.classList.toggle("hidden", sorted.length > 0);

  // Update sort indicators
  document.querySelectorAll("th.sortable").forEach((th) => {
    th.classList.remove("asc", "desc");
    if (th.dataset.col === sortState.col) th.classList.add(sortState.dir === 1 ? "asc" : "desc");
  });

  els.transactionTableBody.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", () => editTransaction(btn.dataset.edit)));
  els.transactionTableBody.querySelectorAll("[data-delete]").forEach((btn) => btn.addEventListener("click", () => deleteTransaction(btn.dataset.delete)));

  const recent = [...transactions].sort(sortNewest).slice(0, 6);
  els.recentTransactions.innerHTML = renderTransactionCards(recent, "No transactions yet. Use quick add to begin.");
}

function sortTransactions(list) {
  return [...list].sort((a, b) => {
    let av, bv;
    if (sortState.col === "date") { av = a.date; bv = b.date; }
    else if (sortState.col === "amount") { av = a.amount; bv = b.amount; }
    else if (sortState.col === "type") { av = a.type; bv = b.type; }
    else if (sortState.col === "category") { av = a.category; bv = b.category; }
    else { av = a.date; bv = b.date; }
    if (av < bv) return -sortState.dir;
    if (av > bv) return sortState.dir;
    return 0;
  });
}

function getFilteredTransactions() {
  const search = els.searchInput.value.trim().toLowerCase();
  const period = els.periodFilter.value;
  const category = els.categoryFilter.value;
  const type = els.typeFilter.value;
  const month = els.monthFilter.value;
  let range = null;

  if (period === "day") range = getDayRange(selectedDate);
  else if (period === "week") range = getWeekRange(selectedDate);
  else if (period === "month") range = getMonthRange(selectedMonth);
  else if (period === "all" && month) {
    const [yr, mo] = month.split("-").map(Number);
    range = getMonthRange(new Date(yr, mo - 1, 1));
  }

  return transactions
    .filter((t) => !range || isInRange(parseLocalDate(t.date), range))
    .filter((t) => category === "all" || t.category === category)
    .filter((t) => type === "all" || t.type === type)
    .filter((t) => !search || [t.note, t.category, t.type].some((v) => String(v).toLowerCase().includes(search)));
}

function renderTransactionCards(items, emptyText) {
  if (!items.length) return `<div class="empty-state">${emptyText}</div>`;
  return [...items].sort(sortNewest).map((t) => `
    <article class="transaction-item">
      <div>
        <p><i class="dot" style="background:${categoryColors[t.category]}"></i>${t.category} <span class="${toneForType(t.type)}">/${capitalize(t.type)}</span></p>
        <small>${formatShortDate(parseLocalDate(t.date))}${t.note ? ` – ${escapeHtml(t.note)}` : ""}</small>
      </div>
      <strong>${formatMoney(t.amount)}</strong>
    </article>`).join("");
}

// ── Analysis ──────────────────────────────────────────────────────────────────
function renderAnalysis() {
  const currWeek = getTotals(getWeekRange(selectedDate));
  const prevWeek = getTotals(getPreviousWeekRange(selectedDate));
  const currMonth = getTotals(getMonthRange(selectedMonth));
  const prevMonth = getTotals(getMonthRange(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1)));
  els.weeklyAnalysis.innerHTML = renderAnalysisRows(currWeek, prevWeek);
  els.monthlyAnalysis.innerHTML = renderAnalysisRows(currMonth, prevMonth);
}

function renderAnalysisRows(current, previous) {
  return [
    ["Income", current.income, previous.income, "positive"],
    ["Expense", current.expense, previous.expense, "negative"],
    ["Savings", current.savings, previous.savings, "positive"],
    ["Net result", current.net, previous.net, current.net >= 0 ? "positive" : "negative"]
  ].map(([label, now, before, tone]) => {
    const cmp = percentChange(now, before);
    return `
      <div class="analysis-item">
        <span>${label}<br><small class="muted">Previous: ${formatMoney(before)}</small></span>
        <strong class="${tone}">${formatMoney(now)} <small class="${cmp.tone}">${cmp.label}</small></strong>
      </div>`;
  }).join("");
}

// ── Sample / reset ────────────────────────────────────────────────────────────
function loadSampleData() {
  if (transactions.length && !confirm("Load sample data? This will add demo records to your existing data.")) return;
  const today = new Date();
  const samples = [
    ["Income", 52000, -20, "Monthly salary"],
    ["Food", 950, -18, "Groceries"],
    ["Transport", 420, -17, "Ride share"],
    ["Books", 1800, -16, "Course materials"],
    ["Savings", 8000, -15, "Monthly savings"],
    ["Food", 620, -10, "Lunch and snacks"],
    ["Transport", 350, -8, "Office commute"],
    ["Income", 8500, -7, "Freelance payment"],
    ["Food", 1250, -4, "Family dinner"],
    ["Books", 700, -3, "Reference book"],
    ["Savings", 3500, -2, "Extra savings"],
    ["Transport", 510, -1, "Weekend travel"],
    ["Food", 540, 0, "Breakfast supplies"]
  ];
  transactions = [
    ...samples.map(([category, amount, offset, note]) => ({
      id: crypto.randomUUID(),
      type: typeForCategory(category),
      category,
      amount,
      date: toDateInputValue(addDays(today, offset)),
      note,
      createdAt: new Date().toISOString()
    })),
    ...transactions
  ];
  saveData();
  showToast("Sample data loaded", "success");
  renderAll();
}

function resetData() {
  if (!confirm("Clear all local transaction data? This cannot be undone.")) return;
  transactions = [];
  saveData();
  showToast("All data cleared", "error");
  renderAll();
}

// ── Data helpers ──────────────────────────────────────────────────────────────
function getTotals(range) {
  return getTransactionsInRange(range).reduce((totals, t) => {
    totals[t.type] += t.amount;
    totals.net = totals.income - totals.expense - totals.savings;
    return totals;
  }, { income: 0, expense: 0, savings: 0, net: 0 });
}

function getTransactionsInRange(range) {
  return transactions.filter((t) => isInRange(parseLocalDate(t.date), range));
}

function getCategoryTotals(items, list) {
  return list.reduce((totals, cat) => {
    totals[cat] = items.filter((t) => t.category === cat).reduce((s, t) => s + t.amount, 0);
    return totals;
  }, {});
}

function highestExpenseCategory(items) {
  const totals = getCategoryTotals(items, expenseCategories);
  const [cat, amount] = Object.entries(totals).sort((a, b) => b[1] - a[1])[0] || ["None", 0];
  return { category: cat, amount, label: amount ? `${cat} ${formatMoney(amount)}` : "No expense yet" };
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function getDayRange(date) {
  const start = startOfDay(date);
  return { start, end: addDays(start, 1) };
}

function getWeekRange(date) {
  const start = startOfDay(date);
  start.setDate(start.getDate() - start.getDay());
  return { start, end: addDays(start, 7) };
}

function getPreviousWeekRange(date) {
  const curr = getWeekRange(date);
  return { start: addDays(curr.start, -7), end: curr.start };
}

function getMonthRange(date) {
  return {
    start: new Date(date.getFullYear(), date.getMonth(), 1),
    end: new Date(date.getFullYear(), date.getMonth() + 1, 1)
  };
}

function isInRange(date, range) { return date >= range.start && date < range.end; }

function startOfDay(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function parseLocalDate(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysInMonth(date) { return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(); }

function toDateInputValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toMonthInputValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatShortDate(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Formatting ────────────────────────────────────────────────────────────────
function formatMoney(value) {
  const amount = Math.round(Number(value) || 0);
  try {
    return new Intl.NumberFormat("en-BD", { maximumFractionDigits: 0 }).format(amount).replace(/^/, "৳");
  } catch {
    return `৳${amount.toLocaleString("en-US")}`;
  }
}

function shortMoney(value) {
  const amount = Math.round(Number(value) || 0);
  if (amount >= 1000000) return `৳${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `৳${Math.round(amount / 1000)}k`;
  return formatMoney(amount);
}

function percentChange(current, previous) {
  if (!previous && !current) return { label: "0%", tone: "neutral" };
  if (!previous) return { label: "+100%", tone: "positive" };
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const sign = change > 0 ? "+" : "";
  return { label: `${sign}${Math.round(change)}%`, tone: change > 0 ? "positive" : change < 0 ? "negative" : "neutral" };
}

function capitalize(v) { return v.charAt(0).toUpperCase() + v.slice(1); }

function toneForType(type) { return type === "expense" ? "negative" : "positive"; }

function sortNewest(a, b) {
  return parseLocalDate(b.date) - parseLocalDate(a.date) || new Date(b.createdAt) - new Date(a.createdAt);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

window.editTransaction = editTransaction;
window.deleteTransaction = deleteTransaction;
