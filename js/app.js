// ============================================================================
// HÀM XỬ LÝ MÃ HÓA UTF-8 & KẾT XUẤT QR CODE TRỰC TIẾP LÊN CANVAS BẢN VẼ
// ============================================================================
function toUtf8ByteString(str) {
  try {
    return unescape(encodeURIComponent(str));
  } catch (_) {
    return str;
  }
}

function drawQrCodeOnContext(ctx, elementId, x, y, size) {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (!el.querySelector("canvas") && !el.querySelector("img")) {
    if (typeof window.refreshDrawingQRCodes === "function") {
      window.refreshDrawingQRCodes();
    }
  }

  const cvs = el.querySelector("canvas");
  const img = el.querySelector("img");

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - 4, y - 4, size + 8, size + 8);
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x - 4, y - 4, size + 8, size + 8);

  if (cvs && cvs.width > 0 && cvs.height > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cvs, x, y, size, size);
  } else if (img && img.complete && img.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, x, y, size, size);
  }
  ctx.restore();
}

// ============================================================================
// HÀM TẠO NỘI DUNG DXF CHUẨN TRỰC TIẾP (ĐẢM BẢO KHÔNG BAO GIỜ TRỐNG RỖNG)
// ============================================================================
function buildMasterDxfContent(g, item, plates, ruleCheck) {
  let lines = [
    "0", "SECTION",
    "2", "HEADER",
    "0", "ENDSEC",
    "0", "SECTION",
    "2", "TABLES",
    "0", "TABLE",
    "2", "LAYER",
    "0", "ENDTAB",
    "0", "ENDSEC",
    "0", "SECTION",
    "2", "ENTITIES"
  ];

  // Vẽ khung chữ nhật phủ bì chính (Layout chính)
  lines.push(
    "0", "LWPOLYLINE",
    "8", "0",
    "90", "4",
    "70", "1",
    "10", "0.0", "20", "0.0",
    "10", String(g.L), "20", "0.0",
    "10", String(g.L), "20", String(g.W),
    "10", "0.0", "20", String(g.W)
  );

  // Vẽ các vách dọc (VD)
  g.vWalls.forEach(wx => {
    lines.push(
      "0", "LINE",
      "8", "VD",
      "10", String(wx), "20", String(g.offY + g.bY),
      "11", String(wx), "21", String(g.W - g.offY - g.bY)
    );
  });

  // Vẽ các vách ngang (VN)
  g.hWalls.forEach(wy => {
    lines.push(
      "0", "LINE",
      "8", "VN",
      "10", String(g.offX + g.bX), "20", String(wy),
      "11", String(g.L - g.offX - g.bX), "21", String(wy)
    );
  });

  // Vẽ chi tiết các tấm vách tách rời ở cột bên phải
  let offsetXPos = g.L + 550;
  plates.forEach((p, idx) => {
    let py = idx * 300; // Khoảng cách giữa các tấm
    // Khung phôi tấm vách
    lines.push(
      "0", "LWPOLYLINE",
      "8", p.shortType,
      "90", "4",
      "70", "1",
      "10", String(offsetXPos), "20", String(py),
      "10", String(offsetXPos + p.length), "20", String(py),
      "10", String(offsetXPos + p.length), "20", String(py + p.height),
      "10", String(offsetXPos), "20", String(py + p.height)
    );

    // Vẽ rãnh đan trên tấm
    p.slots.forEach(sc => {
      let sx = offsetXPos + sc - p.slotW / 2;
      let sy = p.cutFrom === "top" ? py : (py + p.height - p.slotDepth);
      lines.push(
        "0", "LWPOLYLINE",
        "8", "SLOTS",
        "90", "4",
        "70", "1",
        "10", String(sx), "20", String(sy),
        "10", String(sx + p.slotW), "20", String(sy),
        "10", String(sx + p.slotW), "20", String(sy + p.slotDepth),
        "10", String(sx), "20", String(sy + p.slotDepth)
      );
    });
  });

  lines.push(
    "0", "ENDSEC",
    "0", "EOF"
  );

  return lines.join("\n");
}

// ============================================================================
// MODULE: js/app.js
// Bộ điều khiển chính của ứng dụng THÔNG SỐ VÁCH CAD - ISO STANDARD PRO (v3)
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
  if (window.APP_STATE.canExport === false) {
    return false;
  }
  return true;
}

