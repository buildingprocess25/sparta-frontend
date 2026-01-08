// ==========================================
// 1. CONFIG & AUTHENTICATION
// ==========================================
const BASE_URL = "https://sparta-backend-5hdj.onrender.com"; // Sesuaikan jika backend berubah
let currentUser = null;
let allDocuments = []; // Menyimpan data lokal untuk pagination/filter
let isEditing = false;
let currentEditId = null;

// Categories untuk Upload
const UPLOAD_CATEGORIES = [
    { key: "fotoAsal", label: "Foto Toko Asal" },
    { key: "fotoRenovasi", label: "Foto Proses Renovasi" },
    { key: "me", label: "Gambar ME" },
    { key: "sipil", label: "Gambar Sipil" },
    { key: "sketsaAwal", label: "Sketsa Awal (Layout)" },
    { key: "pendukung", label: "Dokumen Pendukung Lainnya" },
];

// Cek Session saat halaman dimuat
document.addEventListener("DOMContentLoaded", () => {
    checkAuth();
    initApp();
    setupAutoLogout();
});

function checkAuth() {
    const isAuthenticated = sessionStorage.getItem("authenticated");
    if (isAuthenticated !== "true") {
        // Redirect ke login jika tidak ada sesi
        window.location.href = "../login.html"; // Asumsi login.html ada di folder parent
        return;
    }

    // Ambil data user dari sessionStorage (diset oleh login_script.js)
    currentUser = {
        email: sessionStorage.getItem("loggedInUserEmail"),
        cabang: sessionStorage.getItem("loggedInUserCabang"), // Password field sering dipakai sbg Cabang di sistem lama
        role: sessionStorage.getItem("userRole")
    };

    // Update Header
    document.getElementById("user-name").textContent = currentUser.email || "User";
    document.getElementById("user-branch").textContent = currentUser.cabang || "Cabang";

    // Show/Hide kolom cabang di tabel
    if (currentUser.cabang?.toLowerCase() === "head office") {
        document.querySelector(".col-cabang").style.display = "table-cell";
        document.getElementById("filter-cabang").style.display = "block";
    }
}

// ==========================================
// 2. INITIALIZATION & NAVIGATION
// ==========================================
function initApp() {
    // Navigasi
    document.getElementById("btn-add-new").addEventListener("click", () => showForm());
    document.getElementById("btn-back").addEventListener("click", () => showTable());
    document.getElementById("btn-logout").addEventListener("click", () => showModal("modal-logout"));
    
    // Modal Logout
    document.getElementById("cancel-logout").addEventListener("click", () => hideModal("modal-logout"));
    document.getElementById("confirm-logout").addEventListener("click", handleLogout);

    // Form Handling
    document.getElementById("store-form").addEventListener("submit", handleFormSubmit);
    
    // Input Formatting (Angka -> 100,00)
    document.querySelectorAll(".input-decimal").forEach(input => {
        input.addEventListener("input", (e) => {
            e.target.value = formatDecimalInput(e.target.value);
        });
    });

    // Filter & Search
    document.getElementById("search-input").addEventListener("input", handleSearch);
    document.getElementById("filter-cabang").addEventListener("change", handleSearch);

    // Initial Load
    renderUploadSections();
    fetchDocuments();
}

function showTable() {
    document.getElementById("view-table").style.display = "block";
    document.getElementById("view-form").style.display = "none";
    document.getElementById("store-form").reset();
    resetPreviews();
}

function showForm(data = null) {
    document.getElementById("view-table").style.display = "none";
    document.getElementById("view-form").style.display = "block";
    
    const title = document.getElementById("form-title");
    const form = document.getElementById("store-form");
    resetPreviews();

    if (data) {
        // Mode EDIT
        isEditing = true;
        currentEditId = data._id; // Sesuaikan dengan key ID dari database (misal: _id atau id)
        title.textContent = `Edit Data Toko: ${data.nama_toko}`;
        
        document.getElementById("kodeToko").value = data.kode_toko || "";
        document.getElementById("namaToko").value = data.nama_toko || "";
        document.getElementById("luasSales").value = formatDecimalInput(data.luas_sales);
        document.getElementById("luasParkir").value = formatDecimalInput(data.luas_parkir);
        document.getElementById("luasGudang").value = formatDecimalInput(data.luas_gudang);

        // Load Files (Existing)
        UPLOAD_CATEGORIES.forEach(cat => {
            if (data[cat.key]) {
                // Asumsi data[cat.key] adalah array URL atau object file
                // Kita perlu render preview
                const files = Array.isArray(data[cat.key]) ? data[cat.key] : [data[cat.key]];
                files.forEach(f => {
                    if(f) addFilePreview(cat.key, f, true); // true = existing file
                });
            }
        });

    } else {
        // Mode CREATE
        isEditing = false;
        currentEditId = null;
        title.textContent = "Tambah Data Toko";
        form.reset();
    }
}

