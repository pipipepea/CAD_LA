// ============================================================================
// MODULE: js/excel-parser.js
// Bóc tách dữ liệu từ file Excel (.xlsx, .xls, .csv), Tự động xoay 6 tư thế 3D
// & Kiểm tra điều kiện thỏa mãn của từng tư thế đặt sản phẩm
// ============================================================================

window.DEFAULT_EXCEL_ITEMS = [
  {
    id: 1,
    partCode: "D03SSE001",
    partName: "COVER TANK SIDE PD2",
    pL: 196,
    pW: 179,
    pH: 15,
    customer: "SECVN",
    type: "Partition",
    boxRaw: "Out : 595x395x235\nIn : 555x365x230",
    boxOut: { L: 595, W: 395, H: 235 },
    boxIn: { L: 555, W: 365, H: 230 },
    category: "Vách",
    note: "MOQ 1 tháng 300pcs. Số lượng trong 1 BOX là bội của 10",
    multipleOf: 10
  },
  {
    id: 2,
    partCode: "D03SSF001",
    partName: "COVER MAIN WATER DOOR PD2",
    pL: 176,
    pW: 68,
    pH: 23,
    customer: "SECVN",
    type: "Partition",
    boxRaw: "Out : 595x395x235\nIn : 555x365x231",
    boxOut: { L: 595, W: 395, H: 235 },
    boxIn: { L: 555, W: 365, H: 231 },
    category: "Vách",
    note: "MOQ 1 tháng 300pcs. Số lượng trong 1 BOX là bội của 10",
    multipleOf: 10
  },
  {
    id: 3,
    partCode: "D03SSG001",
    partName: "COVER ENGINE SIDE PD2",
    pL: 222,
    pW: 145,
    pH: 15,
    customer: "SECVN",
    type: "Partition",
    boxRaw: "Out : 595x395x235\nIn : 555x365x232",
    boxOut: { L: 595, W: 395, H: 235 },
    boxIn: { L: 555, W: 365, H: 232 },
    category: "Vách",
    note: "MOQ 1 tháng 300pcs. Số lượng trong 1 BOX là bội của 10",
    multipleOf: 10
  }
];

function parseBoxDimensions(text) {
  const res = {
    out: { L: 595, W: 395, H: 235 },
    in: { L: 555, W: 365, H: 230 }
  };
  if (!text) return res;
  const s = String(text);
  const outMatch = s.match(/Out\s*[:=-]?\s*(\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\.\d+)?)/i);
  const inMatch = s.match(/In\s*[:=-]?\s*(\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\.\d+)?)/i);
  if (outMatch) {
    res.out = { L: parseFloat(outMatch[1]), W: parseFloat(outMatch[2]), H: parseFloat(outMatch[3]) };
  }
  if (inMatch) {
    res.in = { L: parseFloat(inMatch[1]), W: parseFloat(inMatch[2]), H: parseFloat(inMatch[3]) };
  } else {
    const any3 = s.match(/(\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\.\d+)?)\s*[xX*×]\s*(\d+(?:\.\d+)?)/);
    if (any3 && !outMatch) {
      res.in = { L: parseFloat(any3[1]), W: parseFloat(any3[2]), H: parseFloat(any3[3]) };
    }
  }
  return res;
}

