// ==========================================
// 1. GLOBAL STATE & CONFIG
// ==========================================
// Base URL Backend
const API_BASE_URL = "https://sparta-backend-5hdj.onrender.com"; 

// URL untuk Logging (Internal)
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
    stream: null,
    currentPhotoNote: null,
    isLoadingData: false, // Tambahan untuk proteksi klik
    isSavingBackground: false // Tambahan untuk indikator save background
};

// Data titik koordinat (TETAP SAMA)
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
        toast.style.background = type === "success" ? "#16a34a" : "#dc2626";
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 3000);
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
    checkTimeLimit();
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
            method: "POST", 
            redirect: "follow",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(logData),
        });
    } catch (error) { console.error("Log failed", error); }
}

function checkSession() {
    const ssoAuth = sessionStorage.getItem("authenticated");
    const ssoEmail = sessionStorage.getItem("loggedInUserEmail");
    const ssoCabang = sessionStorage.getItem("loggedInUserCabang");
    const ssoRole = sessionStorage.getItem("userRole");

    const localUser = localStorage.getItem("user");

    if (ssoAuth === "true" && ssoEmail && ssoCabang) {
        STATE.user = {
            email: ssoEmail,
            cabang: ssoCabang,
            role: ssoRole || "USER",
            source: "sso"
        };
        proceedToApp();
        
    } else if (localUser) {
        STATE.user = JSON.parse(localUser);
        if (!STATE.user.cabang && STATE.user.password) {
             STATE.user.cabang = STATE.user.password; 
        }
        proceedToApp();
        
    } else {
        switchToView("login");
        checkTimeLimit();
    }
}

function proceedToApp() {
    const infoEl = getEl("header-user-info");
    if(infoEl) infoEl.textContent = `Building & Maintenance — ${STATE.user.cabang || ""}`;
    
    show(getEl("main-header"));
    show(getEl("sub-header"));
    hide(getEl("view-login"));
    
    // Jika ada saved_ok dari reload sebelumnya
    if(localStorage.getItem("saved_ok") === "1"){
        showToast("Berhasil disimpan! ✅");
        localStorage.removeItem("saved_ok");
    }

    switchToView("form");

    const inpCabang = getEl("inp-cabang");
    if (inpCabang) {
        inpCabang.value = STATE.user.cabang || "";
        STATE.formData.cabang = STATE.user.cabang || ""; 
    }

    if (STATE.user.cabang) {
        loadSpkData(STATE.user.cabang);
    }
}

function checkTimeLimit() {
    const now = new Date();
    // Konversi ke WIB (UTC+7)
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const wib = new Date(utc + 7 * 60 * 60000);
    const hour = wib.getHours();

    const isLoginView = !getEl("view-login").classList.contains("hidden");
    const msgContainer = getEl("login-info-msg");
    const btnLogin = getEl("btn-submit-login");

    if (hour < 6 || hour >= 18) {
        const timeStr = `${hour.toString().padStart(2, "0")}:${wib.getMinutes().toString().padStart(2, "0")}`;
        const msg = `⏰ Login hanya dapat dilakukan pada jam operasional 06.00–18.00 WIB.\nSekarang pukul ${timeStr} WIB.`;
        
        if (isLoginView && msgContainer) {
            msgContainer.textContent = msg;
            show(msgContainer);
            if(btnLogin) { btnLogin.disabled = true; btnLogin.style.cursor = "not-allowed"; btnLogin.style.opacity = 0.6; }
        } else if (STATE.user && !isLoginView) {
            if(getEl("warning-modal").classList.contains("hidden")) {
                showWarningModal(`Sesi Anda telah berakhir.\nLogin hanya dapat dilakukan pada jam operasional 06.00–18.00 WIB.\nSekarang pukul ${timeStr} WIB.`, () => doLogout());
            }
        }
    } else {
        if(msgContainer) hide(msgContainer);
        if(btnLogin) { btnLogin.disabled = false; btnLogin.style.cursor = "pointer"; btnLogin.style.opacity = 1; }
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
    logLoginAttempt(username, password, "Attempt");

    try {
        const res = await fetch(`${API_BASE_URL}/doc/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: username, password: password }),
        });

        const json = await res.json();

        if (res.ok && json.ok) {
            logLoginAttempt(username, password, "Success");
            return {
                email: username,
                cabang: password,
                role: (json.user && json.user.role) ? json.user.role.toUpperCase() : "USER",
                ...json.user
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

async function cekStatus(nomorUlok) {
    if (!nomorUlok) return null;
    try {
        const res = await fetch(`${API_BASE_URL}/doc/cek-status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nomorUlok })
        });
        return await res.json();
    } catch (e) {
        console.error("Gagal cek status:", e);
        return null;
    }
}

