// ============================================================================
// MODULE: js/geometry-engine.js
// Thuần túy tính toán hình học CAD, cấu hình vách, rãnh đan và quy tắc đóng gói
// Tách biệt hoàn toàn khỏi logic DOM & giao diện người dùng
// ============================================================================

(function(global) {
  'use strict';

  function getRuleConfig() {
    const modeEl = document.getElementById("packingRuleMode");
    const mode = modeEl ? modeEl.value : "mult10";
    const multVal = parseInt(document.getElementById("customMultValue")?.value, 10) || 10;
    const targetVal = parseInt(document.getElementById("exactTargetValue")?.value, 10) || 20;
    return { mode, multVal, targetVal };
  }

  function checkTotalMatchesRule(total, ruleConfig) {
    const cfg = ruleConfig || getRuleConfig();
    const { mode, multVal, targetVal } = cfg;
    if (mode === "free") return { ok: true, text: `TỰ DO (${total} Ô)` };
    if (mode === "mult10") return { ok: total % 10 === 0, text: total % 10 === 0 ? "BỘI CỦA 10 OK" : `LẺ (${total} Ô - KHÔNG CHIA HẾT 10)` };
    if (mode === "mult5") return { ok: total % 5 === 0, text: total % 5 === 0 ? "BỘI CỦA 5 OK" : `LẺ (${total} Ô - KHÔNG CHIA HẾT 5)` };
    if (mode === "mult2") return { ok: total % 2 === 0, text: total % 2 === 0 ? "SỐ CHẴN OK" : `SỐ LẺ (${total} Ô)` };
    if (mode === "custom_mult") return { ok: total % multVal === 0, text: total % multVal === 0 ? `BỘI CỦA ${multVal} OK` : `KHÔNG CHIA HẾT CHO ${multVal}` };
    if (mode === "exact_target") return { ok: total === targetVal, text: total === targetVal ? `ĐÚNG ${targetVal} Ô OK` : `HIỆN TẠI ${total}/${targetVal} Ô` };
    return { ok: true, text: `${total} Ô` };
  }

  function computeCadGeometry(overrideParams) {
    const p = overrideParams || {};
    const L = Math.max(20, (p.L !== undefined ? p.L : parseFloat(document.getElementById("inp_L")?.value)) || 550);
    const W = Math.max(20, (p.W !== undefined ? p.W : parseFloat(document.getElementById("inp_W")?.value)) || 360);
    const offX = Math.max(0, (p.offX !== undefined ? p.offX : parseFloat(document.getElementById("inp_offX")?.value)) || 0);
    const offY = Math.max(0, (p.offY !== undefined ? p.offY : parseFloat(document.getElementById("inp_offY")?.value)) || 0);
    const bX = Math.max(0, (p.bX !== undefined ? p.bX : parseFloat(document.getElementById("inp_bX")?.value)) || 0);
    const bY = Math.max(0, (p.bY !== undefined ? p.bY : parseFloat(document.getElementById("inp_bY")?.value)) || 0);
    const tX = Math.max(0.5, (p.tX !== undefined ? p.tX : parseFloat(document.getElementById("inp_tX")?.value)) || 4);
    const tY = Math.max(0.5, (p.tY !== undefined ? p.tY : parseFloat(document.getElementById("inp_tY")?.value)) || 4);

    const divMode = p.divMode || document.getElementById("sel_divMode")?.value || "cells";
    let nx = Math.max(1, (p.nx !== undefined ? p.nx : parseInt(document.getElementById("inp_nx")?.value, 10)) || 1);
    let ny = Math.max(1, (p.ny !== undefined ? p.ny : parseInt(document.getElementById("inp_ny")?.value, 10)) || 1);

    const innerSpanX = Math.max(1, L - 2 * offX - 2 * bX);
    const innerSpanY = Math.max(1, W - 2 * offY - 2 * bY);

    if (divMode === "size") {
      const desX = Math.max(5, (p.desX !== undefined ? p.desX : parseFloat(document.getElementById("inp_desX")?.value)) || 50);
      const desY = Math.max(5, (p.desY !== undefined ? p.desY : parseFloat(document.getElementById("inp_desY")?.value)) || 50);
      nx = Math.max(1, Math.round((innerSpanX + tX) / (desX + tX)));
      ny = Math.max(1, Math.round((innerSpanY + tY) / (desY + tY)));
    }

    const vWallsCount = Math.max(0, nx - 1);
    const hWallsCount = Math.max(0, ny - 1);
    const cellX = (innerSpanX - vWallsCount * tX) / nx;
    const cellY = (innerSpanY - hWallsCount * tY) / ny;

    const hVD = Math.max(10, (p.hVD !== undefined ? p.hVD : parseFloat(document.getElementById("inp_hVD")?.value)) || 189);
    const hVN = Math.max(10, (p.hVN !== undefined ? p.hVN : parseFloat(document.getElementById("inp_hVN")?.value)) || 189);
    const hBao = Math.max(10, (p.hBao !== undefined ? p.hBao : parseFloat(document.getElementById("inp_hBao")?.value)) || 189);
    const slotW = Math.max(0.5, (p.slotW !== undefined ? p.slotW : parseFloat(document.getElementById("inp_slotW")?.value)) || (tX + 0.25));
    const slotDepthVD = Math.max(1, (p.slotDepthVD !== undefined ? p.slotDepthVD : parseFloat(document.getElementById("inp_slotDepthVD")?.value)) || (hVD / 2));
    const slotDepthVN = Math.max(1, (p.slotDepthVN !== undefined ? p.slotDepthVN : parseFloat(document.getElementById("inp_slotDepthVN")?.value)) || (hVN / 2));
    const cutVD = p.cutVD || document.getElementById("sel_cutVD")?.value || "top";
    const cutVN = p.cutVN || document.getElementById("sel_cutVN")?.value || "bottom";

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

  function getPlatesCatalog(g, item, colorsOverride) {
    const codePrefix = item ? item.partCode : "PART";
    const c = colorsOverride || (global.APP_STATE && global.APP_STATE.colors) || {
      vd: "#facc15", vn: "#f472b6", bd: "#4ade80", bn: "#fb923c", slot: "#f87171", frame: "#38bdf8"
    };
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

    return {
      rightColX,
      platePlacements,
      bomTopY,
      bomBoxH,
      bomBotY,
      frameLeft,
      frameRight,
      frameTop,
      frameBottom,
      worldW: frameRight - frameLeft,
      worldH: frameTop - frameBottom,
      bomX,
      bomW,
      totalWidth: contentMaxW
    };
  }

  // Export functions to global
  global.CAD_GEOMETRY = {
    getRuleConfig,
    checkTotalMatchesRule,
    computeCadGeometry,
    getPlatesCatalog,
    computeMasterWorldLayout
  };

  global.getRuleConfig = getRuleConfig;
  global.checkTotalMatchesRule = checkTotalMatchesRule;
  global.computeCadGeometry = computeCadGeometry;
  global.getPlatesCatalog = getPlatesCatalog;
  global.computeMasterWorldLayout = computeMasterWorldLayout;

})(window);
