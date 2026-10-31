// ============================================================================
// MODULE: js/dxf-exporter.js
// Xuất bản vẽ AutoCAD (.DXF) chuẩn R12/LT2 với thuật toán chống chồng lấn 100%,
// đẩy kích thước RỘNG PHỦ BÌ W & mã VN ra ngoài lề trái
// ============================================================================

function toSafeCadAscii(str) {
  if (!str) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/×/g, "x")
    .replace(/✓/g, "OK")
    .replace(/[^\x20-\x7E]/g, "");
}

function dxfLineEntity(x1, y1, x2, y2, layer, aciColor) {
  const col = aciColor ? `62\n${aciColor}\n` : "";
  return `0\nLINE\n8\n${layer}\n${col}10\n${x1.toFixed(3)}\n20\n${y1.toFixed(3)}\n30\n0.0\n11\n${x2.toFixed(3)}\n21\n${y2.toFixed(3)}\n31\n0.0\n`;
}

function dxfRectEntity(x, y, w, h, layer, aciColor) {
  const x1 = x.toFixed(3), y1 = y.toFixed(3);
  const x2 = (x + w).toFixed(3), y2 = (y + h).toFixed(3);
  const col = aciColor ? `62\n${aciColor}\n` : "";
  return [
    `0\nLINE\n8\n${layer}\n${col}10\n${x1}\n20\n${y1}\n30\n0.0\n11\n${x2}\n21\n${y1}\n31\n0.0`,
    `0\nLINE\n8\n${layer}\n${col}10\n${x2}\n20\n${y1}\n30\n0.0\n11\n${x2}\n21\n${y2}\n31\n0.0`,
    `0\nLINE\n8\n${layer}\n${col}10\n${x2}\n20\n${y2}\n30\n0.0\n11\n${x1}\n21\n${y2}\n31\n0.0`,
    `0\nLINE\n8\n${layer}\n${col}10\n${x1}\n20\n${y2}\n30\n0.0\n11\n${x1}\n21\n${y1}\n31\n0.0`
  ].join("\n") + "\n";
}

function dxfTextEntity(x, y, size, text, layer, aciColor, rotationDeg) {
  const safe = toSafeCadAscii(text);
  const col = aciColor ? `62\n${aciColor}\n` : "";
  const rot = rotationDeg ? `50\n${rotationDeg.toFixed(1)}\n` : "";
  return `0\nTEXT\n8\n${layer}\n${col}10\n${x.toFixed(3)}\n20\n${y.toFixed(3)}\n30\n0.0\n40\n${size.toFixed(2)}\n${rot}1\n${safe}\n`;
}