// ==========================================
// 5. EVENT LISTENERS
// ==========================================
function initEventListeners() {
    // LOGIN
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
                const user = await apiLogin(u, p);
                
                localStorage.setItem("user", JSON.stringify(user));
                sessionStorage.setItem("authenticated", "true");
                sessionStorage.setItem("loggedInUserEmail", user.email);
                sessionStorage.setItem("loggedInUserCabang", user.cabang);
                sessionStorage.setItem("userRole", user.role);

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
    }

    // Toggle Password
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

    // Form Manual/Auto
    const chkManual = getEl("chk-manual-ulok");
    if(chkManual) {
        chkManual.addEventListener("change", (e) => {
            const isManual = e.target.checked;
            const sel = getEl("sel-ulok");
            const inp = getEl("inp-ulok-manual");

            if (isManual) { 
                hide(sel); show(inp); 
                STATE.formData.nomorUlok = inp.value; 
            } 
            else { 
                show(sel); hide(inp); 
                STATE.formData.nomorUlok = sel.value; 
            }
            STATE.formData.isManualUlok = isManual;
        });
    }

    const selUlok = getEl("sel-ulok");
    if(selUlok) {
        selUlok.addEventListener("change", async (e) => {
            const val = e.target.value;
            STATE.formData.isManualUlok = false;
            if(!val) return;

            STATE.formData.nomorUlok = val;
            const found = STATE.spkOptions.find(o => o.nomorUlok === val);
            
            if (found) populateForm(found);
            await loadTempData(val);
        });
    }

    const inpUlokMan = getEl("inp-ulok-manual");
    if(inpUlokMan) {
        inpUlokMan.addEventListener("change", async (e) => {
            const val = e.target.value.toUpperCase();
            STATE.formData.isManualUlok = true; 
            STATE.formData.nomorUlok = val;
            await loadTempData(val, true);
        });
    }

    // Input Change & Save
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
            // PERBAIKAN: Gunakan status saving background, jangan block user di sini
            showToast("Menyimpan data...", "success");
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

    // === CAMERA & UPLOAD LISTENERS ===
    const btnCloseCam = getEl("btn-close-cam");
    if(btnCloseCam) btnCloseCam.addEventListener("click", closeCamera);
    
    const btnSnap = getEl("btn-snap");
    if(btnSnap) btnSnap.addEventListener("click", capturePhoto);

    const vid = getEl("cam-video");
    if (vid) vid.addEventListener("click", capturePhoto);

    const btnRetake = getEl("btn-retake");
    if(btnRetake) btnRetake.addEventListener("click", resetCameraUI);
    
    // PERBAIKAN: Logic Confirm Capture Optimistic
    const btnConfirm = getEl("btn-confirm-snap");
    if(btnConfirm) btnConfirm.addEventListener("click", () => {
        if (STATE.capturedBlob && STATE.capturedBlob !== "TIDAK_BISA_DIFOTO") {
            saveCapturedPhotoOptimistic();
        } else {
             closeCamera(); 
        }
    });

    // PERBAIKAN: Logic Upload Photo
    const inpFile = getEl("inp-file-upload");
    if(inpFile) {
        inpFile.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if(!file) return;
            // Kita gunakan logic optimistic juga untuk upload agar seragam
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result;
                // Simpan ke state sementara dulu (Optimistic)
                const pointId = STATE.currentPoint.id;
                STATE.photos[pointId] = {
                    url: base64,
                    point: STATE.currentPoint,
                    timestamp: new Date().toISOString(),
                    note: null
                };
                
                // Update counter
                if (pointId === STATE.currentPhotoNumber) {
                    let next = pointId + 1;
                    if (next > 38) next = 38;
                    STATE.currentPhotoNumber = next;
                }
                
                // Close & Render
                closeCamera();
                renderFloorPlan();
                showToast(`Foto #${pointId} berhasil diunggah (menyimpan...)`, "success");

                // Save Background
                savePhotoToBackend(base64, null, pointId);
            };
            reader.readAsDataURL(file);
        });
    }

    // PERBAIKAN: Logic Tidak Bisa Difoto (Optimistic)
    const btnCant = getEl("btn-cant-snap");
    if(btnCant) {
        btnCant.addEventListener("click", () => {
            const pointId = STATE.currentPoint.id;
            
            // Set state optimistic
            STATE.photos[pointId] = {
                url: "fototidakbisadiambil.jpeg", // Placeholder
                point: STATE.currentPoint,
                timestamp: new Date().toISOString(),
                note: "TIDAK BISA DIFOTO"
            };

            if (pointId === STATE.currentPhotoNumber) {
                let next = pointId + 1;
                if (next > 38) next = 38;
                STATE.currentPhotoNumber = next;
            }

            closeCamera();
            renderFloorPlan();
            showToast(`Foto #${pointId} ditandai tidak bisa (menyimpan...)`);
            
            // Save Background
            savePhotoToBackend(null, "TIDAK BISA DIFOTO", pointId);
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
        op.textContent = opt.nomorUlok;
        sel.appendChild(op);
    });
    if (STATE.spkOptions.length === 1) {
        const oneUlok = STATE.spkOptions[0].nomorUlok;
        sel.value = oneUlok;
        const event = new Event('change');
        sel.dispatchEvent(event);
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
    const wasManual = STATE.formData.isManualUlok;
    STATE.formData = { ...STATE.formData, ...data };
    
    if (wasManual) STATE.formData.isManualUlok = true;
    
    const safeSet = (id, val) => { const el = getEl(id); if(el) el.value = val || ""; };
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
    try { 
        const d = new Date(dateStr);
        if(isNaN(d.getTime())) return "";
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } 
    catch { return ""; }
}

function preloadImage(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(src);
        img.onerror = () => resolve(src); 
        img.src = src;
    });
}

