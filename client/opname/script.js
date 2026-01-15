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
    generateFinalOpnamePDF: async (submissions, selectedStore, selectedUlok) => {
        if (!window.jspdf) { alert("Library PDF belum dimuat."); return; }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text("Laporan Opname (Demo)", 10, 10);
        doc.save(`Opname_${selectedStore.kode_toko}_${selectedUlok}.pdf`);
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
            case 'approval-detail': Render.placeholder(contentDiv, "Halaman Approval"); break;
            case 'history-selection-kontraktor': Render.storeSelection(contentDiv, 'history'); break;
            case 'history-detail-kontraktor': Render.finalOpnameView(contentDiv); break;
            default: Render.dashboard(contentDiv);
        }
    },

    // --- UPDATED HEADER ---
    header: () => {
        const header = document.createElement('header');
        header.className = 'app-header';
        
        // Perbaikan Logo: Menggunakan class header-logo yang filternya sudah dihapus di CSS
        // Perbaikan Tombol Logout: Ditambahkan SVG icon agar mirip style button 'Dashboard' di svdokumen
        header.innerHTML = `
            <img src="../../assets/Alfamart-Emblem.png" alt="Alfamart" class="header-logo" onerror="this.style.display='none'; this.parentElement.insertAdjacentHTML('afterbegin', '<b style=\\'position:absolute;left:20px;color:white\\'>ALFAMART</b>')">
            
            <div style="text-align:center;">
                <h1>Opname</h1>
                <span class="header-user-info">User: ${AppState.user.username} | ${AppState.user.role === 'pic' ? 'PIC' : 'Kontraktor'}</span>
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
        if (!AppState.selectedUlok) {
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
                return { ...task, id: index + 1, harga_material: hargaMaterial, harga_upah: hargaUpah, isSubmitted: alreadySubmitted, volume_akhir: alreadySubmitted ? String(volAkhirNum) : "", selisih: (Math.round((volAkhirNum - volRab + Number.EPSILON) * 100) / 100).toFixed(2), total_harga };
            });

            let isFinalized = false; let canFinalize = false;

            const renderTable = () => {
                const items = AppState.opnameItems;
                const totalVal = items.reduce((sum, i) => sum + (i.total_harga || 0), 0);
                const ppn = totalVal * 0.11;
                const grandTotal = totalVal * 1.11;

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
                                    <tr>
                                        <th>Pekerjaan</th>
                                        <th class="text-center" width="80">RAB</th>
                                        <th class="text-center" width="60">Sat</th>
                                        <th class="text-center" width="100">Akhir</th>
                                        <th class="text-right" width="150">Total (Rp)</th>
                                        <th class="text-center" width="80">Foto</th>
                                        <th class="text-center" width="100">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${items.map(item => `
                                        <tr style="background:${item.isSubmitted ? '#f0fdf4' : 'white'}">
                                            <td>
                                                <div style="font-size:0.8rem; color:#64748b; font-weight:600;">${item.kategori_pekerjaan}</div>
                                                ${item.jenis_pekerjaan}
                                            </td>
                                            <td class="text-center">${item.vol_rab}</td>
                                            <td class="text-center">${item.satuan}</td>
                                            <td class="text-center">
                                                <input type="number" class="form-input vol-input" data-id="${item.id}" value="${item.volume_akhir}" 
                                                style="padding:6px; text-align:center;" ${item.isSubmitted ? 'disabled' : ''}>
                                            </td>
                                            <td class="text-right font-bold" style="color:var(--primary);" id="total-${item.id}">
                                                ${formatRupiah(item.total_harga)}
                                            </td>
                                            <td class="text-center">
                                                ${item.foto_url ? `<a href="${item.foto_url}" target="_blank" class="btn btn-outline" style="padding:4px 8px; font-size:12px;">Lihat</a>` : 
                                                    `<input type="file" class="file-input" data-id="${item.id}" id="file-${item.id}" style="display:none;">
                                                    <label for="file-${item.id}" class="btn btn-secondary" style="padding:4px 8px; font-size:12px;">Upload</label>`
                                                }
                                            </td>
                                            <td class="text-center">
                                                ${item.isSubmitted ? 
                                                    `<span class="badge badge-success">Saved</span>` : 
                                                    `<button class="btn btn-primary save-btn" style="padding:6px 12px; font-size:0.85rem;" data-id="${item.id}">Simpan</button>`
                                                }
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>

                        <div style="background:#f8fafc; padding:20px; border-radius:12px; margin-top:20px; border:1px solid #e2e8f0;">
                            <h4 style="margin-bottom:15px; border-bottom:1px solid #e2e8f0; padding-bottom:5px;">Ringkasan Biaya</h4>
                            <div class="d-flex" style="justify-content:space-between; margin-bottom:8px;"><span>Subtotal:</span> <b>${formatRupiah(totalVal)}</b></div>
                            <div class="d-flex" style="justify-content:space-between; margin-bottom:8px;"><span>PPN 11%:</span> <b>${formatRupiah(ppn)}</b></div>
                            <div class="d-flex" style="justify-content:space-between; font-size:1.2rem; color:var(--primary); margin-top:10px; padding-top:10px; border-top:2px dashed #e2e8f0;">
                                <span>GRAND TOTAL:</span> <b>${formatRupiah(grandTotal)}</b>
                            </div>
                        </div>

                        <button id="btn-final" class="btn ${isFinalized ? 'btn-success' : 'btn-primary'}" style="width:100%; margin-top:20px; padding:15px;" ${(!canFinalize || isFinalized) ? 'disabled' : ''}>
                            ${isFinalized ? '✅ Opname Selesai (Final)' : canFinalize ? '🚀 Finalisasi Opname' : '⏳ Lengkapi Semua Item untuk Finalisasi'}
                        </button>
                    </div>
                </div>
                `;
                container.innerHTML = html;
                
                container.querySelector('#btn-back-main').onclick = () => { AppState.selectedLingkup = null; Render.opnameForm(container); };
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
                        document.getElementById(`total-${id}`).innerText = formatRupiah(item.total_harga);
                    }
                });
                
                container.querySelectorAll('.save-btn').forEach(btn => {
                    btn.onclick = async () => {
                        alert("Logic Simpan berjalan (Simulasi)"); 
                    }
                });
            };
            renderTable();
        } catch (e) {
            container.innerHTML = `<div class="container"><div class="alert-error">Error: ${e.message}</div><button class="btn btn-back" onclick="Render.app()">Kembali</button></div>`;
        }
    },

    finalOpnameView: async (container) => {
        container.innerHTML = `
            <div class="container" style="padding-top:20px;">
                <div class="card text-center">
                    <h2 style="color:var(--primary);">Laporan Opname Final</h2>
                    <p style="color:var(--text-muted); margin-bottom:20px;">Toko: ${AppState.selectedStore ? AppState.selectedStore.nama_toko : '-'} | ULOK: ${AppState.selectedUlok || '-'}</p>
                    
                    <button class="btn btn-primary" id="btn-download-pdf">📄 Download PDF Laporan</button>
                    <br><br>
                    <button class="btn btn-back" id="btn-back-final">Kembali ke Dashboard</button>
                </div>
            </div>
        `;
        container.querySelector('#btn-back-final').onclick = () => { AppState.activeView = 'dashboard'; Render.app(); };
        container.querySelector('#btn-download-pdf').onclick = async () => {
            alert("Fitur Download PDF");
        };
    },
    
    placeholder: (container, text) => {
        container.innerHTML = `
            <div class="container" style="padding-top:40px;">
                <div class="card text-center">
                    <h3 style="color:var(--text-muted);">${text}</h3>
                    <p>Halaman ini sedang dalam pengembangan.</p>
                    <button class="btn btn-back" onclick="AppState.activeView='dashboard'; Render.app()">Kembali</button>
                </div>
            </div>
        `;
    }
};

/* ======================== INIT ======================== */
window.addEventListener('DOMContentLoaded', () => {
    Auth.init();
});