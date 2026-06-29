# <img src="client/assets/Alfamart-Emblem.png" height="40"> SPARTA Building

**System for Property Administration, Reporting, Tracking & Approval - Building & Maintenance**

SPARTA (System for Property Administration, Reporting, Tracking & Approval) adalah platform digitalisasi proses bisnis untuk departemen **Building & Maintenance**. Versi ini fokus pada manajemen dokumen teknis, pengawasan proyek, dan integrasi workflow dari RAB hingga Serah Terima.

---

## 🚀 Tech Stack

Aplikasi ini dibangun menggunakan pendekatan **Modular Vanilla JavaScript** untuk performa maksimal dan kemudahan integrasi tanpa overhead framework yang berat.

- **Frontend:** HTML5, CSS3 (Modern Flexbox/Grid), Vanilla JavaScript (ES6+)
- **Icons:** [Lucide Icons](https://lucide.dev/)
- **Backend Integration:** 
  - **Python API:** Autentikasi dan Manajemen Data Utama
  - **Google Apps Script:** Logging, Audit Trail, dan Spreadsheet Integration
- **Deployment:** Vercel / Static Hosting

---

## ✨ Fitur Utama

### 📊 1. Dashboard & Monitoring Cerdas
- **Project Funneling:** Visualisasi tahap proyek dari Approval RAB hingga Terbit SPK.
- **SLA Monitoring:** Pemantauan otomatis masa pengerjaan (contoh: 10 hari SLA untuk proses PJU).
- **Role-Based UI:** Tampilan menu dinamis sesuai peran (Manager, Coordinator, Support, Kontraktor).

### 📝 2. Manajemen Dokumen (RAB & SPK)
- **RAB Digital:** Kalkulator volume dan harga otomatis untuk pekerjaan Sipil, Mekanikal, dan Elektrikal.
- **Workflow SPK:** Penerbitan Surat Perintah Kerja dengan penentuan timeline otomatis.
- **Tambah SPK:** Penanganan adendum atau penambahan hari kerja secara sistematis.

### 👷 3. Pengawasan & Opname Lapangan
- **Input PIC Pengawasan:** Penugasan tim Support untuk pengawasan toko secara spesifik.
- **Opname Progress:** Pelaporan kemajuan pekerjaan langsung dari lapangan.
- **Smart Validation:** Pembatasan edit pada item yang berstatus *Pending/Approved*.
- **Image Optimization:** Kompresi otomatis foto dokumentasi sebelum upload untuk efisiensi bandwidth.

### 🛠️ 4. Instruksi Lapangan (IL) & Serah Terima
- **Instruksi Lapangan:** Form penanganan pekerjaan tambahan di luar RAB awal dengan alur approval terintegrasi.
- **Penyimpanan Dokumen:** Dokumentasi digital untuk bangunan toko baru dan arsip per cabang.

### 🔒 5. Keamanan & Pembatasan Operasional
- **Gatekeeper System:** Pembatasan akses hanya pada jam operasional kerja (Senin - Jumat, 06:00 - 18:00 WIB).
- **Session Management:** Pengamanan sesi pengguna menggunakan `sessionStorage`.
- **Branch Group Logic:** Filtering data otomatis berdasarkan grup cabang pengguna.

---

## 📁 Struktur Proyek

Sistem dibangun secara modular di dalam direktori `client/`:

```text
sparta-frontend/
├── client/
│   ├── auth/           # Sistem Login & Sesi
│   ├── dashboard/      # Ringkasan Statistik & SLA
│   ├── rab/            # Modul Pembuatan RAB
│   ├── spk/            # Manajemen & List SPK
│   ├── opname/         # Pelaporan Progress Lapangan
│   ├── il/             # Instruksi Lapangan (Pekerjaan Tambah)
│   ├── monitoring/     # Dashboard Pemantauan Proyek
│   ├── ftdokumen/      # Dokumentasi Foto & Kompresi
│   ├── svdokumen/      # Penyimpanan Dokumen Toko
│   ├── userlog/        # Audit Trail & Aktivitas User
│   ├── assets/         # Gambar, Logo, & Static Files
│   ├── index.html      # Landing Page Utama
│   └── script.js       # Routing & Global Logic
└── README.md
```

---

## 🛠️ Konfigurasi & Pengembangan

### Menjalankan Secara Lokal
Karena aplikasi ini menggunakan Vanilla JS, Anda dapat menjalankannya dengan:
1. Menggunakan extension **Live Server** di VS Code.
2. Menggunakan python: `python -m http.server 8000` di dalam folder `client`.
3. Menghosting folder `client` pada web server apa pun.

### Konfigurasi API
Sesuaikan endpoint API pada file `client/auth/script.js`:
```javascript
const APPS_SCRIPT_POST_URL = "URL_GOOGLE_APPS_SCRIPT_ANDA";
const PYTHON_API_LOGIN_URL = "URL_BACKEND_PYTHON_ANDA";
```

---

## 📄 Lisensi & Hak Cipta
© 2026 **Property Administration - Building & Maintenance**. Semua hak cipta dilindungi.
