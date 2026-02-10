// ==========================================
// 1. GLOBAL STATE & CONFIG
// ==========================================
const API_BASE_URL = "https://sparta-backend-5hdj.onrender.com";
// URL Apps Script (Backup logging)
const APPS_SCRIPT_POST_URL = "https://script.google.com/macros/s/AKfycbzPubDTa7E2gT5HeVLv9edAcn1xaTiT3J4BtAVYqaqiFAvFtp1qovTXpqpm-VuNOxQJ/exec";

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
    isLoadingData: false,
    isSavingBackground: false,
    isProcessing: false,
    documentStatus: null
};

// ... (PHOTO_POINTS tetap sama, disingkat agar muat, JANGAN DIHAPUS di file asli Anda) ...
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

const showToast = (text, type = "success", duration = 3000) => {
    const toast = getEl("form-status-toast");
    if (!toast) return;

    toast.classList.remove("show");

    setTimeout(() => {
        toast.textContent = text;
        toast.style.background = type === "success" ? "#16a34a" :
            type === "error" ? "#dc2626" :
                type === "warning" ? "#d97706" : "#333";
        toast.classList.add("show");

        setTimeout(() => toast.classList.remove("show"), duration);
    }, 50);
};

const showLoading = (text = "Loading...") => {
    const txt = getEl("loading-text");
    const ovl = getEl("loading-overlay");
    if (txt) txt.textContent = text;
    if (ovl) show(ovl);
};

const hideLoading = () => hide(getEl("loading-overlay"));

// [FIXED] Robust URL to Base64 (Menangani 404/500/CORS)
async function urlToBase64(url) {
    if (!url) return null;
    try {
        // Timeout 10 detik agar tidak hanging selamanya
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, { 
            cache: 'no-cache',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn(`Gagal fetch gambar (${response.status}): ${url}`);
            return null; // Return null agar PDF Worker merender kotak abu-abu
        }

        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(null); // Resolve null jika gagal baca
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.warn("Error konversi gambar:", url, error);
        return null;
    }
}

function preloadImage(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = url;
        img.onload = () => resolve(true);
        img.onerror = () => {
            console.warn("Gagal memuat gambar (404/Error):", url);
            resolve(false); 
        };
    });
}

// ==========================================
// 3. AUTH & INIT
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    checkSession();
    checkTimeLimit();
    setInterval(checkTimeLimit, 60000);

    const dateEl = getEl("current-date-display");
    if (dateEl) {
        const d = new Date();
        const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateEl.textContent = d.toLocaleDateString('id-ID', opts);
    }

    initEventListeners();
});

function checkSession() {
    const ssoAuth = sessionStorage.getItem("authenticated");
    const ssoEmail = sessionStorage.getItem("loggedInUserEmail");
    const ssoCabang = sessionStorage.getItem("loggedInUserCabang");
    const ssoRole = sessionStorage.getItem("userRole");

    if (ssoAuth !== "true" || !ssoEmail) {
        alert("Sesi Anda telah habis atau Anda belum login.");
        window.location.href = '/';
        return;
    }

    STATE.user = {
        email: ssoEmail,
        cabang: ssoCabang,
        role: ssoRole || "USER",
        source: "sso"
    };

    proceedToApp();
}

function proceedToApp() {
    const headerCabang = getEl("header-cabang");
    if (headerCabang) headerCabang.textContent = STATE.user.cabang || "";

    show(getEl("main-header"));

    if (localStorage.getItem("saved_ok") === "1") {
        showToast("PDF Berhasil Disimpan & Diunduh! ✅", "success");
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
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const wib = new Date(utc + 7 * 60 * 60000);
    const hour = wib.getHours();

    if (hour < 6 || hour >= 18) {
        const timeStr = `${hour.toString().padStart(2, "0")}:${wib.getMinutes().toString().padStart(2, "0")}`;
        if (STATE.user) {
            if (getEl("warning-modal") && getEl("warning-modal").classList.contains("hidden")) {
                showWarningModal(`Sesi Anda telah berakhir.\nAplikasi hanya dapat diakses pada jam operasional 06.00–18.00 WIB.\nSekarang pukul ${timeStr} WIB.`, () => doLogout());
            }
        }
    }
}

function doLogout() {
    sessionStorage.clear();
    localStorage.removeItem("user");
    STATE.user = null;
    window.location.href = '/';
}

function switchToView(viewName) {
    hide(getEl("view-form"));
    hide(getEl("view-floorplan"));

    if (viewName === "form") {
        show(getEl("view-form"));
        show(getEl("main-header"));
    } else if (viewName === "floorplan") {
        show(getEl("view-floorplan"));
        show(getEl("main-header"));
        renderFloorPlan();
    }
}

// ==========================================
// 4. API CALLS
// ==========================================
async function loadSpkData(cabang) {
    if (!cabang) return;
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomorUlok }),
    });
    return res.json();
}

