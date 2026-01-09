// ==========================================
// 1. CONFIG & AUTHENTICATION
// ==========================================
const BASE_URL = "https://sparta-backend-5hdj.onrender.com"; 
let currentUser = null;
let allDocuments = []; 
let filteredDocuments = [];
let isEditing = false;
let currentEditId = null;

// Pagination State
let currentPage = 1;
const rowsPerPage = 5;

const UPLOAD_CATEGORIES = [
    { key: "fotoAsal", label: "Foto Toko Asal" },
    { key: "fotoRenovasi", label: "Foto Proses Renovasi" },
    { key: "me", label: "Gambar ME" },
    { key: "sipil", label: "Gambar Sipil" },
    { key: "sketsaAwal", label: "Sketsa Awal (Layout)" },
    { key: "pendukung", label: "Dokumen Pendukung Lainnya" },
];

document.addEventListener("DOMContentLoaded", () => {
    checkAuth();
    initApp();
    setupAutoLogout();
});

function checkAuth() {
    const isAuthenticated = sessionStorage.getItem("authenticated");
    if (isAuthenticated !== "true") {
        window.location.href = "../login.html"; 
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

    if (currentUser.cabang?.toLowerCase() === "head office") {
        const colCabang = document.querySelector(".col-cabang");
        if(colCabang) colCabang.style.display = "table-cell";
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
    
    // Modal Actions
    document.getElementById("cancel-logout").addEventListener("click", () => hideModal("modal-logout"));
    document.getElementById("confirm-logout").addEventListener("click", handleLogout);
    document.getElementById("btn-close-error").addEventListener("click", () => hideModal("modal-error"));
    document.getElementById("btn-close-success").addEventListener("click", () => hideModal("modal-success"));

    // Form Handling
    document.getElementById("store-form").addEventListener("submit", handleFormSubmit);
    
    // Format Input Angka (Live formatting)
    document.querySelectorAll(".input-decimal").forEach(input => {
        input.addEventListener("input", (e) => {
            e.target.value = formatDecimalInput(e.target.value);
        });
    });

    // Search & Filter
    document.getElementById("search-input").addEventListener("input", (e) => {
        handleSearch(e.target.value);
    });
    document.getElementById("filter-cabang").addEventListener("change", (e) => {
        handleSearch(document.getElementById("search-input").value);
    });

    // Initial Load
    renderUploadSections();
    fetchDocuments();
}

// ==========================================
// 3. UI HELPERS (SHOW/HIDE)
// ==========================================
function showTable() {
    document.getElementById("view-table").style.display = "block";
    document.getElementById("view-form").style.display = "none";
    document.getElementById("store-form").reset();
    document.getElementById("error-msg").textContent = "";
    resetPreviews(); // Bersihkan file preview
    fetchDocuments(); // Refresh data
}

function showForm(data = null) {
    document.getElementById("view-table").style.display = "none";
    document.getElementById("view-form").style.display = "block";
    const title = document.getElementById("form-title");
    const form = document.getElementById("store-form");
    
    // Reset form & error
    form.reset();
    document.getElementById("error-msg").textContent = "";
    resetPreviews();

    if (data) {
        // === MODE EDIT ===
        isEditing = true;
        currentEditId = data._id; // Pastikan backend kirim _id
        title.textContent = `Edit Data Toko: ${data.nama_toko}`;
        
        // Isi Text Inputs
        document.getElementById("kodeToko").value = data.kode_toko || "";
        document.getElementById("namaToko").value = data.nama_toko || "";
        document.getElementById("luasSales").value = formatDecimalInput(data.luas_sales);
        document.getElementById("luasParkir").value = formatDecimalInput(data.luas_parkir);
        document.getElementById("luasGudang").value = formatDecimalInput(data.luas_gudang);

        // Render File Lama
        if (data.file_links) {
            renderExistingFiles(data.file_links);
        }
    } else {
        // === MODE TAMBAH BARU ===
        isEditing = false;
        currentEditId = null;
        title.textContent = "Tambah Data Toko Baru";
    }
}

function showModal(id) {
    document.getElementById(id).style.display = "flex";
}

function hideModal(id) {
    document.getElementById(id).style.display = "none";
}

function showLoading(show) {
    const loader = document.getElementById("loading-overlay");
    if(loader) loader.style.display = show ? "flex" : "none";
}

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = "toast show";
    setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
}

// ==========================================
// 4. DATA FETCHING & TABLE LOGIC
// ==========================================
async function fetchDocuments() {
    showLoading(true);
    try {
        let url = `${BASE_URL}/api/doc/list`;
        // Jika user bukan HO, backend mungkin butuh query param cabang, atau filter otomatis dari token/session
        if (currentUser.cabang && currentUser.cabang.toLowerCase() !== "head office") {
            url += `?cabang=${encodeURIComponent(currentUser.cabang)}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error("Gagal mengambil data");
        
        const data = await res.json();
        allDocuments = Array.isArray(data) ? data : []; // Pastikan array
        
        // Jalankan search awal (tanpa query) untuk populate tabel
        handleSearch(""); 
    } catch (err) {
        console.error(err);
        showToast("Error loading data: " + err.message);
    } finally {
        showLoading(false);
    }
}

function handleSearch(keyword) {
    const term = keyword.toLowerCase();
    const filterCabang = document.getElementById("filter-cabang").value.toLowerCase();
    const isHO = currentUser.cabang?.toLowerCase() === "head office";

    filteredDocuments = allDocuments.filter(doc => {
        const kode = (doc.kode_toko || "").toLowerCase();
        const nama = (doc.nama_toko || "").toLowerCase();
        const cabangDoc = (doc.cabang || "").toLowerCase();

        const matchText = kode.includes(term) || nama.includes(term);
        const matchCabang = isHO ? (filterCabang === "" || cabangDoc.includes(filterCabang)) : true;

        return matchText && matchCabang;
    });

    currentPage = 1; // Reset ke halaman 1 setiap search
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById("table-body");
    tbody.innerHTML = "";

    // Logic Pagination
    const totalDocs = filteredDocuments.length;
    const totalPages = Math.ceil(totalDocs / rowsPerPage);
    
    // Cegah error jika halaman kosong
    if (totalDocs === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Tidak ada data ditemukan</td></tr>`;
        renderPaginationControls(0);
        return;
    }

    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageDocs = filteredDocuments.slice(startIndex, endIndex);

    const isHO = currentUser.cabang?.toLowerCase() === "head office";

    pageDocs.forEach((doc, index) => {
        const row = document.createElement("tr");
        
        // Kolom Cabang (Hanya tampil untuk HO)
        const cellCabang = isHO ? `<td>${doc.cabang || "-"}</td>` : "";
        
        row.innerHTML = `
            <td>${startIndex + index + 1}</td>
            <td>${doc.kode_toko}</td>
            <td>${doc.nama_toko}</td>
            ${cellCabang}
            <td>${doc.updated_at ? new Date(doc.updated_at).toLocaleDateString("id-ID") : "-"}</td>
            <td>
                <button class="btn-action btn-edit" onclick='handleEditClick(${JSON.stringify(doc).replace(/'/g, "&apos;")})'>Edit</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Jika HO, pastikan header tabel kolom cabang muncul
    if (isHO) {
        document.querySelectorAll(".col-cabang").forEach(el => el.style.display = "table-cell");
    }

    renderPaginationControls(totalPages);
}

// Global function agar bisa dipanggil dari onclick HTML string
window.handleEditClick = function(doc) {
    showForm(doc);
};

function renderPaginationControls(totalPages) {
    // Cek apakah container pagination sudah ada, jika belum buat
    let paginationContainer = document.getElementById("pagination-container");
    if (!paginationContainer) {
        paginationContainer = document.createElement("div");
        paginationContainer.id = "pagination-container";
        paginationContainer.className = "pagination-actions";
        // Insert setelah tabel
        const tableContainer = document.querySelector(".table-container");
        tableContainer.parentNode.insertBefore(paginationContainer, tableContainer.nextSibling);
    }

    paginationContainer.innerHTML = "";
    if (totalPages <= 1) return;

    // Tombol Prev
    const btnPrev = document.createElement("button");
    btnPrev.textContent = "Previous";
    btnPrev.disabled = currentPage === 1;
    btnPrev.onclick = () => { if (currentPage > 1) { currentPage--; renderTable(); }};
    
    // Info Halaman
    const spanInfo = document.createElement("span");
    spanInfo.textContent = ` Page ${currentPage} of ${totalPages} `;
    
    // Tombol Next
    const btnNext = document.createElement("button");
    btnNext.textContent = "Next";
    btnNext.disabled = currentPage === totalPages;
    btnNext.onclick = () => { if (currentPage < totalPages) { currentPage++; renderTable(); }};

    paginationContainer.appendChild(btnPrev);
    paginationContainer.appendChild(spanInfo);
    paginationContainer.appendChild(btnNext);
}

// ==========================================
// 5. FORM & UPLOAD LOGIC
// ==========================================
function renderUploadSections() {
    const container = document.getElementById("upload-container");
    container.innerHTML = "";

    UPLOAD_CATEGORIES.forEach(cat => {
        const section = document.createElement("div");
        section.className = "upload-group";
        section.innerHTML = `
            <label>${cat.label}</label>
            
            <div id="existing-${cat.key}" class="existing-files-list"></div>

            <input type="file" id="file-${cat.key}" multiple accept="image/*,.pdf">
            <div class="file-preview" id="preview-${cat.key}"></div>
        `;
        container.appendChild(section);

        // Event listener untuk preview nama file yang dipilih
        const input = section.querySelector(`#file-${cat.key}`);
        input.addEventListener("change", (e) => {
            const previewDiv = document.getElementById(`preview-${cat.key}`);
            previewDiv.innerHTML = "";
            Array.from(e.target.files).forEach(file => {
                const p = document.createElement("p");
                p.textContent = `📄 ${file.name} (Ready to upload)`;
                p.style.color = "green";
                p.style.fontSize = "0.85rem";
                previewDiv.appendChild(p);
            });
        });
    });
}

function renderExistingFiles(fileLinksString) {
    // Format dari backend biasanya string panjang dipisah koma
    // Contoh item: "fotoAsal|namafile.jpg|http://url..." 
    if (!fileLinksString) return;

    const entries = fileLinksString.split(",").map(s => s.trim()).filter(Boolean);
    
    entries.forEach(entry => {
        // Parsing logika (disamakan dengan React)
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

        // Cari container yang sesuai kategori
        const container = document.getElementById(`existing-${category}`) || document.getElementById("existing-pendukung");
        
        if (container) {
            const fileItem = document.createElement("div");
            fileItem.className = "existing-file-item";
            fileItem.innerHTML = `
                <a href="${url}" target="_blank" class="file-link">🔗 ${name}</a>
            `;
            container.appendChild(fileItem);
        }
    });
}

function resetPreviews() {
    // Clear selected files text
    document.querySelectorAll(".file-preview").forEach(el => el.innerHTML = "");
    // Clear input values
    document.querySelectorAll("input[type='file']").forEach(el => el.value = "");
    // Clear existing files display
    document.querySelectorAll(".existing-files-list").forEach(el => el.innerHTML = "");
}

function formatDecimalInput(value) {
    if (!value) return "";
    let str = value.toString().replace(/[^0-9]/g, ""); // Hanya angka
    
    // Logic: 2 angka terakhir adalah desimal
    if (str.length <= 2) return "0," + str.padStart(2, "0");
    
    const before = str.slice(0, -2);
    const after = str.slice(-2);
    // Tambahkan titik ribuan (opsional) - sederhana tanpa titik dulu untuk value input
    return `${parseInt(before, 10)},${after}`;
}

// ==========================================
// 6. SUBMIT HANDLER
// ==========================================
async function handleFormSubmit(e) {
    e.preventDefault();
    showLoading(true);
    document.getElementById("error-msg").textContent = "";

    try {
        const formData = new FormData();
        
        // 1. Append Data Teks
        formData.append("kode_toko", document.getElementById("kodeToko").value);
        formData.append("nama_toko", document.getElementById("namaToko").value);
        formData.append("luas_sales", document.getElementById("luasSales").value);
        formData.append("luas_parkir", document.getElementById("luasParkir").value);
        formData.append("luas_gudang", document.getElementById("luasGudang").value);
        
        // Data user yang menginput (penting untuk backend)
        formData.append("cabang", currentUser.cabang || "");
        formData.append("pic_name", currentUser.email || "");

        // 2. Append Files (Loop per kategori)
        let hasFile = false;
        UPLOAD_CATEGORIES.forEach(cat => {
            const input = document.getElementById(`file-${cat.key}`);
            if (input && input.files.length > 0) {
                Array.from(input.files).forEach(file => {
                    formData.append(cat.key, file); // Key harus sesuai dengan backend (fotoAsal, dll)
                    hasFile = true;
                });
            }
        });

        // 3. Tentukan URL & Method
        let url = `${BASE_URL}/api/doc/upload`;
        let method = "POST";

        if (isEditing && currentEditId) {
            url = `${BASE_URL}/api/doc/update/${currentEditId}`;
            method = "PUT"; // Backend seringnya pakai PUT untuk update
        }

        // 4. Kirim Request
        // Note: Jangan set 'Content-Type': 'multipart/form-data' manual, fetch akan set otomatis boundary-nya
        const res = await fetch(url, {
            method: method,
            body: formData
        });

        const result = await res.json();

        if (!res.ok) {
            throw new Error(result.detail || result.message || "Gagal menyimpan data");
        }

        // Sukses
        showModal("modal-success");
        showTable(); // Kembali ke tabel

    } catch (err) {
        console.error(err);
        document.getElementById("error-msg").textContent = err.message;
        showModal("modal-error");
    } finally {
        showLoading(false);
    }
}

// ==========================================
// 7. UTILS
// ==========================================
function handleLogout() {
    sessionStorage.clear();
    window.location.href = "../login.html";
}

let idleTime = 0;
function setupAutoLogout() {
    setInterval(() => {
        idleTime++;
        if (idleTime >= 30) { // 30 Menit
            handleLogout();
        }
    }, 60000); 

    ['mousemove', 'keypress', 'click', 'scroll'].forEach(evt => {
        document.addEventListener(evt, () => idleTime = 0);
    });
}