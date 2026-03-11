// ==========================================
// 1. CONFIG & AUTHENTICATION
// ==========================================
const BASE_URL = "https://sparta-backend-5hdj.onrender.com";
const TARGET_API_URL = "https://script.google.com/macros/s/AKfycbw9m4ckqXZIjIwFIqJUYz7CGxSgX-ONmhcDeTEPo_VA6D7kI3VEjvYAww2Gn_eHCA_u/exec";

let currentUser = null;
let allDocuments = [];
let filteredDocuments = [];
let targetDataDb = []; // State untuk menampung data Target dari Sheets

let isEditing = false;
let currentEditId = null;
let currentPage = 1;
const itemsPerPage = 10;

// === STATE MANAGEMENT UNTUK FILE ===
let newFilesBuffer = {};
let deletedFilesList = []; // Sekarang menyimpan { category, filename, url }
let originalFileLinks = ""; // Simpan file_links asli saat edit
let existingFilesFromUI = []; // Backup: track file dari UI rendering

const UPLOAD_CATEGORIES = [
    { key: "fotoExisting", label: "Foto Toko Existing" },
    { key: "fotoRenovasi", label: "Foto Proses Renovasi" },
    { key: "me", label: "Gambar ME" },
    { key: "sipil", label: "Gambar Sipil" },
    { key: "sketsaAwal", label: "Sketsa Awal (Layout)" },
    { key: "spk", label: "Dokumen SPK" },
    { key: "rab", label: "Dokumen RAB & Penawaran" },
    { key: "instruksiLapangan", label: "Instruksi Lapangan" },
    { key: "pengawasan", label: "Berkas Pengawasan" },
    { key: "aanwijzing", label: "Aanwijzing" },
    { key: "kerjaTambahKurang", label: "Kerja Tambah Kurang" },
    { key: "pendukung", label: "Dokumen Pendukung (NIDI, SLO, dll)" },
];

// Upload tunables
const IMAGE_MAX_WIDTH = 1920;
const IMAGE_MAX_HEIGHT = 1920;
const IMAGE_TARGET_BYTES = 900 * 1024;
const IMAGE_MIN_QUALITY = 0.55;
const PDF_COMPRESSION_ENABLED = true;

document.addEventListener("DOMContentLoaded", () => {
    checkAuth();
    initApp();
    setupAutoLogout();
});

function checkAuth() {
    const isAuthenticated = sessionStorage.getItem("authenticated");
    if (isAuthenticated !== "true") {
        window.location.href = "../../auth/index.html";
        return;
    }

    currentUser = {
        email: sessionStorage.getItem("loggedInUserEmail") || "",
        cabang: sessionStorage.getItem("loggedInUserCabang") || "",
        role: sessionStorage.getItem("userRole") || ""
    };

    if (document.getElementById("user-name"))
        document.getElementById("user-name").textContent = currentUser.email || "User";
    if (document.getElementById("user-branch"))
        document.getElementById("user-branch").textContent = currentUser.cabang || "Cabang";

    const btnAddNew = document.getElementById("btn-add-new");
    const filterCabang = document.getElementById("filter-cabang");
    const filterStatus = document.getElementById("filter-status");

    // Logic Role Head Office
    if (currentUser.cabang.toLowerCase() === "head office") {
        if (filterCabang) filterCabang.style.display = "inline-block";
        if (filterStatus) filterStatus.style.display = "inline-block";
        if (btnAddNew) btnAddNew.style.display = "none";
    } else {
        if (filterCabang) filterCabang.style.display = "none";
        if (filterStatus) filterStatus.style.display = "none";
        if (btnAddNew) btnAddNew.style.display = "inline-block";
    }
}

// ==========================================
// 2. INITIALIZATION & NAVIGATION
// ==========================================
function initApp() {
    // Navigasi
    const btnAddNew = document.getElementById("btn-add-new");
    if (btnAddNew) btnAddNew.addEventListener("click", () => showForm());
    document.getElementById("btn-back").addEventListener("click", () => showTable());

    // Modal Actions
    document.getElementById("btn-close-error").addEventListener("click", () => hideModal("modal-error"));
    document.getElementById("btn-close-success").addEventListener("click", () => hideModal("modal-success"));

    // Form Handling
    document.getElementById("store-form").addEventListener("submit", handleFormSubmit);

    const uppercaseFields = ['kodeToko', 'namaToko'];
    uppercaseFields.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', function () {
                const start = this.selectionStart;
                const end = this.selectionEnd;
                this.value = this.value.toUpperCase();
                this.setSelectionRange(start, end);
            });
        }
    });

    // Live Formatting Input Angka
    document.querySelectorAll(".input-decimal").forEach(input => {
        input.addEventListener("input", (e) => {
            e.target.value = formatDecimalInput(e.target.value);
        });
    });

    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExportData);
    }

    const exportPdfBtn = document.getElementById('btn-export-pdf');
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', handleExportToPDF);
    }

    const exportExcelBtn = document.getElementById('btn-export-excel');
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener('click', handleExportToExcel);
    }

    setupAutoCalculation();

    // Search & Filter
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => handleSearch(e.target.value));
    }

    const filterSelect = document.getElementById("filter-cabang");
    if (filterSelect) {
        filterSelect.addEventListener("change", () => {
            const keyword = document.getElementById("search-input") ? document.getElementById("search-input").value : "";
            handleSearch(keyword);
        });
    }

    const filterStatus = document.getElementById("filter-status");
    if (filterStatus) {
        filterStatus.addEventListener("change", () => {
            const keyword = document.getElementById("search-input") ? document.getElementById("search-input").value : "";
            handleSearch(keyword);
        });
    }

    // Load Data Awal
    renderUploadSections();
    fetchTargetsFromSheets(); // <-- Call Target Fetch
    fetchDocuments();
}

// ==========================================
// FITUR TARGET DASHBOARD
// ==========================================
async function fetchTargetsFromSheets() {
    try {
        const res = await fetch(TARGET_API_URL);
        const data = await res.json();
        targetDataDb = data;
        updateTargetDashboard();
    } catch (err) {
        console.error("Gagal mengambil data target dari Sheets:", err);
    }
}