function parseExcelRowsToItems(rows) {
  const parsed = [];
  let idCounter = 1;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row)) continue;
    const nonEmpty = row.filter(c => c !== null && c !== undefined && String(c).trim() !== "");
    if (nonEmpty.length < 3) continue;

    const joined = row.map(c => String(c || "")).join(" ");
    if (/mã\s*hàng|part\s*code|kích\s*thước\s*sp/i.test(joined) && !/\d{2,}\s*[xX*×]\s*\d{2,}/.test(joined)) {
      continue;
    }

    let numTriplet = null;
    for (let c = 0; c < row.length - 2; c++) {
      const n1 = parseFloat(row[c]);
      const n2 = parseFloat(row[c + 1]);
      const n3 = parseFloat(row[c + 2]);
      if (!isNaN(n1) && !isNaN(n2) && !isNaN(n3) && n1 > 1 && n2 > 1 && n3 > 1 && n1 < 3000 && n2 < 3000 && n3 < 3000) {
        numTriplet = { idx: c, pL: n1, pW: n2, pH: n3 };
        break;
      }
    }
    if (!numTriplet) continue;

    let partCode = "";
    let partName = "";
    for (let c = 0; c < numTriplet.idx; c++) {
      const val = String(row[c] || "").trim();
      if (!val) continue;
      if (!partCode && /^[A-Z0-9_-]{4,20}$/i.test(val)) {
        partCode = val;
      } else if (!partName) {
        partName = val.startsWith("=") ? `PART ${partCode || idCounter}` : val;
      }
    }
    if (!partCode) partCode = `ITEM-${String(idCounter).padStart(3, "0")}`;
    if (!partName || partName.startsWith("=")) partName = `LINH KIỆN ${partCode}`;

    let boxCell = "";
    let customer = "SECVN";
    let type = "Partition";
    let category = "Vách";
    let note = "";

    for (let c = numTriplet.idx + 3; c < row.length; c++) {
      const val = String(row[c] || "").trim();
      if (!val) continue;
      if (/(\d+)\s*[xX*×]\s*(\d+)\s*[xX*×]\s*(\d+)/.test(val)) {
        boxCell = val;
      } else if (/bội|moq|pcs|box|lượng/i.test(val)) {
        note = val;
      } else if (/partition|vách|tray|danpla/i.test(val)) {
        if (val.toLowerCase().includes("partition")) type = val;
        else category = val;
      } else if (val.length <= 12 && customer === "SECVN") {
        customer = val;
      }
    }

    const boxDims = parseBoxDimensions(boxCell);
    let multipleOf = 10;
    const multMatch = note.match(/bội\s*(?:số)?\s*(?:của)?\s*(\d+)/i);
    if (multMatch) multipleOf = parseInt(multMatch[1], 10) || 10;

    parsed.push({
      id: idCounter++,
      partCode,
      partName,
      pL: numTriplet.pL,
      pW: numTriplet.pW,
      pH: numTriplet.pH,
      customer,
      type,
      boxRaw: boxCell || `Out : ${boxDims.out.L}x${boxDims.out.W}x${boxDims.out.H}\nIn : ${boxDims.in.L}x${boxDims.in.W}x${boxDims.in.H}`,
      boxOut: boxDims.out,
      boxIn: boxDims.in,
      category,
      note: note || "Số lượng trong 1 BOX là bội của 10",
      multipleOf
    });
  }
  return parsed;
}

// Get all 6 3D orientations of a product (Standing, Vertical, Laying Flat & 90° Rotations)
function getProduct6Orientations(item) {
  const { pL, pW, pH } = item;
  return [
    {
      id: "stand_W_1",
      shortName: "1. Đứng ngang (Dài×Dày)",
      desc: "Dựng đứng theo Rộng, mặt Dài nằm theo X",
      label: `Đứng ngang (Ô=${pL}×${pH}, Cao=${pW})`,
      fX: pL, fY: pH, hPart: pW
    },
    {
      id: "stand_W_2",
      shortName: "2. Đứng ngang xoay 90° (Dày×Dài)",
      desc: "Dựng đứng theo Rộng, xoay 90° mặt Dày theo X",
      label: `Đứng xoay (Ô=${pH}×${pL}, Cao=${pW})`,
      fX: pH, fY: pL, hPart: pW
    },
    {
      id: "stand_L_1",
      shortName: "3. Đứng dọc (Rộng×Dày)",
      desc: "Dựng đứng theo Dài, mặt Rộng nằm theo X",
      label: `Đứng dọc (Ô=${pW}×${pH}, Cao=${pL})`,
      fX: pW, fY: pH, hPart: pL
    },
    {
      id: "stand_L_2",
      shortName: "4. Đứng dọc xoay 90° (Dày×Rộng)",
      desc: "Dựng đứng theo Dài, xoay 90° mặt Dày theo X",
      label: `Đứng dọc xoay (Ô=${pH}×${pW}, Cao=${pL})`,
      fX: pH, fY: pW, hPart: pL
    },
    {
      id: "flat_1",
      shortName: "5. Đặt nằm phẳng (Dài×Rộng)",
      desc: "Đặt nằm phẳng, chiều Rộng thành chiều rộng ô Y, Cao = Dày",
      label: `Đặt nằm phẳng (Ô=${pL}×${pW}, Cao=${pH})`,
      fX: pL, fY: pW, hPart: pH
    },
    {
      id: "flat_2",
      shortName: "6. Đặt nằm xoay 90° (Rộng×Dài)",
      desc: "Đặt nằm phẳng xoay 90°, chiều Rộng thành chiều dài ô X, Cao = Dày",
      label: `Đặt nằm xoay (Ô=${pW}×${pL}, Cao=${pH})`,
      fX: pW, fY: pL, hPart: pH
    }
  ];
}

