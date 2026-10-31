// ============================================================================
// MODULE: js/app.js
// Bộ điều khiển giao diện & Quản lý trạng thái (UI Controller & App State)
// THÔNG SỐ VÁCH CAD — ISO STANDARD PRO
// ============================================================================

(function(global) {
  'use strict';

  // Khởi tạo trạng thái ứng dụng
  global.APP_STATE = {
    items: (global.DEFAULT_EXCEL_ITEMS && global.DEFAULT_EXCEL_ITEMS.length > 0)
      ? JSON.parse(JSON.stringify(global.DEFAULT_EXCEL_ITEMS))
      : [],
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
    viewMode: "master",
    lineWeightMode: "hairline",
    bgTheme: "autocad",
    colors: {
      vd: "#facc15",
      vn: "#f472b6",
      bd: "#4ade80",
      bn: "#fb923c",
      slot: "#f87171",
      frame: "#38bdf8"
    },
    isAuthorized: true,
    canExport: true,
    countdownSecs: 50,
    countdownTimer: null
  };

  function checkExportAuth() {
    return global.APP_STATE.canExport !== false;
  }

  function getMasterFileBaseName() {
    const g = global.computeCadGeometry();
    const item = global.APP_STATE.items[global.APP_STATE.selectedIndex] || { partCode: "SANPHAM" };
    const cleanCode = String(item.partCode || "SANPHAM").trim().replace(/\s+/g, "_");
    return `MASTER_CAD_${cleanCode}_${g.nx}x${g.ny}_${g.totalCells}CELLS`;
  }

  function toggleExcelPanel() {
    global.APP_STATE.excelCollapsed = !global.APP_STATE.excelCollapsed;
    const body = document.getElementById("excelCollapsibleBody");
    const summary = document.getElementById("excelCollapsedSummary");
    const icon = document.getElementById("excelToggleIcon");
    const text = document.getElementById("excelToggleText");

    if (body) {
      if (global.APP_STATE.excelCollapsed) {
        body.style.maxHeight = "0px";
        body.style.opacity = "0";
        body.style.overflow = "hidden";
        body.style.marginTop = "0px";
      } else {
        body.style.maxHeight = "1600px";
        body.style.opacity = "1";
        body.style.overflow = "visible";
        body.style.marginTop = "10px";
      }
    }
    if (summary) summary.classList.toggle("hidden", !global.APP_STATE.excelCollapsed);
    if (icon) icon.textContent = global.APP_STATE.excelCollapsed ? "▼" : "▲";
    if (text) text.textContent = global.APP_STATE.excelCollapsed ? "Mở rộng bảng dữ liệu" : "Thu gọn bảng dữ liệu";

    setTimeout(() => {
      if (typeof global.renderMainCanvas === "function") global.renderMainCanvas();
    }, 290);
  }

  function toggleOrientationMatrix() {
    global.APP_STATE.orientationMatrixOpen = !global.APP_STATE.orientationMatrixOpen;
    const box = document.getElementById("orientationMatrixBody");
    const btn = document.getElementById("btnToggleOriMatrix");
    if (box) box.classList.toggle("hidden", !global.APP_STATE.orientationMatrixOpen);
    if (btn) btn.textContent = global.APP_STATE.orientationMatrixOpen ? "▲ Ẩn bảng xoay 6 tư thế" : "▼ Mở bảng xoay 6 tư thế 3D";
  }

  function renderOrientationMatrix() {
    const container = document.getElementById("orientationMatrixGrid");
    if (!container) return;
    const item = global.APP_STATE.items[global.APP_STATE.selectedIndex] || global.APP_STATE.items[0];
    if (!item) return;

    const wallThick = parseFloat(document.getElementById("inp_tX")?.value) || 4;
    const ruleCfg = global.getRuleConfig();
    const evals = typeof global.evaluateAll6Orientations === "function"
      ? global.evaluateAll6Orientations(item, wallThick, 2, ruleCfg)
      : [];

    container.innerHTML = "";
    evals.forEach(ev => {
      const isSelected = global.APP_STATE.selectedOriId === ev.ori.id;
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
          }" ${!global.APP_STATE.isAuthorized ? "disabled" : ""}>
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
      if (btnStd && ev.feasible && global.APP_STATE.isAuthorized) {
        btnStd.onclick = () => applyOrientationEvaluation(item, ev, false);
      }
      const btnMax = card.querySelector(".btn-apply-max");
      if (btnMax && ev.feasible && global.APP_STATE.isAuthorized) {
        btnMax.onclick = () => applyOrientationEvaluation(item, ev, true);
      }

      container.appendChild(card);
    });
  }

  function applyOrientationEvaluation(item, ev, useMax) {
    global.APP_STATE.selectedOriId = ev.ori.id;
    const nx = useMax ? ev.maxNx : ev.bestNx;
    const ny = useMax ? ev.maxNy : ev.bestNy;

    const elL = document.getElementById("inp_L"); if (elL) elL.value = ev.L_part;
    const elW = document.getElementById("inp_W"); if (elW) elW.value = ev.W_part;
    const elOffX = document.getElementById("inp_offX"); if (elOffX) elOffX.value = 5;
    const elOffY = document.getElementById("inp_offY"); if (elOffY) elOffY.value = 5;
    const elNx = document.getElementById("inp_nx"); if (elNx) elNx.value = nx;
    const elNy = document.getElementById("inp_ny"); if (elNy) elNy.value = ny;
    const elHVD = document.getElementById("inp_hVD"); if (elHVD) elHVD.value = ev.recWallH;
    const elHVN = document.getElementById("inp_hVN"); if (elHVN) elHVN.value = ev.recWallH;
    const elHBao = document.getElementById("inp_hBao"); if (elHBao) elHBao.value = ev.recWallH;
    const elSDVD = document.getElementById("inp_slotDepthVD"); if (elSDVD) elSDVD.value = (ev.recWallH / 2).toFixed(2);
    const elSDVN = document.getElementById("inp_slotDepthVN"); if (elSDVN) elSDVN.value = (ev.recWallH / 2).toFixed(2);

    global.APP_STATE.activeFootprint = {
      x: ev.ori.fX,
      y: ev.ori.fY,
      h: ev.ori.hPart,
      label: ev.ori.label
    };

    renderOrientationMatrix();
    updateUIAndRender();
  }

  function rotateActiveProduct90() {
    const fp = global.APP_STATE.activeFootprint;
    if (!fp) return;
    global.APP_STATE.activeFootprint = {
      x: fp.y,
      y: fp.x,
      h: fp.h,
      label: `Xoay 90° (Ô=${fp.y}×${fp.x}, Cao=${fp.h})`
    };
    updateUIAndRender();
  }

  function showRowHoverPreview(evt, idx) {
    const item = global.APP_STATE.items[idx];
    const tooltip = document.getElementById("rowHoverTooltip");
    if (!item || !tooltip) return;

    const wallThick = parseFloat(document.getElementById("inp_tX")?.value) || 4;
    const summary = typeof global.evaluateRowQuickSummary === "function"
      ? global.evaluateRowQuickSummary(item, wallThick, global.getRuleConfig())
      : { ok: false, best: null };

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
    if (typeof global.enhancePartPopup === "function") global.enhancePartPopup(evt, idx);
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
    if (tooltip && !global.partPopupPinned) tooltip.classList.add("hidden");
  }

  function renderDetachedPlatesSection() {
    const g = global.computeCadGeometry();
    const item = global.APP_STATE.items[global.APP_STATE.selectedIndex] || global.APP_STATE.items[0];
    const plates = global.getPlatesCatalog(g, item);
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

  function setWallView(mode) {
    const vd = document.getElementById("chk_showVD");
    const vn = document.getElementById("chk_showVN");
    if (vd) vd.checked = mode !== "vn";
    if (vn) vn.checked = mode !== "vd";
    updateUIAndRender();
    if (global.CAD_3D?.vdGroup) global.CAD_3D.vdGroup.visible = !!vd?.checked;
    if (global.CAD_3D?.vnGroup) global.CAD_3D.vnGroup.visible = !!vn?.checked;
    const info = document.getElementById("measureInfo");
    if (info) {
      info.textContent = mode === "vd"
        ? "Đang xem riêng vách dọc (VD)."
        : mode === "vn"
        ? "Đang xem riêng vách ngang (VN)."
        : "Đang xem tổng hợp vách dọc và vách ngang.";
    }
  }

  function updateUIAndRender() {
    const g = global.computeCadGeometry();
    const item = global.APP_STATE.items[global.APP_STATE.selectedIndex] || global.APP_STATE.items[0];
    const ruleCfg = global.getRuleConfig();
    const ruleCheck = global.checkTotalMatchesRule(g.totalCells, ruleCfg);

    const elTotal = document.getElementById("res_totalCells");
    if (elTotal) elTotal.textContent = `${g.totalCells} ô (${g.nx} × ${g.ny})`;

    const badge = document.getElementById("res_multBadge");
    if (badge) {
      badge.textContent = ruleCheck.text;
      badge.className = ruleCheck.ok
        ? "px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
        : "px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40";
    }

    const elWalls = document.getElementById("res_wallsCount");
    if (elWalls) elWalls.textContent = `${g.vWallsCount} dọc (VD) × ${g.hWallsCount} ngang (VN)`;

    const elCellDim = document.getElementById("res_cellDim");
    if (elCellDim) elCellDim.textContent = `${g.cellX.toFixed(2)} × ${g.cellY.toFixed(2)} mm`;

    const fp = global.APP_STATE.activeFootprint;
    const fitStatusEl = document.getElementById("res_partFitBadge");
    if (fitStatusEl && fp && item) {
      const fitsXY = fp.x <= g.cellX + 0.05 && fp.y <= g.cellY + 0.05;
      const fitsH = fp.h <= (item.boxIn?.H || 9999);
      if (fitsXY && fitsH) {
        fitStatusEl.textContent = `✓ Vừa ô (${fp.x}×${fp.y} ≤ ${g.cellX.toFixed(1)}×${g.cellY.toFixed(1)}mm)`;
        fitStatusEl.className = "text-[11px] mono font-bold text-emerald-300";
      } else {
        fitStatusEl.textContent = `✕ Cấn SP! Cần ô ≥ ${fp.x}×${fp.y}mm (Hiện tại ${g.cellX.toFixed(1)}×${g.cellY.toFixed(1)}mm)`;
        fitStatusEl.className = "text-[11px] mono font-bold text-rose-400";
      }
    }

    const fileBase = getMasterFileBaseName();
    const fnEl = document.getElementById("lbl_exportFilename");
    if (fnEl) fnEl.textContent = `${fileBase}.dxf`;

    if (item) {
      const codeVD = document.getElementById("lbl_codeVD"); if (codeVD) codeVD.textContent = `${item.partCode}-VD`;
      const codeVN = document.getElementById("lbl_codeVN"); if (codeVN) codeVN.textContent = `${item.partCode}-VN`;
      const codeBD = document.getElementById("lbl_codeBD"); if (codeBD) codeBD.textContent = `${item.partCode}-BD`;
      const codeBN = document.getElementById("lbl_codeBN"); if (codeBN) codeBN.textContent = `${item.partCode}-BN`;

      const summaryPill = document.getElementById("excelCollapsedSummary");
      if (summaryPill) {
        summaryPill.textContent = `Đang chọn: ${item.partCode} (${item.partName}) • ${g.totalCells} ô (${g.nx}×${g.ny}) • File: ${fileBase}`;
      }

      const topLabel = document.getElementById("topPartLabel");
      if (topLabel) {
        topLabel.textContent = `${item.partCode} • ${item.partName} (${item.pL}×${item.pW}×${item.pH}mm)`;
      }

      const btmStatus = document.getElementById("bottomStatusBar");
      if (btmStatus) {
        btmStatus.innerHTML = `
          <span>📦 <b class="text-white">${item.partCode}</b></span>
          <span class="text-slate-600">•</span>
          <span>Box In: <b>${item.boxIn?.L || 0}×${item.boxIn?.W || 0}×${item.boxIn?.H || 0}</b></span>
          <span class="text-slate-600">•</span>
          <span>Layout: <b class="text-sky-300">${g.L}×${g.W}</b> mm</span>
          <span class="text-slate-600">•</span>
          <span class="text-emerald-300">Lọt lòng: <b>${g.cellX.toFixed(1)}×${g.cellY.toFixed(1)}</b> mm</span>
          <span class="text-slate-600">•</span>
          <span class="text-amber-300 font-bold"><b>${g.totalCells} Ô</b> (${g.nx}×${g.ny})</span>
        `;
      }
    }

    // Cập nhật các ô hiển thị kích thước cảm ứng trên Mobile Tuner
    const mobL = document.getElementById("mob_val_L"); if (mobL) mobL.textContent = g.L;
    const mobW = document.getElementById("mob_val_W"); if (mobW) mobW.textContent = g.W;
    const mobNx = document.getElementById("mob_val_nx"); if (mobNx) mobNx.textContent = g.nx;
    const mobNy = document.getElementById("mob_val_ny"); if (mobNy) mobNy.textContent = g.ny;
    const mobH = document.getElementById("mob_val_h"); if (mobH) mobH.textContent = g.hVD;
    const mobT = document.getElementById("mob_val_t"); if (mobT) mobT.textContent = g.tX;
    const mobOff = document.getElementById("mob_val_off"); if (mobOff) mobOff.textContent = g.offX;
    const mobTotal = document.getElementById("mob_val_total"); if (mobTotal) mobTotal.textContent = `${g.totalCells} ô`;
    const mobSummary = document.getElementById("mob_summary_txt");
    if (mobSummary) mobSummary.textContent = `${g.L}×${g.W} mm • ${g.totalCells} ô (${g.nx}×${g.ny})`;
    const mobCellDim = document.getElementById("mob_res_cellDim");
    if (mobCellDim) mobCellDim.textContent = `${g.cellX.toFixed(1)} × ${g.cellY.toFixed(1)} mm`;
    const mobMult = document.getElementById("mob_res_multBadge");
    if (mobMult) {
      mobMult.textContent = ruleCheck.text;
      mobMult.className = ruleCheck.ok
        ? "text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold"
        : "text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold";
    }
    const mobFit = document.getElementById("mob_res_partFitBadge");
    if (mobFit && fp && item) {
      const fitsXY = fp.x <= g.cellX + 0.05 && fp.y <= g.cellY + 0.05;
      const fitsH = fp.h <= (item.boxIn?.H || 9999);
      if (fitsXY && fitsH) {
        mobFit.textContent = "✓ Vừa ô";
        mobFit.className = "text-[11px] font-bold text-emerald-300";
      } else {
        mobFit.textContent = "✕ Cấn SP!";
        mobFit.className = "text-[11px] font-bold text-rose-400";
      }
    }

    if (typeof global.refreshDrawingQRCodes === "function") global.refreshDrawingQRCodes();
    if (typeof global.renderMainCanvas === "function") global.renderMainCanvas();
    renderDetachedPlatesSection();
    updateOnCanvasBadges();
  }

  // ============================================================================
  // CẬP NHẬT TỌA ĐỘ VÀ NỘI DUNG CÁC BADGE CHỈNH SỬA KÍCH THƯỚC TRỰC TIẾP TRÊN BẢN VẼ
  // ============================================================================
  function updateOnCanvasBadges() {
    const overlay = document.getElementById("canvasDirectOverlay");
    if (!overlay) return;
    if (global.APP_STATE.viewMode === "3d" || global.APP_STATE.isExporting) {
      overlay.style.display = "none";
      return;
    }
    overlay.style.display = "block";

    const t = global.cadMeasureTransform;
    if (!t) return;

    const g = global.computeCadGeometry();
    const item = global.APP_STATE.items[global.APP_STATE.selectedIndex] || {};
    const plates = global.getPlatesCatalog(g, item);
    const masterLayout = global.computeMasterWorldLayout(g, item, plates);

    const toScreenX = (mmX) => t.originX + mmX * t.scale;
    const toScreenY = (mmY) => t.originY + mmY * t.scale;

    // 1. Badge L (Dài Phủ Bì L - Cạnh trên bản vẽ)
    const badgeL = document.getElementById("badge_L");
    if (badgeL) {
      const lx = toScreenX(g.L / 2);
      const ly = toScreenY(0) - 24;
      badgeL.style.left = `${Math.round(lx)}px`;
      badgeL.style.top = `${Math.round(ly)}px`;
      const inp = document.getElementById("badge_inp_L");
      if (inp && document.activeElement !== inp) inp.value = g.L;
    }

    // 2. Badge W (Rộng Phủ Bì W - Cạnh trái ngoài)
    const badgeW = document.getElementById("badge_W");
    if (badgeW) {
      const wx = toScreenX(0) - 72;
      const wy = toScreenY(g.W / 2);
      badgeW.style.left = `${Math.round(wx)}px`;
      badgeW.style.top = `${Math.round(wy)}px`;
      const inp = document.getElementById("badge_inp_W");
      if (inp && document.activeElement !== inp) inp.value = g.W;
    }

    // 3. Badge Grid (Nx x Ny - Dưới chân cụm layout)
    const badgeGrid = document.getElementById("badge_Grid");
    if (badgeGrid) {
      const gx = toScreenX(g.L / 2);
      const gy = toScreenY(g.W + 30);
      badgeGrid.style.left = `${Math.round(gx)}px`;
      badgeGrid.style.top = `${Math.round(gy)}px`;
      const inx = document.getElementById("badge_inp_nx");
      if (inx && document.activeElement !== inx) inx.value = g.nx;
      const iny = document.getElementById("badge_inp_ny");
      if (iny && document.activeElement !== iny) iny.value = g.ny;
      const tot = document.getElementById("badge_txt_total");
      if (tot) tot.textContent = `${g.totalCells} ô`;

      const ruleCheck = global.checkTotalMatchesRule(g.totalCells, global.getRuleConfig());
      const ruleStat = document.getElementById("badge_rule_status");
      if (ruleStat) {
        ruleStat.textContent = ruleCheck.text;
        ruleStat.className = ruleCheck.ok
          ? "px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
          : "px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40";
      }
    }

    // 4. Badge Wall Thickness T
    const badgeT = document.getElementById("badge_T");
    if (badgeT) {
      const firstWallX = g.vWalls.length > 0 ? g.vWalls[0] : (g.offX + g.bX + g.cellX);
      const tx = toScreenX(firstWallX);
      const ty = toScreenY(g.offY + g.bY + 28);
      badgeT.style.left = `${Math.round(tx)}px`;
      badgeT.style.top = `${Math.round(ty)}px`;
      const inp = document.getElementById("badge_inp_t");
      if (inp && document.activeElement !== inp) inp.value = g.tX;
    }

    // 5. Badge Offset
    const badgeOff = document.getElementById("badge_Offset");
    if (badgeOff) {
      const ox = toScreenX(g.offX);
      const oy = toScreenY(g.offY);
      badgeOff.style.left = `${Math.round(ox + 46)}px`;
      badgeOff.style.top = `${Math.round(oy + 14)}px`;
      const inp = document.getElementById("badge_inp_off");
      if (inp && document.activeElement !== inp) inp.value = g.offX;
    }

    // 6. Badge Height H
    const badgeH = document.getElementById("badge_H");
    if (badgeH) {
      if (global.APP_STATE.viewMode === "master" && masterLayout.platePlacements?.length > 0) {
        badgeH.style.display = "inline-flex";
        const pp0 = masterLayout.platePlacements[0];
        const hx = toScreenX(pp0.x + pp0.width / 2);
        const hy = toScreenY(g.W - pp0.topY) - 26;
        badgeH.style.left = `${Math.round(hx)}px`;
        badgeH.style.top = `${Math.round(hy)}px`;
        const inp = document.getElementById("badge_inp_h");
        if (inp && document.activeElement !== inp) inp.value = g.hVD;
      } else {
        badgeH.style.display = "none";
      }
    }
  }

  function syncBadgeInput(targetInputId, val) {
    const el = document.getElementById(targetInputId);
    if (el) {
      el.value = val;
      updateUIAndRender();
    }
  }

  function togglePartsDrawer(open) {
    const drawer = document.getElementById("partsDrawer");
    const backdrop = document.getElementById("drawerBackdrop");
    if (!drawer || !backdrop) return;
    const isOpen = open !== undefined ? open : !drawer.classList.contains("active");
    drawer.classList.toggle("active", isOpen);
    backdrop.classList.toggle("active", isOpen);
  }

  function toggleSettingsDrawer(open) {
    const drawer = document.getElementById("settingsDrawer");
    const backdrop = document.getElementById("drawerBackdrop");
    if (!drawer || !backdrop) return;
    const isOpen = open !== undefined ? open : !drawer.classList.contains("active");
    drawer.classList.toggle("active", isOpen);
    backdrop.classList.toggle("active", isOpen);
  }

  function toggleMobileDimSheet(open) {
    const sheet = document.getElementById("mobileDimSheet");
    const backdrop = document.getElementById("drawerBackdrop");
    if (!sheet || !backdrop) return;
    const isOpen = open !== undefined ? open : !sheet.classList.contains("active");
    document.getElementById("mobileExportModal")?.classList.remove("active");
    sheet.classList.toggle("active", isOpen);
    backdrop.classList.toggle("active", isOpen);
  }

  function toggleMobileExportModal(open) {
    const modal = document.getElementById("mobileExportModal");
    const backdrop = document.getElementById("drawerBackdrop");
    if (!modal || !backdrop) return;
    const isOpen = open !== undefined ? open : !modal.classList.contains("active");
    document.getElementById("mobileDimSheet")?.classList.remove("active");
    modal.classList.toggle("active", isOpen);
    backdrop.classList.toggle("active", isOpen);
  }

  function cycleMobileView() {
    const modes = ["master", "layout", "3d"];
    const curIdx = modes.indexOf(global.APP_STATE.viewMode);
    const nextMode = modes[(curIdx + 1) % modes.length];
    setViewMode(nextMode);
  }

  function closeAllDrawers() {
    document.getElementById("partsDrawer")?.classList.remove("active");
    document.getElementById("settingsDrawer")?.classList.remove("active");
    document.getElementById("mobileDimSheet")?.classList.remove("active");
    document.getElementById("mobileExportModal")?.classList.remove("active");
    document.getElementById("drawerBackdrop")?.classList.remove("active");
  }


  function renderExcelTable() {
    const tbody = document.getElementById("excelTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    const wallThick = parseFloat(document.getElementById("inp_tX")?.value) || 4;
    const ruleCfg = global.getRuleConfig();

    global.APP_STATE.items.forEach((item, idx) => {
      const summary = typeof global.evaluateRowQuickSummary === "function"
        ? global.evaluateRowQuickSummary(item, wallThick, ruleCfg)
        : { ok: false, best: null };

      const tr = document.createElement("tr");
      tr.className = `cursor-pointer transition hover:bg-sky-500/15 ${idx === global.APP_STATE.selectedIndex ? "row-selected" : ""}`;
      tr.onclick = () => selectExcelItem(idx);
      tr.onmouseenter = (e) => { if (window.matchMedia("(hover:hover) and (pointer:fine)").matches) showRowHoverPreview(e, idx); };
      tr.onmousemove = (e) => { if (!global.partPopupPinned) moveRowHoverPreview(e); };
      tr.onmouseleave = () => hideRowHoverPreview();
      tr.addEventListener("click", (e) => {
        if (window.matchMedia("(hover:none), (pointer:coarse)").matches) {
          showRowHoverPreview({ clientX: window.innerWidth / 2, clientY: window.innerHeight / 3 }, idx);
          global.partPopupPinned = true;
          document.getElementById("rowHoverTooltip")?.classList.add("part-popup-touch");
          e.stopPropagation();
        }
      });

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
        <td class="px-3 py-2 mono text-emerald-300 text-[11px]">Out: ${item.boxOut?.L || 0}×${item.boxOut?.W || 0}×${item.boxOut?.H || 0}<br>In: <b>${item.boxIn?.L || 0}×${item.boxIn?.W || 0}×${item.boxIn?.H || 0}</b></td>
        <td class="px-3 py-2 text-[11px] text-amber-200">${item.note || ""}</td>
        <td class="px-3 py-2 text-right">
          <button class="px-2.5 py-1 rounded bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 border border-sky-500/40 text-[11px] font-semibold">Nạp & Xoay thử</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  function selectExcelItem(idx) {
    global.APP_STATE.selectedIndex = idx;
    const item = global.APP_STATE.items[idx];
    renderExcelTable();
    if (!item) return;

    const wallThick = parseFloat(document.getElementById("inp_tX")?.value) || 4;
    const recs = typeof global.generateRecommendations === "function"
      ? global.generateRecommendations(item, wallThick, 2, global.getRuleConfig())
      : [];
    const recBar = document.getElementById("recommendationBar");
    const recBtns = document.getElementById("recommendationButtons");

    if (recs.length > 0) {
      if (recBar) recBar.classList.remove("hidden");
      if (recBtns) {
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
      }
      applyRecommendation(item, recs[0]);
    } else {
      renderOrientationMatrix();
      updateUIAndRender();
    }
  }

  function applyRecommendation(item, rec) {
    global.APP_STATE.selectedOriId = rec.ori.id;
    const elL = document.getElementById("inp_L"); if (elL) elL.value = rec.L_part;
    const elW = document.getElementById("inp_W"); if (elW) elW.value = rec.W_part;
    const elOffX = document.getElementById("inp_offX"); if (elOffX) elOffX.value = 5;
    const elOffY = document.getElementById("inp_offY"); if (elOffY) elOffY.value = 5;
    const elNx = document.getElementById("inp_nx"); if (elNx) elNx.value = rec.nx;
    const elNy = document.getElementById("inp_ny"); if (elNy) elNy.value = rec.ny;
    const elHVD = document.getElementById("inp_hVD"); if (elHVD) elHVD.value = rec.recWallH;
    const elHVN = document.getElementById("inp_hVN"); if (elHVN) elHVN.value = rec.recWallH;
    const elHBao = document.getElementById("inp_hBao"); if (elHBao) elHBao.value = rec.recWallH;
    const elSDVD = document.getElementById("inp_slotDepthVD"); if (elSDVD) elSDVD.value = (rec.recWallH / 2).toFixed(2);
    const elSDVN = document.getElementById("inp_slotDepthVN"); if (elSDVN) elSDVN.value = (rec.recWallH / 2).toFixed(2);

    global.APP_STATE.activeFootprint = {
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
    const cur = parseFloat(el.value) || 0;
    const step = parseFloat(el.step) || 1;
    let next = cur + delta;
    if (el.min !== "" && next < parseFloat(el.min)) next = parseFloat(el.min);
    el.value = (Math.round(next * 100) / 100).toString();

    if (id === "inp_hVD") {
      const hVN = document.getElementById("inp_hVN");
      const hBao = document.getElementById("inp_hBao");
      const sdVD = document.getElementById("inp_slotDepthVD");
      const sdVN = document.getElementById("inp_slotDepthVN");
      if (hVN) hVN.value = el.value;
      if (hBao) hBao.value = el.value;
      const half = (parseFloat(el.value) / 2).toFixed(1);
      if (sdVD) sdVD.value = half;
      if (sdVN) sdVN.value = half;
    }
    if (id === "inp_offX" && (document.getElementById("chk_syncOffset")?.checked ?? true)) {
      const offY = document.getElementById("inp_offY");
      if (offY) offY.value = el.value;
    }
    if (id === "inp_bX" && document.getElementById("chk_syncBorder")?.checked) {
      document.getElementById("inp_bY").value = el.value;
    }
    if (id === "inp_tX" && (document.getElementById("chk_syncInner")?.checked ?? true)) {
      const tY = document.getElementById("inp_tY");
      if (tY) tY.value = el.value;
    }

    updateUIAndRender();
  }

  function highlightAndFocusDim(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.focus();
    el.select();
    const item = el.closest(".dim-ribbon-item");
    if (item) {
      item.classList.remove("dim-focus");
      void item.offsetWidth;
      item.classList.add("dim-focus");
      setTimeout(() => item.classList.remove("dim-focus"), 1200);
    }
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
    document.getElementById("divMode_cellsBox")?.classList.toggle("hidden", mode !== "cells");
    document.getElementById("divMode_sizeBox")?.classList.toggle("hidden", mode !== "size");
    updateUIAndRender();
  }

  function onPackingRuleChange() {
    const mode = document.getElementById("packingRuleMode").value;
    document.getElementById("customMultValue")?.classList.toggle("hidden", mode !== "custom_mult");
    document.getElementById("exactTargetValue")?.classList.toggle("hidden", mode !== "exact_target");
    renderExcelTable();
    renderOrientationMatrix();
    updateUIAndRender();
  }

  function setViewMode(mode) {
    global.APP_STATE.viewMode = mode;
    global.APP_STATE.panX = 0;
    global.APP_STATE.panY = 0;

    const is3D = mode === "3d";
    document.getElementById("canvasContainer")?.classList.toggle("hidden", is3D);
    document.getElementById("viewer3DContainer")?.classList.toggle("hidden", !is3D);

    const tabMaster = document.getElementById("tabMasterView");
    if (tabMaster) {
      tabMaster.className = mode === "master"
        ? "px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-500 text-slate-950 transition"
        : "px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition";
    }
    const tabLayout = document.getElementById("tabLayoutOnly");
    if (tabLayout) {
      tabLayout.className = mode === "layout"
        ? "px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-500 text-slate-950 transition"
        : "px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition";
    }
    const tab3D = document.getElementById("tab3DView");
    if (tab3D) {
      tab3D.className = mode === "3d"
        ? "px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-400 text-slate-950 transition"
        : "px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-300 hover:text-white transition";
    }

    const txtMobile = document.getElementById("txtMobileView");
    if (txtMobile) {
      txtMobile.textContent = mode === "master" ? "📐 Tổng Hợp" : mode === "layout" ? "🔍 Mặt Bằng 2D" : "🧊 Mô Hình 3D";
    }
    const dockTxt = document.getElementById("dockTxt_view");
    if (dockTxt) {
      dockTxt.textContent = mode === "master" ? "Tổng Hợp" : mode === "layout" ? "Mặt Bằng" : "Mô Hình 3D";
    }

    updateUIAndRender();
  }

  function setLineWeightMode(mode) {
    global.APP_STATE.lineWeightMode = mode;
    updateUIAndRender();
  }

  function setBgTheme(theme) {
    global.APP_STATE.bgTheme = theme;
    const vp = document.getElementById("canvasContainer");
    if (vp) {
      vp.classList.remove("viewport-autocad", "viewport-blueprint", "viewport-paper");
      vp.classList.add(`viewport-${theme}`);
    }
    updateUIAndRender();
  }

  function updateWallColors() {
    global.APP_STATE.colors.vd = document.getElementById("col_VD").value;
    global.APP_STATE.colors.vn = document.getElementById("col_VN").value;
    global.APP_STATE.colors.bd = document.getElementById("col_BD").value;
    global.APP_STATE.colors.bn = document.getElementById("col_BN").value;
    global.APP_STATE.colors.slot = document.getElementById("col_SLOT").value;
    global.APP_STATE.colors.frame = document.getElementById("col_FRAME").value;
    updateUIAndRender();
  }

  function zoomCanvas(factor) {
    global.APP_STATE.zoom = Math.min(4.0, Math.max(0.2, global.APP_STATE.zoom * factor));
    if (typeof global.renderMainCanvas === "function") global.renderMainCanvas();
  }

  function resetCanvasView() {
    global.APP_STATE.zoom = 0.76;
    global.APP_STATE.panX = 0;
    global.APP_STATE.panY = 0;
    if (typeof global.renderMainCanvas === "function") global.renderMainCanvas();
  }

  function exportMasterPNG() {
    if (!checkExportAuth()) return;
    if (!global.APP_STATE.items || global.APP_STATE.items.length === 0) {
      alert("Vui lòng tải lên file Excel dữ liệu trước khi xuất ảnh!");
      return;
    }

    const prevMode = global.APP_STATE.viewMode;
    const prevZoom = global.APP_STATE.zoom;
    const prevPanX = global.APP_STATE.panX;
    const prevPanY = global.APP_STATE.panY;
    const prevExporting = global.APP_STATE.isExporting;

    global.APP_STATE.viewMode = "master";
    if (typeof global.refreshDrawingQRCodes === "function") global.refreshDrawingQRCodes();

    const g = global.computeCadGeometry();
    const item = global.APP_STATE.items[global.APP_STATE.selectedIndex] || global.APP_STATE.items[0];
    const plates = global.getPlatesCatalog(g, item);
    const masterLayout = global.computeMasterWorldLayout(g, item, plates);

    const exportScale = 1.5;
    const exportDpr = 2.0;

    const rectW = masterLayout.worldW * exportScale + 120;
    const rectH = masterLayout.worldH * exportScale + 120;

    global.APP_STATE.isExporting = true;
    global.APP_STATE.exportDpr = exportDpr;
    global.APP_STATE.exportW = rectW * exportDpr;
    global.APP_STATE.exportH = rectH * exportDpr;

    global.APP_STATE.zoom = 1.0;
    global.APP_STATE.panX = 0;
    global.APP_STATE.panY = 0;

    global.renderMainCanvas();

    const cadCanvas = document.getElementById("cadCanvas");
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = cadCanvas.width;
    exportCanvas.height = cadCanvas.height;
    const exportCtx = exportCanvas.getContext("2d");

    exportCtx.fillStyle = global.APP_STATE.bgTheme === "paper" ? "#f8fafc" : "#050912";
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.drawImage(cadCanvas, 0, 0);

    const link = document.createElement("a");
    link.download = `${getMasterFileBaseName()}_Master_HQ.png`;
    link.href = exportCanvas.toDataURL("image/png", 1.0);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    global.APP_STATE.isExporting = prevExporting;
    global.APP_STATE.viewMode = prevMode;
    global.APP_STATE.zoom = prevZoom;
    global.APP_STATE.panX = prevPanX;
    global.APP_STATE.panY = prevPanY;
    global.renderMainCanvas();
  }

  function exportLayoutOnlyPNG() {
    if (!checkExportAuth()) return;
    if (!global.APP_STATE.items || global.APP_STATE.items.length === 0) {
      alert("Vui lòng tải lên file Excel dữ liệu trước khi xuất ảnh!");
      return;
    }

    const prevMode = global.APP_STATE.viewMode;
    const prevZoom = global.APP_STATE.zoom;
    const prevPanX = global.APP_STATE.panX;
    const prevPanY = global.APP_STATE.panY;
    const prevExporting = global.APP_STATE.isExporting;

    global.APP_STATE.viewMode = "layout";
    const g = global.computeCadGeometry();

    const layoutOnlyLeftPad = 250;
    const totalWorldW = g.L + layoutOnlyLeftPad + 120;
    const totalWorldH = g.W + 280;

    const exportScale = 1.8;
    const exportDpr = 2.0;

    const rectW = totalWorldW * exportScale + 120;
    const rectH = totalWorldH * exportScale + 120;

    global.APP_STATE.isExporting = true;
    global.APP_STATE.exportDpr = exportDpr;
    global.APP_STATE.exportW = rectW * exportDpr;
    global.APP_STATE.exportH = rectH * exportDpr;
    global.APP_STATE.zoom = 1.0;
    global.APP_STATE.panX = 0;
    global.APP_STATE.panY = 0;

    global.renderMainCanvas();

    const cadCanvas = document.getElementById("cadCanvas");
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = cadCanvas.width;
    exportCanvas.height = cadCanvas.height;
    const exportCtx = exportCanvas.getContext("2d");

    exportCtx.fillStyle = global.APP_STATE.bgTheme === "paper" ? "#f8fafc" : "#050912";
    exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportCtx.drawImage(cadCanvas, 0, 0);

    const link = document.createElement("a");
    link.download = `${getMasterFileBaseName()}_Layout2D_HQ.png`;
    link.href = exportCanvas.toDataURL("image/png", 1.0);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    global.APP_STATE.isExporting = prevExporting;
    global.APP_STATE.viewMode = prevMode;
    global.APP_STATE.zoom = prevZoom;
    global.APP_STATE.panX = prevPanX;
    global.APP_STATE.panY = prevPanY;
    global.renderMainCanvas();
  }

  function getDrawingMetadata() {
    const g = global.computeCadGeometry();
    const item = global.APP_STATE.items[global.APP_STATE.selectedIndex] || {};
    return {
      schema: "LayoutCAD-Pro-Design-v1",
      createdAt: new Date().toISOString(),
      author: "Nguyễn Thị Minh Thư",
      authorNote: "người con Nam Bộ 🤞",
      product: {
        partCode: item.partCode || "",
        partName: item.partName || "",
        customer: item.customer || ""
      },
      layout: {
        L: g.L, W: g.W, nx: g.nx, ny: g.ny,
        totalCells: g.totalCells, cellX: g.cellX, cellY: g.cellY,
        tX: g.tX, tY: g.tY, offX: g.offX, offY: g.offY, bX: g.bX, bY: g.bY
      },
      plates: global.getPlatesCatalog(g, item).map(p => ({
        code: p.code,
        type: p.shortType,
        length: p.length,
        height: p.height,
        thickness: p.thick,
        quantity: p.qty,
        slotWidth: p.slotW,
        slotDepth: p.slotDepth,
        slotCoordinates: p.slots
      }))
    };
  }

  function downloadDrawingMetadata() {
    if (!checkExportAuth()) return;
    const blob = new Blob([JSON.stringify(getDrawingMetadata(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = getMasterFileBaseName() + "_metadata.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function refreshDrawingQRCodes() {
    if (!global.QRCode) return;
    const g = global.computeCadGeometry();
    const item = global.APP_STATE.items[global.APP_STATE.selectedIndex] || {};
    const d = document.getElementById("drawingQr");
    const a = document.getElementById("authorQr");
    if (!d || !a) return;

    const excelColumnsText = typeof global.toUtf8ByteString === "function"
      ? global.toUtf8ByteString([
          item.partCode || "",
          item.partName || "",
          item.pL || 0,
          item.pW || 0,
          item.pH || 0,
          item.customer || "",
          `Cells:${g.totalCells}(${g.nx}x${g.ny})`
        ].join("\t"))
      : "";

    const authorQrText = typeof global.toUtf8ByteString === "function"
      ? global.toUtf8ByteString("Tac gia: Nguyen Thi Minh Thu - nguoi con Nam Bo | LayoutCAD Pro")
      : "";

    try {
      if (d) {
        d.innerHTML = "";
        new QRCode(d, {
          text: excelColumnsText,
          width: 76,
          height: 76,
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    } catch (err) {
      console.warn("Drawing QR error:", err);
    }

    try {
      if (a) {
        a.innerHTML = "";
        new QRCode(a, {
          text: authorQrText,
          width: 76,
          height: 76,
          correctLevel: QRCode.CorrectLevel.L
        });
      }
    } catch (err) {
      console.warn("Author QR error:", err);
    }
  }

  function applyWallUpdate() {
    updateUIAndRender();
    refreshDrawingQRCodes();
    const b = document.getElementById("applyWallUpdate");
    if (b) {
      b.classList.remove("update-pending");
      b.classList.add("update-flash");
      setTimeout(() => b.classList.remove("update-flash"), 700);
    }
    const info = document.getElementById("measureInfo");
    if (info) info.textContent = "Đã cập nhật hình học vách và bảng kê chi tiết.";
  }

  // ============================================================================
  // DOMContentLoaded: Khởi chạy và gắn kết sự kiện người dùng
  // ============================================================================
  window.addEventListener("DOMContentLoaded", () => {
    // 1. Gắn sự kiện cho các ô nhập liệu thông số
    const inputIds = [
      "inp_L", "inp_W", "inp_offX", "inp_offY", "inp_bX", "inp_bY",
      "inp_tX", "inp_tY", "inp_nx", "inp_ny", "inp_desX", "inp_desY",
      "inp_hVD", "inp_hVN", "inp_hBao", "inp_slotW", "inp_slotDepthVD", "inp_slotDepthVN",
      "sel_cutVD", "sel_cutVN"
    ];

    let updateDebounceTimer = null;
    inputIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", () => {
          if (id === "inp_hVD") {
            const hVN = document.getElementById("inp_hVN");
            const hBao = document.getElementById("inp_hBao");
            const sdVD = document.getElementById("inp_slotDepthVD");
            const sdVN = document.getElementById("inp_slotDepthVN");
            if (hVN) hVN.value = el.value;
            if (hBao) hBao.value = el.value;
            const half = (parseFloat(el.value) / 2).toFixed(1);
            if (sdVD) sdVD.value = half;
            if (sdVN) sdVN.value = half;
          }
          if (id === "inp_offX" && (document.getElementById("chk_syncOffset")?.checked ?? true)) {
            const offY = document.getElementById("inp_offY");
            if (offY) offY.value = el.value;
          }
          if (id === "inp_tX" && (document.getElementById("chk_syncInner")?.checked ?? true)) {
            const tY = document.getElementById("inp_tY");
            if (tY) tY.value = el.value;
          }

          document.getElementById("canvasContainer")?.classList.add("geometry-changing");
          const btn = document.getElementById("applyWallUpdate");
          if (btn) btn.classList.add("update-pending");

          clearTimeout(updateDebounceTimer);
          updateDebounceTimer = setTimeout(() => {
            updateUIAndRender();
            clearTimeout(window._cadUpdateFlashTimer);
            window._cadUpdateFlashTimer = setTimeout(() => {
              document.getElementById("canvasContainer")?.classList.remove("geometry-changing");
            }, 500);
          }, 60);
        });
      }
    });

    // 2. Gắn sự kiện nạp file Excel
    const excelInput = document.getElementById("excelFileInput");
    if (excelInput) {
      excelInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const data = new Uint8Array(evt.target.result);
            const wb = XLSX.read(data, { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

            const parsed = typeof global.parseExcelRowsToItems === "function"
              ? global.parseExcelRowsToItems(rows)
              : [];

            if (parsed.length > 0) {
              global.APP_STATE.items = parsed;
              global.APP_STATE.isAuthorized = true;
              global.APP_STATE.canExport = true;
              selectExcelItem(0);
            } else {
              alert("Không tìm thấy dữ liệu linh kiện hợp lệ trong file Excel!");
            }
          } catch (err) {
            console.error("Lỗi đọc file Excel:", err);
            alert("Lỗi khi đọc file Excel: " + err.message);
          }
        };
        reader.readAsArrayBuffer(file);
      });
    }

    // 3. Gắn sự kiện Viewport Canvas (Pan & Zoom)
    const vp = document.getElementById("canvasContainer");
    if (vp) {
      vp.addEventListener("wheel", (e) => {
        e.preventDefault();
        zoomCanvas(e.deltaY < 0 ? 1.12 : 0.89);
      }, { passive: false });

      vp.addEventListener("mousedown", (e) => {
        // Tránh xung đột khi đang ở chế độ đo DIM
        if (vp.classList.contains("measure-active")) return;
        global.APP_STATE.isPanning = true;
        global.APP_STATE.startPanX = e.clientX - global.APP_STATE.panX;
        global.APP_STATE.startPanY = e.clientY - global.APP_STATE.panY;
      });

      window.addEventListener("mousemove", (e) => {
        if (!global.APP_STATE.isPanning) return;
        global.APP_STATE.panX = e.clientX - global.APP_STATE.startPanX;
        global.APP_STATE.panY = e.clientY - global.APP_STATE.startPanY;
        if (typeof global.renderMainCanvas === "function") global.renderMainCanvas();
      });

      window.addEventListener("mouseup", () => {
        global.APP_STATE.isPanning = false;
      });
    }

    // 4. Resize listener
    window.addEventListener("resize", () => {
      if (typeof global.renderMainCanvas === "function") global.renderMainCanvas();
      if (typeof global.resize3DViewer === "function") global.resize3DViewer();
    });

    // 5. KHỞI CHẠY TỰ ĐỘNG VỚI DỮ LIỆU BAN ĐẦU
    if (global.APP_STATE.items && global.APP_STATE.items.length > 0) {
      selectExcelItem(0);
    } else {
      updateUIAndRender();
    }
  });

  // Export functions ra window để các nút onclick trong HTML hoạt động trơn tru
  global.checkExportAuth = checkExportAuth;
  global.getMasterFileBaseName = getMasterFileBaseName;
  global.toggleExcelPanel = toggleExcelPanel;
  global.toggleOrientationMatrix = toggleOrientationMatrix;
  global.renderOrientationMatrix = renderOrientationMatrix;
  global.applyOrientationEvaluation = applyOrientationEvaluation;
  global.rotateActiveProduct90 = rotateActiveProduct90;
  global.showRowHoverPreview = showRowHoverPreview;
  global.moveRowHoverPreview = moveRowHoverPreview;
  global.hideRowHoverPreview = hideRowHoverPreview;
  global.renderDetachedPlatesSection = renderDetachedPlatesSection;
  global.setWallView = setWallView;
  global.updateUIAndRender = updateUIAndRender;
  global.renderExcelTable = renderExcelTable;
  global.selectExcelItem = selectExcelItem;
  global.applyRecommendation = applyRecommendation;
  global.stepVal = stepVal;
  global.syncEqual = syncEqual;
  global.onDivModeChange = onDivModeChange;
  global.onPackingRuleChange = onPackingRuleChange;
  global.setViewMode = setViewMode;
  global.setLineWeightMode = setLineWeightMode;
  global.setBgTheme = setBgTheme;
  global.updateWallColors = updateWallColors;
  global.zoomCanvas = zoomCanvas;
  global.resetCanvasView = resetCanvasView;
  global.exportMasterPNG = exportMasterPNG;
  global.exportLayoutOnlyPNG = exportLayoutOnlyPNG;
  global.getDrawingMetadata = getDrawingMetadata;
  global.downloadDrawingMetadata = downloadDrawingMetadata;
  global.refreshDrawingQRCodes = refreshDrawingQRCodes;
  global.applyWallUpdate = applyWallUpdate;
  global.updateOnCanvasBadges = updateOnCanvasBadges;
  global.syncBadgeInput = syncBadgeInput;
  global.togglePartsDrawer = togglePartsDrawer;
  global.toggleSettingsDrawer = toggleSettingsDrawer;
  global.closeAllDrawers = closeAllDrawers;
  global.highlightAndFocusDim = highlightAndFocusDim;
  global.toggleMobileDimSheet = toggleMobileDimSheet;
  global.toggleMobileExportModal = toggleMobileExportModal;
  global.cycleMobileView = cycleMobileView;

})(window);
