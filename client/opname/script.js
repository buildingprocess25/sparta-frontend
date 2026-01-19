/* ======================== CONSTANTS & UTILS ======================== */
const API_BASE_URL = "https://opnamebnm-mgbe.onrender.com"; 
const INACTIVITY_LIMIT_MS = 60 * 60 * 1000; // 1 Jam

// Format Rupiah
const formatRupiah = (number) => {
    const numericValue = Number(number) || 0;
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(numericValue);
};

// Convert string/number to clean number
const toNumInput = (v) => {
    if (v === null || v === undefined) return 0;
    const s = String(v).trim().replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
};

const toNumID = (v) => {
    if (v === null || v === undefined) return 0;
    const s = String(v).trim();
    const cleaned = s.replace(/[^\d,.-]/g, "");
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
};

/* ======================== STATE MANAGEMENT ======================== */
const AppState = {
    user: null,
    loading: true,
    activeView: 'dashboard',
    selectedStore: null,
    selectedUlok: null,
    selectedLingkup: null,
    opnameItems: [],
    stores: [],
    uloks: [],
    idleTimer: null,
};

/* ======================== AUTH SYSTEM ======================== */
const Auth = {
    init: () => {
        const savedUser = sessionStorage.getItem("user");
        if (savedUser) {
            try {
                AppState.user = JSON.parse(savedUser);
                Auth.startIdleTimer();
            } catch {
                sessionStorage.removeItem("user");
            }
        }
        AppState.loading = false;
        Render.app();
    },

    login: async (username, password) => {
        try {
            const now = new Date();
            const wibTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
            const hour = wibTime.getHours();
            
            if (hour < 6 || hour >= 24) {
                const currentTime = wibTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
                throw new Error(`Sesi habis. Login 06.00–24.00 WIB. (Saat ini: ${currentTime})`);
            }

            const res = await fetch(`${API_BASE_URL}/api/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });
            const userData = await res.json();
            if (!res.ok) throw new Error(userData.message || "Login failed");

            AppState.user = userData;
            sessionStorage.setItem("user", JSON.stringify(userData));
            Auth.startIdleTimer();
            Render.app();
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    logout: () => {
        AppState.user = null;
        sessionStorage.removeItem("user");
        clearTimeout(AppState.idleTimer);
        AppState.activeView = 'dashboard';
        AppState.selectedStore = null;
        Render.app();
    },

    startIdleTimer: () => {
        clearTimeout(AppState.idleTimer);
        AppState.idleTimer = setTimeout(() => Auth.logout(), INACTIVITY_LIMIT_MS);
        window.onclick = () => { 
            if(AppState.user) { 
                clearTimeout(AppState.idleTimer); 
                AppState.idleTimer = setTimeout(() => Auth.logout(), INACTIVITY_LIMIT_MS); 
            }
        };
    }
};

/* ======================== PDF GENERATOR (Placeholder) ======================== */
const PDFGenerator = {
    generateFinalOpnamePDF: (items, store, ulok, lingkup, user) => {
        if (!window.jspdf) { alert("Library PDF belum dimuat. Pastikan internet aktif."); return; }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(16);
        doc.text("BERITA ACARA OPNAME PEKERJAAN", 105, 15, { align: "center" });
        
        doc.setFontSize(10);
        doc.text(`Toko: ${store.nama_toko} (${store.kode_toko})`, 14, 25);
        doc.text(`No. ULOK: ${ulok}`, 14, 30);
        doc.text(`Lingkup: ${lingkup}`, 14, 35);
        doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString("id-ID")}`, 14, 40);

        // Table Data
        const tableData = items.map((item, index) => [
            index + 1,
            item.jenis_pekerjaan,
            item.satuan,
            item.vol_rab,
            item.volume_akhir,
            formatRupiah(item.total_harga)
        ]);

        const totalBiaya = items.reduce((sum, i) => sum + (i.total_harga || 0), 0);
        const ppn = totalBiaya * 0.11;
        const grandTotal = totalBiaya * 1.11;

        doc.autoTable({
            startY: 45,
            head: [['No', 'Uraian Pekerjaan', 'Sat', 'Vol RAB', 'Vol Real', 'Total Harga']],
            body: tableData,
            foot: [
                ['', '', '', '', 'Total', formatRupiah(totalBiaya)],
                ['', '', '', '', 'PPN 11%', formatRupiah(ppn)],
                ['', '', '', '', 'Grand Total', formatRupiah(grandTotal)]
            ],
            theme: 'grid',
            headStyles: { fillColor: [214, 40, 40] } // Merah Alfamart
        });

        // Signatures
        const finalY = doc.lastAutoTable.finalY + 20;
        doc.text("Dibuat Oleh,", 40, finalY, { align: "center" });
        doc.text("Disetujui Oleh,", 160, finalY, { align: "center" });
        
        doc.text(`( ${user.name || user.username} )`, 40, finalY + 25, { align: "center" });
        doc.text("( Kontraktor )", 160, finalY + 25, { align: "center" });
        doc.text("PIC Store", 40, finalY + 30, { align: "center" });

        doc.save(`Opname_Final_${store.kode_toko}_${ulok}.pdf`);
    }
};

/* ======================== RENDERER (VIEW CONTROLLER) ======================== */
const Render = {
    app: () => {
        const app = document.getElementById('app');
        app.innerHTML = '';

        if (AppState.loading) {
            app.innerHTML = `
                <div class="loading-screen">
                    <div style="font-size: 48px; margin-bottom: 16px;">🏪</div>
                    <h2 style="color: var(--primary);">Memuat Data...</h2>
                </div>`;
            return;
        }

        if (!AppState.user) {
            Render.login(app);
            return;
        }

        app.appendChild(Render.header());
        app.appendChild(Render.userInfo());

        const contentDiv = document.createElement('div');
        contentDiv.id = 'main-content';
        app.appendChild(contentDiv);

        switch (AppState.activeView) {
            case 'dashboard': Render.dashboard(contentDiv); break;
            case 'store-selection-pic': Render.storeSelection(contentDiv, 'opname'); break;
            case 'opname': Render.opnameForm(contentDiv); break;
            case 'final-opname-selection': Render.storeSelection(contentDiv, 'final-opname'); break;
            case 'final-opname-detail': Render.finalOpnameView(contentDiv); break;
            case 'store-selection-kontraktor': Render.storeSelection(contentDiv, 'approval'); break;
            case 'approval-detail': Render.approvalDetail(contentDiv, "Halaman Approval"); break;
            case 'history-selection-kontraktor': Render.storeSelection(contentDiv, 'history'); break;
            case 'history-detail-kontraktor': Render.finalOpnameView(contentDiv); break;
            default: Render.dashboard(contentDiv);
        }
    },

    // --- UPDATED HEADER ---
    header: () => {
        const header = document.createElement('header');
        header.className = 'app-header';
        header.innerHTML = `
            <img src="../../assets/Alfamart-Emblem.png" alt="Alfamart" class="header-logo" onerror="this.style.display='none'; this.parentElement.insertAdjacentHTML('afterbegin', '<b style=\\'position:absolute;left:20px;color:white\\'>ALFAMART</b>')">
            <div style="text-align:center;">
                <h1>Opname</h1>
            </div>
            <button class="header-logout" id="btn-logout">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
                <span>Keluar</span>
            </button>
        `;
        header.querySelector('#btn-logout').onclick = () => Auth.logout();
        return header;
    },

    userInfo: () => {
        const wrapper = document.createElement('div');
        wrapper.className = 'user-greeting-wrapper';
        const roleDisplay = AppState.user.role === 'pic' ? 'PIC' : 'Kontraktor';
        wrapper.innerHTML = `
            <div class="user-info">
                Semangat Pagi, ${AppState.user.username} | ${roleDisplay}
            </div>
        `;
        return wrapper;
    },

    login: (container) => {
        // SVG Icons
        const eyeOpen = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>`;
            
        const eyeClosed = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L6.228 6.228" />
            </svg>`;

        container.innerHTML = `
            <div class="login-wrapper">
                <div class="login-card">
                    <a href="https://sparta-alfamart.vercel.app/dashboard/index.html" class="btn-back-link">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12"></line>
                            <polyline points="12 19 5 12 12 5"></polyline>
                        </svg>
                        <span>Kembali</span>
                    </a>

                    <div class="login-header">
                        <img src="../../assets/Alfamart-Emblem.png" alt="Logo Alfamart" style="height: 50px; margin-bottom: 1rem;">
                        <h1>Building & Maintenance</h1>
                        <h3>Opname</h3>
                    </div>

                    <div id="login-error" class="alert-error" style="display:none;"></div>

                    <form id="login-form">
                        <div class="form-group-custom">
                            <label for="username">Username / Email</label>
                            <input type="text" id="username" class="input-custom" placeholder="Masukkan email Anda" required>
                        </div>
                        <div class="form-group-custom">
                            <label for="password">Password</label>
                            <div class="password-wrapper">
                                <input type="password" id="password" class="input-custom" placeholder="Masukkan kata sandi Anda" required>
                                <button type="button" class="toggle-password-btn" id="toggle-pw" title="Lihat password">
                                    ${eyeOpen}
                                </button>
                            </div>
                        </div>
                        <button type="submit" class="btn-submit-custom">Login</button>
                    </form>
                </div>
            </div>
        `;

        const form = document.getElementById('login-form');
        const pwInput = document.getElementById('password');
        const toggleBtn = document.getElementById('toggle-pw');

        // Logic Toggle Password dengan update Icon
        toggleBtn.onclick = () => {
            const isPassword = pwInput.type === 'password';
            pwInput.type = isPassword ? 'text' : 'password';
            toggleBtn.innerHTML = isPassword ? eyeClosed : eyeOpen;
            toggleBtn.title = isPassword ? "Sembunyikan password" : "Lihat password";
        };

        // Logic Submit (Tetap Sama)
        form.onsubmit = async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            const errDiv = document.getElementById('login-error');
            
            btn.disabled = true; 
            btn.innerHTML = "Loading...";
            errDiv.style.display = 'none';

            const result = await Auth.login(document.getElementById('username').value, pwInput.value);
            if (!result.success) {
                errDiv.innerText = result.message;
                errDiv.style.display = 'block';
                btn.disabled = false;
                btn.innerText = "Login";
            }
        };
    },

    dashboard: (container) => {
        const role = AppState.user.role;
        let buttons = '';

        if (role === 'pic') {
            buttons = `
                <button onclick="AppState.activeView='store-selection-pic'; Render.app()" class="btn btn-primary d-flex flex-column align-center justify-center" style="height:140px; font-size:1.1rem; gap:12px;">
                    <span style="font-size:36px">📝</span> 
                    <span>Input Opname Harian</span>
                </button>
                <button onclick="AppState.activeView='final-opname-selection'; Render.app()" class="btn btn-success d-flex flex-column align-center justify-center" style="height:140px; font-size:1.1rem; gap:12px;">
                    <span style="font-size:36px">✅</span> 
                    <span>Lihat Opname Final</span>
                </button>
            `;
        } else if (role === 'kontraktor') {
            buttons = `
                <button onclick="AppState.activeView='store-selection-kontraktor'; Render.app()" class="btn btn-info d-flex flex-column align-center justify-center" style="height:140px; font-size:1.1rem; gap:12px;">
                    <span style="font-size:36px">🔔</span> 
                    <span>Persetujuan Opname</span>
                </button>
                <button onclick="AppState.activeView='history-selection-kontraktor'; Render.app()" class="btn btn-secondary d-flex flex-column align-center justify-center" style="height:140px; font-size:1.1rem; gap:12px;">
                    <span style="font-size:36px">📂</span> 
                    <span>Histori Opname</span>
                </button>
            `;
        }

        container.innerHTML = `
            <div class="container" style="padding-top:40px;">
                <div class="card text-center" style="max-width:800px; margin:0 auto;">
                    <h2 style="color:var(--primary); margin-bottom:10px;">Selamat Datang, ${AppState.user.kontraktor_username || AppState.user.name || AppState.user.username}!</h2>
                    <p style="color:var(--text-muted); margin-bottom:30px;">Silakan pilih menu di bawah ini untuk memulai.</p>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;">
                        ${buttons}
                    </div>
                </div>
            </div>
        `;
    },

    storeSelection: async (container, type) => {
        container.innerHTML = '<div class="container text-center" style="padding-top:40px;"><div class="card"><h3>Sedang memuat data toko...</h3></div></div>';

        let url = "";
        const u = AppState.user;
        if ((type === 'opname' || type === 'final-opname') && u.role === 'pic') url = `${API_BASE_URL}/api/toko?username=${u.username}`;
        else if (u.role === 'kontraktor') url = `${API_BASE_URL}/api/toko_kontraktor?username=${u.username}`;

        try {
            const res = await fetch(url);
            AppState.stores = await res.json();
            if(!Array.isArray(AppState.stores)) AppState.stores = [];
        } catch (e) {
            AppState.stores = [];
        }

        const renderList = (filter = "") => {
            const filtered = AppState.stores.filter(s => 
                s.kode_toko.toLowerCase().includes(filter.toLowerCase()) || 
                s.nama_toko.toLowerCase().includes(filter.toLowerCase())
            );

            let html = `
                <div class="container" style="padding-top:20px;">
                    <div class="card">
                        <div class="d-flex align-center gap-2" style="margin-bottom:24px; border-bottom:1px solid #eee; padding-bottom:16px;">
                            <button id="btn-back-store" class="btn btn-back">← Dashboard</button>
                            <h2 style="color:var(--primary);">Pilih Toko (${type === 'opname' ? 'Input' : 'View'})</h2>
                        </div>
                        
                        <div style="margin-bottom:24px;">
                            <input type="text" id="store-search" class="form-input" placeholder="🔍 Cari Kode atau Nama Toko..." value="${filter}">
                        </div>
                        
                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap:16px;">
                            ${filtered.map(toko => `
                                <button class="btn btn-secondary store-item" data-kode="${toko.kode_toko}" style="height:auto; min-height:100px; flex-direction:column; align-items:flex-start; text-align:left; padding:16px; border-left:4px solid var(--secondary-yellow);">
                                    <div style="font-size:1.1rem; font-weight:700; color:var(--neutral-700);">${toko.nama_toko}</div>
                                    <div style="font-size:0.9rem; color:var(--text-muted);">Kode: <strong>${toko.kode_toko}</strong></div>
                                </button>
                            `).join('')}
                        </div>
                        ${filtered.length === 0 ? '<p class="text-center" style="padding:20px;">Toko tidak ditemukan.</p>' : ''}
                    </div>
                </div>
            `;
            container.innerHTML = html;

            container.querySelector('#btn-back-store').onclick = () => { AppState.activeView = 'dashboard'; Render.app(); };
            const searchInput = document.getElementById('store-search');
            searchInput.oninput = (e) => { renderList(e.target.value); document.getElementById('store-search').focus(); };

            container.querySelectorAll('.store-item').forEach(btn => {
                btn.onclick = () => {
                    AppState.selectedStore = AppState.stores.find(s => s.kode_toko === btn.dataset.kode);
                    if(type === 'opname') AppState.activeView = 'opname';
                    else if(type === 'final-opname') AppState.activeView = 'final-opname-detail';
                    else if(type === 'approval') AppState.activeView = 'approval-detail';
                    else if(type === 'history') AppState.activeView = 'history-detail-kontraktor';
                    
                    AppState.selectedUlok = null;
                    AppState.selectedLingkup = null;
                    Render.app();
                };
            });
        };
        renderList();
    },

    opnameForm: async (container) => {
        // 1. Cek Data ULOK (Tidak berubah)
        if (!AppState.selectedUlok) {
            // ... (kode existing untuk cek ULOK)
            container.innerHTML = '<div class="container text-center" style="padding-top:40px;"><div class="card"><h3>Memuat Data ULOK...</h3></div></div>';
            try {
                const res = await fetch(`${API_BASE_URL}/api/uloks?kode_toko=${AppState.selectedStore.kode_toko}`);
                const data = await res.json();
                AppState.uloks = data;

                if (data.length === 1) {
                    AppState.selectedUlok = data[0];
                    Render.opnameForm(container);
                    return;
                }
                // ... (render pilihan ulok, kode existing)
                container.innerHTML = `
                    <div class="container" style="padding-top:20px;">
                        <div class="card">
                            <button id="btn-back-ulok" class="btn btn-back" style="margin-bottom:15px;">Kembali</button>
                            <h2 style="margin-bottom:20px;">Pilih Nomor ULOK</h2>
                            <div class="d-flex flex-column gap-2">
                                ${AppState.uloks.map(u => `<button class="btn btn-secondary ulok-btn" data-ulok="${u}" style="justify-content:flex-start;">📄 ${u}</button>`).join('')}
                            </div>
                        </div>
                    </div>
                `;
                container.querySelector('#btn-back-ulok').onclick = () => { AppState.activeView = 'store-selection-pic'; Render.app(); };
                container.querySelectorAll('.ulok-btn').forEach(b => {
                    b.onclick = () => { AppState.selectedUlok = b.dataset.ulok; Render.opnameForm(container); }
                });
            } catch (e) { container.innerHTML = `<div class="container"><div class="alert-error">Gagal memuat ULOK: ${e.message}</div></div>`; }
            return;
        }

        // 2. Cek Data Lingkup (Tidak berubah)
        if (!AppState.selectedLingkup) {
            // ... (kode existing untuk cek lingkup)
             container.innerHTML = `
                <div class="container" style="padding-top:40px;">
                    <div class="card text-center" style="max-width:600px; margin:0 auto;">
                        <h2 style="color:var(--primary);">Pilih Lingkup Pekerjaan</h2>
                        <div class="badge badge-success" style="margin:10px auto; display:inline-block;">ULOK: ${AppState.selectedUlok}</div>
                        
                        <div class="d-flex justify-center gap-2" style="margin-top:30px; margin-bottom:30px;">
                            <button class="btn btn-primary" id="btn-sipil" style="min-width:120px;">SIPIL</button>
                            <button class="btn btn-info" id="btn-me" style="min-width:120px;">ME</button>
                        </div>
                        <button class="btn btn-back" id="btn-cancel-lingkup">Batal / Kembali</button>
                    </div>
                </div>
            `;
            container.querySelector('#btn-sipil').onclick = () => { AppState.selectedLingkup = 'SIPIL'; Render.opnameForm(container); };
            container.querySelector('#btn-me').onclick = () => { AppState.selectedLingkup = 'ME'; Render.opnameForm(container); };
            container.querySelector('#btn-cancel-lingkup').onclick = () => { AppState.selectedUlok = null; Render.opnameForm(container); };
            return;
        }

        container.innerHTML = '<div class="container text-center" style="padding-top:40px;"><div class="card"><h3>Memuat Detail Opname...</h3></div></div>';
        
        try {
            // 3. Fetch Data Opname Items (Menggunakan API_BASE_URL default)
            const base = `${API_BASE_URL}/api/opname?kode_toko=${encodeURIComponent(AppState.selectedStore.kode_toko)}&no_ulok=${encodeURIComponent(AppState.selectedUlok)}&lingkup=${encodeURIComponent(AppState.selectedLingkup)}`;
            const res = await fetch(base);
            let data = await res.json();
            
            AppState.opnameItems = data.map((task, index) => {
                const volRab = toNumInput(task.vol_rab);
                const volAkhirNum = toNumInput(task.volume_akhir);
                const hargaMaterial = toNumID(task.harga_material);
                const hargaUpah = toNumID(task.harga_upah);
                const total_harga = volAkhirNum * (hargaMaterial + hargaUpah);
                
                const alreadySubmitted = task.isSubmitted === true || !!task.item_id || ["PENDING", "APPROVED", "REJECTED"].includes(String(task.approval_status || "").toUpperCase());
                
                return { 
                    ...task, 
                    id: index + 1, 
                    harga_material: hargaMaterial, 
                    harga_upah: hargaUpah, 
                    isSubmitted: alreadySubmitted, 
                    volume_akhir: alreadySubmitted ? String(volAkhirNum) : "", 
                    selisih: (Math.round((volAkhirNum - volRab + Number.EPSILON) * 100) / 100).toFixed(2), 
                    total_harga,
                    approval_status: task.approval_status || (alreadySubmitted ? "Pending" : "")
                };
            });

            // 4. Fetch Status Opname Final (PERBAIKAN UTAMA DI SINI)
            let isFinalized = false;
            let canFinalize = false;
            let statusMessage = "Menunggu Approval Semua Item";

            try {
                // UPDATE: Menggunakan URL spesifik 'sparta-backend-5hdj' sesuai repo React
                // karena endpoint ini mungkin belum ada di API_BASE_URL (opnamebnm-mgbe)
                const checkUrl = `https://sparta-backend-5hdj.onrender.com/api/check_status_item_opname?no_ulok=${AppState.selectedUlok}&lingkup_pekerjaan=${AppState.selectedLingkup}`;
                
                const statusRes = await fetch(checkUrl);
                const statusData = await statusRes.json();

                if (statusData.status === "approved") {
                    if (statusData.tanggal_opname_final) {
                        isFinalized = true;
                        canFinalize = false;
                        statusMessage = "Opname Selesai (Final)";
                    } else {
                        isFinalized = false;
                        canFinalize = true;
                        statusMessage = "Opname Final";
                    }
                } else {
                    // Masih ada yang pending atau belum approved semua
                    canFinalize = false;
                    statusMessage = "Menunggu Approval Semua Item";
                }
            } catch (err) {
                console.warn("Gagal cek status final:", err);
            }

            const renderTable = () => {
                const items = AppState.opnameItems;
                const totalVal = items.reduce((sum, i) => sum + (i.total_harga || 0), 0);
                const ppn = totalVal * 0.11;
                const grandTotal = totalVal * 1.11;

                // Tentukan warna tombol dan status disabled
                let btnColor = '#6c757d'; // Default Grey
                if (isFinalized) btnColor = '#28a745'; // Green
                else if (canFinalize) btnColor = '#007bff'; // Blue

                let html = `
                <div class="container" style="padding-top:20px;">
                    <div class="card">
                        <div class="d-flex align-center gap-2" style="margin-bottom:20px; border-bottom:1px solid #eee; padding-bottom:15px;">
                            <button id="btn-back-main" class="btn btn-back">← Kembali</button>
                            <div>
                                <h2 style="color:var(--primary); margin:0;">Input Opname: ${AppState.selectedLingkup}</h2>
                                <span style="font-size:0.9rem; color:#64748b;">${AppState.selectedStore.nama_toko} (ULOK: ${AppState.selectedUlok})</span>
                            </div>
                        </div>

                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr style="background:var(--primary); color:white;">
                                        <th style="color:white;">Pekerjaan</th>
                                        <th class="text-center" style="color:white;" width="60">RAB</th>
                                        <th class="text-center" style="color:white;" width="50">Sat</th>
                                        <th class="text-center" style="color:white;" width="90">Akhir</th>
                                        <th class="text-center" style="color:white;" width="80">Selisih</th>
                                        <th class="text-right" style="color:white;" width="140">Total (Rp)</th>
                                        <th class="text-center" style="color:white;" width="80">Foto</th>
                                        <th class="text-center" style="color:white;" width="90">Status</th>
                                        <th class="text-center" style="color:white;" width="90">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${items.map(item => {
                                        let statusColor = "white";
                                        const st = (item.approval_status || "").toUpperCase();
                                        if(st === 'REJECTED') statusColor = "#ffe5e5";
                                        else if(item.isSubmitted) statusColor = "#f0fdf4";

                                        return `
                                        <tr style="background:${statusColor}">
                                            <td>
                                                <div style="font-size:0.8rem; color:#64748b; font-weight:600;">${item.kategori_pekerjaan}</div>
                                                ${item.jenis_pekerjaan}
                                            </td>
                                            <td class="text-center">${item.vol_rab}</td>
                                            <td class="text-center">${item.satuan}</td>
                                            <td class="text-center">
                                                <input type="number" class="form-input vol-input" data-id="${item.id}" value="${item.volume_akhir}" 
                                                style="padding:6px; text-align:center; width:70px;" ${item.isSubmitted ? 'disabled' : ''}>
                                            </td>
                                            <td class="text-center font-bold" style="color:${parseFloat(item.selisih) < 0 ? 'red' : 'green'};">
                                                ${item.selisih || '-'}
                                            </td>
                                            <td class="text-right font-bold" style="color:${item.total_harga < 0 ? 'red' : 'var(--primary)'};" id="total-${item.id}">
                                                ${formatRupiah(item.total_harga)}
                                            </td>
                                            <td class="text-center">
                                                ${item.foto_url ? `<a href="${item.foto_url}" target="_blank" class="btn btn-outline" style="padding:4px 8px; font-size:12px;">Lihat</a>` : 
                                                    `<input type="file" class="file-input" data-id="${item.id}" id="file-${item.id}" style="display:none;">
                                                    <label for="file-${item.id}" class="btn btn-secondary" style="padding:4px 8px; font-size:12px; cursor:pointer;">Upload</label>`
                                                }
                                            </td>
                                            <td class="text-center">
                                                <span class="badge ${st === 'APPROVED' ? 'badge-success' : st === 'REJECTED' ? 'badge-error' : st === 'PENDING' ? 'badge-warning' : ''}" style="font-size:10px;">${item.approval_status || '-'}</span>
                                            </td>
                                            <td class="text-center">
                                                ${st === 'REJECTED' ? 
                                                    `<button class="btn btn-info perbaiki-btn" data-id="${item.id}" style="padding:6px 12px; font-size:0.8rem; background-color:orange; border:none;">Perbaiki</button>` :
                                                    item.isSubmitted ? 
                                                    `<span style="color:green; font-size:0.8rem; font-weight:bold;">Tersimpan</span>` : 
                                                    `<button class="btn btn-primary save-btn" style="padding:6px 12px; font-size:0.85rem;" data-id="${item.id}">Simpan</button>`
                                                }
                                            </td>
                                        </tr>
                                    `}).join('')}
                                </tbody>
                            </table>
                        </div>
                        
                        <div style="margin-top: 20px; margin-bottom: 0px;">
                            <a href="https://instruksi-lapangan.vercel.app/" target="_blank" rel="noopener noreferrer" class="btn" 
                            style="width: 100%; background-color: #FFC107; font-weight: bold; color: #000; text-decoration: none; display: block; text-align: center; padding: 12px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                INSTRUKSI LAPANGAN
                            </a>
                        </div>
                        <div style="background:#f8fafc; padding:20px; border-radius:12px; margin-top:20px; border:1px solid #e2e8f0;">
                            <h4 style="margin-bottom:15px; border-bottom:1px solid #e2e8f0; padding-bottom:5px;">Ringkasan Biaya</h4>
                            <div class="d-flex" style="justify-content:space-between; margin-bottom:8px;"><span>Total Keseluruhan:</span> <b>${formatRupiah(totalVal)}</b></div>
                            <div class="d-flex" style="justify-content:space-between; margin-bottom:8px;"><span>PPN 11%:</span> <b>${formatRupiah(ppn)}</b></div>
                            <div class="d-flex" style="justify-content:space-between; font-size:1.2rem; color:var(--primary); margin-top:10px; padding-top:10px; border-top:2px dashed #e2e8f0;">
                                <span>GRAND TOTAL:</span> <b>${formatRupiah(grandTotal)}</b>
                            </div>
                        </div>

                        <div style="margin-top: 20px;">
                            <button id="btn-final" class="btn" style="width:100%; padding:14px; font-size:1.1rem; font-weight:bold; border:none; box-shadow:0 4px 6px rgba(0,0,0,0.1); 
                                background-color: ${btnColor}; color: white; cursor: ${(!canFinalize || isFinalized) ? 'not-allowed' : 'pointer'};" 
                                ${(!canFinalize || isFinalized) ? 'disabled' : ''}>
                                ${statusMessage}
                            </button>
                            ${!canFinalize && !isFinalized ? '<p style="text-align:center; color:#dc3545; font-size:0.85rem; margin-top:8px;">*Pastikan semua pekerjaan berstatus APPROVED untuk melakukan Opname Final.</p>' : ''}
                        </div>
                    </div>
                </div>
                `;
                container.innerHTML = html;
                
                // Event Handlers
                container.querySelector('#btn-back-main').onclick = () => { AppState.selectedLingkup = null; Render.opnameForm(container); };
                
                // Handle Volume Change
                container.querySelectorAll('.vol-input').forEach(input => {
                    input.oninput = (e) => {
                        const id = parseInt(e.target.dataset.id);
                        const val = e.target.value;
                        const item = AppState.opnameItems.find(i => i.id === id);
                        item.volume_akhir = val;
                        const volAkhir = toNumInput(val);
                        const volRab = toNumInput(item.vol_rab);
                        item.selisih = (volAkhir - volRab).toFixed(2);
                        item.total_harga = (volAkhir - volRab) * (item.harga_material + item.harga_upah);
                        
                        // Update angka di tabel secara langsung tanpa re-render penuh agar fokus tidak hilang
                        const totalEl = document.getElementById(`total-${id}`);
                        if(totalEl) {
                            totalEl.innerText = formatRupiah(item.total_harga);
                            totalEl.style.color = item.total_harga < 0 ? 'red' : 'var(--primary)';
                        }
                        // Update Summary di bawah
                        renderSummaryOnly(items);
                    }
                });
                const renderSummaryOnly = (items) => {
                    // (Opsional) Implementasi update DOM elemen summary jika diperlukan real-time yang mulus
                    // Karena ini versi simple, kita biarkan saja atau panggil renderTable() jika tidak masalah dengan fokus input.
                    // Di sini saya skip untuk kesederhanaan, data tersimpan di variable `items`.
                };
                container.querySelectorAll('.save-btn').forEach(btn => {
                    btn.onclick = async () => {
                        const id = parseInt(btn.dataset.id);
                        const item = AppState.opnameItems.find(i => i.id === id);
                        
                        if (!item.volume_akhir) { alert("Volume akhir harus diisi!"); return; }
                        
                        btn.innerText = "...";
                        btn.disabled = true;

                        try {
                                const payload = {
                                    kode_toko: AppState.selectedStore.kode_toko,
                                    nama_toko: AppState.selectedStore.nama_toko,
                                    pic_username: AppState.user.username,
                                    no_ulok: AppState.selectedUlok,
                                    kategori_pekerjaan: item.kategori_pekerjaan,
                                    jenis_pekerjaan: item.jenis_pekerjaan,
                                    vol_rab: item.vol_rab,
                                    satuan: item.satuan,
                                    volume_akhir: item.volume_akhir,
                                    selisih: item.selisih,
                                    foto_url: item.foto_url,
                                    harga_material: item.harga_material,
                                    harga_upah: item.harga_upah,
                                    total_harga_akhir: item.total_harga,
                                    lingkup_pekerjaan: AppState.selectedLingkup,
                                    is_il: item.is_il
                                };
                                const res = await fetch(`${API_BASE_URL}/api/opname/item/submit`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify(payload)
                                });
                            if(!res.ok) throw new Error("Gagal menyimpan");
                            item.isSubmitted = true;
                            item.approval_status = "Pending";
                            renderTable(); // Refresh UI
                        } catch (e) {
                            alert(e.message);
                            btn.innerText = "Simpan";
                            btn.disabled = false;
                        }
                    }
                });

                // Handle Opname Final Click (PERBAIKAN: Gunakan URL React Repo)
                if(canFinalize && !isFinalized) {
                    const btnFinal = container.querySelector('#btn-final');
                    btnFinal.onclick = async () => {
                        if (!confirm("Apakah Anda yakin ingin melakukan Opname Final?Tindakan ini tidak dapat dibatalkan.")) return;
                        
                        btnFinal.innerText = "Memproses...";
                        btnFinal.disabled = true;

                        try {
                            const payload = {
                                status: "locked",
                                ulok: AppState.selectedUlok,
                                lingkup_pekerjaan: AppState.selectedLingkup,
                            };
                            
                            // UPDATE: URL endpoint ke sparta-backend-5hdj
                            const res = await fetch(`https://sparta-backend-5hdj.onrender.com/api/opname_locked`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(payload),
                            });

                            const result = await res.json();
                            if (res.ok) {
                                alert("Opname berhasil difinalisasi!");
                                isFinalized = true;
                                canFinalize = false;
                                Render.opnameForm(container); // Reload page state
                            } else {
                                alert(`Gagal finalisasi: ${result.message}`);
                                btnFinal.innerText = "Opname Final";
                                btnFinal.disabled = false;
                            }
                        } catch (e) {
                            alert(`Error: ${e.message}`);
                            btnFinal.innerText = "Opname Final";
                            btnFinal.disabled = false;
                        }
                    };
                }
            };
            renderTable();
        } catch (e) {
            container.innerHTML = `<div class="container"><div class="alert-error">Error: ${e.message}</div><button class="btn btn-back" onclick="Render.app()">Kembali</button></div>`;
        }
    },

    finalOpnameView: async (container) => {
        // --- STEP 1: PILIH ULOK (Sama seperti Input Opname) ---
        if (!AppState.selectedUlok) {
            container.innerHTML = '<div class="container text-center" style="padding-top:40px;"><div class="card"><h3>Memuat Data ULOK...</h3></div></div>';
            try {
                const res = await fetch(`${API_BASE_URL}/api/uloks?kode_toko=${AppState.selectedStore.kode_toko}`);
                const data = await res.json();
                AppState.uloks = data;

                if (data.length === 1) {
                    AppState.selectedUlok = data[0];
                    Render.finalOpnameView(container);
                    return;
                }
                
                container.innerHTML = `
                    <div class="container" style="padding-top:20px;">
                        <div class="card">
                            <button id="btn-back-ulok-final" class="btn btn-back" style="margin-bottom:15px;">Kembali</button>
                            <h2 style="margin-bottom:20px;">Pilih Nomor ULOK (Final View)</h2>
                            <div class="d-flex flex-column gap-2">
                                ${AppState.uloks.map(u => `<button class="btn btn-secondary ulok-btn" data-ulok="${u}" style="justify-content:flex-start;">📄 ${u}</button>`).join('')}
                            </div>
                        </div>
                    </div>
                `;
                container.querySelector('#btn-back-ulok-final').onclick = () => { AppState.activeView = 'dashboard'; Render.app(); };
                container.querySelectorAll('.ulok-btn').forEach(b => {
                    b.onclick = () => { AppState.selectedUlok = b.dataset.ulok; Render.finalOpnameView(container); }
                });
            } catch (e) { container.innerHTML = `<div class="container"><div class="alert-error">Gagal memuat ULOK: ${e.message}</div></div>`; }
            return;
        }

        // --- STEP 2: PILIH LINGKUP ---
        if (!AppState.selectedLingkup) {
            container.innerHTML = `
                <div class="container" style="padding-top:40px;">
                    <div class="card text-center" style="max-width:600px; margin:0 auto;">
                        <h2 style="color:var(--primary);">Pilih Lingkup Laporan</h2>
                        <div class="badge badge-success" style="margin:10px auto; display:inline-block;">ULOK: ${AppState.selectedUlok}</div>
                        <p style="color:#666; margin-bottom:20px;">Pilih lingkup pekerjaan yang ingin dilihat laporan finalnya.</p>
                        
                        <div class="d-flex justify-center gap-2" style="margin-top:30px; margin-bottom:30px;">
                            <button class="btn btn-primary" id="btn-sipil-final" style="min-width:120px;">SIPIL</button>
                            <button class="btn btn-info" id="btn-me-final" style="min-width:120px;">ME</button>
                        </div>
                        <button class="btn btn-back" id="btn-cancel-lingkup-final">Ganti ULOK</button>
                    </div>
                </div>
            `;
            container.querySelector('#btn-sipil-final').onclick = () => { AppState.selectedLingkup = 'SIPIL'; Render.finalOpnameView(container); };
            container.querySelector('#btn-me-final').onclick = () => { AppState.selectedLingkup = 'ME'; Render.finalOpnameView(container); };
            container.querySelector('#btn-cancel-lingkup-final').onclick = () => { AppState.selectedUlok = null; Render.finalOpnameView(container); };
            return;
        }

        // --- STEP 3: FETCH DATA FINAL & RENDER ---
        container.innerHTML = '<div class="container text-center" style="padding-top:40px;"><div class="card"><h3>Memuat Data Final...</h3></div></div>';
        
        try {
            // 1. Cek Status Final di Backend Sparta
            const statusUrl = `https://sparta-backend-5hdj.onrender.com/api/check_status_item_opname?no_ulok=${AppState.selectedUlok}&lingkup_pekerjaan=${AppState.selectedLingkup}`;
            const statusRes = await fetch(statusUrl);
            const statusData = await statusRes.json();
            
            // Logic: Hanya tampilkan jika sudah ada tanggal_opname_final (artinya sudah dikunci)
            const isOfficiallyFinal = statusData.status === "approved" && statusData.tanggal_opname_final;

            if (!isOfficiallyFinal) {
                container.innerHTML = `
                    <div class="container" style="padding-top:40px;">
                        <div class="card text-center">
                            <div style="font-size:50px; margin-bottom:20px;">⚠️</div>
                            <h2 style="color:orange;">Belum Final</h2>
                            <p>Opname untuk <b>${AppState.selectedLingkup}</b> di ULOK ini belum dilakukan <b>Opname Final</b>.</p>
                            <p>Silakan selesaikan input dan approval, lalu klik tombol "Opname Final" di menu Input Opname.</p>
                            <br>
                            <button class="btn btn-back" id="btn-back-notfinal">Kembali</button>
                        </div>
                    </div>
                `;
                container.querySelector('#btn-back-notfinal').onclick = () => { AppState.selectedLingkup = null; Render.finalOpnameView(container); };
                return;
            }

            // 2. Fetch Item Opname
            const itemsUrl = `${API_BASE_URL}/api/opname?kode_toko=${encodeURIComponent(AppState.selectedStore.kode_toko)}&no_ulok=${encodeURIComponent(AppState.selectedUlok)}&lingkup=${encodeURIComponent(AppState.selectedLingkup)}`;
            const res = await fetch(itemsUrl);
            const rawData = await res.json();
            
            const items = rawData.map((task, index) => {
                const volAkhirNum = toNumInput(task.volume_akhir);
                const hargaMaterial = toNumID(task.harga_material);
                const hargaUpah = toNumID(task.harga_upah);
                const total_harga = volAkhirNum * (hargaMaterial + hargaUpah);
                return { ...task, total_harga, vol_akhir_num: volAkhirNum, harga_satuan: hargaMaterial + hargaUpah };
            });

            // Hitung Grand Total
            const totalBiaya = items.reduce((sum, i) => sum + i.total_harga, 0);
            const ppn = totalBiaya * 0.11;
            const grandTotal = totalBiaya * 1.11;

            // Render UI
            const html = `
                <div class="container" style="padding-top:20px;">
                    <div class="card">
                        <div class="d-flex align-center gap-2" style="margin-bottom:20px; border-bottom:2px solid #eee; padding-bottom:15px;">
                            <button id="btn-back-final-view" class="btn btn-back">← Dashboard</button>
                            <div style="flex:1; text-align:right;">
                                <h2 style="color:var(--primary); margin:0;">BERITA ACARA OPNAME</h2>
                                <span class="badge badge-success">STATUS: FINAL / LOCKED</span>
                            </div>
                        </div>

                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:20px; background:#f8fafc; padding:15px; border-radius:8px;">
                            <div>
                                <small style="color:#64748b;">Toko</small>
                                <div style="font-weight:bold;">${AppState.selectedStore.nama_toko} (${AppState.selectedStore.kode_toko})</div>
                            </div>
                            <div style="text-align:right;">
                                <small style="color:#64748b;">Nomor ULOK / Lingkup</small>
                                <div style="font-weight:bold;">${AppState.selectedUlok} / ${AppState.selectedLingkup}</div>
                            </div>
                        </div>

                        <div class="table-container">
                            <table style="width:100%;">
                                <thead>
                                    <tr style="background:#2d3748; color:white;">
                                        <th style="padding:10px;">No</th>
                                        <th style="padding:10px;">Uraian Pekerjaan</th>
                                        <th class="text-center">Sat</th>
                                        <th class="text-center">Vol RAB</th>
                                        <th class="text-center">Vol Real</th>
                                        <th class="text-right">Harga Satuan</th>
                                        <th class="text-right">Total Harga</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${items.map((item, idx) => `
                                        <tr style="border-bottom:1px solid #eee;">
                                            <td class="text-center">${idx + 1}</td>
                                            <td>
                                                <div style="font-size:0.85rem; color:#666;">${item.kategori_pekerjaan}</div>
                                                ${item.jenis_pekerjaan}
                                            </td>
                                            <td class="text-center">${item.satuan}</td>
                                            <td class="text-center">${item.vol_rab}</td>
                                            <td class="text-center font-bold">${item.volume_akhir}</td>
                                            <td class="text-right">${formatRupiah(item.harga_satuan)}</td>
                                            <td class="text-right font-bold" style="color:var(--primary);">${formatRupiah(item.total_harga)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>

                        <div style="display:flex; justify-content:flex-end; margin-top:20px;">
                            <div style="width:300px; background:#fff; border:1px solid #ddd; padding:15px; border-radius:8px;">
                                <div class="d-flex justify-between mb-2"><span>Total:</span> <strong>${formatRupiah(totalBiaya)}</strong></div>
                                <div class="d-flex justify-between mb-2"><span>PPN 11%:</span> <strong>${formatRupiah(ppn)}</strong></div>
                                <div style="border-top:2px dashed #ddd; margin:10px 0;"></div>
                                <div class="d-flex justify-between" style="font-size:1.1rem; color:var(--primary);">
                                    <span>Grand Total:</span> <strong>${formatRupiah(grandTotal)}</strong>
                                </div>
                            </div>
                        </div>

                        <div style="margin-top:40px; display:flex; justify-content:space-around; text-align:center;">
                            <div>
                                <p style="margin-bottom:60px;">Dibuat Oleh (PIC),</p>
                                <p style="font-weight:bold; text-decoration:underline;">${AppState.user.name || AppState.user.username}</p>
                            </div>
                            <div>
                                <p style="margin-bottom:60px;">Disetujui Oleh (Kontraktor),</p>
                                <p style="font-weight:bold; text-decoration:underline;">( ........................... )</p>
                            </div>
                        </div>

                        <div style="margin-top:40px; text-align:center;">
                            <button id="btn-download-pdf" class="btn btn-primary" style="padding:12px 24px; font-size:1rem;">
                                📄 Download PDF Laporan
                            </button>
                        </div>
                    </div>
                </div>
            `;
            container.innerHTML = html;

            container.querySelector('#btn-back-final-view').onclick = () => { AppState.selectedLingkup = null; AppState.selectedUlok = null; AppState.activeView = 'dashboard'; Render.app(); };
            
            container.querySelector('#btn-download-pdf').onclick = () => {
                const btn = document.getElementById('btn-download-pdf');
                btn.innerText = "Memproses PDF...";
                btn.disabled = true;
                setTimeout(() => {
                    PDFGenerator.generateFinalOpnamePDF(items, AppState.selectedStore, AppState.selectedUlok, AppState.selectedLingkup, AppState.user);
                    btn.innerText = "📄 Download PDF Laporan";
                    btn.disabled = false;
                }, 500);
            };

        } catch (e) {
            container.innerHTML = `<div class="container"><div class="alert-error">Error memuat data final: ${e.message}</div><button class="btn btn-back" onclick="Render.app()">Kembali</button></div>`;
        }
    },
    
    approvalDetail: async (container) => {
        // 1. Cek Data ULOK
        if (!AppState.selectedUlok) {
            container.innerHTML = '<div class="container text-center" style="padding-top:40px;"><div class="card"><h3>Memuat Data ULOK...</h3></div></div>';
            try {
                const res = await fetch(`${API_BASE_URL}/api/uloks?kode_toko=${AppState.selectedStore.kode_toko}`);
                const data = await res.json();
                AppState.uloks = data || [];

                if (Array.isArray(data) && data.length === 1) {
                    AppState.selectedUlok = data[0];
                    Render.approvalDetail(container); // Auto-select dan lanjut
                    return;
                }

                container.innerHTML = `
                    <div class="container" style="padding-top:20px;">
                        <div class="card">
                            <button id="btn-back-store-app" class="btn btn-back" style="margin-bottom:15px;">← Kembali</button>
                            <h2 style="color:var(--primary); margin-bottom:20px;">Pilih Nomor ULOK (Approval)</h2>
                            <div class="d-flex flex-column gap-2">
                                ${AppState.uloks.map(u => `<button class="btn btn-secondary ulok-btn" data-ulok="${u}" style="justify-content:flex-start;">📄 ${u}</button>`).join('')}
                            </div>
                        </div>
                    </div>
                `;
                
                // Event Handlers
                container.querySelector('#btn-back-store-app').onclick = () => { 
                    AppState.activeView = 'store-selection-kontraktor'; 
                    Render.app(); 
                };
                
                container.querySelectorAll('.ulok-btn').forEach(b => {
                    b.onclick = () => { 
                        AppState.selectedUlok = b.dataset.ulok; 
                        AppState.selectedLingkup = null; // Reset lingkup saat ganti ULOK
                        Render.approvalDetail(container); 
                    }
                });

            } catch (e) { 
                container.innerHTML = `<div class="container"><div class="alert-error">Gagal memuat ULOK: ${e.message}</div></div>`; 
            }
            return;
        }

        // 2. Cek Data Lingkup
        if (!AppState.selectedLingkup) {
            container.innerHTML = `
                <div class="container" style="padding-top:40px;">
                    <div class="card text-center" style="max-width:600px; margin:0 auto;">
                        <h2 style="color:var(--primary);">Pilih Lingkup Pekerjaan</h2>
                        <div class="badge badge-success" style="margin:10px auto; display:inline-block;">ULOK: ${AppState.selectedUlok}</div>
                        
                        <div class="d-flex justify-center gap-2" style="margin-top:30px; margin-bottom:30px;">
                            <button class="btn btn-primary" id="btn-sipil" style="min-width:120px;">SIPIL</button>
                            <button class="btn btn-info" id="btn-me" style="min-width:120px;">ME</button>
                        </div>
                        <button class="btn btn-back" id="btn-cancel-lingkup">Batal / Ganti ULOK</button>
                    </div>
                </div>
            `;
            
            container.querySelector('#btn-sipil').onclick = () => { AppState.selectedLingkup = 'SIPIL'; Render.approvalDetail(container); };
            container.querySelector('#btn-me').onclick = () => { AppState.selectedLingkup = 'ME'; Render.approvalDetail(container); };
            container.querySelector('#btn-cancel-lingkup').onclick = () => { AppState.selectedUlok = null; Render.approvalDetail(container); };
            return;
        }

        // 3. Tampilkan Tabel Approval
        container.innerHTML = '<div class="container text-center" style="padding-top:40px;"><div class="card"><h3>Memuat Data Opname Pending...</h3></div></div>';
        
        try {
            const url = `${API_BASE_URL}/api/opname/pending?kode_toko=${AppState.selectedStore.kode_toko}&no_ulok=${AppState.selectedUlok}&lingkup=${AppState.selectedLingkup}`;
            const res = await fetch(url);
            const pendingItems = await res.json();
            
            // Render Tabel Utama
            const renderApprovalTable = () => {
                let html = `
                <div class="container" style="padding-top:20px; max-width: 100vw; padding-left: 16px; padding-right: 16px;">
                    <div class="card" style="border-radius:12px; padding:16px;">
                        <div class="d-flex align-center gap-2" style="margin-bottom:24px; flex-wrap:wrap;">
                            <button id="btn-back-lingkup" class="btn btn-back">← Kembali</button>
                            <h2 style="color:var(--primary);">Persetujuan Opname</h2>
                        </div>
                        <p style="margin-bottom:20px; color:#64748b;">
                            <strong>${AppState.selectedStore.nama_toko}</strong> | ULOK: ${AppState.selectedUlok} | Lingkup: ${AppState.selectedLingkup}
                        </p>

                        <div id="approval-message" style="display:none; padding:10px; border-radius:8px; margin-bottom:15px;"></div>

                        <div class="table-container">
                            <table style="width:100%; min-width:1000px;">
                                <thead>
                                    <tr style="background:#f2f2f2;">
                                        <th style="padding:12px;">Kategori</th>
                                        <th style="padding:12px;">Jenis Pekerjaan</th>
                                        <th style="padding:12px; text-align:center;">Volume Akhir</th>
                                        <th style="padding:12px; text-align:center;">Foto</th>
                                        <th style="padding:12px;">PIC</th>
                                        <th style="padding:12px;">Waktu Submit</th>
                                        <th style="padding:12px; min-width:200px;">Catatan</th>
                                        <th style="padding:12px; text-align:center; min-width:180px;">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="approval-tbody">
                                    ${pendingItems.length === 0 ? 
                                        '<tr><td colspan="8" class="text-center" style="padding:20px;">Tidak ada opname yang menunggu persetujuan.</td></tr>' : 
                                        pendingItems.map(item => `
                                        <tr id="row-${item.item_id}" style="border-bottom:1px solid #ddd;">
                                            <td>${item.kategori_pekerjaan}</td>
                                            <td>${item.jenis_pekerjaan}</td>
                                            <td class="text-center"><b>${item.volume_akhir}</b> ${item.satuan || ''}</td>
                                            <td class="text-center">
                                                ${item.foto_url ? `<a href="${item.foto_url}" target="_blank" class="btn btn-outline" style="padding:4px 8px; font-size:12px;">Lihat</a>` : '<span style="color:#999;">-</span>'}
                                            </td>
                                            <td>${item.name || '-'}</td>
                                            <td>${item.tanggal_submit || '-'}</td>
                                            <td>
                                                <textarea id="note-${item.item_id}" class="form-input" rows="2" placeholder="Catatan (opsional)..." style="font-size:0.9rem;"></textarea>
                                            </td>
                                            <td class="text-center">
                                                <div class="d-flex justify-center gap-2">
                                                    <button class="btn btn-success btn-approve" data-id="${item.item_id}" data-jenis="${item.jenis_pekerjaan}" style="padding:6px 12px; font-size:0.85rem;">Approve</button>
                                                    <button class="btn btn-primary btn-reject" data-id="${item.item_id}" style="padding:6px 12px; font-size:0.85rem; background-color:#dc3545;">Reject</button>
                                                </div>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>`;
                
                container.innerHTML = html;

                // Event Listener: Back
                container.querySelector('#btn-back-lingkup').onclick = () => { 
                    AppState.selectedLingkup = null; 
                    Render.approvalDetail(container); 
                };

                // Helper: Show Message
                const showMsg = (msg, isError = false) => {
                    const el = document.getElementById('approval-message');
                    el.style.display = 'block';
                    el.className = isError ? 'alert-error' : 'badge-success'; // Recycle classes
                    el.style.backgroundColor = isError ? '#ffe5e5' : '#dcfce7';
                    el.style.color = isError ? '#cc0000' : '#166534';
                    el.innerText = msg;
                    setTimeout(() => { el.style.display = 'none'; }, 3000);
                };

                // Logic Approve (Sesuai ApprovalPage.js: 2 Step Fetch)
                container.querySelectorAll('.btn-approve').forEach(btn => {
                    btn.onclick = async () => {
                        const itemId = btn.dataset.id;
                        const jenisPekerjaan = btn.dataset.jenis;
                        const noteVal = document.getElementById(`note-${itemId}`).value;
                        const row = document.getElementById(`row-${itemId}`);
                        const btnReject = row.querySelector('.btn-reject');

                        btn.disabled = true;
                        btn.innerText = '...';
                        btnReject.disabled = true;

                        try {
                            // Fetch 1: Opname Approve
                            const payload1 = {
                                item_id: itemId,
                                kontraktor_username: AppState.user.username || AppState.user.name,
                                catatan: noteVal
                            };

                            const res1 = await fetch(`${API_BASE_URL}/api/opname/approve`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(payload1)
                            });
                            
                            if (!res1.ok) {
                                const errData = await res1.json();
                                throw new Error(errData.message || "Gagal approve item");
                            }

                            // Wait 2-3 seconds (Simulasi delay seperti di React agar backend sync)
                            await new Promise(r => setTimeout(r, 2000));

                            // Fetch 2: Process Summary
                            // Note: URL hardcoded di React, kita gunakan API_BASE_URL jika memungkinkan, 
                            // tapi code React pakai sparta-backend-5hdj. Kita sesuaikan.
                            const payload2 = {
                                no_ulok: AppState.selectedUlok,
                                lingkup_pekerjaan: AppState.selectedLingkup,
                                jenis_pekerjaan: jenisPekerjaan
                            };

                            const res2 = await fetch(`https://sparta-backend-5hdj.onrender.com/api/process_summary_opname`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(payload2)
                            });

                            if (!res2.ok) {
                                const errData2 = await res2.json();
                                console.warn("Warning Summary:", errData2.message);
                                // Tetap lanjut sukses karena item sudah diapprove
                            }

                            showMsg("Berhasil di-approve!");
                            row.remove(); // Hapus baris dari tabel

                            // Cek jika tabel kosong
                            if(document.querySelectorAll('#approval-tbody tr').length === 0) {
                                document.getElementById('approval-tbody').innerHTML = '<tr><td colspan="8" class="text-center" style="padding:20px;">Semua data telah diproses.</td></tr>';
                            }

                        } catch (e) {
                            showMsg(`Error: ${e.message}`, true);
                            btn.disabled = false;
                            btn.innerText = 'Approve';
                            btnReject.disabled = false;
                        }
                    };
                });

                // Logic Reject
                container.querySelectorAll('.btn-reject').forEach(btn => {
                    btn.onclick = async () => {
                        const itemId = btn.dataset.id;
                        const noteVal = document.getElementById(`note-${itemId}`).value;
                        const row = document.getElementById(`row-${itemId}`);
                        const btnApprove = row.querySelector('.btn-approve');

                        if(!confirm("Yakin ingin menolak (REJECT) item ini?")) return;

                        btn.disabled = true;
                        btn.innerText = '...';
                        btnApprove.disabled = true;

                        try {
                            const payload = {
                                item_id: itemId,
                                kontraktor_username: AppState.user.username || AppState.user.name,
                                catatan: noteVal
                            };

                            const res = await fetch(`${API_BASE_URL}/api/opname/reject`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(payload)
                            });

                            if (!res.ok) {
                                const data = await res.json();
                                throw new Error(data.message || "Gagal reject");
                            }

                            showMsg("Berhasil di-reject!");
                            row.remove();

                            if(document.querySelectorAll('#approval-tbody tr').length === 0) {
                                document.getElementById('approval-tbody').innerHTML = '<tr><td colspan="8" class="text-center" style="padding:20px;">Semua data telah diproses.</td></tr>';
                            }

                        } catch (e) {
                            showMsg(`Error: ${e.message}`, true);
                            btn.disabled = false;
                            btn.innerText = 'Reject';
                            btnApprove.disabled = false;
                        }
                    };
                });
            };

            renderApprovalTable();

        } catch (e) {
            container.innerHTML = `<div class="container"><div class="alert-error">Gagal mengambil data pending: ${e.message}</div><button class="btn btn-back" onclick="AppState.selectedLingkup=null; Render.approvalDetail(document.getElementById('main-content'))">Kembali</button></div>`;
        }
    },
};

/* ======================== INIT ======================== */
window.addEventListener('DOMContentLoaded', () => {
    Auth.init();
});