const API_BASE_URL = "https://sparta-backend.onrender.com/api";
const ENDPOINTS = {
    ulokList: `${API_BASE_URL}/get_ulok_by_cabang_pic`,
    ganttData: `${API_BASE_URL}/get_gantt_data`,
    updateDelay: `${API_BASE_URL}/gantt/update_delay`, // Endpoint simulasi untuk update delay
};

// State Variables
let projects = [];
let currentProject = null;
let currentTasks = []; // Data task sekarang sepenuhnya dari API

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    loadProjectList();
});

async function loadProjectList() {
    try {
        showLoadingMessage("Memuat daftar proyek...");
        
        const userEmail = sessionStorage.getItem('loggedInUserEmail') || ''; 
        const urlWithParam = `${ENDPOINTS.ulokList}?email=${encodeURIComponent(userEmail)}`;
        
        const response = await fetch(urlWithParam);
        if (!response.ok) throw new Error("Gagal mengambil data proyek");
        
        const apiData = await response.json();
        if (!Array.isArray(apiData)) throw new Error("Format data proyek tidak valid");

        projects = apiData.map(item => parseProjectFromLabel(item.label, item.value));

        if (projects.length === 0) {
            showErrorMessage("Tidak ada data proyek ditemukan.");
            return;
        }

        populateProjectDropdown();
        showSelectProjectMessage();

    } catch (error) {
        console.error("Error:", error);
        showErrorMessage(error.message);
    }
}

// ==================== PROJECT SELECTION ====================
function populateProjectDropdown() {
    const ulokSelect = document.getElementById('ulokSelect');
    ulokSelect.innerHTML = '<option value="">-- Pilih Proyek --</option>';
    
    projects.forEach(p => {
        const option = document.createElement('option');
        option.value = p.ulok;
        option.textContent = `${p.ulok} | ${p.store} (${p.work})`;
        ulokSelect.appendChild(option);
    });
}

async function handleProjectSelect() {
    const select = document.getElementById('ulokSelect');
    const selectedUlok = select.value;
    
    // Reset UI
    currentTasks = [];
    document.getElementById('ganttChart').innerHTML = '';
    
    if (!selectedUlok) {
        currentProject = null;
        toggleControls(false);
        showSelectProjectMessage();
        return;
    }

    currentProject = projects.find(p => p.ulok === selectedUlok);
    
    // Tampilkan loading di area chart
    showLoadingMessage(`Mengambil data monitoring untuk ${currentProject.store}...`);

    // Fetch Data Gantt Chart dari API
    await fetchGanttData(currentProject.ulok, currentProject.work);
}

