// ==========================================
// 1. GLOBAL STATE & CONFIG
// ==========================================
// Base URL Backend (Sesuai dengan auth/script.js)
const API_BASE_URL = "https://sparta-backend-5hdj.onrender.com";
// URL untuk Logging ke Apps Script
const APPS_SCRIPT_POST_URL = "https://script.google.com/macros/s/AKfycbzPubDTa7E2gT5HeVLv9edAcn1xaTiT3J4BtAVYqaqiFAvFtp1qovTXpqpm-VuNOxQJ/exec";

// State global menggantikan useState React
const STATE = {
    user: null,
    formData: {},
    photos: {}, // { 1: { url, point, ... }, ... }
    currentPhotoNumber: 1,
    currentPage: 1,
    spkOptions: [],
    isCameraReady: false,
    capturedBlob: null, // Blob foto sementara
    currentPoint: null, // Titik yang sedang difoto
    stream: null
};

// Data titik koordinat (dari React useMemo)
const PHOTO_POINTS = {
    1: [
        { id: 1, x: 67.8, y: 92.8, label: "KANAN 50 M" },
        { id: 2, x: 63.7, y: 97.5, label: "DEPAN KANAN" },
        { id: 3, x: 50.5, y: 97.5, label: "DEPAN" },
        { id: 4, x: 36.7, y: 97.5, label: "DEPAN KIRI" },
        { id: 5, x: 32.9, y: 93.3, label: "KIRI 50 M" },
        { id: 6, x: 32.8, y: 85.8, label: "KIRI BAHU JALAN" },
        { id: 7, x: 67.8, y: 85.8, label: "KANAN BAHU JALAN" },
        { id: 8, x: 66, y: 82.5, label: "TAMPAK KANAN DEPAN KEBELAKANG" },
        { id: 9, x: 33.5, y: 81.8, label: "TAMPAK KIRI DEPAN KEBELAKANG" },
        { id: 10, x: 65.1, y: 11.3, label: "KANAN BELAKANG BANGUNAN MENGHADAP DEPAN" },
        { id: 11, x: 63.7, y: 7.8, label: "KANAN BELAKANG BANGUNAN MENGHADAP SAMPING" },
        { id: 12, x: 37.5, y: 7.5, label: "KIRI BELAKANG BANGUNAN MENGHADAP SAMPING" },
        { id: 13, x: 35, y: 11, label: "KIRI BELAKANG BANGUNAN MENGHADAP DEPAN" },
        { id: 14, x: 58.2, y: 81.7, label: "INSTALASI LISTRIK POLE SIGN" },
        { id: 15, x: 56.8, y: 73.3, label: "GUTTER" },
        { id: 16, x: 57.6, y: 63.8, label: "KOLOM IWF DUDUKAN LISTPLANK" },
        { id: 17, x: 59, y: 60, label: "KANAN TERAS LUAR" },
        { id: 18, x: 41.4, y: 60.2, label: "KIRI TERAS LUAR" },
        { id: 19, x: 61.5, y: 56.5, label: "KANAN TERAS DALAM" },
        { id: 20, x: 39, y: 56.5, label: "KIRI TERAS DALAM" },
        { id: 21, x: 48.7, y: 49.4, label: "PINTU KACA ALLUMUNIUM" },
        { id: 22, x: 38.8, y: 52.5, label: "SUDUT KIRI DEPAN AREA SALES" },
        { id: 23, x: 42.4, y: 45.5, label: "INSTALASI LISTRIK FREEZER" },
        { id: 24, x: 58.8, y: 37.5, label: "SUDUT KANAN DEPAN AREA SALES" },
        { id: 25, x: 61.1, y: 51, label: "INSTALASI LISTRIK MEJA KASIR" },
        { id: 26, x: 61.5, y: 27.5, label: "SUDUT KANAN BELAKANG AREA SALES" },
        { id: 27, x: 39, y: 28.2, label: "SUDUT KIRI BELAKANG AREA SALES" },
        { id: 28, x: 61.7, y: 22.2, label: "SELASAR + JANITOR" },
        { id: 29, x: 59.5, y: 12.5, label: "KAMAR MANDI" },
        { id: 30, x: 53.1, y: 16.2, label: "GUDANG SEBELAH KANAN" },
        { id: 31, x: 38.6, y: 13, label: "GUDANG SEBELAH KIRI" },
        { id: 32, x: 48.5, y: 23.5, label: "INSTALASI LISTRIK & DRAINASE CHILLER" },
        { id: 37, x: 59.7, y: 68.8, label: "SEPTICTANK EXISTING" },
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

// Flatten semua point untuk akses mudah
const ALL_POINTS = [
    ...PHOTO_POINTS[1], ...PHOTO_POINTS[2], ...PHOTO_POINTS[3]
].sort((a, b) => a.id - b.id);


// ==========================================
// 2. HELPER FUNCTIONS
// ==========================================
const getEl = (id) => document.getElementById(id);
const hide = (el) => el.classList.add("hidden");
const show = (el) => el.classList.remove("hidden");

const showToast = (text, type = "success") => {
    const toast = getEl("form-status-toast");
    toast.textContent = text;
    toast.style.background = type === "success" ? "#333" : "#dc2626";
    show(toast);
    setTimeout(() => hide(toast), 3000);
};

const showLoading = (text = "Loading...") => {
    getEl("loading-text").textContent = text;
    show(getEl("loading-overlay"));
};

const hideLoading = () => hide(getEl("loading-overlay"));

// ==========================================
// 3. AUTH & INIT
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    checkSession();
    setInterval(checkTimeLimit, 60000); // Cek jam tiap menit
    initEventListeners();
});