async function saveTemp(payload) {
    try {
        const res = await fetch(`${API_BASE_URL}/doc/save-temp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const errText = await res.text(); 
            throw new Error(`Server Error (${res.status})`);
        }

        return await res.json();
    } catch (e) {
        console.error("Save Temp Error:", e);
        throw e;
    }
}

// [FIXED] Ubah ke POST karena server menolak GET (405)
async function cekStatus(ulok) {
    if (!ulok) return null;
    try {
        // Mencoba POST terlebih dahulu sesuai pola endpoint lain
        const res = await fetch(`${API_BASE_URL}/doc/cek-status`, {
            method: "POST", 
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ulok }) // atau { nomorUlok: ulok } tergantung backend
        });

        if (!res.ok) {
            // Jika backend ternyata GET (fallback logic jika POST gagal 404/405)
            if (res.status === 404 || res.status === 405) {
                 const resGet = await fetch(`${API_BASE_URL}/doc/cek-status?ulok=${ulok}`);
                 if (resGet.ok) return await resGet.json();
            }
            console.warn(`Gagal cek status (Server ${res.status}).`);
            return null;
        }
        return await res.json();
    } catch (e) {
        console.warn("Koneksi bermasalah saat cek status (diabaikan):", e);
        return null; // Return null agar tidak memblokir flow
    }
}

// ==========================================
// 5. EVENT LISTENERS
// ==========================================
function initEventListeners() {
    const btnLogout = getEl("btn-logout");
    if (btnLogout) btnLogout.addEventListener("click", doLogout);

    const chkManual = getEl("chk-manual-ulok");
    if (chkManual) {
        chkManual.addEventListener("change", (e) => {
            const isManual = e.target.checked;
            const sel = getEl("sel-ulok");
            const inp = getEl("inp-ulok-manual");

            if (isManual) {
                hide(sel);
                show(inp);
                STATE.formData.nomorUlok = inp.value;
            } else {
                show(sel);
                hide(inp);
                STATE.formData.nomorUlok = sel.value;
            }
            STATE.formData.isManualUlok = isManual;
        });
    }

    const selUlok = getEl("sel-ulok");
    if (selUlok) {
        selUlok.addEventListener("change", async (e) => {
            const val = e.target.value;
            STATE.formData.isManualUlok = false;
            if (!val) return;

            STATE.formData.nomorUlok = val;
            const found = STATE.spkOptions.find(o => o.nomorUlok === val);

            if (found) populateForm(found);
            await loadTempData(val);
        });
    }

    const inpUlokMan = getEl("inp-ulok-manual");
    if (inpUlokMan) {
        inpUlokMan.addEventListener("change", async (e) => {
            const val = e.target.value.toUpperCase();
            STATE.formData.isManualUlok = true;
            STATE.formData.nomorUlok = val;
            await loadTempData(val, true);
        });
    }

    const inputs = document.querySelectorAll("#data-input-form input");
    inputs.forEach(inp => {
        inp.addEventListener("change", (e) => {
            const key = mapInputToKey(e.target.id);
            if (key) STATE.formData[key] = e.target.value;
            saveFormDataBackground();
        });
    });

    const formInput = getEl("data-input-form");
    if (formInput) {
        formInput.addEventListener("submit", (e) => {
            e.preventDefault();
            updateStateFormData();
            showToast("Menyimpan data...", "success");
            saveFormDataBackground().then(() => switchToView("floorplan"));
        });
    }

    const btnBack = getEl("btn-back-form");
    if (btnBack) btnBack.addEventListener("click", () => switchToView("form"));

    document.querySelectorAll(".pagination-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".pagination-btn").forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            STATE.currentPage = parseInt(e.target.dataset.page);
            renderFloorPlan();
        });
    });

    const btnCloseCam = getEl("btn-close-cam");
    if (btnCloseCam) btnCloseCam.addEventListener("click", closeCamera);

    const btnSnap = getEl("btn-snap");
    if (btnSnap) btnSnap.addEventListener("click", capturePhoto);

    const vid = getEl("cam-video");
    if (vid) vid.addEventListener("click", capturePhoto);

    const btnRetake = getEl("btn-retake");
    if (btnRetake) btnRetake.addEventListener("click", resetCameraUI);

    const btnConfirm = getEl("btn-confirm-snap");
    if (btnConfirm) btnConfirm.addEventListener("click", () => {
        if (STATE.capturedBlob) {
            saveCapturedPhotoOptimistic();
        } else {
            closeCamera();
        }
    });

    const inpFile = getEl("inp-file-upload");
    if (inpFile) {
        inpFile.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result;
                const pointId = STATE.currentPoint.id;

                STATE.photos[pointId] = {
                    url: base64,
                    point: STATE.currentPoint,
                    timestamp: new Date().toISOString(),
                    note: null
                };

                if (pointId === STATE.currentPhotoNumber) {
                    let next = pointId + 1;
                    if (next > 38) next = 38;
                    STATE.currentPhotoNumber = next;
                }

                closeCamera();
                renderFloorPlan();
                showToast(`Foto #${pointId} berhasil diunggah (menyimpan...)`, "success");
                savePhotoToBackend(base64, null, pointId);
            };
            reader.readAsDataURL(file);
        });
    }

    const btnCant = getEl("btn-cant-snap");
    if (btnCant) {
        btnCant.addEventListener("click", () => {
            const pointId = STATE.currentPoint.id;

            STATE.photos[pointId] = {
                url: "fototidakbisadiambil.jpeg",
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
            showToast(`Foto #${pointId} ditandai tidak bisa`, "warning");
            savePhotoToBackend(null, "TIDAK BISA DIFOTO", pointId);
        });
    }

    const btnWarnOk = getEl("btn-warning-ok");
    if (btnWarnOk) btnWarnOk.addEventListener("click", () => hide(getEl("warning-modal")));

    const btnPdf = getEl("btn-save-pdf");
    if (btnPdf) btnPdf.addEventListener("click", generateAndSendPDF);
}

