/* =========================================
   CONSTANTS & CONFIG
   ========================================= */
const SHEETS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyUpg_II5NKNw1YFSyWiTiVBLKuNdnawunFRJJCJeCs4sWwjX3fB7sKi-tefj8-lSn8mQ/exec"; 
const LOCAL_KEY_DOCS = "materai_docs";

// Konfigurasi Branch Group
const BRANCH_GROUPS = {
    "LOMBOK": ["LOMBOK", "SUMBAWA"],
    "MEDAN": ["MEDAN", "ACEH"],
    "LAMPUNG": ["LAMPUNG", "LAMPUNG_KOTABUMI"],
    "PALEMBANG": ["PALEMBANG", "BENGKULU", "BANGKA", "BELITUNG"],
    "SIDOARJO": ["SIDOARJO", "SIDOARJO BPN_SMD", "MANOKWARI", "NTT", "SORONG"]
};

/* =========================================
   UTILS
   ========================================= */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64String = reader.result.split(",")[1];
            resolve({
                name: file.name,
                mimeType: file.type,
                size: file.size,
                base64: base64String,
                extension: file.name.split(".").pop(),
            });
        };
        reader.onerror = (error) => reject(error);
    });
}

function getSession() {
    const isAuth = sessionStorage.getItem("authenticated");
    if (isAuth === "true") {
        return {
            email: sessionStorage.getItem("loggedInUserEmail"),
            cabang: sessionStorage.getItem("loggedInUserCabang"), 
            role: sessionStorage.getItem("userRole"),
            name: sessionStorage.getItem("loggedInUserEmail") // Fallback
        };
    }
    return null;
}

function getSessionCabang() {
    const sess = getSession();
    return sess ? String(sess.cabang || "").trim() : "";
}

/* =========================================
   API SERVICES
   ========================================= */
const Api = {
    async createDocument(payload) {
        if (!SHEETS_WEB_APP_URL) {
            // Local fallback simulation
            return new Promise(r => setTimeout(() => r(payload), 1000));
        }

        const res = await fetch(SHEETS_WEB_APP_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "create", data: payload }),
        });

        if (!res.ok) throw new Error("Gagal mengirim ke Google Apps Script");
        const json = await res.json();
        if (!json?.ok) throw new Error(json?.message || "Gagal menyimpan data");
        return json.data;
    },

    async listDocuments(filters = {}) {
        // Gunakan cabang dari filter (jika ada) atau cabang session
        const targetCabang = filters.cabang || getSessionCabang();
        if (!targetCabang) throw new Error("Cabang belum diinput.");

        const url = new URL(SHEETS_WEB_APP_URL);
        url.searchParams.set("action", "list");
        url.searchParams.set("cabang", targetCabang);
        if (filters.ulok) url.searchParams.set("ulok", filters.ulok);
        if (filters.lingkup) url.searchParams.set("lingkup", filters.lingkup);

        const res = await fetch(url.toString());
        const json = await res.json();
        if (!json.ok) throw new Error(json.message || "Gagal memuat dokumen");
        return json.data;
    },

    async getOptions(mode, extraParams = {}) {
        const sessionCabang = getSessionCabang();
        if (!sessionCabang) throw new Error("Cabang belum diinput.");
        
        // Handle Branch Group atau multiple cabang dengan koma
        let userBranches = [];
        if (sessionCabang.includes(',')) {
            userBranches = sessionCabang.split(',').map(c => c.trim()).filter(c => c);
        } else {
            userBranches = BRANCH_GROUPS[sessionCabang] || [sessionCabang];
        }
        
        // Return daftar cabang jika mode adalah 'cabang'
        if (mode === 'cabang') {
            return userBranches;
        }
        
        // Untuk fetch ulok/lingkup, gunakan cabang yang spesifik (dari dropdown)
        const targetCabang = extraParams.cabang || sessionCabang;
        
        const url = new URL(SHEETS_WEB_APP_URL);
        url.searchParams.set("action", "options");
        url.searchParams.set("mode", mode);
        url.searchParams.set("cabang", targetCabang);
        if (extraParams.ulok) url.searchParams.set("ulok", extraParams.ulok);

        const res = await fetch(url.toString());
        const json = await res.json();
        if (!json.ok) throw new Error(json.message || `Gagal ambil ${mode}`);
        return json.data;
    }
};

