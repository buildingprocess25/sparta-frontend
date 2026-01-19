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

        // --- Configuration ---
        const marginLeft = 14;
        const marginRight = 196; // 210 (A4 Width) - 14
        let currentY = 20;

        // --- Header Section ---
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("BERITA ACARA OPNAME PEKERJAAN", 105, currentY, { align: "center" });
        currentY += 7;

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Nomor Dokumen: ${ulok}`, 105, currentY, { align: "center" });
        currentY += 5;

        // Line Separator
        doc.setLineWidth(0.5);
        doc.setDrawColor(0, 0, 0); // Black
        doc.line(marginLeft, currentY, marginRight, currentY);
        currentY += 10;

        // --- Info Section (2 Columns) ---
        const colLeft = marginLeft;
        const colRight = 120;
        
        doc.setFontSize(9);
        
        // Left: Store Info
        doc.setFont("helvetica", "bold");
        doc.text("DATA TOKO:", colLeft, currentY);
        doc.setFont("helvetica", "normal");
        currentY += 5;
        doc.text(`Nama Toko : ${store.nama_toko}`, colLeft, currentY);
        currentY += 5;
        doc.text(`Kode Toko : ${store.kode_toko}`, colLeft, currentY);
        
        // Reset Y for Right Column
        currentY -= 10; 

        // Right: Opname Info
        doc.setFont("helvetica", "bold");
        doc.text("DETAIL OPNAME:", colRight, currentY);
        doc.setFont("helvetica", "normal");
        currentY += 5;
        doc.text(`Lingkup Kerja : ${lingkup}`, colRight, currentY);
        currentY += 5;
        doc.text(`Tanggal Cetak : ${new Date().toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}`, colRight, currentY);
        
        currentY += 15; // Space before table

        // --- Table Data Preparation ---
        const tableBody = items.map((item, index) => {
            // Pastikan harga satuan ada (fallback jika tidak ada di objek item)
            const hSatuan = item.harga_satuan ? item.harga_satuan : (item.total_harga / (toNumInput(item.volume_akhir) || 1));
            
            return [
                index + 1,
                item.jenis_pekerjaan,
                item.satuan,
                item.vol_rab,
                item.volume_akhir,
                formatRupiah(hSatuan),
                formatRupiah(item.total_harga)
            ];
        });

        // Calculate Totals
        const totalBiaya = items.reduce((sum, i) => sum + (i.total_harga || 0), 0);
        const ppn = totalBiaya * 0.11;
        const grandTotal = totalBiaya * 1.11;

        // --- Render Table (Formal Style) ---
        doc.autoTable({
            startY: currentY,
            head: [['No', 'Uraian Pekerjaan', 'Sat', 'Vol RAB', 'Vol Real', 'Hrg Satuan', 'Total']],
            body: tableBody,
            theme: 'grid', // Grid tipis terlihat lebih rapi
            styles: {
                font: 'helvetica',
                fontSize: 9,
                textColor: [33, 33, 33], // Dark Grey text
                lineColor: [200, 200, 200], // Soft border color
                lineWidth: 0.1,
                cellPadding: 4,
                valign: 'middle'
            },
            headStyles: {
                fillColor: [245, 245, 245], // Very light grey background (Hemat tinta & elegan)
                textColor: [0, 0, 0], // Black text
                fontStyle: 'bold',
                lineWidth: 0.1,
                lineColor: [150, 150, 150] // Slightly darker border for header
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 10 }, // No
                1: { halign: 'left' },                   // Uraian
                2: { halign: 'center', cellWidth: 15 }, // Sat
                3: { halign: 'center', cellWidth: 20 }, // Vol RAB
                4: { halign: 'center', cellWidth: 20 }, // Vol Real
                5: { halign: 'right', cellWidth: 30 },  // Hrg Satuan
                6: { halign: 'right', cellWidth: 35 },  // Total
            },
            foot: [
                ['', '', '', '', '', { content: 'Sub Total', styles: { fontStyle: 'bold', halign: 'right' } }, { content: formatRupiah(totalBiaya), styles: { fontStyle: 'bold', halign: 'right' } }],
                ['', '', '', '', '', { content: 'PPN 11%', styles: { fontStyle: 'bold', halign: 'right' } }, { content: formatRupiah(ppn), styles: { fontStyle: 'bold', halign: 'right' } }],
                ['', '', '', '', '', { content: 'GRAND TOTAL', styles: { fontStyle: 'bold', halign: 'right', textColor: [0, 0, 0] } }, { content: formatRupiah(grandTotal), styles: { fontStyle: 'bold', halign: 'right', textColor: [0, 0, 0] } }]
            ],
            footStyles: {
                fillColor: [255, 255, 255],
                textColor: [33, 33, 33],
                lineColor: [200, 200, 200],
                lineWidth: 0.1
            }
        });

        // --- Signatures Section ---
        let finalY = doc.lastAutoTable.finalY + 25;
        
        // Handle Page Break for Signatures if needed
        if (finalY > 260) {
            doc.addPage();
            finalY = 40;
        }

        const sigWidth = 70;
        const xLeft = 25;
        const xRight = 115;

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");

        // PIC Signature
        doc.text("Dibuat Oleh,", xLeft + (sigWidth/2), finalY, { align: "center" });
        doc.text("PIC Toko / Store Crew", xLeft + (sigWidth/2), finalY + 5, { align: "center" });

        // Contractor Signature
        doc.text("Disetujui Oleh,", xRight + (sigWidth/2), finalY, { align: "center" });
        doc.text("Kontraktor Pelaksana", xRight + (sigWidth/2), finalY + 5, { align: "center" });

        // Space for signing
        doc.setFont("helvetica", "bold");
        doc.text(`( ${user.name || user.username} )`, xLeft + (sigWidth/2), finalY + 35, { align: "center" });
        doc.text("( ....................................... )", xRight + (sigWidth/2), finalY + 35, { align: "center" });

        // Save PDF
        const fileName = `BA_Opname_${store.kode_toko}_${ulok}.pdf`;
        doc.save(fileName);
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
        // --- STEP 1 & 2: ULOK & LINGKUP ---
        if (!AppState.selectedUlok) {
            // (Render Pilihan ULOK - Kode Sama)
            container.innerHTML = '<div class="container text-center" style="padding-top:40px;"><div class="card"><h3>Memuat Data ULOK...</h3></div></div>';
            try {
                const res = await fetch(`${API_BASE_URL}/api/uloks?kode_toko=${AppState.selectedStore.kode_toko}`);
                const data = await res.json();
                AppState.uloks = data;
                if (data.length === 1) { AppState.selectedUlok = data[0]; Render.opnameForm(container); return; }
                container.innerHTML = `<div class="container" style="padding-top:20px;"><div class="card"><button class="btn btn-back" onclick="AppState.activeView='store-selection-pic';Render.app()">Kembali</button><h2>Pilih ULOK</h2><div class="d-flex flex-column gap-2">${data.map(u=>`<button class="btn btn-secondary ulok-btn" data-ulok="${u}">${u}</button>`).join('')}</div></div></div>`;
                container.querySelectorAll('.ulok-btn').forEach(b=>{b.onclick=()=>{AppState.selectedUlok=b.dataset.ulok;Render.opnameForm(container)}});
            } catch(e){container.innerHTML=`<div class="alert-error">${e.message}</div>`}
            return;
        }
        if (!AppState.selectedLingkup) {
            container.innerHTML = `<div class="container" style="padding-top:40px;"><div class="card text-center"><h2>Pilih Lingkup</h2><div style="margin:20px;"><button class="btn btn-primary" id="btn-sipil">SIPIL</button> <button class="btn btn-info" id="btn-me">ME</button></div><button class="btn btn-back" onclick="AppState.selectedUlok=null;Render.opnameForm(container)">Kembali</button></div></div>`;
            container.querySelector('#btn-sipil').onclick=()=>{AppState.selectedLingkup='SIPIL';Render.opnameForm(container)};
            container.querySelector('#btn-me').onclick=()=>{AppState.selectedLingkup='ME';Render.opnameForm(container)};
            return;
        }

        // --- STEP 3: RENDER TABLE ---
        container.innerHTML = '<div class="loading-screen"><h3>Memuat...</h3></div>';
        try {
            const base = `${API_BASE_URL}/api/opname?kode_toko=${encodeURIComponent(AppState.selectedStore.kode_toko)}&no_ulok=${encodeURIComponent(AppState.selectedUlok)}&lingkup=${encodeURIComponent(AppState.selectedLingkup)}`;
            const res = await fetch(base);
            const data = await res.json();
            
            // MAPPING DATA
            AppState.opnameItems = data.map((task, index) => {
                const volRab = toNumInput(task.vol_rab);
                const volAkhirNum = toNumInput(task.volume_akhir);
                const hargaMaterial = toNumID(task.harga_material);
                const hargaUpah = toNumID(task.harga_upah);
                
                // LOGIC UPDATE: Total Harga = (Volume Akhir - RAB) * Harga Satuan
                // Jika Volume Akhir < RAB, maka Total Harga akan Minus (Negatif)
                const selisihNum = volAkhirNum - volRab;
                const total_harga = selisihNum * (hargaMaterial + hargaUpah);
                
                const alreadySubmitted = task.isSubmitted === true || !!task.item_id || ["PENDING", "APPROVED", "REJECTED"].includes(String(task.approval_status || "").toUpperCase());
                
                return { 
                    ...task, 
                    id: index + 1, 
                    harga_material: hargaMaterial, 
                    harga_upah: hargaUpah, 
                    isSubmitted: alreadySubmitted, 
                    volume_akhir: alreadySubmitted ? String(volAkhirNum) : "", 
                    selisih: (Math.round((selisihNum + Number.EPSILON) * 100) / 100).toFixed(2), 
                    total_harga,
                    catatan: task.catatan || "",
                    approval_status: task.approval_status || (alreadySubmitted ? "Pending" : "")
                };
            });

            // CHECK STATUS FINAL (Sama seperti sebelumnya)
            let isFinalized = false, canFinalize = false, statusMessage = "Menunggu Approval Semua Item";
            try {
                const stRes = await fetch(`https://sparta-backend-5hdj.onrender.com/api/check_status_item_opname?no_ulok=${AppState.selectedUlok}&lingkup_pekerjaan=${AppState.selectedLingkup}`);
                const stData = await stRes.json();
                if (stData.status === "approved") {
                    if (stData.tanggal_opname_final) { isFinalized = true; statusMessage = "Opname Selesai (Final)"; }
                    else { canFinalize = true; statusMessage = "Opname Final"; }
                }
            } catch (err) {}

            const renderTable = () => {
                const items = AppState.opnameItems;
                const totalVal = items.reduce((sum, i) => sum + (i.total_harga || 0), 0);
                const ppn = totalVal * 0.11;
                const grandTotal = totalVal * 1.11;
                const btnColor = isFinalized ? '#28a745' : canFinalize ? '#007bff' : '#6c757d';

                const html = `
                <div class="container" style="padding-top:20px; padding-left:10px; padding-right:10px; max-width:100%;">
                    <div class="card" style="border-radius:0;">
                        <div class="d-flex align-center gap-2" style="margin-bottom:20px;">
                            <button id="btn-back-main" class="btn btn-back">← Kembali</button>
                            <div>
                                <h2 style="color:var(--primary); margin:0;">Input Opname</h2>
                                <span style="color:#666;">${AppState.selectedStore.nama_toko} (ULOK: ${AppState.selectedUlok})</span>
                            </div>
                        </div>

                        <div class="table-container" style="overflow-x:auto;">
                            <table style="width:100%; min-width:1400px; border-collapse:collapse;">
                                <thead>
                                    <tr style="background:var(--primary); color:white;">
                                        <th style="padding:10px;">Kategori</th><th style="padding:10px;">Jenis Pekerjaan</th>
                                        <th class="text-center">Vol RAB</th><th class="text-center">Sat</th>
                                        <th class="text-right">Harga Material</th><th class="text-right">Harga Upah</th>
                                        <th class="text-center">Vol Akhir</th><th class="text-center">Selisih</th>
                                        <th class="text-right">Total Harga</th>
                                        <th class="text-center">Foto</th><th style="padding:10px;">Catatan</th>
                                        <th class="text-center">Status</th><th class="text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${items.map(item => `
                                        <tr style="border-bottom:1px solid #ddd; background:${item.isSubmitted?'#f0fff0':''}">
                                            <td style="padding:10px;">${item.kategori_pekerjaan}</td>
                                            <td style="padding:10px;">${item.jenis_pekerjaan}</td>
                                            <td class="text-center">${item.vol_rab}</td><td class="text-center">${item.satuan}</td>
                                            <td class="text-right">${formatRupiah(item.harga_material)}</td><td class="text-right">${formatRupiah(item.harga_upah)}</td>
                                            
                                            <td class="text-center">
                                                <input type="number" class="form-input vol-input" data-id="${item.id}" value="${item.volume_akhir}" 
                                                style="width:80px; text-align:center;" ${item.isSubmitted?'disabled':''}>
                                            </td>
                                            
                                            <td class="text-center font-bold" style="color:${parseFloat(item.selisih)<0?'red':'green'}">
                                                ${(item.volume_akhir!=='')?item.selisih:'-'}
                                            </td>
                                            
                                            <td class="text-right font-bold" id="total-${item.id}" style="color:${item.total_harga<0?'red':'black'}">
                                                ${formatRupiah(item.total_harga)}
                                            </td>
                                            
                                            <td class="text-center">
                                                ${item.foto_url ? `<a href="${item.foto_url}" target="_blank">Lihat</a>` : 
                                                (!item.isSubmitted ? `<input type="file" class="file-input" data-id="${item.id}" id="f-${item.id}" hidden><label for="f-${item.id}" class="btn btn-sm btn-outline">Upload</label>`:'-')}
                                            </td>
                                            <td>${item.catatan||'-'}</td>
                                            <td class="text-center"><span class="badge badge-success">${item.approval_status||'-'}</span></td>
                                            <td class="text-center">
                                                ${!item.isSubmitted ? `<button class="btn btn-primary btn-sm save-btn" data-id="${item.id}">Simpan</button>` : 
                                                item.approval_status==='REJECTED' ? `<button class="btn btn-warning btn-sm perbaiki-btn" data-id="${item.id}">Perbaiki</button>` : 'Saved'}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>

                        <div style="margin-top:20px; padding:15px; background:#f8f9fa;">
                            <div class="d-flex justify-between"><span>Total Harga:</span> <b style="color:${totalVal<0?'red':'black'}">${formatRupiah(totalVal)}</b></div>
                            <div class="d-flex justify-between"><span>PPN 11%:</span> <b style="color:${ppn<0?'red':'black'}">${formatRupiah(ppn)}</b></div>
                            <div class="d-flex justify-between" style="font-size:1.2rem; margin-top:10px;"><span>Grand Total:</span> <b style="color:${grandTotal<0?'red':'black'}">${formatRupiah(grandTotal)}</b></div>
                        </div>

                        <button id="btn-final" class="btn" style="width:100%; margin-top:20px; background:${btnColor}; color:white;" ${(!canFinalize||isFinalized)?'disabled':''}>${statusMessage}</button>
                    </div>
                </div>`;
                
                container.innerHTML = html;
                
                // EVENT HANDLERS
                container.querySelector('#btn-back-main').onclick = () => { AppState.selectedLingkup = null; Render.opnameForm(container); };

                // Handle Input Volume
                container.querySelectorAll('.vol-input').forEach(input => {
                    input.oninput = (e) => {
                        const id = parseInt(e.target.dataset.id);
                        const item = AppState.opnameItems.find(i => i.id === id);
                        item.volume_akhir = e.target.value;
                        
                        const vAkhir = toNumInput(item.volume_akhir);
                        const vRab = toNumInput(item.vol_rab);
                        
                        // LOGIC UTAMA: Total Harga berdasarkan Selisih
                        const selisihNum = vAkhir - vRab;
                        item.selisih = selisihNum.toFixed(2);
                        item.total_harga = selisihNum * (item.harga_material + item.harga_upah);

                        // Update UI Baris
                        const row = input.closest('tr');
                        row.cells[7].innerHTML = `<b style="color:${selisihNum<0?'red':'green'}">${item.selisih}</b>`;
                        const totEl = document.getElementById(`total-${id}`);
                        totEl.innerText = formatRupiah(item.total_harga);
                        totEl.style.color = item.total_harga < 0 ? 'red' : 'black';

                        // Update Summary
                        renderTable(); // Re-render simple for summary update (bisa dioptimalkan partial update jika lambat)
                    }
                });

                // (Handle Upload & Simpan tetap sama seperti sebelumnya, disederhanakan di sini untuk brevity)
                container.querySelectorAll('.file-input').forEach(inp => {
                    inp.onchange = async (e) => {
                        const f = e.target.files[0];
                        if(!f) return;
                        const id = parseInt(e.target.dataset.id);
                        const fd = new FormData(); fd.append("file", f);
                        try {
                            const r = await fetch(`${API_BASE_URL}/api/upload`, { method:"POST", body:fd });
                            const d = await r.json();
                            AppState.opnameItems.find(i=>i.id===id).foto_url = d.link;
                            renderTable();
                        } catch(err) { alert("Upload gagal"); }
                    }
                });

                container.querySelectorAll('.save-btn').forEach(btn => {
                    btn.onclick = async () => {
                        const id = parseInt(btn.dataset.id);
                        const item = AppState.opnameItems.find(i=>i.id===id);
                        if(!item.volume_akhir) { alert("Isi volume akhir!"); return; }
                        btn.innerText="..."; btn.disabled=true;
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
                                total_harga_akhir: item.total_harga, // Kirim Total Harga (Deviasi)
                                lingkup_pekerjaan: AppState.selectedLingkup,
                                is_il: item.is_il
                            };
                            await fetch(`${API_BASE_URL}/api/opname/item/submit`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)});
                            item.isSubmitted=true; item.approval_status="Pending";
                            renderTable();
                        } catch(e) { alert(e.message); btn.disabled=false; btn.innerText="Simpan"; }
                    }
                });

                if(canFinalize && !isFinalized) {
                    const bf = container.querySelector('#btn-final');
                    bf.onclick = async () => {
                        if(!confirm("Yakin finalisasi?")) return;
                        bf.innerText="Processing..."; bf.disabled=true;
                        try {
                            const r = await fetch(`https://sparta-backend-5hdj.onrender.com/api/opname_locked`, {
                                method:"POST", headers:{"Content-Type":"application/json"},
                                body:JSON.stringify({ status:"locked", ulok:AppState.selectedUlok, lingkup_pekerjaan:AppState.selectedLingkup })
                            });
                            const d = await r.json();
                            if(r.ok) { alert("Berhasil!"); isFinalized=true; canFinalize=false; Render.opnameForm(container); }
                            else { alert(d.message); bf.disabled=false; bf.innerText="Opname Final"; }
                        } catch(e) { alert(e.message); bf.disabled=false; }
                    }
                }
            };
            renderTable();

        } catch(e) { container.innerHTML=`<div class="alert-error">${e.message}</div>`; }
    },

    finalOpnameView: async (container) => {
        // --- STEP 1: PILIH ULOK ---
        if (!AppState.selectedUlok) {
            // (Bagian ini Tetap Sama)
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
            // (Bagian ini Tetap Sama)
            container.innerHTML = `
                <div class="container" style="padding-top:40px;">
                    <div class="card text-center" style="max-width:600px; margin:0 auto;">
                        <h2 style="color:var(--primary);">Pilih Lingkup Laporan</h2>
                        <div class="badge badge-success" style="margin:10px auto; display:inline-block;">ULOK: ${AppState.selectedUlok}</div>
                        
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

        // --- STEP 3: FETCH DATA FINAL (/api/opname/final) ---
        container.innerHTML = '<div class="container text-center" style="padding-top:40px;"><div class="card"><h3>Memuat Data Opname Final...</h3></div></div>';
        
        try {
            // UPDATE: Menggunakan endpoint /api/opname/final sesuai React Repo
            const url = `${API_BASE_URL}/api/opname/final?kode_toko=${encodeURIComponent(AppState.selectedStore.kode_toko)}&no_ulok=${encodeURIComponent(AppState.selectedUlok)}&lingkup=${encodeURIComponent(AppState.selectedLingkup)}`;
            
            const res = await fetch(url);
            const rawData = await res.json();
            const submissions = Array.isArray(rawData) ? rawData : [];

            if (submissions.length === 0) {
                 container.innerHTML = `
                    <div class="container" style="padding-top:40px;">
                        <div class="card text-center">
                            <div style="font-size:50px; margin-bottom:20px;">📭</div>
                            <h2 style="color:#666;">Data Tidak Ditemukan</h2>
                            <p>Belum ada data opname <b>FINAL</b> untuk <b>${AppState.selectedLingkup}</b> di ULOK ini.</p>
                            <br>
                            <button class="btn btn-back" id="btn-back-empty">Kembali</button>
                        </div>
                    </div>
                `;
                container.querySelector('#btn-back-empty').onclick = () => { AppState.selectedLingkup = null; Render.finalOpnameView(container); };
                return;
            }

            // Mapping Data untuk kalkulasi & Tampilan
            const items = submissions.map((task, index) => {
                // Pastikan handle angka dengan aman
                const volAkhirNum = toNumInput(task.volume_akhir);
                const hargaMaterial = toNumID(task.harga_material);
                const hargaUpah = toNumID(task.harga_upah);
                const total_harga = volAkhirNum * (hargaMaterial + hargaUpah);
                
                return { 
                    ...task, 
                    total_harga, 
                    vol_akhir_num: volAkhirNum, 
                    harga_satuan: hargaMaterial + hargaUpah 
                };
            });

            // Kalkulasi Grand Total untuk Summary
            const totalBiaya = items.reduce((sum, i) => sum + i.total_harga, 0);
            const ppn = totalBiaya * 0.11;
            const grandTotal = totalBiaya * 1.11;

            const html = `
                <div class="container" style="padding-top:20px;">
                    <div class="card">
                        <div class="d-flex align-center gap-2" style="margin-bottom:20px; border-bottom:2px solid #eee; padding-bottom:15px; flex-wrap:wrap;">
                            <button id="btn-back-final-view" class="btn btn-back">← Dashboard</button>
                            <div style="flex:1;">
                                <h2 style="color:var(--primary); margin:0;">Riwayat Opname Final</h2>
                                <span style="font-size:0.9rem; color:#64748b;">
                                    ${AppState.selectedStore.nama_toko} • ULOK: ${AppState.selectedUlok} • ${AppState.selectedLingkup}
                                </span>
                            </div>
                            <button id="btn-download-pdf" class="btn btn-primary">
                                📄 Download PDF
                            </button>
                        </div>

                        <div class="table-container">
                            <table style="width:100%;">
                                <thead>
                                    <tr style="background:#f1f5f9; color:#334155;">
                                        <th style="padding:12px;">Kategori</th>
                                        <th style="padding:12px;">Jenis Pekerjaan</th>
                                        <th class="text-center">Vol Akhir</th>
                                        <th class="text-center">Status</th>
                                        <th class="text-center">Tgl Submit</th>
                                        <th class="text-center">PIC</th>
                                        <th class="text-center">Kontraktor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${items.map((item, idx) => `
                                        <tr style="border-bottom:1px solid #eee;">
                                            <td style="padding:12px; font-weight:600; color:#64748b;">${item.kategori_pekerjaan}</td>
                                            <td style="padding:12px;">${item.jenis_pekerjaan}</td>
                                            <td class="text-center font-bold">
                                                ${item.volume_akhir} ${item.satuan}
                                            </td>
                                            <td class="text-center">
                                                <span class="badge badge-success" style="font-size:11px;">${item.approval_status || 'Approved'}</span>
                                            </td>
                                            <td class="text-center" style="font-size:0.9rem;">
                                                ${item.tanggal_submit || '-'}
                                            </td>
                                            <td class="text-center" style="font-size:0.9rem;">
                                                ${item.pic_name || item.pic_username || '-'}
                                            </td>
                                            <td class="text-center" style="font-size:0.9rem;">
                                                ${item.kontraktor_name || item.display_kontraktor || item.kontraktor_username || '-'}
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>

                        <div style="margin-top:20px; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                            <div class="d-flex justify-between" style="max-width:400px; margin-left:auto;">
                                <span>Total Estimasi:</span> 
                                <strong>${formatRupiah(totalBiaya)}</strong>
                            </div>
                        </div>

                    </div>
                </div>
            `;
            container.innerHTML = html;

            container.querySelector('#btn-back-final-view').onclick = () => { AppState.selectedLingkup = null; AppState.selectedUlok = null; AppState.activeView = 'dashboard'; Render.app(); };
            
            // PDF Button Action
            container.querySelector('#btn-download-pdf').onclick = () => {
                const btn = document.getElementById('btn-download-pdf');
                btn.innerText = "Memproses PDF...";
                btn.disabled = true;
                setTimeout(() => {
                    // Pastikan fungsi PDFGenerator mendukung data ini
                    PDFGenerator.generateFinalOpnamePDF(items, AppState.selectedStore, AppState.selectedUlok, AppState.selectedLingkup, AppState.user);
                    btn.innerText = "📄 Download PDF";
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