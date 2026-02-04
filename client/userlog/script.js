// ==========================================
// 1. CONFIG & AUTHENTICATION
// ==========================================
const BASE_URL = "https://sparta-backend-5hdj.onrender.com"; 
let currentUser = null;
let allLogs = [];
let filteredLogs = [];
let currentPage = 1;
const itemsPerPage = 15;

document.addEventListener("DOMContentLoaded", () => {
    checkAuth();
    initApp();
});

function checkAuth() {
    // Cek sesi login (sesuaikan dengan logic auth Anda)
    const isAuthenticated = sessionStorage.getItem("authenticated");
    if (isAuthenticated !== "true") {
        // Redirect ke halaman login jika belum login
        // window.location.href = "../../auth/index.html"; 
        // console.warn("User not authenticated (Logic bypassed for dev)");
        return; 
    }

    currentUser = {
        email: sessionStorage.getItem("loggedInUserEmail") || "",
        cabang: sessionStorage.getItem("loggedInUserCabang") || "Head Office"
    };

    if (document.getElementById("user-name"))
        document.getElementById("user-name").textContent = currentUser.email;
    if (document.getElementById("user-branch"))
        document.getElementById("user-branch").textContent = currentUser.cabang;
}

// ==========================================
// 2. INITIALIZATION & NAVIGATION
// ==========================================
function initApp() {
    // Listener Search Input
    const searchInput = document.getElementById("search-input");
    if (searchInput) {
        searchInput.addEventListener("input", (e) => handleSearch(e.target.value));
    }

    // Listener Filter Cabang
    const filterSelect = document.getElementById("filter-cabang");
    if (filterSelect) {
        filterSelect.addEventListener("change", () => {
            const keyword = document.getElementById("search-input")?.value || "";
            handleSearch(keyword);
        });
    }

    // Listener Tombol Export
    document.getElementById('exportBtn')?.addEventListener('click', handleExportCSV);
    document.getElementById('btn-export-pdf')?.addEventListener('click', handleExportPDF);

    // Ambil data dari API
    fetchLogs();
}

// ==========================================
// 3. DATA FETCHING & TABLE RENDER
// ==========================================
async function fetchLogs() {
    showLoading(true);
    try {
        // Endpoint baru sesuai request
        const url = `${BASE_URL}/api/filter_user_log_login`; 

        console.log("Fetching logs from:", url);

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Gagal mengambil data log (Status: ${res.status})`);

        const rawData = await res.json();
        console.log("Raw Data Received:", rawData);

        // Parsing JSON: Data utama ada di dalam properti "data"
        if (rawData && Array.isArray(rawData.data)) {
            allLogs = rawData.data;
        } else if (Array.isArray(rawData)) {
            // Fallback jika API mengembalikan array langsung
            allLogs = rawData;
        } else {
            console.warn("Format data tidak dikenali, menggunakan array kosong.");
            allLogs = [];
        }

        updateCabangFilterOptions();
        handleSearch(""); // Render tabel awal

    } catch (err) {
        console.error("Error fetching logs:", err);
        showToast("Gagal memuat data log: " + err.message);
        allLogs = [];
        renderTable();
    } finally {
        showLoading(false);
    }
}

function handleSearch(keyword) {
    const term = (keyword || "").toLowerCase();
    const filterCabang = document.getElementById("filter-cabang")?.value || "";

    filteredLogs = allLogs.filter(log => {
        const email = (log.email || "").toLowerCase();
        const cabang = (log.cabang || "").toString();
        
        // Filter by Email (Search)
        const matchText = email.includes(term);
        // Filter by Cabang (Dropdown)
        const matchCabang = filterCabang === "" || cabang === filterCabang;

        return matchText && matchCabang;
    });

    // Sort Descending berdasarkan timestamp atau date (Terbaru di atas)
    filteredLogs.sort((a, b) => {
        const dateA = new Date(a.timestamp || a.date || 0);
        const dateB = new Date(b.timestamp || b.date || 0);
        return dateB - dateA; 
    });

    currentPage = 1;
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById("table-body");
    const totalBadge = document.getElementById("total-records");
    const totalCountVal = document.getElementById("total-count-val");

    // Update badge total data
    if (totalBadge && totalCountVal) {
        totalBadge.style.display = "flex";
        totalCountVal.textContent = filteredLogs.length;
    }

    if (!tbody) return;
    tbody.innerHTML = "";

    // Tampilkan pesan jika data kosong
    if (filteredLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: #666;">Tidak ada data log ditemukan</td></tr>`;
        renderPagination();
        return;
    }

    // Logika Pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedItems = filteredLogs.slice(startIndex, endIndex);

    // Render Baris Tabel
    paginatedItems.forEach((log, index) => {
        const row = document.createElement("tr");
        
        // Format Waktu
        let formattedTime = "-";
        const rawTime = log.timestamp || log.date; 

        if (rawTime) {
            try {
                const dateObj = new Date(rawTime);
                formattedTime = dateObj.toLocaleString('id-ID', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                });
            } catch (e) {
                formattedTime = rawTime;
            }
        }

        // Ambil Jumlah Log (default 0 jika tidak ada)
        const countLog = log.count !== undefined ? log.count : 0;

        row.innerHTML = `
            <td>${startIndex + index + 1}</td>
            <td>${log.cabang || "-"}</td>
            <td style="text-align: left;"><span style="font-weight:600; color:#333;">${log.email || "-"}</span></td>
            <td style="text-align: center; font-weight: bold; color: var(--primary);">${countLog}</td>
            <td style="color:#555;">${formattedTime}</td>
        `;
        tbody.appendChild(row);
    });

    renderPagination();
}