// Fungsi Logging ke Google Apps Script (Diambil dari auth/script.js)
async function logLoginAttempt(username, cabang, status) {
    const logData = {
        requestType: "loginAttempt",
        username: username,
        cabang: cabang,
        status: status,
    };

    try {
        // Menggunakan no-cors jika mengalami masalah CORS pada Apps Script, 
        // tapi idealnya backend GAS harus support CORS.
        await fetch(APPS_SCRIPT_POST_URL, {
            method: "POST",
            redirect: "follow",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(logData),
        });
    } catch (error) {
        console.error("Failed to log login attempt:", error);
    }
}

function checkSession() {
    // Kita gunakan localStorage agar user tetap login saat refresh (sesuai behavior aplikasi sebelumnya)
    const userStr = localStorage.getItem("user");
    if (userStr) {
        STATE.user = JSON.parse(userStr);
        // Menampilkan Cabang/Role di Header
        getEl("header-user-info").textContent = `Building & Maintenance — ${STATE.user.cabang || ""}`;
        show(getEl("main-header"));
        hide(getEl("view-login"));
        
        // Langsung masuk ke Form view
        switchToView("form");
        loadSpkData(STATE.user.cabang);
    } else {
        switchToView("login");
        checkTimeLimit(); // Cek jam saat di login page
    }
}

function checkTimeLimit() {
    const now = new Date();
    // UTC+7 setup
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
        
        if (isLoginView) {
            msgContainer.textContent = msg;
            show(msgContainer);
            btnLogin.disabled = true;
            btnLogin.style.cursor = "not-allowed";
        } else if (STATE.user) {
            // Jika user sedang login tapi waktu habis
            showWarningModal(msg, () => {
                doLogout();
            });
        }
    } else {
        hide(msgContainer);
        btnLogin.disabled = false;
        btnLogin.style.cursor = "pointer";
    }
}

function doLogout() {
    localStorage.removeItem("user");
    STATE.user = null;
    location.reload();
}

function switchToView(viewName) {
    hide(getEl("view-login"));
    hide(getEl("view-form"));
    hide(getEl("view-floorplan"));

    if (viewName === "login") show(getEl("view-login"));
    else if (viewName === "form") show(getEl("view-form"));
    else if (viewName === "floorplan") {
        show(getEl("view-floorplan"));
        renderFloorPlan();
    }
}