/* =========================================
   ROUTER & APP STATE
   ========================================= */
const app = document.getElementById("app");

function navigate(path, replace = false) {
    if (replace) {
        history.replaceState({ path }, "", "#" + path);
    } else {
        history.pushState({ path }, "", "#" + path);
    }
    render();
}

function render() {
    const hash = window.location.hash.slice(1) || "/";
    const user = getSession();

    // Guard: Redirect ke Auth jika belum login
    if (!user) {
        window.location.href = "../auth/index.html"; 
        return;
    }

    // Redirect root to dashboard
    if (hash === "/") {
        return navigate("/dashboard", true);
    }

    renderLayout(user, hash);
}

/* =========================================
   COMPONENT RENDERERS
   ========================================= */

// 1. Header & User Pill
function getHeaderHTML(user) {
    return `
    <header class="app-header">
        <img src="../../assets/Alfamart-Emblem.png" alt="Logo" class="header-logo">
        <h1>Dokumen Termaterai</h1>
        <div>
            <a href="../dashboard/index.html" class="btn-header-back">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
                <span>Dashboard</span>
            </a>
        </div>
    </header>

    <div class="user-greeting-wrapper">
        <div class="user-pill">
            <span>Semangat Pagi, <strong>${user.name.split('@')[0]}</strong> | ${user.role || 'User'} (${user.cabang})</span>
        </div>
    </div>
    `;
}

// 2. Layout Wrapper
function renderLayout(user, path) {
    app.innerHTML = `
        ${getHeaderHTML(user)}
        <main class="container" id="mainContent"></main>
    `;

    const main = document.getElementById("mainContent");
    if (path === "/dashboard") renderDashboard(main);
    else if (path === "/buat-dokumen") renderCreateDocument(main);
    else if (path === "/hasil-dokumen") renderViewResults(main);
    else navigate("/dashboard", true);
}

// 3. Dashboard Page
function renderDashboard(container) {
    container.innerHTML = `
    <div class="menu-grid">
        <div class="menu-card" onclick="navigate('/buat-dokumen')">
            <div class="menu-icon">📝</div>
            <div class="menu-title">Buat Dokumen</div>
            <div class="menu-desc">Unggah RAB & SPH Termaterai</div>
        </div>
        <div class="menu-card" onclick="navigate('/hasil-dokumen')">
            <div class="menu-icon">📂</div>
            <div class="menu-title">Hasil Dokumen</div>
            <div class="menu-desc">Lihat dan unduh dokumen tersimpan</div>
        </div>
    </div>`;
}

