const RATE_ORDER = ["4円超P", "1円P", "1円未満P", "20円超S", "5円S", "5円未満S"];
const AI_TARGET_RATES = new Set(["4円超P", "20円超S"]);
const IMPORT_PASSWORD = "Nexus3939";
const ACCESS_PASSWORD = "7777";
const LOCAL_DATA_KEY = "ps-share-dashboard-saved-data";
const RAW_TOTAL_FILE_PREFIX = "チェーン店レポート_種別_店舗全体実績";
const RAW_RATE_FILE_PREFIXES = {
  "4円超P": "チェーン店レポート_種別_4円超パチンコ",
  "1円P": "チェーン店レポート_種別_1円パチンコ",
  "1円未満P": "チェーン店レポート_種別_1円未満P",
  "20円超S": "チェーン店レポート_種別_20円超パチスロ",
  "5円S": "チェーン店レポート_種別_5円スロット",
  "5円未満S": "チェーン店レポート_種別_5円未満S"
};
const AI_DIAGNOSIS_TOOLTIP = "判定は直近3か月平均です。過少傾向の月は ((売上シェア-台数シェア)+(補粗利シェア-台数シェア))/2、過多傾向の月は -(((台数シェア-売上シェア)+(台数シェア-補粗利シェア))/2) で月次強度を出し、直近3か月平均を AI強度 とします。表示ptは min(100, abs(AI強度)×4) です。pt が高いほど優先度が高いです。";
const STATUS_CLASS = {
  "不足": "status-shortage",
  "過剰": "status-excess",
  "要確認": "status-watch",
  "適正": "status-proper"
};