// ==========================================
// 6. FORM LOGIC
// ==========================================
function renderSpkOptions() {
    const sel = getEl("sel-ulok");
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Pilih nomor ulok --</option>';
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
        "inp-sipil": "kontraktorSipil",
        "inp-me": "kontraktorMe",
        "inp-spk-awal": "spkAwal",
        "inp-spk-akhir": "spkAkhir",
        "inp-nama-toko": "namaToko",
        "inp-kode-toko": "kodeToko",
        "inp-tgl-go": "tanggalGo",
        "inp-tgl-st": "tanggalSt",
        "inp-tgl-foto": "tanggalAmbilFoto"
    };
    return map[id];
}

function updateStateFormData() {
    const map = {
        "inp-cabang": "cabang",
        "inp-sipil": "kontraktorSipil",
        "inp-me": "kontraktorMe",
        "inp-spk-awal": "spkAwal",
        "inp-spk-akhir": "spkAkhir",
        "inp-nama-toko": "namaToko",
        "inp-kode-toko": "kodeToko",
        "inp-tgl-go": "tanggalGo",
        "inp-tgl-st": "tanggalSt",
        "inp-tgl-foto": "tanggalAmbilFoto"
    };
    for (let id in map) {
        const el = getEl(id);
        if (el) STATE.formData[map[id]] = el.value;
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
    if (!data) return;
    const wasManual = STATE.formData.isManualUlok;
    STATE.formData = { ...STATE.formData, ...data };

    if (wasManual) STATE.formData.isManualUlok = true;

    const safeSet = (id, val) => {
        const el = getEl(id);
        if (el) el.value = val || "";
    };
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

function formatDateInput(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date)) return dateString;
    return date.toISOString().split('T')[0];
}

