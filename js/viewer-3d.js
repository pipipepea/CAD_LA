// ============================================================================
// MODULE: js/viewer-3d.js
// Khung nhìn Mô Hình 3D Vách Ngăn & Thùng Box (Three.js) + Xuất file 3D .STL
// ============================================================================

window.CAD_3D = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  rootGroup: null,
  vdGroup: null,
  vnGroup: null,
  borderGroup: null,
  partGroup: null,
  boxGroup: null,
  initialized: false,
  animatingExplode: false,
  explodeDir: 1
};

function init3DViewerIfNeeded() {
  const container = document.getElementById("viewer3DContainer");
  if (!container || typeof THREE === "undefined") return;
  if (window.CAD_3D.initialized) {
    resize3DViewer();
    return;
  }

  const w = Math.max(300, container.clientWidth);
  const h = Math.max(400, container.clientHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050912);

  const camera = new THREE.PerspectiveCamera(42, w / h, 1, 15000);
  camera.position.set(680, 620, 720);

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
  renderer.setSize(w, h);
  renderer.shadowMap.enabled = true;

  const canvasHolder = document.getElementById("threeCanvasHolder");
  if (canvasHolder) {
    canvasHolder.innerHTML = "";
    canvasHolder.appendChild(renderer.domElement);
  }

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 80, 0);

  // Lights
  const ambLight = new THREE.AmbientLight(0xffffff, 0.72);
  scene.add(ambLight);

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.85);
  dirLight1.position.set(600, 1000, 750);
  scene.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.35);
  dirLight2.position.set(-600, 500, -550);
  scene.add(dirLight2);

  // Grid Helper
  const grid = new THREE.GridHelper(1400, 28, 0x0ea5e9, 0x1e293b);
  grid.position.y = -1;
  scene.add(grid);

  const rootGroup = new THREE.Group();
  scene.add(rootGroup);

  window.CAD_3D.scene = scene;
  window.CAD_3D.camera = camera;
  window.CAD_3D.renderer = renderer;
  window.CAD_3D.controls = controls;
  window.CAD_3D.rootGroup = rootGroup;
  window.CAD_3D.initialized = true;

  function animateLoop() {
    requestAnimationFrame(animateLoop);
    if (window.CAD_3D.animatingExplode) {
      const slider = document.getElementById("rng_explode3D");
      if (slider) {
        let val = parseFloat(slider.value) || 0;
        val += window.CAD_3D.explodeDir * 1.4;
        if (val >= 100) { val = 100; window.CAD_3D.explodeDir = -1; }
        if (val <= 0) { val = 0; window.CAD_3D.explodeDir = 1; }
        slider.value = val;
        apply3DExplodeOffset(val);
      }
    }
    controls.update();
    renderer.render(scene, camera);
  }
  animateLoop();
}

function resize3DViewer() {
  if (!window.CAD_3D.initialized) return;
  const container = document.getElementById("viewer3DContainer");
  if (!container) return;
  const w = Math.max(300, container.clientWidth);
  const h = Math.max(400, container.clientHeight);
  window.CAD_3D.camera.aspect = w / h;
  window.CAD_3D.camera.updateProjectionMatrix();
  window.CAD_3D.renderer.setSize(w, h);
}

