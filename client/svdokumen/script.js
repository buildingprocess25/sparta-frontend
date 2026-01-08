// ============================================
// KONFIGURASI & STATE
// ============================================
const BASE_URL = "https://sparta-backend-5hdj.onrender.com"; // Sesuaikan jika perlu
const DASHBOARD_URL = "../../dashboard/pic/index.html"; // URL Dashboard Utama
const LOGIN_URL = "../../auth/pic/login.html"; // URL Login Utama

const CATEGORIES = ["fotoAsal", "fotoRenovasi", "me", "sipil", "sketsaAwal", "pendukung"];

const state = {
    user: null, // Akan diisi dari Session/Local Storage
    docs: [],
    currentPage: 1,
    rowsPerPage: 5,
    filesToUpload: {}, // Menyimpan file baru (Base64)
    existingFiles: {}, // Menyimpan file lama (untuk edit)
    isEditing: false
};

// ============================================
// INISIALISASI
// ============================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. Cek Integrasi Auth
    checkAuthIntegration();
    
    // 2. Setup Event Listeners
    setupEventListeners();
    setupNumberInputs();

    // 3. Tombol Kembali ke Dashboard
    const backBtn = document.getElementById('backToDashboardBtn');
    if(backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = DASHBOARD_URL;
        });
    }
});

function checkAuthIntegration() {
    // Mencoba mengambil data user dari sessionStorage (prioritas) atau localStorage
    // Ini mengasumsikan auth/pic menyimpan data user dengan key 'user' atau 'user_data'
    // Sesuaikan key ini dengan apa yang disimpan oleh login_script.js di auth/pic
    const storedUser = sessionStorage.getItem("user") || localStorage.getItem("user");

    if (!storedUser) {
        alert("Sesi Anda telah berakhir atau Anda belum login. Silakan login kembali.");
        window.location.href = LOGIN_URL;
        return;
    }

    try {
        state.user = JSON.parse(storedUser);
        
        // Update UI dengan data user
        const welcomeMsg = document.getElementById("userWelcome");
        if(welcomeMsg) welcomeMsg.textContent = `Halo, ${state.user.username || state.user.nama || 'User'}`;

        // Lanjut load data
        checkOperationalHours();
        fetchDocuments();

    } catch (e) {
        console.error("Gagal memparsing data user", e);
        alert("Terjadi kesalahan data sesi. Silakan login ulang.");
        localStorage.removeItem("user");
        sessionStorage.removeItem("user");
        window.location.href = LOGIN_URL;
    }
}

function handleLogout() {
    if (confirm("Yakin ingin logout?")) {
        // Hapus sesi
        sessionStorage.clear();
        localStorage.removeItem("user"); // Bersihkan jika ada di local
        window.location.href = LOGIN_URL;
    }
}

// Cek Jam Kerja (Client Side Logic)
function checkOperationalHours() {
    const timeInfo = document.getElementById("timeInfo");
    const updateTime = () => {
        const now = new Date();
        const wibTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
        const hour = wibTime.getHours();
        
        if (hour < 6 || hour >= 18) {
            timeInfo.textContent = "⚠️ Di luar jam operasional (06:00 - 18:00 WIB)";
            timeInfo.style.color = "red";
            timeInfo.style.backgroundColor = "#fee2e2";
        } else {
            timeInfo.textContent = "✅ Jam Operasional Aktif";
            timeInfo.style.color = "green";
            timeInfo.style.backgroundColor = "#dcfce7";
        }
    };
    updateTime();
    setInterval(updateTime, 60000);
}

// ============================================
// DASHBOARD & DATA
// ============================================
async function fetchDocuments() {
    setLoading(true);
    try {
        // Menggunakan data cabang dari user yang login
        const userCabang = (state.user.cabang === "HEAD OFFICE" || !state.user.cabang) ? "" : state.user.cabang;
        
        let url = `${BASE_URL}/api/doc/list`;
        if (userCabang) url += `?cabang=${encodeURIComponent(userCabang)}`;

        const res = await fetch(url);
        const data = await res.json();
        
        if (data.ok) {
            state.docs = data.items;
            renderTable();
        }
    } catch (err) {
        console.error(err);
        showToast("Gagal mengambil data dokumen");
    } finally {
        setLoading(false);
    }
}

