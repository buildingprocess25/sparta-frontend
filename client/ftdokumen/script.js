// ==========================================
// 1. GLOBAL STATE & CONFIG
// ==========================================
// Base URL Backend
const API_BASE_URL = "https://sparta-backend-5hdj.onrender.com";
// URL untuk Logging ke Apps Script
const APPS_SCRIPT_POST_URL = "https://script.google.com/macros/s/AKfycbzPubDTa7E2gT5HeVLv9edAcn1xaTiT3J4BtAVYqaqiFAvFtp1qovTXpqpm-VuNOxQJ/exec";

// State global
const STATE = {
    user: null,
    formData: {},
    photos: {}, 
    currentPhotoNumber: 1,
    currentPage: 1,
    spkOptions: [],
    isCameraReady: false,
    capturedBlob: null, 
    currentPoint: null, 
    stream: null
};

// Data titik koordinat (TIDAK BERUBAH - DISINGKAT UNTUK KETERBACAAN)
const PHOTO_POINTS = {
    1: [
        { id: 1, x: 67.8, y: 92.8, label: "KANAN 50 M" },
        // ... (sisanya tetap sama seperti file asli Anda) ...
        { id: 38, x: 41, y: 68.8, label: "SUMUR EXISTING" },
    ],
    2: [
        { id: 34, x: 50, y: 51.8, label: "INSTALASI LISTRIK DAN LISTPLANK" },
        { id: 33, x: 61.3, y: 24, label: "AREA DAG TORN" },
    ],
    3: [
        { id: 35, x: 61.1, y: 57.2, label: "CREMONA DIATAS FOLDING GATE" },
        { id: 36, x: 61, y: 53.5, label: "INSTALASI LISTRIK DIATAS PLAFOND" },
    ]
};

const ALL_POINTS = [
    ...PHOTO_POINTS[1], ...PHOTO_POINTS[2], ...PHOTO_POINTS[3]
].sort((a, b) => a.id - b.id);


// ==========================================
// 2. HELPER FUNCTIONS
// ==========================================
const getEl = (id) => document.getElementById(id);
const hide = (el) => el && el.classList.add("hidden");
const show = (el) => el && el.classList.remove("hidden");

const showToast = (text, type = "success") => {
    const toast = getEl("form-status-toast");
    if(toast){
        toast.textContent = text;
        toast.style.background = type === "success" ? "#333" : "#dc2626";
        show(toast);
        setTimeout(() => hide(toast), 3000);
    }
};

const showLoading = (text = "Loading...") => {
    const txt = getEl("loading-text");
    const ovl = getEl("loading-overlay");
    if(txt) txt.textContent = text;
    if(ovl) show(ovl);
};

const hideLoading = () => hide(getEl("loading-overlay"));

// ==========================================
// 3. AUTH & INIT
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    checkSession(); 
    setInterval(checkTimeLimit, 60000); 
    
    const dateEl = getEl("current-date-display");
    if(dateEl) {
        const d = new Date();
        const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateEl.textContent = d.toLocaleDateString('id-ID', opts);
    }
    
    initEventListeners();
});

async function logLoginAttempt(username, cabang, status) {
    const logData = {
        requestType: "loginAttempt",
        username: username,
        cabang: cabang,
        status: status,
    };
    try {
        await fetch(APPS_SCRIPT_POST_URL, {
            method: "POST", redirect: "follow",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(logData),
        });
    } catch (error) { console.error("Log failed", error); }
}

function checkSession() {
    // Mengambil data session yang diset oleh login logic
    const ssoAuth = sessionStorage.getItem("authenticated");
    const ssoEmail = sessionStorage.getItem("loggedInUserEmail");
    const ssoCabang = sessionStorage.getItem("loggedInUserCabang");
    const ssoRole = sessionStorage.getItem("userRole");

    const localUser = localStorage.getItem("user");

    if (ssoAuth === "true" && ssoEmail && ssoCabang) {
        console.log("Session detected from Auth System");
        STATE.user = {
            email: ssoEmail,
            cabang: ssoCabang,
            role: ssoRole || "USER",
            source: "sso"
        };
        proceedToApp();
        
    } else if (localUser) {
        console.log("Session detected from LocalStorage");
        STATE.user = JSON.parse(localUser);
        // Pastikan format localUser sesuai
        if (!STATE.user.cabang && STATE.user.password) {
             STATE.user.cabang = STATE.user.password; // Fallback jika struktur lama
        }
        proceedToApp();
        
    } else {
        switchToView("login");
        checkTimeLimit();
    }
}