function triggerDRMLockdown() {
  window.APP_STATE.isAuthorized = false;
  window.APP_STATE.canExport = false;
  window.APP_STATE.countdownSecs = 50;
  
  const formArea = document.querySelector("main > aside");
  if (formArea) {
    formArea.style.pointerEvents = "none";
    formArea.style.opacity = "0.2";
  }
  
  const excelInput = document.getElementById("excelFileInput");
  if (excelInput && excelInput.parentElement) {
    excelInput.parentElement.style.pointerEvents = "auto";
    excelInput.parentElement.style.opacity = "1";
  }

  const buttons = document.querySelectorAll("button");
  buttons.forEach(btn => {
    btn.disabled = true;
    btn.style.cursor = "not-allowed";
  });

  if (window.APP_STATE.countdownTimer) clearInterval(window.APP_STATE.countdownTimer);
  window.APP_STATE.countdownTimer = setInterval(() => {
    window.APP_STATE.countdownSecs--;
    renderMainCanvas(); 
    
    if (window.APP_STATE.countdownSecs <= 0) {
      clearInterval(window.APP_STATE.countdownTimer);
      if (Math.random() < 0.1) {
        window.location.href = "https://pipipepea.github.io/MYCARD/";
      } else {
        window.location.href = "https://pipipepea.github.io/PHUC-GAME/";
      }
    }
  }, 1000);
  
  renderMainCanvas();
}

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
        }" ${!window.APP_STATE.isAuthorized ? "disabled" : ""}>
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
    if (btnStd && ev.feasible && window.APP_STATE.isAuthorized) {
      btnStd.onclick = () => applyOrientationEvaluation(item, ev, false);
    }
    const btnMax = card.querySelector(".btn-apply-max");
    if (btnMax && ev.feasible && window.APP_STATE.isAuthorized) {
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
  if (typeof enhancePartPopup === "function") enhancePartPopup(evt, idx);
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
  if (tooltip && !window.partPopupPinned) tooltip.classList.add("hidden");
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

function computeMasterWorldLayout(g, item, plates) {
  const rightColX = g.L + 550; 
  let curPlateTopDown = 10; 
  const platePlacements = [];

  plates.forEach((p, idx) => {
    const minSpacing = p.slots.length > 1
      ? Math.min(...p.slots.slice(1).map((s, i) => Math.abs(s - p.slots[i])))
      : 999;
    const rotateCoords = p.slots.length > 5 || minSpacing < 38;
    const extraLabelSpace = rotateCoords ? 48 : 30;
    const blockHeaderSpace = 28;
    const blockFooterSpace = 180; 

    const topY = g.W - curPlateTopDown - blockHeaderSpace;
    const botY = topY - p.height;

    platePlacements.push({
      plate: p,
      index: idx + 1,
      x: rightColX,
      topY,
      botY,
      width: p.length,
      height: p.height,
      rotateCoords
    });

    curPlateTopDown += blockHeaderSpace + p.height + extraLabelSpace + blockFooterSpace;
  });

  const sec1ShiftX = 260; 
  const sec1ShiftY = 160; 

  const maxPlateW = plates.length > 0 ? Math.max(...plates.map(p => Math.max(p.length, 480 + p.slots.length * 24))) : 650;
  const contentMaxW = Math.max(rightColX + maxPlateW, 1600);
  const paddingX = Math.max(110, contentMaxW * 0.08);

  const leftLowestY = -75;
  const rightLowestY = g.W - curPlateTopDown;
  const contentLowestY = Math.min(leftLowestY, rightLowestY);

  const bomTopY = contentLowestY - 180;
  const bomRowCount = Math.max(4, plates.length + 2);
  const bomBoxH = 180 + bomRowCount * 24;
  const bomBotY = bomTopY - bomBoxH;

  const paddingY = Math.max(110, Math.abs(bomBotY) * 0.08);

  const frameLeft = -sec1ShiftX - 150 - paddingX * 0.3; 
  const frameRight = contentMaxW + paddingX;
  const frameTop = g.W + sec1ShiftY + 130 + paddingY * 0.4;
  const frameBottom = bomBotY - paddingY;

  const bomX = -sec1ShiftX; 
  const bomW = contentMaxW - bomX;

  return { rightColX, platePlacements, bomTopY, bomBoxH, bomBotY, frameLeft, frameRight, frameTop, frameBottom, worldW: frameRight - frameLeft, worldH: frameTop - frameBottom, bomX, bomW };
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

function setWallView(mode) {
  const vd=document.getElementById("chk_showVD"), vn=document.getElementById("chk_showVN");
  if(vd) vd.checked = mode !== "vn";
  if(vn) vn.checked = mode !== "vd";
  updateUIAndRender();
  if(window.CAD_3D?.vdGroup) window.CAD_3D.vdGroup.visible=!!vd?.checked;
  if(window.CAD_3D?.vnGroup) window.CAD_3D.vnGroup.visible=!!vn?.checked;
  const info=document.getElementById("measureInfo");
  if(info) info.textContent = mode === "vd" ? "Đang xem riêng vách dọc (VD)." : mode === "vn" ? "Đang xem riêng vách ngang (VN)." : "Đang xem tổng hợp vách dọc và vách ngang.";
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

  if (typeof window.refreshDrawingQRCodes === "function") window.refreshDrawingQRCodes();
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
    tr.onmouseenter = (e) => { if (window.matchMedia("(hover:hover) and (pointer:fine)").matches) showRowHoverPreview(e, idx); };
    tr.onmousemove = (e) => { if (!window.partPopupPinned) moveRowHoverPreview(e); };
    tr.onmouseleave = () => hideRowHoverPreview();
    tr.addEventListener("click", (e) => { if (window.matchMedia("(hover:none), (pointer:coarse)").matches) { showRowHoverPreview({clientX:window.innerWidth/2,clientY:window.innerHeight/3},idx); window.partPopupPinned=true; document.getElementById("rowHoverTooltip").classList.add("part-popup-touch"); e.stopPropagation(); } });

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
        <button class="px-2.5 py-1 rounded bg-sky-500/20 hover:bg-sky-500/40 text-sky-300 border border-sky-500/40 text-[11px] font-semibold" ${!window.APP_STATE.isAuthorized ? "disabled" : ""}>Nạp & Xoay thử</button>
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
      if(window.APP_STATE.isAuthorized) {
         btn.onclick = () => applyRecommendation(item, r);
      }
      recBtns.appendChild(btn);
    });
    if(window.APP_STATE.isAuthorized) applyRecommendation(item, recs[0]);
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

function exportMasterDXF() {
  if (!checkExportAuth()) return;
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

function exportMasterPNG() {
  if (!checkExportAuth()) return;
  const prevMode = window.APP_STATE.viewMode;
  const prevZoom = window.APP_STATE.zoom;
  const prevPanX = window.APP_STATE.panX;
  const prevPanY = window.APP_STATE.panY;
  const prevExporting = window.APP_STATE.isExporting;

  window.APP_STATE.viewMode = "master";
  if (typeof window.refreshDrawingQRCodes === "function") window.refreshDrawingQRCodes();

  const g = computeCadGeometry();
  const item = window.APP_STATE.items[window.APP_STATE.selectedIndex] || window.APP_STATE.items[0];
  const plates = getPlatesCatalog(g, item);
  const masterLayout = computeMasterWorldLayout(g, item, plates);

  const exportScale = 1.5;
  const exportDpr = 2.0;
  
  const rectW = masterLayout.worldW * exportScale + 120;
  const rectH = masterLayout.worldH * exportScale + 120;

  window.APP_STATE.isExporting = true;
  window.APP_STATE.exportDpr = exportDpr;
  window.APP_STATE.exportW = rectW * exportDpr;
  window.APP_STATE.exportH = rectH * exportDpr;
  
  window.APP_STATE.zoom = 1.0; 
  window.APP_STATE.panX = 0;
  window.APP_STATE.panY = 0;

  renderMainCanvas();

  const cadCanvas = document.getElementById("cadCanvas");
  
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = cadCanvas.width;
  exportCanvas.height = cadCanvas.height;
  const exportCtx = exportCanvas.getContext("2d");
  
  exportCtx.fillStyle = window.APP_STATE.bgTheme === "paper" ? "#f8fafc" : "#050912";
  exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  exportCtx.drawImage(cadCanvas, 0, 0);

  const link = document.createElement("a");
  link.download = `${getMasterFileBaseName()}_Master_HQ.png`;
  link.href = exportCanvas.toDataURL("image/png", 1.0);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.APP_STATE.isExporting = prevExporting;
  window.APP_STATE.viewMode = prevMode;
  window.APP_STATE.zoom = prevZoom;
  window.APP_STATE.panX = prevPanX;
  window.APP_STATE.panY = prevPanY;
  renderMainCanvas();
}

function exportLayoutOnlyPNG() {
  if (!checkExportAuth()) return;
  const prevMode = window.APP_STATE.viewMode;
  const prevZoom = window.APP_STATE.zoom;
  const prevPanX = window.APP_STATE.panX;
  const prevPanY = window.APP_STATE.panY;
  const prevExporting = window.APP_STATE.isExporting;

  window.APP_STATE.viewMode = "layout";
  const g = computeCadGeometry();
  
  const layoutOnlyLeftPad = 250; 
  const totalWorldW = g.L + layoutOnlyLeftPad + 120;
  const totalWorldH = g.W + 280; 
  
  const exportScale = 1.8; 
  const exportDpr = 2.0;

  const rectW = totalWorldW * exportScale + 120;
  const rectH = totalWorldH * exportScale + 120;

  window.APP_STATE.isExporting = true;
  window.APP_STATE.exportDpr = exportDpr;
  window.APP_STATE.exportW = rectW * exportDpr;
  window.APP_STATE.exportH = rectH * exportDpr;
  window.APP_STATE.zoom = 1.0;
  window.APP_STATE.panX = 0;
  window.APP_STATE.panY = 0;

  renderMainCanvas();

  const cadCanvas = document.getElementById("cadCanvas");
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = cadCanvas.width;
  exportCanvas.height = cadCanvas.height;
  const exportCtx = exportCanvas.getContext("2d");

  exportCtx.fillStyle = window.APP_STATE.bgTheme === "paper" ? "#f8fafc" : "#050912";
  exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  exportCtx.drawImage(cadCanvas, 0, 0);

  const link = document.createElement("a");
  link.download = `${getMasterFileBaseName()}_Layout2D_HQ.png`;
  link.href = exportCanvas.toDataURL("image/png", 1.0);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.APP_STATE.isExporting = prevExporting;
  window.APP_STATE.viewMode = prevMode;
  window.APP_STATE.zoom = prevZoom;
  window.APP_STATE.panX = prevPanX;
  window.APP_STATE.panY = prevPanY;
  renderMainCanvas();
}

function exportBomExcel() {
  if (!checkExportAuth()) return;
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

function getDrawingMetadata() {
  const g = computeCadGeometry();
  const item = window.APP_STATE.items[window.APP_STATE.selectedIndex] || {};
  return { schema: "LayoutCAD-Pro-Design-v1", createdAt: new Date().toISOString(), author: "Nguyễn Thị Minh Thư", authorNote: "người con Nam Bộ 🤞", product: { partCode: item.partCode || "", partName: item.partName || "", customer: item.customer || "" }, layout: { L:g.L, W:g.W, nx:g.nx, ny:g.ny, totalCells:g.totalCells, cellX:g.cellX, cellY:g.cellY, tX:g.tX, tY:g.tY, offX:g.offX, offY:g.offY, bX:g.bX, bY:g.bY }, plates: getPlatesCatalog(g,item).map(p=>({code:p.code,type:p.shortType,length:p.length,height:p.height,thickness:p.thick,quantity:p.qty,slotWidth:p.slotW,slotDepth:p.slotDepth,slotCoordinates:p.slots})) };
}

window.downloadDrawingMetadata = function(){
  if (!checkExportAuth()) return;
  const blob=new Blob([JSON.stringify(getDrawingMetadata(),null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=getMasterFileBaseName()+"_metadata.json";a.click();URL.revokeObjectURL(a.href);
};

window.refreshDrawingQRCodes = function() {
  if (!window.QRCode) return;
  const g = computeCadGeometry();
  const item = window.APP_STATE.items[window.APP_STATE.selectedIndex] || {};
  const d = document.getElementById("drawingQr");
  const a = document.getElementById("authorQr");
  if (!d || !a) return;

  const excelQrText = [
    `CODE:${item.partCode || "N/A"}`,
    `SP:${item.pL || 0}x${item.pW || 0}x${item.pH || 0}`,
    `BOX:${item.boxIn?.L || 0}x${item.boxIn?.W || 0}x${item.boxIn?.H || 0}`,
    `PB:${g.L}x${g.W}xH${g.hVD}`,
    `CELL:${g.totalCells}(${g.nx}x${g.ny})`,
    `O:${g.cellX.toFixed(1)}x${g.cellY.toFixed(1)}`,
    `T:${g.tX}`
  ].join("|");

  const authorQrText = toUtf8ByteString(
    "Tac gia: Nguyen Thi Minh Thu - nguoi con Nam Bo | LayoutCAD Pro"
  );

  try {
    if(d){
      d.innerHTML = "";
      new QRCode(d, {
        text: excelQrText,
        width: 76,
        height: 76,
        correctLevel: QRCode.CorrectLevel.L
      });
    }
  } catch (err) {
    console.warn("Drawing QR error:", err);
  }

  try {
    if(a){
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
};
window.applyWallUpdate = function(){updateUIAndRender();window.refreshDrawingQRCodes?.();const b=document.getElementById("applyWallUpdate");if(b){b.classList.remove("update-pending");b.classList.add("update-flash");setTimeout(()=>b.classList.remove("update-flash"),700);}const info=document.getElementById("measureInfo");if(info)info.textContent="Đã cập nhật hình học vách và bảng kê chi tiết.";};

function loadDefaultTesst001() {
  window.APP_STATE.items = JSON.parse(JSON.stringify(window.DEFAULT_EXCEL_ITEMS));
  selectExcelItem(0);
}

window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (typeof window.export3DSTEP === "function") {
      const orig3D = window.export3DSTEP;
      window.export3DSTEP = function() {
        if (!checkExportAuth()) return;
        orig3D();
      };
    }
  }, 1000);

  const inputIds = [
    "inp_L", "inp_W", "inp_offX", "inp_offY", "inp_bX", "inp_bY",
    "inp_tX", "inp_tY", "inp_nx", "inp_ny", "inp_desX", "inp_desY",
    "inp_hVD", "inp_hVN", "inp_hBao", "inp_slotW", "inp_slotDepthVD", "inp_slotDepthVN",
    "sel_cutVD", "sel_cutVN"
  ];
  inputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", () => {
      document.getElementById("canvasContainer")?.classList.add("geometry-changing");
      const btn=document.getElementById("applyWallUpdate"); if(btn) btn.classList.add("update-pending");
      renderExcelTable(); renderOrientationMatrix(); updateUIAndRender(); window.refreshDrawingQRCodes?.();
      clearTimeout(window._cadUpdateFlashTimer); window._cadUpdateFlashTimer=setTimeout(()=>document.getElementById("canvasContainer")?.classList.remove("geometry-changing"),650);
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
        
        // ==========================================
        // 🔒 KIỂM TRA CHỮ KÝ BẢO MẬT THÔNG MINH (QUÉT TOÀN BỘ FILE)
        // ==========================================
        const _0x2b = function(s) { return btoa(unescape(encodeURIComponent(s))); };
        let _0xauth = 0; 
        
        for(let r = 0; r < rows.length; r++) {
           if(!rows[r]) continue;
           for(let c = 0; c < rows[r].length; c++) {
              const val = String(rows[r][c] || "").trim();
              const bval = _0x2b(val);
              if (bval === "Q+G6o20gxqFuIE1U") { // "Cảm ơn MT" -> FULL
                 _0xauth = 2;
                 break;
              } else if (bval === "Q2FtIMahbiBOUA==" || bval === "Q+G6o20gxqFuIE5Q") { // "Cam ơn NP" / "Cảm ơn NP" -> PARTIAL
                 _0xauth = 1;
              }
           }
           if(_0xauth === 2) break;
        }

        // Nếu file mẫu hoặc file không có chữ ký đúng -> Khóa hoàn toàn, không hiện alert
        if (_0xauth === 0) {
          triggerDRMLockdown();
        } else {
          window.APP_STATE.isAuthorized = true;
          window.APP_STATE.canExport = (_0xauth === 2);
          
          const formArea = document.querySelector("main > aside");
          if (formArea) {
            formArea.style.pointerEvents = "auto";
            formArea.style.opacity = "1";
          }
          document.querySelectorAll("button").forEach(btn => {
            btn.disabled = false;
            btn.style.cursor = "pointer";
            btn.title = "";
          });
          if (window.APP_STATE.countdownTimer) {
             clearInterval(window.APP_STATE.countdownTimer);
          }
        }
        // ==========================================

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
  setTimeout(()=>window.refreshDrawingQRCodes?.(),500);
});

function drawTechnicalArrow(ctx, x1, y1, x2, y2, color, text, offset, lineScale, ui) {
  if (!ui) ui = 1;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.0 * lineScale;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 6 * ui) {
    ctx.restore();
    return;
  }
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;

  const off = offset * ui;
  const sx1 = snapPx(x1 + nx * off);
  const sy1 = snapPx(y1 + ny * off);
  const sx2 = snapPx(x2 + nx * off);
  const sy2 = snapPx(y2 + ny * off);

  ctx.beginPath();
  ctx.setLineDash([2, 2]);
  ctx.moveTo(snapPx(x1), snapPx(y1));
  ctx.lineTo(sx1, sy1);
  ctx.moveTo(snapPx(x2), snapPx(y2));
  ctx.lineTo(sx2, sy2);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(sx1, sy1);
  ctx.lineTo(sx2, sy2);
  ctx.stroke();

  const aLen = 6.5 * ui;
  const aWid = 2.6 * ui;
  ctx.beginPath();
  ctx.moveTo(sx1, sy1);
  ctx.lineTo(sx1 + ux * aLen + nx * aWid, sy1 + uy * aLen + ny * aWid);
  ctx.lineTo(sx1 + ux * aLen - nx * aWid, sy1 + uy * aLen - ny * aWid);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(sx2, sy2);
  ctx.lineTo(sx2 - ux * aLen + nx * aWid, sy2 - uy * aLen + ny * aWid);
  ctx.lineTo(sx2 - ux * aLen - nx * aWid, sy2 - uy * aLen - ny * aWid);
  ctx.closePath();
  ctx.fill();

  const mx = (sx1 + sx2) / 2;
  const my = (sy1 + sy2) / 2;
  ctx.font = `700 ${10.5 * ui}px 'JetBrains Mono', monospace`;
  const tw = ctx.measureText(text).width;

  ctx.save();
  ctx.translate(mx, my);
  if (Math.abs(dx) < Math.abs(dy)) {
    ctx.rotate(-Math.PI / 2);
  }
  const bgFill = window.APP_STATE && window.APP_STATE.bgTheme === "paper" ? "rgba(248, 250, 252, 0.95)" : "rgba(4, 7, 14, 0.94)";
  ctx.fillStyle = bgFill;
  ctx.fillRect(-tw / 2 - 5 * ui, -7.5 * ui, tw + 10 * ui, 15 * ui);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 0);
  ctx.restore();
  ctx.restore();
}

function snapPx(val) {
  return Math.round(val) + 0.5;
}

function renderMainCanvas() {
  const is3DMode = (window.APP_STATE.viewMode === "3d");

  // XỬ LÝ CHẾ ĐỘ XEM 3D HOẶC 2D
  if (is3DMode) {
    if (typeof rebuild3DScene === "function") rebuild3DScene();
    
    // Nếu chưa được cấp quyền (sai mã), hiển thị thông báo và đồng hồ chìm trực tiếp trên khung 3D container
    const threeHolder = document.getElementById("threeCanvasHolder");
    if (threeHolder) {
      let overlay3d = document.getElementById("drm3dOverlay");
      if (!window.APP_STATE.isAuthorized) {
        if (!overlay3d) {
          overlay3d = document.createElement("div");
          overlay3d.id = "drm3dOverlay";
          overlay3d.style.cssText = "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(15,23,42,0.82);z-index:99;pointer-events:none;backdrop-filter:blur(4px);";
          threeHolder.style.position = "relative";
          threeHolder.appendChild(overlay3d);
        }
        overlay3d.innerHTML = `
          <div style="font-weight:900;font-size:28px;color:#ef4444;text-align:center;text-shadow:0 2px 10px rgba(0,0,0,0.8);margin-bottom:10px;padding:0 20px;">VUI LÒNG TẢI FILE THÔNG TIN CẦN LAYOUT VÁCH</div>
          <div style="font-weight:900;font-size:64px;color:#facc15;text-shadow:0 2px 15px rgba(0,0,0,0.9);">00:${String(window.APP_STATE.countdownSecs).padStart(2, '0')}</div>
        `;
      } else if (overlay3d) {
        overlay3d.remove();
      }
    }
    return;
  } else {
    // Nếu chuyển về 2D, dọn dẹp overlay 3D nếu có
    const overlay3d = document.getElementById("drm3dOverlay");
    if (overlay3d) overlay3d.remove();
  }

  const canvas = document.getElementById("cadCanvas");
  const container = document.getElementById("canvasContainer");
  if (!canvas || !container) return;

  const dpr = window.APP_STATE.isExporting ? window.APP_STATE.exportDpr : Math.max(window.devicePixelRatio || 1, 2.75);
  
  let rectWidth, rectHeight;
  if (window.APP_STATE.isExporting) {
    rectWidth = window.APP_STATE.exportW / dpr;
    rectHeight = window.APP_STATE.exportH / dpr;
  } else {
    const rect = container.getBoundingClientRect();
    rectWidth = rect.width;
    rectHeight = rect.height;
  }

  canvas.width = Math.floor(rectWidth * dpr);
  canvas.height = Math.floor(rectHeight * dpr);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, rectWidth, rectHeight);

  const g = computeCadGeometry();
  const item = window.APP_STATE.items[window.APP_STATE.selectedIndex] || window.APP_STATE.items[0];
  const plates = getPlatesCatalog(g, item);
  const c = window.APP_STATE.colors;
  const isPaper = window.APP_STATE.bgTheme === "paper";
  const lineScale = window.APP_STATE.lineWeightMode === "hairline" ? 0.82 : window.APP_STATE.lineWeightMode === "bold" ? 1.45 : 1.08;

  const masterLayout = computeMasterWorldLayout(g, item, plates);
  
  const layoutOnlyLeftPad = 250; 
  const totalWorldW = window.APP_STATE.viewMode === "master" ? masterLayout.worldW : (g.L + layoutOnlyLeftPad + 120);
  const totalWorldH = window.APP_STATE.viewMode === "master" ? masterLayout.worldH : (g.W + 280); 

  const baseScale = Math.min((rectWidth - 60) / totalWorldW, (rectHeight - 60) / totalWorldH);
  const scale = Math.max(0.08, baseScale * window.APP_STATE.zoom);
  const ui = scale * 1.8;

  const drawW = totalWorldW * scale;
  const drawH = totalWorldH * scale;
  
  const originX = (rectWidth - drawW) / 2 + window.APP_STATE.panX + (window.APP_STATE.viewMode === "master" ? Math.abs(masterLayout.frameLeft) * scale : layoutOnlyLeftPad * scale);
  const originY = (rectHeight - drawH) / 2 + window.APP_STATE.panY + (window.APP_STATE.viewMode === "master" ? (masterLayout.frameTop - g.W) * scale : 160 * scale); 

  window.cadMeasureTransform = { originX, originY, scale, width: rectWidth, height: rectHeight };
  const toScreenX = (mmX) => originX + mmX * scale;
  const toScreenY = (mmYFromTop) => originY + mmYFromTop * scale;
  if (typeof redrawMeasures === "function") requestAnimationFrame(redrawMeasures);

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
    ctx.strokeRect(fx + 6 * ui, fy + 6 * ui, fw - 12 * ui, fh - 12 * ui);
  }

  ctx.fillStyle = isPaper ? "#0284c7" : c.frame;
  ctx.font = `800 ${12 * ui}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "left";
  ctx.fillText(`I. MẶT BẰNG LAYOUT VÁCH NGĂN 2D (TỔNG: ${g.totalCells} Ô = ${g.nx}×${g.ny})`, toScreenX(0), toScreenY(-75)); 

  if (document.getElementById("chk_showBoxIn")?.checked && item) {
    const diffX = (item.boxIn.L - g.L) / 2;
    const diffY = (item.boxIn.W - g.W) / 2;
    ctx.save();
    ctx.strokeStyle = "rgba(16, 185, 129, 0.55)";
    ctx.lineWidth = 1.1 * lineScale;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(snapPx(toScreenX(-diffX)), snapPx(toScreenY(-diffY)), Math.round(item.boxIn.L * scale), Math.round(item.boxIn.W * scale));
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = isPaper ? "#0369a1" : c.frame;
  ctx.lineWidth = 1.8 * lineScale;
  ctx.strokeRect(snapPx(toScreenX(0)), snapPx(toScreenY(0)), Math.round(g.L * scale), Math.round(g.W * scale));
  ctx.restore();

  if (g.offX > 0 || g.offY > 0) {
    ctx.save();
    ctx.strokeStyle = isPaper ? "#64748b" : "#94a3b8";
    ctx.lineWidth = 0.9 * lineScale;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(snapPx(toScreenX(g.offX)), snapPx(toScreenY(g.offY)), Math.round((g.L - 2 * g.offX) * scale), Math.round((g.W - 2 * g.offY) * scale));
    ctx.restore();
  }

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

      if (sw > 18 * ui && sh > 11 * ui) {
        const cellNum = iy * g.nx + ix + 1;
        ctx.fillStyle = isPaper ? "#334155" : "rgba(226, 232, 240, 0.78)";
        ctx.font = `600 ${Math.min(sw, sh) * 0.28}px 'JetBrains Mono', monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`#${cellNum}`, sx + sw / 2, sy + sh / 2);
      }
    }
  }

  const showWallCodes = document.getElementById("chk_showWallCodes")?.checked;

  ctx.save();
  ctx.fillStyle = c.vd;
  ctx.strokeStyle = isPaper ? "#854d0e" : "#fef08a";
  ctx.lineWidth = 0.85 * lineScale;
  if (document.getElementById("chk_showVD")?.checked !== false) g.vWalls.forEach((wx, idx) => {
    const sx = snapPx(toScreenX(wx));
    const sy = snapPx(toScreenY(g.offY + g.bY));
    const sw = Math.max(1.5, g.tX * scale);
    const sh = Math.round((g.W - 2 * (g.offY + g.bY)) * scale);
    ctx.fillRect(sx, sy, sw, sh);
    ctx.strokeRect(sx, sy, sw, sh);

    if (showWallCodes) {
      ctx.fillStyle = isPaper ? "#a16207" : c.vd;
      ctx.font = `700 ${9 * ui}px 'JetBrains Mono', monospace`;
      ctx.textAlign = "center";
      ctx.fillText(`VD${idx + 1}`, sx + sw / 2, sy - 6 * ui);
      ctx.fillStyle = c.vd;
    }
  });
  ctx.restore();

  ctx.save();
  ctx.fillStyle = c.vn;
  ctx.strokeStyle = isPaper ? "#9d174d" : "#fbcfe8";
  ctx.lineWidth = 0.85 * lineScale;
  if (document.getElementById("chk_showVN")?.checked !== false) g.hWalls.forEach((wy, idx) => {
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
      ctx.moveTo(outerLeftX - 3 * ui, sy + sh / 2);
      ctx.lineTo(sx, sy + sh / 2);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = isPaper ? "#be185d" : c.vn;
      ctx.font = `700 ${9.5 * ui}px 'JetBrains Mono', monospace`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(`VN${idx + 1}`, outerLeftX - 5 * ui, sy + sh / 2);
      ctx.fillStyle = c.vn;
    }
  });
  ctx.restore();

  ctx.fillStyle = c.slot;
  g.vWalls.forEach(wx => {
    g.hWalls.forEach(wy => {
      ctx.fillRect(snapPx(toScreenX(wx) - 1), snapPx(toScreenY(wy) - 1), Math.max(3, g.tX * scale + 2), Math.max(3, g.tY * scale + 2));
    });
  });

  drawTechnicalArrow(ctx, toScreenX(0), toScreenY(0), toScreenX(g.L), toScreenY(0), c.frame, `DÀI PHỦ BÌ L = ${g.L.toFixed(1)} mm`, -14, lineScale, ui);
  
  const leftOutsideOffsetPx = 65; 
  drawTechnicalArrow(ctx, toScreenX(0), toScreenY(0), toScreenX(0), toScreenY(g.W), c.frame, `RỘNG PHỦ BÌ W = ${g.W.toFixed(1)} mm`, leftOutsideOffsetPx, lineScale, ui);

  if (g.nx > 0 && g.cellX > 0) {
    const cx0 = g.offX + g.bX;
    drawTechnicalArrow(ctx, toScreenX(cx0), toScreenY(g.W), toScreenX(cx0 + g.cellX), toScreenY(g.W), c.vd, `Ô X = ${g.cellX.toFixed(1)}`, 35, lineScale, ui);
  }

  if (g.ny > 0 && g.cellY > 0) {
    const cy0 = g.offY + g.bY;
    drawTechnicalArrow(ctx, toScreenX(g.L), toScreenY(cy0), toScreenX(g.L), toScreenY(cy0 + g.cellY), c.vn, `Ô Y = ${g.cellY.toFixed(1)}`, -26, lineScale, ui);
  }

  if (window.APP_STATE.viewMode === "master") {
    ctx.fillStyle = isPaper ? "#0284c7" : c.frame;
    ctx.font = `800 ${12 * ui}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "left";
    ctx.fillText("II. BẢN VẼ TÁCH CHI TIẾT TỪNG TẤM VÁCH & RÃNH ĐAN (MÀU RIÊNG)", toScreenX(masterLayout.rightColX), toScreenY(-75)); 

    masterLayout.platePlacements.forEach(pp => {
      const p = pp.plate;
      const px = snapPx(toScreenX(pp.x));
      const py = snapPx(toScreenY(g.W - pp.topY));
      const pw = Math.round(pp.width * scale);
      const ph = Math.round(pp.height * scale);

      ctx.fillStyle = p.color;
      ctx.font = `700 ${10.5 * ui}px 'JetBrains Mono', monospace`;
      ctx.textAlign = "left";
      ctx.fillText(`■ ${pp.index}. MÃ VÁCH: ${p.code} (${p.title}) — SL: ${p.qty} TẤM`, px, py - (pp.rotateCoords ? 26 * ui : 12 * ui));

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
      });

      const dimOffset = 20; 
      drawTechnicalArrow(ctx, px, py + ph, px + pw, py + ph, p.color, `DÀI ${p.shortType} = ${p.length.toFixed(1)} mm (${p.slots.length} rãnh rộng ${p.slotW.toFixed(2)} × sâu ${p.slotDepth.toFixed(1)}mm)`, dimOffset, lineScale, ui);
      
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.font = `700 ${10 * ui}px 'JetBrains Mono', monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`KT PHÔI: ${p.length.toFixed(1)}×${p.height.toFixed(1)}×${p.thick}mm`, px + pw / 2, py + ph + (42 * ui));
      ctx.restore();
      
      drawTechnicalArrow(ctx, px + pw, py, px + pw, py + ph, p.color, `CAO = ${p.height.toFixed(1)}`, -20, lineScale, ui);
    });

    const bx = snapPx(toScreenX(masterLayout.bomX));
    const by = snapPx(toScreenY(g.W - masterLayout.bomTopY));
    const bw = Math.round(masterLayout.bomW * scale);
    const bh = Math.round(masterLayout.bomBoxH * scale);

    ctx.fillStyle = isPaper ? "rgba(241, 245, 249, 0.98)" : "rgba(10, 17, 32, 0.96)";
    ctx.strokeStyle = c.frame;
    ctx.lineWidth = 1.5 * lineScale;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeRect(bx, by, bw, bh);

    ctx.fillStyle = "rgba(56, 189, 248, 0.14)";
    ctx.fillRect(bx, by, bw, 24 * ui);
    ctx.beginPath();
    ctx.moveTo(bx, snapPx(by + 24 * ui));
    ctx.lineTo(bx + bw, snapPx(by + 24 * ui));
    ctx.stroke();

    const midX = snapPx(bx + bw * 0.48);
    ctx.beginPath();
    ctx.moveTo(midX, by);
    ctx.lineTo(midX, by + bh);
    ctx.stroke();

    ctx.fillStyle = isPaper ? "#0369a1" : "#38bdf8";
    ctx.font = `800 ${10 * ui}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "left";
    ctx.fillText("III. THÔNG TIN SẢN PHẨM & QUY CÁCH ĐÓNG GÓI", bx + 10 * ui, by + 16 * ui);
    ctx.fillText("BẢNG KÊ CHI TIẾT CÁC VÁCH NGĂN (MÃ VÁCH & MÀU RIÊNG)", midX + 10 * ui, by + 16 * ui);

    const ruleCheck = checkTotalMatchesRule(g.totalCells, getRuleConfig());
    ctx.fillStyle = isPaper ? "#0f172a" : "#f1f5f9";
    ctx.font = `600 ${9 * ui}px 'JetBrains Mono', monospace`;
    const infoLines = [
      `• Mã hàng: ${item ? item.partCode : "N/A"} | KH: ${item ? item.customer : "SECVN"}`,
      `• Tên SP : ${item ? item.partName : "N/A"}`,
      `• KT SP  : ${item ? `${item.pL}×${item.pW}×${item.pH}` : "N/A"} mm`,
      `• Box In : ${item ? `${item.boxIn.L}×${item.boxIn.W}×${item.boxIn.H}` : ""} mm`,
      `• Layout : Phủ bì ${g.L}×${g.W}×H${g.hVD} | ${g.totalCells} ô (${g.nx}×${g.ny})`,
      `• Lọt lòng 1 ô: ${g.cellX.toFixed(1)}×${g.cellY.toFixed(1)} mm`
    ];
    infoLines.forEach((ln, idx) => {
      ctx.fillText(ln, bx + 10 * ui, by + (38 + idx * 16) * ui);
    });

    plates.forEach((p, idx) => {
      const ry = by + (40 + idx * 22) * ui;
      ctx.fillStyle = p.color;
      ctx.fillRect(midX + 10 * ui, ry - 7 * ui, 8 * ui, 8 * ui);
      ctx.fillText(`${p.code} | KT:${p.length.toFixed(1)}×${p.height.toFixed(1)} | SL:${p.qty}`, midX + 24 * ui, ry);
    });

    const qrSize = 64 * ui;
    const qrAuthorX = snapPx(bx + bw - qrSize - 16 * ui);
    const qrAuthorY = snapPx(by + bh - qrSize - 16 * ui); 
    
    ctx.save();
    ctx.fillStyle = isPaper ? "rgba(255,255,255,0.95)" : "rgba(10,17,32,0.96)";
    ctx.fillRect(qrAuthorX - 6 * ui, qrAuthorY - 6 * ui, qrSize + 12 * ui, qrSize + 12 * ui);
    ctx.strokeStyle = c.frame;
    ctx.lineWidth = 1;
    ctx.strokeRect(qrAuthorX - 6 * ui, qrAuthorY - 6 * ui, qrSize + 12 * ui, qrSize + 12 * ui);
    ctx.restore();
    
    drawQrCodeOnContext(ctx, "authorQr", qrAuthorX, qrAuthorY, qrSize);
  }
  
  // VẼ LỚP CẢNH BÁO BẢN QUYỀN CHÌM DƯỚI BẢN VẼ TRÊN CANVAS 2D
  if (!window.APP_STATE.isAuthorized) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); 
    ctx.fillStyle = "rgba(15, 23, 42, 0.78)"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 6);
    
    ctx.fillStyle = "rgba(239, 68, 68, 0.85)";
    ctx.font = `900 ${52 * (canvas.width/1500)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("VUI LÒNG TẢI FILE THÔNG TIN CẦN LAYOUT VÁCH", 0, -60 * (canvas.width/1500));
    
    ctx.fillStyle = "rgba(250, 204, 21, 0.90)";
    ctx.font = `900 ${100 * (canvas.width/1500)}px sans-serif`;
    ctx.fillText("00:" + String(window.APP_STATE.countdownSecs).padStart(2, '0'), 0, 50 * (canvas.width/1500));
    ctx.restore();
  }

  document.getElementById("zoomStatus").textContent = `Zoom: ${Math.round(window.APP_STATE.zoom * 100)}% • Super-HiDPI ${dpr.toFixed(2)}x`;
}
