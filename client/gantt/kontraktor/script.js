// ==================== AUTH ====================
if (!sessionStorage.getItem('loggedInUserCabang')) {
    window.location.replace('../../auth/kontraktor/login.html');
}

// ==================== API ====================
const API_BASE_URL = "https://sparta-backend-5hdj.onrender.com/api";
const ENDPOINTS = {
    ulokList: `${API_BASE_URL}/get_ulok_by_email`,
    ganttData: `${API_BASE_URL}/get_gantt_data`
};

// ==================== STATE ====================
let projects = [];
let currentProject = null;
let currentTasks = [];
let isProjectLocked = false;

// ==================== UTIL ====================
function formatDateID(date) {
    return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function extractUlokAndLingkup(value) {
    if (!value) return { ulok: '', lingkup: '' };
    const parts = value.split('-');
    const lingkupRaw = parts.pop().toUpperCase();
    return {
        ulok: parts.join('-'),
        lingkup: lingkupRaw === 'ME' ? 'ME' : 'Sipil'
    };
}

// ==================== LOAD ULOK ====================
async function loadDataAndInit() {
    try {
        const email = sessionStorage.getItem('loggedInUserEmail');
        const res = await fetch(`${ENDPOINTS.ulokList}?email=${encodeURIComponent(email)}`);
        const data = await res.json();

        projects = data.map(d => ({
            ulok: d.value,
            label: d.label
        }));

        initUlokSelect();
    } catch (err) {
        console.error(err);
        alert('Gagal memuat data ULOK');
    }
}

// ==================== INIT SELECT ====================
function initUlokSelect() {
    const select = document.getElementById('ulokSelect');
    select.innerHTML = '<option value="">-- Pilih ULOK --</option>';

    projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.ulok;
        opt.textContent = p.label;
        select.appendChild(opt);
    });
}

// ==================== CHANGE ULOK ====================
async function changeUlok() {
    const ulokValue = document.getElementById('ulokSelect').value;
    document.getElementById('ganttChart').innerHTML = '';

    if (!ulokValue) return;

    const { ulok, lingkup } = extractUlokAndLingkup(ulokValue);
    await fetchGanttData(ulok, lingkup);
}

// ==================== FETCH GANTT ====================
async function fetchGanttData(ulok, lingkup) {
    try {
        const url = `${ENDPOINTS.ganttData}?ulok=${encodeURIComponent(ulok)}&lingkup=${encodeURIComponent(lingkup)}`;
        const res = await fetch(url);

        if (!res.ok) throw new Error('Data gantt tidak ditemukan');

        const data = await res.json();
        if (!data.gantt_data) throw new Error('Format data gantt salah');

        const status = String(data.gantt_data.Status || '').toLowerCase();
        isProjectLocked = ['terkunci', 'locked', 'published'].includes(status);

        parseGanttData(data.gantt_data);
        renderGanttChart();

    } catch (err) {
        console.warn(err.message);
        document.getElementById('ganttChart').innerHTML =
            `<div style="padding:20px;color:#999;">Data Gantt belum tersedia</div>`;
    }
}

// ==================== PARSE GANTT DATA ====================
function parseGanttData(ganttData) {
    currentTasks = [];
    let earliestDate = null;
    let i = 1;

    while (true) {
        const nama = ganttData[`Kategori_${i}`];
        const mulai = ganttData[`Hari_Mulai_Kategori_${i}`];
        const selesai = ganttData[`Hari_Selesai_Kategori_${i}`];
        if (!nama) break;

        const startDate = mulai ? new Date(mulai) : null;
        const endDate = selesai ? new Date(selesai) : null;

        if (startDate && !isNaN(startDate)) {
            if (!earliestDate || startDate < earliestDate) {
                earliestDate = startDate;
            }
        }

        currentTasks.push({
            id: i,
            name: nama,
            startDate,
            endDate
        });

        i++;
    }

    if (!earliestDate) earliestDate = new Date();
    currentProject = { startDate: earliestDate };

    const msPerDay = 86400000;

    currentTasks = currentTasks.map(task => {
        if (!task.startDate || !task.endDate) {
            return { ...task, start: 0, duration: 0 };
        }

        const start = Math.round((task.startDate - earliestDate) / msPerDay) + 1;
        const end = Math.round((task.endDate - earliestDate) / msPerDay) + 1;

        return {
            ...task,
            start,
            duration: Math.max(end - start + 1, 0)
        };
    });
}

// ==================== RENDER GANTT ====================
function renderGanttChart() {
    const chart = document.getElementById('ganttChart');
    chart.innerHTML = '';

    const renderableTasks = currentTasks.filter(t => t.duration > 0);
    if (!renderableTasks.length) {
        chart.innerHTML = `<div style="padding:20px;color:#999;">Tidak ada data jadwal</div>`;
        return;
    }

    const DAY_WIDTH = 40;
    const maxDay = Math.max(...renderableTasks.map(t => t.start + t.duration));
    const width = maxDay * DAY_WIDTH;

    let html = `
        <div class="chart-header">
            <div class="task-column">
                Tahapan ${isProjectLocked ? '<span style="color:#e53e3e">(READ ONLY)</span>' : ''}
            </div>
            <div class="timeline-column" style="width:${width}px">
    `;

    for (let i = 1; i <= maxDay; i++) {
        html += `<div class="day-header" style="width:${DAY_WIDTH}px">${i}</div>`;
    }

    html += `</div></div><div class="chart-body">`;

    renderableTasks.forEach(task => {
        const left = (task.start - 1) * DAY_WIDTH;
        const barWidth = task.duration * DAY_WIDTH;

        html += `
            <div class="task-row">
                <div class="task-name">${task.name}</div>
                <div class="timeline" style="width:${width}px">
                    <div class="bar ${isProjectLocked ? 'completed' : 'on-time'}"
                        style="left:${left}px;width:${barWidth}px"
                        title="${task.name} (${task.duration} hari)">
                        ${task.duration}
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    chart.innerHTML = html;
}

// ==================== START ====================
loadDataAndInit();