function proceedToApp() {
    // 1. Update UI Header
    const infoEl = getEl("header-user-info");
    if(infoEl) infoEl.textContent = `Building & Maintenance — ${STATE.user.cabang || ""}`;
    
    show(getEl("main-header"));
    show(getEl("sub-header"));
    hide(getEl("view-login"));
    
    // 2. Pindah ke view Form
    switchToView("form");

    // [INTEGRASI BARU] Otomatis isi kolom Cabang dari data User Login
    const inpCabang = getEl("inp-cabang");
    if (inpCabang) {
        inpCabang.value = STATE.user.cabang || "";
        // Update STATE agar sinkron
        STATE.formData.cabang = STATE.user.cabang || ""; 
    }

    // 3. Load data SPK (Ulok) berdasarkan cabang user
    if (STATE.user.cabang) {
        loadSpkData(STATE.user.cabang);
    }
}

function checkTimeLimit() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const wib = new Date(utc + 7 * 60 * 60000);
    const hour = wib.getHours();

    const isLoginView = !getEl("view-login").classList.contains("hidden");
    const msgContainer = getEl("login-info-msg");
    const btnLogin = getEl("btn-submit-login");

    // Jam operasional 06:00 - 18:00
    if (hour < 6 || hour >= 18) {
        const timeStr = `${hour.toString().padStart(2, "0")}:${wib.getMinutes().toString().padStart(2, "0")}`;
        const msg = `⏰ Login hanya dapat dilakukan pada jam operasional 06.00–18.00 WIB.\nSekarang pukul ${timeStr} WIB.`;
        
        if (isLoginView && msgContainer) {
            msgContainer.textContent = msg;
            show(msgContainer);
            if(btnLogin) { btnLogin.disabled = true; btnLogin.style.cursor = "not-allowed"; }
        } else if (STATE.user && !isLoginView) {
            showWarningModal(msg, () => doLogout());
        }
    } else {
        if(msgContainer) hide(msgContainer);
        if(btnLogin) { btnLogin.disabled = false; btnLogin.style.cursor = "pointer"; }
    }
}

function doLogout() {
    localStorage.removeItem("user");
    sessionStorage.clear();
    STATE.user = null;
    location.reload();
}

function switchToView(viewName) {
    hide(getEl("view-login"));
    hide(getEl("view-form"));
    hide(getEl("view-floorplan"));

    if (viewName === "login") {
        show(getEl("view-login"));
        hide(getEl("main-header"));
        hide(getEl("sub-header"));
    }
    else if (viewName === "form") show(getEl("view-form"));
    else if (viewName === "floorplan") {
        show(getEl("view-floorplan"));
        renderFloorPlan();
    }
}

// ==========================================
// 4. API CALLS
// ==========================================

async function apiLogin(username, password) {
    // Password di sini berfungsi sebagai Kode Cabang sesuai logic Anda
    logLoginAttempt(username, password, "Attempt");

    try {
        const res = await fetch(`${API_BASE_URL}/api/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: username, cabang: password }),
        });

        const json = await res.json();

        if (res.ok && json.status === "success") {
            logLoginAttempt(username, password, "Success");
            return {
                email: username,
                cabang: password, // Menyimpan input password sebagai cabang
                role: (json.role || "").toUpperCase(),
                ...json
            };
        } else {
            const errMsg = json.message || "Username atau password salah.";
            logLoginAttempt(username, password, "Failed");
            throw new Error(errMsg);
        }
    } catch (e) {
        logLoginAttempt(username, password, "Failed");
        throw e;
    }
}

async function loadSpkData(cabang) {
    if(!cabang) return;
    try {
        showLoading("Mengambil data Ulok...");
        const res = await fetch(`${API_BASE_URL}/doc/spk-data`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cabang }),
        });
        const json = await res.json();
        if (json.ok) {
            STATE.spkOptions = json.data;
            renderSpkOptions();
        }
    } catch (e) { 
        console.error(e); 
        showToast("Gagal mengambil data SPK", "error");
    } finally {
        hideLoading();
    }
}

async function getTempByUlok(nomorUlok) {
    const res = await fetch(`${API_BASE_URL}/doc/get-temp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomorUlok }),
    });
    return res.json();
}