async function loadTempData(ulok, isManualOverride = false) {
    if (!ulok) return;
    
    STATE.isLoadingData = true;
    showLoading("Sinkronisasi data..."); 
    
    try {
        const [res, statusRes] = await Promise.all([
            getTempByUlok(ulok).catch(err => ({ ok: false, error: err })), 
            cekStatus(ulok).catch(() => null)
        ]);

        STATE.documentStatus = statusRes ? statusRes.status : null;

        if (res && res.ok && res.data) {
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
                    if (!pid) return;
                    const id = idx + 1;
                    const url = `${API_BASE_URL}/doc/view-photo/${pid}`;
                    
                    const p = preloadImage(url)
                        .then(() => true)
                        .catch((err) => {
                            console.warn(`Gagal load gambar ${id}:`, err);
                            return false; 
                        });
                        
                    preloadPromises.push(p);

                    STATE.photos[id] = {
                        url: url,
                        point: ALL_POINTS.find(p => p.id === id) || { id, label: "Unknown" },
                        timestamp: new Date().toISOString(),
                    };
                });

                // Kita tunggu sebentar tapi tidak wajib sukses semua
                await Promise.allSettled(preloadPromises);

                const taken = Object.keys(STATE.photos).map(Number);
                const next = taken.length > 0 ? Math.max(...taken) + 1 : 1;
                STATE.currentPhotoNumber = next > 38 ? 38 : next;
            }
        }
    } catch (e) {
        console.error("Error loadTempData:", e);
        showToast("Gagal memuat sebagian data", "error");
    } finally {
        STATE.isLoadingData = false;
        hideLoading();
        renderFloorPlan();
    }
}

async function saveFormDataBackground() {
    STATE.isSavingBackground = true;
    try {
        await saveTemp(STATE.formData);
        console.log("Form saved background");
    } catch (e) {
        console.error("Save fail", e);
    } finally {
        STATE.isSavingBackground = false;
    }
}

