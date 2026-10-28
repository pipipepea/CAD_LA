// ============================================================================
// MODULE: js/cad-renderer.js
// Super-HiDPI 2.75x Vector Renderer & Anti-Overlap Master Sheet Layout Engine
// (Đã đẩy đường kích thước RỘNG PHỦ BÌ W và nhãn VN ra ngoài vùng lề trái)
// ============================================================================

function snapPx(val) {
  return Math.round(val) + 0.5;
}

function drawTechnicalArrow(ctx, x1, y1, x2, y2, color, text, offset, lineScale) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.0 * lineScale;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 6) {
    ctx.restore();
    return;
  }
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;

  const sx1 = snapPx(x1 + nx * offset);
  const sy1 = snapPx(y1 + ny * offset);
  const sx2 = snapPx(x2 + nx * offset);
  const sy2 = snapPx(y2 + ny * offset);

  // Extension lines
  ctx.beginPath();
  ctx.setLineDash([2, 2]);
  ctx.moveTo(snapPx(x1), snapPx(y1));
  ctx.lineTo(sx1, sy1);
  ctx.moveTo(snapPx(x2), snapPx(y2));
  ctx.lineTo(sx2, sy2);
  ctx.stroke();

  // Main dimension line
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(sx1, sy1);
  ctx.lineTo(sx2, sy2);
  ctx.stroke();

  // Arrowheads
  const aLen = 6.5;
  const aWid = 2.6;
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

  // Text label centered on dimension line
  const mx = (sx1 + sx2) / 2;
  const my = (sy1 + sy2) / 2;
  ctx.font = "700 10.5px 'JetBrains Mono', monospace";
  const tw = ctx.measureText(text).width;

  ctx.save();
  ctx.translate(mx, my);
  if (Math.abs(dx) < Math.abs(dy)) {
    ctx.rotate(-Math.PI / 2);
  }
  const bgFill = window.APP_STATE && window.APP_STATE.bgTheme === "paper" ? "rgba(248, 250, 252, 0.95)" : "rgba(4, 7, 14, 0.94)";
  ctx.fillStyle = bgFill;
  ctx.fillRect(-tw / 2 - 5, -7.5, tw + 10, 15);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 0);
  ctx.restore();
  ctx.restore();
}

// Compute Non-Overlapping Master World Layout (in millimeters)
function computeMasterWorldLayout(g, item, plates) {
  // Column 2: Detached Plates stacked vertically with generous spacing
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
    const blockFooterSpace = 44;

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

  const maxPlateW = plates.length > 0 ? Math.max(...plates.map(p => p.length)) : 450;
  const totalWidth = Math.max(rightColX + maxPlateW + 60, 1280);

  const leftLowestY = -75;
  const rightLowestY = g.W - curPlateTopDown;
  const contentLowestY = Math.min(leftLowestY, rightLowestY);

  // Place Title Block / BOM Table safely 95mm below the lowest element
  const bomTopY = contentLowestY - 95;
  const bomRowCount = Math.max(3, plates.length + 1);
  const bomBoxH = 145 + bomRowCount * 22;
  const bomBotY = bomTopY - bomBoxH;

  // Expanded Left Margin (-115mm) so RỘNG PHỦ BÌ W & VN labels sit cleanly outside the left border
  const frameLeft = -115;
  const frameRight = totalWidth + 45;
  const frameTop = g.W + 90;
  const frameBottom = bomBotY - 40;

  return {
    rightColX,
    platePlacements,
    totalWidth,
    bomTopY,
    bomBoxH,
    bomBotY,
    frameLeft,
    frameRight,
    frameTop,
    frameBottom,
    worldW: frameRight - frameLeft,
    worldH: frameTop - frameBottom
  };
}
