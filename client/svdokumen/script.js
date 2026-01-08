// ============================================
// KONFIGURASI & STATE
// ============================================
const BASE_URL = "https://sparta-backend-5hdj.onrender.com"; // Sesuaikan jika perlu
// Sesuaikan URL dashboard/login relatif terhadap file ini
const DASHBOARD_URL = "../../dashboard/pic/index.html"; 
const LOGIN_URL = "../../auth/pic/login.html"; 

const state = {
    user: null, 
    docs: [],
    currentPage: 1,
    rowsPerPage: 10 // Bisa disesuaikan
};

// ============================================
// INISIALISASI
// ============================================
document.addEventListener("DOMContentLoaded", () => {
    // 1. Cek Integrasi Auth
    checkAuthIntegration();
    
    // 2. Setup Event Listeners (Search & Filter)
    setupEventListeners();

    // 3. (Opsional) Setup tombol kembali jika menggunakan button JS, 
    // tapi di HTML sudah pakai <a href> jadi ini hanya pelengkap.
    const backBtn = document.getElementById('backToDashboardBtn');
    if(backBtn) {
        backBtn.addEventListener('click', (e) => {
            // Biarkan default behavior <a> tag bekerja, atau override jika perlu logika khusus
            // e.preventDefault();
            // window.location.href = DASHBOARD_URL; 
        });
    }
});

function checkAuthIntegration() {
    const isAuthenticated = sessionStorage.getItem("authenticated");
    const email = sessionStorage.getItem("loggedInUserEmail");
    const role = sessionStorage.getItem("userRole");

    // Jika tidak login, lempar ke login
    if (!isAuthenticated || isAuthenticated !== "true") {
        // alert("Sesi berakhir. Silakan login kembali."); // Opsional, bisa di-uncomment
        window.location.href = LOGIN_URL;
        return;
    }

    // Set state user
    state.user = {
        username: email,
        role: role
    };

    // Load Data
    fetchDocuments();
    
    // Jam kerja (checkOperationalHours) DIHAPUS atau dimatikan agar tidak error
    // karena elemen UI jam kerja tidak ada di style RAB.
}

function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const roleFilter = document.getElementById('roleFilter');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const keyword = e.target.value.toLowerCase();
            filterDocuments(keyword, roleFilter ? roleFilter.value : "");
        });
    }

    if (roleFilter) {
        roleFilter.addEventListener('change', (e) => {
            const role = e.target.value;
            filterDocuments(searchInput ? searchInput.value.toLowerCase() : "", role);
        });
    }
}

// ============================================
// FETCH & RENDER DATA
// ============================================
async function fetchDocuments() {
    showLoading(true);
    try {
        const response = await fetch(`${BASE_URL}/api/upload/list`); // Sesuaikan endpoint backend Anda
        if (!response.ok) throw new Error("Gagal mengambil data");
        
        const data = await response.json();
        
        // Asumsi data backend berupa array object dokumen
        // Sesuaikan mapping ini dengan response JSON asli Anda
        state.docs = Array.isArray(data) ? data : (data.files || []); 
        
        renderTable(state.docs);
    } catch (error) {
        console.error("Error fetching docs:", error);
        showToast("Gagal memuat dokumen: " + error.message);
        
        // Fallback data kosong agar tabel tidak error
        renderTable([]); 
    } finally {
        showLoading(false);
    }
}

function renderTable(dataDocs) {
    const tbody = document.getElementById('docTableBody');
    const emptyMsg = document.getElementById('emptyMessage');
    
    if (!tbody) return; // Mencegah error jika elemen hilang

    tbody.innerHTML = '';

    if (dataDocs.length === 0) {
        if (emptyMsg) emptyMsg.classList.remove('hidden');
        return;
    }
    
    if (emptyMsg) emptyMsg.classList.add('hidden');

    dataDocs.forEach((doc, index) => {
        const tr = document.createElement('tr');
        
        // Format Tanggal
        const dateStr = doc.createdAt || doc.tanggal || new Date().toISOString();
        const dateObj = new Date(dateStr);
        const formattedDate = dateObj.toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        // Mapping Data (Sesuaikan key dengan response backend Anda)
        const docName = doc.fileName || doc.nama_dokumen || "Tanpa Nama";
        const uploader = doc.uploader || doc.user_email || "Anonim";
        const role = doc.role || "-";
        const fileId = doc._id || doc.id; // ID untuk download/hapus

        tr.innerHTML = `
            <td style="text-align: center;">${index + 1}</td>
            <td style="font-weight: 500;">${docName}</td>
            <td>${uploader}</td>
            <td><span class="badge-role">${role}</span></td>
            <td>${formattedDate}</td>
            <td style="text-align: center;">
                <button class="btn-action btn-download" onclick="downloadDoc('${fileId}', '${docName}')" title="Download">
                    ⬇
                </button>
                <button class="btn-action btn-delete" onclick="deleteDoc('${fileId}')" title="Hapus">
                    🗑
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterDocuments(keyword, role) {
    const filtered = state.docs.filter(doc => {
        const nameMatch = (doc.fileName || "").toLowerCase().includes(keyword);
        const roleMatch = role === "" || (doc.role || "") === role;
        return nameMatch && roleMatch;
    });
    renderTable(filtered);
}

// ============================================
// AKSI (DOWNLOAD & DELETE)
// ============================================
async function downloadDoc(id, name) {
    // Implementasi Download
    // Jika backend mengirim file blob:
    /*
    try {
        window.open(`${BASE_URL}/api/upload/download/${id}`, '_blank');
    } catch (e) {
        showToast("Gagal mendownload file");
    }
    */
    showToast(`Mendownload ${name}...`);
    // Contoh sederhana redirect ke URL download
    window.open(`${BASE_URL}/api/upload/download/${id}`, '_blank');
}

async function deleteDoc(id) {
    if (!confirm("Apakah Anda yakin ingin menghapus dokumen ini?")) return;

    showLoading(true);
    try {
        const response = await fetch(`${BASE_URL}/api/upload/delete/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast("Dokumen berhasil dihapus");
            fetchDocuments(); // Refresh data
        } else {
            throw new Error("Gagal menghapus");
        }
    } catch (e) {
        showToast("Error: " + e.message);
    } finally {
        showLoading(false);
    }
}

// ============================================
// UTILITIES (TOAST & LOADING)
// ============================================
function showLoading(show) {
    const modal = document.getElementById('loadingModal');
    if (modal) {
        if (show) modal.classList.remove('hidden');
        else modal.classList.add('hidden');
    }
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.classList.remove('hidden');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    } else {
        alert(message); // Fallback jika elemen toast hilang
    }
}