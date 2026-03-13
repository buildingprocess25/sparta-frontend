# SPARTA Frontend 

**System for Property Administration, Reporting, Tracking & Approval - Building & Maintenance**

Merupakan program untuk mendigitalisasi proses bisnis yang ada pada Building & Maintenance (khususnya Building).

---

## Techstack

* **Frontend :** Vanilla JavaScript (ES6+), HTML5, CSS3
* **Backend Integration :** Python API & Google Apps Script
* **Platform :** Web Browser
* **Deployment :** Vercel

---

## Sistem & Fitur

Setiap fitur dalam SPARTA dibangun secara terisolasi di dalam direktori `client/` untuk menjaga kode tetap modular dan mudah di- *maintenance*.

### 1. Dashboard & Monitoring
* Paparan menu dinamik bergantung kepada peranan pengguna: *Manager, Coordinator, Support, dan Kontraktor*.

### 2. RAB & Dokumen Termaterai
* **RAB (Rencana Anggaran Biaya) :** Kalkulator otomatis untuk volume dan harga item pekerjaan untuk sipil maupun mekanikal/elektrikal.
* **Dokumen Termaterai :** Dokumen dari kontraktor yang sudah termaterai lalu diserahkan ke Manager.

### 3. RAB, SPK, & Tambah SPK
* **SPK (Surat Perintah Kerja) & Tambah SPK :** Surat perintah kerja untuk kontraktor dengan ditentukannya tanggal awal dan akhir.
* **Tambah SPK (Surat Perintah Kerja) :** Tambahn hari pekerjaan jika diperlukan dalam suatu pekerjaan.
* **Input PIC Pengawasan :** Manager memilih salah satu Support untuk mengawasi pekerjaan toko yang akan berjalan sesuai dengan hari yang ditentukan.
* **User Log (`userlog`):** Daftar akun/email yang akses aplikasi di hari itu.
  
### 4. Gantt Chart, Opname, & Instruksi Lapangan
* **Gantt Chart :** Visualisasi progress pekerjaan toko dan pemberitahuan kepada kontraktor jika ada kemungkinan keterlambatan pekerjaan.
* **Opname :** Laporan progress pekerjaan apakah sesuai dengan yang di lapangan dengan dokumentasi.
* **Instruksi Lapangan :** Form tambahan pekerjaan jika ada kekurangan pekerjaan di luar RAB yang sudah dibuat.

### 5. Penyimpan & Dokumentasi Bangunan Toko
* **Penyimpanan Dokumen Toko :** Upload dokumen pembangunan toko di setiap cabang.
* **Dokumentasi Bangunan Toko Baru :** Dokumentasi untuk setiap bangunan toko baru.

---

## Keamanan & Pembatasan Akses

Sistem SPARTA dilengkapi dengan keamanan dan pembatasan operasional:

* **Sistem Sesi (*Session Management*):** Menggunakan `sessionStorage` untuk menyimpan data peran (`userRole`) dan cabang pengguna. Sesi akan otomatis terhapus ketika browser ditutup.
* **Audit Logging:** Seluruh aktivitas login (sukses maupun gagal) akan dicatat dan dikirim ke Google Apps Script.
* **Pembatasan Akses Berbasis Waktu (*Gatekeeper*):** Sistem **hanya** dapat diakses pada jam operasional kerja:
    * **Hari:** Senin - Jumat
    * **Pukul:** 06:00 - 18:00 WIB
    * Akses di luar jadwal tersebut akan otomatis ditolak oleh sistem.

---

## 📂 Struktur Direktori Repositori

```text
sparta-frontend/
├── client/
│   ├── assets/        
│   ├── auth/           
│   ├── dashboard/      
│   ├── ftdokumen/      
│   ├── gantt/          
│   ├── il/             
│   ├── inputpic/       
│   ├── manual/         
│   ├── materai/        
│   ├── monitoring/     
│   ├── opname/         
│   ├── rab/            
│   ├── resend/         
│   ├── spk/            
│   ├── svdokumen/      
│   ├── tambahspk/      
│   ├── userlog/        
│   ├── index.html      
│   ├── script.js       
│   └── style.css       
└── README.md
```

---

## Konfigurasi API

Aplikasi ini menggunakan beberapa variabel *hardcoded* untuk berkomunikasi dengan *backend*. Untuk menjalankan sistem di *environment*, pastikan untuk menyesuaikan *endpoint* API pada file konfigurasi.

Buka file `client/auth/script.js` dan sesuaikan URL berikut:

```javascript
// Konfigurasi Endpoint Backend
const APPS_SCRIPT_POST_URL = "[https://script.google.com/macros/s/.../exec](https://script.google.com/macros/s/.../exec)"; // URL Google Apps Script Anda
const PYTHON_API_LOGIN_URL = "[https://sparta-be.onrender.com/api/login](https://sparta-backend-5hdj.onrender.com/api/login)";   // Base API URL Backend Python
