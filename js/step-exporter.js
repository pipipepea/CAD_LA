// ============================================================================
// MODULE: js/step-exporter.js
// Bộ xuất file 3D CAD chuẩn ISO-10303-21 (STEP AP214 - .STEP / .STP)
// Tương thích với Autodesk Inventor, Fusion 360, FreeCAD, SolidWorks, AutoCAD 3D
// Tạo khối B-Rep (FACETED_BREP) với các mặt phẳng chuẩn (PLANE) và cạnh thẳng (LINE)
// ============================================================================

function getStepPolygon2D(length, height, slots, slotW, slotDepth, cutFrom) {
  const halfL = length / 2;
  const validSlots = [...slots]
    .filter(s => s - slotW / 2 > 0.5 && s + slotW / 2 < length - 0.5)
    .sort((a, b) => a - b);

  const pts = [];
  if (cutFrom === "top" && validSlots.length > 0 && slotDepth > 0 && slotDepth < height) {
    pts.push([-halfL, 0], [halfL, 0], [halfL, height]);
    for (let i = validSlots.length - 1; i >= 0; i--) {
      const sc = validSlots[i] - halfL;
      const rEdge = sc + slotW / 2;
      const lEdge = sc - slotW / 2;
      pts.push([rEdge, height], [rEdge, height - slotDepth], [lEdge, height - slotDepth], [lEdge, height]);
    }
    pts.push([-halfL, height]);
  } else if (cutFrom === "bottom" && validSlots.length > 0 && slotDepth > 0 && slotDepth < height) {
    pts.push([-halfL, 0]);
    for (let i = 0; i < validSlots.length; i++) {
      const sc = validSlots[i] - halfL;
      const lEdge = sc - slotW / 2;
      const rEdge = sc + slotW / 2;
      pts.push([lEdge, 0], [lEdge, slotDepth], [rEdge, slotDepth], [rEdge, 0]);
    }
    pts.push([halfL, 0], [halfL, height], [-halfL, height]);
  } else {
    pts.push([-halfL, 0], [halfL, 0], [halfL, height], [-halfL, height]);
  }
  return pts;
}

