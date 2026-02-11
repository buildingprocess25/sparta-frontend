SPARTA Frontend (System Documentation)

**Project:** SPARTA (Sistem Dokumentasi Bangunan Toko Baru - Alfamart)
**Stack:** Vanilla JavaScript (ES6+), CSS3, HTML5
**Backend Integration:** Python (Render) & Google Apps Script
**Platform:** Web (PWA Supported)

---

## 📖 Overview

SPARTA Frontend adalah antarmuka manajemen proyek konstruksi yang dirancang untuk memonitoring pembangunan dan renovasi toko Alfamart. Aplikasi ini dibangun menggunakan **Vanilla JavaScript** murni dengan arsitektur modular, memprioritaskan performa ringan tanpa ketergantungan pada framework besar (seperti React/Vue).

Sistem ini mencakup manajemen RAB, SPK, Kurva S (Gantt Chart), Laporan Opname, hingga audit log aktivitas pengguna.

## 📂 Module Architecture

Setiap fitur memiliki direktori terisolasi di dalam folder `client/` yang berisi logika (`script.js`), tampilan (`index.html`), dan gaya (`style.css`) masing-masing.

### 1. 🔐 Core System & Security
* **Authentication (`client/auth/`)**
  * Menangani login via Python Backend API.
  * **Audit Logging:** Mengirim data log aktivitas login (sukses/gagal) ke Google Apps Script.
  * **Session Management:** Menyimpan `userRole` dan `loggedInUserCabang` di `sessionStorage` (hilang saat browser ditutup).
* **Time-Based Access Control (`client/script.js`)**
  * **Landing Page Gatekeeper:** Membatasi akses aplikasi hanya pada hari kerja (Senin-Jumat) dan jam kerja (06:00 - 18:00 WIB).

### 2. 📊 Dashboard & Navigation
* **Dashboard (`client/dashboard/`)**
  * Sentral navigasi yang menerapkan **RBAC (Role-Based Access Control)**.
  * Menu ditampilkan secara dinamis berdasarkan role user: *Manager, Coordinator, Support,* atau *Kontraktor*.
  * **Head Office Logic:** User internal Head Office mendapatkan akses menu tambahan "User Log".

### 3. 💰 Cost & Planning (RAB)
* **RAB (`client/rab/`)**
  * Modul Rencana Anggaran Biaya.
  * Fitur: Input item pekerjaan (Sipil/ME), kalkulasi otomatis volume x harga, dan rekapitulasi total biaya.

### 4. 📝 Work Orders (SPK)
* **SPK (`client/spk/`)**
  * Monitoring Surat Perintah Kerja aktif berdasarkan cabang pengguna.
* **Tambah SPK / Addendum (`client/tambahspk/`)**
  * Form pengajuan perpanjangan waktu SPK. Otomatis menghitung tanggal akhir baru berdasarkan durasi tambahan.

### 5. 📉 Project Monitoring (Gantt & Opname)
* **Gantt Chart (`client/gantt/`)**
  * Visualisasi jadwal proyek (Kurva S).
  * Menggunakan library visualisasi atau implementasi custom canvas/SVG untuk merender timeline pekerjaan.
* **Opname (`client/opname/`)**
  * Pelaporan progres mingguan/bulanan.
  * Fitur: Upload foto bukti pekerjaan dan kalkulasi persentase bobot realisasi.

### 6. 📁 Document Management
* **Foto Dokumen (`client/ftdokumen/`)**: Upload dokumentasi visual proyek.
* **Supervisi Dokumen (`client/svdokumen/`)**: Validasi kelengkapan dokumen administrasi proyek (khusus role internal).
* **E-Materai (`client/materai/`)**: Pengelolaan dokumen bermaterai digital.

### 7. 🛠️ Utilities
* **User Log (`client/userlog/`)**: Halaman audit trail untuk melihat riwayat login dan aktivitas user (Eksklusif Head Office).
* **Instruksi Lapangan (`client/il/`)**: Pencatatan instruksi perubahan mendadak di lapangan.

---

## ⚙️ Configuration

Aplikasi ini menggunakan konfigurasi *hardcoded* untuk endpoint API. Jika Anda mengganti backend atau URL Apps Script, Anda wajib mengubah file berikut:

**Auth Config (`client/auth/script.js`)**:
    ```javascript
    const APPS_SCRIPT_POST_URL = "[https://script.google.com/macros/s/.../exec](https://script.google.com/macros/s/.../exec)";
    const PYTHON_API_LOGIN_URL = "[https://sparta-backend-5hdj.onrender.com/api/login](https://sparta-backend-5hdj.onrender.com/api/login)";
    ```
