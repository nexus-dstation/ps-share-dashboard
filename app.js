const RATE_ORDER = ["4円超P", "1円P", "1円未満P", "20円超S", "5円S", "5円未満S"];
const AI_TARGET_RATES = new Set(["4円超P", "20円超S"]);
const IMPORT_PASSWORD = "Nexus3939";
const AI_DIAGNOSIS_TOOLTIP = "判定は直近月です。過少傾向: 売上シェア > 補粗利シェア > 台数シェア。過多傾向: 売上シェア < 補粗利シェア < 台数シェア。";
const STATUS_CLASS = {
  "不足": "status-shortage",
  "過剰": "status-excess",
  "要確認": "status-watch",
  "適正": "status-proper"
};

const els = {
  dashboard: document.querySelector("#dashboard"),
  emptyState: document.querySelector("#emptyState"),
  dashboardTitle: document.querySelector("#dashboardTitle"),
  storeSelect: document.querySelector("#storeSelect"),
  storePrevButton: document.querySelector("#storePrevButton"),
  storeNextButton: document.querySelector("#storeNextButton"),
  rateSelect: document.querySelector("#rateSelect"),
  metricSelect: document.querySelector("#metricSelect"),
  periodTrigger: document.querySelector("#periodTrigger"),
  periodPanel: document.querySelector("#periodPanel"),
  periodStartYearPrev: document.querySelector("#periodStartYearPrev"),
  periodStartYearNext: document.querySelector("#periodStartYearNext"),
  periodEndYearPrev: document.querySelector("#periodEndYearPrev"),
  periodEndYearNext: document.querySelector("#periodEndYearNext"),
  periodStartYearLabel: document.querySelector("#periodStartYearLabel"),
  periodEndYearLabel: document.querySelector("#periodEndYearLabel"),
  periodStartMonths: document.querySelector("#periodStartMonths"),
  periodEndMonths: document.querySelector("#periodEndMonths"),
  periodPreviewText: document.querySelector("#periodPreviewText"),
  periodClearButton: document.querySelector("#periodClearButton"),
  periodApplyButton: document.querySelector("#periodApplyButton"),
  emptyOpenImportButton: document.querySelector("#emptyOpenImportButton"),
  importPanel: document.querySelector("#importPanel"),
  passwordInput: document.querySelector("#passwordInput"),
  importMonthSelect: document.querySelector("#importMonthSelect"),
  fileInput: document.querySelector("#fileInput"),
  importStatus: document.querySelector("#importStatus"),
  trendCards: document.querySelector("#trendCards"),
  matrixHead: document.querySelector("#matrixHead"),
};

const state = {
  allRows: [],
  months: [],
  stores: [],
  selectedMonth: "",
  selectedStore: "",
  threshold: 3,
  selectedMetric: "all",
  selectedRate: "全レート",
  periodStart: "",
  periodEnd: "",
  draftPeriodStart: "",
  draftPeriodEnd: "",
  periodPanelOpen: false,
  periodStartYear: 2025,
  periodEndYear: 2026,
  importMonth: "",
  importPanelOpen: false,
  importUnlocked: false,
  storeOrder: [],
  sortMonth: "",
  sortDirection: "desc"
};

init();

async function init() {
  bindEvents();
  if (Array.isArray(window.__DASHBOARD_DATA__) && window.__DASHBOARD_DATA__.length) {
    loadData(window.__DASHBOARD_DATA__, "embedded-dashboard-data");
    return;
  }
  const loaded = await tryLoadPreferredData();
  if (!loaded) {
    loadData(buildFallbackSampleData(), "fallback-generated");
  }
}

