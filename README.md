SPARTA Frontend (System Documentation)
Project: SPARTA (Sistem Dokumentasi Bangunan Toko Baru - Alfamart)

Stack: Vanilla JavaScript (ES6+), CSS3, HTML5

Deployment: Vercel (Static Hosting)

📖 Overview
SPARTA Frontend adalah antarmuka berbasis web untuk manajemen proses pembangunan dan pemeliharaan toko. Aplikasi ini dirancang menggunakan Vanilla JavaScript murni untuk meminimalkan overhead dependensi, dengan fokus pada performa ringan dan kompatibilitas browser.

Aplikasi ini mencakup fitur autentikasi, manajemen hak akses berbasis peran (RBAC), dan pembatasan akses berdasarkan waktu operasional.

🛠 Tech Stack & Architecture
Core: HTML5, CSS3, Vanilla JS (No Framework).

State Management: sessionStorage untuk manajemen sesi user (Role, Cabang).

API Integration: fetch API ke Python Backend (Render) & Google Apps Script (Logging).

PWA: Mendukung Progressive Web App (via manifest.json).

🚀 Key Features & Business Logic
1. Time-Based Access Control (Landing Page)
Sistem menerapkan pembatasan akses ketat di sisi klien pada entry point.

Logic: User hanya bisa masuk ke halaman login jika waktu lokal menunjukkan:

Hari: Senin - Jumat (1-5).

Jam: 06:00 - 18:00 WIB.

Code Reference: client/script.js.

Note: Jika diakses di luar jam tersebut, user akan mendapatkan alert akses ditolak.

2. Authentication & Logging
Endpoint: Login melakukan POST ke Python Backend (/api/login).

Audit Log: Setiap percobaan login (baik sukses maupun gagal) dicatat ke Google Apps Script via POST request.

Session: Token/Role tidak disimpan di cookie, melainkan di sessionStorage:

userRole: Menentukan menu yang tampil.

loggedInUserCabang: Menentukan konteks lokasi (Head Office vs Cabang).

3. Role-Based Access Control (RBAC)
Dashboard merender menu secara dinamis berdasarkan userRole yang didapat saat login. Logic ini terdapat di client/dashboard/script.js.

Role Matrix: | Role | Akses Menu Utama | | :--- | :--- | | Branch Building & Maintenance Manager | SPK, Pengawasan, Opname, Tambah SPK, Gantt, Dok, SP | | Branch Building Coordinator | Dokumentasi, SV Dokumen, Gantt, Opname, SP | | Branch Building Support | Dokumentasi, Opname, Gantt, SV Dokumen, SP | | Kontraktor | RAB, Materai, Opname, Gantt |

Special Logic (Head Office):

Jika Cabang === 'HEAD OFFICE' DAN user bukan Kontraktor, menu User Log akan otomatis ditambahkan.

⚙️ Configuration & Environment
Saat ini, endpoint API masih hardcoded di dalam file client/auth/script.js.

JavaScript
// client/auth/script.js
const APPS_SCRIPT_POST_URL = "https://script.google.com/macros/s/.../exec";
const PYTHON_API_LOGIN_URL = "https://sparta-backend-5hdj.onrender.com/api/login";
Developer Note: Untuk scalability dan keamanan jangka panjang, disarankan memindahkan URL ini ke file konfigurasi terpisah atau environment variables jika beralih menggunakan bundler (Vite/Webpack) di masa depan.

📦 Installation & Development
Karena project ini menggunakan Vanilla JS, tidak ada proses build yang kompleks.

Clone Repository:

Bash
git clone <repository-url>
cd sparta-frontend
Run Locally: Gunakan ekstensi Live Server di VS Code atau jalankan simple python server:

Bash
# Dari root folder
python -m http.server 8000
Buka http://localhost:8000/client/ di browser.

Deployment: Project ini deployment-ready untuk platform static hosting seperti Vercel atau Netlify. Pastikan root directory diatur ke folder utama proyek.

🛡️ Security Considerations
Client-Side Enforcement: Validasi jam kerja dan penyembunyian menu saat ini dilakukan di sisi client (JavaScript).

Risk: User yang paham teknis bisa mem-bypass ini via Console/Network tools.

Recommendation: Pastikan Backend (Python) juga memvalidasi token dan hak akses pada setiap request API, bukan hanya mengandalkan frontend untuk keamanan.

Session Storage: Data sensitif sesi hilang saat tab ditutup (by design).
