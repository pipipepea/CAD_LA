// ============================================================================
// MODULE: js/cad-renderer.js
// Super-HiDPI 2.75x Vector Renderer & Anti-Overlap Master Sheet Layout Engine
// Đã fix: UI ghim cứng theo bản vẽ (uiScale) và hỗ trợ xuất ảnh (isExporting)
// ============================================================================

function snapPx(val) {
  return Math.round(val) + 0.5;
}

// Thêm tham số ui vào hàm mũi tên
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

function computeMasterWorldLayout(g, item, plates) {
  const rightColX = g.L + 150;
  let curPlateTopDown = 0;
  const platePlacements = [];

  plates.forEach((p, idx) => {
    const minSpacing = p.slots.length > 1
      ? Math.min(...p.slots.slice(1).map((s, i) => Math.abs(s - p.slots[i])))
      : 999;
    const rotateCoords = p.slots.length > 5 || minSpacing < 38;
    const extraLabelSpace = rotateCoords ? 48 : 30;
    const blockHeaderSpace = 28;
    const blockFooterSpace = 64;

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

  const maxPlateW = plates.length > 0 ? Math.max(...plates.map(p => Math.max(p.length, 480 + p.slots.length * 24))) : 650;
  const totalWidth = Math.max(rightColX + maxPlateW + 120, 1600);

  const leftLowestY = -75;
  const rightLowestY = g.W - curPlateTopDown;
  const contentLowestY = Math.min(leftLowestY, rightLowestY);

  const bomTopY = contentLowestY - 135;
  const bomRowCount = Math.max(4, plates.length + 2);
  const bomBoxH = 180 + bomRowCount * 24;
  const bomBotY = bomTopY - bomBoxH;

  const contentMaxW = Math.max(rightColX + maxPlateW, totalWidth);
  const paddingX = Math.max(110, contentMaxW * 0.08);
  const paddingY = Math.max(110, Math.abs(bomBotY) * 0.08);

  const frameLeft = -150 - paddingX * 0.3;
  const frameRight = contentMaxW + paddingX;
  const frameTop = g.W + 130 + paddingY * 0.4;
  const frameBottom = bomBotY - paddingY;

  return { rightColX, platePlacements, totalWidth, bomTopY, bomBoxH, bomBotY, frameLeft, frameRight, frameTop, frameBottom, worldW: frameRight - frameLeft, worldH: frameTop - frameBottom };
}

function renderMainCanvas() {
  if (window.APP_STATE.viewMode === "3d") {
    if (typeof rebuild3DScene === "function") rebuild3DScene();
    return;
  }

  const canvas = document.getElementById("cadCanvas");
  const container = document.getElementById("canvasContainer");
  if (!canvas || !container) return;

  const dpr = Math.max(window.devicePixelRatio || 1, 2.75);
  
  // KIỂM TRA CHẾ ĐỘ EXPORT ĐỂ KHÔNG BỊ CẮT XÉN ẢNH
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
  const layoutOnlyLeftPad = 125;
  const totalWorldW = window.APP_STATE.viewMode === "master" ? masterLayout.worldW : (g.L + layoutOnlyLeftPad + 85);
  const totalWorldH = window.APP_STATE.viewMode === "master" ? masterLayout.worldH : (g.W + 170);

  const baseScale = Math.min((rectWidth - 60) / totalWorldW, (rectHeight - 60) / totalWorldH);
  const scale = Math.max(0.08, baseScale * window.APP_STATE.zoom);
  
  // Tỷ lệ giao diện UI ghim cứng theo CAD Scale
  const ui = scale * 1.8;

  const drawW = totalWorldW * scale;
  const drawH = totalWorldH * scale;
  const originX = (rectWidth - drawW) / 2 + window.APP_STATE.panX + (window.APP_STATE.viewMode === "master" ? Math.abs(masterLayout.frameLeft) * scale : layoutOnlyLeftPad * scale);
  const originY = (rectHeight - drawH) / 2 + window.APP_STATE.panY + (window.APP_STATE.viewMode === "master" ? (masterLayout.frameTop - g.W) * scale : 75 * scale);

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
  // Tọa độ Y -42 là thế giới (mm) nên giữ nguyên toScreenY(-42)
  ctx.fillText(`I. MẶT BẰNG LAYOUT VÁCH NGĂN 2D (TỔNG: ${g.totalCells} Ô = ${g.nx}×${g.ny})`, toScreenX(0), toScreenY(-42));

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
      ctx.moveTo(outerLeftX - 8 * ui, sy + sh / 2);
      ctx.lineTo(sx, sy + sh / 2);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = isPaper ? "#be185d" : c.vn;
      ctx.font = `700 ${9.5 * ui}px 'JetBrains Mono', monospace`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(`VN${idx + 1}`, outerLeftX - 11 * ui, sy + sh / 2);
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

  drawTechnicalArrow(ctx, toScreenX(0), toScreenY(0), toScreenX(g.L), toScreenY(0), c.frame, `DÀI PHỦ BÌ L = ${g.L.toFixed(1)} mm`, -22, lineScale, ui);
  drawTechnicalArrow(ctx, toScreenX(0), toScreenY(0), toScreenX(0), toScreenY(g.W), c.frame, `RỘNG PHỦ BÌ W = ${g.W.toFixed(1)} mm`, 64, lineScale, ui);

  if (g.ny > 0 && g.cellY > 0) {
    const cy0 = g.offY + g.bY;
    drawTechnicalArrow(ctx, toScreenX(g.L), toScreenY(cy0), toScreenX(g.L), toScreenY(cy0 + g.cellY), c.vn, `Ô Y = ${g.cellY.toFixed(1)}`, -26, lineScale, ui);
  }

  if (window.APP_STATE.viewMode === "master") {
    ctx.fillStyle = isPaper ? "#0284c7" : c.frame;
    ctx.font = `800 ${12 * ui}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "left";
    ctx.fillText("II. BẢN VẼ TÁCH CHI TIẾT TỪNG TẤM VÁCH & RÃNH ĐAN (MÀU RIÊNG)", toScreenX(masterLayout.rightColX), toScreenY(-42));

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

      const dimOffset = -32;
      drawTechnicalArrow(ctx, px, py + ph, px + pw, py + ph, p.color, `DÀI ${p.shortType} = ${p.length.toFixed(1)} mm (${p.slots.length} rãnh rộng ${p.slotW.toFixed(2)} × sâu ${p.slotDepth.toFixed(1)}mm)`, dimOffset, lineScale, ui);
      
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.font = `700 ${10 * ui}px 'JetBrains Mono', monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`KT PHÔI: ${p.length.toFixed(1)}×${p.height.toFixed(1)}×${p.thick}mm`, px + pw / 2, py + ph - (dimOffset * ui) + (20 * ui));
      ctx.restore();
      drawTechnicalArrow(ctx, px + pw, py, px + pw, py + ph, p.color, `CAO = ${p.height.toFixed(1)}`, -20, lineScale, ui);
    });

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
      const slotListStr = p.slots.length > 0
        ? (p.slots.length > 5 ? p.slots.slice(0, 5).map(s => s.toFixed(1)).join(", ") + ` ... (${p.slots.length} rãnh)` : p.slots.map(s => s.toFixed(1)).join(", "))
        : "Không cắt rãnh";
      ctx.fillText(`${p.code} | KT:${p.length.toFixed(1)}×${p.height.toFixed(1)} | SL:${p.qty} | [${slotListStr}]`, midX + 24 * ui, ry);
    });

    const qrSize = 64 * ui;
    const qrLayoutX = snapPx(bx + 10 * ui);
    const qrLayoutY = snapPx(by - qrSize - 12 * ui);
    ctx.save();
    ctx.fillStyle = isPaper ? "rgba(255,255,255,0.95)" : "rgba(10,17,32,0.96)";
    ctx.fillRect(qrLayoutX - 6 * ui, qrLayoutY - 6 * ui, qrSize + 175 * ui, qrSize + 12 * ui);
    ctx.strokeStyle = c.frame;
    ctx.lineWidth = 1;
    ctx.strokeRect(qrLayoutX - 6 * ui, qrLayoutY - 6 * ui, qrSize + 175 * ui, qrSize + 12 * ui);
    ctx.restore();
    drawQrCodeOnContext(ctx, "drawingQr", qrLayoutX, qrLayoutY, qrSize);

    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = isPaper ? "#0284c7" : "#38bdf8";
    ctx.font = `800 ${9.5 * ui}px 'JetBrains Mono', monospace`;
    ctx.fillText("MÃ QR THÔNG TIN", qrLayoutX + qrSize + 10 * ui, qrLayoutY + qrSize / 2 - 8 * ui);
    ctx.fillStyle = isPaper ? "#475569" : "#cbd5e1";
    ctx.font = `600 ${9 * ui}px 'JetBrains Mono', monospace`;
    ctx.fillText("Quét để nhập Excel", qrLayoutX + qrSize + 10 * ui, qrLayoutY + qrSize / 2 + 8 * ui);
    ctx.restore();

    const qrAuthorX = snapPx(bx + bw - qrSize - 16 * ui);
    const qrAuthorY = snapPx(by + bh - qrSize - 14 * ui);
    ctx.save();
    ctx.fillStyle = isPaper ? "rgba(255,255,255,0.95)" : "rgba(10,17,32,0.96)";
    ctx.fillRect(qrAuthorX - 6 * ui, qrAuthorY - 6 * ui, qrSize + 12 * ui, qrSize + 26 * ui);
    ctx.strokeStyle = c.frame;
    ctx.lineWidth = 1;
    ctx.strokeRect(qrAuthorX - 6 * ui, qrAuthorY - 6 * ui, qrSize + 12 * ui, qrSize + 26 * ui);
    ctx.restore();
    drawQrCodeOnContext(ctx, "authorQr", qrAuthorX, qrAuthorY, qrSize);

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = isPaper ? "#b45309" : "#facc15";
    ctx.font = `800 ${9.5 * ui}px 'JetBrains Mono', monospace`;
    ctx.fillText("TÁC GIẢ", qrAuthorX + qrSize / 2, qrAuthorY + qrSize + 5 * ui);
    ctx.restore();
  }

  document.getElementById("zoomStatus").textContent = `Zoom: ${Math.round(window.APP_STATE.zoom * 100)}% • Super-HiDPI ${dpr.toFixed(2)}x`;
}