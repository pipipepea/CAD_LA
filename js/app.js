// ============================================================================
// MODULE: js/app.js
// Bộ điều khiển chính của ứng dụng THÔNG SỐ VÁCH CAD - ISO STANDARD PRO (v3)
// Hỗ trợ Tự động Xoay 6 Tư Thế 3D (Đứng / Dọc / Đặt nằm phẳng) & Tên file chuẩn
// ============================================================================

window.APP_STATE = {
  items: [...window.DEFAULT_EXCEL_ITEMS],
  selectedIndex: 0,
  excelCollapsed: false,
  orientationMatrixOpen: true,
  selectedOriId: "stand_W_1",
  activeFootprint: { x: 196, y: 15, h: 179, label: "Đứng ngang (196×15, Cao=179)" },
  zoom: 0.76,
  panX: 0,
  panY: 0,
  isPanning: false,
  startPanX: 0,
  startPanY: 0,
  viewMode: "master", // 'master' | 'layout' | '3d'
  lineWeightMode: "hairline", // 'hairline' | 'standard' | 'bold'
  bgTheme: "autocad", // 'autocad' | 'blueprint' | 'paper'
  colors: {
    vd: "#facc15",
    vn: "#f472b6",
    bd: "#4ade80",
    bn: "#fb923c",
    slot: "#f87171",
    frame: "#38bdf8"
  }
};

function getMasterFileBaseName() {
  const g = computeCadGeometry();
  const item = window.APP_STATE.items[window.APP_STATE.selectedIndex] || { partCode: "SANPHAM" };
  const cleanCode = String(item.partCode || "SANPHAM").trim().replace(/\s+/g, "_");
  return `MASTER_CAD_${cleanCode}_${g.nx}x${g.ny}_${g.totalCells}CELLS`;
}

function getRuleConfig() {
  const modeEl = document.getElementById("packingRuleMode");
  const mode = modeEl ? modeEl.value : "mult10";
  const multVal = parseInt(document.getElementById("customMultValue")?.value, 10) || 10;
  const targetVal = parseInt(document.getElementById("exactTargetValue")?.value, 10) || 20;
  return { mode, multVal, targetVal };
}

function checkTotalMatchesRule(total, ruleConfig) {
  const { mode, multVal, targetVal } = ruleConfig;
  if (mode === "free") return { ok: true, text: `TỰ DO (${total} Ô)` };
  if (mode === "mult10") return { ok: total % 10 === 0, text: total % 10 === 0 ? "BỘI CỦA 10 OK" : `LẺ (${total} Ô - KHÔNG CHIA HẾT 10)` };
  if (mode === "mult5") return { ok: total % 5 === 0, text: total % 5 === 0 ? "BỘI CỦA 5 OK" : `LẺ (${total} Ô - KHÔNG CHIA HẾT 5)` };
  if (mode === "mult2") return { ok: total % 2 === 0, text: total % 2 === 0 ? "SỐ CHẴN OK" : `SỐ LẺ (${total} Ô)` };
  if (mode === "custom_mult") return { ok: total % multVal === 0, text: total % multVal === 0 ? `BỘI CỦA ${multVal} OK` : `KHÔNG CHIA HẾT CHO ${multVal}` };
  if (mode === "exact_target") return { ok: total === targetVal, text: total === targetVal ? `ĐÚNG ${targetVal} Ô OK` : `HIỆN TẠI ${total}/${targetVal} Ô` };
  return { ok: true, text: `${total} Ô` };
}

function toggleExcelPanel() {
  window.APP_STATE.excelCollapsed = !window.APP_STATE.excelCollapsed;
  const bodyEl = document.getElementById("excelCollapsibleBody");
  const btnIcon = document.getElementById("excelToggleIcon");
  const btnText = document.getElementById("excelToggleText");
  const summaryPill = document.getElementById("excelCollapsedSummary");

  if (window.APP_STATE.excelCollapsed) {
    bodyEl.classList.add("excel-collapsed");
    if (btnIcon) btnIcon.textContent = "▼";
    if (btnText) btnText.textContent = "Mở rộng bảng Excel";
    if (summaryPill) summaryPill.classList.remove("hidden");
  } else {
    bodyEl.classList.remove("excel-collapsed");
    if (btnIcon) btnIcon.textContent = "▲";
    if (btnText) btnText.textContent = "Thu gọn vùng này";
    if (summaryPill) summaryPill.classList.add("hidden");
  }
  setTimeout(renderMainCanvas, 290);
}

function toggleOrientationMatrix() {
  window.APP_STATE.orientationMatrixOpen = !window.APP_STATE.orientationMatrixOpen;
  const box = document.getElementById("orientationMatrixBody");
  const btn = document.getElementById("btnToggleOriMatrix");
  if (box) box.classList.toggle("hidden", !window.APP_STATE.orientationMatrixOpen);
  if (btn) btn.textContent = window.APP_STATE.orientationMatrixOpen ? "▲ Ẩn bảng xoay 6 tư thế" : "▼ Mở bảng xoay 6 tư thế 3D";
}

