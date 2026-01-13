// ==========================================
// 1. CONFIG & AUTHENTICATION
// ==========================================
const BASE_URL = "https://sparta-backend-5hdj.onrender.com";
let currentUser = null;
let allDocuments = [];
let filteredDocuments = [];
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
    { key: "fotoAsal", label: "Foto Toko Existing" },
    { key: "fotoRenovasi", label: "Foto Proses Renovasi" },
    { key: "me", label: "Gambar ME" },
    { key: "sipil", label: "Gambar Sipil" },
    { key: "sketsaAwal", label: "Sketsa Awal (Layout)" },
    { key: "spk", label: "Dokumen SPK" },
    { key: "rab", label: "Dokumen RAB" },
    { key: "pendukung", label: "Dokumen Pendukung (NIDI, SLO, dll)" },
];

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

    // Logic Role Head Office
    if (currentUser.cabang.toLowerCase() === "head office") {
        if (filterCabang) filterCabang.style.display = "inline-block";
        if (btnAddNew) btnAddNew.style.display = "none";
    } else {
        if (filterCabang) filterCabang.style.display = "none";
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
                // Memaksa value menjadi uppercase dan menjaga posisi kursor agar nyaman
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

    // Load Data Awal
    renderUploadSections();
    fetchDocuments();
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

    // Refresh data saat kembali ke tabel
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
        // Prioritas ID: _id (Mongo), id (SQL), doc_id, kode_toko
        currentEditId = data._id || data.id || data.doc_id || data.kode_toko;

        document.getElementById("kodeToko").value = data.kode_toko || "";
        document.getElementById("namaToko").value = data.nama_toko || "";
        document.getElementById("luasSales").value = formatDecimalInput(data.luas_sales);
        document.getElementById("luasParkir").value = formatDecimalInput(data.luas_parkir);
        document.getElementById("luasGudang").value = formatDecimalInput(data.luas_gudang);

        // PENTING: Simpan file_links asli SEKARANG, bukan saat submit
        originalFileLinks = data.file_links || "";
        console.log("Original File Links saved:", originalFileLinks);

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
        { title: "Foto (JPG, JPEG, PNG)", keys: ["fotoAsal", "fotoRenovasi"] },
        { title: "Gambar (PDF, JPG, JPEG, PNG, Autocad)", keys: ["me", "sipil", "sketsaAwal"] },
        { title: "Dokumen (PDF, JPG, JPEG, PNG)", keys: ["spk", "rab", "pendukung"] }
    ];

    groups.forEach(group => {
        // Wrapper per Kelompok (Misal: Foto, Gambar, Dokumen)
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
            section.className = "upload-card"; // Class baru untuk container per item

            // Logic display jika Read Only (Head Office)
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

    // Event Listener (Sama seperti sebelumnya, hanya target ID-nya yang penting ada)
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
                    input.value = ""; // Reset agar bisa pilih file yang sama jika perlu
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

    // BACKUP: Simpan entries asli ke existingFilesFromUI
    existingFilesFromUI = [...entries];
    console.log("Rendered existing files (backup):", existingFilesFromUI);

    entries.forEach(entry => {
        const parts = entry.split("|");
        let category = "pendukung";
        let name = "File";
        let url = "#";

        // Logic parsing nama file
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

            // Tentukan Ikon berdasarkan ekstensi (simple logic)
            let iconCode = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`; // Default File Icon

            if (url.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/)) {
                iconCode = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
            }

            let deleteBtnHtml = "";
            if (!isHeadOffice) {
                const safeCategory = category.replace(/'/g, "\\'");
                const safeName = name.replace(/'/g, "\\'");
                const safeUrl = url.trim().replace(/'/g, "\\'");

                // Menggunakan icon trash SVG untuk tombol hapus
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
    // Validasi URL tidak kosong atau invalid
    if (!fileUrl || fileUrl === "#" || fileUrl.trim() === "") {
        alert("URL file tidak valid, tidak dapat dihapus.");
        return;
    }

    if (confirm(`Hapus file "${fileName}"?\nFile akan hilang permanen setelah Anda klik tombol Simpan.`)) {
        // Simpan object untuk dikirim ke backend dengan flag deleted: true
        const deleteItem = {
            category: category.trim(),
            filename: fileName.trim(),
            url: fileUrl.trim()
        };

        // Cegah duplikasi
        const isDuplicate = deletedFilesList.some(item =>
            item.url === deleteItem.url && item.filename === deleteItem.filename
        );

        if (!isDuplicate) {
            deletedFilesList.push(deleteItem);
        }

        const parent = btnElement.closest(".existing-file-item");
        if (parent) parent.style.display = "none";

        console.log("List Delete:", deletedFilesList);
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

        console.log("Fetching from URL:", url);

        const res = await fetch(url);
        if (!res.ok) throw new Error("Gagal mengambil data dari server");

        const rawData = await res.json();
        console.log("Data received:", rawData);

        // DEBUG: Cek apakah file_links ada di response
        if (Array.isArray(rawData) && rawData.length > 0) {
            console.log("Sample file_links from first doc:", rawData[0]?.file_links);
        }

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

    filteredDocuments = allDocuments.filter(doc => {
        const kode = (doc.kode_toko || "").toString().toLowerCase();
        const nama = (doc.nama_toko || "").toString().toLowerCase();
        const cabang = (doc.cabang || "").toString();

        const matchText = kode.includes(term) || nama.includes(term);
        const matchCabang = filterCabang === "" || cabang === filterCabang;
        return matchText && matchCabang;
    });

    filteredDocuments.reverse();
    currentPage = 1;
    renderTable();
}

// Fungsi Helper: Cek Kelengkapan Dokumen
function checkDocumentCompleteness(fileLinksString) {
    const mandatoryCategories = [
        "fotoAsal", 
        "fotoRenovasi", 
        "me", 
        "sipil", 
        "sketsaAwal", 
        "spk", 
        "rab"
    ];

    if (!fileLinksString) {
        return { complete: false, missingCount: mandatoryCategories.length, missingList: mandatoryCategories };
    }

    const uploadedLower = fileLinksString.toLowerCase();

    const missing = mandatoryCategories.filter(catKey => {
        return !uploadedLower.includes(catKey.toLowerCase());
    });

    return {
        complete: missing.length === 0,
        missingCount: missing.length,
        missingList: missing
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
            statusBadgeHtml = `
                <div class="doc-status-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    <span>Belum Lengkap (${docStatus.missingCount})</span>
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

    // Jika tidak ada data atau cuma 1 halaman, sembunyikan pagination tapi tetap rapi
    if (totalPages <= 1) {
        container.style.display = "none";
        return;
    }

    container.style.display = "flex";

    // Update Info Halaman
    const pageInfo = document.getElementById("page-info");
    if (pageInfo) pageInfo.textContent = `Halaman ${currentPage} dari ${totalPages}`;

    // Update State Tombol Prev
    const btnPrev = document.getElementById("btn-prev");
    if (btnPrev) {
        btnPrev.disabled = currentPage === 1;
        btnPrev.onclick = () => changePage(currentPage - 1);
    }

    // Update State Tombol Next
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
    // Kita gunakan String() untuk memastikan perbandingan aman (misal "123" vs 123)
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
            headers: {
                "Content-Type": "application/json"
            }
        });

        const result = await res.json();

        if (!res.ok) {
            throw new Error(result.message || result.detail || "Gagal menghapus data.");
        }

        showToast("Data berhasil dihapus");

        await fetchDocuments();

    } catch (err) {
        console.error("Delete Error:", err);
        // Tampilkan modal error yang sudah ada di script.js
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
// 5. SUBMIT HANDLER (PERBAIKAN UTAMA: TYPE SAFE)
// ==========================================
async function handleFormSubmit(e) {
    e.preventDefault();
    showLoading(true);
    document.getElementById("error-msg").textContent = "";

    try {
        // === PAYLOAD SETUP ===
        const payload = {
            kode_toko: document.getElementById("kodeToko").value,
            nama_toko: document.getElementById("namaToko").value,
            luas_sales: document.getElementById("luasSales").value,
            luas_parkir: document.getElementById("luasParkir").value,
            luas_gudang: document.getElementById("luasGudang").value,
            cabang: currentUser.cabang || "",
            email: currentUser.email || "",
            pic_name: currentUser.email || "",
            email: currentUser.email || "",
            files: [] // Array untuk file baru dan file yang dihapus
        };

        console.log("=== DEBUG SUBMIT ===");
        console.log("Is Editing:", isEditing);
        console.log("Deleted Files List:", deletedFilesList);

        // === TAMBAHKAN FILE YANG DIHAPUS (dengan flag deleted: true) ===
        deletedFilesList.forEach(item => {
            payload.files.push({
                category: item.category,
                filename: item.filename,
                deleted: true
            });
        });

        // === KONVERSI FILE BARU KE BASE64 ===
        const fileToBase64 = (file) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });
        };

        const filePromises = [];

        UPLOAD_CATEGORIES.forEach(cat => {
            const filesInBuffer = newFilesBuffer[cat.key] || [];
            filesInBuffer.forEach(file => {
                const promise = fileToBase64(file).then(base64String => {
                    payload.files.push({
                        category: cat.key,
                        filename: file.name,
                        type: file.type,
                        data: base64String
                    });
                });
                filePromises.push(promise);
            });
        });

        await Promise.all(filePromises);

        console.log("Payload files count:", payload.files.length);
        console.log("Payload files:", payload.files.map(f => ({
            category: f.category,
            filename: f.filename,
            deleted: f.deleted || false,
            hasData: !!f.data
        })));

        // === KIRIM KE SERVER ===
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
        console.log("Server response:", result);

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
    if (id === "modal-success") {
        showTable();
    }
}

function showLoading(show) {
    const el = document.getElementById("loading-overlay");
    if (el) el.style.display = show ? "flex" : "none";
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