async function saveTemp(payload) {
    return fetch(`${API_BASE_URL}/doc/save-temp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }).then(r => r.json());
}

// ==========================================
// 5. EVENT LISTENERS
// ==========================================
function initEventListeners() {
    const formLogin = getEl("form-login");
    if(formLogin) {
        formLogin.addEventListener("submit", async (e) => {
            e.preventDefault();
            const u = getEl("login-username").value;
            const p = getEl("login-password").value;
            const btn = getEl("btn-submit-login");
            
            btn.textContent = "Memproses...";
            btn.disabled = true;
            hide(getEl("login-error-msg"));

            try {
                // Menggunakan logic login yang sudah ada
                const user = await apiLogin(u, p);
                
                // Simpan session agar persistent
                localStorage.setItem("user", JSON.stringify(user));
                sessionStorage.setItem("authenticated", "true");
                sessionStorage.setItem("loggedInUserEmail", user.email);
                sessionStorage.setItem("loggedInUserCabang", user.cabang);
                sessionStorage.setItem("userRole", user.role);

                checkSession(); // Redirect otomatis via checkSession -> proceedToApp
            } catch (err) {
                const errDiv = getEl("login-error-msg");
                errDiv.textContent = err.message;
                show(errDiv);
            } finally {
                btn.textContent = "Login";
                btn.disabled = false;
            }
        });
    }

    const btnToggle = getEl("btn-toggle-pass");
    if(btnToggle) {
        btnToggle.addEventListener("click", () => {
            const inp = getEl("login-password");
            const icon = btnToggle.querySelector("i");
            if (inp.type === "password") {
                inp.type = "text";
                icon.classList.remove("fa-eye");
                icon.classList.add("fa-eye-slash");
            } else {
                inp.type = "password";
                icon.classList.remove("fa-eye-slash");
                icon.classList.add("fa-eye");
            }
        });
    }

    const btnLogout = getEl("btn-logout");
    if(btnLogout) btnLogout.addEventListener("click", doLogout);

    const chkManual = getEl("chk-manual-ulok");
    if(chkManual) {
        chkManual.addEventListener("change", (e) => {
            const isManual = e.target.checked;
            const sel = getEl("sel-ulok");
            const inp = getEl("inp-ulok-manual");

            if (isManual) { hide(sel); show(inp); STATE.formData.nomorUlok = inp.value; } 
            else { show(sel); hide(inp); STATE.formData.nomorUlok = sel.value; }
            STATE.formData.isManualUlok = isManual;
        });
    }

    const selUlok = getEl("sel-ulok");
    if(selUlok) {
        selUlok.addEventListener("change", async (e) => {
            const val = e.target.value;
            if(!val) return;

            STATE.formData.nomorUlok = val;
            const found = STATE.spkOptions.find(o => o.nomorUlok === val);
            
            // Auto populate form lain jika data ditemukan
            if (found) populateForm(found);
            
            // Load foto/progress yg tersimpan
            await loadTempData(val);
        });
    }

    const inpUlokMan = getEl("inp-ulok-manual");
    if(inpUlokMan) {
        inpUlokMan.addEventListener("change", async (e) => {
            const val = e.target.value.toUpperCase();
            STATE.formData.nomorUlok = val;
            await loadTempData(val);
        });
    }

    const inputs = document.querySelectorAll("#data-input-form input");
    inputs.forEach(inp => {
        inp.addEventListener("change", (e) => {
            const key = mapInputToKey(e.target.id);
            if(key) STATE.formData[key] = e.target.value;
            saveFormDataBackground();
        });
    });

    const formInput = getEl("data-input-form");
    if(formInput) {
        formInput.addEventListener("submit", (e) => {
            e.preventDefault();
            updateStateFormData();
            saveFormDataBackground().then(() => switchToView("floorplan"));
        });
    }

    const btnBack = getEl("btn-back-form");
    if(btnBack) btnBack.addEventListener("click", () => switchToView("form"));
    
    document.querySelectorAll(".pagination-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".pagination-btn").forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            STATE.currentPage = parseInt(e.target.dataset.page);
            renderFloorPlan();
        });
    });

    // ... (Event listener kamera dan lainnya sama seperti sebelumnya) ...
    const btnCloseCam = getEl("btn-close-cam");
    if(btnCloseCam) btnCloseCam.addEventListener("click", closeCamera);
    
    const btnSnap = getEl("btn-snap");
    if(btnSnap) btnSnap.addEventListener("click", capturePhoto);

    const btnRetake = getEl("btn-retake");
    if(btnRetake) btnRetake.addEventListener("click", resetCameraUI);
    
    const btnConfirm = getEl("btn-confirm-snap");
    if(btnConfirm) btnConfirm.addEventListener("click", async () => {
        if (!STATE.capturedBlob && !STATE.currentPhotoNote) return;
        await saveCapturedPhoto();
    });

    const inpFile = getEl("inp-file-upload");
    if(inpFile) {
        inpFile.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if(!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => handlePreviewAndSave(evt.target.result);
            reader.readAsDataURL(file);
        });
    }

    const btnCant = getEl("btn-cant-snap");
    if(btnCant) {
        btnCant.addEventListener("click", () => {
            STATE.capturedBlob = "TIDAK_BISA_DIFOTO";
            STATE.currentPhotoNote = "TIDAK BISA DIFOTO";
            saveCapturedPhoto();
        });
    }

    const btnWarnOk = getEl("btn-warning-ok");
    if(btnWarnOk) btnWarnOk.addEventListener("click", () => hide(getEl("warning-modal")));

    const btnPdf = getEl("btn-save-pdf");
    if(btnPdf) btnPdf.addEventListener("click", generateAndSendPDF);
}

// ==========================================
// 6. FORM LOGIC
// ==========================================
function renderSpkOptions() {
    const sel = getEl("sel-ulok");
    if(!sel) return;
    
    sel.innerHTML = '<option value="">-- pilih nomor ulok --</option>';
    
    if (STATE.spkOptions.length === 0) {
        const op = document.createElement("option");
        op.textContent = "Tidak ada data SPK untuk cabang ini";
        op.disabled = true;
        sel.appendChild(op);
        return;
    }

    STATE.spkOptions.forEach(opt => {
        const op = document.createElement("option");
        op.value = opt.nomorUlok;
        op.textContent = opt.nomorUlok; // Menampilkan nomor Ulok
        sel.appendChild(op);
    });

    // [INTEGRASI BARU] Jika hanya ada 1 Ulok, otomatis pilih
    if (STATE.spkOptions.length === 1) {
        const oneUlok = STATE.spkOptions[0].nomorUlok;
        sel.value = oneUlok;
        // Trigger event change secara manual agar data ter-load
        sel.dispatchEvent(new Event('change'));
        showToast("Nomor Ulok otomatis dipilih");
    }
}

function mapInputToKey(id) {
    const map = {
        "inp-sipil": "kontraktorSipil", "inp-me": "kontraktorMe",
        "inp-spk-awal": "spkAwal", "inp-spk-akhir": "spkAkhir",
        "inp-nama-toko": "namaToko", "inp-kode-toko": "kodeToko",
        "inp-tgl-go": "tanggalGo", "inp-tgl-st": "tanggalSt",
        "inp-tgl-foto": "tanggalAmbilFoto"
    };
    return map[id];
}

function updateStateFormData() {
    const map = {
        "inp-cabang": "cabang", "inp-sipil": "kontraktorSipil", "inp-me": "kontraktorMe",
        "inp-spk-awal": "spkAwal", "inp-spk-akhir": "spkAkhir", "inp-nama-toko": "namaToko", 
        "inp-kode-toko": "kodeToko", "inp-tgl-go": "tanggalGo", "inp-tgl-st": "tanggalSt",
        "inp-tgl-foto": "tanggalAmbilFoto"
    };
    for(let id in map) {
        const el = getEl(id);
        if(el) STATE.formData[map[id]] = el.value;
    }
    // Pastikan nomor ulok juga terupdate
    const selUlok = getEl("sel-ulok");
    const inpUlok = getEl("inp-ulok-manual");
    if (!STATE.formData.isManualUlok && selUlok) {
        STATE.formData.nomorUlok = selUlok.value;
    } else if (inpUlok) {
        STATE.formData.nomorUlok = inpUlok.value;
    }
}

function populateForm(data) {
    if(!data) return;
    STATE.formData = { ...STATE.formData, ...data };
    
    const safeSet = (id, val) => { const el = getEl(id); if(el) el.value = val || ""; };
    
    // Pastikan Cabang selalu terisi dari data atau fallback ke session user
    safeSet("inp-cabang", data.cabang || STATE.user?.cabang);
    safeSet("inp-sipil", data.kontraktorSipil);
    safeSet("inp-me", data.kontraktorMe);
    safeSet("inp-spk-awal", formatDateInput(data.spkAwal));
    safeSet("inp-spk-akhir", formatDateInput(data.spkAkhir));
    safeSet("inp-nama-toko", data.namaToko);
    safeSet("inp-kode-toko", data.kodeToko);
    safeSet("inp-tgl-go", formatDateInput(data.tanggalGo));
    safeSet("inp-tgl-st", formatDateInput(data.tanggalSt));
    safeSet("inp-tgl-foto", formatDateInput(data.tanggalAmbilFoto));
}

function formatDateInput(dateStr) {
    if(!dateStr) return "";
    try { return new Date(dateStr).toISOString().split("T")[0]; } 
    catch { return ""; }
}

async function loadTempData(ulok) {
    if(!ulok) return;
    showLoading("Cek data server...");
    try {
        const res = await getTempByUlok(ulok);
        if (res.ok && res.data) {
            populateForm(res.data); // Ini akan mengisi form detail toko
            if (Array.isArray(res.data.photos)) {
                STATE.photos = {};
                const promises = res.data.photos.map((pid, idx) => {
                    if(!pid) return null;
                    const id = idx + 1;
                    const url = `${API_BASE_URL}/doc/view-photo/${pid}`;
                    STATE.photos[id] = {
                        url: url,
                        point: ALL_POINTS.find(p => p.id === id),
                        timestamp: new Date().toISOString()
                    };
                    return new Promise(r => { 
                        const img = new Image(); 
                        img.onload = r; img.onerror = r; 
                        img.src = url; 
                    });
                });
                await Promise.all(promises);
                
                const taken = Object.keys(STATE.photos).map(Number);
                const next = taken.length > 0 ? Math.max(...taken) + 1 : 1;
                STATE.currentPhotoNumber = next > 38 ? 38 : next;
            }
        }
    } catch(e) { console.error(e); } 
    finally { hideLoading(); }
}

async function saveFormDataBackground() {
    try { await saveTemp(STATE.formData); console.log("Form saved background"); } 
    catch(e) { console.error("Save fail", e); }
}

// ... (Bagian 7: FLOOR PLAN & CAMERA dan PDF generation tetap sama) ...
// ==========================================
// 7. FLOOR PLAN & CAMERA
// ==========================================
function renderFloorPlan() {
    const tStore = getEl("fp-store-name");
    if(tStore) tStore.textContent = `${STATE.formData.namaToko || "-"} (${STATE.formData.kodeToko || "-"})`;
    
    const tDate = getEl("fp-date");
    if(tDate) tDate.textContent = STATE.formData.tanggalAmbilFoto || "-";
    
    const completed = Object.keys(STATE.photos).length;
    const txtProg = getEl("progress-text");
    if(txtProg) txtProg.textContent = `Progress: ${completed}/38 foto`;
    
    const fillProg = getEl("progress-fill");
    if(fillProg) fillProg.style.width = `${(completed/38)*100}%`;
    
    const compSec = getEl("completion-section");
    if(compSec) {
        if (completed === 38) show(compSec); else hide(compSec);
    }

    const imgMap = { 1: "floor.png", 2: "floor3.jpeg", 3: "floor2.jpeg" };
    const floorImg = getEl("floor-img");
    if(floorImg) floorImg.src = imgMap[STATE.currentPage] || "floor.png";

    const container = getEl("points-container");
    if(container) {
        container.innerHTML = "";
        const pagePoints = PHOTO_POINTS[STATE.currentPage] || [];
        pagePoints.forEach(p => {
            const btn = document.createElement("button");
            let status = "pending";
            if (STATE.photos[p.id]) status = "completed";
            else if (p.id === STATE.currentPhotoNumber) status = "active";
            else if (p.id < STATE.currentPhotoNumber) status = "missed";

            btn.className = `photo-point ${status}`;
            btn.style.left = `${p.x}%`;
            btn.style.top = `${p.y}%`;
            btn.textContent = p.id;
            
            if (p.id > STATE.currentPhotoNumber && !STATE.photos[p.id]) {
                btn.disabled = true; btn.style.opacity = 0.6;
            } else {
                btn.onclick = () => openCamera(p);
            }
            container.appendChild(btn);
        });
    }
    renderPhotoList();
}

function renderPhotoList() {
    const list = getEl("photo-list-grid");
    if(!list) return;
    list.innerHTML = "";
    
    ALL_POINTS.forEach(p => {
        const item = document.createElement("div");
        let status = STATE.photos[p.id] ? "completed" : "pending";
        item.className = `photo-item ${status}`;
        
        let html = `
            <div style="font-weight:bold; color:#dc2626; font-size:0.9rem">${p.id}</div>
            <div style="font-size:0.8rem; color:#666">${p.label}</div>
        `;

        if (STATE.photos[p.id]) {
            const data = STATE.photos[p.id];
            if (data.note) {
                html += `<div class="photo-note">${data.note}</div>`;
            } else {
                html += `<img src="${data.url}" class="thumbnail" loading="lazy">`;
            }
        }
        item.innerHTML = html;
        list.appendChild(item);
    });
}

async function openCamera(point) {
    STATE.currentPoint = point;
    getEl("cam-title").textContent = `Foto #${point.id}: ${point.label}`;
    show(getEl("camera-modal"));
    resetCameraUI();
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        STATE.stream = stream;
        const vid = getEl("cam-video");
        vid.srcObject = stream;
        vid.onloadedmetadata = () => STATE.isCameraReady = true;
    } catch (e) {
        alert("Gagal akses kamera: " + e.message);
        closeCamera();
    }
}