function renderTable() {
    const tbody = document.getElementById("tableBody");
    const search = document.getElementById("searchInput").value.toLowerCase();
    
    // Filter
    let filtered = state.docs.filter(d => 
        (d.kode_toko || "").toLowerCase().includes(search) || 
        (d.nama_toko || "").toLowerCase().includes(search)
    );

    // Pagination
    const totalPages = Math.ceil(filtered.length / state.rowsPerPage);
    if (state.currentPage > totalPages) state.currentPage = 1;
    
    const start = (state.currentPage - 1) * state.rowsPerPage;
    const currentData = filtered.slice(start, start + state.rowsPerPage);

    tbody.innerHTML = "";
    
    if (currentData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Tidak ada data.</td></tr>`;
        return;
    }

    currentData.forEach((row, index) => {
        const canEdit = state.user.jabatan && (state.user.jabatan.includes("COORDINATOR") || state.user.jabatan.includes("MANAGER") || state.user.jabatan.includes("SUPPORT"));
        const canDelete = state.user.jabatan && state.user.jabatan.includes("COORDINATOR");

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${start + index + 1}</td>
            <td><strong>${row.kode_toko || "-"}</strong></td>
            <td>${row.nama_toko || "-"}</td>
            <td>${row.cabang || "-"}</td>
            <td>${row.waktu_upload || "-"}</td>
            <td>
                <a href="${row.folder_link}" target="_blank" class="action-btn btn-link">📂 Drive</a>
                ${canEdit ? `<button class="action-btn btn-edit" onclick="openEditForm('${row.kode_toko}')">✏️ Edit</button>` : ''}
                ${canDelete ? `<button class="action-btn btn-del" onclick="deleteDocument('${row.kode_toko}')">🗑️ Hapus</button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Update Pagination UI
    document.getElementById("pageInfo").textContent = `Halaman ${state.currentPage} dari ${totalPages || 1}`;
    document.getElementById("prevPage").disabled = state.currentPage === 1;
    document.getElementById("nextPage").disabled = state.currentPage >= totalPages;
}

// ============================================
// FORM & UPLOAD LOGIC
// ============================================
function generateUploadFields() {
    const container = document.getElementById("uploadContainer");
    container.innerHTML = "";

    CATEGORIES.forEach(cat => {
        const div = document.createElement("div");
        div.className = "upload-category";
        div.innerHTML = `
            <h4>${formatCategoryName(cat)}</h4>
            <input type="file" multiple onchange="handleFileSelect(event, '${cat}')">
            <div id="preview-${cat}" class="file-preview-list"></div>
        `;
        container.appendChild(div);
    });
}

function handleFileSelect(e, category) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (!state.filesToUpload[category]) state.filesToUpload[category] = [];

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
            state.filesToUpload[category].push({
                name: file.name,
                data: ev.target.result.split(",")[1], // Base64 content
                type: file.type
            });
            renderPreviews(category);
        };
        reader.readAsDataURL(file);
    });
}

function renderPreviews(category) {
    const container = document.getElementById(`preview-${category}`);
    container.innerHTML = "";
    
    // Preview file baru
    (state.filesToUpload[category] || []).forEach((file, idx) => {
        const div = document.createElement("div");
        div.className = "file-item new-file";
        div.innerHTML = `<span>📄 ${file.name}</span> <span class="remove" onclick="removeFile('${category}', ${idx})">❌</span>`;
        container.appendChild(div);
    });

    // Preview file existing (saat edit)
    if (state.isEditing && state.existingFiles[category]) {
        state.existingFiles[category].forEach(file => {
            const div = document.createElement("div");
            div.className = "file-item existing-file";
            div.innerHTML = `<span>✅ ${file.name}</span>`; // Tidak bisa dihapus parsial di mode ini (opsional)
            container.appendChild(div);
        });
    }
}

function removeFile(category, index) {
    state.filesToUpload[category].splice(index, 1);
    renderPreviews(category);
}

