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

    // Tampilkan tombol Tambah Data hanya jika BUKAN Head Office
    const btnAddNew = document.getElementById("btn-add-new");
    const filterCabang = document.getElementById("filter-cabang");

    if (currentUser.cabang?.toLowerCase() === "head office") {
        // Head Office: tampilkan filter, sembunyikan tombol tambah
        if (filterCabang) filterCabang.style.display = "inline-block";
        if (btnAddNew) btnAddNew.style.display = "none";
    } else {
        // Cabang lain: sembunyikan filter, tampilkan tombol tambah
        if (filterCabang) filterCabang.style.display = "none";
        if (btnAddNew) btnAddNew.style.display = "inline-block";
    }

    // Populate filter cabang dropdown
    populateCabangFilter();
}

// ==========================================
// 2. INITIALIZATION & NAVIGATION
// ==========================================
function initApp() {
    // Navigasi
    const btnAddNew = document.getElementById("btn-add-new");
    if (btnAddNew) {
        btnAddNew.addEventListener("click", () => showForm());
    }
    document.getElementById("btn-back").addEventListener("click", () => showTable());

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
    if (loader) loader.style.display = show ? "flex" : "none";
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

        // Cek filter cabang user
        if (currentUser.cabang && currentUser.cabang.toLowerCase() !== "head office") {
            url += `?cabang=${encodeURIComponent(currentUser.cabang)}`;
        }

        console.log("Fetching URL:", url); // Debug URL

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Gagal mengambil data (Status: ${res.status})`);

        const rawData = await res.json();
        console.log("Response Backend:", rawData); // Cek isi data di Console Browser (F12)

        // === PERBAIKAN UTAMA DISINI ===
        // Kode ini akan mengecek apakah data langsung array, atau dibungkus object
        if (Array.isArray(rawData)) {
            allDocuments = rawData;
        } else if (rawData.items && Array.isArray(rawData.items)) {
            allDocuments = rawData.items; // Jika formatnya { ok: true, items: [...] }
        } else if (rawData.data && Array.isArray(rawData.data)) {
            allDocuments = rawData.data; // Jika formatnya { data: [...] }
        } else if (rawData.documents && Array.isArray(rawData.documents)) {
            allDocuments = rawData.documents; // Jika formatnya { documents: [...] }
        } else {
            allDocuments = [];
            console.warn("Format data tidak dikenali. Pastikan backend mengirim Array.");
        }

        // Update dropdown filter cabang dengan data yang ada
        updateCabangFilterOptions();

        // Jalankan search awal untuk menampilkan tabel
        handleSearch("");
    } catch (err) {
        console.error("Error Fetching:", err);
        showToast("Gagal memuat data: " + err.message);

        // Pastikan tabel kosong jika error, jangan biarkan loading berputar
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
        const cabangDoc = doc.cabang || "";

        const matchText = kode.includes(term) || nama.includes(term);
        const matchCabang = filterCabang === "" || cabangDoc === filterCabang;

        return matchText && matchCabang;
    });

    renderTable();
}

function renderTable() {
    const tbody = document.getElementById("table-body");
    tbody.innerHTML = "";

    const totalDocs = filteredDocuments.length;

    // Tampilkan pesan jika data kosong
    if (totalDocs === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">Tidak ada data ditemukan</td></tr>`;
        return;
    }

    // Tampilkan semua data tanpa pagination
    filteredDocuments.forEach((doc, index) => {
        const row = document.createElement("tr");

        // Pastikan kita mengakses field dengan aman
        const kode = doc.kode_toko || doc.store_code || "-";
        const nama = doc.nama_toko || doc.store_name || "-";
        const cabang = doc.cabang || "-";
        const driveLink = doc.folder_link || doc.folder_drive || doc["folder link"] || "";
        const linkHtml = driveLink 
            ? `<a href="${driveLink}" target="_blank" style="text-decoration: none; color: #007bff; font-weight: 500;">Buka Folder</a>` 
            : `<span style="color: #aaa;">-</span>`;

        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${kode}</td>
            <td>${nama}</td>
            <td>${cabang}</td>
            <td>${linkHtml}</td>  <td>
                <button class="btn-action btn-edit" onclick='handleEditClick(${JSON.stringify(doc).replace(/'/g, "&apos;")})'>Edit</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Global function agar bisa dipanggil dari onclick HTML string
window.handleEditClick = function (doc) {
    showForm(doc);
};

// Populate dropdown filter cabang dari data yang ada
function populateCabangFilter() {
    const select = document.getElementById("filter-cabang");
    // Akan dipopulate setelah data di-fetch
}

function updateCabangFilterOptions() {
    const select = document.getElementById("filter-cabang");
    const currentValue = select.value;

    // Get unique cabang values from data
    const cabangSet = new Set();
    allDocuments.forEach(doc => {
        if (doc.cabang) {
            cabangSet.add(doc.cabang);
        }
    });

    // Clear and rebuild options
    select.innerHTML = '<option value="">Semua Cabang</option>';

    // Sort alphabetically
    const sortedCabang = Array.from(cabangSet).sort();
    sortedCabang.forEach(cabang => {
        const option = document.createElement("option");
        option.value = cabang;
        option.textContent = cabang;
        select.appendChild(option);
    });

    // Restore previous selection if still valid
    if (currentValue && cabangSet.has(currentValue)) {
        select.value = currentValue;
    }
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
        // 1. Siapkan Data Dasar
        const payload = {
            kode_toko: document.getElementById("kodeToko").value,
            nama_toko: document.getElementById("namaToko").value,
            luas_sales: document.getElementById("luasSales").value,
            luas_parkir: document.getElementById("luasParkir").value,
            luas_gudang: document.getElementById("luasGudang").value,
            cabang: currentUser.cabang || "",
            pic_name: currentUser.email || "",
            files: [] // Kita akan isi ini dengan file base64
        };

        // 2. Helper Function untuk Convert File ke Base64
        const fileToBase64 = (file) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });
        };

        // 3. Loop Categories dan Proses File
        const filePromises = [];
        
        UPLOAD_CATEGORIES.forEach(cat => {
            const input = document.getElementById(`file-${cat.key}`);
            if (input && input.files.length > 0) {
                Array.from(input.files).forEach(file => {
                    // Tambahkan proses convert ke antrian
                    const promise = fileToBase64(file).then(base64String => {
                        payload.files.push({
                            category: cat.key,
                            filename: file.name,
                            type: file.type,
                            data: base64String // String base64 lengkap
                        });
                    });
                    filePromises.push(promise);
                });
            }
        });

        // Tunggu semua file selesai dikonversi
        await Promise.all(filePromises);

        // 4. Tentukan URL & Method
        let url = `${BASE_URL}/api/doc/save`;
        let method = "POST";

        if (isEditing && currentEditId) {
            url = `${BASE_URL}/api/doc/update/${currentEditId}`;
            method = "PUT";
        }

        // 5. Kirim Request sebagai JSON
        const res = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json" // Header Wajib untuk request.get_json()
            },
            body: JSON.stringify(payload)
        });

        const result = await res.json();

        if (!res.ok) {
            throw new Error(result.detail || result.message || "Gagal menyimpan data");
        }

        // Sukses
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