// ==========================================
// 4. API CALLS
// ==========================================

// INTEGRASI BARU: Login menggunakan endpoint /api/login
async function apiLogin(username, password) {
    // 1. Log percobaan login
    logLoginAttempt(username, password, "Attempt");

    try {
        // Backend baru mengharapkan field 'cabang' sebagai password
        const res = await fetch(`${API_BASE_URL}/api/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: username, cabang: password }),
        });

        const json = await res.json();

        // Cek status response (backend baru menggunakan json.status === "success")
        if (res.ok && json.status === "success") {
            logLoginAttempt(username, password, "Success");
            
            // Format data user agar sesuai dengan struktur aplikasi Anda (STATE.user)
            return {
                email: username,
                cabang: password, // Di sistem ini password dianggap sebagai kode cabang
                role: (json.role || "").toUpperCase(),
                ...json // Simpan sisa data jika ada
            };
        } else {
            // Jika gagal
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
    try {
        const res = await fetch(`${API_BASE_URL}/spk-data`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cabang }),
        });
        const json = await res.json();
        if (json.ok) {
            STATE.spkOptions = json.data;
            renderSpkOptions();
        }
    } catch (e) { console.error(e); }
}

async function getTempByUlok(nomorUlok) {
    const res = await fetch(`${API_BASE_URL}/get-temp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomorUlok }),
    });
    return res.json();
}