function updateTargetDashboard() {
    const dashboard = document.getElementById("target-dashboard");
    if (!dashboard || targetDataDb.length === 0) return;

    if (!currentUser || !currentUser.cabang) return;

    dashboard.style.display = "flex";

    let targetReguler = 0;
    let targetFranchise = 0;
    let targetTotal = 0;

    const isHeadOffice = currentUser.cabang.toLowerCase() === "head office";
    const filterSelect = document.getElementById("filter-cabang");
    const selectedCabang = filterSelect ? filterSelect.value.toUpperCase() : "";

    if (isHeadOffice) {
        if (selectedCabang === "") {
            // Jika filter "Semua Cabang", jumlahkan semuanya
            targetDataDb.forEach(item => {
                const namaCabang = (item.cabang || "").toUpperCase();
                // PENTING: Abaikan baris di Sheets yang bernama "TOTAL" atau "JUMLAH" agar tidak double
                if (!namaCabang.includes("TOTAL") && !namaCabang.includes("JUMLAH") && !namaCabang.includes("GRAND")) {
                    targetReguler += item.reguler || 0;
                    targetFranchise += item.franchise || 0;
                    targetTotal += item.total || 0;
                }
            });
        } else {
            // Berdasarkan filter cabang yang dipilih
            const found = targetDataDb.find(item => item.cabang === selectedCabang);
            if (found) {
                targetReguler = found.reguler || 0;
                targetFranchise = found.franchise || 0;
                targetTotal = found.total || 0;
            }
        }
    } else {
        // User cabang biasa
        const myCabang = currentUser.cabang.toUpperCase();
        const found = targetDataDb.find(item => item.cabang === myCabang);
        if (found) {
            targetReguler = found.reguler || 0;
            targetFranchise = found.franchise || 0;
            targetTotal = found.total || 0;
        }
    }

    // Update Angka di UI Dashboard
    document.getElementById("ui-target-reguler").textContent = targetReguler;
    document.getElementById("ui-target-franchise").textContent = targetFranchise;
    document.getElementById("ui-target-total").textContent = targetTotal;

    // Kalkulasi Progress Bar
    const currentInputted = filteredDocuments.length;
    let persentase = 0;
    
    if (targetTotal > 0) {
        persentase = Math.round((currentInputted / targetTotal) * 100);
    }

    const displayPersentase = persentase > 100 ? 100 : persentase;

    const progressText = document.getElementById("ui-progress-text");
    if(progressText) progressText.textContent = `${currentInputted} / ${targetTotal} Toko (${persentase}%)`;
    
    const fillBar = document.getElementById("ui-progress-fill");
    if(fillBar) {
        fillBar.style.width = `${displayPersentase}%`;
        if(displayPersentase < 50) fillBar.style.backgroundColor = "#ef4444";
        else if(displayPersentase < 80) fillBar.style.backgroundColor = "#f59e0b";
        else fillBar.style.backgroundColor = "#10b981";
    }
}

// ==========================================
// AUTO CALCULATION LOGIC
// ==========================================
function setupAutoCalculation() {
    const ids = ['luasBangunanLantai1', 'luasBangunanLantai2', 'luasBangunanLantai3'];
    const totalInput = document.getElementById('totalLuasBangunan');

    const parseLocalFloat = (val) => {
        if (!val) return 0;
        const cleanStr = val.toString().replace(/\./g, '').replace(',', '.');
        return parseFloat(cleanStr) || 0;
    };
    const formatLocalString = (num) => {
        return num.toFixed(2).replace('.', ',');
    };

    const calculate = () => {
        let total = 0;
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                total += parseLocalFloat(el.value);
            }
        });

        if (totalInput) {
            totalInput.value = formatLocalString(total);
        }
    };
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', calculate);
            el.addEventListener('blur', calculate);
        }
    });
}

function resetFormState() {
    newFilesBuffer = {};
    UPLOAD_CATEGORIES.forEach(cat => {
        newFilesBuffer[cat.key] = [];
    });
    deletedFilesList = [];
    originalFileLinks = ""; // Reset file_links asli
    existingFilesFromUI = []; // Reset backup tracking

    // Reset UI Elements
    document.querySelectorAll(".file-preview").forEach(el => el.innerHTML = "");
    document.querySelectorAll(".existing-files-list").forEach(el => el.innerHTML = "");
    document.querySelectorAll("input[type='file']").forEach(el => el.value = "");

    document.getElementById("store-form").reset();
    document.getElementById("error-msg").textContent = "";
}

function showTable() {
    document.getElementById("view-table").style.display = "block";
    document.getElementById("view-form").style.display = "none";
    resetFormState();

    isEditing = false;
    currentEditId = null;

    fetchDocuments();
}

function showForm(data = null) {
    document.getElementById("view-table").style.display = "none";
    document.getElementById("view-form").style.display = "block";

    resetFormState();

    const title = document.getElementById("form-title");
    const inputs = document.querySelectorAll("#store-form input");
    const btnSave = document.getElementById("btn-save");
    const isHeadOffice = currentUser.cabang?.toLowerCase() === "head office";

    inputs.forEach(input => input.disabled = false);
    if (btnSave) btnSave.style.display = "inline-block";

    renderUploadSections(isHeadOffice);

    if (data) {
        // === MODE EDIT ===
        isEditing = true;
        currentEditId = data._id || data.id || data.doc_id || data.kode_toko;

        document.getElementById("kodeToko").value = data.kode_toko || "";
        document.getElementById("namaToko").value = data.nama_toko || "";
        document.getElementById("luasSales").value = formatDecimalInput(data.luas_sales);
        document.getElementById("luasParkir").value = formatDecimalInput(data.luas_parkir);
        document.getElementById("luasGudang").value = formatDecimalInput(data.luas_gudang);
        document.getElementById("luasBangunanLantai1").value = formatDecimalInput(data.luas_bangunan_lantai_1);
        document.getElementById("luasBangunanLantai2").value = formatDecimalInput(data.luas_bangunan_lantai_2);
        document.getElementById("luasBangunanLantai3").value = formatDecimalInput(data.luas_bangunan_lantai_3);
        document.getElementById("totalLuasBangunan").value = formatDecimalInput(data.total_luas_bangunan);
        document.getElementById("luasAreaTerbuka").value = formatDecimalInput(data.luas_area_terbuka);
        document.getElementById("tinggiPlafon").value = formatDecimalInput(data.tinggi_plafon);

        originalFileLinks = data.file_links || "";

        if (data.file_links) {
            renderExistingFiles(data.file_links);
        }

        if (isHeadOffice) {
            title.textContent = `Detail Data Toko: ${data.nama_toko}`;
            inputs.forEach(input => input.disabled = true);
            if (btnSave) btnSave.style.display = "none";
        } else {
            title.textContent = `Edit Data Toko: ${data.nama_toko}`;
            document.getElementById("kodeToko").disabled = true;
            document.getElementById("namaToko").disabled = true;
        }
    } else {
        // === MODE TAMBAH ===
        isEditing = false;
        currentEditId = null;
        title.textContent = "Tambah Data Toko Baru";
    }
}