// Evaluate all 6 orientations and return detailed feasibility & best layouts for each
function evaluateAll6Orientations(item, wallThick, clearance, ruleConfig) {
  const L_part = Math.max(30, item.boxIn.L - 5);
  const W_part = Math.max(30, item.boxIn.W - 5);
  const H_box = item.boxIn.H;
  const offX = 5, offY = 5;
  const availX = L_part - 2 * offX;
  const availY = W_part - 2 * offY;

  const mode = ruleConfig.mode;
  const multVal = Math.max(1, parseInt(ruleConfig.multVal, 10) || 10);
  const targetVal = Math.max(1, parseInt(ruleConfig.targetVal, 10) || 20);

  const orientations = getProduct6Orientations(item);
  return orientations.map(ori => {
    const heightOk = ori.hPart <= H_box;
    const maxNx = Math.floor((availX + wallThick) / (ori.fX + clearance + wallThick));
    const maxNy = Math.floor((availY + wallThick) / (ori.fY + clearance + wallThick));
    const maxTotal = (heightOk && maxNx >= 1 && maxNy >= 1) ? (maxNx * maxNy) : 0;

    if (!heightOk) {
      return {
        ori,
        feasible: false,
        matchesRule: false,
        reason: `Chiều cao đặt SP (${ori.hPart}mm) vượt quá chiều cao lòng thùng In (${H_box}mm)`,
        maxNx: 0, maxNy: 0, maxTotal: 0,
        bestNx: 1, bestNy: 1, bestTotal: 0,
        cellX: 0, cellY: 0,
        recWallH: Math.min(H_box - 5, ori.hPart),
        L_part, W_part
      };
    }

    if (maxNx < 1 || maxNy < 1) {
      return {
        ori,
        feasible: false,
        matchesRule: false,
        reason: `Tiết diện SP (${ori.fX}×${ori.fY}mm) lớn hơn lòng vách khả dụng (${availX}×${availY}mm)`,
        maxNx, maxNy, maxTotal: 0,
        bestNx: 1, bestNy: 1, bestTotal: 0,
        cellX: 0, cellY: 0,
        recWallH: Math.min(H_box - 5, ori.hPart + 10),
        L_part, W_part
      };
    }

    let bestRuleMatch = null;
    for (let nx = maxNx; nx >= 1; nx--) {
      for (let ny = maxNy; ny >= 1; ny--) {
        const total = nx * ny;
        let ok = false;
        if (mode === "free") ok = (nx === maxNx && ny === maxNy);
        else if (mode === "mult10") ok = (total % 10 === 0);
        else if (mode === "mult5") ok = (total % 5 === 0);
        else if (mode === "mult2") ok = (total % 2 === 0);
        else if (mode === "custom_mult") ok = (total % multVal === 0);
        else if (mode === "exact_target") ok = (total === targetVal);

        if (ok) {
          if (!bestRuleMatch || total > bestRuleMatch.total) {
            bestRuleMatch = { nx, ny, total };
          }
        }
      }
    }

    const chosenNx = bestRuleMatch ? bestRuleMatch.nx : maxNx;
    const chosenNy = bestRuleMatch ? bestRuleMatch.ny : maxNy;
    const chosenTotal = chosenNx * chosenNy;
    const cellX = (availX - (chosenNx - 1) * wallThick) / chosenNx;
    const cellY = (availY - (chosenNy - 1) * wallThick) / chosenNy;
    const recWallH = Math.min(H_box - 5, ori.hPart + 10);

    let reason = "";
    if (bestRuleMatch) {
      reason = `Thỏa mãn quy tắc (${chosenTotal} ô = ${chosenNx}×${chosenNy}) • Tối đa xếp được ${maxTotal} ô (${maxNx}×${maxNy})`;
    } else {
      reason = `Xếp tối đa chỉ được ${maxTotal} ô (${maxNx}×${maxNy}) — Không đủ đạt chuẩn quy tắc bội số`;
    }

    return {
      ori,
      feasible: true,
      matchesRule: !!bestRuleMatch,
      reason,
      maxNx, maxNy, maxTotal,
      bestNx: chosenNx,
      bestNy: chosenNy,
      bestTotal: chosenTotal,
      cellX, cellY,
      recWallH,
      L_part, W_part,
      layersPossible: Math.max(1, Math.floor(H_box / (ori.hPart + 2)))
    };
  });
}