// 4. Create Document Page
function renderCreateDocument(container) {
    container.innerHTML = `
    <div class="card">
        <div class="page-header">
            <h2 class="page-title">Buat Dokumen</h2>
            <button class="btn-secondary" onclick="navigate('/dashboard')">Kembali</button>
        </div>
        
        <div id="savingOverlay" class="loading-overlay" style="display: none;">
            <div class="spinner"></div>
            <div style="margin-top: 12px; font-weight: 600;">Mengunggah & menyimpan…</div>
        </div>

        <form id="createForm">
            <div class="row">
                <div class="col">
                    <label>Cabang</label>
                    <select id="selCabang" disabled><option>Loading...</option></select>
                </div>
                <div class="col">
                    <label>Nomor Ulok</label>
                    <select id="selUlok" disabled required><option value="">Pilih nomor ulok…</option></select>
                </div>
                <div class="col">
                    <label>Lingkup Kerja</label>
                    <select id="selLingkup" disabled required><option value="">Pilih lingkup…</option></select>
                </div>
            </div>

            <div style="margin-top: 12px; margin-bottom: 20px;">
                <a href="https://pdf-combine-beta.vercel.app/" target="_blank" 
                    style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 8px; background-color: #f57c00; color: #fff; text-decoration: none; font-weight: 500;">
                    <span>🔗 Gabungkan PDF (RAB + SPH)</span>
                </a>
            </div>

            <div style="margin-bottom: 20px;">
                <label>Upload File Termaterai (PDF)</label>
                <input type="file" id="fileRab" accept=".pdf,application/pdf" required />
                <small style="display: block; margin-top: 6px; color: #666;">Pastikan dokumen sudah digabung dan termeterai.</small>
            </div>

            <div id="formMsg" class="error-box"></div>

            <div style="margin-top: 24px;">
                <button type="submit" id="btnSubmit">Simpan Dokumen</button>
            </div>
        </form>
    </div>`;

    const selCabang = document.getElementById("selCabang");
    const selUlok = document.getElementById("selUlok");
    const selLingkup = document.getElementById("selLingkup");
    const fileRab = document.getElementById("fileRab");
    const form = document.getElementById("createForm");
    const msg = document.getElementById("formMsg");
    const overlay = document.getElementById("savingOverlay");
    const btnSubmit = document.getElementById("btnSubmit");
    let rabFileObj = null;

    // Inisialisasi Dropdown Cabang
    (async () => {
        try {
            const opts = await Api.getOptions('cabang');
            if (opts.length > 1) {
                // Branch Group: Bisa pilih cabang
                selCabang.innerHTML = '<option value="">Pilih Cabang…</option>' + opts.map(c => `<option value="${c}">${c}</option>`).join('');
                selCabang.disabled = false;
                
                selCabang.addEventListener('change', () => {
                    selUlok.innerHTML = '<option value="">Pilih nomor ulok…</option>';
                    selLingkup.innerHTML = '<option value="">Pilih lingkup…</option>';
                    selUlok.disabled = true;
                    selLingkup.disabled = true;
                    if (selCabang.value) loadUlok(selCabang.value);
                });
            } else {
                // Single Cabang: Terkunci
                selCabang.innerHTML = opts.map(c => `<option value="${c}">${c}</option>`).join('');
                selCabang.disabled = true;
                if (opts.length > 0) loadUlok(opts[0]);
            }
        } catch (e) {
            msg.textContent = e.message; msg.style.display = "block";
        }
    })();

    async function loadUlok(cabangValue) {
        try {
            selUlok.innerHTML = '<option value="">Loading...</option>';
            const opts = await Api.getOptions('ulok', { cabang: cabangValue });
            selUlok.innerHTML = '<option value="">Pilih nomor ulok…</option>' + opts.map(u => `<option value="${u}">${u}</option>`).join('');
            selUlok.disabled = false;
        } catch (e) { console.error(e); }
    }

    selUlok.addEventListener("change", async () => {
        const val = selUlok.value;
        const currentCabang = selCabang.value;
        selLingkup.innerHTML = '<option value="">Pilih lingkup…</option>';
        selLingkup.disabled = true;
        if (!val) return;
        try {
            selLingkup.innerHTML = '<option value="">Loading...</option>';
            const opts = await Api.getOptions('lingkup', { ulok: val, cabang: currentCabang });
            selLingkup.innerHTML = '<option value="">Pilih lingkup…</option>' + opts.map(l => `<option value="${l}">${l}</option>`).join('');
            selLingkup.disabled = false;
        } catch (e) { console.error(e); }
    });

    fileRab.addEventListener("change", (e) => {
        const f = e.target.files[0];
        rabFileObj = f && (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) ? f : null;
        if (!rabFileObj && f) { alert("File harus PDF."); e.target.value = ""; }
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        msg.style.display = "none";
        
        // Validasi Branch Group
        if (!selCabang.disabled && !selCabang.value) {
            return alert("Silakan pilih Cabang terlebih dahulu.");
        }
        if (!rabFileObj) return alert("Pilih file PDF.");
        
        overlay.style.display = "flex";
        btnSubmit.disabled = true;

        try {
            const base64Data = await fileToBase64(rabFileObj);
            await Api.createDocument({
                cabang: selCabang.value.trim(),
                ulok: selUlok.value.trim(),
                lingkup: selLingkup.value.trim(),
                docKind: "RAB",
                file: base64Data
            });

            alert("Dokumen berhasil disimpan!");
            navigate('/dashboard'); // Balik ke menu utama
        } catch (err) {
            msg.textContent = err.message || "Gagal menyimpan.";
            msg.style.display = "block";
        } finally {
            overlay.style.display = "none";
            btnSubmit.disabled = false;
        }
    });
}