// ==========================================
// 4. PAGINATION & UTILS
// ==========================================
function renderPagination() {
    const container = document.getElementById("pagination-controls");
    if (!container) return;

    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

    if (totalPages <= 1) {
        container.style.display = "none";
        return;
    }

    container.style.display = "flex";
    document.getElementById("page-info").textContent = `Halaman ${currentPage} dari ${totalPages}`;

    const btnPrev = document.getElementById("btn-prev");
    const btnNext = document.getElementById("btn-next");

    btnPrev.disabled = currentPage === 1;
    btnNext.disabled = currentPage === totalPages;

    btnPrev.onclick = () => { currentPage--; renderTable(); };
    btnNext.onclick = () => { currentPage++; renderTable(); };
}

function updateCabangFilterOptions() {
    const select = document.getElementById("filter-cabang");
    if (!select) return;

    const currentVal = select.value;
    const cabangSet = new Set();
    
    // Ambil daftar cabang unik dari semua log
    allLogs.forEach(log => {
        if (log.cabang) cabangSet.add(log.cabang);
    });

    select.innerHTML = '<option value="">Semua Cabang</option>';
    Array.from(cabangSet).sort().forEach(c => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
    });
    // Restore pilihan user jika masih ada di daftar
    select.value = currentVal;
}

function showLoading(show) {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) overlay.style.display = show ? "flex" : "none";
}

function showToast(msg) {
    const toast = document.getElementById("toast");
    if (toast) {
        toast.textContent = msg;
        toast.className = "toast show";
        setTimeout(() => { toast.className = "toast"; }, 3000);
    }
}

// ==========================================
// 5. EXPORT LOGIC (CSV & PDF)
// ==========================================
function handleExportCSV() {
    if (!filteredLogs.length) {
        alert('Tidak ada data untuk diexport!');
        return;
    }

    // Header CSV dengan kolom baru
    const headers = ['No', 'Cabang', 'Email User', 'Jumlah Log', 'Waktu Terakhir'];
    
    const rows = filteredLogs.map((log, i) => {
        const time = log.timestamp || log.date || "-";
        const count = log.count !== undefined ? log.count : 0;
        
        return [
            i + 1,
            `"${(log.cabang || "").replace(/"/g, '""')}"`,
            `"${(log.email || "").replace(/"/g, '""')}"`,
            count,
            `"${time}"`
        ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `User_Log_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function handleExportPDF() {
    // Pastikan library jsPDF dimuat
    if (!window.jspdf || !filteredLogs.length) {
        alert("Data kosong atau library PDF belum siap.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    // Persiapan Data Baris untuk PDF
    const tableRows = filteredLogs.map((log, i) => {
        let formattedTime = log.timestamp || log.date;
        try {
            if (formattedTime) formattedTime = new Date(formattedTime).toLocaleString('id-ID');
        } catch(e) { formattedTime = log.timestamp || "-"; }

        const count = log.count !== undefined ? log.count : 0;

        return [
            i + 1, 
            log.cabang || "-", 
            log.email || "-", 
            count, 
            formattedTime || "-"
        ];
    });

    // Header Dokumen PDF
    doc.setFontSize(16);
    doc.text("Laporan User Log Activity", 14, 15);
    doc.setFontSize(10);
    doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 22);
    doc.text(`Total Records: ${filteredLogs.length}`, 14, 27);

    // Generate Tabel PDF dengan AutoTable
    doc.autoTable({
        startY: 35,
        head: [['No', 'Cabang', 'Email User', 'Jumlah Log', 'Waktu Terakhir']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [220, 38, 38], valign: 'middle', halign: 'center' }, // Merah Alfamart
        styles: { fontSize: 9 },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 35 },
            2: { cellWidth: 70 }, 
            3: { cellWidth: 25, halign: 'center' }, // Kolom Count rata tengah
            4: { cellWidth: 'auto' }
        }
    });

    doc.save(`User_Log_${new Date().toISOString().slice(0, 10)}.pdf`);
}