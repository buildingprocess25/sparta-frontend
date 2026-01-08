// ============================================
// KONFIGURASI
// ============================================
const BASE_URL = "https://sparta-backend-5hdj.onrender.com"; 

// ============================================
// STATE MANAGEMENT
// ============================================
const state = {
    docs: [],
    user: null
};

// ============================================
// INISIALISASI
// ============================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. Cek Sesi Login
    const isAuthenticated = sessionStorage.getItem("authenticated");
    if (!isAuthenticated || isAuthenticated !== "true") {
        window.location.href = "../../auth/pic/login.html";
        return;
    }

    state.user = {
        email: sessionStorage.getItem("loggedInUserEmail"),
        role: sessionStorage.getItem("userRole")
    };

    // 2. Load Data Awal
    fetchDocuments();

    // 3. Setup Event Listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Search Listener
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const keyword = e.target.value.toLowerCase();
            const filtered = state.docs.filter(doc => 
                (doc.fileName || "").toLowerCase().includes(keyword)
            );
            renderTable(filtered);
        });
    }

    // -- LOGIKA TAMBAH DOKUMEN (DIKEMBALIKAN) --
    const addBtn = document.getElementById('addDocBtn');
    const modal = document.getElementById('uploadModal');
    const closeBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const form = document.getElementById('uploadForm');

    // Buka Modal
    if(addBtn && modal) {
        addBtn.addEventListener('click', () => {
            modal.classList.remove('hidden');
        });
    }

    // Tutup Modal
    const closeModal = () => {
        if(modal) {
            modal.classList.add('hidden');
            if(form) form.reset();
        }
    };

    if(closeBtn) closeBtn.addEventListener('click', closeModal);
    if(cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Handle Submit Form Upload
    if(form) {
        form.addEventListener('submit', handleUpload);
    }
}

// ============================================
// CORE FUNCTIONS
// ============================================

async function fetchDocuments() {
    showLoading(true);
    try {
        const response = await fetch(`${BASE_URL}/api/upload/list`);
        if (!response.ok) throw new Error("Gagal mengambil data");
        
        const data = await response.json();
        state.docs = Array.isArray(data) ? data : (data.files || []);
        
        renderTable(state.docs);
    } catch (error) {
        console.error("Fetch Error:", error);
        showToast("Gagal memuat data: " + error.message);
    } finally {
        showLoading(false);
    }
}

function renderTable(dataDocs) {
    const tbody = document.getElementById('docTableBody');
    const emptyMsg = document.getElementById('emptyMessage');
    
    if (!tbody) return;
    tbody.innerHTML = '';

    if (dataDocs.length === 0) {
        if(emptyMsg) emptyMsg.classList.remove('hidden');
        return;
    }
    
    if(emptyMsg) emptyMsg.classList.add('hidden');

    dataDocs.forEach((doc, index) => {
        const tr = document.createElement('tr');
        
        const dateStr = doc.createdAt || new Date().toISOString();
        const formattedDate = new Date(dateStr).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit'
        });

        tr.innerHTML = `
            <td style="text-align: center;">${index + 1}</td>
            <td style="font-weight: 500;">${doc.fileName || "Dokumen Tanpa Nama"}</td>
            <td>${doc.uploader || "-"}</td>
            <td>${formattedDate}</td>
            <td style="text-align: center;">
                <button class="btn-action" onclick="downloadDoc('${doc._id}')" title="Download" style="background:#eff6ff; color:#1d4ed8; padding:6px; border-radius:6px; border:none; cursor:pointer;">
                    ⬇
                </button>
                <button class="btn-action" onclick="deleteDoc('${doc._id}')" title="Hapus" style="background:#fef2f2; color:#dc2626; padding:6px; border-radius:6px; border:none; cursor:pointer; margin-left:4px;">
                    🗑
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ============================================
// UPLOAD & ACTION HANDLERS
// ============================================

async function handleUpload(e) {
    e.preventDefault();
    showLoading(true);

    const fileInput = document.getElementById('fileInput');
    const nameInput = document.getElementById('fileNameInput');

    if (!fileInput.files[0]) {
        showToast("Pilih file terlebih dahulu!");
        showLoading(false);
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('fileName', nameInput.value);
    formData.append('uploader', state.user.email || "User");
    formData.append('role', state.user.role || "PIC");

    try {
        const response = await fetch(`${BASE_URL}/api/upload/upload`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            showToast("Berhasil mengunggah dokumen!");
            document.getElementById('uploadModal').classList.add('hidden');
            e.target.reset();
            fetchDocuments(); // Refresh tabel
        } else {
            throw new Error("Gagal upload");
        }
    } catch (error) {
        showToast("Error: " + error.message);
    } finally {
        showLoading(false);
    }
}

async function deleteDoc(id) {
    if(!confirm("Yakin ingin menghapus dokumen ini?")) return;
    
    showLoading(true);
    try {
        const res = await fetch(`${BASE_URL}/api/upload/delete/${id}`, { method: 'DELETE' });
        if(res.ok) {
            showToast("Dokumen dihapus.");
            fetchDocuments();
        } else {
            throw new Error("Gagal menghapus.");
        }
    } catch(e) {
        showToast(e.message);
    } finally {
        showLoading(false);
    }
}

function downloadDoc(id) {
    window.open(`${BASE_URL}/api/upload/download/${id}`, '_blank');
}

// ============================================
// HELPER (Toast & Loading)
// ============================================
function showLoading(show) {
    const el = document.getElementById('loadingModal');
    if(el) show ? el.classList.remove('hidden') : el.classList.add('hidden');
}

function showToast(msg) {
    const el = document.getElementById('toast');
    if(el) {
        el.textContent = msg;
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 3000);
    } else {
        alert(msg);
    }
}