function closeCamera() {
    if (STATE.stream) { STATE.stream.getTracks().forEach(t => t.stop()); STATE.stream = null; }
    STATE.isCameraReady = false;
    hide(getEl("camera-modal"));
}

function capturePhoto() {
    if (!STATE.isCameraReady) return;
    const vid = getEl("cam-video");
    const cvs = getEl("cam-canvas");
    const ctx = cvs.getContext("2d");
    
    const MAX = 1280;
    let w = vid.videoWidth, h = vid.videoHeight;
    if (w > MAX || h > MAX) {
        if (w > h) { h = (h/w)*MAX; w = MAX; }
        else { w = (w/h)*MAX; h = MAX; }
    }
    cvs.width = w; cvs.height = h;
    ctx.drawImage(vid, 0, 0, w, h);
    
    cvs.toBlob(blob => {
        STATE.capturedBlob = blob;
        const url = URL.createObjectURL(blob);
        getEl("captured-img").src = url;
        hide(getEl("cam-preview-container"));
        show(getEl("photo-result-container"));
        hide(getEl("actions-pre-capture"));
        show(getEl("actions-post-capture"));
    }, "image/jpeg", 0.7);
}

function resetCameraUI() {
    STATE.capturedBlob = null;
    show(getEl("cam-preview-container"));
    hide(getEl("photo-result-container"));
    show(getEl("actions-pre-capture"));
    hide(getEl("actions-post-capture"));
}

