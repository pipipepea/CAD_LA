# 📐 THÔNG SỐ VÁCH CAD — ISO STANDARD PRO

Ứng dụng Web thiết kế tự động **Layout Vách Ngăn (Danpla / Carton Partition)** từ file Excel thông số linh kiện, hỗ trợ tính toán phương án xếp ô tối ưu và xuất bản vẽ kỹ thuật **AutoCAD (`.DXF`)**, **Ảnh kỹ thuật (`.PNG`)**, **Bảng kê vật tư (`.XLSX`)**.

## 📁 Cấu trúc thư mục dự án
```text
layout-cad-pro/
├── index.html                  # Trang giao diện chính (Studio Layout CAD)
├── manifest.json               # Cấu hình Web App (PWA)
├── README.md                   # Hướng dẫn sử dụng & triển khai
├── assets/
│   └── logo.svg                # Logo Vector 3D chuẩn SVG
├── css/
│   └── style.css               # Hệ thống giao diện & chủ đề nền bản vẽ
├── js/
│   ├── app.js                  # Điều khiển sự kiện & tương tác người dùng
│   ├── excel-parser.js         # Bóc tách dữ liệu file Excel & gợi ý phương án xếp ô
│   ├── cad-renderer.js         # Đồ họa Vector Super-HiDPI 2.75x & thuật toán chống chồng lấn
│   └── dxf-exporter.js         # Bộ xuất file AutoCAD .DXF chuẩn R12/LT2
└── sample-data/
    └── TESST 001.xlsx          # File Excel dữ liệu mẫu đi kèm
```

## 🚀 Cách chạy ứng dụng
1. Giải nén file **`layout-cad-pro.zip`** vào một thư mục trên máy tính.
2. Mở trực tiếp file **`index.html`** bằng trình duyệt (Chrome, Edge, Firefox, Safari) hoặc đưa toàn bộ thư mục lên **GitHub Pages** (`https://pipipepea.github.io/layout-cad/`).

## Touch & DIM tools update
- DIM modes: aligned two-point, horizontal, and vertical.
- DIM labels can be dragged to reposition them. Tap a label to hide/show its annotation in the 2D view; use the global visibility toggle to show/hide all DIM annotations.
- Optional 1 mm coordinate-grid rounding for measurement points. This is a basic grid snap, not full AutoCAD object snap (endpoint/intersection/nearest).
- 2D visibility toggles for vertical and horizontal walls.
- PNG export produces a 3x enlarged raster output for improved viewing; this is not a true vector export.

Important limitation: user-created DIM annotations are currently view overlays and are not yet exported as native DXF DIMENSION entities. Individual hidden DIMs are view annotations only. The 3D viewer still uses its existing box/part visibility controls; individual wall-group isolation in 3D is not yet implemented.

## Touch DIM v4 updates
- Added CAD-style dimension line with arrowheads and extension lines; label offset can be dragged independently.
- Added a cursor loupe while picking DIM points and smart snap candidates for frame/wall intersections and wall edges (screen tolerance based).
- Added one global collapse control for the entire left parameter panel to reclaim workspace width.
- Added quick visibility presets: all walls, vertical walls only, horizontal walls only; visibility applies to 2D and 3D wall groups.

Note: these interactive dimensions remain view annotations, not native DXF DIMENSION entities. Smart snap currently targets calculated frame/wall geometry, not every possible CAD entity or plate slot.


## v5 — Touch Viewport & DIM confirmation
- Collapsed parameter panel becomes a small floating button and no longer reserves a blank grid column; the CAD workspace expands beneath it.
- Added explicit **① Confirm Point 1** and **② Confirm Point 2** controls for touch-based dimensioning. Position the cursor on the drawing (use two-finger zoom first if needed), then confirm each point with the corresponding button.
- Replaced artificial coordinate-grid snapping with geometric candidates: frame corners, wall endpoints, segment midpoints and actual wall intersections.
- Removed STL export controls from the interface; STEP and DXF remain available.
- DIM remains a canvas overlay annotation in this version, not a native DXF DIMENSION entity.


## v6 — CAD interaction and metadata
- Fixed the undefined `toolbar.prepend(b)` reference in touch-tools installation.
- Space-key DIM workflow on desktop: confirm point 1, confirm point 2, move to label placement, confirm placement. Added Ctrl/Cmd+Z for undo and F for fit/reset view.
- Added touch-screen confirmation for DIM label placement, two-finger pan/pinch, zoom anchoring, larger snap tolerance and persistent view DIM annotations in local browser storage.
- Snap candidates include both faces of finite-thickness wall geometry plus endpoints, midpoints and intersections; artificial grid snapping is not used.
- Added compact controls, update feedback, a drawing metadata QR, an author QR, and JSON metadata download. PNG export includes visible DIM overlay and QR/authorship marks.
- Removed the `Ô X = ...` annotation from inside the layout; X-cell dimension remains in the summary/BOM.
- QR metadata is generated in-browser through the QRCodeJS CDN. Internet access is required for that library and the existing CDN-based dependencies. The JSON download is the portable source of the metadata; scanning a QR alone does not automatically write values into Excel.

Known limitations: dimensions are still view annotations rather than native DXF DIMENSION entities; the metadata QR is available in the page/BOM and PNG export, not embedded as a DXF block. Wall highlighting is a viewport update flash rather than per-wall selective geometry highlighting.