async function loadTempData(ulok, isManualOverride = false) {
    if(!ulok) return;
    STATE.isLoadingData = true; // Set flag
    showLoading("Sinkronisasi data..."); 
    try {
        const res = await getTempByUlok(ulok);
        if (res.ok && res.data) {
            if (isManualOverride) {
                const { isManualUlok: _ignored, ...rest } = res.data;
                populateForm(rest);
                STATE.formData.isManualUlok = true; 
            } else {
                populateForm(res.data);
            }

            if (Array.isArray(res.data.photos)) {
                STATE.photos = {};
                const preloadPromises = []; 
                console.log("Preloading images...");
                res.data.photos.forEach((pid, idx) => {
                    if(!pid) return; 
                    const id = idx + 1;
                    const url = `${API_BASE_URL}/doc/view-photo/${pid}`;
                    preloadPromises.push(preloadImage(url));
                    STATE.photos[id] = {
                        url: url,
                        point: ALL_POINTS.find(p => p.id === id),
                        timestamp: new Date().toISOString(),
                    };
                });
                if (preloadPromises.length > 0) await Promise.all(preloadPromises);
                
                const taken = Object.keys(STATE.photos).map(Number);
                const next = taken.length > 0 ? Math.max(...taken) + 1 : 1;
                STATE.currentPhotoNumber = next > 38 ? 38 : next;
            }
        }
    } catch(e) { 
        console.error(e); 
    } finally { 
        STATE.isLoadingData = false; // Reset flag
        hideLoading(); 
        renderFloorPlan(); 
    }
}