async function handlePreviewAndSave(base64) {
    await savePhotoToBackend(base64, null);
}

async function saveCapturedPhoto() {
    showLoading("Menyimpan foto...");
    try {
        let base64 = null;
        let note = STATE.currentPhotoNote || null;
        if (STATE.capturedBlob && STATE.capturedBlob !== "TIDAK_BISA_DIFOTO") {
            base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(STATE.capturedBlob);
            });
        }
        await savePhotoToBackend(base64, note);
    } catch (e) { alert("Gagal simpan: " + e.message); } 
    finally { hideLoading(); }
}

async function savePhotoToBackend(base64, note) {
    const pointId = STATE.currentPoint.id;
    const payload = {
        nomorUlok: STATE.formData.nomorUlok,
        photoId: pointId,
        photoNote: note,
        photoBase64: base64
    };
    const res = await saveTemp(payload);
    if (!res.ok) throw new Error(res.error || "Gagal save server");

    STATE.photos[pointId] = {
        url: base64 || "fototidakbisadiambil.jpeg",
        point: STATE.currentPoint,
        timestamp: new Date().toISOString(),
        note: note
    };

    if (pointId === STATE.currentPhotoNumber) {
        let next = pointId + 1;
        if (next > 38) next = 38;
        STATE.currentPhotoNumber = next;
    }
    STATE.currentPhotoNote = null;
    closeCamera();
    renderFloorPlan();
    showToast(`Foto #${pointId} tersimpan!`);
}

