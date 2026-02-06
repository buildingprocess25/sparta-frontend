/* =========================================
   CONSTANTS & CONFIG
   ========================================= */
// Masukkan URL Google Apps Script Anda di sini
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
    // INTEGRASI: Cek Session dari Auth Utama (/auth/script.js)
    // Auth module menggunakan sessionStorage
    const isAuth = sessionStorage.getItem("authenticated");
    
    if (isAuth === "true") {
        return {
            email: sessionStorage.getItem("loggedInUserEmail"),
            // Mapping: Auth module menyimpan 'password' sebagai 'loggedInUserCabang'
            cabang: sessionStorage.getItem("loggedInUserCabang"), 
            role: sessionStorage.getItem("userRole"),
            name: sessionStorage.getItem("loggedInUserEmail") // Fallback name
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
    // INTEGRASI: Fungsi login dihapus karena menggunakan Auth eksternal

    async createDocument(payload) {
        // Fallback local jika URL kosong
        if (!SHEETS_WEB_APP_URL) {
            const arr = JSON.parse(localStorage.getItem(LOCAL_KEY_DOCS) || "[]");
            const doc = {
                id: String(Date.now()),
                createdAt: new Date().toISOString(),
                ...payload,
                previewUrl: `data:${payload.file.mimeType};base64,${payload.file.base64}`,
                downloadUrl: `data:${payload.file.mimeType};base64,${payload.file.base64}`,
                source: "local",
            };
            arr.unshift(doc);
            localStorage.setItem(LOCAL_KEY_DOCS, JSON.stringify(arr));
            return new Promise(r => setTimeout(() => r(doc), 1000));
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
        if (!sessionCabang) throw new Error("Cabang belum diinput untuk akun ini.");

        if (!SHEETS_WEB_APP_URL) {
             const arr = JSON.parse(localStorage.getItem(LOCAL_KEY_DOCS) || "[]");
             return arr.filter(d => d.cabang === sessionCabang);
        }

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
        if (!sessionCabang) throw new Error("Cabang belum diinput untuk akun ini.");
        
        if (mode === 'cabang') return [sessionCabang];
        
        if (!SHEETS_WEB_APP_URL) return mode === 'ulok' ? ["ULOK-001", "ULOK-002"] : ["LINGKUP-A", "LINGKUP-B"];

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

// Simple router function
function navigate(path, replace = false) {
    if (replace) {
        history.replaceState({ path }, "", "#" + path);
    } else {
        history.pushState({ path }, "", "#" + path);
    }
    render();
}

// Router guard & dispatcher
function render() {
    const hash = window.location.hash.slice(1) || "/";
    const user = getSession();

    // Guard: Jika tidak login, LEMPAR ke halaman login UTAMA (keluar dari folder materai)
    if (!user) {
        // Asumsi struktur folder: client/materai/index.html sejajar dengan client/auth/index.html
        window.location.href = "../auth/index.html"; 
        return;
    }

    // Redirect root to dashboard
    if (hash === "/") {
        return navigate("/dashboard", true);
    }

    // Render Layout + Page
    renderLayout(user, hash);
}

/* =========================================
   COMPONENT RENDERERS
   ========================================= */

// 1. Navbar Component
function getNavbarHTML(user, currentPath) {
    const isActive = (p) => currentPath === p ? 'active' : '';
    return `
    <header class="header">
        <div class="header-inner">
            <nav class="nav">
                <a href="#" class="${isActive('/dashboard')}" onclick="navigate('/dashboard'); return false;">Dashboard</a>
                <a href="#" class="${isActive('/buat-dokumen')}" onclick="navigate('/buat-dokumen'); return false;">Buat Dokumen</a>
                <a href="#" class="${isActive('/hasil-dokumen')}" onclick="navigate('/hasil-dokumen'); return false;">Hasil</a>
                <span class="badge" title="Pengguna aktif">${user.name || user.email}</span>
                <button class="ghost" id="btnLogout">Logout</button>
            </nav>
        </div>
    </header>`;
}

// 2. Layout Wrapper
function renderLayout(user, path) {
    app.innerHTML = `
        ${getNavbarHTML(user, path)}
        <main class="container" id="mainContent"></main>
    `;

    // Attach Logout Event
    document.getElementById("btnLogout").addEventListener("click", () => {
        // Hapus session storage (logout global)
        sessionStorage.removeItem("authenticated");
        sessionStorage.removeItem("loggedInUserEmail");
        sessionStorage.removeItem("userRole");
        sessionStorage.removeItem("loggedInUserCabang");
        
        // Redirect ke login utama
        window.location.href = "../auth/index.html";
    });

    // Render Inner Page
    const main = document.getElementById("mainContent");
    if (path === "/dashboard") renderDashboard(main);
    else if (path === "/buat-dokumen") renderCreateDocument(main);
    else if (path === "/hasil-dokumen") renderViewResults(main);
    else navigate("/dashboard", true); // 404 fallback
}

// 3. Login Page INTERNAL (DIHAPUS - Digantikan oleh Redirect di fungsi render)

// 4. Dashboard Page
function renderDashboard(container) {
    container.innerHTML = `
    <div class="card">
        <div class="grid">
            <div class="card" style="box-shadow:none; border: 1px solid #eee;">
                <h3 style="margin-top: 0">Masukan Dokumen TerMaterai</h3>
                <p>Masukan dokumen TerMaterai dan simpan kedalam database</p>
                <button onclick="navigate('/buat-dokumen')">Buka Form</button>
            </div>
            <div class="card" style="box-shadow:none; border: 1px solid #eee;">
                <h3 style="margin-top: 0">Melihat Hasil Dokumen Termaterai</h3>
                <p>Cari berdasarkan Cabang, Nomor Ulok, dan Lingkup Kerja, lalu lihat/unduh file.</p>
                <button class="secondary" onclick="navigate('/hasil-dokumen')">Lihat Hasil</button>
            </div>
        </div>
    </div>`;
}

// 5. Create Document Page
function renderCreateDocument(container) {
    container.innerHTML = `
    <div class="card">
        <h1 class="page-title">Buat Dokumen</h1>
        
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

             <div style="margin-top: 12px; margin-bottom: 4px;">
                <a href="https://pdf-combine-beta.vercel.app/" target="_blank" rel="noopener noreferrer" 
                   style="display: inline-block; padding: 8px 16px; border-radius: 8px; background-color: #f57c00; color: #fff; font-weight: 600; font-size: 14px; text-decoration: none;">
                    Gabungkan file RAB dan SPH di sini
                </a>
            </div>

            <div style="margin-top: 20px; margin-bottom: 12px;">
                <label style="font-weight: 600; display: block; margin-bottom: 8px;">
                    Upload File RAB & SPH Termaterai (PDF)
                </label>
                <input type="file" id="fileRab" accept=".pdf,application/pdf" required style="display: block; width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 10px;" />
                <small style="display: block; margin-top: 6px; color: #666;">Unggah dokumen Rekapitulasi RAB yang sudah termeterai (PDF).</small>
            </div>

            <div id="formMsg" style="margin-top: 12px; display: none;" class="error-box"></div>

            <div style="margin-top: 16px;">
                <button type="submit" id="btnSubmit" style="background-color: #d32f2f;">Simpan</button>
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

    // Init Logic
    (async () => {
        try {
            const opts = await Api.getOptions('cabang');
            selCabang.innerHTML = opts.map(c => `<option value="${c}">${c}</option>`).join('');
            selCabang.disabled = true; // Locked to user session
            
            // Trigger load Ulok
            if (opts.length > 0) loadUlok(opts[0]);
        } catch (e) {
            msg.className = "error-box";
            msg.textContent = e.message;
            msg.style.display = "block";
        }
    })();

    async function loadUlok() {
        try {
            selUlok.disabled = true;
            selLingkup.disabled = true;
            selUlok.innerHTML = '<option value="">Loading...</option>';
            
            const opts = await Api.getOptions('ulok');
            selUlok.innerHTML = '<option value="">Pilih nomor ulok…</option>' + 
                opts.map(u => `<option value="${u}">${u}</option>`).join('');
            selUlok.disabled = false;
        } catch (e) {
            console.error(e);
        }
    }

    selUlok.addEventListener("change", async () => {
        const val = selUlok.value;
        selLingkup.innerHTML = '<option value="">Pilih lingkup…</option>';
        selLingkup.disabled = true;
        if (!val) return;

        try {
            selLingkup.innerHTML = '<option value="">Loading...</option>';
            const opts = await Api.getOptions('lingkup', { ulok: val });
            selLingkup.innerHTML = '<option value="">Pilih lingkup…</option>' + 
                opts.map(l => `<option value="${l}">${l}</option>`).join('');
            selLingkup.disabled = false;
        } catch (e) {
            console.error(e);
        }
    });

    fileRab.addEventListener("change", (e) => {
        const f = e.target.files[0];
        rabFileObj = null;
        if (!f) return;
        if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
            alert("File RAB harus PDF.");
            e.target.value = "";
            return;
        }
        rabFileObj = f;
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        msg.style.display = "none";
        
        if (!rabFileObj) {
            alert("Pilih file PDF.");
            return;
        }

        overlay.style.display = "flex";
        btnSubmit.disabled = true;

        try {
            const base64Data = await fileToBase64(rabFileObj);
            const payload = {
                cabang: selCabang.value.trim(),
                ulok: selUlok.value.trim(),
                lingkup: selLingkup.value.trim(),
                docKind: "RAB",
                file: base64Data
            };

            await Api.createDocument(payload);

            msg.className = "success-box";
            msg.textContent = "Dokumen berhasil disimpan.";
            msg.style.display = "block";
            
            // Reset form partial
            selUlok.value = "";
            selLingkup.value = "";
            selLingkup.disabled = true;
            fileRab.value = "";
            rabFileObj = null;

        } catch (err) {
            msg.className = "error-box";
            msg.textContent = err.message || "Gagal menyimpan.";
            msg.style.display = "block";
        } finally {
            overlay.style.display = "none";
            btnSubmit.disabled = false;
        }
    });
}

// 6. View Results Page
function renderViewResults(container) {
    container.innerHTML = `
    <div class="card">
        <h1 class="page-title">Hasil Dokumen Termaterai</h1>
        <p class="page-subtitle">Gunakan filter di bawah untuk mencari dokumen.</p>

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
            <button id="btnReset" class="ghost">Reset</button>
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

    // Init
    (async () => {
        try {
            const ops = await Api.getOptions('cabang');
            fCabang.innerHTML = ops.map(v => `<option value="${v}">${v}</option>`).join('');
            if (ops.length) loadUlokFilter();
        } catch (e) { alert(e.message); }
    })();

    async function loadUlokFilter() {
        fUlok.innerHTML = '<option>Loading...</option>';
        fUlok.disabled = true;
        const ops = await Api.getOptions('ulok');
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
        const ops = await Api.getOptions('lingkup', { ulok: fUlok.value });
        fLingkup.innerHTML = '<option value="">Semua</option>' + ops.map(v => `<option value="${v}">${v}</option>`).join('');
        fLingkup.disabled = false;
    });

    btnReset.addEventListener("click", () => {
        fUlok.value = "";
        fLingkup.innerHTML = '<option value="">Semua</option>';
        fLingkup.disabled = true;
        wrapper.style.display = "none";
        content.innerHTML = "";
    });

    btnApply.addEventListener("click", async () => {
        wrapper.style.display = "block";
        loader.style.display = "flex";
        content.innerHTML = ""; // clear old
        
        try {
            const data = await Api.listDocuments({
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

    function renderTable(items) {
        if (!items.length) {
            content.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">Tidak ada data.</div>';
            return;
        }

        // Desktop Table
        let html = `
        <table class="table desktop-table">
            <thead>
                <tr>
                    <th>Waktu</th>
                    <th>Cabang</th>
                    <th>Nomor Ulok</th>
                    <th>Lingkup</th>
                    <th>Aksi</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(it => `
                    <tr>
                        <td class="nowrap">${new Date(it.createdAt || Date.now()).toLocaleString()}</td>
                        <td>${it.cabang}</td>
                        <td class="break">${it.ulok}</td>
                        <td>${it.lingkup}</td>
                        <td>
                            ${it.driveViewUrl || it.previewUrl ? `
                                <a href="${it.driveViewUrl || it.previewUrl}" target="_blank">Preview</a> | 
                                <a href="${it.driveDownloadUrl || it.downloadUrl || it.driveViewUrl}" target="_blank">Download</a>
                            ` : '-'}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;

        // Mobile Cards
        html += `<div class="mobile-cards">
            ${items.map(it => `
                <div class="m-card">
                    <div class="m-row"><span class="m-label">Waktu</span><span class="m-value">${new Date(it.createdAt).toLocaleString()}</span></div>
                    <div class="m-row"><span class="m-label">Cabang</span><span class="m-value">${it.cabang}</span></div>
                    <div class="m-row"><span class="m-label">Ulok</span><span class="m-value">${it.ulok}</span></div>
                    <div class="m-row"><span class="m-label">Lingkup</span><span class="m-value">${it.lingkup}</span></div>
                    <div class="m-actions">
                        ${it.driveViewUrl || it.previewUrl ? `
                            <a href="${it.driveViewUrl || it.previewUrl}" target="_blank">Preview</a>&nbsp;&nbsp;
                            <a href="${it.driveDownloadUrl || it.downloadUrl}" target="_blank">Download</a>
                        ` : '-'}
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
window.navigate = navigate; // Global