function bindEvents() {
  els.emptyOpenImportButton.addEventListener("click", () => {
    state.importPanelOpen = true;
    updateImportPanel();
    els.passwordInput.focus();
  });

  els.dashboardTitle.addEventListener("dblclick", () => {
    state.importPanelOpen = !state.importPanelOpen;
    updateImportPanel();
    if (state.importPanelOpen) {
      els.passwordInput.focus();
    }
  });

  els.storeSelect.addEventListener("change", () => {
    state.selectedStore = els.storeSelect.value;
    render();
  });

  els.storePrevButton.addEventListener("click", () => {
    moveStoreSelection(-1);
  });

  els.storeNextButton.addEventListener("click", () => {
    moveStoreSelection(1);
  });

  els.rateSelect.addEventListener("change", () => {
    state.selectedRate = els.rateSelect.value;
    render();
  });

  els.metricSelect.addEventListener("change", () => {
    state.selectedMetric = els.metricSelect.value;
    render();
  });

  els.periodTrigger.addEventListener("click", () => {
    state.periodPanelOpen = !state.periodPanelOpen;
    state.draftPeriodStart = state.periodStart;
    state.draftPeriodEnd = state.periodEnd;
    const baseYear = getInitialPeriodBaseYear();
    state.periodStartYear = baseYear;
    state.periodEndYear = baseYear + 1;
    renderPeriodPanel();
  });

  els.periodStartYearPrev.addEventListener("click", () => {
    state.periodStartYear -= 1;
    renderPeriodPanel();
  });

  els.periodStartYearNext.addEventListener("click", () => {
    state.periodStartYear += 1;
    renderPeriodPanel();
  });

  els.periodEndYearPrev.addEventListener("click", () => {
    state.periodEndYear -= 1;
    renderPeriodPanel();
  });

  els.periodEndYearNext.addEventListener("click", () => {
    state.periodEndYear += 1;
    renderPeriodPanel();
  });

  els.periodClearButton.addEventListener("click", () => {
    const monthsAsc = [...state.months].sort(compareMonthAsc);
    state.draftPeriodStart = monthsAsc[0] || "";
    state.draftPeriodEnd = monthsAsc[monthsAsc.length - 1] || "";
    renderPeriodPanel();
  });

  els.periodApplyButton.addEventListener("click", () => {
    state.periodStart = state.draftPeriodStart;
    state.periodEnd = state.draftPeriodEnd;
    normalizePeriod();
    state.periodPanelOpen = false;
    syncPeriodTrigger();
    renderPeriodPanel();
    render();
  });

  els.importMonthSelect.addEventListener("change", () => {
    state.importMonth = els.importMonthSelect.value;
  });

  els.passwordInput.addEventListener("input", () => {
    state.importUnlocked = els.passwordInput.value === IMPORT_PASSWORD;
    els.fileInput.disabled = !state.importUnlocked;
    els.importStatus.textContent = state.importUnlocked
      ? "パスワードを確認しました。ZIP / CSV / JSON を選択すると読込します。"
      : "パスワード一致後にアップロードできます。";
  });

  els.fileInput.addEventListener("change", async (event) => {
    await handleImportFile(event.target);
  });

}

function toggleImportPanel() {
  state.importPanelOpen = !state.importPanelOpen;
  updateImportPanel();
}

function updateImportPanel() {
  els.importPanel.classList.toggle("hidden", !state.importPanelOpen);
}

async function handleImportFile(input) {
  const [file] = input.files || [];
  if (!file) return;
  if (els.passwordInput.value !== IMPORT_PASSWORD) {
    state.importUnlocked = false;
    els.fileInput.disabled = true;
    els.importStatus.textContent = "パスワードが違います。";
    input.value = "";
    return;
  }

  try {
    const rows = await parseImportFile(file);
    const normalizedRows = applyImportMonth(rows, state.importMonth || guessLatestMonth(rows));
    loadData(normalizedRows, file.name);
    els.importStatus.textContent = `${file.name} を読込しました。反映月 ${state.importMonth || guessLatestMonth(rows) || "-"}`;
    state.importPanelOpen = false;
    updateImportPanel();
  } catch (error) {
    els.importStatus.textContent = `読込に失敗しました: ${error.message}`;
  }
  input.value = "";
}

async function parseImportFile(file) {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".json")) {
    return parseJson(await file.text());
  }
  if (lowerName.endsWith(".csv")) {
    return parseCsv(await file.text());
  }
  if (lowerName.endsWith(".zip")) {
    return parseZipFile(file);
  }
  throw new Error("対応していない形式です");
}

async function parseZipFile(file) {
  if (!window.JSZip) {
    throw new Error("ZIP読込ライブラリを利用できません");
  }
  const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const rowSets = [];
  for (const entry of entries) {
    const name = entry.name.toLowerCase();
    if (name.endsWith(".json")) {
      rowSets.push(parseJson(await entry.async("string")));
    } else if (name.endsWith(".csv")) {
      rowSets.push(parseCsv(await entry.async("string")));
    }
  }
  const merged = rowSets.flat();
  if (!merged.length) {
    throw new Error("ZIP内にCSVまたはJSONがありません");
  }
  return merged;
}

function applyImportMonth(rows, month) {
  if (!month) return rows;
  return rows.map((row) => ({
    ...row,
    年月: month,
    対象年月: month
  }));
}

async function tryLoadPreferredData() {
  const candidates = [
    { path: "./data/dashboard-data.json", type: "json" },
    { path: "./data/dashboard-data.csv", type: "csv" },
    { path: "./sample-data.json", type: "json" }
  ];
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate.path);
      if (!response.ok) continue;
      const payload = candidate.type === "json" ? await response.json() : await response.text();
      const rows = candidate.type === "json" ? parseJson(payload) : parseCsv(payload);
      if (!rows.length) continue;
      loadData(rows, candidate.path);
      return true;
    } catch (error) {
      continue;
    }
  }
  return false;
}