// ==========================================
// 3. UI HELPERS & RENDERERS
// ==========================================
function renderUploadSections(isReadOnly = false) {
    const container = document.getElementById("upload-container");
    if (!container) return;

    container.innerHTML = "";

    const groups = [
        { title: "Foto (JPG, JPEG, PNG)", keys: ["fotoExisting", "fotoRenovasi"] },
        { title: "Gambar (PDF, JPG, JPEG, PNG, Autocad)", keys: ["me", "sipil", "sketsaAwal"] },
        { title: "Dokumen (PDF, JPG, JPEG, PNG)", keys: ["spk", "rab", "pendukung", "instruksiLapangan", "pengawasan", "aanwijzing", "kerjaTambahKurang"] }
    ];

    groups.forEach(group => {
        const groupWrapper = document.createElement("div");
        groupWrapper.className = "upload-section-group";
        groupWrapper.innerHTML = `<h4 class="upload-section-title">${group.title}</h4>`;

        const gridDiv = document.createElement("div");
        gridDiv.className = "upload-grid";

        group.keys.forEach(key => {
            const cat = UPLOAD_CATEGORIES.find(c => c.key === key);
            if (!cat) return;

            if (!newFilesBuffer[key]) newFilesBuffer[key] = [];

            const section = document.createElement("div");
            section.className = "upload-card";

            const dropzoneStyle = isReadOnly ? 'style="display:none;"' : '';

            section.innerHTML = `
                <div class="upload-header">
                    <span class="upload-label">${cat.label}</span>
                </div>
                
                <div id="existing-${cat.key}" class="existing-files-list"></div>
                
                <div class="file-preview" id="preview-${cat.key}"></div>

                <div class="upload-dropzone-wrapper" ${dropzoneStyle}>
                    <input type="file" id="file-${cat.key}" class="hidden-file-input" multiple accept="image/*,.pdf" >
                    <label for="file-${cat.key}" class="upload-dropzone">
                        <div class="dropzone-content">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="upload-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            <span>Pilih File</span>
                        </div>
                    </label>
                </div>
            `;
            gridDiv.appendChild(section);
        });
        groupWrapper.appendChild(gridDiv);
        container.appendChild(groupWrapper);
    });

    if (!isReadOnly) {
        UPLOAD_CATEGORIES.forEach(cat => {
            const input = document.getElementById(`file-${cat.key}`);
            if (input) {
                input.addEventListener("change", (e) => {
                    const files = Array.from(e.target.files);
                    if (files.length === 0) return;

                    files.forEach(f => {
                        const isDuplicate = newFilesBuffer[cat.key].some(existing => existing.name === f.name);
                        if (!isDuplicate) {
                            newFilesBuffer[cat.key].push(f);
                        }
                    });

                    updatePreviewUI(cat.key);
                    input.value = "";
                });
            }
        });
    }
}

function updatePreviewUI(categoryKey) {
    const previewDiv = document.getElementById(`preview-${categoryKey}`);
    if (!previewDiv) return;
    previewDiv.innerHTML = "";

    const files = newFilesBuffer[categoryKey];

    files.forEach((file, index) => {
        const wrapper = document.createElement("div");
        wrapper.className = "preview-wrapper";

        const btnRemove = document.createElement("button");
        btnRemove.className = "btn-remove-preview";
        btnRemove.innerHTML = "&times;";
        btnRemove.type = "button";
        btnRemove.onclick = () => {
            newFilesBuffer[categoryKey].splice(index, 1);
            updatePreviewUI(categoryKey);
        };

        if (file.type.startsWith('image/')) {
            const img = document.createElement("img");
            img.className = "preview-thumb";
            const reader = new FileReader();
            reader.onload = (e) => { img.src = e.target.result; };
            reader.readAsDataURL(file);
            wrapper.appendChild(img);
        } else {
            const docEl = document.createElement("div");
            docEl.className = "preview-file-item";
            let icon = "📄";
            if (file.type.includes('pdf')) icon = "📕";
            docEl.innerHTML = `<span class="preview-file-icon">${icon}</span> <span class="preview-file-name">${file.name}</span>`;
            wrapper.appendChild(docEl);
        }

        wrapper.appendChild(btnRemove);
        previewDiv.appendChild(wrapper);
    });
}