const els = {
  dashboard: document.querySelector("#dashboard"),
  emptyState: document.querySelector("#emptyState"),
  accessGate: document.querySelector("#accessGate"),
  accessPasswordInput: document.querySelector("#accessPasswordInput"),
  accessUnlockButton: document.querySelector("#accessUnlockButton"),
  accessError: document.querySelector("#accessError"),
  dashboardTitle: document.querySelector("#dashboardTitle"),
  storeSelect: document.querySelector("#storeSelect"),
  storePrevButton: document.querySelector("#storePrevButton"),
  storeNextButton: document.querySelector("#storeNextButton"),
  rateSelect: document.querySelector("#rateSelect"),
  metricSelect: document.querySelector("#metricSelect"),
  exportExcelButton: document.querySelector("#exportExcelButton"),
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
  clearSavedDataButton: document.querySelector("#clearSavedDataButton"),
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
  const savedRows = loadSavedRows();
  if (savedRows.length) {
    loadData(savedRows, "saved-local-data");
    return;
  }
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
  els.accessUnlockButton.addEventListener("click", unlockAccessGate);
  els.accessPasswordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      unlockAccessGate();
    }
  });

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

  els.exportExcelButton.addEventListener("click", async () => {
    await exportCurrentView();
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

  els.clearSavedDataButton.addEventListener("click", async () => {
    clearSavedRows();
    els.importStatus.textContent = "保存データをクリアしました。公開データを再読み込みします。";
    state.importPanelOpen = false;
    updateImportPanel();
    await init();
  });

}

function unlockAccessGate() {
  if (els.accessPasswordInput.value === ACCESS_PASSWORD) {
    els.accessGate.classList.add("hidden");
    els.accessError.classList.add("hidden");
    return;
  }
  els.accessError.classList.remove("hidden");
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
    const targetMonth = state.importMonth || guessLatestMonth(rows);
    const normalizedRows = applyImportMonth(rows, targetMonth);
    const mergedRows = mergeImportedRows(state.allRows, normalizedRows);
    const targetMonths = unique(
      normalizedRows
        .map((row) => String(row["年月"] || row["対象年月"] || "").trim())
        .filter(Boolean)
    ).sort(compareMonthAsc);
    const targetLabel = targetMonths.length ? targetMonths.join(", ") : (targetMonth || "-");
    const confirmed = window.confirm(`${targetLabel} を既存データへ反映して保存しますか？`);
    if (!confirmed) {
      els.importStatus.textContent = "取込をキャンセルしました";
      input.value = "";
      return;
    }
    saveRowsToLocal(mergedRows);
    loadData(mergedRows, file.name);
    els.importStatus.textContent = `${file.name} を保存しました。反映月 ${targetLabel}`;
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
  const csvEntries = [];
  for (const entry of entries) {
    const name = entry.name.toLowerCase();
    if (name.endsWith(".json")) {
      rowSets.push(parseJson(decodeText(await entry.async("uint8array"))));
    } else if (name.endsWith(".csv")) {
      csvEntries.push({
        name: entry.name,
        text: decodeText(await entry.async("uint8array"))
      });
    }
  }

  const directDashboardRows = rowSets.flat().concat(
    csvEntries
      .filter((entry) => /dashboard-data|sample-data/i.test(entry.name))
      .flatMap((entry) => parseCsv(entry.text))
  );
  if (directDashboardRows.length) {
    return directDashboardRows;
  }

  const rawMonthlyRows = buildDashboardRowsFromRawZip(csvEntries);
  if (rawMonthlyRows.length) {
    return rawMonthlyRows;
  }

  const looseCsvRows = csvEntries.flatMap((entry) => parseCsv(entry.text));
  if (looseCsvRows.length) {
    return looseCsvRows;
  }

  throw new Error("ZIP内に利用できるCSVまたはJSONがありません");
}

function applyImportMonth(rows, month) {
  if (!month) return rows;
  return rows.map((row) => ({
    ...row,
    年月: month,
    対象年月: month
  }));
}

function mergeImportedRows(baseRows, importedRows) {
  if (!importedRows.length) {
    return [...baseRows];
  }
  const importedMonths = new Set(
    importedRows
      .map((row) => String(row["年月"] || row["対象年月"] || "").trim())
      .filter(Boolean)
  );
  const remainingRows = baseRows.filter((row) => !importedMonths.has(String(row["年月"] || "").trim()));
  return [...remainingRows, ...importedRows];
}

function loadSavedRows() {
  try {
    const raw = window.localStorage.getItem(LOCAL_DATA_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveRowsToLocal(rows) {
  try {
    window.localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(rows));
  } catch (error) {
    console.warn("localStorage save failed", error);
  }
}

function clearSavedRows() {
  try {
    window.localStorage.removeItem(LOCAL_DATA_KEY);
  } catch (error) {
    console.warn("localStorage remove failed", error);
  }
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
      tr.innerHTML = `
        <td>${store}</td>
        <td>${rate}</td>
        ${monthCells}
        <td class="ai-col-cell">${buildAiDiagnosis(store, rate)}</td>
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

function getViewContext() {
  const monthsAsc = getVisibleMonths();
  const allRealStores = state.stores.filter((store) => store !== "全店舗");
  const baseStores = state.selectedStore === "全店舗" ? allRealStores : [state.selectedStore];
  const requestedRates = state.selectedRate === "全レート" ? RATE_ORDER : [state.selectedRate];
  const targetRates = requestedRates.filter((rate) => rateHasAnySeats(baseStores, rate));
  const targetStores = sortStoresForView(baseStores, targetRates);
  return { monthsAsc, targetStores, targetRates };
}

async function exportCurrentView() {
  const { monthsAsc, targetStores, targetRates } = getViewContext();
  if (!monthsAsc.length || !targetStores.length || !targetRates.length) {
    window.alert("出力できるデータがありません");
    return;
  }
  if (!window.ExcelJS) {
    window.alert("Excel出力ライブラリを読み込めませんでした");
    return;
  }

  const workbook = new window.ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Share Dashboard");
  const headers = ["店舗", "レート"];
  monthsAsc.forEach((month) => {
    if (state.selectedMetric === "all") {
      headers.push(`${month}_台数`, `${month}_台数シェア`, `${month}_売上シェア`, `${month}_補粗利シェア`);
    } else {
      headers.push(month);
    }
  });
  headers.push("AI診断");
  sheet.addRow(headers);

  const firstRow = sheet.getRow(1);
  firstRow.font = { bold: true, color: { argb: "FF334155" } };
  firstRow.alignment = { vertical: "middle", horizontal: "center" };
  firstRow.height = 22;
  firstRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F5F7" } };
    cell.border = bottomBorder();
  });

  targetStores.forEach((store) => {
    targetRates.forEach((rate) => {
      if (!storeRateHasAnySeats(store, rate)) {
        return;
      }
      const values = [store, rate];
      const cellMeta = [];

      monthsAsc.forEach((month) => {
        const row = state.allRows.find((item) => item.年月 === month && item.店舗名 === store && item.レート区分 === rate);
        const peerRows = state.allRows.filter((item) => item.年月 === month && item.レート区分 === rate);
        const seatTone = getMetricTone(row?.台数シェア, peerRows.map((item) => item.台数シェア));
        const salesTone = getMetricTone(row?.売上シェア, peerRows.map((item) => item.売上シェア));
        const profitTone = getMetricTone(row?.補粗利シェア, peerRows.map((item) => item.補粗利シェア));

        if (state.selectedMetric === "all") {
          values.push(Number.isFinite(row?.台数) ? row.台数 : "");
          values.push(formatPercentCsv(row?.台数シェア));
          values.push(formatPercentCsv(row?.売上シェア));
          values.push(formatPercentCsv(row?.補粗利シェア));
          cellMeta.push(
            { tone: { className: "metric-mid", strength: 26 }, type: "count" },
            { tone: seatTone, type: "percent" },
            { tone: salesTone, type: "percent" },
            { tone: profitTone, type: "percent" }
          );
        } else if (state.selectedMetric === "count") {
          values.push(Number.isFinite(row?.台数) ? row.台数 : "");
          cellMeta.push({ tone: { className: "metric-mid", strength: 26 }, type: "count" });
        } else if (state.selectedMetric === "seatShare") {
          values.push(formatPercentCsv(row?.台数シェア));
          cellMeta.push({ tone: seatTone, type: "percent" });
        } else if (state.selectedMetric === "salesShare") {
          values.push(formatPercentCsv(row?.売上シェア));
          cellMeta.push({ tone: salesTone, type: "percent" });
        } else if (state.selectedMetric === "profitShare") {
          values.push(formatPercentCsv(row?.補粗利シェア));
          cellMeta.push({ tone: profitTone, type: "percent" });
        }
      });

      values.push(stripHtml(buildAiDiagnosis(store, rate)));
      const excelRow = sheet.addRow(values);
      styleExportRow(excelRow, cellMeta);
    });
  });

  sheet.views = [{ state: "frozen", xSplit: 2, ySplit: 1 }];
  sheet.columns.forEach((column, index) => {
    if (index < 2) {
      column.width = index === 0 ? 16 : 12;
    } else if (index === sheet.columns.length - 1) {
      column.width = 14;
    } else {
      column.width = state.selectedMetric === "all" ? 13 : 12;
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBinary(buffer, buildExportFileName());
}

function buildExportFileName() {
  const metricLabels = {
    all: "全表示",
    count: "台数",
    seatShare: "台数シェア",
    salesShare: "売上シェア",
    profitShare: "補粗利シェア"
  };
  const store = state.selectedStore === "全店舗" ? "全店舗" : state.selectedStore;
  const rate = state.selectedRate === "全レート" ? "全レート" : state.selectedRate;
  const period = `${state.periodStart || "start"}_${state.periodEnd || "end"}`;
  return `share-dashboard_${store}_${rate}_${metricLabels[state.selectedMetric] || "出力"}_${period}.xlsx`;
}

function downloadBinary(buffer, fileName) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]*>/g, "").trim();
}

function styleExportRow(row, cellMeta) {
  row.height = 22;
  row.eachCell((cell, colNumber) => {
    cell.border = bottomBorder();
    cell.alignment = {
      vertical: "middle",
      horizontal: colNumber <= 2 ? "left" : "right"
    };
    if (colNumber <= 2) {
      return;
    }
    if (colNumber === row.cellCount) {
      cell.alignment = { vertical: "middle", horizontal: "center" };
      if (String(cell.value || "").includes("過少")) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3F1E5" } };
        cell.font = { color: { argb: "FF1F5A2A" }, bold: true };
      } else if (String(cell.value || "").includes("過多")) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF7E2E2" } };
        cell.font = { color: { argb: "FF953F3F" }, bold: true };
      }
      return;
    }
    const meta = cellMeta[colNumber - 3];
    if (!meta) {
      return;
    }
    const fillColor = getExcelToneColor(meta.tone.className, meta.tone.strength);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
  });
}

function bottomBorder() {
  return {
    bottom: { style: "thin", color: { argb: "FFE5EAF0" } }
  };
}

function getExcelToneColor(className, strength) {
  const safeStrength = Math.max(0, Math.min(100, Number(strength) || 0));
  if (className === "metric-high") {
    return mixHex("FFFFFF", "CFE7D0", safeStrength / 100);
  }
  if (className === "metric-low") {
    return mixHex("FFFFFF", "F1CFCF", safeStrength / 100);
  }
  return mixHex("FFFFFF", "EDF1F4", Math.max(0.2, safeStrength / 100));
}

function mixHex(baseHex, targetHex, ratio) {
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);
  const mix = {
    r: Math.round(base.r + (target.r - base.r) * ratio),
    g: Math.round(base.g + (target.g - base.g) * ratio),
    b: Math.round(base.b + (target.b - base.b) * ratio)
  };
  return `FF${rgbToHex(mix.r)}${rgbToHex(mix.g)}${rgbToHex(mix.b)}`;
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function rgbToHex(value) {
  return value.toString(16).padStart(2, "0").toUpperCase();
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

function buildAiDiagnosis(store, rate) {
  if (!AI_TARGET_RATES.has(rate)) {
    return "";
  }
  const score = getRateAiTrendScore(store, rate);
  if (score === null) {
    return "";
  }
  const scoreLabel = formatAiPriorityPoints(score);
  if (score > 0) {
    return `<span class="ai-diagnosis ai-shortage" title="${AI_DIAGNOSIS_TOOLTIP}"><span class="ai-label">過少傾向</span><span class="ai-score">${scoreLabel}</span></span>`;
  }
  if (score < 0) {
    return `<span class="ai-diagnosis ai-excess" title="${AI_DIAGNOSIS_TOOLTIP}"><span class="ai-label">過多傾向</span><span class="ai-score">${scoreLabel}</span></span>`;
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
  const rows = targetRates
    .filter((rate) => AI_TARGET_RATES.has(rate))
    .map((rate) => getRateAiTrendScore(store, rate))
    .filter((score) => score !== null);
  if (!rows.length) return null;
  return average(rows.map((score) => getAiPriorityPoints(score)));
}

function getRateAiTrendScore(store, rate) {
  const months = getVisibleMonths().slice(-3);
  if (!months.length) {
    return null;
  }
  const scores = months
    .map((month) => state.allRows.find((item) => item.年月 === month && item.店舗名 === store && item.レート区分 === rate))
    .filter(Boolean)
    .map((row) => {
      if (
        Number.isFinite(row.売上シェア) &&
        Number.isFinite(row.補粗利シェア) &&
        Number.isFinite(row.台数シェア)
      ) {
        if (row.売上シェア > row.補粗利シェア && row.補粗利シェア > row.台数シェア) {
          return ((row.売上シェア - row.台数シェア) + (row.補粗利シェア - row.台数シェア)) / 2;
        }
        if (row.売上シェア < row.補粗利シェア && row.補粗利シェア < row.台数シェア) {
          return -(((row.台数シェア - row.売上シェア) + (row.台数シェア - row.補粗利シェア)) / 2);
        }
      }
      return 0;
    });
  if (!scores.length) {
    return null;
  }
  return average(scores);
}

function formatAiPriorityPoints(value) {
  if (!Number.isFinite(value)) {
    return "";
  }
  return `${Math.round(getAiPriorityPoints(value))}pt`;
}

function getAiPriorityPoints(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.abs(value) * 4);
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

function decodeText(uint8Array) {
  const encodings = ["utf-8", "shift-jis"];
  for (const encoding of encodings) {
    try {
      const text = new TextDecoder(encoding).decode(uint8Array);
      if (text.includes("店舗名") || text.includes("年月") || text.includes("レート区分")) {
        return text;
      }
      if (encoding === "utf-8" && text.charCodeAt(0) === 0xfeff) {
        return text;
      }
      if (encoding === "utf-8") {
        return text;
      }
    } catch (error) {
      continue;
    }
  }
  return new TextDecoder("utf-8").decode(uint8Array);
}

function buildDashboardRowsFromRawZip(csvEntries) {
  if (!csvEntries.length) {
    return [];
  }

  const totalEntry = csvEntries.find((entry) => entry.name.includes(RAW_TOTAL_FILE_PREFIX));
  if (!totalEntry) {
    return [];
  }

  const totals = indexRowsByStore(parseCsv(totalEntry.text));
  if (!Object.keys(totals).length) {
    return [];
  }

  const latestStoreOrder = loadZipStoreOrder(csvEntries);
  const detectedMonth = detectMonthFromZipEntries(csvEntries);
  const rateMaps = Object.fromEntries(
    Object.entries(RAW_RATE_FILE_PREFIXES).map(([rate, prefix]) => {
      const entry = csvEntries.find((item) => item.name.includes(prefix));
      return [rate, indexRowsByStore(entry ? parseCsv(entry.text) : [])];
    })
  );

  const rows = [];
  Object.entries(totals).forEach(([storeName, totalRow]) => {
    RATE_ORDER.forEach((rate) => {
      const rateRow = rateMaps[rate]?.[storeName] || {};
      const seatCount = toNumber(rateRow["台数"]) ?? 0;
      const totalSeats = toNumber(totalRow["台数"]);
      const sales = toNumber(rateRow["売上合計(千円)"]) ?? 0;
      const totalSales = toNumber(totalRow["売上合計(千円)"]);
      const profit = toNumber(rateRow["補粗利合計"]) ?? 0;
      const totalProfit = toNumber(totalRow["補粗利合計"]);
      const seatShare = calcShare(seatCount, totalSeats);
      const salesShare = calcShare(sales, totalSales);
      const profitShare = calcShare(profit, totalProfit);
      const salesDiff = diffOrNone(salesShare, seatShare);
      const profitDiff = diffOrNone(profitShare, seatShare);
      const avgDiff = average([salesDiff, profitDiff]);

      rows.push({
        年月: detectedMonth,
        店舗名: storeName,
        店舗表示順: latestStoreOrder[storeName] ?? null,
        レート区分: rate,
        台数: roundCount(seatCount),
        店舗全体台数: roundCount(totalSeats),
        台数シェア: roundMaybe(seatShare),
        売上合計_千円: roundCount(sales),
        店舗全体売上_千円: roundCount(totalSales),
        売上シェア: roundMaybe(salesShare),
        補粗利合計: roundCount(profit),
        店舗全体補粗利: roundCount(totalProfit),
        補粗利シェア: roundMaybe(profitShare),
        売上差_pt: roundMaybe(salesDiff),
        補粗利差_pt: roundMaybe(profitDiff),
        平均差_pt: roundMaybe(avgDiff),
        判定: classifyDiffs(salesDiff, profitDiff, state.threshold),
        優先度: calcPriorityFromDiffs(salesDiff, profitDiff, state.threshold)
      });
    });
  });

  return rows;
}

function loadZipStoreOrder(csvEntries) {
  const entry = csvEntries.find((item) => item.name.includes(RAW_RATE_FILE_PREFIXES["4円超P"]));
  if (!entry) {
    return {};
  }
  const order = {};
  parseCsv(entry.text).forEach((row, index) => {
    const storeName = normalizeStoreName(row["店舗名"]);
    if (!storeName) return;
    order[storeName] = index + 1;
  });
  return order;
}

function indexRowsByStore(rows) {
  return rows.reduce((acc, row) => {
    const storeName = normalizeStoreName(row["店舗名"]);
    if (!storeName) {
      return acc;
    }
    acc[storeName] = row;
    return acc;
  }, {});
}

function normalizeStoreName(value) {
  const text = String(value || "").trim();
  if (!text || text === "店舗平均") {
    return "";
  }
  return text.replace(/^\d+\s+/, "");
}

function detectMonthFromZipEntries(csvEntries) {
  const matchedName = csvEntries.map((entry) => entry.name).find((name) => /\d{8}/.test(name));
  if (!matchedName) {
    return state.importMonth || "";
  }
  const match = matchedName.match(/(\d{4})(\d{2})\d{2}/);
  if (!match) {
    return state.importMonth || "";
  }
  return `${match[1]}-${match[2]}`;
}

function calcShare(part, total) {
  if (!Number.isFinite(part) || !Number.isFinite(total)) {
    return null;
  }
  if (total === 0) {
    return part === 0 ? 0 : null;
  }
  return (part / total) * 100;
}

function diffOrNone(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return null;
  }
  return a - b;
}

function roundMaybe(value) {
  return Number.isFinite(value) ? round(value, 1) : null;
}

function roundCount(value) {
  return Number.isFinite(value) ? Math.round(value) : null;
}

function classifyDiffs(salesDiff, profitDiff, threshold) {
  if (!Number.isFinite(salesDiff) || !Number.isFinite(profitDiff)) return "適正";
  if (salesDiff >= threshold && profitDiff >= threshold) return "不足";
  if (salesDiff <= -threshold && profitDiff <= -threshold) return "過剰";
  if (Math.abs(salesDiff) >= threshold || Math.abs(profitDiff) >= threshold) return "要確認";
  return "適正";
}

function calcPriorityFromDiffs(salesDiff, profitDiff, threshold) {
  const score = Math.max(Math.abs(salesDiff || 0), Math.abs(profitDiff || 0));
  if (score >= threshold + 3) return "高";
  if (score >= threshold) return "中";
  return "低";
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

function formatPercentCsv(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : "";
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
