if (!sessionStorage.getItem('loggedInUserCabang')) {
    window.location.replace('../../auth/kontraktor/login.html');
}

const API_BASE_URL = "https://sparta-backend-5hdj.onrender.com/api";
const ENDPOINTS = {
    ulokList: `${API_BASE_URL}/get_ulok_by_email`,
    ganttData: `${API_BASE_URL}/get_gantt_data`,
    insertData: `${API_BASE_URL}/gantt/insert`,
};

let projects = [];
let currentProject = null;
let projectTasks = {};
let ganttApiData = null;
let ganttApiError = null;
let isLoadingGanttData = false;
let hasUserInput = false;
let isProjectLocked = false;
let filteredCategories = null;

/* ================= TASK TEMPLATE ================= */

const taskTemplateME = [
    { id: 1, name: 'Instalasi', start: 0, duration: 0, dependencies: [] },
    { id: 2, name: 'Fixture', start: 0, duration: 0, dependencies: [] },
    { id: 3, name: 'Pekerjaan Tambahan', start: 0, duration: 0, dependencies: [] },
    { id: 4, name: 'Pekerjaan SBO', start: 0, duration: 0, dependencies: [] },
];

const taskTemplateSipil = [
    { id: 1, name: 'Pekerjaan Persiapan', start: 0, duration: 0, dependencies: [] },
    { id: 2, name: 'Pekerjaan Bobokan/Bongkaran', start: 0, duration: 0, dependencies: [] },
    { id: 3, name: 'Pekerjaan Tanah', start: 0, duration: 0, dependencies: [] },
    { id: 4, name: 'Pekerjaan Pondasi & Beton', start: 0, duration: 0, dependencies: [] },
    { id: 5, name: 'Pekerjaan Pasangan', start: 0, duration: 0, dependencies: [] },
    { id: 6, name: 'Pekerjaan Besi', start: 0, duration: 0, dependencies: [] },
    { id: 7, name: 'Pekerjaan Keramik', start: 0, duration: 0, dependencies: [] },
    { id: 8, name: 'Pekerjaan Plumbing', start: 0, duration: 0, dependencies: [] },
    { id: 9, name: 'Pekerjaan Sanitary & Acecories', start: 0, duration: 0, dependencies: [] },
    { id: 10, name: 'Pekerjaan Janitor', start: 0, duration: 0, dependencies: [] },
    { id: 11, name: 'Pekerjaan Atap', start: 0, duration: 0, dependencies: [] },
    { id: 12, name: 'Pekerjaan Kusen, Pintu, dan Kaca', start: 0, duration: 0, dependencies: [] },
    { id: 13, name: 'Pekerjaan Finishing', start: 0, duration: 0, dependencies: [] },
    { id: 14, name: 'Pekerjaan Beanspot', start: 0, duration: 0, dependencies: [] },
    { id: 15, name: 'Pekerjaan Area Terbuka', start: 0, duration: 0, dependencies: [] },
    { id: 16, name: 'Pekerjaan Tambahan', start: 0, duration: 0, dependencies: [] },
    { id: 17, name: 'Pekerjaan SBO', start: 0, duration: 0, dependencies: [] },
];

let currentTasks = [];
const totalDaysME = 100;
const totalDaysSipil = 205;

/* ================= HELPER ================= */

function extractUlokAndLingkup(value) {
    if (!value) return { ulok: '', lingkup: 'Sipil' };

    const text = value.toUpperCase();
    let lingkup = 'Sipil';

    if (text.includes('ME')) lingkup = 'ME';
    if (text.includes('SIPIL')) lingkup = 'Sipil';

    const ulok = value.replace(/-ME|-SIPIL/gi, '').trim();
    return { ulok, lingkup };
}