function renderExistingFiles(fileLinksString) {
    if (!fileLinksString) return;
    const entries = fileLinksString.split(",").map(s => s.trim()).filter(Boolean);
    const isHeadOffice = currentUser.cabang?.toLowerCase() === "head office";

    existingFilesFromUI = [...entries];

    entries.forEach(entry => {
        const parts = entry.split("|");
        let category = "pendukung";
        let name = "File";
        let url = "#";

        if (parts.length === 3) {
            category = parts[0].trim();
            name = parts[1].trim();
            url = parts[2].trim();
        } else if (parts.length === 2) {
            name = parts[0].trim();
            url = parts[1].trim();
        } else {
            url = entry.trim();
        }

        const container = document.getElementById(`existing-${category}`) || document.getElementById("existing-pendukung");

        if (container) {
            const fileItem = document.createElement("div");
            fileItem.className = "existing-file-item";

            let iconCode = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;

            if (url.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/)) {
                iconCode = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
            }

            let deleteBtnHtml = "";
            if (!isHeadOffice) {
                const safeCategory = category.replace(/'/g, "\\'");
                const safeName = name.replace(/'/g, "\\'");
                const safeUrl = url.trim().replace(/'/g, "\\'");

                deleteBtnHtml = `
                <button type="button" class="btn-delete-existing" onclick="markFileForDeletion(this, '${safeCategory}', '${safeName}', '${safeUrl}')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Hapus
                </button>`;
            }

            fileItem.innerHTML = `
                <a href="${url}" target="_blank" class="file-link">
                    <div class="file-icon-placeholder">${iconCode}</div>
                    <span title="${name}">${name}</span>
                </a>
                ${deleteBtnHtml}
            `;
            container.appendChild(fileItem);
        }
    });
}

window.markFileForDeletion = function (btnElement, category, fileName, fileUrl) {
    if (!fileUrl || fileUrl === "#" || fileUrl.trim() === "") {
        alert("URL file tidak valid, tidak dapat dihapus.");
        return;
    }

    if (confirm(`Hapus file "${fileName}"?\nFile akan hilang permanen setelah Anda klik tombol Simpan.`)) {
        const deleteItem = {
            category: category.trim(),
            filename: fileName.trim(),
            url: fileUrl.trim()
        };

        const isDuplicate = deletedFilesList.some(item =>
            item.url === deleteItem.url && item.filename === deleteItem.filename
        );

        if (!isDuplicate) {
            deletedFilesList.push(deleteItem);
        }

        const parent = btnElement.closest(".existing-file-item");
        if (parent) parent.style.display = "none";
    }
};

// ==========================================
// 4. DATA FETCHING & TABLE
// ==========================================
async function fetchDocuments() {
    showLoading(true);
    try {
        let url = `${BASE_URL}/api/doc/list`;
        if (currentUser.cabang && currentUser.cabang.toLowerCase() !== "head office") {
            url += `?cabang=${encodeURIComponent(currentUser.cabang)}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error("Gagal mengambil data dari server");

        const rawData = await res.json();

        if (Array.isArray(rawData)) {
            allDocuments = rawData;
        } else if (rawData.items && Array.isArray(rawData.items)) {
            allDocuments = rawData.items;
        } else if (rawData.data && Array.isArray(rawData.data)) {
            allDocuments = rawData.data;
        } else {
            allDocuments = [];
        }

        updateCabangFilterOptions();

        const searchInput = document.getElementById("search-input");
        const keyword = searchInput ? searchInput.value : "";
        handleSearch(keyword);

    } catch (err) {
        console.error("Error fetching:", err);
        showToast("Gagal memuat data: " + err.message);
        allDocuments = [];
        renderTable();
    } finally {
        showLoading(false);
    }
}

function handleSearch(keyword) {
    if (typeof keyword !== 'string') keyword = "";

    const term = keyword.toLowerCase();

    const filterSelect = document.getElementById("filter-cabang");
    const filterCabang = filterSelect ? filterSelect.value : "";

    const filterStatusSelect = document.getElementById("filter-status");
    const filterStatus = filterStatusSelect ? filterStatusSelect.value : "";

    filteredDocuments = allDocuments.filter(doc => {
        const kode = (doc.kode_toko || "").toString().toLowerCase();
        const nama = (doc.nama_toko || "").toString().toLowerCase();
        const cabang = (doc.cabang || "").toString();

        const matchText = kode.includes(term) || nama.includes(term);
        const matchCabang = filterCabang === "" || cabang === filterCabang;

        let matchStatus = true;
        let statusValue = "";
        const statusCheck = checkDocumentCompleteness(doc.file_links);
        if (statusCheck.complete) {
            statusValue = "complete";
        } else {
            statusValue = "incomplete";
        }
        if (filterStatus !== "") {
            if (filterStatus === "incomplete") {
                matchStatus = !statusCheck.complete;
            } else if (filterStatus === "complete") {
                matchStatus = statusCheck.complete;
            }
        }
        doc._exportStatus = statusValue;
        return matchText && matchCabang && matchStatus;
    });
    
    filteredDocuments.reverse();
    currentPage = 1;
    renderTable();

    // UPDATE DASHBOARD TARGET TIAP KALI FILTER BERUBAH
    updateTargetDashboard();

    try {
        const exportData = filteredDocuments.map((doc) => ({
            kodeToko: doc.kode_toko || "",
            namaToko: doc.nama_toko || "",
            cabang: doc.cabang || "",
            status: doc._exportStatus || "",
        }));
        localStorage.setItem('svdokumen_filtered', JSON.stringify(exportData));
    } catch (e) { }
}

function checkDocumentCompleteness(fileLinksString) {
    const mandatoryKeys = [
        "fotoExisting",
        "fotoRenovasi",
        "me",
        "sipil",
        "sketsaAwal",
        "spk",
        "rab",
        "instruksiLapangan",
        "pengawasan",
        "aanwijzing",
        "kerjaTambahKurang"
    ];

    if (!fileLinksString) {
        const allMissingLabels = mandatoryKeys.map(key => {
            const cat = UPLOAD_CATEGORIES.find(c => c.key === key);
            return cat ? cat.label : key;
        });
        return { complete: false, missingCount: mandatoryKeys.length, missingList: allMissingLabels };
    }

    const uploadedLower = fileLinksString.toLowerCase();
    const missingLabels = mandatoryKeys
        .filter(key => !uploadedLower.includes(key.toLowerCase()))
        .map(key => {
            const cat = UPLOAD_CATEGORIES.find(c => c.key === key);
            return cat ? cat.label : key;
        });

    return {
        complete: missingLabels.length === 0,
        missingCount: missingLabels.length,
        missingList: missingLabels
    };
}

function renderTable() {
    const tbody = document.getElementById("table-body");
    const totalBadge = document.getElementById("total-records");
    const totalCountVal = document.getElementById("total-count-val");

    if (totalBadge && totalCountVal) {
        totalBadge.style.display = "flex";
        totalCountVal.textContent = filteredDocuments.length;
    }
    if (!tbody) return;

    tbody.innerHTML = "";

    if (filteredDocuments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 20px; color: #666;">Tidak ada data ditemukan</td></tr>`;
        renderPagination();
        return;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedItems = filteredDocuments.slice(startIndex, endIndex);

    const isHeadOffice = currentUser.cabang?.toLowerCase() === "head office";
    const actionLabel = isHeadOffice ? "Lihat" : "Edit";
    const actionClass = isHeadOffice ? "btn-view" : "btn-edit";

    paginatedItems.forEach((doc, index) => {
        const row = document.createElement("tr");

        const folderUrl = doc.folder_link || doc.folder_drive || doc.folder_url || "";
        const linkHtml = folderUrl
            ? `<a href="${folderUrl}" target="_blank" style="text-decoration: none; color: #007bff; font-weight:500;">Buka Folder</a>`
            : `<span style="color: #999;">-</span>`;

        let deleteBtnHtml = "";
        if (!isHeadOffice) {
            deleteBtnHtml = `
                <button class="btn-action btn-delete" 
                        onclick="handleDeleteClick('${doc.kode_toko}')" 
                        title = "Hapus Data">
                    Hapus
                </button>`;
        }

        const timestamp = doc.timestamp || "-";
        const editor = doc.last_edit || doc.pic_name || "-";
        const realNumber = index + 1 + startIndex;

        const docStatus = checkDocumentCompleteness(doc.file_links);
        let statusBadgeHtml = "";

        if (!docStatus.complete) {
            const missingText = docStatus.missingList.join(', ');

            statusBadgeHtml = `
                <div class="doc-status-badge tooltip" data-tooltip="Kurang: ${missingText}">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    Belum Lengkap (${docStatus.missingCount})
                </div>
            `;
        }

        row.innerHTML = `
            <td>${realNumber}</td>
            <td>${doc.kode_toko || "-"}</td>
            <td>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-weight: 700; font-size: 1rem;">${doc.nama_toko || "-"}</span>
                    ${statusBadgeHtml} 
                </div>
            </td>
            <td>${doc.cabang || "-"}</td>
            <td style="font-size: 0.85rem; color: #555;">${timestamp}</td>
            <td style="font-size: 0.85rem; color: #555;">${editor}</td>
            <td>${linkHtml}</td>
            <td>
                <button class="btn-action ${actionClass}" onclick="handleEditClick('${doc._id || doc.id || doc.kode_toko}')">${actionLabel}</button>
                ${deleteBtnHtml}
            </td>
        `;
        tbody.appendChild(row);
    });
    renderPagination();
}

function renderPagination() {
    const container = document.getElementById("pagination-controls");
    if (!container) return;

    const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);

    if (totalPages <= 1) {
        container.style.display = "none";
        return;
    }

    container.style.display = "flex";

    const pageInfo = document.getElementById("page-info");
    if (pageInfo) pageInfo.textContent = `Halaman ${currentPage} dari ${totalPages}`;

    const btnPrev = document.getElementById("btn-prev");
    if (btnPrev) {
        btnPrev.disabled = currentPage === 1;
        btnPrev.onclick = () => changePage(currentPage - 1);
    }

    const btnNext = document.getElementById("btn-next");
    if (btnNext) {
        btnNext.disabled = currentPage === totalPages;
        btnNext.onclick = () => changePage(currentPage + 1);
    }
}

function changePage(newPage) {
    const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
    if (newPage < 1 || newPage > totalPages) return;

    currentPage = newPage;
    renderTable();
}

window.handleEditClick = function (idOrCode) {
    const doc = allDocuments.find(d =>
        String(d._id) === String(idOrCode) ||
        String(d.id) === String(idOrCode) ||
        String(d.kode_toko) === String(idOrCode)
    );

    if (doc) {
        showForm(doc);
    } else {
        console.error("Dokumen tidak ditemukan untuk ID:", idOrCode);
    }
};

window.handleDeleteClick = async function (kode_toko) {
    if (!kode_toko) {
        alert("Kode Toko tidak valid.");
        return;
    }

    const isConfirmed = confirm(`Apakah Anda yakin ingin menghapus data toko dengan Kode: ${kode_toko}? Data yang dihapus tidak dapat dikembalikan.`);
    if (!isConfirmed) return;

    showLoading(true);

    try {
        const url = `${BASE_URL}/api/doc/delete/${encodeURIComponent(kode_toko)}`;
        const res = await fetch(url, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" }
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.message || result.detail || "Gagal menghapus data.");

        showToast("Data berhasil dihapus");
        await fetchDocuments();

    } catch (err) {
        console.error("Delete Error:", err);
        document.getElementById("error-msg").textContent = err.message;
        showModal("modal-error");
    } finally {
        showLoading(false);
    }
};

function updateCabangFilterOptions() {
    const select = document.getElementById("filter-cabang");
    if (!select) return;

    const currentValue = select.value;
    const cabangSet = new Set();

    allDocuments.forEach(doc => {
        if (doc.cabang) cabangSet.add(doc.cabang);
    });

    select.innerHTML = '<option value="">Semua Cabang</option>';

    Array.from(cabangSet).sort().forEach(cabang => {
        const option = document.createElement("option");
        option.value = cabang;
        option.textContent = cabang;
        select.appendChild(option);
    });

    if (currentValue && cabangSet.has(currentValue)) {
        select.value = currentValue;
    }
}

// ==========================================
// 5. SUBMIT HANDLER 
// ==========================================

function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function loadImageFromObjectUrl(objectUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Gagal membaca gambar untuk kompresi"));
        img.src = objectUrl;
    });
}

function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error("Gagal membuat blob hasil kompresi"));
                return;
            }
            resolve(blob);
        }, type, quality);
    });
}

