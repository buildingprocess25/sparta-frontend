// ==========================================
// 1. CONFIG & AUTHENTICATION
// ==========================================
const BASE_URL = "https://sparta-backend-5hdj.onrender.com";
let currentUser = null;
let allDocuments = [];
let filteredDocuments = [];
let isEditing = false;
let currentEditId = null;

// === STATE MANAGEMENT UNTUK FILE ===
// Kita tidak bisa menghapus file dari input[type='file'] secara langsung.
// Jadi kita gunakan variabel buffer ini untuk menampung file sementara.
let newFilesBuffer = {}; // Format: { "fotoAsal": [FileObject1, FileObject2], ... }
let deletedFilesList = []; // Format: ["url_file_1", "nama_file_2"] (Untuk file lama yg dihapus)

const UPLOAD_CATEGORIES = [
    { key: "fotoAsal", label: "Foto Toko Existing" },
    { key: "fotoRenovasi", label: "Foto Proses Renovasi" },
    { key: "me", label: "Gambar ME" },
    { key: "sipil", label: "Gambar Sipil" },
    { key: "sketsaAwal", label: "Sketsa Awal (Layout)" },
    { key: "pendukung", label: "Dokumen Pendukung (NIOI, SLO, dll)" },
];

document.addEventListener("DOMContentLoaded", () => {
    checkAuth();
    initApp();
    setupAutoLogout();
});