function showWarningModal(msg, onOk) {
    const msgEl = getEl("warning-msg");
    if(msgEl) msgEl.textContent = msg;
    
    const btn = getEl("btn-warning-ok");
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener("click", () => {
        hide(getEl("warning-modal"));
        if(onOk) onOk();
    });
    show(getEl("warning-modal"));
}

function generateAndSendPDF() {
    showLoading("Membuat PDF...");
    const worker = new Worker("pdf.worker.js", { type: "module" });

    worker.postMessage({
        formData: STATE.formData,
        capturedPhotos: STATE.photos,
        allPhotoPoints: ALL_POINTS
    });

    worker.onmessage = async (e) => {
        const { ok, pdfBase64, pdfBlob, error } = e.data;
        if(!ok) {
            console.error(error); alert("Gagal membuat PDF");
            hideLoading(); worker.terminate(); return;
        }

        try {
            showLoading("Mengirim PDF ke Email...");
            const user = STATE.user;
            const safeDate = STATE.formData.tanggalAmbilFoto || "unknown";
            const filename = `Dokumentasi_${STATE.formData.kodeToko}_${safeDate}.pdf`;

            const payload = { ...STATE.formData, pdfBase64, emailPengirim: user.email || "" };
            
            const resSave = await fetch(`${API_BASE_URL}/doc/save-toko`, {
                method: "POST", headers:{"Content-Type":"application/json"},
                body: JSON.stringify(payload)
            });
            const jsonSave = await resSave.json();
            if(!jsonSave.ok) throw new Error("Gagal simpan ke Spreadsheet");

            await fetch(`${API_BASE_URL}/doc/send-pdf-email`, {
                method:"POST", headers:{"Content-Type":"application/json"},
                body: JSON.stringify({
                    email: user.email, pdfBase64, filename, pdfUrl: jsonSave.pdfUrl, ...STATE.formData
                })
            });

            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement("a");
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click(); a.remove();

            showToast("Berhasil disimpan & dikirim! ✅");
        } catch(err) {
            console.error(err); alert("Error upload: " + err.message);
        } finally {
            hideLoading(); worker.terminate();
        }
    };
    worker.onerror = (e) => {
        console.error("Worker Error", e); hideLoading(); worker.terminate();
    };
}