// Create a slotted 3D plate mesh using THREE.ExtrudeGeometry
function createSlottedPlateMesh(length, height, thick, slots, slotW, slotDepth, cutFrom, colorHex) {
  const shape = new THREE.Shape();
  const halfL = length / 2;

  const validSlots = [...slots]
    .filter(s => s - slotW / 2 > 0.5 && s + slotW / 2 < length - 0.5)
    .sort((a, b) => a - b);

  if (cutFrom === "top" && validSlots.length > 0 && slotDepth > 0 && slotDepth < height) {
    shape.moveTo(-halfL, 0);
    shape.lineTo(halfL, 0);
    shape.lineTo(halfL, height);
    for (let i = validSlots.length - 1; i >= 0; i--) {
      const sc = validSlots[i] - halfL;
      const rEdge = sc + slotW / 2;
      const lEdge = sc - slotW / 2;
      shape.lineTo(rEdge, height);
      shape.lineTo(rEdge, height - slotDepth);
      shape.lineTo(lEdge, height - slotDepth);
      shape.lineTo(lEdge, height);
    }
    shape.lineTo(-halfL, height);
    shape.closePath();
  } else if (cutFrom === "bottom" && validSlots.length > 0 && slotDepth > 0 && slotDepth < height) {
    shape.moveTo(-halfL, 0);
    for (let i = 0; i < validSlots.length; i++) {
      const sc = validSlots[i] - halfL;
      const lEdge = sc - slotW / 2;
      const rEdge = sc + slotW / 2;
      shape.lineTo(lEdge, 0);
      shape.lineTo(lEdge, slotDepth);
      shape.lineTo(rEdge, slotDepth);
      shape.lineTo(rEdge, 0);
    }
    shape.lineTo(halfL, 0);
    shape.lineTo(halfL, height);
    shape.lineTo(-halfL, height);
    shape.closePath();
  } else {
    shape.moveTo(-halfL, 0);
    shape.lineTo(halfL, 0);
    shape.lineTo(halfL, height);
    shape.lineTo(-halfL, height);
    shape.closePath();
  }

  const geom = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  geom.translate(0, 0, -thick / 2);

  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    roughness: 0.36,
    metalness: 0.12
  });
  const mesh = new THREE.Mesh(geom, mat);

  const edgeGeom = new THREE.EdgesGeometry(geom);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x0f172a, linewidth: 1 });
  mesh.add(new THREE.LineSegments(edgeGeom, edgeMat));

  return mesh;
}