function checkAuth() {
    const isAuthenticated = sessionStorage.getItem("authenticated");
    if (isAuthenticated !== "true") {
        window.location.href = "sparta-alfamart.vercel.app";
        return;
    }

    currentUser = {
        email: sessionStorage.getItem("loggedInUserEmail"),
        cabang: sessionStorage.getItem("loggedInUserCabang"),
        role: sessionStorage.getItem("userRole")
    };

    if (document.getElementById("user-name"))
        document.getElementById("user-name").textContent = currentUser.email || "User";
    if (document.getElementById("user-branch"))
        document.getElementById("user-branch").textContent = currentUser.cabang || "Cabang";

    const btnAddNew = document.getElementById("btn-add-new");
    const filterCabang = document.getElementById("filter-cabang");

    if (currentUser.cabang?.toLowerCase() === "head office") {
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
    document.getElementById("cancel-logout").addEventListener("click", () => hideModal("modal-logout"));
    document.getElementById("confirm-logout").addEventListener("click", handleLogout);
    document.getElementById("btn-close-error").addEventListener("click", () => hideModal("modal-error"));
    document.getElementById("btn-close-success").addEventListener("click", () => hideModal("modal-success"));

    // Form Handling
    document.getElementById("store-form").addEventListener("submit", handleFormSubmit);

    // Live Formatting
    document.querySelectorAll(".input-decimal").forEach(input => {
        input.addEventListener("input", (e) => {
            e.target.value = formatDecimalInput(e.target.value);
        });
    });

    // Search
    document.getElementById("search-input").addEventListener("input", (e) => handleSearch(e.target.value));
    document.getElementById("filter-cabang").addEventListener("change", () => handleSearch(document.getElementById("search-input").value));

    // Render UI Upload Awal (Kosong)
    renderUploadSections();
    fetchDocuments();
}

function resetFormState() {
    // 1. Reset Buffer File Baru
    newFilesBuffer = {};
    UPLOAD_CATEGORIES.forEach(cat => {
        newFilesBuffer[cat.key] = [];
    });

    // 2. Reset List File Hapus
    deletedFilesList = [];

    // 3. Reset UI Preview & Input
    document.querySelectorAll(".file-preview").forEach(el => el.innerHTML = "");
    document.querySelectorAll(".existing-files-list").forEach(el => el.innerHTML = "");
    document.querySelectorAll("input[type='file']").forEach(el => el.value = "");
    
    // 4. Reset Text Inputs
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
    
    resetFormState(); // PENTING: Reset semua buffer sebelum mulai

    const title = document.getElementById("form-title");
    const inputs = document.querySelectorAll("#store-form input");
    const btnSave = document.getElementById("btn-save");
    const isHeadOffice = currentUser.cabang?.toLowerCase() === "head office";

    // Default: Enable All
    inputs.forEach(input => input.disabled = false);
    btnSave.style.display = "inline-block";
    
    // Re-render upload section untuk memastikan event listener fresh
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

        if (data.file_links) {
            renderExistingFiles(data.file_links);
        }

        if (isHeadOffice) {
            title.textContent = `Detail Data Toko: ${data.nama_toko}`;
            inputs.forEach(input => input.disabled = true);
            btnSave.style.display = "none";
        } else {
            title.textContent = `Edit Data Toko: ${data.nama_toko}`;
            document.getElementById("kodeToko").disabled = true; // Kode toko biasanya primary key, sebaiknya disable
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
    container.innerHTML = "";

    const groups = [
        { title: "Foto (JPG, JPEG, PNG)", keys: ["fotoAsal", "fotoRenovasi"] },
        { title: "Gambar (PDF, Gambar)", keys: ["me", "sipil", "sketsaAwal"] },
        { title: "Dokumen (PDF, Gambar)", keys: ["pendukung"] }
    ];

    groups.forEach(group => {
        const groupWrapper = document.createElement("div");
        groupWrapper.className = "upload-section-group";
        groupWrapper.innerHTML = `<h4 class="upload-section-title">唐 ${group.title}</h4>`;
        
        const gridDiv = document.createElement("div");
        gridDiv.className = "upload-grid";

        group.keys.forEach(key => {
            const cat = UPLOAD_CATEGORIES.find(c => c.key === key);
            if (!cat) return;

            // Pastikan buffer terinisialisasi
            if (!newFilesBuffer[key]) newFilesBuffer[key] = [];

            const section = document.createElement("div");
            section.className = "upload-group";
            
            // Logic display input file: Kalau ReadOnly (HO), sembunyikan input
            const displayInput = isReadOnly ? "none" : "block";

            section.innerHTML = `
                <label class="upload-label">${cat.label}</label>
                <div id="existing-${cat.key}" class="existing-files-list"></div>
                
                <input type="file" id="file-${cat.key}" multiple accept="image/*,.pdf" 
                       style="margin-top: auto; display: ${displayInput};">
                
                <div class="file-preview" id="preview-${cat.key}"></div>
            `;
            gridDiv.appendChild(section);
        });
        groupWrapper.appendChild(gridDiv);
        container.appendChild(groupWrapper);
    });

    // Attach Event Listeners (Hanya jika tidak readonly)
    if (!isReadOnly) {
        UPLOAD_CATEGORIES.forEach(cat => {
            const input = document.getElementById(`file-${cat.key}`);
            if (input) {
                input.addEventListener("change", (e) => {
                    const files = Array.from(e.target.files);
                    if (files.length === 0) return;

                    files.forEach(f => {
                        // Prevent Duplicate by Name (Optional)
                        const isDuplicate = newFilesBuffer[cat.key].some(existing => existing.name === f.name);
                        if (!isDuplicate) {
                            newFilesBuffer[cat.key].push(f);
                        }
                    });

                    updatePreviewUI(cat.key);
                    input.value = ""; // Reset input agar user bisa pilih file lagi
                });
            }
        });
    }
}

// Fungsi Render Preview dari Buffer (Dengan tombol Hapus)
function updatePreviewUI(categoryKey) {
    const previewDiv = document.getElementById(`preview-${categoryKey}`);
    previewDiv.innerHTML = ""; // Clear UI

    const files = newFilesBuffer[categoryKey];

    files.forEach((file, index) => {
        const wrapper = document.createElement("div");
        wrapper.className = "preview-wrapper";

        // Tombol Hapus (Silang Merah)
        const btnRemove = document.createElement("button");
        btnRemove.className = "btn-remove-preview";
        btnRemove.innerHTML = "&times;";
        btnRemove.type = "button";
        btnRemove.title = "Hapus file ini";
        btnRemove.onclick = () => {
            // Hapus dari Buffer
            newFilesBuffer[categoryKey].splice(index, 1);
            // Re-render UI
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
            let icon = "塘";
            if (file.type.includes('pdf')) icon = "燈";
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

        // Cari container yang pas
        const container = document.getElementById(`existing-${category}`) || document.getElementById("existing-pendukung");

        if (container) {
            const fileItem = document.createElement("div");
            fileItem.className = "existing-file-item";
            
            let deleteBtnHtml = "";
            if (!isHeadOffice) {
                // Tombol Hapus Existing File (Trigger logic hapus)
                deleteBtnHtml = `<button type="button" class="btn-delete-existing" onclick="markFileForDeletion(this, '${url}', '${name}')">🗑 Hapus</button>`;
            }

            fileItem.innerHTML = `
                <a href="${url}" target="_blank" class="file-link">迫 ${name}</a>
                ${deleteBtnHtml}
            `;
            container.appendChild(fileItem);
        }
    });
}

// Global function untuk dipanggil dari HTML string
window.markFileForDeletion = function(btnElement, fileUrl, fileName) {
    if (confirm(`Hapus file "${fileName}"?\nFile akan hilang permanen setelah Anda klik tombol Simpan.`)) {
        // 1. Masukkan ke list hapus
        deletedFilesList.push(fileUrl);
        // 2. Hilangkan dari tampilan UI
        const parent = btnElement.closest(".existing-file-item");
        if (parent) parent.style.display = "none";
        
        console.log("File marked for deletion:", deletedFilesList);
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
        if (!res.ok) throw new Error("Gagal mengambil data");
        const rawData = await res.json();

        if (Array.isArray(rawData)) allDocuments = rawData;
        else if (rawData.data && Array.isArray(rawData.data)) allDocuments = rawData.data;
        else allDocuments = [];

        updateCabangFilterOptions();
        handleSearch(document.getElementById("search-input").value);
    } catch (err) {
        console.error(err);
        showToast("Gagal memuat data");
        allDocuments = [];
        renderTable();
    } finally {
        showLoading(false);
    }
}

function handleSearch(keyword) {
    const term = keyword.toLowerCase();
    const filterCabang = document.getElementById("filter-cabang").value;

    filteredDocuments = allDocuments.filter(doc => {
        const kode = (doc.kode_toko || "").toLowerCase();
        const nama = (doc.nama_toko || "").toLowerCase();
        const cabang = doc.cabang || "";
        const matchText = kode.includes(term) || nama.includes(term);
        const matchCabang = filterCabang === "" || cabang === filterCabang;
        return matchText && matchCabang;
    });

    renderTable();
}

function renderTable() {
    const tbody = document.getElementById("table-body");
    tbody.innerHTML = "";

    if (filteredDocuments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">Tidak ada data</td></tr>`;
        return;
    }

    const isHeadOffice = currentUser.cabang?.toLowerCase() === "head office";
    const actionLabel = isHeadOffice ? "Lihat" : "Edit";
    const actionClass = isHeadOffice ? "btn-view" : "btn-edit";

    filteredDocuments.forEach((doc, index) => {
        const row = document.createElement("tr");
        const linkHtml = (doc.folder_link || doc.folder_drive) 
            ? `<a href="${doc.folder_link || doc.folder_drive}" target="_blank" style="text-decoration: none; color: #007bff;">Buka Folder</a>` 
            : `-`;

        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${doc.kode_toko || "-"}</td>
            <td>${doc.nama_toko || "-"}</td>
            <td>${doc.cabang || "-"}</td>
            <td>${linkHtml}</td>
            <td>
                <button class="btn-action ${actionClass}" onclick="handleEditClick(${index})">${actionLabel}</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

window.handleEditClick = function(index) {
    showForm(filteredDocuments[index]);
};

function updateCabangFilterOptions() {
    const select = document.getElementById("filter-cabang");
    const currentValue = select.value;
    const cabangSet = new Set();
    allDocuments.forEach(doc => { if (doc.cabang) cabangSet.add(doc.cabang); });

    select.innerHTML = '<option value="">Semua Cabang</option>';
    Array.from(cabangSet).sort().forEach(cabang => {
        const option = document.createElement("option");
        option.value = cabang;
        option.textContent = cabang;
        select.appendChild(option);
    });

    if (currentValue && cabangSet.has(currentValue)) select.value = currentValue;
}

// ==========================================
// 5. SUBMIT HANDLER
// ==========================================
async function handleFormSubmit(e) {
    e.preventDefault();
    showLoading(true);
    document.getElementById("error-msg").textContent = "";

    try {
        const payload = {
            kode_toko: document.getElementById("kodeToko").value,
            nama_toko: document.getElementById("namaToko").value,
            luas_sales: document.getElementById("luasSales").value,
            luas_parkir: document.getElementById("luasParkir").value,
            luas_gudang: document.getElementById("luasGudang").value,
            cabang: currentUser.cabang || "",
            pic_name: currentUser.email || "",
            files: [],
            deleted_files: deletedFilesList // Kirim daftar file yg dihapus
        };

        const fileToBase64 = (file) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });
        };

        const filePromises = [];

        // LOOPING DARI BUFFER, BUKAN DARI INPUT ELEMENT
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
        showTable();

    } catch (err) {
        console.error(err);
        document.getElementById("error-msg").textContent = err.message;
        showModal("modal-error");
    } finally {
        showLoading(false);
    }
}

// ==========================================
// 6. UTILS
// ==========================================
function formatDecimalInput(value) {
    if (!value) return "";
    let str = value.toString().replace(/[^0-9]/g, "");
    if (str.length <= 2) return "0," + str.padStart(2, "0");
    const before = str.slice(0, -2);
    const after = str.slice(-2);
    return `${parseInt(before, 10)},${after}`;
}

function showModal(id) { document.getElementById(id).style.display = "flex"; }
function hideModal(id) { document.getElementById(id).style.display = "none"; }
function showLoading(show) { document.getElementById("loading-overlay").style.display = show ? "flex" : "none"; }
function showToast(msg) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.className = "toast show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}

function handleLogout() {
    sessionStorage.clear();
    window.location.href = "sparta-alfamart.vercel.app";
}

let idleTime = 0;
function setupAutoLogout() {
    setInterval(() => {
        idleTime++;
        if (idleTime >= 30) handleLogout();
    }, 60000);
    ['mousemove', 'keypress', 'click', 'scroll'].forEach(evt => document.addEventListener(evt, () => idleTime = 0));
}