async function saveFormDataBackground() {
    STATE.isSavingBackground = true;
    try { await saveTemp(STATE.formData); console.log("Form saved background"); } 
    catch(e) { console.error("Save fail", e); }
    finally { STATE.isSavingBackground = false; }
}

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

    const imgMap = { 
        1: "floor.png", 
        2: "floor3.jpeg", 
        3: "floor2.jpeg" 
    };
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
            
            // PERBAIKAN: Proteksi klik saat loading
            if (STATE.isLoadingData) {
                btn.disabled = true;
                btn.style.cursor = "wait";
            }
            else if (!STATE.photos[p.id] && p.id > STATE.currentPhotoNumber) {
                btn.disabled = true; 
                btn.style.opacity = 0.6;
                btn.style.cursor = "not-allowed";
            } else {
                btn.onclick = () => openCamera(p);
            }
            
            if (STATE.photos[p.id]) {
                const check = document.createElement("span");
                check.className = "check-mark";
                check.textContent = "✓";
                btn.appendChild(check);
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
                 html += `<div class="photo-note" style="color:red; font-size:0.75rem; border:1px solid red; padding:2px; margin-top:4px;">${data.note}</div>`;
            } else {
                 html += `<img src="${data.url}" class="thumbnail" loading="lazy" onclick="viewLargePhoto('${data.url}')" style="cursor:pointer">`;
            }
        }
        item.innerHTML = html;
        list.appendChild(item);
    });
}

window.viewLargePhoto = (url) => {
    const img = getEl("captured-img");
    img.src = url;
    
    hide(getEl("cam-preview-container"));
    show(getEl("photo-result-container"));
    
    hide(getEl("actions-pre-capture"));
    hide(getEl("actions-post-capture"));
    
    getEl("cam-title").textContent = "Lihat Foto";
    show(getEl("camera-modal"));
    
    const btnClose = getEl("btn-close-cam");
    const newBtn = btnClose.cloneNode(true);
    btnClose.parentNode.replaceChild(newBtn, btnClose);
    
    newBtn.addEventListener("click", () => {
        closeCamera();
        newBtn.addEventListener("click", closeCamera);
    });
};

async function openCamera(point) {
    // PERBAIKAN: Cek flag loading agar aman
    if (STATE.isLoadingData) {
        showToast("Sedang memuat data, harap tunggu...", "error");
        return;
    }

    STATE.currentPoint = point;
    getEl("cam-title").textContent = `Foto #${point.id}: ${point.label}`;
    
    resetCameraUI();
    show(getEl("camera-modal"));
    
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
    const btnClose = getEl("btn-close-cam");
    const newBtn = btnClose.cloneNode(true);
    btnClose.parentNode.replaceChild(newBtn, btnClose);
    newBtn.addEventListener("click", closeCamera);
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
        STATE.currentPhotoNote = null;
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
    STATE.currentPhotoNote = null;
    show(getEl("cam-preview-container"));
    hide(getEl("photo-result-container"));
    show(getEl("actions-pre-capture"));
    hide(getEl("actions-post-capture"));
}

// === PERBAIKAN: FUNGSI BARU OPTIMISTIC UI ===
async function saveCapturedPhotoOptimistic() {
    // 1. Ambil data foto dari blob
    let base64 = null;
    if (STATE.capturedBlob) {
        base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(STATE.capturedBlob);
        });
    }

    const pointId = STATE.currentPoint.id;

    // 2. Update UI secara INSTAN (Optimistic)
    STATE.photos[pointId] = {
        url: base64, // Pakai base64 lokal untuk preview
        point: STATE.currentPoint,
        timestamp: new Date().toISOString(),
        note: null
    };

    // 3. Majukan pointer foto selanjutnya
    if (pointId === STATE.currentPhotoNumber) {
        let next = pointId + 1;
        if (next > 38) next = 38;
        STATE.currentPhotoNumber = next;
    }

    // 4. Tutup kamera & Refresh Denah (User merasa aplikasi sangat cepat)
    closeCamera();
    renderFloorPlan();
    showToast(`Foto #${pointId} disimpan!`);

    // 5. Kirim ke Server di BACKGROUND (Jangan pakai await blocking)
    savePhotoToBackend(base64, null, pointId);
}