// ==========================================
// 3. DATA FETCHING (MOCK API)
// ==========================================
async function fetchDocuments() {
    showLoading(true);
    try {
        // Ganti URL ini dengan endpoint GET yang benar
        const response = await fetch(`${BASE_URL}/api/stores`); 
        
        if (!response.ok) throw new Error("Gagal mengambil data");
        
        const data = await response.json();
        // Asumsi data dibungkus dalam array atau properti 'data'
        allDocuments = Array.isArray(data) ? data : (data.data || []);
        
        renderTableData(allDocuments);
        
    } catch (error) {
        console.error("Fetch error:", error);
        // showToast("Gagal memuat data: " + error.message, "error");
        
        // --- MOCK DATA JIKA API BELUM SIAP (Agar UI tampil) ---
        // Hapus blok ini jika Backend sudah ready
        allDocuments = []; 
        renderTableData(allDocuments);
        // -----------------------------------------------------

    } finally {
        showLoading(false);
    }
}

// ==========================================
// 4. TABLE LOGIC
// ==========================================
let currentPage = 1;
const rowsPerPage = 5;

function renderTableData(docs) {
    // 1. Filter
    const searchTerm = document.getElementById("search-input").value.toLowerCase();
    const filterCabang = document.getElementById("filter-cabang").value.toLowerCase();
    const isHO = currentUser.cabang?.toLowerCase() === "head office";

    let filtered = docs.filter(d => {
        const kode = (d.kode_toko || "").toLowerCase();
        const nama = (d.nama_toko || "").toLowerCase();
        return kode.includes(searchTerm) || nama.includes(searchTerm);
    });

    if (isHO && filterCabang) {
        filtered = filtered.filter(d => d.cabang?.toLowerCase().includes(filterCabang));
    } else if (!isHO) {
        // Filter user cabang biasa (hanya lihat cabangnya sendiri)
        filtered = filtered.filter(d => d.cabang?.toLowerCase().includes(currentUser.cabang.toLowerCase()));
    }

    // 2. Pagination
    const totalPages = Math.ceil(filtered.length / rowsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * rowsPerPage;
    const pagedData = filtered.slice(start, start + rowsPerPage);

    // 3. Render HTML
    const tbody = document.getElementById("table-body");
    tbody.innerHTML = "";

    if (pagedData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Tidak ada data</td></tr>`;
    } else {
        pagedData.forEach((item, index) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${start + index + 1}</td>
                <td>${item.kode_toko || "-"}</td>
                <td>${item.nama_toko || "-"}</td>
                <td style="${isHO ? '' : 'display:none;'}">${item.cabang || "-"}</td>
                <td>
                    <button class="btn-edit" onclick='editDocument(${JSON.stringify(item)})'>Edit</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 4. Update Pagination Controls
    document.getElementById("page-info").textContent = `Halaman ${currentPage} dari ${totalPages}`;
    document.getElementById("btn-prev").disabled = currentPage === 1;
    document.getElementById("btn-next").disabled = currentPage === totalPages;

    // Event Listener Pagination
    document.getElementById("btn-prev").onclick = () => { currentPage--; renderTableData(allDocuments); };
    document.getElementById("btn-next").onclick = () => { currentPage++; renderTableData(allDocuments); };
}

function handleSearch() {
    currentPage = 1;
    renderTableData(allDocuments);
}

// Global function untuk tombol Edit (karena di dalam innerHTML)
window.editDocument = (item) => {
    // Convert object kembali jika ada issue stringify (biasanya aman)
    showForm(item);
};

// ==========================================
// 5. FORM HANDLING & UPLOAD
// ==========================================
function renderUploadSections() {
    const container = document.getElementById("upload-container");
    container.innerHTML = "";

    UPLOAD_CATEGORIES.forEach(cat => {
        const div = document.createElement("div");
        div.className = "upload-group";
        div.innerHTML = `
            <label class="upload-label">${cat.label}</label>
            <input type="file" id="file-${cat.key}" multiple accept="image/*,.pdf" onchange="handleFileSelect('${cat.key}', this)">
            <div class="preview-list" id="preview-${cat.key}"></div>
        `;
        container.appendChild(div);
    });
}

// Simpan file sementara (File Object atau URL String)
let fileStore = {}; 

function handleFileSelect(category, input) {
    const files = Array.from(input.files);
    if (!fileStore[category]) fileStore[category] = [];
    
    files.forEach(file => {
        // Tambah ke store
        fileStore[category].push({ type: 'new', file: file });
        // Render preview
        addFilePreview(category, file.name, false, fileStore[category].length - 1);
    });
    
    // Reset input agar bisa pilih file yang sama lagi kalau dihapus
    input.value = ""; 
}

function addFilePreview(category, fileNameOrUrl, isExisting, index = null) {
    const container = document.getElementById(`preview-${category}`);
    const div = document.createElement("div");
    div.className = "preview-item";
    
    // Tentukan nama file
    let displayName = typeof fileNameOrUrl === 'string' ? fileNameOrUrl : fileNameOrUrl.name;
    // Bersihkan nama jika URL
    if (typeof fileNameOrUrl === 'string' && fileNameOrUrl.includes('/')) {
        displayName = decodeURIComponent(fileNameOrUrl.split('/').pop().split('?')[0]);
    }

    // Buat Link (jika existing) atau Teks (jika baru)
    const content = isExisting 
        ? `<a href="${typeof fileNameOrUrl === 'string' ? fileNameOrUrl : '#'}" target="_blank">${displayName}</a>`
        : `<span>${displayName}</span>`;

    div.innerHTML = `
        ${content}
        <button type="button" class="btn-delete-file" onclick="removeFile('${category}', this, ${isExisting})">×</button>
    `;
    container.appendChild(div);
}

window.removeFile = (category, btn, isExisting) => {
    // Visual remove
    btn.parentElement.remove();
    // Logic remove dari fileStore (untuk 'new' file) perlu handling lebih kompleks based on index
    // Untuk kesederhanaan versi vanilla ini, kita anggap user menghapus visual = tidak jadi upload
    // Di real app, kita perlu sinkron array index.
};

function resetPreviews() {
    fileStore = {};
    document.querySelectorAll(".preview-list").forEach(el => el.innerHTML = "");
}

async function handleFormSubmit(e) {
    e.preventDefault();
    showLoading(true);

    const formData = new FormData();
    formData.append("kodeToko", document.getElementById("kodeToko").value);
    formData.append("namaToko", document.getElementById("namaToko").value);
    formData.append("luasSales", document.getElementById("luasSales").value);
    formData.append("luasParkir", document.getElementById("luasParkir").value);
    formData.append("luasGudang", document.getElementById("luasGudang").value);
    formData.append("cabang", currentUser.cabang); // Auto isi cabang dari user login

    // Append Files
    Object.keys(fileStore).forEach(key => {
        fileStore[key].forEach(item => {
            if (item.type === 'new') {
                formData.append(key, item.file);
            }
        });
    });

    try {
        const method = isEditing ? "PUT" : "POST";
        const url = isEditing 
            ? `${BASE_URL}/api/stores/${currentEditId}`
            : `${BASE_URL}/api/stores`;

        const response = await fetch(url, {
            method: method,
            body: formData 
            // Jangan set Content-Type header saat kirim FormData, browser otomatis set boundary
        });

        if (!response.ok) throw new Error("Gagal menyimpan data");

        showToast("Data berhasil disimpan!", "success");
        fetchDocuments(); // Refresh data
        showTable();

    } catch (error) {
        console.error("Submit Error:", error);
        showToast("Terjadi kesalahan: " + error.message, "error");
    } finally {
        showLoading(false);
    }
}

// ==========================================
// 6. UTILS & HELPERS
// ==========================================

// Format: 10000 -> 100,00
function formatDecimalInput(value) {
    if (!value) return "";
    let str = value.toString().replace(/\D/g, ""); // Hapus non-digit
    if (str === "") return "";
    
    if (str.length <= 2) return "0," + str.padStart(2, "0");
    
    const before = str.slice(0, -2);
    const after = str.slice(-2);
    // Tambahkan titik ribuan jika perlu (opsional, sesuaikan regex ini)
    return `${parseInt(before, 10)},${after}`;
}

function handleLogout() {
    sessionStorage.clear();
    window.location.href = "../login.html"; // Redirect ke login page user
}

// Auto Logout (Idle Timer)
let idleTime = 0;
function setupAutoLogout() {
    // Increment idle time setiap menit
    setInterval(() => {
        idleTime++;
        if (idleTime >= 30) { // 30 Menit idle
            handleLogout();
        }
    }, 60000); // 1 menit

    // Reset idle timer pada aktivitas
    ['mousemove', 'keypress', 'click', 'scroll'].forEach(evt => {
        document.addEventListener(evt, () => {
            idleTime = 0;
        });
    });
}

// UI Helpers
function showLoading(show) {
    document.getElementById("loading-overlay").style.display = show ? "flex" : "none";
}

function showModal(id) {
    document.getElementById(id).style.display = "flex";
}

function hideModal(id) {
    document.getElementById(id).style.display = "none";
}

function showToast(message, type = "success") {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.className = "toast";
    }, 3000);
}