// ============================================
// CRUD OPERATIONS
// ============================================
window.openAddForm = () => {
    resetForm();
    state.isEditing = false;
    document.getElementById("formModal").classList.remove("hidden");
    generateUploadFields();
};

window.openEditForm = (kodeToko) => {
    const doc = state.docs.find(d => d.kode_toko === kodeToko);
    if (!doc) return;

    resetForm();
    state.isEditing = true;
    
    document.getElementById("formTitle").textContent = `Edit Toko: ${doc.nama_toko}`;
    document.getElementById("editModeKode").value = doc.kode_toko;
    document.getElementById("kodeToko").value = doc.kode_toko;
    document.getElementById("kodeToko").disabled = true; // PK tidak boleh ganti
    document.getElementById("namaToko").value = doc.nama_toko;

    document.getElementById("formModal").classList.remove("hidden");
    generateUploadFields();

    // Load existing files mapping (mockup logic, sesuaikan dengan API response struktur file)
    // Di sini kita asumsikan server mengembalikan list file per kategori jika ada endpoint detail
    // Untuk sekarang kita hanya reset upload field
};

window.closeForm = () => {
    document.getElementById("formModal").classList.add("hidden");
};

function resetForm() {
    state.filesToUpload = {};
    state.existingFiles = {};
    state.isEditing = false;
    document.getElementById("editModeKode").value = "";
    document.getElementById("formTitle").textContent = "Form Dokumen Toko";
    document.getElementById("kodeToko").disabled = false;
    document.getElementById("uploadForm").reset();
    
    const container = document.getElementById("uploadContainer");
    if(container) container.innerHTML = "";
}

document.getElementById("uploadForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const kodeToko = document.getElementById("kodeToko").value.trim().toUpperCase();
    const namaToko = document.getElementById("namaToko").value.trim();
    
    if (!kodeToko || !namaToko) {
        showToast("Kode dan Nama Toko wajib diisi!");
        return;
    }

    const payload = {
        kode_toko: kodeToko,
        nama_toko: namaToko,
        cabang: state.user.cabang, // Ambil cabang dari user yang login
        files: state.filesToUpload
    };

    const endpoint = state.isEditing ? `${BASE_URL}/api/doc/update/{kode}` : `${BASE_URL}/api/doc/update/{kode}`;

    setLoading(true);
    try {
        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const result = await res.json();

        if (result.ok) {
            showToast("Data berhasil disimpan!");
            closeForm();
            fetchDocuments();
        } else {
            throw new Error(result.detail || "Gagal menyimpan data");
        }
    } catch (err) {
        console.error(err);
        showToast("Error: " + err.message);
    } finally {
        setLoading(false);
    }
});

window.deleteDocument = async (kodeToko) => {
    if (!confirm(`Hapus data toko ${kodeToko}? Data di Drive tidak akan terhapus otomatis.`)) return;

    setLoading(true);
    try {
        const res = await fetch(`${BASE_URL}/api/doc/delete/{kode}`, { method: "DELETE" });
        const result = await res.json();
        
        if (result.ok) {
            showToast("Data berhasil dihapus");
            fetchDocuments();
        } else {
            showToast("Gagal menghapus data");
        }
    } catch (err) {
        showToast("Error jaringan");
    } finally {
        setLoading(false);
    }
};

// ============================================
// UTILS
// ============================================
function showToast(msg) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 3000);
}

function setLoading(isLoading) {
    const modal = document.getElementById("loadingModal");
    if (isLoading) modal.classList.remove("hidden");
    else modal.classList.add("hidden");
}

function formatCategoryName(name) {
    // camelCase to Normal Text
    const result = name.replace(/([A-Z])/g, " $1");
    return result.charAt(0).toUpperCase() + result.slice(1);
}

function setupEventListeners() {
    // Close modal on click outside
    window.onclick = (event) => {
        const modal = document.getElementById("formModal");
        if (event.target == modal) {
            closeForm();
        }
    };
}

function setupNumberInputs() {
    // Helper jika ada input angka
}

window.changePage = (delta) => {
    state.currentPage += delta;
    renderTable();
};