// Fungsi Backend Save (Background Process)
async function savePhotoToBackend(base64, note, pointId) {
    const payload = {
        nomorUlok: STATE.formData.nomorUlok,
        photoId: pointId,
        photoNote: note,
        photoBase64: base64
    };

    try {
        // Jangan pakai showLoading() di sini agar tidak memblokir layar
        const res = await saveTemp(payload);
        if (!res.ok) throw new Error(res.error || "Gagal save server");
        console.log(`Foto #${pointId} synced to server.`);
    } catch (e) {
        console.error("Gagal save foto background:", e);
        showToast(`Gagal sync foto #${pointId}: ${e.message}`, "error");
        // Opsional: Tandai foto error di UI jika perlu
    }
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

async function generateAndSendPDF() {
    const ulok = STATE.formData.nomorUlok;
    
    if (ulok) {
        showLoading("Mengecek status dokumen...");
        try {
            const statusRes = await cekStatus(ulok);
            if (statusRes && (statusRes.status === "DISETUJUI" || statusRes.status === "MENUNGGU VALIDASI")) {
                hideLoading();
                showToast(`Dokumen status ${statusRes.status}, tidak bisa disimpan!`, "error");
                showWarningModal(`Gagal Simpan!\nDokumen ini sudah berstatus: ${statusRes.status}.\nAnda tidak diperbolehkan mengubah data lagi.`);
                return;
            }
        } catch (e) { 
            console.warn("Gagal cek status, melanjutkan...", e); 
        }
    }

    showLoading("Membuat PDF...");
    
    const worker = new Worker("pdf.worker.js"); 

    worker.postMessage({
        formData: STATE.formData,      
        capturedPhotos: STATE.photos,  
        allPhotoPoints: ALL_POINTS     
    });

    worker.onmessage = async (e) => {
        const { ok, pdfBase64, pdfBlob, error } = e.data;
        
        if(!ok) {
            console.error("Worker Error:", error); 
            showToast("Gagal membuat PDF: " + error, "error");
            hideLoading(); 
            worker.terminate(); 
            return;
        }

        try {
            showLoading("Mengirim PDF & Email...");
            const user = STATE.user;
            const safeDate = formatDateInput(STATE.formData.tanggalAmbilFoto) || "unknown";
            const filename = `Dokumentasi_${STATE.formData.kodeToko || "TOKO"}_${safeDate}.pdf`;

            const payload = { 
                ...STATE.formData, 
                pdfBase64, 
                emailPengirim: user.email || "" 
            };
            
            // Simpan Temp Dulu (Backup)
            await saveTemp(payload);

            // Simpan ke Toko (Sheet/Drive)
            const resSave = await fetch(`${API_BASE_URL}/doc/save-toko`, {
                method: "POST", 
                headers: {"Content-Type":"application/json"},
                body: JSON.stringify(payload)
            });
            const jsonSave = await resSave.json();
            
            if(!jsonSave.ok) throw new Error(jsonSave.error || "Gagal simpan ke Spreadsheet");

            // Kirim Email
            await fetch(`${API_BASE_URL}/doc/send-pdf-email`, {
                method:"POST", 
                headers:{"Content-Type":"application/json"},
                body: JSON.stringify({
                    email: user.email, 
                    pdfBase64, 
                    filename, 
                    pdfUrl: jsonSave.pdfUrl, 
                    ...STATE.formData
                })
            });

            // Download Lokal
            const url = URL.createObjectURL(pdfBlob);
            const a = document.createElement("a");
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click(); a.remove();

            // Reload Page agar state bersih
            localStorage.setItem("saved_ok", "1");
            location.reload(); 
            
        } catch(err) {
            console.error(err); 
            showToast("Error upload: " + err.message, "error");
            hideLoading(); 
        } finally {
            worker.terminate();
        }
    };
    
    worker.onerror = (e) => {
        console.error("Worker Error Event", e); 
        showToast("Error Worker PDF", "error");
        hideLoading(); 
        worker.terminate();
    };
}