function loadData(rows, sourceLabel = "manual") {
  state.allRows = normalizeRows(rows);
  state.months = unique(state.allRows.map((row) => row.年月)).sort(compareMonthDesc);
  state.storeOrder = buildStoreOrder(state.allRows);
  state.stores = ["全店舗", ...(state.storeOrder.length ? state.storeOrder : unique(state.allRows.map((row) => row.店舗名)))];
  state.selectedMonth = state.months[0] || "";
  state.selectedStore = state.stores[0] || "";
  const monthsAsc = [...state.months].sort(compareMonthAsc);
  state.periodStart = monthsAsc.includes(state.periodStart) ? state.periodStart : (monthsAsc[0] || "");
  state.periodEnd = monthsAsc.includes(state.periodEnd) ? state.periodEnd : (monthsAsc[monthsAsc.length - 1] || "");
  normalizePeriod();
  state.draftPeriodStart = state.periodStart;
  state.draftPeriodEnd = state.periodEnd;
  const baseYear = getInitialPeriodBaseYear();
  state.periodStartYear = baseYear;
  state.periodEndYear = baseYear + 1;
  const rateOptions = ["全レート", ...RATE_ORDER];
  state.selectedRate = rateOptions.includes(state.selectedRate) ? state.selectedRate : "全レート";
  const importMonths = buildImportMonthOptions(state.months);
  state.importMonth = importMonths.includes(state.importMonth) ? state.importMonth : (importMonths[0] || "");
  fillSelect(els.storeSelect, state.stores, state.selectedStore);
  fillSelect(els.rateSelect, rateOptions, state.selectedRate);
  fillSelect(els.importMonthSelect, importMonths, state.importMonth);
  els.metricSelect.value = state.selectedMetric;
  syncPeriodTrigger();
  renderPeriodPanel();
  els.fileInput.disabled = !state.importUnlocked;
  render();
}

function render() {
  if (!state.allRows.length || !state.selectedMonth || !state.selectedStore) {
    els.dashboard.classList.add("hidden");
    els.emptyState.classList.remove("hidden");
    return;
  }

  els.dashboard.classList.remove("hidden");
  els.emptyState.classList.add("hidden");
  renderTrendCards();
}

function renderTrendCards() {
  els.trendCards.innerHTML = "";
  const monthsAsc = getVisibleMonths();
  const allRealStores = state.stores.filter((store) => store !== "全店舗");
  const baseStores = state.selectedStore === "全店舗" ? allRealStores : [state.selectedStore];
  const requestedRates = state.selectedRate === "全レート" ? RATE_ORDER : [state.selectedRate];
  const targetRates = requestedRates.filter((rate) => rateHasAnySeats(baseStores, rate));
  const targetStores = sortStoresForView(baseStores, targetRates);
  els.matrixHead.innerHTML = `
    <tr>
      <th>店舗</th>
      <th>レート</th>
      ${monthsAsc.map((month) => {
        const active = state.sortMonth === month ? ` sort-${state.sortDirection}` : "";
        const marker = state.sortMonth === month ? (state.sortDirection === "asc" ? " ▲" : " ▼") : "";
        return `<th><button type="button" class="month-sort-button${active}" data-sort-month="${month}">${month}${marker}</button></th>`;
        }).join("")}
      <th class="ai-col-head"><button type="button" class="month-sort-button${state.sortMonth === "__AI__" ? ` sort-${state.sortDirection}` : ""}" data-sort-month="__AI__" title="${AI_DIAGNOSIS_TOOLTIP}">AI診断${state.sortMonth === "__AI__" ? (state.sortDirection === "asc" ? " ▲" : " ▼") : ""}</button></th>
      </tr>
    `;

  targetStores.forEach((store) => {
    targetRates.forEach((rate) => {
      if (!storeRateHasAnySeats(store, rate)) {
        return;
      }
      const tr = document.createElement("tr");
      const monthCells = monthsAsc.map((month) => {
        const row = state.allRows.find((item) => item.年月 === month && item.店舗名 === store && item.レート区分 === rate);
        return buildMatrixCell(row, month, rate);
      }).join("");
      const latestMonth = monthsAsc[monthsAsc.length - 1] || "";
      const latestRow = latestMonth
        ? state.allRows.find((item) => item.年月 === latestMonth && item.店舗名 === store && item.レート区分 === rate)
        : null;
      tr.innerHTML = `
        <td>${store}</td>
        <td>${rate}</td>
        ${monthCells}
        <td class="ai-col-cell">${buildAiDiagnosis(latestRow)}</td>
      `;
      els.trendCards.appendChild(tr);
    });
  });

  els.matrixHead.querySelectorAll("[data-sort-month]").forEach((button) => {
    button.addEventListener("click", () => {
      const month = button.dataset.sortMonth;
      if (state.sortMonth === month) {
        if (state.sortDirection === "desc") {
          state.sortDirection = "asc";
        } else if (state.sortDirection === "asc") {
          state.sortMonth = "";
          state.sortDirection = "desc";
        } else {
          state.sortDirection = "desc";
        }
      } else {
        state.sortMonth = month;
        state.sortDirection = "desc";
      }
      render();
    });
  });
}