function rebuild3DScene() {
  init3DViewerIfNeeded();
  if (!window.CAD_3D.initialized) return;

  const g = computeCadGeometry();
  const item = window.APP_STATE.items[window.APP_STATE.selectedIndex] || window.APP_STATE.items[0];
  const c = window.APP_STATE.colors;
  const root = window.CAD_3D.rootGroup;

  while (root.children.length > 0) {
    root.remove(root.children[0]);
  }

  const vdGroup = new THREE.Group();
  const vnGroup = new THREE.Group();
  const borderGroup = new THREE.Group();
  const partGroup = new THREE.Group();
  const boxGroup = new THREE.Group();

  root.add(vdGroup, vnGroup, borderGroup, partGroup, boxGroup);
  window.CAD_3D.vdGroup = vdGroup;
  window.CAD_3D.vnGroup = vnGroup;
  window.CAD_3D.borderGroup = borderGroup;
  window.CAD_3D.partGroup = partGroup;
  window.CAD_3D.boxGroup = boxGroup;

  // 1. Vertical Walls (VD) along Z axis (length = g.lenVD)
  g.vWalls.forEach(wx => {
    const mesh = createSlottedPlateMesh(
      g.lenVD, g.hVD, g.tX,
      g.slotsOnVD, g.tY + 0.25, g.slotDepthVD, g.cutVD,
      c.vd
    );
    mesh.rotation.y = -Math.PI / 2;
    const centerX = wx + g.tX / 2 - g.L / 2;
    mesh.position.set(centerX, 0, 0);
    vdGroup.add(mesh);
  });

  // 2. Horizontal Walls (VN) along X axis (length = g.lenVN)
  g.hWalls.forEach(wy => {
    const mesh = createSlottedPlateMesh(
      g.lenVN, g.hVN, g.tY,
      g.slotsOnVN, g.tX + 0.25, g.slotDepthVN, g.cutVN,
      c.vn
    );
    const centerZ = wy + g.tY / 2 - g.W / 2;
    mesh.position.set(0, 0, centerZ);
    vnGroup.add(mesh);
  });

  // 3. Outer Border Walls if enabled
  if (g.bX > 0) {
    const lenBD = g.W - 2 * g.offY;
    const leftBD = createSlottedPlateMesh(lenBD, g.hBao, g.bX, [], 0, 0, "none", c.bd);
    leftBD.rotation.y = -Math.PI / 2;
    leftBD.position.set(g.offX + g.bX / 2 - g.L / 2, 0, 0);

    const rightBD = createSlottedPlateMesh(lenBD, g.hBao, g.bX, [], 0, 0, "none", c.bd);
    rightBD.rotation.y = -Math.PI / 2;
    rightBD.position.set(g.L - g.offX - g.bX / 2 - g.L / 2, 0, 0);
    borderGroup.add(leftBD, rightBD);
  }
  if (g.bY > 0) {
    const lenBN = g.L - 2 * g.offX;
    const topBN = createSlottedPlateMesh(lenBN, g.hBao, g.bY, [], 0, 0, "none", c.bn);
    topBN.position.set(0, 0, g.offY + g.bY / 2 - g.W / 2);

    const botBN = createSlottedPlateMesh(lenBN, g.hBao, g.bY, [], 0, 0, "none", c.bn);
    botBN.position.set(0, 0, g.W - g.offY - g.bY / 2 - g.W / 2);
    borderGroup.add(topBN, botBN);
  }

  // 4. 3D Product Blocks inside cells
  if (document.getElementById("chk_3dShowParts")?.checked && window.APP_STATE.activeFootprint) {
    const fp = window.APP_STATE.activeFootprint;
    const fits = fp.x <= g.cellX + 0.05 && fp.y <= g.cellY + 0.05;
    const pGeom = new THREE.BoxGeometry(Math.min(fp.x, g.cellX * 0.96), fp.h, Math.min(fp.y, g.cellY * 0.96));
    const pMat = new THREE.MeshStandardMaterial({
      color: fits ? 0x10b981 : 0xef4444,
      transparent: true,
      opacity: 0.42,
      roughness: 0.4
    });

    for (let ix = 0; ix < g.nx; ix++) {
      for (let iy = 0; iy < g.ny; iy++) {
        const cx = g.offX + g.bX + ix * (g.cellX + g.tX) + g.cellX / 2 - g.L / 2;
        const cz = g.offY + g.bY + iy * (g.cellY + g.tY) + g.cellY / 2 - g.W / 2;
        const pm = new THREE.Mesh(pGeom, pMat);
        pm.position.set(cx, fp.h / 2, cz);
        partGroup.add(pm);
      }
    }
  }

  // 5. Transparent Outer Box In 3D
  if (document.getElementById("chk_3dShowBox")?.checked && item) {
    const bL = item.boxIn.L || g.L;
    const bW = item.boxIn.W || g.W;
    const bH = item.boxIn.H || g.hVD;
    const boxGeom = new THREE.BoxGeometry(bL, bH, bW);
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.10,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const boxMesh = new THREE.Mesh(boxGeom, boxMat);
    boxMesh.position.set(0, bH / 2, 0);

    const edges = new THREE.EdgesGeometry(boxGeom);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x38bdf8 }));
    boxMesh.add(line);
    boxGroup.add(boxMesh);
  }

  const explodeVal = parseFloat(document.getElementById("rng_explode3D")?.value) || 0;
  apply3DExplodeOffset(explodeVal);
}

function apply3DExplodeOffset(percent) {
  const g = computeCadGeometry();
  const maxLift = Math.max(g.hVD, g.hVN) * 1.15;
  const offset = (percent / 100) * maxLift;

  const lbl = document.getElementById("lbl_explodePct");
  if (lbl) lbl.textContent = `${Math.round(percent)}%`;

  if (!window.CAD_3D.vdGroup || !window.CAD_3D.vnGroup) return;
  if (g.cutVD === "top") {
    window.CAD_3D.vnGroup.position.y = offset;
    window.CAD_3D.vdGroup.position.y = 0;
  } else {
    window.CAD_3D.vdGroup.position.y = offset;
    window.CAD_3D.vnGroup.position.y = 0;
  }
}