function buildMasterDxfContent(g, item, plates, ruleCheck) {
  if (!ruleCheck && typeof checkTotalMatchesRule === "function" && typeof getRuleConfig === "function") {
    ruleCheck = checkTotalMatchesRule(g.totalCells, getRuleConfig());
  }
  const ruleText = ruleCheck?.text || "CHUAN";
  const layout = computeMasterWorldLayout(g, item, plates);
  let dxf = "0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n";

  dxf += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n10\n";
  const layers = [
    { name: "ISO_FRAME", aci: 8 },
    { name: "VIEN_PHU_BI", aci: 4 },
    { name: "DUONG_OFFSET", aci: 8 },
    { name: "VACH_DOC_VD", aci: 2 },
    { name: "VACH_NGANG_VN", aci: 6 },
    { name: "VACH_BIEN_BD", aci: 3 },
    { name: "VACH_BIEN_BN", aci: 30 },
    { name: "RANH_DAN_SLOT", aci: 1 },
    { name: "KICH_THUOC_DIM", aci: 4 },
    { name: "THONG_TIN_BOM", aci: 7 }
  ];
  layers.forEach(l => {
    dxf += `0\nLAYER\n2\n${l.name}\n70\n0\n62\n${l.aci}\n6\nCONTINUOUS\n`;
  });
  dxf += "0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n";

  // Outer ISO Master Frame
  dxf += dxfRectEntity(layout.frameLeft, layout.frameBottom, layout.worldW, layout.worldH, "ISO_FRAME", 8);
  dxf += dxfRectEntity(layout.frameLeft + 8, layout.frameBottom + 8, layout.worldW - 16, layout.worldH - 16, "ISO_FRAME", 4);

  // I. MAT BANG LAYOUT VACH NGAN 2D
  dxf += dxfTextEntity(0, g.W + 36, 13, `I. MAT BANG LAYOUT VACH NGAN 2D - MA: ${item.partCode} (${g.totalCells} O = ${g.nx}x${g.ny})`, "VIEN_PHU_BI", 4, 0);
  dxf += dxfTextEntity(0, g.W + 18, 8.5, `DAI PHU BI L = ${g.L.toFixed(1)} mm | RONG PHU BI W = ${g.W.toFixed(1)} mm | LOT LONG 1 O: ${g.cellX.toFixed(2)} x ${g.cellY.toFixed(2)} mm`, "THONG_TIN_BOM", 7, 0);

  dxf += dxfRectEntity(0, 0, g.L, g.W, "VIEN_PHU_BI", 4);
  if (g.offX > 0 || g.offY > 0) {
    dxf += dxfRectEntity(g.offX, g.offY, g.L - 2 * g.offX, g.W - 2 * g.offY, "DUONG_OFFSET", 8);
  }

  // Left-side Outside Dimension Line for RONG PHU BI W (at X = -58mm outside the outer boundary)
  const dimWx = -58;
  dxf += dxfLineEntity(0, 0, dimWx - 4, 0, "KICH_THUOC_DIM", 4);
  dxf += dxfLineEntity(0, g.W, dimWx - 4, g.W, "KICH_THUOC_DIM", 4);
  dxf += dxfLineEntity(dimWx, 0, dimWx, g.W, "KICH_THUOC_DIM", 4);
  dxf += dxfTextEntity(dimWx - 6, g.W * 0.32, 8.0, `RONG PHU BI W = ${g.W.toFixed(1)} mm`, "KICH_THUOC_DIM", 4, 90);

  // Border walls if enabled
  if (g.bX > 0) {
    dxf += dxfRectEntity(g.offX, g.offY, g.bX, g.W - 2 * g.offY, "VACH_BIEN_BD", 3);
    dxf += dxfRectEntity(g.L - g.offX - g.bX, g.offY, g.bX, g.W - 2 * g.offY, "VACH_BIEN_BD", 3);
  }
  if (g.bY > 0) {
    dxf += dxfRectEntity(g.offX, g.offY, g.L - 2 * g.offX, g.bY, "VACH_BIEN_BN", 30);
    dxf += dxfRectEntity(g.offX, g.W - g.offY - g.bY, g.L - 2 * g.offX, g.bY, "VACH_BIEN_BN", 30);
  }

  // Vertical walls (VD)
  g.vWalls.forEach((wx, idx) => {
    dxf += dxfRectEntity(wx, g.offY + g.bY, g.tX, g.W - 2 * (g.offY + g.bY), "VACH_DOC_VD", 2);
    dxf += dxfTextEntity(wx - 4, g.W + 3, 6.2, `VD${idx + 1}`, "VACH_DOC_VD", 2, 0);
  });

  // Horizontal walls (VN) - Labels placed cleanly outside the left border at X = -34mm
  g.hWalls.forEach((wy, idx) => {
    const cadY = g.W - wy - g.tY;
    dxf += dxfRectEntity(g.offX + g.bX, cadY, g.L - 2 * (g.offX + g.bX), g.tY, "VACH_NGANG_VN", 6);
    dxf += dxfTextEntity(-34, cadY + 1, 6.5, `VN${idx + 1}`, "VACH_NGANG_VN", 6, 0);
  });

  // II. BAN VE TACH CHI TIET TUNG TAM VACH
  dxf += dxfTextEntity(layout.rightColX, g.W + 36, 13, "II. BAN VE TACH CHI TIET TUNG TAM VACH (MA VACH & MAU RIENG)", "VIEN_PHU_BI", 4, 0);

  layout.platePlacements.forEach(pp => {
    const p = pp.plate;
    const layerName = p.shortType === "VD" ? "VACH_DOC_VD" : p.shortType === "VN" ? "VACH_NGANG_VN" : p.shortType === "BD" ? "VACH_BIEN_BD" : "VACH_BIEN_BN";

    dxf += dxfTextEntity(
      pp.x,
      pp.topY + 10,
      8.5,
      `${pp.index}. MA VACH: ${p.code} (${p.title}) - SL: ${p.qty} TAM`,
      layerName,
      p.aciColor,
      0
    );

    dxf += dxfRectEntity(pp.x, pp.botY, pp.width, pp.height, layerName, p.aciColor);

    p.slots.forEach(sc => {
      const sx = pp.x + sc - p.slotW / 2;
      const sy = p.cutFrom === "top" ? (pp.topY - p.slotDepth) : pp.botY;
      dxf += dxfRectEntity(sx, sy, p.slotW, p.slotDepth, "RANH_DAN_SLOT", 1);

      if (pp.rotateCoords) {
        const labelY = p.cutFrom === "top" ? (pp.topY + 3.5) : (pp.botY - 26);
        dxf += dxfTextEntity(pp.x + sc + 2, labelY, 5.2, sc.toFixed(1), "THONG_TIN_BOM", 2, 90);
      } else {
        const labelY = p.cutFrom === "top" ? (pp.topY + 3) : (pp.botY - 11);
        dxf += dxfTextEntity(pp.x + sc - 7, labelY, 5.8, sc.toFixed(1), "THONG_TIN_BOM", 2, 0);
      }
    });

    const bottomNoteY = pp.botY - (pp.rotateCoords ? 38 : 22);
    dxf += dxfTextEntity(
      pp.x,
      bottomNoteY,
      7.2,
      `DAI = ${p.length.toFixed(1)}mm | CAO = ${p.height.toFixed(1)}mm | KT PHOI: ${p.length.toFixed(1)}x${p.height.toFixed(1)}x${p.thick}mm | ${p.slots.length} RANH (${p.slotW.toFixed(2)} x ${p.slotDepth.toFixed(1)}mm)`,
      layerName,
      p.aciColor,
      0
    );
  });

  // III. KHUNG TEN ISO & BANG KE CHI TIET BOM
  dxf += dxfRectEntity(0, layout.bomBotY, layout.totalWidth, layout.bomBoxH, "VIEN_PHU_BI", 4);
  dxf += dxfRectEntity(0, layout.bomTopY - 26, layout.totalWidth, 26, "VIEN_PHU_BI", 4);

  dxf += dxfTextEntity(14, layout.bomTopY - 18, 10.5, "III. THONG TIN SAN PHAM & BANG KE VACH NGAN CAD (ISO STANDARD)", "VIEN_PHU_BI", 4, 0);
  dxf += dxfTextEntity(14, layout.bomTopY - 44, 8.2, `MA HANG: ${item.partCode}   |   TEN SP: ${item.partName}   |   KHACH HANG: ${item.customer}`, "THONG_TIN_BOM", 7, 0);
  dxf += dxfTextEntity(14, layout.bomTopY - 62, 8.2, `KT SAN PHAM (DxRxC): ${item.pL} x ${item.pW} x ${item.pH} mm   |   KT BOX IN: ${item.boxIn.L} x ${item.boxIn.W} x ${item.boxIn.H} mm`, "THONG_TIN_BOM", 7, 0);
  dxf += dxfTextEntity(14, layout.bomTopY - 80, 8.2, `QUY CACH CHIA O: ${g.totalCells} O (${g.nx}x${g.ny}) [${ruleText}]   |   LOT LONG 1 O: ${g.cellX.toFixed(2)} x ${g.cellY.toFixed(2)} mm`, "VACH_BIEN_BD", 3, 0);

  let rowY = layout.bomTopY - 106;
  plates.forEach(p => {
    const slotStr = p.slots.length > 0 ? p.slots.map(s => s.toFixed(1)).join(", ") : "Khong cat ranh";
    dxf += dxfTextEntity(
      14,
      rowY,
      7.8,
      `+ MA VACH: ${p.code} (${p.shortType}) | SL: ${p.qty} TAM | KT: ${p.length.toFixed(1)}x${p.height.toFixed(1)}x${p.thick}mm | ${p.slots.length} RANH (${p.slotW.toFixed(2)}x${p.slotDepth.toFixed(1)}mm): [${slotStr}]`,
      "THONG_TIN_BOM",
      p.aciColor,
      0
    );
    rowY -= 20;
  });

  dxf += "0\nENDSEC\n0\nEOF\n";
  return dxf;
}