function getVisibleMonths() {
  return [...state.months]
    .sort(compareMonthAsc)
    .filter((month) => {
      if (state.periodStart && month < state.periodStart) return false;
      if (state.periodEnd && month > state.periodEnd) return false;
      return true;
    });
}

function normalizePeriod() {
  if (state.periodStart && state.periodEnd && state.periodStart > state.periodEnd) {
    const swap = state.periodStart;
    state.periodStart = state.periodEnd;
    state.periodEnd = swap;
  }
}

function syncPeriodTrigger() {
  const monthsAsc = [...state.months].sort(compareMonthAsc);
  const fullStart = monthsAsc[0] || "";
  const fullEnd = monthsAsc[monthsAsc.length - 1] || "";
  els.periodTrigger.textContent =
    state.periodStart === fullStart && state.periodEnd === fullEnd
      ? "全期間"
      : `${state.periodStart} - ${state.periodEnd}`;
}

function renderPeriodPanel() {
  els.periodPanel.classList.toggle("hidden", !state.periodPanelOpen);
  if (!state.periodPanelOpen) {
    return;
  }
  renderPeriodMonths(els.periodStartMonths, state.periodStartYear, "start");
  renderPeriodMonths(els.periodEndMonths, state.periodEndYear, "end");
  els.periodStartYearLabel.textContent = `${state.periodStartYear}年`;
  els.periodEndYearLabel.textContent = `${state.periodEndYear}年`;
  els.periodPreviewText.textContent = `${state.draftPeriodStart || "-"} - ${state.draftPeriodEnd || "-"}`;
}