// 5. View Results Page
function renderViewResults(container) {
    container.innerHTML = `
    <div class="card">
        <div class="page-header">
            <h2 class="page-title">Hasil Dokumen Termaterai</h2>
            <button class="btn-secondary" onclick="navigate('/dashboard')">Kembali</button>
        </div>
        <div class="filters-grid">
            <div class="field">
                <label>Pilih Cabang</label>
                <select id="filterCabang" disabled><option>Loading...</option></select>
            </div>
            <div class="field">
                <label>Pilih Nomor Ulok</label>
                <select id="filterUlok" disabled><option value="">Semua</option></select>
            </div>
            <div class="field">
                <label>Pilih Lingkup Kerja</label>
                <select id="filterLingkup" disabled><option value="">Semua</option></select>
            </div>
        </div>

        <div class="actions">
            <button id="btnApply" class="primary">Terapkan Filter</button>
            <button id="btnReset" class="btn-warning">Reset Filter</button>
        </div>

        <div id="resultsWrapper" style="display:none; position: relative; min-height: 100px;">
            <div id="loadingTable" class="loading-overlay" style="display:none; position: absolute; background: rgba(255,255,255,0.9);">
                <div class="spinner" style="width: 40px; height: 40px; border-width: 4px;"></div>
                <div style="margin-top: 10px; font-weight: 500;">Memuat data…</div>
            </div>
            
            <div id="tableContent"></div>
        </div>
    </div>`;

    const fCabang = document.getElementById("filterCabang");
    const fUlok = document.getElementById("filterUlok");
    const fLingkup = document.getElementById("filterLingkup");
    const btnApply = document.getElementById("btnApply");
    const btnReset = document.getElementById("btnReset");
    const wrapper = document.getElementById("resultsWrapper");
    const loader = document.getElementById("loadingTable");
    const content = document.getElementById("tableContent");

    // Init Logic & Branch Group Handling
    (async () => {
        try {
            const ops = await Api.getOptions('cabang');
            if (ops.length > 1) {
                fCabang.innerHTML = '<option value="">Pilih Cabang…</option>' + ops.map(v => `<option value="${v}">${v}</option>`).join('');
                fCabang.disabled = false;
                
                fCabang.addEventListener('change', () => {
                    fUlok.innerHTML = '<option value="">Semua</option>';
                    fLingkup.innerHTML = '<option value="">Semua</option>';
                    fUlok.disabled = true;
                    fLingkup.disabled = true;
                    if (fCabang.value) loadUlokFilter(fCabang.value);
                });
            } else {
                fCabang.innerHTML = ops.map(v => `<option value="${v}">${v}</option>`).join('');
                fCabang.disabled = true;
                if (ops.length) loadUlokFilter(ops[0]);
            }
        } catch (e) { alert(e.message); }

        setInterval(() => {
            const now = new Date();
            const hr = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: "Asia/Jakarta", hour: '2-digit', hour12: false }).format(now));
            if (hr < 6 || hr >= 20) {
                sessionStorage.clear();
                alert("Sesi berakhir (06:00 - 20:00 WIB).");
                window.location.href = "/";
            }
        }, 300000);
    })();

    async function loadUlokFilter(cabangValue) {
        fUlok.innerHTML = '<option>Loading...</option>';
        fUlok.disabled = true;
        const ops = await Api.getOptions('ulok', { cabang: cabangValue });
        fUlok.innerHTML = '<option value="">Semua</option>' + ops.map(v => `<option value="${v}">${v}</option>`).join('');
        fUlok.disabled = false;
    }

    fUlok.addEventListener("change", async () => {
        if (!fUlok.value) {
            fLingkup.innerHTML = '<option value="">Semua</option>';
            fLingkup.disabled = true;
            return;
        }
        fLingkup.disabled = true;
        const currentCabang = fCabang.value;
        const ops = await Api.getOptions('lingkup', { ulok: fUlok.value, cabang: currentCabang });
        fLingkup.innerHTML = '<option value="">Semua</option>' + ops.map(v => `<option value="${v}">${v}</option>`).join('');
        fLingkup.disabled = false;
    });

    btnReset.addEventListener("click", () => {
        fUlok.value = "";
        fLingkup.innerHTML = '<option value="">Semua</option>';
        fLingkup.disabled = true;
        if (!fCabang.disabled) fCabang.value = ""; // Reset branch group jika ada
        wrapper.style.display = "none";
        content.innerHTML = "";
    });

    btnApply.addEventListener("click", async () => {
        if (!fCabang.disabled && !fCabang.value) {
            alert("Silakan pilih cabang terlebih dahulu.");
            return;
        }

        wrapper.style.display = "block";
        loader.style.display = "flex";
        content.innerHTML = ""; 
        
        try {
            const data = await Api.listDocuments({
                cabang: fCabang.disabled ? fCabang.options[0].value : fCabang.value,
                ulok: fUlok.value,
                lingkup: fLingkup.value
            });
            renderTable(data);
        } catch (e) {
            content.innerHTML = `<div style="padding:20px; text-align:center; color:red;">${e.message}</div>`;
        } finally {
            loader.style.display = "none";
        }
    });

    // Render Tabel
    function renderTable(items) {
        if (!items.length) {
            content.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">Tidak ada data.</div>';
            return;
        }

        // Helper Button Style
        const getLinks = (it) => {
            const viewUrl = it.driveViewUrl || it.previewUrl;
            const downloadUrl = it.driveDownloadUrl || it.downloadUrl || viewUrl;

            if (!viewUrl) return '-';

            return `
                <div class="action-buttons-wrapper">
                    <a href="${viewUrl}" target="_blank" class="btn-action view" title="Lihat Dokumen">
                       Lihat
                    </a>
                    <a href="${downloadUrl}" target="_blank" class="btn-action download" title="Unduh Dokumen">
                       Unduh
                    </a>
                </div>
            `;
        };

        let html = `
        <table class="table desktop-table">
            <thead>
                <tr>
                    <th style="width: 30%;">Nomor Ulok</th>
                    <th style="width: 30%;">Lingkup Kerja</th>
                    <th style="width: 40%;">Aksi</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(it => `
                    <tr>
                        <td class="break">${it.ulok}</td>
                        <td>${it.lingkup}</td>
                        <td>${getLinks(it)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;

        // Mobile Cards
        html += `<div class="mobile-cards">
            ${items.map(it => `
                <div class="m-card">
                    <div class="m-row"><span class="m-label">Ulok</span><span class="m-value">${it.ulok}</span></div>
                    <div class="m-row"><span class="m-label">Lingkup</span><span class="m-value">${it.lingkup}</span></div>
                    <div class="m-actions" style="margin-top:12px; border-top:1px dashed #eee; padding-top:12px;">
                        ${getLinks(it)}
                    </div>
                </div>
            `).join('')}
        </div>`;

        content.innerHTML = html;
    }
}

/* =========================================
    BOOTSTRAP
   ========================================= */
window.addEventListener("DOMContentLoaded", render);
window.addEventListener("hashchange", render);
window.navigate = navigate;