function buildMasterStepContent(g, item) {
  let entityId = 10;
  const lines = [];
  const add = (str) => {
    const id = entityId++;
    lines.push(`#${id} = ${str};`);
    return id;
  };

  // Base coordinate & unit definitions (Millimeters, Radians, Solid Angle)
  const appCtx = add(`APPLICATION_CONTEXT('automotive_design')`);
  add(`APPLICATION_PROTOCOL_DEFINITION('draft international standard','automotive_design',1998,#${appCtx})`);
  const prodCtx = add(`PRODUCT_CONTEXT('',#${appCtx},'mechanical')`);
  const prodDefCtx = add(`PRODUCT_DEFINITION_CONTEXT('part definition',#${appCtx},'design')`);

  const cleanCode = String(item?.partCode || "PARTITION").replace(/[^A-Za-z0-9_-]/g, "_");
  const partName = `MASTER_CAD_${cleanCode}_${g.nx}x${g.ny}_${g.totalCells}CELLS`;

  const prod = add(`PRODUCT('${partName}','${partName}','Partition CAD 3D Solid',(#${prodCtx}))`);
  const pdf = add(`PRODUCT_DEFINITION_FORMATION('1','First Version',#${prod})`);
  const pd = add(`PRODUCT_DEFINITION('design','',#${pdf},#${prodDefCtx})`);
  const pds = add(`PRODUCT_DEFINITION_SHAPE('','',#${pd})`);

  const lenUnit = add(`( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) )`);
  const angUnit = add(`( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.) )`);
  const sAngUnit = add(`( NAMED_UNIT(*) SOLID_ANGLE_UNIT() SI_UNIT($,.STERADIAN.) )`);
  const uncert = add(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.0E-04),#${lenUnit},'distance_accuracy_value','confusion accuracy')`);
  const geomCtx = add(`( GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${uncert})) GLOBAL_UNIT_ASSIGNED_CONTEXT((#${lenUnit},#${angUnit},#${sAngUnit})) REPRESENTATION_CONTEXT('Context3D','3D Context with MM units') )`);

  const originPt = add(`CARTESIAN_POINT('Origin',(0.0,0.0,0.0))`);
  const dirZ = add(`DIRECTION('AxisZ',(0.0,0.0,1.0))`);
  const dirX = add(`DIRECTION('AxisX',(1.0,0.0,0.0))`);
  const worldAxis = add(`AXIS2_PLACEMENT_3D('World',#${originPt},#${dirZ},#${dirX})`);

  const solidIds = [];

  // Helper to add a 3D extruded slotted plate into STEP as a CLOSED_SHELL / FACETED_BREP
  // orientation: 'VN' (along X axis, normal along Y) or 'VD' (along Y axis, normal along X)
  function addSlottedPlateSolid(plateLabel, poly2D, thick, posOffset, orientation) {
    const N = poly2D.length;
    const frontPts = [];
    const backPts = [];

    // Map 2D profile (u, v) + thickness w into 3D CAD coordinates (X, Y, Z where Z is height UP)
    for (let i = 0; i < N; i++) {
      const u = poly2D[i][0];
      const v = poly2D[i][1]; // height Z

      let fx, fy, fz, bx, by, bz;
      if (orientation === "VN") {
        // Horizontal wall along X: u -> X, v -> Z, thickness along Y
        fx = u;
        fy = posOffset + thick / 2;
        fz = v;
        bx = u;
        by = posOffset - thick / 2;
        bz = v;
      } else {
        // Vertical wall along Y: u -> Y, v -> Z, thickness along X
        fx = posOffset + thick / 2;
        fy = u;
        fz = v;
        bx = posOffset - thick / 2;
        by = u;
        bz = v;
      }

      frontPts.push(add(`CARTESIAN_POINT('',(${fx.toFixed(4)},${fy.toFixed(4)},${fz.toFixed(4)}))`));
      backPts.push(add(`CARTESIAN_POINT('',(${bx.toFixed(4)},${by.toFixed(4)},${bz.toFixed(4)}))`));
    }

    const faceIds = [];

    // 1. Front Cap Face (CCW loop)
    const frontLoop = add(`POLY_LOOP('FrontCap',(${frontPts.map(id => `#${id}`).join(",")}))`);
    const frontBound = add(`FACE_OUTER_BOUND('',#${frontLoop},.T.)`);
    const nFront = orientation === "VN"
      ? add(`DIRECTION('',(0.0,1.0,0.0))`)
      : add(`DIRECTION('',(1.0,0.0,0.0))`);
    const rFront = orientation === "VN"
      ? add(`DIRECTION('',(1.0,0.0,0.0))`)
      : add(`DIRECTION('',(0.0,1.0,0.0))`);
    const axFront = add(`AXIS2_PLACEMENT_3D('',#${frontPts[0]},#${nFront},#${rFront})`);
    const plFront = add(`PLANE('',#${axFront})`);
    faceIds.push(add(`ADVANCED_FACE('Front',(#${frontBound}),#${plFront},.T.)`));

    // 2. Back Cap Face (Reversed loop for outward normal)
    const revBack = [...backPts].reverse();
    const backLoop = add(`POLY_LOOP('BackCap',(${revBack.map(id => `#${id}`).join(",")}))`);
    const backBound = add(`FACE_OUTER_BOUND('',#${backLoop},.T.)`);
    const nBack = orientation === "VN"
      ? add(`DIRECTION('',(0.0,-1.0,0.0))`)
      : add(`DIRECTION('',(-1.0,0.0,0.0))`);
    const axBack = add(`AXIS2_PLACEMENT_3D('',#${backPts[0]},#${nBack},#${rFront})`);
    const plBack = add(`PLANE('',#${axBack})`);
    faceIds.push(add(`ADVANCED_FACE('Back',(#${backBound}),#${plBack},.T.)`));

    // 3. Perimeter & Slot Side Faces (N rectangular planar faces)
    for (let i = 0; i < N; i++) {
      const next = (i + 1) % N;
      const du = poly2D[next][0] - poly2D[i][0];
      const dv = poly2D[next][1] - poly2D[i][1];
      const len = Math.hypot(du, dv) || 1;
      // 2D outward normal of CCW polygon is (dv/len, -du/len)
      const nu = dv / len;
      const nv = -du / len;

      let nx, ny, nz, rx, ry, rz;
      if (orientation === "VN") {
        nx = nu; ny = 0; nz = nv;
        rx = du / len; ry = 0; rz = dv / len;
      } else {
        nx = 0; ny = nu; nz = nv;
        rx = 0; ry = du / len; rz = dv / len;
      }

      const sideLoop = add(`POLY_LOOP('Side_${i}',(#${frontPts[i]},#${backPts[i]},#${backPts[next]},#${frontPts[next]}))`);
      const sideBound = add(`FACE_OUTER_BOUND('',#${sideLoop},.T.)`);
      const nSide = add(`DIRECTION('',(${nx.toFixed(5)},${ny.toFixed(5)},${nz.toFixed(5)}))`);
      const rSide = add(`DIRECTION('',(${rx.toFixed(5)},${ry.toFixed(5)},${rz.toFixed(5)}))`);
      const axSide = add(`AXIS2_PLACEMENT_3D('',#${frontPts[i]},#${nSide},#${rSide})`);
      const plSide = add(`PLANE('',#${axSide})`);
      faceIds.push(add(`ADVANCED_FACE('SideFace_${i}',(#${sideBound}),#${plSide},.T.)`));
    }

    const shellId = add(`CLOSED_SHELL('${plateLabel}',(${faceIds.map(id => `#${id}`).join(",")}))`);
    const brepId = add(`FACETED_BREP('${plateLabel}',#${shellId})`);
    solidIds.push(brepId);
  }

  // Generate Vertical Walls (VD)
  const polyVD = getStepPolygon2D(g.lenVD, g.hVD, g.slotsOnVD, g.tY + 0.25, g.slotDepthVD, g.cutVD);
  g.vWalls.forEach((wx, idx) => {
    const centerX = wx + g.tX / 2 - g.L / 2;
    addSlottedPlateSolid(`${cleanCode}_VD${idx + 1}`, polyVD, g.tX, centerX, "VD");
  });

  // Generate Horizontal Walls (VN)
  const polyVN = getStepPolygon2D(g.lenVN, g.hVN, g.slotsOnVN, g.tX + 0.25, g.slotDepthVN, g.cutVN);
  g.hWalls.forEach((wy, idx) => {
    const centerY = g.W / 2 - (wy + g.tY / 2);
    addSlottedPlateSolid(`${cleanCode}_VN${idx + 1}`, polyVN, g.tY, centerY, "VN");
  });

  // Generate Border Walls if enabled
  if (g.bX > 0) {
    const lenBD = g.W - 2 * g.offY;
    const polyBD = getStepPolygon2D(lenBD, g.hBao, [], 0, 0, "none");
    addSlottedPlateSolid(`${cleanCode}_BD1`, polyBD, g.bX, g.offX + g.bX / 2 - g.L / 2, "VD");
    addSlottedPlateSolid(`${cleanCode}_BD2`, polyBD, g.bX, g.L - g.offX - g.bX / 2 - g.L / 2, "VD");
  }
  if (g.bY > 0) {
    const lenBN = g.L - 2 * g.offX;
    const polyBN = getStepPolygon2D(lenBN, g.hBao, [], 0, 0, "none");
    addSlottedPlateSolid(`${cleanCode}_BN1`, polyBN, g.bY, g.W / 2 - (g.offY + g.bY / 2), "VN");
    addSlottedPlateSolid(`${cleanCode}_BN2`, polyBN, g.bY, g.W / 2 - (g.W - g.offY - g.bY / 2), "VN");
  }

  // Fallback if 1x1 cell with no walls: create a reference base plate so STEP is never empty
  if (solidIds.length === 0) {
    const polyBase = getStepPolygon2D(g.L, g.hVD, [], 0, 0, "none");
    addSlottedPlateSolid(`${cleanCode}_BASE`, polyBase, g.tX, 0, "VN");
  }

  const shapeRep = add(`ADVANCED_BREP_SHAPE_REPRESENTATION('${partName}',(${solidIds.map(id => `#${id}`).join(",")},#${worldAxis}),#${geomCtx})`);
  add(`SHAPE_DEFINITION_REPRESENTATION(#${pds},#${shapeRep})`);

  const nowIso = new Date().toISOString().split(".")[0];
  return [
    "ISO-10303-21;",
    "HEADER;",
    `FILE_DESCRIPTION(('STEP AP214 3D Partition CAD Assembly - ${partName}'),'2;1');`,
    `FILE_NAME('${partName}.step','${nowIso}',('Phuc - ABPV'),('ISO STANDARD PRO'),'LayoutCAD Pro STEP Exporter','v3.5','');`,
    "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));",
    "ENDSEC;",
    "DATA;",
    ...lines,
    "ENDSEC;",
    "END-ISO-10303-21;"
  ].join("\n") + "\n";
}

function export3DSTEP() {
  const g = computeCadGeometry();
  const item = window.APP_STATE.items[window.APP_STATE.selectedIndex] || { partCode: "SANPHAM" };
  const stepContent = buildMasterStepContent(g, item);
  const baseName = typeof getMasterFileBaseName === "function"
    ? getMasterFileBaseName()
    : `MASTER_CAD_${item.partCode}_${g.nx}x${g.ny}_${g.totalCells}CELLS`;

  const blob = new Blob([stepContent], { type: "application/step;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${baseName}.step`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