// ==================== FETCH GANTT DATA (CORE) ====================
async function fetchGanttData(ulok, lingkup) {
    try {
        // Membersihkan format ulok jika perlu
        const { ulok: ulokClean } = extractUlokAndLingkup(ulok);
        const url = `${ENDPOINTS.ganttData}?ulok=${encodeURIComponent(ulokClean)}&lingkup=${encodeURIComponent(lingkup)}`;

        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Gagal mengambil data gantt (Status: ${response.status})`);
        }

        const data = await response.json();

        // Validasi Data
        // Asumsi data backend mengembalikan array of tasks atau object dengan property tasks
        let tasksData = [];
        if (Array.isArray(data)) {
            tasksData = data;
        } else if (data.tasks && Array.isArray(data.tasks)) {
            tasksData = data.tasks;
        } else if (data.data && Array.isArray(data.data)) {
            tasksData = data.data;
        } else {
            // Jika kosong atau format beda
            throw new Error("Data monitoring belum tersedia untuk proyek ini.");
        }

        if (tasksData.length === 0) {
            throw new Error("Belum ada jadwal yang dibuat oleh kontraktor.");
        }

        // Mapping Data API ke Struktur Internal
        // Sesuaikan field di sini dengan respon JSON API Anda sebenarnya
        currentTasks = tasksData.map((t, index) => ({
            id: t.id || (index + 1),
            name: t.name || t.task_name || `Tahapan ${index + 1}`,
            start: parseInt(t.start || t.start_offset || 0),
            duration: parseInt(t.duration || 0),
            delay: parseInt(t.delay || 0) // Delay diambil dari DB
        }));

        // Render & Setup UI
        renderGantt();
        populateTaskDropdown();
        toggleControls(true);

    } catch (error) {
        console.error("Fetch Error:", error);
        showErrorMessage(error.message);
        toggleControls(false);
    }
}

// ==================== CONTROLS & DELAY LOGIC ====================
function toggleControls(show) {
    const displayStyle = show ? 'flex' : 'none';
    const displayBlock = show ? 'block' : 'none';
    
    const delayControls = document.getElementById('delayControls');
    if(delayControls) delayControls.style.display = displayStyle;
    
    const exportButtons = document.getElementById('exportButtons');
    if(exportButtons) exportButtons.style.display = displayBlock;
}

function populateTaskDropdown() {
    const taskSelect = document.getElementById('taskDelaySelect');
    taskSelect.innerHTML = '<option value="">-- Pilih Tahapan --</option>';
    
    currentTasks.forEach(task => {
        const option = document.createElement('option');
        option.value = task.id;
        option.textContent = task.name;
        taskSelect.appendChild(option);
    });
}

function applyDelay() {
    const taskSelect = document.getElementById('taskDelaySelect');
    const delayInput = document.getElementById('delayInput');
    
    const taskId = parseInt(taskSelect.value); // Bisa ID angka atau string
    const delayDays = parseInt(delayInput.value);

    if (!taskId && taskId !== 0) {
        alert("Mohon pilih tahapan pekerjaan terlebih dahulu.");
        return;
    }

    if (isNaN(delayDays) || delayDays < 0) {
        alert("Mohon masukkan jumlah hari keterlambatan yang valid.");
        return;
    }

    const taskIndex = currentTasks.findIndex(t => t.id == taskId);
    if (taskIndex !== -1) {
        // Update state lokal
        currentTasks[taskIndex].delay = delayDays;
        
        // Render ulang
        renderGantt();
        
        alert(`Keterlambatan ${delayDays} hari diterapkan pada: ${currentTasks[taskIndex].name}`);
        delayInput.value = '';
        
        // Simpan perubahan ke Backend
        saveDelayToBackend(currentTasks[taskIndex]);
    }
}

function removeDelay() {
    const taskSelect = document.getElementById('taskDelaySelect');
    const taskId = taskSelect.value;

    if (!taskId) {
        alert("Mohon pilih tahapan yang akan dihapus keterlambatannya.");
        return;
    }

    const taskIndex = currentTasks.findIndex(t => t.id == taskId);
    if (taskIndex !== -1) {
        currentTasks[taskIndex].delay = 0;
        
        renderGantt();
        alert(`Keterlambatan dihapus pada: ${currentTasks[taskIndex].name}`);
        
        saveDelayToBackend(currentTasks[taskIndex]);
    }
}

async function saveDelayToBackend(task) {
    // Implementasi simpan ke endpoint update_delay
    try {
        console.log("Saving delay...", task);
        // Uncomment baris di bawah ini jika endpoint sudah siap
        /*
        const response = await fetch(ENDPOINTS.updateDelay, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ulok: currentProject.ulok,
                task_id: task.id,
                delay: task.delay
            })
        });
        if (!response.ok) alert("Gagal menyimpan data ke server.");
        */
    } catch (e) {
        console.error("Save error:", e);
    }
}

// ==================== RENDERING GANTT CHART ====================
function renderGantt() {
    const container = document.getElementById('ganttChart');
    if (!currentProject || currentTasks.length === 0) return;

    container.innerHTML = '';
    
    // 1. Kalkulasi Max Timeline
    // Kita asumsikan 'start' dari DB adalah hari ke-berapa task dimulai relatif dari hari 0
    let maxDuration = 0;
    
    currentTasks.forEach(t => {
        // End date = start + duration + delay
        const endDay = t.start + t.duration + (t.delay || 0);
        if (endDay > maxDuration) maxDuration = endDay;
    });

    maxDuration += 7; // Buffer tampilan

    // 2. Buat Struktur Tabel
    const wrapper = document.createElement('div');
    wrapper.className = 'gantt-wrapper';
    
    // Header
    const header = document.createElement('div');
    header.className = 'chart-header';
    header.innerHTML = '<div class="task-column">Tahapan Pekerjaan</div>';
    
    const timelineHeader = document.createElement('div');
    timelineHeader.className = 'timeline-column';
    
    const startDate = new Date(currentProject.startDate);
    
    // Generate Header Tanggal
    for (let i = 0; i < maxDuration; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        
        const dayEl = document.createElement('div');
        dayEl.className = 'day-header';
        dayEl.innerHTML = `
            <span class="d-date">${d.getDate()}</span>
            <span class="d-month">${d.toLocaleDateString('id-ID', { month: 'short' })}</span>
        `;
        timelineHeader.appendChild(dayEl);
    }
    header.appendChild(timelineHeader);
    wrapper.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'chart-body';

    currentTasks.forEach(task => {
        const row = document.createElement('div');
        row.className = 'task-row';
        
        // Kolom Nama
        const nameCol = document.createElement('div');
        nameCol.className = 'task-name';
        
        const delayText = task.delay > 0 ? `<span style="color:#ef4444; font-weight:bold;">(+${task.delay})</span>` : '';
        
        nameCol.innerHTML = `
            <div class="t-name">${task.name}</div>
            <div class="t-dur">${task.duration} Hari ${delayText}</div>
        `;
        row.appendChild(nameCol);

        // Timeline Bar
        const timeline = document.createElement('div');
        timeline.className = 'timeline';
        timeline.style.width = `${maxDuration * 30}px`; 

        // Grid
        for(let k=0; k < maxDuration; k++) {
            const grid = document.createElement('div');
            grid.className = 'grid-line';
            grid.style.left = `${k * 30}px`;
            timeline.appendChild(grid);
        }

        // Bar
        const bar = document.createElement('div');
        bar.className = 'bar';
        
        const totalDuration = task.duration + (task.delay || 0);
        const leftPos = task.start * 30;
        const width = totalDuration * 30;
        
        bar.style.left = `${leftPos}px`;
        bar.style.width = `${width}px`;
        
        // Styling Status
        if (task.delay > 0) {
            // Merah/Orange jika ada delay
            bar.style.background = 'linear-gradient(135deg, #f2994a 0%, #ef4444 100%)';
            bar.textContent = `${totalDuration} Hari (Terlambat)`;
        } else {
            // Hijau jika normal
            bar.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';
            bar.textContent = `${totalDuration} Hari`;
        }

        timeline.appendChild(bar);
        row.appendChild(timeline);
        body.appendChild(row);
    });

    wrapper.appendChild(body);
    container.appendChild(wrapper);

    updateStats();
}

// ==================== UTILS ====================
function updateStats() {
    const totalDelay = currentTasks.reduce((acc, t) => acc + (t.delay || 0), 0);
    const statsDiv = document.getElementById('stats');
    if(statsDiv) {
        statsDiv.innerHTML = `
            <div class="stat-card" style="padding:15px; background:#f8fafc; border-left:5px solid ${totalDelay > 0 ? '#ef4444' : '#10b981'}; border-radius:4px; margin-bottom:20px;">
                <h3 style="margin:0; font-size:14px; color:#64748b;">Status Proyek</h3>
                <p style="margin:5px 0 0 0; font-size:20px; font-weight:bold; color:${totalDelay > 0 ? '#ef4444' : '#10b981'};">
                    ${totalDelay > 0 ? `Total Keterlambatan: ${totalDelay} Hari` : 'Proyek Tepat Waktu'}
                </p>
            </div>
        `;
    }
}

function extractUlokAndLingkup(value) {
    if (!value) return { ulok: '', lingkup: '' };
    const parts = value.split('-');
    // Logika fallback sederhana
    const lingkupRaw = parts[parts.length - 1];
    const lingkup = (lingkupRaw === 'ME' || lingkupRaw === 'Sipil') ? lingkupRaw : 'Sipil';
    return { ulok: value, lingkup };
}

function parseProjectFromLabel(label, value) {
    const { lingkup } = extractUlokAndLingkup(value);
    const parts = label.split(' - ');
    return {
        ulok: value,
        name: parts[1] || 'Proyek',
        store: parts[2] || 'Toko',
        work: lingkup,
        startDate: new Date().toISOString().split('T')[0]
    };
}

function showLoadingMessage(msg) {
    const chart = document.getElementById('ganttChart');
    if(chart) chart.innerHTML = `<div style="padding:40px; text-align:center; color:#64748b;">⏳ ${msg}</div>`;
}

function showErrorMessage(msg) {
    const chart = document.getElementById('ganttChart');
    if(chart) chart.innerHTML = `<div style="padding:40px; text-align:center; color:#ef4444;">❌ ${msg}</div>`;
}

function showSelectProjectMessage() {
    const chart = document.getElementById('ganttChart');
    if(chart) chart.innerHTML = `
        <div style="padding:40px; text-align:center; color:#9ca3af; border: 2px dashed #e5e7eb; border-radius: 8px;">
            <h3>Monitoring Proyek</h3>
            <p>Silakan pilih proyek di atas untuk melihat data real-time.</p>
        </div>
    `;
}

// ==================== EXPORT EXCEL ====================
function exportToExcel() {
    if (!currentProject || currentTasks.length === 0) {
        alert("Tidak ada data untuk diexport.");
        return;
    }

    if (typeof XLSX === 'undefined') {
        alert("Library Excel belum dimuat.");
        return;
    }

    const data = [
        ["Laporan Monitoring Proyek"],
        ["No. Ulok", currentProject.ulok],
        ["Toko", currentProject.store],
        ["Lingkup", currentProject.work],
        [],
        ["No", "Tahapan", "Durasi Kontrak", "Keterlambatan (Hari)", "Total Durasi", "Status"]
    ];

    currentTasks.forEach((t, i) => {
        const total = t.duration + (t.delay || 0);
        data.push([
            i + 1,
            t.name,
            t.duration,
            t.delay || 0,
            total,
            t.delay > 0 ? "TERLAMBAT" : "OK"
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Monitoring");
    
    XLSX.writeFile(wb, `Monitoring_${currentProject.store}.xlsx`);
}