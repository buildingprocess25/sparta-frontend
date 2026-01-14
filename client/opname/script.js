/* ======================== CONSTANTS & UTILS ======================== */
// Ganti URL ini dengan URL backend yang sesuai jika perlu
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

// Convert formatted ID money to number
const toNumID = (v) => {
    if (v === null || v === undefined) return 0;
    const s = String(v).trim();
    const cleaned = s.replace(/[^\d,.-]/g, "");
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
};

// PDF Helpers
const toNumberVol = (v) => {
    if (v === null || v === undefined) return 0;
    let s = String(v).trim();
    if (!s) return 0;
    if (s.includes(",") && s.includes(".")) {
        s = s.replace(/\./g, "").replace(",", ".");
    } else if (s.includes(",")) {
        s = s.replace(",", ".");
    }
    const n = Number(s.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
};

const toBase64 = async (url) => {
    try {
        if (!url) return null;
        // Gunakan proxy atau fetch langsung jika CORS diizinkan
        // Di sini kita asumsikan server mendukung CORS atau pakai proxy yang sama
        const proxyUrl = `${API_BASE_URL}/api/image-proxy?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) return null;
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Base64 error", error);
        return null;
    }
};

/* ======================== STATE MANAGEMENT ======================== */
const AppState = {
    user: null,
    loading: true,
    activeView: 'dashboard', // dashboard, store-selection, opname, final-opname, etc.
    selectedStore: null,
    selectedUlok: null,
    selectedLingkup: null,
    opnameItems: [],
    stores: [],
    uloks: [],
    
    // Auth specific
    idleTimer: null,
};

/* ======================== AUTH SYSTEM ======================== */
const Auth = {
    init: () => {
        // Coba load user dari storage
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
            // Cek waktu (06:00 - 24:00 WIB)
            const now = new Date();
            const wibTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
            const hour = wibTime.getHours();
            
            if (hour < 6 || hour >= 24) {
                const currentTime = wibTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
                throw new Error(`Sesi Anda telah berakhir.\nLogin hanya 06.00–18.00 WIB.\nSekarang pukul ${currentTime} WIB.`);
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

    logout: (isAuto = false) => {
        AppState.user = null;
        sessionStorage.removeItem("user");
        clearTimeout(AppState.idleTimer);
        AppState.activeView = 'dashboard';
        AppState.selectedStore = null;
        if (isAuto) console.log("Auto logout");
        Render.app();
    },

    startIdleTimer: () => {
        clearTimeout(AppState.idleTimer);
        AppState.idleTimer = setTimeout(() => Auth.logout(true), INACTIVITY_LIMIT_MS);
        
        // Listeners reset timer
        ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach(evt => {
            window.addEventListener(evt, () => {
                if (AppState.user) {
                    clearTimeout(AppState.idleTimer);
                    AppState.idleTimer = setTimeout(() => Auth.logout(true), INACTIVITY_LIMIT_MS);
                }
            }, { passive: true, once: true }); // Once true trick to prevent event spam, but simpler logic here:
        });
        
        // Better implementation for reset: remove old listeners then add new global one that debounces? 
        // For simplicity in Vanilla JS script:
        window.onclick = () => { if(AppState.user) { clearTimeout(AppState.idleTimer); AppState.idleTimer = setTimeout(() => Auth.logout(true), INACTIVITY_LIMIT_MS); }};
    }
};

/* ======================== PDF GENERATOR LOGIC ======================== */
const PDFGenerator = {
    generateFinalOpnamePDF: async (submissions, selectedStore, selectedUlok) => {
        if (!window.jspdf) { alert("Library PDF belum dimuat."); return; }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const currentDate = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
        const margin = 14;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const addFooter = (pageNum) => {
            doc.setFontSize(8);
            doc.setTextColor(128, 128, 128);
            doc.text(`Halaman ${pageNum} - Dicetak pada: ${new Date().toLocaleString("id-ID")}`, pageWidth / 2, pageHeight - 10, { align: "center" });
            doc.setTextColor(0, 0, 0);
        };

        // --- Fetch Data Tambahan ---
        let rabData = [];
        let picKontraktor = { pic_username: 'N/A', kontraktor_username: 'N/A', name: '' };
        
        try {
            // Fetch RAB
            const lingkup = (submissions[0]?.lingkup_pekerjaan || "ME").toUpperCase();
            const urlRab = new URL(`${API_BASE_URL}/api/rab`);
            urlRab.searchParams.set("kode_toko", selectedStore.kode_toko);
            urlRab.searchParams.set("no_ulok", selectedUlok);
            urlRab.searchParams.set("lingkup", lingkup);
            const resRab = await fetch(urlRab);
            if(resRab.ok) rabData = await resRab.json();

            // Fetch PIC Data
            const resPic = await fetch(`${API_BASE_URL}/api/pic-kontraktor-opname?no_ulok=${encodeURIComponent(selectedUlok)}`);
            if(resPic.ok) picKontraktor = await resPic.json();
            
        } catch (e) { console.error(e); }

        // --- HEADER ---
        let startY = 15;
        // Logo Alfamart (Pakai link eksternal atau base64 hardcoded untuk demo)
        // Disini kita skip logo image loading untuk simplicity, atau pakai text
        doc.setFontSize(14).setFont(undefined, 'bold');
        doc.text("PT. SUMBER ALFARIA TRIJAYA, Tbk", margin, startY);
        startY += 6;
        doc.setFontSize(10).setFont(undefined, 'normal');
        doc.text("BUILDING & MAINTENANCE DEPT", margin, startY);
        startY += 10;
        doc.setFontSize(14).setFont(undefined, 'bold');
        doc.text("BERITA ACARA OPNAME PEKERJAAN", pageWidth/2, startY, { align: 'center' });
        startY += 15;

        // --- INFO PROYEK ---
        doc.setFontSize(10).setFont(undefined, 'normal');
        const dataOpname = submissions[0] || {};
        const info = [
            `NOMOR ULOK : ${selectedUlok}`,
            `LINGKUP : ${dataOpname.lingkup_pekerjaan || '-'}`,
            `NAMA TOKO : ${dataOpname.nama_toko || selectedStore.nama_toko}`,
            `ALAMAT : ${dataOpname.alamat || selectedStore.alamat || '-'}`,
            `TANGGAL : ${currentDate}`,
            `PIC : ${picKontraktor.name || picKontraktor.pic_username || '-'}`,
            `KONTRAKTOR : ${picKontraktor.kontraktor_username || '-'}`
        ];
        
        info.forEach(line => {
            doc.text(line, margin, startY);
            startY += 6;
        });
        startY += 10;

        // --- RAB FINAL TABLE ---
        doc.setFontSize(12).setFont(undefined, 'bold');
        doc.text("RAB FINAL", margin, startY);
        startY += 5;

        // Proses data RAB untuk AutoTable
        // (Sederhana: mapping data RAB ke array array)
        const rabRows = rabData.map((item, idx) => {
            const vol = toNumberVol(item.volume);
            const hMat = toNumberID(item.harga_material);
            const hUpah = toNumberID(item.harga_upah);
            const total = vol * (hMat + hUpah);
            return [
                idx + 1, item.jenis_pekerjaan, item.satuan, vol, 
                formatRupiah(hMat), formatRupiah(hUpah), formatRupiah(total)
            ];
        });

        const totalRAB = rabRows.reduce((sum, row) => sum + toNumID(row[6]), 0);

        doc.autoTable({
            head: [['NO', 'PEKERJAAN', 'SAT', 'VOL', 'MAT (Rp)', 'UPAH (Rp)', 'TOTAL (Rp)']],
            body: rabRows,
            startY: startY,
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [220, 53, 69] } // Red header
        });

        let finalY = doc.lastAutoTable.finalY + 10;

        // --- OPNAME FINAL TABLE (Perubahan) ---
        if (finalY + 30 > pageHeight) { doc.addPage(); finalY = 20; }
        
        doc.text("REKAPITULASI OPNAME", margin, finalY);
        finalY += 5;

        // Pisah Tambah/Kurang
        const items = submissions || [];
        const opnameRows = items.map((item, idx) => {
            const selisih = toNumberVol(item.selisih);
            const hTot = toNumID(item.harga_material) + toNumID(item.harga_upah);
            const nilaiSelisih = selisih * hTot;
            return [
                idx + 1, item.jenis_pekerjaan, item.vol_rab, item.volume_akhir, 
                item.selisih, formatRupiah(nilaiSelisih)
            ];
        });

        doc.autoTable({
            head: [['NO', 'PEKERJAAN', 'RAB', 'AKHIR', 'SELISIH', 'NILAI (Rp)']],
            body: opnameRows,
            startY: finalY,
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [220, 53, 69] }
        });
        
        finalY = doc.lastAutoTable.finalY + 10;

        // --- SUMMARY ---
        // Hitung total opname (RAB + Selisih)
        // Disini kita simplifikasi logika hitung sesuai OpnameForm
        const totalOpnameVal = items.reduce((sum, item) => sum + (item.total_harga_akhir || item.total_harga || 0), 0);
        
        doc.autoTable({
            body: [
                ['TOTAL OPNAME', formatRupiah(totalOpnameVal)],
                ['PPN 11%', formatRupiah(totalOpnameVal * 0.11)],
                ['GRAND TOTAL', formatRupiah(totalOpnameVal * 1.11)]
            ],
            startY: finalY,
            tableWidth: 80,
            margin: { left: pageWidth - 95 },
            theme: 'grid'
        });

        // Save
        doc.save(`Opname_${selectedStore.kode_toko}_${selectedUlok}.pdf`);
    }
};

/* ======================== RENDERER (VIEW CONTROLLER) ======================== */
const Render = {
    // Root App Renderer
    app: () => {
        const app = document.getElementById('app');
        app.innerHTML = '';

        if (AppState.loading) {
            app.innerHTML = `
                <div class="loading-screen">
                    <div style="font-size: 48px; margin-bottom: 16px; color: var(--alfamart-red);">🏪</div>
                    <h2 style="color: var(--alfamart-red);">Loading...</h2>
                </div>`;
            return;
        }

        if (!AppState.user) {
            Render.login(app);
            return;
        }

        // Render Authenticated Layout
        const header = Render.header();
        app.appendChild(header);

        // Content Area
        const contentDiv = document.createElement('div');
        contentDiv.id = 'main-content';
        app.appendChild(contentDiv);

        // Switch View
        switch (AppState.activeView) {
            case 'dashboard':
                Render.dashboard(contentDiv);
                break;
            case 'store-selection-pic':
                Render.storeSelection(contentDiv, 'opname');
                break;
            case 'opname':
                Render.opnameForm(contentDiv);
                break;
            case 'final-opname-selection':
                Render.storeSelection(contentDiv, 'final-opname');
                break;
            case 'final-opname-detail':
                // Placeholder, reuse OpnameForm with read-only or different logic if needed
                // For this migration, we route back to opname view or simple placeholder
                Render.finalOpnameView(contentDiv);
                break;
            // Kontraktor routes
            case 'store-selection-kontraktor':
                Render.storeSelection(contentDiv, 'approval');
                break;
            case 'approval-detail':
                Render.placeholder(contentDiv, "Halaman Approval (Belum Dimigrasi Penuh)");
                break;
            case 'history-selection-kontraktor':
                Render.storeSelection(contentDiv, 'history');
                break;
            case 'history-detail-kontraktor':
                 Render.finalOpnameView(contentDiv); // Reuse final view
                break;
            default:
                Render.dashboard(contentDiv);
        }
    },

    header: () => {
        const header = document.createElement('header');
        header.className = 'app-header';
        header.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <img src="https://upload.wikimedia.org/wikipedia/commons/9/9e/Alfamart_logo.svg" height="40" alt="Logo">
                <div>
                    <h3 style="margin:0; color: #d6001c;">Opname System</h3>
                    <small>User: ${AppState.user.username}</small>
                </div>
            </div>
            <button class="header-logout" id="btn-logout">Logout</button>
        `;
        header.querySelector('#btn-logout').onclick = () => Auth.logout();
        return header;
    },

    login: (container) => {
        container.innerHTML = `
            <div class="login-wrapper">
                <div class="login-card">
                    <div class="login-header">
                        <h1>Building & Maintenance</h1>
                        <h3>Opname Login</h3>
                    </div>
                    <div id="login-error" class="alert-error" style="display:none;"></div>
                    <form id="login-form">
                        <div class="form-group-custom">
                            <label>Username</label>
                            <input type="text" id="username" class="input-custom" required placeholder="Masukkan username">
                        </div>
                        <div class="form-group-custom">
                            <label>Password</label>
                            <div class="password-wrapper">
                                <input type="password" id="password" class="input-custom" required placeholder="Masukkan password">
                                <button type="button" class="toggle-password-btn" id="toggle-pw">👁️</button>
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

        toggleBtn.onclick = () => {
            pwInput.type = pwInput.type === 'password' ? 'text' : 'password';
        };

        form.onsubmit = async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            const errDiv = document.getElementById('login-error');
            
            btn.disabled = true;
            btn.innerText = "Loading...";
            errDiv.style.display = 'none';

            const u = document.getElementById('username').value;
            const p = pwInput.value;

            const result = await Auth.login(u, p);
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
                <button onclick="AppState.activeView='store-selection-pic'; Render.app()" class="btn btn-primary d-flex flex-column align-center justify-center" style="height:120px; font-size:18px;">
                    <span style="font-size:32px">📝</span> Input Opname Harian
                </button>
                <button onclick="AppState.activeView='final-opname-selection'; Render.app()" class="btn btn-success d-flex flex-column align-center justify-center" style="height:120px; font-size:18px;">
                    <span style="font-size:32px">📄</span> Lihat Opname Final
                </button>
            `;
        } else if (role === 'kontraktor') {
            buttons = `
                <button onclick="AppState.activeView='store-selection-kontraktor'; Render.app()" class="btn btn-info d-flex flex-column align-center justify-center" style="height:120px; font-size:18px;">
                    <span style="font-size:32px">🔔</span> Persetujuan Opname
                </button>
                <button onclick="AppState.activeView='history-selection-kontraktor'; Render.app()" class="btn btn-secondary d-flex flex-column align-center justify-center" style="height:120px; font-size:18px;">
                    <span style="font-size:32px">📜</span> Histori Opname
                </button>
            `;
        }

        container.innerHTML = `
            <div class="container" style="padding-top:40px;">
                <div class="card">
                    <h2 class="text-center" style="color:var(--alfamart-red);">Selamat Datang, ${AppState.user.kontraktor_username || AppState.user.name || AppState.user.username}!</h2>
                    <br>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                        ${buttons}
                    </div>
                </div>
            </div>
        `;
    },

    storeSelection: async (container, type) => {
        container.innerHTML = '<div class="container text-center" style="padding-top:20px;"><h3>Memuat data toko...</h3></div>';

        let url = "";
        const u = AppState.user;
        if ((type === 'opname' || type === 'final-opname') && u.role === 'pic') {
            url = `${API_BASE_URL}/api/toko?username=${u.username}`;
        } else if (u.role === 'kontraktor') {
            url = `${API_BASE_URL}/api/toko_kontraktor?username=${u.username}`;
        }

        try {
            const res = await fetch(url);
            const stores = await res.json();
            AppState.stores = Array.isArray(stores) ? stores : [];
        } catch (e) {
            AppState.stores = [];
            console.error(e);
        }

        const renderList = (filter = "") => {
            const filtered = AppState.stores.filter(s => 
                s.kode_toko.toLowerCase().includes(filter.toLowerCase()) || 
                s.nama_toko.toLowerCase().includes(filter.toLowerCase())
            );

            let html = `
                <div class="container" style="padding-top:20px;">
                    <div class="card">
                        <div class="d-flex align-center gap-2" style="margin-bottom:24px;">
                            <button id="btn-back-store" class="btn btn-back">← Kembali</button>
                            <h2 style="color:var(--alfamart-red);">Pilih Toko (${type})</h2>
                        </div>
                        <input type="text" id="store-search" class="form-input" placeholder="Cari Toko..." value="${filter}" style="margin-bottom:20px;">
                        
                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:20px;">
                            ${filtered.map(toko => `
                                <button class="btn btn-secondary store-item" data-kode="${toko.kode_toko}" style="height:auto; min-height:120px; flex-direction:column; background-color:var(--alfamart-yellow);">
                                    <span style="font-size:28px;">🏪</span>
                                    <div style="font-size:18px; font-weight:bold;">${toko.nama_toko}</div>
                                    <div style="font-size:14px;">Cabang: <strong>${toko.kode_toko}</strong></div>
                                </button>
                            `).join('')}
                        </div>
                        ${filtered.length === 0 ? '<p class="text-center">Tidak ditemukan.</p>' : ''}
                    </div>
                </div>
            `;
            container.innerHTML = html;

            // Events
            container.querySelector('#btn-back-store').onclick = () => {
                AppState.activeView = 'dashboard';
                Render.app();
            };
            
            container.querySelector('#store-search').oninput = (e) => {
                renderList(e.target.value);
                // Keep focus
                const input = document.getElementById('store-search');
                input.focus();
            };

            container.querySelectorAll('.store-item').forEach(btn => {
                btn.onclick = () => {
                    const code = btn.getAttribute('data-kode');
                    AppState.selectedStore = AppState.stores.find(s => s.kode_toko === code);
                    
                    if(type === 'opname') AppState.activeView = 'opname';
                    else if(type === 'final-opname') AppState.activeView = 'final-opname-detail';
                    else if(type === 'approval') AppState.activeView = 'approval-detail';
                    else if(type === 'history') AppState.activeView = 'history-detail-kontraktor';
                    
                    // Reset selection
                    AppState.selectedUlok = null;
                    AppState.selectedLingkup = null;
                    Render.app();
                };
            });
        };

        renderList();
    },

    opnameForm: async (container) => {
        // Step 1: Jika belum pilih ULOK
        if (!AppState.selectedUlok) {
            container.innerHTML = '<div class="container text-center" style="padding-top:20px;"><h3>Memuat data ULOK...</h3></div>';
            try {
                const res = await fetch(`${API_BASE_URL}/api/uloks?kode_toko=${AppState.selectedStore.kode_toko}`);
                const data = await res.json();
                AppState.uloks = data;

                if (data.length === 1) {
                    AppState.selectedUlok = data[0];
                    Render.opnameForm(container); // Rekursif ke step 2
                    return;
                }

                container.innerHTML = `
                    <div class="container" style="padding-top:20px;">
                        <div class="card">
                            <button id="btn-back-ulok" class="btn btn-back" style="margin-bottom:15px;">Kembali</button>
                            <h2>Pilih No. ULOK</h2>
                            <div class="d-flex flex-column gap-2">
                                ${AppState.uloks.map(u => `<button class="btn btn-outline ulok-btn" data-ulok="${u}">${u}</button>`).join('')}
                            </div>
                        </div>
                    </div>
                `;
                container.querySelector('#btn-back-ulok').onclick = () => { AppState.activeView = 'store-selection-pic'; Render.app(); };
                container.querySelectorAll('.ulok-btn').forEach(b => {
                    b.onclick = () => {
                        AppState.selectedUlok = b.getAttribute('data-ulok');
                        Render.opnameForm(container);
                    }
                });
            } catch (e) {
                container.innerHTML = `<div class="container"><div class="alert-error">Gagal: ${e.message}</div></div>`;
            }
            return;
        }

        // Step 2: Jika belum pilih Lingkup (Simulasi Component LingkupSelection)
        if (!AppState.selectedLingkup) {
            container.innerHTML = `
                <div class="container" style="padding-top:20px;">
                    <div class="card text-center">
                        <h2>Pilih Lingkup Pekerjaan</h2>
                        <p>No ULOK: ${AppState.selectedUlok}</p>
                        <div class="d-flex justify-center gap-2" style="margin-top:20px;">
                            <button class="btn btn-primary" id="btn-sipil">SIPIL</button>
                            <button class="btn btn-info" id="btn-me">ME</button>
                        </div>
                        <button class="btn btn-back" id="btn-cancel-lingkup" style="margin-top:20px;">Batal</button>
                    </div>
                </div>
            `;
            container.querySelector('#btn-sipil').onclick = () => { AppState.selectedLingkup = 'SIPIL'; Render.opnameForm(container); };
            container.querySelector('#btn-me').onclick = () => { AppState.selectedLingkup = 'ME'; Render.opnameForm(container); };
            container.querySelector('#btn-cancel-lingkup').onclick = () => { AppState.selectedUlok = null; Render.opnameForm(container); };
            return;
        }

        // Step 3: Load Data Opname Item
        container.innerHTML = '<div class="container text-center" style="padding-top:20px;"><h3>Memuat Detail Pekerjaan...</h3></div>';
        
        try {
            // Fetch logic simplified for VanillaJS migration based on OpnameForm.js
            const base = `${API_BASE_URL}/api/opname?kode_toko=${encodeURIComponent(AppState.selectedStore.kode_toko)}&no_ulok=${encodeURIComponent(AppState.selectedUlok)}&lingkup=${encodeURIComponent(AppState.selectedLingkup)}`;
            
            const res = await fetch(base);
            let data = await res.json();
            
            // Map items
            AppState.opnameItems = data.map((task, index) => {
                const volRab = toNumInput(task.vol_rab);
                const volAkhirNum = toNumInput(task.volume_akhir);
                const hargaMaterial = toNumID(task.harga_material);
                const hargaUpah = toNumID(task.harga_upah);
                const total_harga = volAkhirNum * (hargaMaterial + hargaUpah);
                const alreadySubmitted = task.isSubmitted === true || !!task.item_id || ["PENDING", "APPROVED", "REJECTED"].includes(String(task.approval_status || "").toUpperCase());

                return {
                    ...task,
                    id: index + 1, // temporary ID for frontend
                    harga_material: hargaMaterial,
                    harga_upah: hargaUpah,
                    isSubmitted: alreadySubmitted,
                    volume_akhir: alreadySubmitted ? String(volAkhirNum) : "",
                    selisih: (Math.round((volAkhirNum - volRab + Number.EPSILON) * 100) / 100).toFixed(2),
                    total_harga
                };
            });

            // Check Status Final
            let canFinalize = false;
            let isFinalized = false;

            // Simplified check logic
            try {
                const checkRes = await fetch(`https://sparta-backend-5hdj.onrender.com/api/check_status_item_opname?no_ulok=${AppState.selectedUlok}&lingkup_pekerjaan=${AppState.selectedLingkup}`);
                const checkData = await checkRes.json();
                if (checkData.status === 'approved') {
                    if (checkData.tanggal_opname_final) isFinalized = true;
                    else canFinalize = true;
                }
            } catch(e) {}

            // RENDER TABLE
            const renderTable = () => {
                const items = AppState.opnameItems;
                const totalVal = items.reduce((sum, i) => sum + (i.total_harga || 0), 0);
                const ppn = totalVal * 0.11;
                const grandTotal = totalVal * 1.11;

                let html = `
                <div class="container" style="padding-top:20px; width:100%;">
                    <div class="card" style="border-radius:0;">
                        <div class="d-flex align-center gap-2" style="margin-bottom:20px;">
                            <button id="btn-back-main" class="btn btn-back">Kembali</button>
                            <h2 style="color:var(--alfamart-red);">Input Opname Harian (${AppState.selectedLingkup})</h2>
                        </div>
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Jenis Pekerjaan</th>
                                        <th class="text-center">Vol RAB</th>
                                        <th class="text-center">Satuan</th>
                                        <th class="text-center">Vol Akhir</th>
                                        <th class="text-right">Total Harga</th>
                                        <th class="text-center">Foto</th>
                                        <th class="text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${items.map(item => `
                                        <tr style="background:${item.isSubmitted ? '#f0fff0' : 'transparent'}">
                                            <td>
                                                <strong>${item.kategori_pekerjaan}</strong><br>
                                                ${item.jenis_pekerjaan}
                                            </td>
                                            <td class="text-center">${item.vol_rab}</td>
                                            <td class="text-center">${item.satuan}</td>
                                            <td class="text-center">
                                                <input type="number" class="form-input vol-input" data-id="${item.id}" value="${item.volume_akhir}" style="width:100px;" ${item.isSubmitted ? 'disabled' : ''}>
                                            </td>
                                            <td class="text-right font-bold" id="total-${item.id}">
                                                ${formatRupiah(item.total_harga)}
                                            </td>
                                            <td class="text-center">
                                                ${item.foto_url ? `<a href="${item.foto_url}" target="_blank">Lihat</a>` : 
                                                    `<input type="file" class="file-input" data-id="${item.id}" id="file-${item.id}" style="display:none;">
                                                    <label for="file-${item.id}" class="btn btn-sm btn-outline">Upload</label>`
                                                }
                                            </td>
                                            <td class="text-center">
                                                ${item.isSubmitted ? 
                                                    `<span class="badge badge-success">Tersimpan</span>` : 
                                                    `<button class="btn btn-sm btn-primary save-btn" data-id="${item.id}">Simpan</button>`
                                                }
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>

                        <div style="background:#f8f9fa; padding:16px; border-radius:8px;">
                            <h4>Ringkasan Total</h4>
                            <div class="d-flex justify-center" style="justify-content:space-between;"><span>Total:</span> <b>${formatRupiah(totalVal)}</b></div>
                            <div class="d-flex justify-center" style="justify-content:space-between;"><span>PPN 11%:</span> <b>${formatRupiah(ppn)}</b></div>
                            <hr style="margin:10px 0;">
                            <div class="d-flex justify-center" style="justify-content:space-between; font-size:18px;"><span>GRAND TOTAL:</span> <b>${formatRupiah(grandTotal)}</b></div>
                        </div>

                        <button id="btn-final" class="btn" style="width:100%; margin-top:20px; background-color:${isFinalized ? '#28a745' : canFinalize ? '#007bff' : '#6c757d'}" ${(!canFinalize || isFinalized) ? 'disabled' : ''}>
                            ${isFinalized ? 'Opname Selesai (Final)' : canFinalize ? 'Opname Final' : 'Menunggu Approval Semua Item'}
                        </button>
                    </div>
                </div>
                `;
                container.innerHTML = html;

                // EVENTS
                container.querySelector('#btn-back-main').onclick = () => { AppState.selectedLingkup = null; Render.opnameForm(container); };

                // Input Change
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
                        
                        // Update DOM partial
                        document.getElementById(`total-${id}`).innerText = formatRupiah(item.total_harga);
                        // Re-render full to update summary? Or just update summary text. For simplicity, we assume user saves per item.
                    }
                });

                // File Upload
                container.querySelectorAll('.file-input').forEach(input => {
                    input.onchange = async (e) => {
                        const file = e.target.files[0];
                        const id = parseInt(e.target.dataset.id);
                        if(!file) return;

                        const formData = new FormData();
                        formData.append("file", file);
                        try {
                            // Dummy Upload URL, replace with real one
                            const res = await fetch(`${API_BASE_URL}/api/upload`, { method: "POST", body: formData });
                            const json = await res.json();
                            if(res.ok) {
                                AppState.opnameItems.find(i => i.id === id).foto_url = json.link;
                                alert("Upload berhasil");
                            } else throw new Error(json.message);
                        } catch(err) { alert("Upload gagal: " + err.message); }
                    }
                });

                // Save Item
                container.querySelectorAll('.save-btn').forEach(btn => {
                    btn.onclick = async () => {
                        const id = parseInt(btn.dataset.id);
                        const item = AppState.opnameItems.find(i => i.id === id);
                        if(!item.volume_akhir) { alert("Isi volume akhir!"); return; }

                        btn.innerText = "...";
                        btn.disabled = true;

                        const payload = {
                            kode_toko: AppState.selectedStore.kode_toko,
                            nama_toko: AppState.selectedStore.nama_toko,
                            alamat: AppState.selectedStore.alamat || "",
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

                        try {
                            const res = await fetch(`${API_BASE_URL}/api/opname/item/submit`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(payload)
                            });
                            if(!res.ok) throw new Error("Gagal simpan");
                            item.isSubmitted = true;
                            item.approval_status = "Pending";
                            renderTable(); // Refresh UI
                        } catch(e) {
                            alert(e.message);
                            btn.innerText = "Simpan";
                            btn.disabled = false;
                        }
                    }
                });

                // Final Opname
                container.querySelector('#btn-final').onclick = async () => {
                    if(confirm("Yakin finalisasi?")) {
                        try {
                            const res = await fetch(`https://sparta-backend-5hdj.onrender.com/api/opname_locked`, {
                                method: "POST",
                                headers: {"Content-Type":"application/json"},
                                body: JSON.stringify({
                                    status: "locked",
                                    ulok: AppState.selectedUlok,
                                    lingkup_pekerjaan: AppState.selectedLingkup
                                })
                            });
                            if(res.ok) { alert("Berhasil!"); isFinalized = true; renderTable(); }
                            else alert("Gagal");
                        } catch(e) { alert("Error: " + e.message); }
                    }
                }
            };
            
            renderTable();

        } catch (e) {
            container.innerHTML = `<div class="container"><div class="alert-error">Error: ${e.message}</div><button class="btn btn-back" onclick="AppState.selectedLingkup=null; Render.app()">Kembali</button></div>`;
        }
    },

    finalOpnameView: async (container) => {
        // Simple View for Final Opname / History
        container.innerHTML = '<div class="container text-center" style="padding-top:20px;"><h3>Memuat Data Final...</h3></div>';
        
        // Re-use fetch logic slightly modified
        const u = AppState.user;
        if (!AppState.selectedStore) { AppState.activeView = 'dashboard'; Render.app(); return; }
        
        // Jika belum pilih ULOK, tampilkan list (bisa reuse logic opnameForm step 1, tapi simplify disini)
        if(!AppState.selectedUlok) {
            // Simplified: anggap user harus pilih ULOK dulu (copy logic step 1 opnameForm)
            // Untuk brevity kode migrasi ini, kita asumsikan flow sama.
            AppState.activeView = 'opname'; // Hack: reuse flow opname tapi readonly
            Render.app();
            return;
        }
        
        // Render View Readonly + PDF Button
        container.innerHTML = `
            <div class="container" style="padding-top:20px;">
                <div class="card text-center">
                    <h2>Opname Final</h2>
                    <p>Toko: ${AppState.selectedStore.nama_toko}</p>
                    <p>ULOK: ${AppState.selectedUlok}</p>
                    <button class="btn btn-primary" id="btn-download-pdf">Download PDF Laporan</button>
                    <br><br>
                    <button class="btn btn-back" id="btn-back-final">Kembali</button>
                </div>
            </div>
        `;
        
        container.querySelector('#btn-back-final').onclick = () => {
            AppState.activeView = 'dashboard';
            AppState.selectedUlok = null;
            Render.app();
        };

        container.querySelector('#btn-download-pdf').onclick = async () => {
             // Fetch data for PDF
            const btn = document.getElementById('btn-download-pdf');
            btn.innerText = "Generating...";
            btn.disabled = true;
            try {
                 // Fetch submissions items
                const res = await fetch(`${API_BASE_URL}/api/opname?kode_toko=${encodeURIComponent(AppState.selectedStore.kode_toko)}&no_ulok=${encodeURIComponent(AppState.selectedUlok)}`);
                const data = await res.json(); 
                await PDFGenerator.generateFinalOpnamePDF(data, AppState.selectedStore, AppState.selectedUlok);
            } catch(e) {
                alert("Gagal generate PDF: " + e.message);
            }
            btn.innerText = "Download PDF Laporan";
            btn.disabled = false;
        };
    },
    
    placeholder: (container, text) => {
        container.innerHTML = `
            <div class="container" style="padding-top:50px;">
                <div class="card text-center">
                    <h3>${text}</h3>
                    <p>Fitur ini belum sepenuhnya dimigrasi dalam demo 3 file ini.</p>
                    <button class="btn btn-back" onclick="AppState.activeView='dashboard'; Render.app()">Kembali ke Dashboard</button>
                </div>
            </div>
        `;
    }
};

/* ======================== INIT ======================== */
window.addEventListener('DOMContentLoaded', () => {
    Auth.init();
});