function generateRecommendations(item, wallThick, clearance, ruleConfig) {
  const L_part = Math.max(30, item.boxIn.L - 5);
  const W_part = Math.max(30, item.boxIn.W - 5);
  const H_box = item.boxIn.H;
  const offX = 5, offY = 5;
  const availX = L_part - 2 * offX;
  const availY = W_part - 2 * offY;

  const orientations = getProduct6Orientations(item);
  const candidates = [];
  const mode = ruleConfig.mode;
  const multVal = Math.max(1, parseInt(ruleConfig.multVal, 10) || 10);
  const targetVal = Math.max(1, parseInt(ruleConfig.targetVal, 10) || 20);

  orientations.forEach(ori => {
    if (ori.hPart > H_box) return;
    const maxNx = Math.floor((availX + wallThick) / (ori.fX + clearance + wallThick));
    const maxNy = Math.floor((availY + wallThick) / (ori.fY + clearance + wallThick));
    if (maxNx < 1 || maxNy < 1) return;

    for (let nx = maxNx; nx >= 1; nx--) {
      for (let ny = maxNy; ny >= 1; ny--) {
        const total = nx * ny;
        let matchesRule = false;
        if (mode === "free") matchesRule = (nx === maxNx && ny === maxNy);
        else if (mode === "mult10") matchesRule = (total % 10 === 0);
        else if (mode === "mult5") matchesRule = (total % 5 === 0);
        else if (mode === "mult2") matchesRule = (total % 2 === 0);
        else if (mode === "custom_mult") matchesRule = (total % multVal === 0);
        else if (mode === "exact_target") matchesRule = (total === targetVal);

        const cellX = (availX - (nx - 1) * wallThick) / nx;
        const cellY = (availY - (ny - 1) * wallThick) / ny;
        if (cellX >= ori.fX && cellY >= ori.fY) {
          candidates.push({
            nx, ny, total,
            matchesRule,
            ori,
            cellX, cellY,
            recWallH: Math.min(H_box - 5, ori.hPart + 10),
            L_part, W_part
          });
        }
      }
    }
  });

  candidates.sort((a, b) => {
    if (a.matchesRule !== b.matchesRule) return a.matchesRule ? -1 : 1;
    if (mode === "exact_target") {
      const diffA = Math.abs(a.total - targetVal);
      const diffB = Math.abs(b.total - targetVal);
      if (diffA !== diffB) return diffA - diffB;
    }
    if (b.total !== a.total) return b.total - a.total;
    return a.ori.hPart - b.ori.hPart;
  });

  const unique = [];
  const seen = new Set();
  for (const c of candidates) {
    const key = `${c.nx}x${c.ny}_${c.ori.fX}x${c.ori.fY}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(c);
    }
    if (unique.length >= 6) break;
  }
  return unique;
}

function evaluateRowQuickSummary(item, wallThick, ruleConfig) {
  const recs = generateRecommendations(item, wallThick, 2, ruleConfig);
  const all6 = evaluateAll6Orientations(item, wallThick, 2, ruleConfig);
  const warnings = [];
  const H_box = item.boxIn.H;

  const maxDim = Math.max(item.pL, item.pW, item.pH);
  if (maxDim > H_box) {
    warnings.push(`Chiều dài SP (${maxDim}mm) > Cao lòng thùng In (${H_box}mm): Không thể dựng đứng theo chiều ${maxDim}mm.`);
  }

  if (recs.length === 0) {
    return {
      ok: false,
      statusText: "KHÔNG THỎA MÃN",
      best: null,
      all6,
      warnings: ["Kích thước sản phẩm quá lớn hoặc không đủ khe hở an toàn trong lòng thùng Box In."]
    };
  }

  const best = recs[0];
  const clearX = best.cellX - best.ori.fX;
  const clearY = best.cellY - best.ori.fY;

  if (!best.matchesRule) {
    warnings.push(`Không có phương án nào đạt chuẩn quy tắc số ô yêu cầu (Tốt nhất chỉ đạt ${best.total} ô = ${best.nx}×${best.ny}).`);
  }
  if (clearX < 3 || clearY < 3) {
    warnings.push(`Khe hở lọt lòng khá sát (${clearX.toFixed(1)} × ${clearY.toFixed(1)} mm) — Cần lưu ý dung sai lắp ghép vách.`);
  }
  if (best.ori.hPart + 10 > H_box) {
    warnings.push(`Chiều cao SP (${best.ori.hPart}mm) sát mép trần thùng In (${H_box}mm), vách ngăn giới hạn ở H=${best.recWallH}mm.`);
  }

  return {
    ok: best.matchesRule,
    statusText: best.matchesRule ? `ĐẠT CHUẨN (${best.total} Ô)` : `CẢNH BÁO QUY TẮC (${best.total} Ô)`,
    best,
    all6,
    clearX,
    clearY,
    warnings,
    altList: recs.slice(1, 4)
  };
}