function buildCompressedFileName(originalName) {
    const dot = originalName.lastIndexOf(".");
    const base = dot > 0 ? originalName.slice(0, dot) : originalName;
    return `${base}.jpg`;
}

function isPdfFile(file) {
    const byMime = (file.type || "").toLowerCase().includes("pdf");
    const byName = (file.name || "").toLowerCase().endsWith(".pdf");
    return byMime || byName;
}

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let idx = 0;
    while (value >= 1024 && idx < units.length - 1) {
        value /= 1024;
        idx += 1;
    }
    return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

async function compressPdfFile(file) {
    if (!PDF_COMPRESSION_ENABLED) {
        return {
            file, filename: file.name, mimeType: "application/pdf",
            compressed: false, compressionKind: null, sizeBefore: file.size, sizeAfter: file.size
        };
    }

    if (!window.PDFLib || !window.PDFLib.PDFDocument) {
        return {
            file, filename: file.name, mimeType: "application/pdf",
            compressed: false, compressionKind: null, sizeBefore: file.size, sizeAfter: file.size
        };
    }

    try {
        const source = await file.arrayBuffer();
        const pdfDoc = await window.PDFLib.PDFDocument.load(source, {
            updateMetadata: false, ignoreEncryption: true
        });

        const saved = await pdfDoc.save({
            useObjectStreams: true, addDefaultPage: false, objectsPerTick: 50
        });

        const blob = new Blob([saved], { type: "application/pdf" });

        if (blob.size >= file.size) {
            return {
                file, filename: file.name, mimeType: "application/pdf",
                compressed: false, compressionKind: null, sizeBefore: file.size, sizeAfter: file.size
            };
        }

        const compressedFile = new File([blob], file.name, {
            type: "application/pdf", lastModified: Date.now()
        });

        return {
            file: compressedFile, filename: compressedFile.name, mimeType: compressedFile.type,
            compressed: true, compressionKind: "pdf", sizeBefore: file.size, sizeAfter: compressedFile.size
        };
    } catch (err) {
        return {
            file, filename: file.name, mimeType: "application/pdf",
            compressed: false, compressionKind: null, sizeBefore: file.size, sizeAfter: file.size
        };
    }
}

async function compressImageFile(file) {
    const objectUrl = URL.createObjectURL(file);
    try {
        const image = await loadImageFromObjectUrl(objectUrl);
        let width = image.naturalWidth || image.width;
        let height = image.naturalHeight || image.height;

        const ratio = Math.min(1, IMAGE_MAX_WIDTH / width, IMAGE_MAX_HEIGHT / height);
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) throw new Error("Canvas tidak tersedia untuk kompresi");

        canvas.width = width;
        canvas.height = height;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);

        let quality = 0.85;
        let outputBlob = await canvasToBlob(canvas, "image/jpeg", quality);

        while (outputBlob.size > IMAGE_TARGET_BYTES && quality > IMAGE_MIN_QUALITY) {
            quality = Math.max(IMAGE_MIN_QUALITY, quality - 0.1);
            outputBlob = await canvasToBlob(canvas, "image/jpeg", quality);
        }

        if (outputBlob.size >= file.size) {
            return {
                file, filename: file.name, mimeType: file.type || "image/jpeg",
                compressed: false, compressionKind: null, sizeBefore: file.size, sizeAfter: file.size
            };
        }

        const compressedFile = new File(
            [outputBlob], buildCompressedFileName(file.name),
            { type: "image/jpeg", lastModified: Date.now() }
        );

        return {
            file: compressedFile, filename: compressedFile.name, mimeType: compressedFile.type,
            compressed: true, compressionKind: "image", sizeBefore: file.size, sizeAfter: compressedFile.size
        };
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