function formatDateID(date) {
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ================= INIT ================= */

async function loadDataAndInit() {
    const email = sessionStorage.getItem('loggedInUserEmail');
    const res = await fetch(`${ENDPOINTS.ulokList}?email=${encodeURIComponent(email)}`);
    const data = await res.json();

    projects = data.map(d => ({
        ulok: d.value,
        ulokClean: d.value.replace(/-ME|-SIPIL/gi, ''),
        store: d.label,
        work: d.value.toUpperCase().includes('ME') ? 'ME' : 'Sipil',
        startDate: new Date().toISOString().split('T')[0],
    }));

    initChart();
}

function initChart() {
    const sel = document.getElementById('ulokSelect');
    sel.innerHTML = '<option value="">-- Pilih Proyek --</option>';

    projects.forEach(p => {
        projectTasks[p.ulok] = [];
        const opt = document.createElement('option');
        opt.value = p.ulok;
        opt.textContent = `${p.ulokClean} (${p.work})`;
        sel.appendChild(opt);
    });

    sel.onchange = e => {
        const v = e.target.value;
        if (!v) return;
        currentProject = projects.find(p => p.ulok === v);
        fetchGanttDataForSelection(v);
    };
}

/* ================= FETCH GANTT ================= */

async function fetchGanttDataForSelection(value) {
    const { ulok, lingkup } = extractUlokAndLingkup(value);

    const res = await fetch(`${ENDPOINTS.ganttData}?ulok=${ulok}&lingkup=${lingkup}`);
    const data = await res.json();

    const status = String(data?.gantt_data?.Status || '').toLowerCase();
    isProjectLocked = ['terkunci', 'locked', 'published'].includes(status);

    parseGanttDataToTasks(data.gantt_data, value);

    const hasRanges = currentTasks.some(t => t.inputData?.ranges?.length);
    if (hasRanges || isProjectLocked) {
        renderChart();
    }
}

/* ================= PARSE ================= */

function parseGanttDataToTasks(ganttData, key) {
    let tasks = [];
    let startDate = null;
    let i = 1;

    while (ganttData[`Kategori_${i}`]) {
        const s = new Date(ganttData[`Hari_Mulai_Kategori_${i}`]);
        const e = new Date(ganttData[`Hari_Selesai_Kategori_${i}`]);
        if (!startDate || s < startDate) startDate = s;

        tasks.push({
            id: i,
            name: ganttData[`Kategori_${i}`],
            inputData: {
                ranges: [{
                    start: 1 + Math.round((s - startDate) / 86400000),
                    end: 1 + Math.round((e - startDate) / 86400000),
                    duration: 1 + Math.round((e - s) / 86400000)
                }]
            },
            keterlambatan: Number(ganttData[`Keterlambatan_Kategori_${i}`]) || 0
        });
        i++;
    }

    currentProject.startDate = startDate.toISOString().split('T')[0];
    currentTasks = tasks;
    projectTasks[key] = tasks;
}

/* ================= RENDER CHART ================= */

function renderChart() {
    const chart = document.getElementById('ganttChart');
    const DAY = 40;
    let maxDay = 0;

    currentTasks.forEach(t => {
        t.duration = 0;
        t.inputData.ranges.forEach(r => {
            t.duration += r.duration;
            if (r.end > maxDay) maxDay = r.end;
        });
    });

    const totalDays = maxDay + 10;
    const start = new Date(currentProject.startDate);

    let html = '<div class="chart-header"><div class="task-column">Tahapan</div>';
    html += `<div class="timeline-column" style="width:${totalDays * DAY}px">`;

    for (let i = 0; i < totalDays; i++) {
        html += `<div class="day-header" style="width:${DAY}px">${i + 1}</div>`;
    }

    html += '</div></div><div class="chart-body">';

    currentTasks.forEach(t => {
        if (!t.inputData.ranges.length) return;

        html += `<div class="task-row">
            <div class="task-name">${t.name}</div>
            <div class="timeline" style="width:${totalDays * DAY}px">`;

        t.inputData.ranges.forEach(r => {
            html += `<div class="bar" 
                style="left:${(r.start - 1) * DAY}px;width:${r.duration * DAY}px">
                ${r.duration}
            </div>`;
        });

        html += '</div></div>';
    });

    html += '</div>';
    chart.innerHTML = html;
}

/* ================= START ================= */

loadDataAndInit();