function renderPeriodMonths(container, year, type) {
  container.innerHTML = "";
  for (let month = 1; month <= 12; month += 1) {
    const ym = `${year}-${String(month).padStart(2, "0")}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "period-month-button";
    button.textContent = `${month}月`;
    if ((type === "start" && state.draftPeriodStart === ym) || (type === "end" && state.draftPeriodEnd === ym)) {
      button.classList.add("active");
    }
    if (!state.months.includes(ym)) {
      button.disabled = true;
    }
    button.addEventListener("click", () => {
      if (type === "start") {
        state.draftPeriodStart = ym;
        if (!state.draftPeriodEnd || state.draftPeriodEnd < ym) {
          state.draftPeriodEnd = ym;
        }
      } else {
        state.draftPeriodEnd = ym;
        if (!state.draftPeriodStart || state.draftPeriodStart > ym) {
          state.draftPeriodStart = ym;
        }
      }
      if (state.draftPeriodStart && state.draftPeriodEnd && state.draftPeriodStart > state.draftPeriodEnd) {
        const swap = state.draftPeriodStart;
        state.draftPeriodStart = state.draftPeriodEnd;
        state.draftPeriodEnd = swap;
      }
      renderPeriodPanel();
    });
    container.appendChild(button);
  }
}

function getInitialPeriodBaseYear() {
  const start = state.periodStart || [...state.months].sort(compareMonthAsc)[0] || "2025-01";
  return Number.parseInt(start.slice(0, 4), 10);
}

function rateHasAnySeats(stores, rate) {
  return state.allRows.some((row) => {
    return stores.includes(row.店舗名) && row.レート区分 === rate && Number(row.台数 || 0) > 0;
  });
}

function storeRateHasAnySeats(store, rate) {
  return state.allRows.some((row) => {
    return row.店舗名 === store && row.レート区分 === rate && Number(row.台数 || 0) > 0;
  });
}

function buildAiDiagnosis(row) {
  if (!row) {
    return "";
  }
  if (!AI_TARGET_RATES.has(row.レート区分)) {
    return "";
  }
  if (Number.isFinite(row.売上シェア) && Number.isFinite(row.補粗利シェア) && Number.isFinite(row.台数シェア)) {
    if (row.売上シェア > row.補粗利シェア && row.補粗利シェア > row.台数シェア) {
      return `<span class="ai-diagnosis ai-shortage" title="${AI_DIAGNOSIS_TOOLTIP}">過少傾向</span>`;
    }
    if (row.売上シェア < row.補粗利シェア && row.補粗利シェア < row.台数シェア) {
      return `<span class="ai-diagnosis ai-excess" title="${AI_DIAGNOSIS_TOOLTIP}">過多傾向</span>`;
    }
  }
  return "";
}

function sortStoresForView(stores, targetRates) {
  if (!state.sortMonth || stores.length <= 1) {
    return stores;
  }
  return [...stores].sort((a, b) => {
    const aValue = state.sortMonth === "__AI__" ? getStoreAiSortValue(a, targetRates) : getStoreSortValue(a, state.sortMonth, targetRates);
    const bValue = state.sortMonth === "__AI__" ? getStoreAiSortValue(b, targetRates) : getStoreSortValue(b, state.sortMonth, targetRates);
    const aSafe = Number.isFinite(aValue) ? aValue : Number.NEGATIVE_INFINITY;
    const bSafe = Number.isFinite(bValue) ? bValue : Number.NEGATIVE_INFINITY;
    const diff = state.sortDirection === "asc" ? aSafe - bSafe : bSafe - aSafe;
    return diff || state.storeOrder.indexOf(a) - state.storeOrder.indexOf(b);
  });
}

function getStoreAiSortValue(store, targetRates) {
  const latestMonth = getVisibleMonths().slice(-1)[0];
  if (!latestMonth) return null;
  const rows = targetRates
    .map((rate) => state.allRows.find((item) => item.年月 === latestMonth && item.店舗名 === store && item.レート区分 === rate))
    .filter((row) => row && AI_TARGET_RATES.has(row.レート区分));
  if (!rows.length) return null;
  return average(rows.map((row) => {
    if (row.売上シェア > row.補粗利シェア && row.補粗利シェア > row.台数シェア) return 1;
    if (row.売上シェア < row.補粗利シェア && row.補粗利シェア < row.台数シェア) return -1;
    return 0;
  }));
}

function getStoreSortValue(store, month, targetRates) {
  const rows = targetRates
    .map((rate) => state.allRows.find((item) => item.年月 === month && item.店舗名 === store && item.レート区分 === rate))
    .filter(Boolean);
  if (!rows.length) {
    return null;
  }
  if (state.selectedMetric === "all" || state.selectedMetric === "count") {
    return rows.reduce((sum, row) => sum + (row.台数 || 0), 0);
  }
  if (state.selectedMetric === "seatShare") {
    return average(rows.map((row) => row.台数シェア));
  }
  if (state.selectedMetric === "salesShare") {
    return average(rows.map((row) => row.売上シェア));
  }
  if (state.selectedMetric === "profitShare") {
    return average(rows.map((row) => row.補粗利シェア));
  }
  return null;
}

function buildStoreOrder(rows) {
  const orderMap = new Map();
  rows.forEach((row) => {
    if (!orderMap.has(row.店舗名)) {
      orderMap.set(row.店舗名, row.店舗表示順);
    }
  });
  return [...orderMap.entries()]
    .sort((a, b) => {
      const aOrder = Number.isFinite(a[1]) ? a[1] : Number.MAX_SAFE_INTEGER;
      const bOrder = Number.isFinite(b[1]) ? b[1] : Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder || a[0].localeCompare(b[0], "ja");
    })
    .map(([name]) => name);
}

function normalizeRows(rows) {
  return rows
      .map((source) => {
        const row = {
          年月: String(source["年月"] || source["対象年月"] || "").trim(),
          店舗名: String(source["店舗名"] || "").trim(),
          店舗表示順: toNumber(source["店舗表示順"]),
          レート区分: normalizeRate(source["レート区分"] || source["種別"] || source["レート"] || ""),
        台数: toNumber(source["台数"]),
        店舗全体台数: toNumber(source["店舗全体台数"]),
        台数シェア: toNumber(source["台数シェア"]),
        売上合計_千円: toNumber(source["売上合計_千円"] || source["売上合計(千円)"]),
        店舗全体売上_千円: toNumber(source["店舗全体売上_千円"]),
        売上シェア: toNumber(source["売上シェア"]),
        補粗利合計: toNumber(source["補粗利合計"]),
        店舗全体補粗利: toNumber(source["店舗全体補粗利"]),
        補粗利シェア: toNumber(source["補粗利シェア"]),
        売上差_pt: toNumber(source["売上差_pt"]),
        補粗利差_pt: toNumber(source["補粗利差_pt"]),
        平均差_pt: toNumber(source["平均差_pt"]),
        判定: String(source["判定"] || "").trim(),
        優先度: String(source["優先度"] || "").trim()
      };

      if (!row.年月 || !row.店舗名 || !row.レート区分) {
        return null;
      }

      row._computedFields = [];
      row.台数シェア = deriveShare(row.台数シェア, row.台数, row.店舗全体台数, row._computedFields, "台数シェア");
      row.売上シェア = deriveShare(row.売上シェア, row.売上合計_千円, row.店舗全体売上_千円, row._computedFields, "売上シェア");
      row.補粗利シェア = deriveShare(row.補粗利シェア, row.補粗利合計, row.店舗全体補粗利, row._computedFields, "補粗利シェア");
      if (!Number.isFinite(row.売上差_pt) && Number.isFinite(row.売上シェア) && Number.isFinite(row.台数シェア)) {
        row.売上差_pt = row.売上シェア - row.台数シェア;
      }
      if (!Number.isFinite(row.補粗利差_pt) && Number.isFinite(row.補粗利シェア) && Number.isFinite(row.台数シェア)) {
        row.補粗利差_pt = row.補粗利シェア - row.台数シェア;
      }
      if (!Number.isFinite(row.平均差_pt)) {
        row.平均差_pt = average([row.売上差_pt, row.補粗利差_pt]);
      }
      row.判定 = classifyRow(row, state.threshold);
      row.優先度 = row.優先度 || calcPriority(row);
      return row;
    })
    .filter(Boolean)
    .sort((a, b) => compareMonthAsc(a.年月, b.年月) || a.店舗名.localeCompare(b.店舗名, "ja"));
}

function deriveShare(existingValue, numerator, denominator, computedFields, fieldName) {
  if (Number.isFinite(existingValue)) {
    return existingValue;
  }
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator < 0) {
    return null;
  }
  if (denominator === 0) {
    if (numerator === 0) {
      computedFields.push(`${fieldName}:0`);
      return 0;
    }
    return null;
  }
  computedFields.push(fieldName);
  return (numerator / denominator) * 100;
}

function applyThreshold() {
  state.allRows.forEach((row) => {
    row.判定 = classifyRow(row, state.threshold);
    row.優先度 = calcPriority(row);
  });
}

function classifyRow(row, threshold) {
  if (!Number.isFinite(row.売上差_pt) || !Number.isFinite(row.補粗利差_pt)) return "適正";
  if (row.売上差_pt >= threshold && row.補粗利差_pt >= threshold) return "不足";
  if (row.売上差_pt <= -threshold && row.補粗利差_pt <= -threshold) return "過剰";
  if (Math.abs(row.売上差_pt) >= threshold || Math.abs(row.補粗利差_pt) >= threshold) return "要確認";
  return "適正";
}

function calcPriority(row) {
  const score = Math.max(Math.abs(row.売上差_pt || 0), Math.abs(row.補粗利差_pt || 0));
  if (score >= state.threshold + 3) return "高";
  if (score >= state.threshold) return "中";
  return "低";
}

function buildEmptyRow(month, store, rate) {
  return {
    年月: month,
    店舗名: store,
    レート区分: rate,
    台数シェア: null,
    売上シェア: null,
    補粗利シェア: null,
    売上差_pt: null,
    補粗利差_pt: null,
    平均差_pt: null,
    判定: "適正"
  };
}

function fillSelect(select, values, selected) {
  select.innerHTML = values.map((value) => `<option value="${value}">${value}</option>`).join("");
  select.value = selected;
}

function moveStoreSelection(direction) {
  const stores = state.stores;
  const index = stores.indexOf(state.selectedStore);
  if (index < 0) return;
  const nextIndex = Math.max(0, Math.min(stores.length - 1, index + direction));
  state.selectedStore = stores[nextIndex];
  els.storeSelect.value = state.selectedStore;
  render();
}

function buildImportMonthOptions(existingMonths) {
  const months = [...existingMonths];
  const latest = existingMonths[0];
  if (latest && /^\d{4}-\d{2}$/.test(latest)) {
    months.unshift(nextMonth(latest));
  }
  return unique(months);
}

function guessLatestMonth(rows) {
  const months = unique(rows.map((row) => String(row["年月"] || row["対象年月"] || "").trim())).filter(Boolean).sort(compareMonthDesc);
  return months[0] || "";
}

function parseJson(input) {
  const parsed = typeof input === "string" ? JSON.parse(input) : input;
  return Array.isArray(parsed) ? parsed : parsed.data || [];
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]).map((item) => item.replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce((acc, header, index) => {
      acc[header] = values[index] ? values[index].replace(/^"|"$/g, "") : "";
      return acc;
    }, {});
  });
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function buildSparkline(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return `<svg class="sparkline" viewBox="0 0 240 64" aria-hidden="true"></svg>`;
  const max = Math.max(...valid, 0);
  const min = Math.min(...valid, 0);
  const range = max - min || 1;
  const zeroY = 52 - ((0 - min) / range) * 40;
  const points = values.map((value, index) => {
    const x = (240 / Math.max(values.length - 1, 1)) * index;
    const safe = Number.isFinite(value) ? value : 0;
    const y = 52 - ((safe - min) / range) * 40;
    return `${x},${y}`;
  }).join(" ");
  return `
    <svg class="sparkline" viewBox="0 0 240 64" aria-hidden="true">
      <line x1="0" y1="${zeroY}" x2="240" y2="${zeroY}" stroke="#ccd5dd" stroke-width="1"></line>
      <polyline fill="none" stroke="#6c7f8d" stroke-width="2" points="${points}"></polyline>
    </svg>
  `;
}

function buildMatrixCell(row, month, rate) {
  if (!row) {
    return `<td class="matrix-cell">-</td>`;
  }
  const peerRows = state.allRows.filter((item) => item.年月 === month && item.レート区分 === rate);
  const seatTone = getMetricTone(row.台数シェア, peerRows.map((item) => item.台数シェア));
  const salesTone = getMetricTone(row.売上シェア, peerRows.map((item) => item.売上シェア));
  const profitTone = getMetricTone(row.補粗利シェア, peerRows.map((item) => item.補粗利シェア));
  const mainLabel = getMetricLabel();
  const mainValue = getMetricValue(row);
  const mainTone = getMetricToneByMetric(seatTone, salesTone, profitTone);
  const detailRows = buildDetailRows(row, seatTone, salesTone, profitTone);
  return `
    <td class="matrix-cell">
      <span class="matrix-main">
        <span class="matrix-seat-label">${mainLabel}</span>
        <span class="matrix-seat metric-chip ${mainTone.className}" style="--tone:${mainTone.strength}%;">${mainValue}</span>
      </span>
      <span class="matrix-shares">${detailRows}</span>
    </td>
  `;
}

function getMetricLabel() {
  if (state.selectedMetric === "all") return "台数";
  if (state.selectedMetric === "count") return "台数";
  if (state.selectedMetric === "seatShare") return "台数シェア";
  if (state.selectedMetric === "salesShare") return "売上シェア";
  if (state.selectedMetric === "profitShare") return "補粗利シェア";
  return "";
}

function getMetricValue(row) {
  if (state.selectedMetric === "all" || state.selectedMetric === "count") return `${formatCount(row.台数)}台`;
  if (state.selectedMetric === "seatShare") return formatPercent(row.台数シェア);
  if (state.selectedMetric === "salesShare") return formatPercent(row.売上シェア);
  if (state.selectedMetric === "profitShare") return formatPercent(row.補粗利シェア);
  return "";
}

function getMetricToneByMetric(seatTone, salesTone, profitTone) {
  if (state.selectedMetric === "all" || state.selectedMetric === "count") return { className: "metric-mid", strength: 26 };
  if (state.selectedMetric === "seatShare") return seatTone;
  if (state.selectedMetric === "salesShare") return salesTone;
  if (state.selectedMetric === "profitShare") return profitTone;
  return { className: "", strength: 0 };
}

function buildDetailRows(row, seatTone, salesTone, profitTone) {
  const items = [
    { key: "count", label: "台数", value: `${formatCount(row.台数)}台`, tone: { className: "metric-mid", strength: 26 } },
    { key: "seatShare", label: "台数シェア", value: formatPercent(row.台数シェア), tone: seatTone },
    { key: "salesShare", label: "売上シェア", value: formatPercent(row.売上シェア), tone: salesTone },
    { key: "profitShare", label: "補粗利シェア", value: formatPercent(row.補粗利シェア), tone: profitTone }
  ];
  if (state.selectedMetric === "all") {
    return items
      .slice(1)
      .map((item) => `<span class="matrix-share-row"><span>${item.label}</span><strong class="matrix-share-value ${item.tone.className}" style="--tone:${item.tone.strength}%;">${item.value}</strong></span>`)
      .join("");
  }
  return items
    .filter((item) => item.key !== state.selectedMetric)
    .slice(0, 0)
    .join("");
}

function getMetricTone(value, peerValues = []) {
  if (!Number.isFinite(value)) {
    return { className: "metric-mid", strength: 35 };
  }
  const sorted = peerValues.filter((item) => Number.isFinite(item)).sort((a, b) => a - b);
  if (!sorted.length) {
    return { className: "metric-mid", strength: 35 };
  }
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const range = max - min || 1;
  const strength = Math.round(28 + ((value - min) / range) * 38);
  const lowIndex = Math.floor((sorted.length - 1) / 3);
  const highIndex = Math.ceil(((sorted.length - 1) * 2) / 3);
  const lowThreshold = sorted[lowIndex];
  const highThreshold = sorted[highIndex];
  if (value >= highThreshold) {
    return { className: "metric-high", strength };
  }
  if (value <= lowThreshold) {
    return { className: "metric-low", strength };
  }
  return { className: "metric-mid", strength: Math.max(24, Math.min(strength, 44)) };
}

function getPreviousMonth(month, months) {
  const sorted = [...months].sort(compareMonthAsc);
  const index = sorted.indexOf(month);
  return index > 0 ? sorted[index - 1] : "";
}

function normalizeRate(value) {
  const text = String(value).trim();
  const map = {
    "P_4.00": "4円超P",
    "4円超パチンコ": "4円超P",
    "4円超P": "4円超P",
    "1円パチンコ": "1円P",
    "1円P": "1円P",
    "1円未満P": "1円未満P",
    "20円超パチスロ": "20円超S",
    "20円超S": "20円超S",
    "S_20.00": "20円超S",
    "5円スロット": "5円S",
    "5円S": "5円S",
    "5円未満S": "5円未満S"
  };
  return map[text] || text;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const sanitized = String(value).replace(/,/g, "").replace(/%/g, "");
  const num = Number.parseFloat(sanitized);
  return Number.isFinite(num) ? num : null;
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : "-";
}

function formatCount(value) {
  return Number.isFinite(value) ? value.toLocaleString("ja-JP") : "-";
}

function formatPoint(value) {
  return Number.isFinite(value) ? `${value >= 0 ? "+" : ""}${value.toFixed(1)}pt` : "-";
}

function compareMonthAsc(a, b) {
  return a.localeCompare(b, "ja");
}

function compareMonthDesc(a, b) {
  return compareMonthAsc(b, a);
}

function nextMonth(month) {
  const [yearText, monthText] = month.split("-");
  const year = Number.parseInt(yearText, 10);
  const monthNumber = Number.parseInt(monthText, 10);
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber)) {
    return month;
  }
  const date = new Date(year, monthNumber - 1, 1);
  date.setMonth(date.getMonth() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildFallbackSampleData() {
  const months = ["2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"];
  const stores = [
    { name: "沼田店", seats: 760, sales: 460000, profit: 82000 },
    { name: "渋川インター店", seats: 710, sales: 438000, profit: 69200 },
    { name: "中之条店", seats: 455, sales: 156000, profit: 24100 },
    { name: "前橋東店", seats: 680, sales: 392000, profit: 60100 }
  ];
  const profiles = {
    "4円超P": { seat: 29 },
    "1円P": { seat: 24 },
    "1円未満P": { seat: 6 },
    "20円超S": { seat: 27 },
    "5円S": { seat: 9 },
    "5円未満S": { seat: 5 }
  };
  const bias = {
    "沼田店": { "4円超P": 1.8, "1円P": -2.6, "1円未満P": -1.2, "20円超S": 2.7, "5円S": -1.5, "5円未満S": -0.6 },
    "渋川インター店": { "4円超P": -1.3, "1円P": 1.1, "1円未満P": 2.4, "20円超S": 0.8, "5円S": -2.4, "5円未満S": -1.0 },
    "中之条店": { "4円超P": 2.9, "1円P": -1.1, "1円未満P": -2.8, "20円超S": -1.7, "5円S": 2.6, "5円未満S": 0.5 },
    "前橋東店": { "4円超P": -2.1, "1円P": 1.8, "1円未満P": 1.2, "20円超S": 2.1, "5円S": -0.8, "5円未満S": -2.2 }
  };

  const rows = [];
  months.forEach((month, monthIndex) => {
    stores.forEach((store, storeIndex) => {
      RATE_ORDER.forEach((rate, rateIndex) => {
        const baseSeat = profiles[rate].seat;
        const trend = ((monthIndex - 3) * 0.22) + ((rateIndex % 2 === 0 ? 1 : -1) * 0.18);
        const wobble = ((storeIndex + 1) * (rateIndex + 2) % 5) * 0.25 - 0.5;
        const saleDiff = bias[store.name][rate] + trend + wobble;
        const profitDiff = saleDiff + (((monthIndex + rateIndex) % 3) - 1) * 0.7;
        const salesShare = baseSeat + saleDiff;
        const profitShare = baseSeat + profitDiff;
        rows.push({
          "年月": month,
          "店舗名": store.name,
          "レート区分": rate,
          "台数": round(store.seats * (baseSeat / 100), 0),
          "店舗全体台数": store.seats,
          "台数シェア": round(baseSeat, 1),
          "売上合計_千円": round(store.sales * (salesShare / 100), 0),
          "店舗全体売上_千円": store.sales,
          "売上シェア": round(salesShare, 1),
          "補粗利合計": round(store.profit * (profitShare / 100), 0),
          "店舗全体補粗利": store.profit,
          "補粗利シェア": round(profitShare, 1),
          "売上差_pt": round(saleDiff, 1),
          "補粗利差_pt": round(profitDiff, 1),
          "平均差_pt": round((saleDiff + profitDiff) / 2, 1)
        });
      });
    });
  });
  return rows;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