function exportMasterDXF() {
  if (typeof checkExportAuth === "function" && !checkExportAuth()) return;

  const items = (window.APP_STATE && window.APP_STATE.items) || [];
  if (items.length === 0) {
    alert("Vui lòng tải lên file Excel dữ liệu hoặc chọn linh kiện trước khi xuất file DXF!");
    return;
  }

  const g = typeof computeCadGeometry === "function" ? computeCadGeometry() : null;
  if (!g) return;
  const selectedIndex = (window.APP_STATE && window.APP_STATE.selectedIndex) || 0;
  const item = items[selectedIndex] || items[0] || {
    partCode: "SANPHAM", partName: "PARTITION", pL: 0, pW: 0, pH: 0, customer: "SECVN",
    boxIn: { L: g.L, W: g.W, H: g.hVD }
  };
  const plates = getPlatesCatalog(g, item);
  const ruleCheck = checkTotalMatchesRule(g.totalCells, getRuleConfig());
  const dxfContent = buildMasterDxfContent(g, item, plates, ruleCheck);

  const baseName = typeof getMasterFileBaseName === "function" ? getMasterFileBaseName() : `MASTER_CAD_${item.partCode}_${g.nx}x${g.ny}`;
  const blob = new Blob([dxfContent], { type: "application/dxf;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${baseName}.dxf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

window.buildMasterDxfContent = buildMasterDxfContent;
window.exportMasterDXF = exportMasterDXF;