async function prepareUploadFile(file) {
    if (file.type && file.type.startsWith("image/")) {
        return compressImageFile(file);
    }

    if (isPdfFile(file)) {
        return compressPdfFile(file);
    }

    return {
        file, filename: file.name, mimeType: file.type || "application/octet-stream",
        compressed: false, compressionKind: null, sizeBefore: file.size, sizeAfter: file.size
    };
}

async function handleFormSubmit(e) {
    e.preventDefault();
    showLoading(true);
    setLoadingMessage("Menyiapkan data...");
    document.getElementById("error-msg").textContent = "";

    try {
        const payload = {
            kode_toko: document.getElementById("kodeToko").value,
            nama_toko: document.getElementById("namaToko").value,
            luas_sales: document.getElementById("luasSales").value,
            luas_parkir: document.getElementById("luasParkir").value,
            luas_gudang: document.getElementById("luasGudang").value,
            luas_bangunan_lantai_1: document.getElementById("luasBangunanLantai1").value,
            luas_bangunan_lantai_2: document.getElementById("luasBangunanLantai2").value,
            luas_bangunan_lantai_3: document.getElementById("luasBangunanLantai3").value,
            total_luas_bangunan: document.getElementById("totalLuasBangunan").value,
            luas_area_terbuka: document.getElementById("luasAreaTerbuka").value,
            tinggi_plafon: document.getElementById("tinggiPlafon").value,
            cabang: currentUser.cabang || "",
            email: currentUser.email || "",
            pic_name: currentUser.email || "",
            files: [] 
        };

        deletedFilesList.forEach(item => {
            payload.files.push({
                category: item.category, filename: item.filename, deleted: true
            });
        });

        const uploadTasks = [];
        for (const cat of UPLOAD_CATEGORIES) {
            const filesInBuffer = newFilesBuffer[cat.key] || [];
            filesInBuffer.forEach(file => { uploadTasks.push({ category: cat.key, file }); });
        }

        beginUploadProgress(uploadTasks.length);

        let processedFiles = 0;
        for (const task of uploadTasks) {
            setUploadProgress(
                processedFiles, uploadTasks.length,
                `Memproses ${task.file.name} (${processedFiles + 1}/${uploadTasks.length})`
            );

            const prepared = await prepareUploadFile(task.file);
            const base64String = await fileToDataURL(prepared.file);

            payload.files.push({
                category: task.category, filename: prepared.filename,
                type: prepared.mimeType, data: base64String
            });

            processedFiles += 1;
            setUploadProgress(processedFiles, uploadTasks.length, `Siap kirim: ${prepared.filename}`);
        }

        if (uploadTasks.length === 0) {
            setLoadingMessage("Mengirim data ke server...");
        } else {
            setUploadProgress(uploadTasks.length, uploadTasks.length, "Semua file siap. Mengirim data ke server...");
        }

        let url = `${BASE_URL}/api/doc/save`;
        let method = "POST";

        if (isEditing && currentEditId) {
            url = `${BASE_URL}/api/doc/update/${currentEditId}`;
            method = "PUT";
        }

        const res = await fetch(url, {
            method: method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.detail || result.message || "Gagal menyimpan data");

        showModal("modal-success");

    } catch (err) {
        console.error(err);
        document.getElementById("error-msg").textContent = err.message;
        showModal("modal-error");
    } finally {
        showLoading(false);
    }
}

// ==========================================
// 6. UTILS & MODAL ACTIONS
// ==========================================
function formatDecimalInput(value) {
    if (!value) return "";
    let str = value.toString().replace(/[^0-9]/g, "");
    if (str.length === 0) return "";
    if (str.length <= 2) return "0," + str.padStart(2, "0");
    const before = str.slice(0, -2);
    const after = str.slice(-2);
    return `${parseInt(before, 10)},${after}`;
}

function showModal(id) { document.getElementById(id).style.display = "flex"; }
function hideModal(id) {
    document.getElementById(id).style.display = "none";
    if (id === "modal-success") { showTable(); }
}

function showLoading(show) {
    const el = document.getElementById("loading-overlay");
    if (!el) return;
    if (!show) resetUploadProgressUI();
    el.style.display = show ? "flex" : "none";
}

function setLoadingMessage(message) {
    const textEl = document.getElementById("loading-text");
    if (textEl) textEl.textContent = message || "Memuat...";
}

function beginUploadProgress(totalFiles) {
    const progressBox = document.getElementById("upload-progress");
    if (!progressBox) return;

    if (totalFiles <= 0) {
        progressBox.style.display = "none";
        setLoadingMessage("Mengirim data ke server...");
        return;
    }

    progressBox.style.display = "block";
    setLoadingMessage("Mempersiapkan file upload...");
    setUploadProgress(0, totalFiles, "Menunggu proses file...");
}

function setUploadProgress(done, total, statusText) {
    const bar = document.getElementById("upload-progress-bar");
    const countEl = document.getElementById("upload-progress-count");
    const percentEl = document.getElementById("upload-progress-percent");
    const fileEl = document.getElementById("upload-progress-file");

    const safeTotal = Math.max(1, Number(total) || 1);
    const safeDone = Math.max(0, Math.min(Number(done) || 0, safeTotal));
    const percent = Math.round((safeDone / safeTotal) * 100);

    if (bar) bar.style.width = `${percent}%`;
    if (countEl) countEl.textContent = `${safeDone} / ${safeTotal} file`;
    if (percentEl) percentEl.textContent = `${percent}%`;
    if (fileEl) fileEl.textContent = statusText || "Memproses file...";
}

function resetUploadProgressUI() {
    const progressBox = document.getElementById("upload-progress");
    if (progressBox) progressBox.style.display = "none";

    setLoadingMessage("Memuat...");
    setUploadProgress(0, 1, "Menunggu proses...");
}

function showToast(msg) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.className = "toast show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}

function handleLogout() {
    sessionStorage.clear();
    window.location.href = "../../auth/index.html";
}

let idleTime = 0;
function setupAutoLogout() {
    setInterval(() => {
        idleTime++;
        if (idleTime >= 30) handleLogout();
    }, 60000);
    ['mousemove', 'keypress', 'click', 'scroll'].forEach(evt => document.addEventListener(evt, () => idleTime = 0));
}

function getUIDashboardTargets() {
    return {
        reguler: document.getElementById("ui-target-reguler")?.textContent || "0",
        franchise: document.getElementById("ui-target-franchise")?.textContent || "0",
        total: document.getElementById("ui-target-total")?.textContent || "0"
    };
}

function handleExportData() {
    if (!filteredDocuments || filteredDocuments.length === 0) {
        alert('Tidak ada data untuk diexport (Tabel kosong)!');
        return;
    }

    const targets = getUIDashboardTargets();
    const activeCabang = document.getElementById("filter-cabang")?.value || (currentUser.cabang.toLowerCase() === 'head office' ? 'Semua Cabang' : currentUser.cabang);

    const headers = [
        'No', 'Kode Toko', 'Nama Toko', 'Cabang', 'Status Kelengkapan',
        'Jumlah Kekurangan', 'Waktu Update', 'Terakhir Diedit', 'Link Folder'
    ];

    const rows = filteredDocuments.map((doc, index) => {
        const statusCheck = checkDocumentCompleteness(doc.file_links);
        const statusText = statusCheck.complete ? "Sudah Lengkap" : "Belum Lengkap";
        const folderUrl = doc.folder_link || doc.folder_drive || doc.folder_url || "-";
        const timestamp = doc.timestamp || "-";
        const editor = doc.last_edit || doc.pic_name || "-";
        return [
            index + 1,
            `"${String(doc.kode_toko || "").replace(/"/g, '""')}"`,
            `"${String(doc.nama_toko || "").replace(/"/g, '""')}"`,
            `"${String(doc.cabang || "").replace(/"/g, '""')}"`,
            `"${statusText}"`,
            `"${statusCheck.missingCount} Item"`,
            `"${timestamp}"`,
            `"${editor}"`,
            `"${folderUrl}"`
        ];
    });

    // Tambahkan Data Target di atas tabel pada file CSV
    const infoLines = [
        `"Laporan Status Dokumen Toko"`,
        `"Filter Cabang:","${activeCabang}"`,
        `"Target Reguler:","${targets.reguler}"`,
        `"Target Franchise:","${targets.franchise}"`,
        `"Target Total:","${targets.total}"`,
        `` // Baris kosong pemisah
    ];

    const csvContent = infoLines.join('\n') + '\n' + headers.join(',') + '\n' + rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `Data_Dokumen_Toko_${date}.csv`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function handleExportToPDF() {
    if (!window.jspdf) {
        alert("Library PDF belum dimuat. Pastikan Anda terhubung ke internet.");
        return;
    }

    if (!filteredDocuments || filteredDocuments.length === 0) {
        alert('Tidak ada data untuk diexport (Tabel kosong)!');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4');

    const totalData = filteredDocuments.length;
    let completeCount = 0;
    let incompleteCount = 0;

    const tableRows = filteredDocuments.map((docItem, index) => {
        const statusCheck = checkDocumentCompleteness(docItem.file_links);
        if (statusCheck.complete) completeCount++;
        else incompleteCount++;

        const statusText = statusCheck.complete ? "Sudah Lengkap" : "Belum Lengkap";
        const missingText = statusCheck.complete ? "-" : statusCheck.missingList.join(', ');
        const waktuUpdate = docItem.timestamp || docItem.updated_at || "-";
        const editor = docItem.last_edit || docItem.pic_name || "-";

        return [
            index + 1, docItem.kode_toko || "-", docItem.nama_toko || "-",
            docItem.cabang || "-", statusText, missingText, waktuUpdate, editor
        ];
    });

    const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const activeCabang = document.getElementById("filter-cabang")?.value || (currentUser.cabang.toLowerCase() === 'head office' ? 'Semua Cabang' : currentUser.cabang);
    const targets = getUIDashboardTargets();

    doc.setFontSize(16);
    doc.text("Laporan Status Dokumen Toko", 14, 15);

    doc.setFontSize(10);
    doc.text(`Tanggal Cetak: ${today}`, 14, 22);
    doc.text(`Filter Cabang: ${activeCabang}`, 14, 27);

    // Box ringkasan diperlebar untuk memuat data Target
    doc.setDrawColor(0);
    doc.setFillColor(240, 240, 240);
    doc.rect(14, 32, 160, 20, 'F'); 

    // Kolom Kiri: Status Kelengkapan
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Toko: ${totalData}`, 18, 38);
    doc.setTextColor(0, 100, 0); 
    doc.text(`Sudah Lengkap: ${completeCount}`, 18, 43);
    doc.setTextColor(200, 0, 0); 
    doc.text(`Belum Lengkap: ${incompleteCount}`, 18, 48);

    // Kolom Kanan: Target Toko
    doc.setTextColor(0, 0, 0); 
    doc.text(`Target Reguler: ${targets.reguler}`, 90, 38);
    doc.text(`Target Franchise: ${targets.franchise}`, 90, 43);
    doc.text(`Target Total: ${targets.total}`, 90, 48);

    doc.setTextColor(0, 0, 0); 

    doc.autoTable({
        startY: 57,
        head: [['No', 'Kode', 'Nama Toko', 'Cabang', 'Status', 'Detail Kekurangan', 'Update Terakhir', 'Editor']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], valign: 'middle', halign: 'center' },
        styles: { fontSize: 8, valign: 'top' }, 
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' }, 
            1: { cellWidth: 15 }, 
            2: { cellWidth: 40 }, 
            3: { cellWidth: 20 }, 
            4: { cellWidth: 25 }, 
            5: { cellWidth: 80 }, 
            6: { cellWidth: 35 }, 
            7: { cellWidth: 'auto' } 
        },
        didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === 4) {
                if (data.cell.raw === 'Belum Lengkap') {
                    data.cell.styles.textColor = [200, 0, 0];
                    data.cell.styles.fontStyle = 'bold';
                } else {
                    data.cell.styles.textColor = [0, 100, 0];
                    data.cell.styles.fontStyle = 'bold';
                }
            }
        }
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    doc.save(`Laporan_Dokumen_${dateStr}.pdf`);
}

function handleExportToExcel() {
    if (!window.XLSX) {
        alert("Library Excel belum dimuat. Pastikan Anda terhubung ke internet.");
        return;
    }

    if (!filteredDocuments || filteredDocuments.length === 0) {
        alert('Tidak ada data untuk diexport (Tabel kosong)!');
        return;
    }

    const activeCabang = document.getElementById("filter-cabang")?.value || (currentUser.cabang.toLowerCase() === 'head office' ? 'Semua Cabang' : currentUser.cabang);
    const targets = getUIDashboardTargets();
    const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    let completeCount = 0;
    let incompleteCount = 0;

    const excelDataRows = filteredDocuments.map((docItem, index) => {
        const statusCheck = checkDocumentCompleteness(docItem.file_links);
        if (statusCheck.complete) completeCount++; else incompleteCount++;
        
        const statusText = statusCheck.complete ? "Sudah Lengkap" : "Belum Lengkap";
        const missingText = statusCheck.complete ? "-" : statusCheck.missingList.join(', ');
        const folderUrl = docItem.folder_link || docItem.folder_drive || docItem.folder_url || "-";
        const waktuUpdate = docItem.timestamp || docItem.updated_at || "-";
        const editor = docItem.last_edit || docItem.pic_name || "-";

        return [
            index + 1,
            docItem.kode_toko || "-",
            docItem.nama_toko || "-",
            docItem.cabang || "-",
            statusText,
            missingText,
            waktuUpdate,
            editor,
            folderUrl
        ];
    });

    // Susun worksheet dengan menambahkan string kosong "" agar library dapat membaca cell untuk diberi garis
    const aoa = [
        ["LAPORAN STATUS DOKUMEN TOKO", "", "", "", "", "", "", "", ""],
        [`Tanggal Cetak: ${today}`, "", "", "", "", "", "", "", ""],
        [`Filter Cabang: ${activeCabang}`, "", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", ""],
        // Baris Header Ringkasan & Target
        ["RINGKASAN DATA", "", "", "TARGET TOKO", "", "", "", "", ""], 
        [`Total Data: ${filteredDocuments.length}`, "", "", `Target Reguler: ${targets.reguler}`, "", "", "", "", ""],
        [`Sudah Lengkap: ${completeCount}`, "", "", `Target Franchise: ${targets.franchise}`, "", "", "", "", ""],     
        [`Belum Lengkap: ${incompleteCount}`, "", "", `Target Total: ${targets.total}`, "", "", "", "", ""],           
        ["", "", "", "", "", "", "", "", ""],
        // Header Tabel Utama
        ["No", "Kode Toko", "Nama Toko", "Cabang", "Status Kelengkapan", "Detail Kekurangan", "Waktu Update", "Terakhir Diedit", "Link Folder"],
        ...excelDataRows
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);

    // Lebar Kolom
    worksheet['!cols'] = [
        { wch: 5 },   // No
        { wch: 15 },  // Kode Toko
        { wch: 35 },  // Nama Toko
        { wch: 20 },  // Cabang
        { wch: 20 },  // Status Kelengkapan
        { wch: 50 },  // Detail Kekurangan
        { wch: 20 },  // Waktu Update
        { wch: 25 },  // Terakhir Diedit
        { wch: 45 }   // Link Folder
    ];

    // Merge/gabungkan kolom agar layout informasi atas presisi
    worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }, // Judul
        { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }, // Tanggal
        { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }, // Filter
        
        // Merge Kotak Ringkasan Data (Kolom 0 sampai 1)
        { s: { r: 4, c: 0 }, e: { r: 4, c: 1 } },
        { s: { r: 5, c: 0 }, e: { r: 5, c: 1 } },
        { s: { r: 6, c: 0 }, e: { r: 6, c: 1 } },
        { s: { r: 7, c: 0 }, e: { r: 7, c: 1 } },

        // Merge Kotak Target Toko (Kolom 3 sampai 4)
        { s: { r: 4, c: 3 }, e: { r: 4, c: 4 } },
        { s: { r: 5, c: 3 }, e: { r: 5, c: 4 } },
        { s: { r: 6, c: 3 }, e: { r: 6, c: 4 } },
        { s: { r: 7, c: 3 }, e: { r: 7, c: 4 } }
    ];

    const range = XLSX.utils.decode_range(worksheet['!ref']);

    // Looping styling cell
    for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            if (!worksheet[cellAddress]) continue;

            worksheet[cellAddress].s = worksheet[cellAddress].s || {};
            worksheet[cellAddress].s.alignment = { vertical: "center", wrapText: true };

            // 1. Styling Judul Laporan Utama
            if (R === 0 && C === 0) {
                worksheet[cellAddress].s.font = { bold: true, sz: 14, color: { rgb: "1E293B" } };
                worksheet[cellAddress].s.alignment = { horizontal: "center", vertical: "center" };
            }

            // 2. Styling Khusus Kotak Ringkasan & Target (Baris 4 sampai 7)
            if (R >= 4 && R <= 7) {
                const isRingkasanArea = (C === 0 || C === 1);
                const isTargetArea = (C === 3 || C === 4);

                if (isRingkasanArea || isTargetArea) {
                    // Garis border kalem untuk kotak info
                    worksheet[cellAddress].s.border = {
                        top: { style: "thin", color: { rgb: "CBD5E1" } },
                        bottom: { style: "thin", color: { rgb: "CBD5E1" } },
                        left: { style: "thin", color: { rgb: "CBD5E1" } },
                        right: { style: "thin", color: { rgb: "CBD5E1" } }
                    };

                    // Header di dalam kotak info (Baris 4)
                    if (R === 4) {
                        worksheet[cellAddress].s.fill = { patternType: "solid", fgColor: { rgb: "F1F5F9" } }; // Abu-abu sangat muda/kalem
                        worksheet[cellAddress].s.font = { bold: true, color: { rgb: "334155" } };
                        worksheet[cellAddress].s.alignment = { horizontal: "center", vertical: "center" };
                    } else {
                        // Perataan teks kiri untuk isi data
                        if (C === 0 || C === 3) {
                            worksheet[cellAddress].s.alignment = { horizontal: "left", vertical: "center" };
                        }
                    }
                }
            }

            // 3. Styling area Tabel Data (Baris 9 ke bawah)
            if (R >= 9) {
                worksheet[cellAddress].s.border = {
                    top: { style: "thin", color: { rgb: "94A3B8" } }, // Border tabel sedikit lebih gelap dari border info
                    bottom: { style: "thin", color: { rgb: "94A3B8" } },
                    left: { style: "thin", color: { rgb: "94A3B8" } },
                    right: { style: "thin", color: { rgb: "94A3B8" } }
                };
            }

            // Styling Header Tabel Data (Baris 9)
            if (R === 9) { 
                worksheet[cellAddress].s.fill = { patternType: "solid", fgColor: { rgb: "E2E8F0" } };
                worksheet[cellAddress].s.font = { bold: true, color: { rgb: "1E293B" } };
                worksheet[cellAddress].s.alignment = { horizontal: "center", vertical: "center" };
            } 
            // Posisi tengah untuk kolom No(0) & Status Kelengkapan(4) di body tabel
            else if (R > 9 && (C === 0 || C === 4)) {
                worksheet[cellAddress].s.alignment = { horizontal: "center", vertical: "center", wrapText: true };
            }
        }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Status Dokumen");

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Data_Dokumen_Toko_${dateStr}.xlsx`);
}