async function saveTemp(payload) {
    return fetch(`${API_BASE_URL}/save-temp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }).then(r => r.json());
}

// ==========================================
// 5. EVENT LISTENERS & LOGIC
// ==========================================
function initEventListeners() {
    // LOGIN LISTENER
    getEl("form-login").addEventListener("submit", async (e) => {
        e.preventDefault();
        const u = getEl("login-username").value;
        const p = getEl("login-password").value;
        const btn = getEl("btn-submit-login");
        
        btn.textContent = "Memproses...";
        btn.disabled = true;
        hide(getEl("login-error-msg"));

        try {
            // Panggil API Login yang baru
            const user = await apiLogin(u, p);
            
            // Simpan session
            localStorage.setItem("user", JSON.stringify(user));
            
            // Transisi ke halaman utama
            checkSession();
        } catch (err) {
            const errDiv = getEl("login-error-msg");
            errDiv.textContent = err.message;
            show(errDiv);
        } finally {
            btn.textContent = "Login";
            btn.disabled = false;
        }
    });

    getEl("btn-toggle-pass").addEventListener("click", () => {
        const inp = getEl("login-password");
        const icon = getEl("btn-toggle-pass").querySelector("i");
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

    getEl("btn-logout").addEventListener("click", doLogout);

    // FORM DATA
    getEl("chk-manual-ulok").addEventListener("change", (e) => {
        const isManual = e.target.checked;
        const sel = getEl("sel-ulok");
        const inp = getEl("inp-ulok-manual");

        if (isManual) {
            hide(sel); show(inp);
            STATE.formData.nomorUlok = inp.value;
        } else {
            show(sel); hide(inp);
            STATE.formData.nomorUlok = sel.value;
        }
        STATE.formData.isManualUlok = isManual;
    });

    getEl("sel-ulok").addEventListener("change", async (e) => {
        const val = e.target.value;
        STATE.formData.nomorUlok = val;
        
        // Cari data detail dari opsi SPK
        const found = STATE.spkOptions.find(o => o.nomorUlok === val);
        if (found) populateForm(found);

        // Cek data temp di server
        await loadTempData(val);
    });

    getEl("inp-ulok-manual").addEventListener("change", async (e) => {
        const val = e.target.value.toUpperCase();
        STATE.formData.nomorUlok = val;
        await loadTempData(val);
    });

    // Auto-save fields on change
    const inputs = document.querySelectorAll("#data-input-form input");
    inputs.forEach(inp => {
        inp.addEventListener("change", (e) => {
            const key = mapInputToKey(e.target.id);
            if(key) STATE.formData[key] = e.target.value;
            saveFormDataBackground();
        });
    });

    getEl("data-input-form").addEventListener("submit", (e) => {
        e.preventDefault();
        // Simpan data terakhir
        updateStateFormData();
        saveFormDataBackground().then(() => {
            switchToView("floorplan");
        });
    });

    // FLOOR PLAN NAV
    getEl("btn-back-form").addEventListener("click", () => switchToView("form"));
    
    document.querySelectorAll(".pagination-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".pagination-btn").forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            STATE.currentPage = parseInt(e.target.dataset.page);
            renderFloorPlan();
        });
    });

    // CAMERA & MODAL
    getEl("btn-close-cam").addEventListener("click", closeCamera);
    
    getEl("btn-snap").addEventListener("click", capturePhoto);
    getEl("btn-retake").addEventListener("click", resetCameraUI);
    
    getEl("btn-confirm-snap").addEventListener("click", async () => {
        if (!STATE.capturedBlob && !STATE.currentPhotoNote) return;
        await saveCapturedPhoto();
    });

    getEl("inp-file-upload").addEventListener("change", (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            handlePreviewAndSave(evt.target.result); // base64
        };
        reader.readAsDataURL(file);
    });

    getEl("btn-cant-snap").addEventListener("click", () => {
        // Mode "Tidak Bisa Difoto"
        STATE.capturedBlob = "TIDAK_BISA_DIFOTO";
        STATE.currentPhotoNote = "TIDAK BISA DIFOTO";
        saveCapturedPhoto();
    });

    getEl("btn-warning-ok").addEventListener("click", () => hide(getEl("warning-modal")));

    // PDF GENERATION
    getEl("btn-save-pdf").addEventListener("click", generateAndSendPDF);
}

// ==========================================
// 6. FORM LOGIC
// ==========================================
function renderSpkOptions() {
    const sel = getEl("sel-ulok");
    sel.innerHTML = '<option value="">-- pilih nomor ulok --</option>';
    STATE.spkOptions.forEach(opt => {
        const op = document.createElement("option");
        op.value = opt.nomorUlok;
        op.textContent = opt.nomorUlok;
        sel.appendChild(op);
    });
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
    // Sync semua input ke STATE
    const map = {
        "inp-cabang": "cabang", "inp-sipil": "kontraktorSipil", "inp-me": "kontraktorMe",
        "inp-spk-awal": "spkAwal", "inp-spk-akhir": "spkAkhir", "inp-nama-toko": "namaToko", 
        "inp-kode-toko": "kodeToko", "inp-tgl-go": "tanggalGo", "inp-tgl-st": "tanggalSt",
        "inp-tgl-foto": "tanggalAmbilFoto"
    };
    for(let id in map) {
        STATE.formData[map[id]] = getEl(id).value;
    }
}

function populateForm(data) {
    if(!data) return;
    STATE.formData = { ...STATE.formData, ...data };
    
    getEl("inp-cabang").value = data.cabang || STATE.user?.cabang || "";
    getEl("inp-sipil").value = data.kontraktorSipil || "";
    getEl("inp-me").value = data.kontraktorMe || "";
    getEl("inp-spk-awal").value = formatDateInput(data.spkAwal);
    getEl("inp-spk-akhir").value = formatDateInput(data.spkAkhir);
    getEl("inp-nama-toko").value = data.namaToko || "";
    getEl("inp-kode-toko").value = data.kodeToko || "";
    getEl("inp-tgl-go").value = formatDateInput(data.tanggalGo);
    getEl("inp-tgl-st").value = formatDateInput(data.tanggalSt);
    getEl("inp-tgl-foto").value = formatDateInput(data.tanggalAmbilFoto);
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
            // Restore form
            populateForm(res.data);
            
            // Restore Photos
            if (Array.isArray(res.data.photos)) {
                STATE.photos = {};
                // Preload photos
                const promises = res.data.photos.map((pid, idx) => {
                    if(!pid) return null;
                    const id = idx + 1;
                    const url = `${API_BASE_URL}/view-photo/${pid}`;
                    // Object structure for photos
                    STATE.photos[id] = {
                        url: url,
                        point: ALL_POINTS.find(p => p.id === id),
                        timestamp: new Date().toISOString()
                    };
                    // Simple preload image
                    return new Promise(r => { 
                        const img = new Image(); 
                        img.onload = r; img.onerror = r; 
                        img.src = url; 
                    });
                });
                await Promise.all(promises);
                
                // Hitung next photo number
                const taken = Object.keys(STATE.photos).map(Number);
                const next = taken.length > 0 ? Math.max(...taken) + 1 : 1;
                STATE.currentPhotoNumber = next > 38 ? 38 : next;
            }
        }
    } catch(e) {
        console.error(e);
    } finally {
        hideLoading();
    }
}

async function saveFormDataBackground() {
    try {
        await saveTemp(STATE.formData);
        console.log("Form saved background");
    } catch(e) { console.error("Save fail", e); }
}

// ==========================================
// 7. FLOOR PLAN & CAMERA LOGIC
// ==========================================
function renderFloorPlan() {
    // Update Header Info
    getEl("fp-store-name").textContent = `${STATE.formData.namaToko || "-"} (${STATE.formData.kodeToko || "-"})`;
    getEl("fp-date").textContent = STATE.formData.tanggalAmbilFoto || "-";
    
    // Update Progress
    const completed = Object.keys(STATE.photos).length;
    getEl("progress-text").textContent = `Progress: ${completed}/38 foto`;
    getEl("progress-fill").style.width = `${(completed/38)*100}%`;
    
    // Show Completion?
    if (completed === 38) show(getEl("completion-section"));
    else hide(getEl("completion-section"));

    // Render Image
    const imgMap = { 1: "floor.png", 2: "floor3.jpeg", 3: "floor2.jpeg" };
    getEl("floor-img").src = imgMap[STATE.currentPage] || "floor.png";

    // Render Points
    const container = getEl("points-container");
    container.innerHTML = "";
    
    const pagePoints = PHOTO_POINTS[STATE.currentPage] || [];
    pagePoints.forEach(p => {
        const btn = document.createElement("button");
        let status = "pending";
        if (STATE.photos[p.id]) status = "completed";
        else if (p.id === STATE.currentPhotoNumber) status = "active";
        else if (p.id < STATE.currentPhotoNumber) status = "missed"; // missed logic

        btn.className = `photo-point ${status}`;
        btn.style.left = `${p.x}%`;
        btn.style.top = `${p.y}%`;
        btn.textContent = p.id;
        
        // Disable click logic
        if (p.id > STATE.currentPhotoNumber && !STATE.photos[p.id]) {
            btn.disabled = true;
            btn.style.opacity = 0.6;
        } else {
            btn.onclick = () => openCamera(p);
        }

        container.appendChild(btn);
    });

    renderPhotoList();
}

function renderPhotoList() {
    const list = getEl("photo-list-grid");
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

// --- CAMERA FUNCTIONS ---
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
    if (STATE.stream) {
        STATE.stream.getTracks().forEach(t => t.stop());
        STATE.stream = null;
    }
    STATE.isCameraReady = false;
    hide(getEl("camera-modal"));
}

function capturePhoto() {
    if (!STATE.isCameraReady) return;
    
    const vid = getEl("cam-video");
    const cvs = getEl("cam-canvas");
    const ctx = cvs.getContext("2d");
    
    // Resize logic (Max 1280px)
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
        
        // Show result
        getEl("captured-img").src = url;
        hide(getEl("cam-preview-container"));
        show(getEl("photo-result-container"));
        
        // Toggle buttons
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

// Handle upload dari file
async function handlePreviewAndSave(base64) {
    // Langsung save
    await savePhotoToBackend(base64, null);
}

async function saveCapturedPhoto() {
    showLoading("Menyimpan foto...");
    try {
        let base64 = null;
        let note = STATE.currentPhotoNote || null; // Jika "TIDAK BISA DIFOTO"

        if (STATE.capturedBlob && STATE.capturedBlob !== "TIDAK_BISA_DIFOTO") {
            base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(STATE.capturedBlob);
            });
        }
        
        await savePhotoToBackend(base64, note);

    } catch (e) {
        alert("Gagal simpan: " + e.message);
    } finally {
        hideLoading();
    }
}

async function savePhotoToBackend(base64, note) {
    const pointId = STATE.currentPoint.id;
    
    // Payload
    const payload = {
        nomorUlok: STATE.formData.nomorUlok,
        photoId: pointId,
        photoNote: note,
        photoBase64: base64
    };

    const res = await saveTemp(payload);
    if (!res.ok) throw new Error(res.error || "Gagal save server");

    // Update LOCAL STATE
    STATE.photos[pointId] = {
        url: base64 || "fototidakbisadiambil.jpeg", // Preview local
        point: STATE.currentPoint,
        timestamp: new Date().toISOString(),
        note: note
    };

    // Update Photo Number jika foto baru
    if (pointId === STATE.currentPhotoNumber) {
        let next = pointId + 1;
        if (next > 38) next = 38;
        STATE.currentPhotoNumber = next;
    }

    STATE.currentPhotoNote = null; // reset note
    closeCamera();
    renderFloorPlan(); // Refresh UI
    showToast(`Foto #${pointId} tersimpan!`);
}

function showWarningModal(msg, onOk) {
    getEl("warning-msg").textContent = msg;
    const btn = getEl("btn-warning-ok");
    
    // Hapus event lama agar tidak menumpuk
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener("click", () => {
        hide(getEl("warning-modal"));
        if(onOk) onOk();
    });
    show(getEl("warning-modal"));
}


// ==========================================
// 8. PDF WORKER INTEGRATION
// ==========================================
function generateAndSendPDF() {
    showLoading("Membuat PDF (Mohon Tunggu)...");
    
    // Pastikan file pdf.worker.js ada di folder yang sama
    const worker = new Worker("pdf.worker.js", { type: "module" });

    worker.postMessage({
        formData: STATE.formData,
        capturedPhotos: STATE.photos,
        allPhotoPoints: ALL_POINTS
    });

    worker.onmessage = async (e) => {
        const { ok, pdfBase64, pdfBlob, error } = e.data;
        
        if(!ok) {
            console.error(error);
            alert("Gagal membuat PDF");
            hideLoading();
            worker.terminate();
            return;
        }

        try {
            // Logic Save to SpreadSheet & Email (dari api.js lama)
            // Kita implementasi ulang fetch-nya di sini agar tidak ribet import
            
            showLoading("Mengirim PDF ke Email...");
            
            const user = STATE.user;
            const safeDate = STATE.formData.tanggalAmbilFoto || "unknown";
            const filename = `Dokumentasi_${STATE.formData.kodeToko}_${safeDate}.pdf`;

            // 1. Save Toko (Drive + Sheet)
            const payload = {
                ...STATE.formData,
                pdfBase64, 
                emailPengirim: user.email || ""
            };
            
            const resSave = await fetch(`${API_BASE_URL}/save-toko`, {
                method: "POST", headers:{"Content-Type":"application/json"},
                body: JSON.stringify(payload)
            });
            const jsonSave = await resSave.json();
            if(!jsonSave.ok) throw new Error("Gagal simpan ke Spreadsheet");

            // 2. Kirim Email
            const resEmail = await fetch(`${API_BASE_URL}/send-pdf-email`, {
                method:"POST", headers:{"Content-Type":"application/json"},
                body: JSON.stringify({
                    email: user.email,
                    pdfBase64, filename, pdfUrl: jsonSave.pdfUrl,
                    ...STATE.formData
                })
            });

            // Download lokal
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement("a");
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click(); a.remove();

            showToast("Berhasil disimpan & dikirim! ✅");
            
        } catch(err) {
            console.error(err);
            alert("Error upload: " + err.message);
        } finally {
            hideLoading();
            worker.terminate();
        }
    };

    worker.onerror = (e) => {
        console.error("Worker Error", e);
        hideLoading();
        worker.terminate();
    };
}