// Render 6-Orientation Rotation Matrix (Standing, Vertical, Laying Flat & 90° Rotations)
function renderOrientationMatrix() {
  const container = document.getElementById("orientationMatrixGrid");
  if (!container) return;
  const item = window.APP_STATE.items[window.APP_STATE.selectedIndex] || window.APP_STATE.items[0];
  if (!item) return;

  const wallThick = parseFloat(document.getElementById("inp_tX")?.value) || 4;
  const ruleCfg = getRuleConfig();
  const evals = evaluateAll6Orientations(item, wallThick, 2, ruleCfg);

  container.innerHTML = "";
  evals.forEach(ev => {
    const isSelected = window.APP_STATE.selectedOriId === ev.ori.id;
    let badgeHtml = "";
    if (!ev.feasible) {
      badgeHtml = `<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/40">✕ VƯỢT KHỔ THÙNG</span>`;
    } else if (ev.matchesRule) {
      badgeHtml = `<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">✓ ĐẠT CHUẨN (${ev.bestTotal} Ô)</span>`;
    } else {
      badgeHtml = `<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40">⚠ TỐI ĐA ${ev.maxTotal} Ô (LẺ)</span>`;
    }

    const card = document.createElement("div");
    card.className = `rounded-xl p-2.5 border transition flex flex-col justify-between gap-2 ${
      isSelected
        ? "bg-sky-500/15 border-sky-400 shadow-lg"
        : ev.matchesRule
        ? "bg-slate-900/90 border-slate-700/90 hover:border-sky-500/60"
        : "bg-slate-950/80 border-slate-800/80 hover:border-amber-500/50"
    }`;

    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between gap-1.5 mb-1">
          <span class="text-xs font-extrabold text-white">${ev.ori.shortName}</span>
          ${badgeHtml}
        </div>
        <div class="text-[11px] text-slate-400 mb-1.5">${ev.ori.desc}</div>
        <div class="grid grid-cols-2 gap-1.5 bg-slate-950/90 border border-slate-800 rounded-lg p-1.5 text-[11px] mono">
          <div><span class="text-slate-400">Tiết diện SP:</span> <b class="text-amber-300">${ev.ori.fX}×${ev.ori.fY}mm</b></div>
          <div><span class="text-slate-400">Cao SP / Vách:</span> <b class="text-sky-300">${ev.ori.hPart} / ${ev.recWallH}mm</b></div>
          <div><span class="text-slate-400">Layout chuẩn:</span> <b class="text-emerald-300">${ev.feasible ? `${ev.bestTotal} ô (${ev.bestNx}×${ev.bestNy})` : "0 ô"}</b></div>
          <div><span class="text-slate-400">Xếp tối đa:</span> <b class="text-white">${ev.maxTotal} ô (${ev.maxNx}×${ev.maxNy})</b></div>
        </div>
        <div class="mt-1.5 text-[10px] ${ev.matchesRule ? "text-emerald-300" : "text-amber-300"} leading-snug">
          • ${ev.reason}
        </div>
      </div>
      <div class="flex items-center gap-1.5 pt-1 border-t border-slate-800/80">
        <button class="btn-apply-std flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition ${
          ev.feasible
            ? "bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 border border-sky-500/40"
            : "bg-slate-800 text-slate-500 cursor-not-allowed"
        }">
          🔄 Thử Layout (${ev.bestNx}×${ev.bestNy} = ${ev.bestTotal} ô)
        </button>
        ${
          ev.feasible && ev.maxTotal !== ev.bestTotal
            ? `<button class="btn-apply-max py-1 px-2 rounded-lg text-[11px] font-semibold bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-500/40 transition" title="Thử xếp tối đa số ô vật lý">
                 Max ${ev.maxTotal} ô
               </button>`
            : ""
        }
      </div>
    `;

    const btnStd = card.querySelector(".btn-apply-std");
    if (btnStd && ev.feasible) {
      btnStd.onclick = () => applyOrientationEvaluation(item, ev, false);
    }
    const btnMax = card.querySelector(".btn-apply-max");
    if (btnMax && ev.feasible) {
      btnMax.onclick = () => applyOrientationEvaluation(item, ev, true);
    }

    container.appendChild(card);
  });
}

function applyOrientationEvaluation(item, ev, useMax) {
  window.APP_STATE.selectedOriId = ev.ori.id;
  const nx = useMax ? ev.maxNx : ev.bestNx;
  const ny = useMax ? ev.maxNy : ev.bestNy;

  document.getElementById("inp_L").value = ev.L_part;
  document.getElementById("inp_W").value = ev.W_part;
  document.getElementById("inp_offX").value = 5;
  document.getElementById("inp_offY").value = 5;
  document.getElementById("inp_nx").value = nx;
  document.getElementById("inp_ny").value = ny;
  document.getElementById("inp_hVD").value = ev.recWallH;
  document.getElementById("inp_hVN").value = ev.recWallH;
  document.getElementById("inp_hBao").value = ev.recWallH;
  document.getElementById("inp_slotDepthVD").value = (ev.recWallH / 2).toFixed(2);
  document.getElementById("inp_slotDepthVN").value = (ev.recWallH / 2).toFixed(2);

  window.APP_STATE.activeFootprint = {
    x: ev.ori.fX,
    y: ev.ori.fY,
    h: ev.ori.hPart,
    label: ev.ori.label
  };

  renderOrientationMatrix();
  updateUIAndRender();
}

// Quick swap footprint X <-> Y (Rotate product 90 deg in the horizontal plane)
function rotateActiveProduct90() {
  const fp = window.APP_STATE.activeFootprint;
  if (!fp) return;
  window.APP_STATE.activeFootprint = {
    x: fp.y,
    y: fp.x,
    h: fp.h,
    label: `Xoay 90° (Ô=${fp.y}×${fp.x}, Cao=${fp.h})`
  };
  updateUIAndRender();
}

// Floating Hover Diagnostic Preview when pointing mouse at any Excel row
function showRowHoverPreview(evt, idx) {
  const item = window.APP_STATE.items[idx];
  const tooltip = document.getElementById("rowHoverTooltip");
  if (!item || !tooltip) return;

  const wallThick = parseFloat(document.getElementById("inp_tX")?.value) || 4;
  const summary = evaluateRowQuickSummary(item, wallThick, getRuleConfig());

  const statusBadge = summary.best
    ? (summary.ok
        ? `<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">✓ ${summary.statusText}</span>`
        : `<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40">⚠ ${summary.statusText}</span>`)
    : `<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-500/25 text-rose-300 border border-rose-500/50">✕ KHÔNG THỎA MÃN</span>`;

  let bodyHtml = "";
  if (summary.best) {
    const b = summary.best;
    bodyHtml = `
      <div class="grid grid-cols-2 gap-2 bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 my-2 text-[11px] mono">
        <div>
          <span class="text-slate-400 block text-[10px]">Số lượng ô tối ưu:</span>
          <b class="text-sky-300 text-xs">${b.total} ô (${b.nx} Dài × ${b.ny} Rộng)</b>
        </div>
        <div>
          <span class="text-slate-400 block text-[10px]">KT Lọt lòng 1 ô (X×Y):</span>
          <b class="text-emerald-300 text-xs">${b.cellX.toFixed(1)} × ${b.cellY.toFixed(1)} mm</b>
        </div>
        <div>
          <span class="text-slate-400 block text-[10px]">Tư thế đặt SP:</span>
          <b class="text-amber-300">${b.ori.label}</b>
        </div>
        <div>
          <span class="text-slate-400 block text-[10px]">Tên file xuất chuẩn:</span>
          <b class="text-white text-[10px]">MASTER_CAD_${item.partCode}_${b.nx}x${b.ny}_${b.total}CELLS</b>
        </div>
      </div>
    `;
  }

  // Mini 6-Orientation Summary inside Hover Tooltip
  let ori6Html = "";
  if (summary.all6) {
    ori6Html = `
      <div class="mt-1.5 pt-1.5 border-t border-slate-800/90">
        <div class="text-[10px] font-bold uppercase text-sky-300 mb-1">Kiểm tra nhanh 6 tư thế xoay SP (Đứng / Dọc / Nằm):</div>
        <div class="grid grid-cols-2 gap-1 text-[10px] mono">
          ${summary.all6.map(ev => `
            <div class="px-1.5 py-1 rounded bg-slate-900/80 border ${ev.matchesRule ? "border-emerald-500/40 text-emerald-300" : ev.feasible ? "border-amber-500/40 text-amber-300" : "border-rose-500/40 text-rose-300"}">
              <b>${ev.ori.shortName.split("(")[0]}:</b> ${ev.feasible ? `${ev.bestTotal} ô (${ev.bestNx}×${ev.bestNy})` : "Vượt khổ"}
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  let warnHtml = "";
  if (summary.warnings && summary.warnings.length > 0) {
    warnHtml = `
      <div class="mt-2 pt-2 border-t border-slate-800 space-y-1">
        <div class="text-[10px] font-bold uppercase tracking-wider text-rose-400">Lưu ý & Kiểm tra điều kiện vách:</div>
        ${summary.warnings.map(w => `<div class="text-[11px] text-amber-200 leading-snug">• ${w}</div>`).join("")}
      </div>
    `;
  }

  tooltip.innerHTML = `
    <div class="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
      <div>
        <span class="mono font-extrabold text-xs text-sky-400">${item.partCode}</span>
        <span class="text-xs text-slate-300 font-semibold"> — ${item.partName}</span>
      </div>
      ${statusBadge}
    </div>
    <div class="mt-1.5 flex items-center justify-between text-[11px] mono text-slate-400">
      <span>KT SP: <b class="text-amber-300">${item.pL}×${item.pW}×${item.pH}mm</b></span>
      <span>Box In: <b class="text-emerald-300">${item.boxIn.L}×${item.boxIn.W}×${item.boxIn.H}mm</b></span>
    </div>
    ${bodyHtml}
    ${ori6Html}
    ${warnHtml}
  `;

  tooltip.classList.remove("hidden");
  moveRowHoverPreview(evt);
}

function moveRowHoverPreview(evt) {
  const tooltip = document.getElementById("rowHoverTooltip");
  if (!tooltip || tooltip.classList.contains("hidden")) return;

  const pad = 16;
  const tw = tooltip.offsetWidth || 410;
  const th = tooltip.offsetHeight || 280;

  let left = evt.clientX + pad;
  let top = evt.clientY + pad;

  if (left + tw > window.innerWidth - 12) {
    left = Math.max(12, evt.clientX - tw - pad);
  }
  if (top + th > window.innerHeight - 12) {
    top = Math.max(12, evt.clientY - th - pad);
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideRowHoverPreview() {
  const tooltip = document.getElementById("rowHoverTooltip");
  if (tooltip) tooltip.classList.add("hidden");
}

function computeCadGeometry() {
  const L = Math.max(20, parseFloat(document.getElementById("inp_L").value) || 550);
  const W = Math.max(20, parseFloat(document.getElementById("inp_W").value) || 360);
  const offX = Math.max(0, parseFloat(document.getElementById("inp_offX").value) || 0);
  const offY = Math.max(0, parseFloat(document.getElementById("inp_offY").value) || 0);
  const bX = Math.max(0, parseFloat(document.getElementById("inp_bX").value) || 0);
  const bY = Math.max(0, parseFloat(document.getElementById("inp_bY").value) || 0);
  const tX = Math.max(0.5, parseFloat(document.getElementById("inp_tX").value) || 4);
  const tY = Math.max(0.5, parseFloat(document.getElementById("inp_tY").value) || 4);

  const divMode = document.getElementById("sel_divMode").value;
  let nx = Math.max(1, parseInt(document.getElementById("inp_nx").value, 10) || 1);
  let ny = Math.max(1, parseInt(document.getElementById("inp_ny").value, 10) || 1);

  const innerSpanX = Math.max(1, L - 2 * offX - 2 * bX);
  const innerSpanY = Math.max(1, W - 2 * offY - 2 * bY);

  if (divMode === "size") {
    const desX = Math.max(5, parseFloat(document.getElementById("inp_desX").value) || 50);
    const desY = Math.max(5, parseFloat(document.getElementById("inp_desY").value) || 50);
    nx = Math.max(1, Math.round((innerSpanX + tX) / (desX + tX)));
    ny = Math.max(1, Math.round((innerSpanY + tY) / (desY + tY)));
  }

  const vWallsCount = Math.max(0, nx - 1);
  const hWallsCount = Math.max(0, ny - 1);
  const cellX = (innerSpanX - vWallsCount * tX) / nx;
  const cellY = (innerSpanY - hWallsCount * tY) / ny;

  const hVD = Math.max(10, parseFloat(document.getElementById("inp_hVD").value) || 189);
  const hVN = Math.max(10, parseFloat(document.getElementById("inp_hVN").value) || 189);
  const hBao = Math.max(10, parseFloat(document.getElementById("inp_hBao").value) || 189);
  const slotW = Math.max(0.5, parseFloat(document.getElementById("inp_slotW").value) || (tX + 0.25));
  const slotDepthVD = Math.max(1, parseFloat(document.getElementById("inp_slotDepthVD").value) || (hVD / 2));
  const slotDepthVN = Math.max(1, parseFloat(document.getElementById("inp_slotDepthVN").value) || (hVN / 2));
  const cutVD = document.getElementById("sel_cutVD").value;
  const cutVN = document.getElementById("sel_cutVN").value;

  const vWalls = [];
  for (let i = 1; i <= vWallsCount; i++) {
    const xLeft = offX + bX + i * cellX + (i - 1) * tX;
    vWalls.push(xLeft);
  }
  const hWalls = [];
  for (let j = 1; j <= hWallsCount; j++) {
    const yTop = offY + bY + j * cellY + (j - 1) * tY;
    hWalls.push(yTop);
  }

  const lenVD = W - 2 * offY - 2 * bY;
  const lenVN = L - 2 * offX - 2 * bX;

  const slotsOnVD = [];
  for (let j = 1; j <= hWallsCount; j++) {
    slotsOnVD.push(j * cellY + (j - 1) * tY + tY / 2);
  }
  const slotsOnVN = [];
  for (let i = 1; i <= vWallsCount; i++) {
    slotsOnVN.push(i * cellX + (i - 1) * tX + tX / 2);
  }

  return {
    L, W, offX, offY, bX, bY, tX, tY,
    nx, ny, vWallsCount, hWallsCount,
    totalCells: nx * ny,
    innerSpanX, innerSpanY,
    cellX, cellY,
    hVD, hVN, hBao, slotW, slotDepthVD, slotDepthVN, cutVD, cutVN,
    vWalls, hWalls,
    lenVD, lenVN,
    slotsOnVD, slotsOnVN
  };
}

function getPlatesCatalog(g, item) {
  const codePrefix = item ? item.partCode : "PART";
  const c = window.APP_STATE.colors;
  const plates = [];

  if (g.vWallsCount > 0) {
    plates.push({
      id: "VD",
      code: `${codePrefix}-VD`,
      shortType: "VD",
      title: `Vách Dọc Trong (VD)`,
      qty: g.vWallsCount,
      length: g.lenVD,
      height: g.hVD,
      thick: g.tX,
      slotW: g.tY + 0.25,
      slotDepth: g.slotDepthVD,
      cutFrom: g.cutVD,
      slots: g.slotsOnVD,
      color: c.vd,
      aciColor: 2
    });
  }
  if (g.hWallsCount > 0) {
    plates.push({
      id: "VN",
      code: `${codePrefix}-VN`,
      shortType: "VN",
      title: `Vách Ngang Trong (VN)`,
      qty: g.hWallsCount,
      length: g.lenVN,
      height: g.hVN,
      thick: g.tY,
      slotW: g.tX + 0.25,
      slotDepth: g.slotDepthVN,
      cutFrom: g.cutVN,
      slots: g.slotsOnVN,
      color: c.vn,
      aciColor: 6
    });
  }
  if (g.bX > 0) {
    plates.push({
      id: "BD",
      code: `${codePrefix}-BD`,
      shortType: "BD",
      title: `Vách Biên Dọc Ngoài (BD)`,
      qty: 2,
      length: g.W - 2 * g.offY,
      height: g.hBao,
      thick: g.bX,
      slotW: 0,
      slotDepth: 0,
      cutFrom: "none",
      slots: [],
      color: c.bd,
      aciColor: 3
    });
  }
  if (g.bY > 0) {
    plates.push({
      id: "BN",
      code: `${codePrefix}-BN`,
      shortType: "BN",
      title: `Vách Biên Ngang Ngoài (BN)`,
      qty: 2,
      length: g.L - 2 * g.offX,
      height: g.hBao,
      thick: g.bY,
      slotW: 0,
      slotDepth: 0,
      cutFrom: "none",
      slots: [],
      color: c.bn,
      aciColor: 30
    });
  }
  return plates;
}

function renderMainCanvas() {
  if (window.APP_STATE.viewMode === "3d") {
    if (typeof rebuild3DScene === "function") rebuild3DScene();
    return;
  }

  const canvas = document.getElementById("cadCanvas");
  const container = document.getElementById("canvasContainer");
  if (!canvas || !container) return;

  const rect = container.getBoundingClientRect();
  const dpr = Math.max(window.devicePixelRatio || 1, 2.75);
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, rect.width, rect.height);

  const g = computeCadGeometry();
  const item = window.APP_STATE.items[window.APP_STATE.selectedIndex] || window.APP_STATE.items[0];
  const plates = getPlatesCatalog(g, item);
  const c = window.APP_STATE.colors;
  const isPaper = window.APP_STATE.bgTheme === "paper";
  const lineScale = window.APP_STATE.lineWeightMode === "hairline" ? 0.82 : window.APP_STATE.lineWeightMode === "bold" ? 1.45 : 1.08;

  const masterLayout = computeMasterWorldLayout(g, item, plates);
  const layoutOnlyLeftPad = 125;
  const totalWorldW = window.APP_STATE.viewMode === "master" ? masterLayout.worldW : (g.L + layoutOnlyLeftPad + 85);
  const totalWorldH = window.APP_STATE.viewMode === "master" ? masterLayout.worldH : (g.W + 170);

  const baseScale = Math.min((rect.width - 60) / totalWorldW, (rect.height - 60) / totalWorldH);
  const scale = Math.max(0.08, baseScale * window.APP_STATE.zoom);

  const drawW = totalWorldW * scale;
  const drawH = totalWorldH * scale;
  const originX = (rect.width - drawW) / 2 + window.APP_STATE.panX + (window.APP_STATE.viewMode === "master" ? Math.abs(masterLayout.frameLeft) * scale : layoutOnlyLeftPad * scale);
  const originY = (rect.height - drawH) / 2 + window.APP_STATE.panY + (window.APP_STATE.viewMode === "master" ? (masterLayout.frameTop - g.W) * scale : 75 * scale);

  const toScreenX = (mmX) => originX + mmX * scale;
  const toScreenY = (mmYFromTop) => originY + mmYFromTop * scale;

  // Master Sheet Outer Frame
  if (window.APP_STATE.viewMode === "master") {
    const fx = snapPx(toScreenX(masterLayout.frameLeft));
    const fy = snapPx(toScreenY(g.W - masterLayout.frameTop));
    const fw = Math.round(masterLayout.worldW * scale);
    const fh = Math.round(masterLayout.worldH * scale);

    ctx.fillStyle = isPaper ? "rgba(255, 255, 255, 0.96)" : "rgba(6, 10, 20, 0.90)";
    ctx.fillRect(fx, fy, fw, fh);

    ctx.strokeStyle = isPaper ? "#475569" : "rgba(148, 163, 184, 0.45)";
    ctx.lineWidth = 1.0 * lineScale;
    ctx.strokeRect(fx, fy, fw, fh);

    ctx.strokeStyle = c.frame;
    ctx.lineWidth = 1.5 * lineScale;
    ctx.strokeRect(fx + 6, fy + 6, fw - 12, fh - 12);
  }

  // Section I Header
  ctx.fillStyle = isPaper ? "#0284c7" : c.frame;
  ctx.font = "800 12px 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText(`I. MẶT BẰNG LAYOUT VÁCH NGĂN 2D (TỔNG: ${g.totalCells} Ô = ${g.nx}×${g.ny})`, toScreenX(0), toScreenY(-42));

  // Optional Box In boundary
  if (document.getElementById("chk_showBoxIn")?.checked && item) {
    const diffX = (item.boxIn.L - g.L) / 2;
    const diffY = (item.boxIn.W - g.W) / 2;
    ctx.save();
    ctx.strokeStyle = "rgba(16, 185, 129, 0.55)";
    ctx.lineWidth = 1.1 * lineScale;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(
      snapPx(toScreenX(-diffX)),
      snapPx(toScreenY(-diffY)),
      Math.round(item.boxIn.L * scale),
      Math.round(item.boxIn.W * scale)
    );
    ctx.restore();
  }

  // Outer Partition Boundary (X = 0 to g.L, Y = 0 to g.W)
  ctx.save();
  ctx.strokeStyle = isPaper ? "#0369a1" : c.frame;
  ctx.lineWidth = 1.8 * lineScale;
  ctx.strokeRect(snapPx(toScreenX(0)), snapPx(toScreenY(0)), Math.round(g.L * scale), Math.round(g.W * scale));
  ctx.restore();

  // Offset Line
  if (g.offX > 0 || g.offY > 0) {
    ctx.save();
    ctx.strokeStyle = isPaper ? "#64748b" : "#94a3b8";
    ctx.lineWidth = 0.9 * lineScale;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(
      snapPx(toScreenX(g.offX)),
      snapPx(toScreenY(g.offY)),
      Math.round((g.L - 2 * g.offX) * scale),
      Math.round((g.W - 2 * g.offY) * scale)
    );
    ctx.restore();
  }

  // Cells & Product Footprints
  const showPart = document.getElementById("chk_showPart")?.checked;
  const fp = window.APP_STATE.activeFootprint;

  for (let ix = 0; ix < g.nx; ix++) {
    for (let iy = 0; iy < g.ny; iy++) {
      const cx = g.offX + g.bX + ix * (g.cellX + g.tX);
      const cy = g.offY + g.bY + iy * (g.cellY + g.tY);
      const sx = toScreenX(cx);
      const sy = toScreenY(cy);
      const sw = g.cellX * scale;
      const sh = g.cellY * scale;

      if (showPart && fp) {
        const fits = fp.x <= g.cellX + 0.05 && fp.y <= g.cellY + 0.05;
        const pw = Math.min(fp.x, g.cellX) * scale;
        const ph = Math.min(fp.y, g.cellY) * scale;
        const px = sx + (sw - pw) / 2;
        const py = sy + (sh - ph) / 2;

        ctx.fillStyle = fits ? "rgba(16, 185, 129, 0.14)" : "rgba(239, 68, 68, 0.22)";
        ctx.strokeStyle = fits ? "rgba(16, 185, 129, 0.65)" : "rgba(239, 68, 68, 0.85)";
        ctx.lineWidth = 0.85 * lineScale;
        ctx.fillRect(px, py, pw, ph);
        ctx.strokeRect(snapPx(px), snapPx(py), Math.round(pw), Math.round(ph));
      }

      if (sw > 18 && sh > 11) {
        const cellNum = iy * g.nx + ix + 1;
        ctx.fillStyle = isPaper ? "#334155" : "rgba(226, 232, 240, 0.78)";
        ctx.font = `600 ${Math.min(10, Math.max(7.5, Math.min(sw, sh) * 0.28))}px 'JetBrains Mono', monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`#${cellNum}`, sx + sw / 2, sy + sh / 2);
      }
    }
  }

  const showWallCodes = document.getElementById("chk_showWallCodes")?.checked;

  // Vertical Walls (VD)
  ctx.save();
  ctx.fillStyle = c.vd;
  ctx.strokeStyle = isPaper ? "#854d0e" : "#fef08a";
  ctx.lineWidth = 0.85 * lineScale;
  g.vWalls.forEach((wx, idx) => {
    const sx = snapPx(toScreenX(wx));
    const sy = snapPx(toScreenY(g.offY + g.bY));
    const sw = Math.max(1.5, g.tX * scale);
    const sh = Math.round((g.W - 2 * (g.offY + g.bY)) * scale);
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeRect(sx, sy, sw, sh);

    if (showWallCodes) {
      ctx.fillStyle = isPaper ? "#a16207" : c.vd;
      ctx.font = "700 9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`VD${idx + 1}`, sx + sw / 2, sy - 6);
      ctx.fillStyle = c.vd;
    }
  });
  ctx.restore();

  // Horizontal Walls (VN) -> Labels pushed OUTSIDE the outer cyan boundary on the left
  ctx.save();
  ctx.fillStyle = c.vn;
  ctx.strokeStyle = isPaper ? "#9d174d" : "#fbcfe8";
  ctx.lineWidth = 0.85 * lineScale;
  g.hWalls.forEach((wy, idx) => {
    const sx = snapPx(toScreenX(g.offX + g.bX));
    const sy = snapPx(toScreenY(wy));
    const sw = Math.round((g.L - 2 * (g.offX + g.bX)) * scale);
    const sh = Math.max(1.5, g.tY * scale);
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeRect(sx, sy, sw, sh);

    if (showWallCodes) {
      const outerLeftX = snapPx(toScreenX(0));
      ctx.save();
      ctx.strokeStyle = isPaper ? "rgba(190, 24, 93, 0.45)" : "rgba(244, 114, 182, 0.45)";
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(outerLeftX - 8, sy + sh / 2);
      ctx.lineTo(sx, sy + sh / 2);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = isPaper ? "#be185d" : c.vn;
      ctx.font = "700 9.5px 'JetBrains Mono', monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(`VN${idx + 1}`, outerLeftX - 11, sy + sh / 2);
      ctx.fillStyle = c.vn;
    }
  });
  ctx.restore();

  // Slot Intersections
  ctx.fillStyle = c.slot;
  g.vWalls.forEach(wx => {
    g.hWalls.forEach(wy => {
      ctx.fillRect(
        snapPx(toScreenX(wx) - 1),
        snapPx(toScreenY(wy) - 1),
        Math.max(3, g.tX * scale + 2),
        Math.max(3, g.tY * scale + 2)
      );
    });
  });

  // Main Layout Dimensions
  drawTechnicalArrow(ctx, toScreenX(0), toScreenY(0), toScreenX(g.L), toScreenY(0), c.frame, `DÀI PHỦ BÌ L = ${g.L.toFixed(1)} mm`, -22, lineScale);
  const leftOutsideOffsetPx = Math.max(54, Math.min(82, 58 * scale + 24));
  drawTechnicalArrow(ctx, toScreenX(0), toScreenY(0), toScreenX(0), toScreenY(g.W), c.frame, `RỘNG PHỦ BÌ W = ${g.W.toFixed(1)} mm`, leftOutsideOffsetPx, lineScale);

  if (g.nx > 0 && g.cellX > 0) {
    const cx0 = g.offX + g.bX;
    drawTechnicalArrow(ctx, toScreenX(cx0), toScreenY(g.W), toScreenX(cx0 + g.cellX), toScreenY(g.W), c.vd, `Ô X = ${g.cellX.toFixed(1)}`, -22, lineScale);
  }
  if (g.ny > 0 && g.cellY > 0) {
    const cy0 = g.offY + g.bY;
    drawTechnicalArrow(ctx, toScreenX(g.L), toScreenY(cy0), toScreenX(g.L), toScreenY(cy0 + g.cellY), c.vn, `Ô Y = ${g.cellY.toFixed(1)}`, -26, lineScale);
  }

  // MASTER MODE: Column II (Plates) + Section III (Non-Overlapping Title Block)
  if (window.APP_STATE.viewMode === "master") {
    ctx.fillStyle = isPaper ? "#0284c7" : c.frame;
    ctx.font = "800 12px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText("II. BẢN VẼ TÁCH CHI TIẾT TỪNG TẤM VÁCH & RÃNH ĐAN (MÀU RIÊNG)", toScreenX(masterLayout.rightColX), toScreenY(-42));

    masterLayout.platePlacements.forEach(pp => {
      const p = pp.plate;
      const px = snapPx(toScreenX(pp.x));
      const py = snapPx(toScreenY(g.W - pp.topY));
      const pw = Math.round(pp.width * scale);
      const ph = Math.round(pp.height * scale);

      ctx.fillStyle = p.color;
      ctx.font = "700 10.5px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText(`■ ${pp.index}. MÃ VÁCH: ${p.code} (${p.title}) — SL: ${p.qty} TẤM | KT PHÔI: ${p.length.toFixed(1)}×${p.height.toFixed(1)}×${p.thick}mm`, px, py - (pp.rotateCoords ? 26 : 12));

      ctx.fillStyle = p.color + "16";
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5 * lineScale;
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeRect(px, py, pw, ph);

      p.slots.forEach(sc => {
        const sx = snapPx(toScreenX(pp.x + sc - p.slotW / 2));
        const sw = Math.max(2, p.slotW * scale);
        const sh = Math.round(p.slotDepth * scale);
        const sy = p.cutFrom === "top" ? py : (py + ph - sh);

        ctx.fillStyle = c.slot + "40";
        ctx.strokeStyle = c.slot;
        ctx.lineWidth = 1.05 * lineScale;
        ctx.fillRect(sx, sy, sw, sh);
        ctx.strokeRect(sx, sy, sw, sh);

        const labelX = toScreenX(pp.x + sc);
        ctx.fillStyle = isPaper ? "#b45309" : "#fde047";
        ctx.font = "600 8.5px 'JetBrains Mono', monospace";

        if (pp.rotateCoords) {
          ctx.save();
          const labelY = p.cutFrom === "top" ? (py - 4) : (py + ph + 4);
          ctx.translate(labelX, labelY);
          ctx.rotate(-Math.PI / 2);
          ctx.textAlign = p.cutFrom === "top" ? "left" : "right";
          ctx.textBaseline = "middle";
          ctx.fillText(sc.toFixed(1), 0, 0);
          ctx.restore();
        } else {
          ctx.textAlign = "center";
          ctx.fillText(sc.toFixed(1), labelX, p.cutFrom === "top" ? (py - 4) : (py + ph + 10));
        }
      });

      const dimOffset = pp.rotateCoords && p.cutFrom === "bottom" ? -28 : -16;
      drawTechnicalArrow(
        ctx,
        px,
        py + ph,
        px + pw,
        py + ph,
        p.color,
        `DÀI ${p.shortType} = ${p.length.toFixed(1)} mm (${p.slots.length} rãnh rộng ${p.slotW.toFixed(2)} × sâu ${p.slotDepth.toFixed(1)}mm)`,
        dimOffset,
        lineScale
      );
      drawTechnicalArrow(
        ctx,
        px + pw,
        py,
        px + pw,
        py + ph,
        p.color,
        `CAO = ${p.height.toFixed(1)}`,
        -20,
        lineScale
      );
    });

    // Section III: Non-Overlapping ISO Title Block & BOM Table
    const bx = snapPx(toScreenX(0));
    const by = snapPx(toScreenY(g.W - masterLayout.bomTopY));
    const bw = Math.round(masterLayout.totalWidth * scale);
    const bh = Math.round(masterLayout.bomBoxH * scale);

    ctx.fillStyle = isPaper ? "rgba(241, 245, 249, 0.98)" : "rgba(10, 17, 32, 0.96)";
    ctx.strokeStyle = c.frame;
    ctx.lineWidth = 1.5 * lineScale;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeRect(bx, by, bw, bh);

    ctx.fillStyle = "rgba(56, 189, 248, 0.14)";
    ctx.fillRect(bx, by, bw, 24);
    ctx.beginPath();
    ctx.moveTo(bx, snapPx(by + 24));
    ctx.lineTo(bx + bw, snapPx(by + 24));
    ctx.stroke();

    const midX = snapPx(bx + bw * 0.44);
    ctx.beginPath();
    ctx.moveTo(midX, by);
    ctx.lineTo(midX, by + bh);
    ctx.stroke();

    ctx.fillStyle = isPaper ? "#0369a1" : "#38bdf8";
    ctx.font = "800 10.5px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText("III. THÔNG TIN SẢN PHẨM & QUY CÁCH ĐÓNG GÓI (ISO STANDARD)", bx + 12, by + 16);
    ctx.fillText("BẢNG KÊ CHI TIẾT CÁC VÁCH NGĂN (MÃ VÁCH & MÀU RIÊNG)", midX + 12, by + 16);

    const ruleCheck = checkTotalMatchesRule(g.totalCells, getRuleConfig());
    ctx.fillStyle = isPaper ? "#0f172a" : "#f1f5f9";
    ctx.font = "600 9.5px 'JetBrains Mono', monospace";
    const infoLines = [
      `• Mã hàng (Part Code): ${item ? item.partCode : "N/A"}   |   Khách hàng: ${item ? item.customer : "SECVN"}`,
      `• Tên SP (Part Name) : ${item ? item.partName : "N/A"}`,
      `• KT Sản phẩm (D×R×C): ${item ? `${item.pL} × ${item.pW} × ${item.pH} mm` : "N/A"} (${window.APP_STATE.activeFootprint?.label || ""})`,
      `• KT Box Out / In    : Out ${item ? `${item.boxOut.L}×${item.boxOut.W}×${item.boxOut.H}` : ""} | In ${item ? `${item.boxIn.L}×${item.boxIn.W}×${item.boxIn.H} mm` : ""}`,
      `• Quy cách Layout    : Phủ bì ${g.L}×${g.W}×H${g.hVD}mm | ${g.totalCells} ô (${g.nx}×${g.ny}) [${ruleCheck.text}]`,
      `• Lọt lòng 1 ô (X×Y) : ${g.cellX.toFixed(2)} × ${g.cellY.toFixed(2)} mm | File: ${getMasterFileBaseName()}`
    ];
    infoLines.forEach((ln, idx) => {
      ctx.fillText(ln, bx + 12, by + 42 + idx * 17);
    });

    plates.forEach((p, idx) => {
      const ry = by + 44 + idx * 20;
      ctx.fillStyle = p.color;
      ctx.fillRect(midX + 12, ry - 8, 9, 9);
      const slotListStr = p.slots.length > 0 ? p.slots.map(s => s.toFixed(1)).join(", ") : "Không cắt rãnh";
      ctx.fillText(
        `${p.code} (${p.shortType}) | KT: ${p.length.toFixed(1)}×${p.height.toFixed(1)}×${p.thick}mm | SL: ${p.qty} tấm | ${p.slots.length} rãnh: [${slotListStr}]`,
        midX + 26,
        ry
      );
    });
  }

  document.getElementById("zoomStatus").textContent = `Zoom: ${Math.round(window.APP_STATE.zoom * 100)}% • Super-HiDPI ${dpr.toFixed(2)}x`;
}

function renderDetachedPlatesSection() {
  const g = computeCadGeometry();
  const item = window.APP_STATE.items[window.APP_STATE.selectedIndex] || window.APP_STATE.items[0];
  const plates = getPlatesCatalog(g, item);
  const filterVal = document.getElementById("sel_plateFilter")?.value || "all";
  const grid = document.getElementById("platesDetailGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const filtered = filterVal === "all" ? plates : plates.filter(p => p.id === filterVal);
  filtered.forEach(p => {
    const card = document.createElement("div");
    card.className = "bg-slate-950/90 border border-slate-800 rounded-xl p-3 flex flex-col gap-2";
    const slotText = p.slots.length > 0 ? p.slots.map(s => s.toFixed(1)).join(" ; ") : "Không cắt rãnh";
    card.innerHTML = `
      <div class="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div class="flex items-center gap-2">
          <span class="w-3.5 h-3.5 rounded-sm inline-block" style="background:${p.color}"></span>
          <span class="font-bold text-xs mono" style="color:${p.color}">${p.code}</span>
          <span class="text-xs text-slate-300 font-semibold">— ${p.title}</span>
        </div>
        <span class="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[11px] mono font-bold text-white">SL: ${p.qty} tấm</span>
      </div>
      <div class="grid grid-cols-3 gap-2 text-[11px] mono bg-slate-900/60 p-2 rounded-lg">
        <div><span class="text-slate-400">KT Phôi:</span> <b class="text-white">${p.length.toFixed(1)}×${p.height.toFixed(1)}mm</b></div>
        <div><span class="text-slate-400">Độ dày:</span> <b class="text-sky-300">${p.thick} mm</b></div>
        <div><span class="text-slate-400">Rãnh:</span> <b class="text-rose-400">${p.slots.length} (${p.slotW.toFixed(2)}×${p.slotDepth.toFixed(1)})</b></div>
      </div>
      <div class="text-[11px] mono text-slate-400">Tọa độ tâm rãnh (mm): <span class="text-amber-300">${slotText}</span></div>
    `;
    grid.appendChild(card);
  });
}

function updateUIAndRender() {
  const g = computeCadGeometry();
  const item = window.APP_STATE.items[window.APP_STATE.selectedIndex] || window.APP_STATE.items[0];
  const ruleCfg = getRuleConfig();
  const ruleCheck = checkTotalMatchesRule(g.totalCells, ruleCfg);

  document.getElementById("res_totalCells").textContent = `${g.totalCells} ô (${g.nx} × ${g.ny})`;
  const badge = document.getElementById("res_multBadge");
  badge.textContent = ruleCheck.text;
  badge.className = ruleCheck.ok
    ? "px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
    : "px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40";

  document.getElementById("res_wallsCount").textContent = `${g.vWallsCount} dọc (VD) × ${g.hWallsCount} ngang (VN)`;
  document.getElementById("res_cellDim").textContent = `${g.cellX.toFixed(2)} × ${g.cellY.toFixed(2)} mm`;

  // Check if active product footprint fits inside current cell
  const fp = window.APP_STATE.activeFootprint;
  const fitStatusEl = document.getElementById("res_partFitBadge");
  if (fitStatusEl && fp && item) {
    const fitsXY = fp.x <= g.cellX + 0.05 && fp.y <= g.cellY + 0.05;
    const fitsH = fp.h <= item.boxIn.H;
    if (fitsXY && fitsH) {
      fitStatusEl.textContent = `✓ Vừa ô (${fp.x}×${fp.y} ≤ ${g.cellX.toFixed(1)}×${g.cellY.toFixed(1)}mm)`;
      fitStatusEl.className = "text-[11px] mono font-bold text-emerald-300";
    } else {
      fitStatusEl.textContent = `✕ Cấn SP! Cần ô ≥ ${fp.x}×${fp.y}mm (Hiện tại ${g.cellX.toFixed(1)}×${g.cellY.toFixed(1)}mm)`;
      fitStatusEl.className = "text-[11px] mono font-bold text-rose-400";
    }
  }

  // Update live filename preview
  const fileBase = getMasterFileBaseName();
  const fnEl = document.getElementById("lbl_exportFilename");
  if (fnEl) fnEl.textContent = `${fileBase}.dxf`;

  if (item) {
    document.getElementById("lbl_codeVD").textContent = `${item.partCode}-VD`;
    document.getElementById("lbl_codeVN").textContent = `${item.partCode}-VN`;
    document.getElementById("lbl_codeBD").textContent = `${item.partCode}-BD`;
    document.getElementById("lbl_codeBN").textContent = `${item.partCode}-BN`;

    const summaryPill = document.getElementById("excelCollapsedSummary");
    if (summaryPill) {
      summaryPill.textContent = `Đang chọn: ${item.partCode} (${item.partName}) • ${g.totalCells} ô (${g.nx}×${g.ny}) • File: ${fileBase}`;
    }
  }

  renderMainCanvas();
  renderDetachedPlatesSection();
}

function renderExcelTable() {
  const tbody = document.getElementById("excelTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const wallThick = parseFloat(document.getElementById("inp_tX")?.value) || 4;
  const ruleCfg = getRuleConfig();

  window.APP_STATE.items.forEach((item, idx) => {
    const summary = evaluateRowQuickSummary(item, wallThick, ruleCfg);
    const tr = document.createElement("tr");
    tr.className = `cursor-pointer transition hover:bg-sky-500/15 ${idx === window.APP_STATE.selectedIndex ? "row-selected" : ""}`;
    tr.onclick = () => selectExcelItem(idx);
    tr.onmouseenter = (e) => showRowHoverPreview(e, idx);
    tr.onmousemove = (e) => moveRowHoverPreview(e);
    tr.onmouseleave = () => hideRowHoverPreview();

    const quickSummaryHtml = summary.best
      ? `<div class="flex items-center gap-1.5">
           <span class="px-1.5 py-0.5 rounded text-[10px] font-bold mono ${summary.ok ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-amber-500/20 text-amber-300 border border-amber-500/40"}">${summary.best.total} ô (${summary.best.nx}×${summary.best.ny})</span>
           <span class="text-[11px] mono text-slate-300">${summary.best.cellX.toFixed(1)}×${summary.best.cellY.toFixed(1)}mm</span>
         </div>`
      : `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/25 text-rose-300 border border-rose-500/40">✕ Vách không thỏa mãn</span>`;

    tr.innerHTML = `
      <td class="px-3 py-2 mono text-slate-400">${idx + 1}</td>
      <td class="px-3 py-2 mono font-bold text-sky-400">
        <div class="flex items-center gap-1.5">
          <span>${item.partCode}</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-normal">🔍 Di chuột xem</span>
        </div>
      </td>
      <td class="px-3 py-2 font-medium text-white">${item.partName}</td>
      <td class="px-3 py-2 text-center mono text-amber-300 font-semibold">${item.pL} × ${item.pW} × ${item.pH}</td>
      <td class="px-3 py-2">${quickSummaryHtml}</td>
      <td class="px-3 py-2 mono text-emerald-300 text-[11px]">Out: ${item.boxOut.L}×${item.boxOut.W}×${item.boxOut.H}<br>In: <b>${item.boxIn.L}×${item.boxIn.W}×${item.boxIn.H}</b></td>
      <td class="px-3 py-2 text-[11px] text-amber-200">${item.note}</td>
      <td class="px-3 py-2 text-right">
        <button class="px-2.5 py-1 rounded bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 border border-sky-500/40 text-[11px] font-semibold">Nạp & Xoay thử</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function selectExcelItem(idx) {
  window.APP_STATE.selectedIndex = idx;
  const item = window.APP_STATE.items[idx];
  renderExcelTable();
  if (!item) return;

  const wallThick = parseFloat(document.getElementById("inp_tX").value) || 4;
  const recs = generateRecommendations(item, wallThick, 2, getRuleConfig());
  const recBar = document.getElementById("recommendationBar");
  const recBtns = document.getElementById("recommendationButtons");

  if (recs.length > 0) {
    recBar.classList.remove("hidden");
    recBtns.innerHTML = "";
    recs.forEach((r, rIdx) => {
      const btn = document.createElement("button");
      btn.className = `px-2.5 py-1 rounded-lg text-xs mono font-semibold border transition flex items-center gap-1.5 ${
        rIdx === 0
          ? "bg-sky-500/25 border-sky-400 text-white"
          : "bg-slate-900/90 border-slate-700 text-slate-300 hover:border-sky-500/50"
      }`;
      btn.innerHTML = `<span class="text-sky-300 font-bold">${r.total} ô (${r.nx}×${r.ny})</span> <span class="text-[10px] text-slate-400">${r.ori.label}</span>`;
      btn.onclick = () => applyRecommendation(item, r);
      recBtns.appendChild(btn);
    });
    applyRecommendation(item, recs[0]);
  } else {
    renderOrientationMatrix();
    updateUIAndRender();
  }
}

function applyRecommendation(item, rec) {
  window.APP_STATE.selectedOriId = rec.ori.id;
  document.getElementById("inp_L").value = rec.L_part;
  document.getElementById("inp_W").value = rec.W_part;
  document.getElementById("inp_offX").value = 5;
  document.getElementById("inp_offY").value = 5;
  document.getElementById("inp_nx").value = rec.nx;
  document.getElementById("inp_ny").value = rec.ny;
  document.getElementById("inp_hVD").value = rec.recWallH;
  document.getElementById("inp_hVN").value = rec.recWallH;
  document.getElementById("inp_hBao").value = rec.recWallH;
  document.getElementById("inp_slotDepthVD").value = (rec.recWallH / 2).toFixed(2);
  document.getElementById("inp_slotDepthVN").value = (rec.recWallH / 2).toFixed(2);

  window.APP_STATE.activeFootprint = {
    x: rec.ori.fX,
    y: rec.ori.fY,
    h: rec.ori.hPart,
    label: rec.ori.label
  };
  renderOrientationMatrix();
  updateUIAndRender();
}

function stepVal(id, delta) {
  const el = document.getElementById(id);
  if (!el) return;
  let val = parseFloat(el.value) || 0;
  val = Math.max(0, +(val + delta).toFixed(2));
  el.value = val;
  if (id === "inp_tX" || id === "inp_tY") {
    const t = parseFloat(el.value) || 4;
    if (document.getElementById("chk_syncInner")?.checked) {
      document.getElementById("inp_tX").value = t;
      document.getElementById("inp_tY").value = t;
    }
    document.getElementById("inp_slotW").value = (t + 0.25).toFixed(2);
  }
  renderExcelTable();
  renderOrientationMatrix();
  updateUIAndRender();
}

function syncEqual(group) {
  if (group === "offset" && document.getElementById("chk_syncOffset")?.checked) {
    document.getElementById("inp_offY").value = document.getElementById("inp_offX").value;
  }
  if (group === "border" && document.getElementById("chk_syncBorder")?.checked) {
    document.getElementById("inp_bY").value = document.getElementById("inp_bX").value;
  }
  if (group === "inner" && document.getElementById("chk_syncInner")?.checked) {
    document.getElementById("inp_tY").value = document.getElementById("inp_tX").value;
  }
  updateUIAndRender();
}

function onDivModeChange() {
  const mode = document.getElementById("sel_divMode").value;
  document.getElementById("divMode_cellsBox").classList.toggle("hidden", mode === "size");
  document.getElementById("divMode_sizeBox").classList.toggle("hidden", mode !== "size");
  updateUIAndRender();
}

function onPackingRuleChange() {
  const mode = document.getElementById("packingRuleMode").value;
  document.getElementById("customMultValue").classList.toggle("hidden", mode !== "custom_mult");
  document.getElementById("exactTargetValue").classList.toggle("hidden", mode !== "exact_target");
  selectExcelItem(window.APP_STATE.selectedIndex);
}

function setViewMode(mode) {
  window.APP_STATE.viewMode = mode;
  window.APP_STATE.panX = 0;
  window.APP_STATE.panY = 0;

  const is3D = mode === "3d";
  document.getElementById("canvasContainer")?.classList.toggle("hidden", is3D);
  document.getElementById("viewer3DContainer")?.classList.toggle("hidden", !is3D);

  document.getElementById("tabMasterView").className = mode === "master"
    ? "px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-500 text-slate-950 transition"
    : "px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition";
  document.getElementById("tabLayoutOnly").className = mode === "layout"
    ? "px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-500 text-slate-950 transition"
    : "px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition";
  const tab3D = document.getElementById("tab3DView");
  if (tab3D) {
    tab3D.className = mode === "3d"
      ? "px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-400 text-slate-950 transition"
      : "px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-300 hover:text-white transition";
  }

  updateUIAndRender();
}

function setLineWeightMode(mode) {
  window.APP_STATE.lineWeightMode = mode;
  updateUIAndRender();
}

function setBgTheme(theme) {
  window.APP_STATE.bgTheme = theme;
  const vp = document.getElementById("canvasContainer");
  vp.classList.remove("viewport-autocad", "viewport-blueprint", "viewport-paper");
  vp.classList.add(`viewport-${theme}`);
  updateUIAndRender();
}

function updateWallColors() {
  window.APP_STATE.colors.vd = document.getElementById("col_VD").value;
  window.APP_STATE.colors.vn = document.getElementById("col_VN").value;
  window.APP_STATE.colors.bd = document.getElementById("col_BD").value;
  window.APP_STATE.colors.bn = document.getElementById("col_BN").value;
  window.APP_STATE.colors.slot = document.getElementById("col_SLOT").value;
  window.APP_STATE.colors.frame = document.getElementById("col_FRAME").value;
  updateUIAndRender();
}

function zoomCanvas(factor) {
  window.APP_STATE.zoom = Math.min(4.0, Math.max(0.2, window.APP_STATE.zoom * factor));
  renderMainCanvas();
}

function resetCanvasView() {
  window.APP_STATE.zoom = 0.76;
  window.APP_STATE.panX = 0;
  window.APP_STATE.panY = 0;
  renderMainCanvas();
}

// Export Master DXF with exact filename format: MASTER_CAD_<MÃ SẢN PHẨM>_<LAYOUT>_<SỐ Ô>CELLS.dxf
function exportMasterDXF() {
  const g = computeCadGeometry();
  const item = window.APP_STATE.items[window.APP_STATE.selectedIndex] || {
    partCode: "SANPHAM", partName: "PARTITION", pL: 0, pW: 0, pH: 0, customer: "SECVN",
    boxIn: { L: g.L, W: g.W, H: g.hVD }
  };
  const plates = getPlatesCatalog(g, item);
  const ruleCheck = checkTotalMatchesRule(g.totalCells, getRuleConfig());
  const dxfContent = buildMasterDxfContent(g, item, plates, ruleCheck);

  const blob = new Blob([dxfContent], { type: "application/dxf;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${getMasterFileBaseName()}.dxf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Export Master PNG with exact filename format: MASTER_CAD_<MÃ SẢN PHẨM>_<LAYOUT>_<SỐ Ô>CELLS.png
function exportMasterPNG() {
  const prevMode = window.APP_STATE.viewMode;
  window.APP_STATE.viewMode = "master";
  window.APP_STATE.zoom = 0.9;
  window.APP_STATE.panX = 0;
  window.APP_STATE.panY = 0;
  renderMainCanvas();

  const canvas = document.getElementById("cadCanvas");
  const link = document.createElement("a");
  link.download = `${getMasterFileBaseName()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();

  window.APP_STATE.viewMode = prevMode;
  renderMainCanvas();
}

// Export BOM Excel with exact filename format: MASTER_CAD_<MÃ SẢN PHẨM>_<LAYOUT>_<SỐ Ô>CELLS.xlsx
function exportBomExcel() {
  const g = computeCadGeometry();
  const item = window.APP_STATE.items[window.APP_STATE.selectedIndex] || window.APP_STATE.items[0];
  const plates = getPlatesCatalog(g, item);
  const rows = [
    ["BẢNG KÊ THÔNG SỐ VÁCH NGĂN CAD & RÃNH ĐAN (ISO STANDARD PRO)"],
    ["Tên file chuẩn", getMasterFileBaseName()],
    ["Mã hàng", item.partCode, "Tên linh kiện", item.partName, "Khách hàng", item.customer],
    ["KT Sản phẩm (mm)", `${item.pL}x${item.pW}x${item.pH}`, "KT Box In (mm)", `${item.boxIn.L}x${item.boxIn.W}x${item.boxIn.H}`, "Tổng số ô", `${g.totalCells} (${g.nx}x${g.ny})`],
    [],
    ["Mã Vách", "Loại Vách", "Màu Hiển Thị", "Dài Phôi (mm)", "Cao Vách (mm)", "Độ Dày (mm)", "Số Lượng / Box", "Số Rãnh Đan", "KT Rãnh (Rộng×Sâu)", "Tọa Độ Tâm Rãnh (mm)"]
  ];
  plates.forEach(p => {
    rows.push([
      p.code, p.title, p.color,
      Number(p.length.toFixed(2)), Number(p.height.toFixed(2)), p.thick,
      p.qty, p.slots.length,
      p.slots.length > 0 ? `${p.slotW.toFixed(2)}x${p.slotDepth.toFixed(1)}` : "Không",
      p.slots.map(s => s.toFixed(1)).join(", ")
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "BOM_VACH_CAD");
  XLSX.writeFile(wb, `${getMasterFileBaseName()}.xlsx`);
}

function loadDefaultTesst001() {
  window.APP_STATE.items = JSON.parse(JSON.stringify(window.DEFAULT_EXCEL_ITEMS));
  selectExcelItem(0);
}

window.addEventListener("DOMContentLoaded", () => {
  const inputIds = [
    "inp_L", "inp_W", "inp_offX", "inp_offY", "inp_bX", "inp_bY",
    "inp_tX", "inp_tY", "inp_nx", "inp_ny", "inp_desX", "inp_desY",
    "inp_hVD", "inp_hVN", "inp_hBao", "inp_slotW", "inp_slotDepthVD", "inp_slotDepthVN",
    "sel_cutVD", "sel_cutVN"
  ];
  inputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", () => {
      renderExcelTable();
      renderOrientationMatrix();
      updateUIAndRender();
    });
  });

  const excelInput = document.getElementById("excelFileInput");
  if (excelInput) {
    excelInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const parsed = parseExcelRowsToItems(rows);
        if (parsed.length > 0) {
          window.APP_STATE.items = parsed;
          selectExcelItem(0);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  const vp = document.getElementById("canvasContainer");
  if (vp) {
    vp.addEventListener("wheel", (e) => {
      e.preventDefault();
      zoomCanvas(e.deltaY < 0 ? 1.12 : 0.89);
    }, { passive: false });

    vp.addEventListener("mousedown", (e) => {
      window.APP_STATE.isPanning = true;
      window.APP_STATE.startPanX = e.clientX - window.APP_STATE.panX;
      window.APP_STATE.startPanY = e.clientY - window.APP_STATE.panY;
    });
    window.addEventListener("mousemove", (e) => {
      if (!window.APP_STATE.isPanning) return;
      window.APP_STATE.panX = e.clientX - window.APP_STATE.startPanX;
      window.APP_STATE.panY = e.clientY - window.APP_STATE.startPanY;
      renderMainCanvas();
    });
    window.addEventListener("mouseup", () => {
      window.APP_STATE.isPanning = false;
    });
  }

  window.addEventListener("resize", () => {
    renderMainCanvas();
    if (typeof resize3DViewer === "function") resize3DViewer();
  });
  loadDefaultTesst001();
});