function toggle3DExplodeAnim() {
  window.CAD_3D.animatingExplode = !window.CAD_3D.animatingExplode;
  const btn = document.getElementById("btn_explodeAnim");
  if (btn) {
    btn.textContent = window.CAD_3D.animatingExplode ? "⏸ Dừng mô phỏng" : "▶ Mô phỏng đan rãnh";
  }
}

function set3DCameraPreset(preset) {
  if (!window.CAD_3D.initialized) return;
  const cam = window.CAD_3D.camera;
  const ctrl = window.CAD_3D.controls;
  ctrl.target.set(0, 80, 0);
  if (preset === "iso") cam.position.set(680, 620, 720);
  else if (preset === "top") cam.position.set(0, 1100, 1);
  else if (preset === "front") cam.position.set(0, 180, 950);
  else if (preset === "side") cam.position.set(950, 180, 0);
  ctrl.update();
}

// Export 3D Partition Assembly as ASCII .STL file with requested filename pattern
function export3DSTL() {
  rebuild3DScene();
  if (!window.CAD_3D.rootGroup) return;

  const g = computeCadGeometry();
  const item = window.APP_STATE.items[window.APP_STATE.selectedIndex] || { partCode: "LAYOUT" };
  let stl = `solid MASTER_CAD_${item.partCode}_${g.nx}x${g.ny}_${g.totalCells}CELLS\n`;

  const groupsToExport = [window.CAD_3D.vdGroup, window.CAD_3D.vnGroup, window.CAD_3D.borderGroup];
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
  const cb = new THREE.Vector3(), ab = new THREE.Vector3();

  groupsToExport.forEach(grp => {
    if (!grp) return;
    grp.updateMatrixWorld(true);
    grp.children.forEach(mesh => {
      if (!mesh.isMesh) return;
      const geom = mesh.geometry.clone();
      geom.applyMatrix4(mesh.matrixWorld);
      const pos = geom.attributes.position;
      const index = geom.index;

      const writeTri = (i1, i2, i3) => {
        vA.fromBufferAttribute(pos, i1);
        vB.fromBufferAttribute(pos, i2);
        vC.fromBufferAttribute(pos, i3);
        cb.subVectors(vC, vB);
        ab.subVectors(vA, vB);
        cb.cross(ab).normalize();
        stl += `facet normal ${cb.x.toFixed(5)} ${cb.y.toFixed(5)} ${cb.z.toFixed(5)}\n`;
        stl += `  outer loop\n`;
        stl += `    vertex ${vA.x.toFixed(4)} ${vA.z.toFixed(4)} ${vA.y.toFixed(4)}\n`;
        stl += `    vertex ${vB.x.toFixed(4)} ${vB.z.toFixed(4)} ${vB.y.toFixed(4)}\n`;
        stl += `    vertex ${vC.x.toFixed(4)} ${vC.z.toFixed(4)} ${vC.y.toFixed(4)}\n`;
        stl += `  endloop\n`;
        stl += `endfacet\n`;
      };

      if (index) {
        for (let i = 0; i < index.count; i += 3) {
          writeTri(index.getX(i), index.getX(i + 1), index.getX(i + 2));
        }
      } else if (pos) {
        for (let i = 0; i < pos.count; i += 3) {
          writeTri(i, i + 1, i + 2);
        }
      }
    });
  });

  stl += `endsolid MASTER_CAD_${item.partCode}_${g.nx}x${g.ny}_${g.totalCells}CELLS\n`;
  const blob = new Blob([stl], { type: "model/stl;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `MASTER_CAD_${item.partCode}_${g.nx}x${g.ny}_${g.totalCells}CELLS.stl`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
