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
