/* =========================================
   CONSTANTS & CONFIG
   ========================================= */
const SHEETS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyUpg_II5NKNw1YFSyWiTiVBLKuNdnawunFRJJCJeCs4sWwjX3fB7sKi-tefj8-lSn8mQ/exec"; 
const LOCAL_KEY_DOCS = "materai_docs";

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
        const sessionCabang = getSessionCabang();
        if (!sessionCabang) throw new Error("Cabang belum diinput.");

        const url = new URL(SHEETS_WEB_APP_URL);
        url.searchParams.set("action", "list");
        url.searchParams.set("cabang", sessionCabang);
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
        
        if (mode === 'cabang') return [sessionCabang];
        
        const url = new URL(SHEETS_WEB_APP_URL);
        url.searchParams.set("action", "options");
        url.searchParams.set("mode", mode);
        url.searchParams.set("cabang", sessionCabang);
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

// 1. Header & User Pill (Mirip Opname)
function getHeaderHTML(user) {
    // Tombol di header mengarah ke Dashboard Utama aplikasi (luar fitur materai)
    return `
    <header class="app-header">
        <div class="header-left">
            <img src="../../assets/logoalfamart.png" alt="Logo" class="header-logo">
            <h1 class="header-title">Dokumen Materai</h1>
        </div>
        <div>
            <a href="../dashboard/index.html" class="btn-header-back">
                <span>🏠 App Dashboard</span>
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

// 3. Dashboard Page (Menu Grid di Body)
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

    // Logic form sama seperti sebelumnya...
    const selCabang = document.getElementById("selCabang");
    const selUlok = document.getElementById("selUlok");
    const selLingkup = document.getElementById("selLingkup");
    const fileRab = document.getElementById("fileRab");
    const form = document.getElementById("createForm");
    const msg = document.getElementById("formMsg");
    const overlay = document.getElementById("savingOverlay");
    const btnSubmit = document.getElementById("btnSubmit");
    let rabFileObj = null;

    (async () => {
        try {
            const opts = await Api.getOptions('cabang');
            selCabang.innerHTML = opts.map(c => `<option value="${c}">${c}</option>`).join('');
            selCabang.disabled = true;
            if (opts.length > 0) loadUlok();
        } catch (e) {
            msg.textContent = e.message; msg.style.display = "block";
        }
    })();

    async function loadUlok() {
        try {
            selUlok.innerHTML = '<option value="">Loading...</option>';
            const opts = await Api.getOptions('ulok');
            selUlok.innerHTML = '<option value="">Pilih nomor ulok…</option>' + opts.map(u => `<option value="${u}">${u}</option>`).join('');
            selUlok.disabled = false;
        } catch (e) { console.error(e); }
    }

    selUlok.addEventListener("change", async () => {
        const val = selUlok.value;
        selLingkup.innerHTML = '<option value="">Pilih lingkup…</option>';
        selLingkup.disabled = true;
        if (!val) return;
        try {
            selLingkup.innerHTML = '<option value="">Loading...</option>';
            const opts = await Api.getOptions('lingkup', { ulok: val });
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
            <h2 class="page-title">Hasil Dokumen</h2>
            <button class="btn-secondary" onclick="navigate('/dashboard')">Kembali</button>
        </div>

        <div class="filters-grid">
            <div>
                <label>Cabang</label>
                <select id="filterCabang" disabled><option>Loading...</option></select>
            </div>
            <div>
                <label>Nomor Ulok</label>
                <select id="filterUlok" disabled><option value="">Semua</option></select>
            </div>
            <div>
                <label>Lingkup Kerja</label>
                <select id="filterLingkup" disabled><option value="">Semua</option></select>
            </div>
        </div>

        <div style="margin-bottom: 20px; display: flex; gap: 10px;">
            <button id="btnApply" class="primary" style="width: auto;">Terapkan Filter</button>
            <button id="btnReset" class="btn-secondary" style="width: auto;">Reset</button>
        </div>

        <div id="resultsWrapper" style="position: relative; min-height: 100px;">
             <div id="loadingTable" class="loading-overlay" style="display:none; position: absolute; background: rgba(255,255,255,0.9);">
                <div class="spinner"></div>
            </div>
            <div id="tableContent">
                <div style="text-align:center; color:#888; padding: 40px;">Silakan terapkan filter untuk melihat data.</div>
            </div>
        </div>
    </div>`;

    const fCabang = document.getElementById("filterCabang");
    const fUlok = document.getElementById("filterUlok");
    const fLingkup = document.getElementById("filterLingkup");
    const btnApply = document.getElementById("btnApply");
    const btnReset = document.getElementById("btnReset");
    const loader = document.getElementById("loadingTable");
    const content = document.getElementById("tableContent");

    (async () => {
        try {
            const ops = await Api.getOptions('cabang');
            fCabang.innerHTML = ops.map(v => `<option value="${v}">${v}</option>`).join('');
            loadUlokFilter();
        } catch (e) { alert(e.message); }
    })();

    async function loadUlokFilter() {
        fUlok.innerHTML = '<option>Loading...</option>';
        const ops = await Api.getOptions('ulok');
        fUlok.innerHTML = '<option value="">Semua</option>' + ops.map(v => `<option value="${v}">${v}</option>`).join('');
        fUlok.disabled = false;
    }

    fUlok.addEventListener("change", async () => {
        fLingkup.innerHTML = '<option>Loading...</option>'; fLingkup.disabled = true;
        if (!fUlok.value) { fLingkup.innerHTML = '<option value="">Semua</option>'; return; }
        const ops = await Api.getOptions('lingkup', { ulok: fUlok.value });
        fLingkup.innerHTML = '<option value="">Semua</option>' + ops.map(v => `<option value="${v}">${v}</option>`).join('');
        fLingkup.disabled = false;
    });

    btnApply.addEventListener("click", async () => {
        loader.style.display = "flex";
        try {
            const data = await Api.listDocuments({ ulok: fUlok.value, lingkup: fLingkup.value });
            renderTable(data);
        } catch (e) { content.innerHTML = `<div class="error-box" style="display:block">${e.message}</div>`; }
        finally { loader.style.display = "none"; }
    });

    btnReset.addEventListener("click", () => {
        fUlok.value = ""; fLingkup.innerHTML = '<option value="">Semua</option>'; fLingkup.disabled = true;
        content.innerHTML = '<div style="text-align:center; color:#888; padding: 40px;">Data di-reset.</div>';
    });

    function renderTable(items) {
        if (!items.length) { content.innerHTML = '<div style="padding:20px; text-align:center;">Tidak ada data.</div>'; return; }
        
        let html = `
        <div class="table-responsive">
        <table class="table desktop-table">
            <thead><tr><th>Waktu</th><th>Cabang</th><th>Ulok</th><th>Lingkup</th><th>Aksi</th></tr></thead>
            <tbody>
                ${items.map(it => `
                    <tr>
                        <td>${new Date(it.createdAt).toLocaleString()}</td>
                        <td>${it.cabang}</td>
                        <td>${it.ulok}</td>
                        <td>${it.lingkup}</td>
                        <td>${it.previewUrl ? `<a href="${it.previewUrl}" target="_blank">Lihat</a>` : '-'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        </div>
        <div class="mobile-cards">
            ${items.map(it => `
                <div class="m-card">
                    <div class="m-row"><span class="m-label">Ulok</span><span>${it.ulok}</span></div>
                    <div class="m-row"><span class="m-label">Lingkup</span><span>${it.lingkup}</span></div>
                    <div class="m-row" style="margin-top:8px;">${it.previewUrl ? `<a href="${it.previewUrl}" target="_blank">Buka Dokumen</a>` : ''}</div>
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