// ==========================================
// 7. FLOOR PLAN & CAMERA
// ==========================================
function renderFloorPlan() {
    const tStore = getEl("fp-store-name");
    if (tStore) tStore.textContent = `${STATE.formData.namaToko || "-"} (${STATE.formData.kodeToko || "-"})`;

    const tDate = getEl("fp-date");
    if (tDate) tDate.textContent = STATE.formData.tanggalAmbilFoto || "-";

    const completed = Object.keys(STATE.photos).length;
    const photoCount = getEl("photo-count");
    if (photoCount) photoCount.textContent = completed;

    const txtProg = getEl("progress-text");
    if (txtProg) txtProg.textContent = `Progress: ${completed}/38 foto`;

    const fillProg = getEl("progress-fill");
    if (fillProg) fillProg.style.width = `${(completed / 38) * 100}%`;

    const floorImg = getEl("floor-img");
    const imgMap = { 1: "../../assets/floor.png", 2: "../../assets/floor3.jpeg", 3: "../../assets/floor2.jpeg" };
    if (floorImg) floorImg.src = imgMap[STATE.currentPage] || "../../assets/floor.png";

    const btnSave = getEl("btn-save-pdf");
    const compSec = getEl("completion-section");
    const isApproved = STATE.documentStatus === "DISETUJUI";

    if (btnSave) {
        if (isApproved) {
            hide(btnSave);
        } else {
            show(btnSave);
        }
    }

    if (compSec) {
        if (isApproved) {
            show(compSec);
            compSec.className = "alert alert-success"; 
            compSec.innerHTML = `
                <h3 style="margin: 0 0 0.5rem 0;">
                    <i class="fa-solid fa-clipboard-check"></i> Dokumen Sudah Disetujui
                </h3>
                <p style="margin: 0; font-size: 0.95rem;">
                    Dokumen ini telah berstatus <b>DISETUJUI</b>. Data dikunci dan tidak dapat diubah lagi.
                </p>
            `;
        } else {
            compSec.className = "alert alert-success"; 
            compSec.innerHTML = `
                <h3 style="margin: 0 0 0.5rem 0;">
                    <i class="fa-solid fa-circle-check"></i> Semua Foto Lengkap! 🎉
                </h3>
                <p style="margin: 0; font-size: 0.95rem;">Silakan tekan tombol "Simpan & Kirim PDF" di atas.</p>
            `;
            
            if (completed === 38) show(compSec);
            else hide(compSec);
        }
    }

    const container = getEl("points-container");
    if (container) {
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

            const isLocked = !STATE.photos[p.id] && p.id > STATE.currentPhotoNumber;
            
            if (STATE.isLoadingData) {
                btn.disabled = true;
                btn.style.cursor = "wait";
            } else if (isApproved) {
                btn.disabled = false;
                btn.style.cursor = "pointer";
                if (!STATE.photos[p.id]) {
                    btn.disabled = true;
                    btn.style.opacity = 0.5;
                }
            } else if (isLocked) {
                btn.disabled = true;
                btn.style.opacity = 0.6;
                btn.style.cursor = "not-allowed";
                btn.title = "Harap ambil foto berurutan"; 
            } else {
                btn.disabled = false;
                btn.onclick = () => openCamera(p);
                btn.title = p.label;
            }

            if (isApproved && STATE.photos[p.id]) {
                btn.onclick = () => viewLargePhoto(STATE.photos[p.id].url);
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
    if (!list) return;
    list.innerHTML = "";

    const currentPoints = PHOTO_POINTS[STATE.currentPage] || [];

    currentPoints.forEach(p => {
        const item = document.createElement("div");
        let status = STATE.photos[p.id] ? "completed" : "pending";
        item.className = `photo-item ${status}`;

        let html = `
            <div class="photo-number">${p.id}</div>
            <div class="photo-label">${p.label}</div>
        `;

        if (STATE.photos[p.id]) {
            const data = STATE.photos[p.id];
            if (data.note) {
                html += `<div class="photo-note">${data.note}</div>`;
            } else {
                html += `<img src="${data.url}" class="thumbnail" loading="lazy" onclick="viewLargePhoto('${data.url}')" />`;
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
    newBtn.addEventListener("click", closeCamera);
};

function resetCameraUI() {
    STATE.capturedBlob = null;
    STATE.currentPhotoNote = null;
    show(getEl("cam-preview-container"));
    hide(getEl("photo-result-container"));
    
    show(getEl("actions-pre-capture"));
    hide(getEl("actions-post-capture"));
}

async function openCamera(point) {
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
            video: {
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });
        STATE.stream = stream;
        const vid = getEl("cam-video");
        vid.srcObject = stream;
        vid.onloadedmetadata = () => STATE.isCameraReady = true;
    } catch (e) {
        showToast("Gagal akses kamera: " + e.message, "error");
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
    if (!STATE.stream) return;

    const video = getEl("cam-video");
    const canvas = getEl("cam-canvas");
    const imgResult = getEl("captured-img");
    
    if (!video || !canvas || !imgResult) return;

    let w = video.videoWidth;
    let h = video.videoHeight;
    
    const MAX_WIDTH = 1000;
    if (w > MAX_WIDTH) {
        h = Math.round(h * (MAX_WIDTH / w));
        w = MAX_WIDTH;
    }

    canvas.width = w;
    canvas.height = h;
    
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.65); // Kualitas 0.65
    
    STATE.capturedBlob = dataUrl;
    imgResult.src = dataUrl;

    hide(getEl("cam-preview-container"));
    show(getEl("photo-result-container"));
    hide(getEl("actions-pre-capture"));
    show(getEl("actions-post-capture"));
}

async function saveCapturedPhotoOptimistic() {
    const base64 = STATE.capturedBlob; 

    if (!base64) {
        showToast("Gagal menyimpan foto: Data kosong", "error");
        return;
    }

    const pointId = STATE.currentPoint.id;

    STATE.photos[pointId] = {
        url: base64,
        point: STATE.currentPoint,
        timestamp: new Date().toISOString(),
        note: null
    };

    if (pointId === STATE.currentPhotoNumber) {
        let next = pointId + 1;
        if (next > 38) next = 38;
        STATE.currentPhotoNumber = next;
    }

    closeCamera();
    renderFloorPlan();
    showToast(`Foto #${pointId} disimpan!`);
    savePhotoToBackend(base64, null, pointId);
}

async function savePhotoToBackend(base64, note, pointId) {
    const payload = {
        nomorUlok: STATE.formData.nomorUlok,
        photoId: pointId,
        photoNote: note,
        photoBase64: base64
    };

    try {
        const res = await saveTemp(payload);
        if (!res.ok) throw new Error(res.error || "Gagal save server");
        console.log(`Foto #${pointId} synced to server.`);
    } catch (e) {
        console.error("Gagal save foto background:", e);
        showToast(`Warning: Foto #${pointId} belum tersync ke server. Periksa koneksi.`, "warning");
    }
}

function showWarningModal(msg, onOk) {
    const msgEl = getEl("warning-msg");
    if (msgEl) msgEl.textContent = msg;
    const btn = getEl("btn-warning-ok");
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener("click", () => {
        hide(getEl("warning-modal"));
        if (onOk) onOk();
    });
    show(getEl("warning-modal"));
}

// [FIXED] GENERATE PDF YANG DEFENSIVE (Anti Gagal)
async function generateAndSendPDF() {
    console.log("Memulai proses PDF...");

    if (typeof ALL_POINTS === 'undefined' || !ALL_POINTS || ALL_POINTS.length === 0) {
        showToast("Error Sistem: Data ALL_POINTS tidak ditemukan.", "error");
        return;
    }

    const ulok = STATE.formData.nomorUlok;

    if (ulok) {
        showLoading("Mengecek status...");
        const statusRes = await cekStatus(ulok);
        // Jika statusRes null (error), kita lanjut saja agar tidak blocking
        if (statusRes && (statusRes.status === "DISETUJUI" || statusRes.status === "MENUNGGU VALIDASI")) {
            hideLoading();
            showWarningModal(`Gagal Simpan!\nDokumen status: ${statusRes.status}.`);
            return;
        }
    }

    showLoading("Menyiapkan data gambar (Mungkin agak lama)...");

    const photosForPdf = {};
    const photoKeys = Object.keys(STATE.photos);

    // Proses konversi async parallel
    const conversionPromises = photoKeys.map(async (key) => {
        const original = STATE.photos[key];
        const newItem = { ...original };
        
        if (newItem.url && !newItem.url.startsWith("data:")) {
            try {
                // Gunakan fungsi robust baru
                const base64 = await urlToBase64(newItem.url);
                if (base64) {
                    newItem.url = base64; 
                } else {
                    console.warn(`Foto #${key} gagal di-load untuk PDF, akan dikosongkan.`);
                    newItem.url = null; // Set null agar worker tidak error render
                }
            } catch (e) {
                console.error(`Error convert foto #${key} for PDF:`, e);
                newItem.url = null;
            }
        }
        photosForPdf[key] = newItem;
    });

    await Promise.all(conversionPromises);

    showLoading("Membuat PDF...");

    let worker;
    try {
        worker = new Worker("pdf.worker.js");
    } catch (e) {
        hideLoading();
        showToast("Gagal memuat sistem PDF.", "error");
        return;
    }

    worker.postMessage({
        formData: STATE.formData,
        capturedPhotos: photosForPdf,
        allPhotoPoints: ALL_POINTS
    });

    worker.onmessage = async (e) => {
        const { ok, pdfBase64, pdfBlob, error } = e.data;

        if (!ok) {
            console.error("PDF Worker Error:", error);
            showToast("Gagal generate PDF.", "error");
            hideLoading();
            worker.terminate();
            return;
        }

        const user = STATE.user || { email: "unknown" };
        const safeDate = formatDateInput(STATE.formData.tanggalAmbilFoto) || "unknown";
        const filename = `Dokumentasi_${STATE.formData.kodeToko || "TOKO"}_${safeDate}.pdf`;
        
        // Helper untuk download lokal (Backup jika server gagal)
        const downloadLocal = () => {
             const url = URL.createObjectURL(pdfBlob);
             const a = document.createElement("a");
             a.href = url;
             a.download = filename;
             document.body.appendChild(a);
             a.click();
             a.remove();
        };

        try {
            showLoading("Mengupload Data ke Server...");

            const payload = {
                ...STATE.formData,
                pdfBase64,
                emailPengirim: user.email || ""
            };

            const resSave = await fetch(`${API_BASE_URL}/doc/save-toko`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            
            if (!resSave.ok) {
                // JIKA SERVER ERROR 500, KITA TETAP DOWNLOAD PDF
                throw new Error(`Server menolak data (${resSave.status}). Ukuran PDF mungkin terlalu besar.`);
            }
            
            const jsonSave = await resSave.json();

            // Kirim Email (Optional, non-blocking)
            fetch(`${API_BASE_URL}/doc/send-pdf-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: user.email,
                    pdfBase64: pdfBase64,
                    filename: filename,
                    pdfUrl: jsonSave.pdfUrl,
                    namaToko: STATE.formData.namaToko,
                    kodeToko: STATE.formData.kodeToko
                })
            }).catch(err => console.warn("Email gagal kirim:", err));

            // Download setelah sukses upload
            downloadLocal();

            localStorage.setItem("saved_ok", "1");
            location.reload();

        } catch (err) {
            console.error("Upload Error:", err);
            hideLoading();
            
            // FALLBACK PENTING: Force download agar user tidak kehilangan data
            downloadLocal();
            
            showWarningModal(`Gagal Simpan ke Server: ${err.message}\n\nPDF telah didownload ke HP Anda sebagai backup. Harap kirim file tersebut manual ke Admin.`);
        } finally {
            worker.terminate();
        }
    };
    
    worker.onerror = (e) => {
        console.error("Worker Crash:", e);
        showToast("Error Worker PDF", "error");
        hideLoading();
        worker.terminate();
    };
}