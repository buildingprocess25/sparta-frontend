if (!sessionStorage.getItem('loggedInUserCabang')) {
    window.location.replace('../../auth/kontraktor/login.html');
}

const API_BASE_URL = "https://sparta-backend-5hdj.onrender.com/api";
const ENDPOINTS = {
    ulokList: `${API_BASE_URL}/get_ulok_by_email`,
    ganttData: `${API_BASE_URL}/get_gantt_data`,
    insertData: `${API_BASE_URL}/gantt/insert`,
    dayInsert: `${API_BASE_URL}/gantt/day/insert`,
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
let dayGanttData = null;
let supervisionDays = {}; // Format: { dayNumber: true, ... }

// ==================== TASK TEMPLATES ====================
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

// ==================== HELPER FUNCTIONS ====================
function formatDateID(date) {
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('id-ID', options);
}

function extractUlokAndLingkup(value) {
    if (!value) return { ulok: '', lingkup: '' };

    const trimmed = String(value).trim();
    const parts = trimmed.split('-');

    if (parts.length < 2) {
        return { ulok: trimmed, lingkup: '' };
    }

    const lingkupRaw = parts.pop();
    const ulok = parts.join('-');
    const lingkupUpper = lingkupRaw.replace(/[^a-zA-Z]/g, '').toUpperCase();
    const lingkup = lingkupUpper === 'ME' ? 'ME' : 'Sipil';

    return { ulok, lingkup };
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function showLoadingMessage() {
    const chart = document.getElementById('ganttChart');
    chart.innerHTML = `
        <div style="text-align: center; padding: 60px; color: #6c757d;">
            <div style="font-size: 48px; margin-bottom: 20px;">⏳</div>
            <h2 style="margin-bottom: 15px;">Memuat Data...</h2>
            <p>Sedang mengambil data proyek dari server.</p>
        </div>
    `;
}

function showErrorMessage(message) {
    const chart = document.getElementById('ganttChart');
    chart.innerHTML = `
        <div style="text-align: center; padding: 60px; color: #e53e3e;">
            <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
            <h2 style="margin-bottom: 15px;">Terjadi Kesalahan</h2>
            <p>${message}</p>
            <button onclick="loadDataAndInit()" style="margin-top: 20px; padding: 10px 20px; background: #3182ce; color: white; border: none; border-radius: 6px; cursor: pointer;">
                🔄 Coba Lagi
            </button>
        </div>
    `;
}

function showSelectProjectMessage() {
    const chart = document.getElementById('ganttChart');
    chart.innerHTML = `
        <div style="text-align: center; padding: 60px; color: #6c757d;">
            <h2 style="margin-bottom: 15px;">📋 Pilih No. Ulok</h2>
            <p>Data berhasil dimuat. Silakan pilih proyek di atas.</p>
        </div>
    `;
    document.getElementById('projectInfo').innerHTML = '';
    document.getElementById('stats').innerHTML = '';
    document.getElementById('exportButtons').style.display = 'none';
    ganttApiData = null;
    ganttApiError = null;
    hasUserInput = false;
    isProjectLocked = false;
    filteredCategories = null;
    dayGanttData = null;
    renderApiData();
}

function showPleaseInputMessage() {
    const chart = document.getElementById('ganttChart');
    chart.innerHTML = `
        <div style="text-align: center; padding: 60px; color: #6c757d;">
            <div style="font-size: 48px; margin-bottom: 20px;">⏱️</div>
            <h2 style="margin-bottom: 15px;">Silakan Input Jadwal Pengerjaan</h2>
            <p>Masukkan hari mulai dan selesai untuk setiap tahapan di form di atas, kemudian klik <strong>"Terapkan Jadwal"</strong>.</p>
        </div>
    `;
}

// ==================== PARSE PROJECT DATA ====================
function parseProjectFromLabel(label, value) {
    const parts = label.split(' - ');
    const { ulok: ulokClean, lingkup } = extractUlokAndLingkup(value);

    let ulokNumber = ulokClean || value.replace(/-ME|-Sipil/gi, '');
    let projectName = "Reguler";
    let storeName = "Tidak Diketahui";
    let workType = lingkup || 'Sipil';
    let projectType = "Reguler";

    if (label.toUpperCase().includes('(ME)')) {
        workType = 'ME';
    }

    if (parts.length >= 3) {
        projectName = parts[1].replace(/\(ME\)|\(Sipil\)/gi, '').trim();
        storeName = parts[2].trim();
        if (label.toUpperCase().includes('RENOVASI') || ulokNumber.includes('-R')) {
            projectType = "Renovasi";
        }
    } else if (parts.length === 2) {
        storeName = parts[1].replace(/\(ME\)|\(Sipil\)/gi, '').trim();
    }

    return {
        ulok: value,
        ulokClean: ulokClean || ulokNumber,
        ulokNumber: ulokNumber,
        name: projectName,
        store: storeName,
        work: workType,
        lingkup: workType,
        projectType: projectType,
        startDate: new Date().toISOString().split('T')[0],
        durasi: workType === 'ME' ? 37 : 184,
        alamat: "",
        status: "Berjalan"
    };
}

// ==================== FETCH DATA FROM API ====================
async function loadDataAndInit() {
    try {
        showLoadingMessage();
        const userEmail = sessionStorage.getItem('loggedInUserEmail');
        const urlWithParam = `${ENDPOINTS.ulokList}?email=${encodeURIComponent(userEmail)}`;
        const response = await fetch(urlWithParam);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || `HTTP Error: ${response.status}`);
        }

        const apiData = await response.json();

        if (!Array.isArray(apiData)) {
            throw new Error("Format data API tidak valid (harus array)");
        }

        projects = apiData.map(item => parseProjectFromLabel(item.label, item.value));

        if (projects.length === 0) {
            showErrorMessage("Tidak ada data proyek ditemukan untuk email ini.");
            return;
        }

        initChart();

    } catch (error) {
        console.error("❌ Error loading data:", error);
        showErrorMessage(`Gagal memuat data: ${error.message}`);
    }
}

function initChart() {
    const ulokSelect = document.getElementById('ulokSelect');
    ulokSelect.innerHTML = '<option value="">-- Pilih Proyek --</option>';

    projects.forEach(project => {
        projectTasks[project.ulok] = [];
        const option = document.createElement('option');
        option.value = project.ulok;
        option.textContent = `${project.ulok} | ${project.store} (${project.work})`;
        ulokSelect.appendChild(option);
    });
    ulokSelect.addEventListener('change', (e) => {
        const selectedUlok = e.target.value;
        if (selectedUlok) {
            localStorage.setItem('lastSelectedUlok', selectedUlok);
        } else {
            localStorage.removeItem('lastSelectedUlok');
        }
        if (!selectedUlok) {
            showSelectProjectMessage();
            return;
        }
        currentProject = projects.find(p => p.ulok === selectedUlok);
        if (projectTasks[selectedUlok]) {
            currentTasks = projectTasks[selectedUlok];
        }
        hasUserInput = false;
        isProjectLocked = false;
        fetchGanttDataForSelection(selectedUlok);
        renderProjectInfo();
        updateStats();
        document.getElementById('exportButtons').style.display = 'block';
    });
    const savedUlok = localStorage.getItem('lastSelectedUlok');
    if (savedUlok) {
        const projectExists = projects.some(p => p.ulok === savedUlok);
        if (projectExists) {
            ulokSelect.value = savedUlok;
            ulokSelect.dispatchEvent(new Event('change'));
        }
    }
    showSelectProjectMessage();
}

// ==================== GANTT DATA FETCH (API) ====================
async function fetchGanttDataForSelection(selectedValue) {
    if (!selectedValue) {
        ganttApiData = null;
        renderApiData();
        return;
    }

    const { ulok, lingkup } = extractUlokAndLingkup(selectedValue);

    isLoadingGanttData = true;
    ganttApiError = null;
    renderApiData();

    const url = `${ENDPOINTS.ganttData}?ulok=${encodeURIComponent(ulok)}&lingkup=${encodeURIComponent(lingkup)}`;
    console.log(`🔗 Fetching Gantt Data from: ${url}`);

    try {
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error("Data Gantt tidak ditemukan di server (404).");
            }
            throw new Error(`Gagal mengambil data (Status: ${response.status})`);
        }

        const data = await response.json();
        ganttApiData = data;

        if (currentProject && data?.rab) {
            updateProjectFromRab(data.rab);
        }

        if (data.filtered_categories && Array.isArray(data.filtered_categories)) {
            filteredCategories = data.filtered_categories;
            console.log("📂 Filtered Categories:", filteredCategories);
        } else {
            filteredCategories = null;
        }

        // Store day_gantt_data if available
        if (data.day_gantt_data && Array.isArray(data.day_gantt_data)) {
            dayGanttData = data.day_gantt_data;
            console.log("📅 day_gantt_data ditemukan:", dayGanttData.length, "entries");
        } else {
            dayGanttData = null;
        }

        if (data.gantt_data && typeof data.gantt_data === 'object') {
            console.log("📊 gantt_data ditemukan di response");

            const ganttData = data.gantt_data;
            const ganttStatus = String(ganttData.Status || '').trim().toLowerCase();

            if (['terkunci', 'locked', 'published'].includes(ganttStatus)) {
                isProjectLocked = true;
                console.log("🔒 Status Project: TERKUNCI");
            } else {
                isProjectLocked = false;
                console.log("🔓 Status Project: ACTIVE");
            }

            // Parse supervision days from gantt_data
            parseSupervisionFromGanttData(ganttData);

            // Parse tasks from gantt_data and day_gantt_data
            parseGanttDataToTasks(ganttData, selectedValue, dayGanttData);
            hasUserInput = true;

        } else {
            console.warn("⚠️ Response API valid, tetapi tidak memiliki properti 'gantt_data'.");
            throw new Error("Format data API tidak valid: 'gantt_data' hilang.");
        }

    } catch (error) {
        console.warn('⚠️ Menggunakan template default:', error.message);
        ganttApiError = null;
        dayGanttData = null;

        if (currentProject) {
            let templateTasks;
            if (currentProject.work === 'ME') {
                templateTasks = JSON.parse(JSON.stringify(taskTemplateME));
            } else {
                templateTasks = JSON.parse(JSON.stringify(taskTemplateSipil));
            }

            if (filteredCategories && Array.isArray(filteredCategories) && filteredCategories.length > 0) {
                currentTasks = templateTasks.filter(task => {
                    return filteredCategories.some(cat =>
                        task.name.toUpperCase().includes(cat.toUpperCase()) ||
                        cat.toUpperCase().includes(task.name.toUpperCase())
                    );
                });
                currentTasks = currentTasks.map((task, idx) => ({ ...task, id: idx + 1 }));
                console.log(`📋 Tasks filtered: ${currentTasks.length} dari ${templateTasks.length}`);
            } else {
                currentTasks = templateTasks;
            }

            // Initialize with empty ranges
            currentTasks = currentTasks.map(task => ({
                ...task,
                inputData: { ranges: [] }
            }));

            projectTasks[selectedValue] = currentTasks;
            hasUserInput = false;
            isProjectLocked = false;
        }

    } finally {
        isLoadingGanttData = false;
        renderProjectInfo();
        renderApiData();

        // Render chart if we have tasks with input data or if project is locked
        if ((hasUserInput && currentTasks.length > 0) || (isProjectLocked && currentTasks.length > 0)) {
            renderChart();
        } else {
            if (ganttApiError) {
                showErrorMessage(ganttApiError);
            } else {
                showPleaseInputMessage();
            }
        }
        updateStats();
    }
}

// ==================== PARSE GANTT_DATA TO TASKS ====================
function parseGanttDataToTasks(ganttData, selectedValue, dayGanttDataArray = null) {
    if (!currentProject || !ganttData) return;

    let dynamicTasks = [];
    let earliestDate = null;
    let tempTaskList = [];
    let i = 1;

    // Extract categories from gantt_data
    while (true) {
        const kategoriKey = `Kategori_${i}`;
        const keterlambatanKey = `Keterlambatan_Kategori_${i}`;

        if (!ganttData.hasOwnProperty(kategoriKey)) {
            break;
        }

        const kategoriName = ganttData[kategoriKey];
        const keterlambatan = parseInt(ganttData[keterlambatanKey]) || 0;

        if (kategoriName && kategoriName.trim() !== '') {
            tempTaskList.push({
                id: i,
                name: kategoriName,
                keterlambatan: keterlambatan
            });
        }
        i++;
    }

    // Parse day_gantt_data to get ranges for each category
    const categoryRangesMap = {};

    if (dayGanttDataArray && Array.isArray(dayGanttDataArray) && dayGanttDataArray.length > 0) {
        console.log("📅 Parsing day_gantt_data for ranges...");

        // Find earliest date from day_gantt_data
        dayGanttDataArray.forEach(entry => {
            const hAwalStr = entry.h_awal;
            if (hAwalStr) {
                const parsedDate = parseDateDDMMYYYY(hAwalStr);
                if (parsedDate && !isNaN(parsedDate.getTime())) {
                    if (!earliestDate || parsedDate < earliestDate) {
                        earliestDate = parsedDate;
                    }
                }
            }
        });

        if (!earliestDate) {
            earliestDate = new Date();
        }

        const projectStartDate = earliestDate;
        currentProject.startDate = projectStartDate.toISOString().split('T')[0];
        console.log(`📆 Project Start Date (dari day_gantt_data): ${currentProject.startDate}`);

        const msPerDay = 1000 * 60 * 60 * 24;

        // Group ranges by category
        dayGanttDataArray.forEach(entry => {
            const kategori = entry.Kategori;
            if (!kategori) return;

            const hAwalStr = entry.h_awal;
            const hAkhirStr = entry.h_akhir;

            if (!hAwalStr || !hAkhirStr) return;

            const startDate = parseDateDDMMYYYY(hAwalStr);
            const endDate = parseDateDDMMYYYY(hAkhirStr);

            if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                return;
            }

            const startDay = Math.round((startDate - projectStartDate) / msPerDay) + 1;
            const endDay = Math.round((endDate - projectStartDate) / msPerDay) + 1;
            const duration = endDay - startDay + 1;

            if (!categoryRangesMap[kategori]) {
                categoryRangesMap[kategori] = [];
            }

            // Parse keterlambatan value
            const keterlambatanValue = parseInt(entry.keterlambatan, 10) || 0;

            categoryRangesMap[kategori].push({
                start: startDay > 0 ? startDay : 1,
                end: endDay > 0 ? endDay : 1,
                duration: duration > 0 ? duration : 1,
                keterlambatan: keterlambatanValue,
                hAwal: hAwalStr,
                hAkhir: hAkhirStr
            });
        });

        console.log("📊 Category Ranges Map:", categoryRangesMap);
    } else {
        // No day_gantt_data, use current date as start
        earliestDate = new Date();
        currentProject.startDate = earliestDate.toISOString().split('T')[0];
        console.log(`📆 Project Start Date (default): ${currentProject.startDate}`);
    }

    // Build dynamic tasks with ranges from day_gantt_data
    tempTaskList.forEach(item => {
        // Find matching ranges by normalizing category names
        const normalizedName = item.name.toLowerCase().trim();
        let ranges = [];

        // Try to find ranges by matching category name
        for (const [kategori, rangeArray] of Object.entries(categoryRangesMap)) {
            const normalizedKategori = kategori.toLowerCase().trim();
            if (normalizedName === normalizedKategori ||
                normalizedName.includes(normalizedKategori) ||
                normalizedKategori.includes(normalizedName)) {
                ranges = rangeArray;
                break;
            }
        }

        // Calculate total duration from all ranges
        let totalDuration = 0;
        let minStart = 0;

        if (ranges.length > 0) {
            totalDuration = ranges.reduce((sum, r) => sum + r.duration, 0);
            minStart = Math.min(...ranges.map(r => r.start));
        }

        dynamicTasks.push({
            id: item.id,
            name: item.name,
            start: minStart,
            duration: totalDuration,
            dependencies: [],
            keterlambatan: item.keterlambatan || 0,
            inputData: {
                ranges: ranges
            }
        });
    });

    currentTasks = dynamicTasks;
    projectTasks[selectedValue] = currentTasks;

    console.log(`✅ Data API berhasil diparsing: ${currentTasks.length} tahapan ditemukan.`);
}

// Helper function to parse DD/MM/YYYY date format
function parseDateDDMMYYYY(dateStr) {
    if (!dateStr) return null;

    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const year = parseInt(parts[2], 10);

    const date = new Date(year, month, day);
    return isNaN(date.getTime()) ? null : date;
}

// ==================== RENDER API DATA ====================
function renderApiData() {
    const container = document.getElementById('apiData');
    if (!container) return;

    if (isLoadingGanttData) {
        container.innerHTML = `
            <div class="api-card">
                <div class="api-card-title">Memuat data...</div>
                <div class="api-row">Mohon tunggu sebentar.</div>
            </div>`;
        return;
    }

    if (ganttApiError) {
        container.innerHTML = `
            <div class="api-card api-error">
                <div class="api-card-title">Gagal memuat data</div>
                <div class="api-row">${escapeHtml(ganttApiError)}</div>
            </div>`;
        return;
    }

    if (!currentProject) {
        container.innerHTML = '';
        return;
    }

    if (isProjectLocked) {
        container.innerHTML = `
            <div class="api-card" style="border: 2px solid #48bb78; background: #f0fff4;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <h3 style="color: #2f855a; margin: 0 0 5px 0;">✅ Jadwal Terkunci</h3>
                        <p style="margin: 0; color: #276749;">Data jadwal sudah diterbitkan dan tidak dapat diubah.</p>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('exportButtons').style.display = 'flex';
        return;
    }

    let html = '<div class="api-card task-input-card">';
    html += '<div class="api-card-title">Input Pengerjaan Tahapan (Multi Range)</div>';
    html += '<div class="task-input-container">';

    currentTasks.forEach((task) => {
        const taskData = task.inputData || { ranges: [] };
        const ranges = taskData.ranges || [];

        html += `
            <div class="task-input-row-multi" id="task-row-${task.id}">
                <div class="task-input-label-multi">${escapeHtml(task.name)}</div>
                <div class="task-ranges-container" id="ranges-${task.id}">
        `;

        if (ranges.length > 0) {
            ranges.forEach((range, idx) => {
                html += `
                    <div class="range-input-group" data-range-idx="${idx}">
                        <div class="input-group">
                            <label>H</label>
                            <input type="number" class="task-day-input" 
                                   data-task-id="${task.id}" 
                                   data-type="start" 
                                   data-range-idx="${idx}"
                                   value="${range.start || 0}" min="0">
                        </div>
                        <span class="input-separator">s/d</span>
                        <div class="input-group">
                            <label>H</label>
                            <input type="number" class="task-day-input" 
                                   data-task-id="${task.id}" 
                                   data-type="end" 
                                   data-range-idx="${idx}"
                                   value="${range.end || 0}" min="0">
                        </div>
                        <button class="btn-remove-range" onclick="removeRange(${task.id}, ${idx})" title="Hapus range">×</button>
                    </div>
                `;
            });
        } else {
            html += `
                <div class="range-input-group" data-range-idx="0">
                    <div class="input-group">
                        <label>H</label>
                        <input type="number" class="task-day-input" 
                               data-task-id="${task.id}" 
                               data-type="start" 
                               data-range-idx="0"
                               value="0" min="0">
                    </div>
                    <span class="input-separator">s/d</span>
                    <div class="input-group">
                        <label>H</label>
                        <input type="number" class="task-day-input" 
                               data-task-id="${task.id}" 
                               data-type="end" 
                               data-range-idx="0"
                               value="0" min="0">
                    </div>
                    <button class="btn-remove-range" onclick="removeRange(${task.id}, 0)" title="Hapus range">×</button>
                </div>
            `;
        }

        html += `
                </div>
                <button class="btn-add-range" onclick="addRange(${task.id})">+ Tambah Hari</button>
            </div>
        `;
    });

    html += '</div>';
    html += `
        <div class="task-input-actions">
            <button class="btn-apply-schedule" onclick="applyTaskSchedule()">Terapkan Jadwal</button>
            <button class="btn-reset-schedule" onclick="resetTaskSchedule()">Reset</button>
        </div>
        <div class="task-input-actions" style="border-top: none; padding-top: 0;">
            <button class="btn-publish" onclick="confirmAndPublish()">🔒 Kunci Jadwal</button>
        </div>
    `;
    html += '</div>';
    container.innerHTML = html;
}

// ==================== ADD/REMOVE RANGE FUNCTIONS ====================
function addRange(taskId) {
    const rangesContainer = document.getElementById(`ranges-${taskId}`);
    const existingRanges = rangesContainer.querySelectorAll('.range-input-group');
    const newIdx = existingRanges.length;

    const newRangeHTML = `
        <div class="range-input-group" data-range-idx="${newIdx}">
            <div class="input-group">
                <label>H</label>
                <input type="number" class="task-day-input" 
                       data-task-id="${taskId}" 
                       data-type="start" 
                       data-range-idx="${newIdx}"
                       value="0" min="0">
            </div>
            <span class="input-separator">s/d</span>
            <div class="input-group">
                <label>H</label>
                <input type="number" class="task-day-input" 
                       data-task-id="${taskId}" 
                       data-type="end" 
                       data-range-idx="${newIdx}"
                       value="0" min="0">
            </div>
            <button class="btn-remove-range" onclick="removeRange(${taskId}, ${newIdx})" title="Hapus range">×</button>
        </div>
    `;

    rangesContainer.insertAdjacentHTML('beforeend', newRangeHTML);
}

function removeRange(taskId, rangeIdx) {
    const rangesContainer = document.getElementById(`ranges-${taskId}`);
    const rangeElements = rangesContainer.querySelectorAll('.range-input-group');

    if (rangeElements.length <= 1) {
        alert('Minimal harus ada satu range hari!');
        return;
    }

    const targetRange = rangesContainer.querySelector(`[data-range-idx="${rangeIdx}"]`);
    if (targetRange) {
        targetRange.remove();

        const remainingRanges = rangesContainer.querySelectorAll('.range-input-group');
        remainingRanges.forEach((range, newIdx) => {
            range.setAttribute('data-range-idx', newIdx);
            range.querySelectorAll('input').forEach(input => {
                input.setAttribute('data-range-idx', newIdx);
            });
            const removeBtn = range.querySelector('.btn-remove-range');
            if (removeBtn) {
                removeBtn.setAttribute('onclick', `removeRange(${taskId}, ${newIdx})`);
            }
        });
    }
}

// ==================== CHANGE ULOK (SELECT PROJECT) ====================
async function changeUlok() {
    const ulokSelect = document.getElementById('ulokSelect');
    const selectedUlok = ulokSelect.value;

    if (!selectedUlok) {
        currentProject = null;
        currentTasks = [];
        hasUserInput = false;
        showSelectProjectMessage();
        return;
    }

    currentProject = projects.find(p => p.ulok === selectedUlok);
    currentTasks = projectTasks[selectedUlok];
    hasUserInput = false;
    isProjectLocked = false;

    fetchGanttDataForSelection(selectedUlok);

    renderProjectInfo();
    updateStats();
    document.getElementById('exportButtons').style.display = 'none';
}

// ==================== LOGIC SIMPAN & KUNCI ====================
function confirmAndPublish() {
    const totalDuration = currentTasks.reduce((acc, t) => acc + t.duration, 0);
    if (totalDuration === 0) {
        alert("⚠️ Jadwal masih kosong. Mohon isi durasi dan klik 'Terapkan Jadwal' terlebih dahulu.");
        return;
    }

    const isSure = confirm(
        "KONFIRMASI PENGUNCIAN JADWAL\n\n" +
        "Apakah Anda yakin ingin MENGUNCI jadwal ini?\n" +
        "Setelah dikunci, inputan akan hilang dan data tidak dapat diubah lagi.\n\n" +
        "Lanjutkan?"
    );

    if (isSure) {
        saveProjectSchedule("Terkunci");
    }
}

async function saveProjectSchedule(statusType = "Active") {
    if (!currentProject) return;

    const userEmail = sessionStorage.getItem('loggedInUserEmail') || "user@unknown.com";

    // Pastikan data project lengkap, gunakan fallback jika ulokClean kosong
    const cleanUlok = currentProject.ulokClean || currentProject.ulok || "-";
    const cleanWork = (currentProject.work || "Sipil").toUpperCase();

    if (!cleanUlok) {
        alert("⚠️ Data proyek tidak lengkap (No Ulok Hilang). Silakan refresh halaman.");
        return;
    }

    const isLocking = statusType === "Terkunci";
    const loadingText = isLocking ? "🔒 Mengunci..." : "💾 Menyimpan...";

    // 1. Siapkan Payload Utama (Gantt Data)
    const payload = {
        "Nomor Ulok": cleanUlok,
        "Lingkup_Pekerjaan": cleanWork,
        "Status": statusType,
        "Email_Pembuat": userEmail,
        "Proyek": currentProject.projectType || "Reguler",
        "Alamat": currentProject.alamat || "-",
        "Cabang": currentProject.cabang || "-",
        "Nama_Toko": currentProject.store || "-",
        "Nama_Kontraktor": "PT KONTRAKTOR",
    };

    const projectStartDate = new Date(currentProject.startDate);
    const formatDateISO = (date) => date.toISOString().split('T')[0];
    const formatDateDDMMYYYY = (date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Isi payload utama (flat columns untuk kebutuhan view)
    currentTasks.forEach((task) => {
        const ranges = task.inputData?.ranges || [];
        if (ranges.length > 0) {
            const firstRange = ranges[0];
            const lastRange = ranges[ranges.length - 1];

            const tStart = new Date(projectStartDate);
            tStart.setDate(projectStartDate.getDate() + (firstRange.start - 1));

            const tEnd = new Date(projectStartDate);
            tEnd.setDate(projectStartDate.getDate() + (lastRange.end - 1));

            payload[`Kategori_${task.id}`] = task.name;
            payload[`Hari_Mulai_Kategori_${task.id}`] = formatDateISO(tStart);
            payload[`Hari_Selesai_Kategori_${task.id}`] = formatDateISO(tEnd);
            payload[`Keterlambatan_Kategori_${task.id}`] = "0";
        }
    });

    const btnTarget = isLocking
        ? document.querySelector('.btn-publish')
        : document.querySelector('.btn-apply-schedule');

    const originalText = btnTarget ? btnTarget.innerText : (isLocking ? 'Kunci Jadwal' : 'Terapkan Jadwal');

    if (btnTarget) {
        btnTarget.innerText = loadingText;
        btnTarget.disabled = true;
    }

    // 2. Siapkan Payload Detail Harian (FIXED BUG DISINI)
    // Menggunakan array baru untuk setiap entry guna menghindari referensi kosong
    const dayInsertPayload = [];

    currentTasks.forEach((task) => {
        const taskName = String(task.name); // Pastikan nama task string
        const ranges = task.inputData?.ranges || [];

        // Loop setiap range di task tersebut
        ranges.forEach((range) => {
            const startDay = parseInt(range.start) || 0;
            const endDay = parseInt(range.end) || 0;

            if (startDay > 0 && endDay > 0) {
                // Hitung tanggal real
                const rangeStart = new Date(projectStartDate.getTime());
                rangeStart.setDate(projectStartDate.getDate() + (startDay - 1));

                const rangeEnd = new Date(projectStartDate.getTime());
                rangeEnd.setDate(projectStartDate.getDate() + (endDay - 1));

                // BENTUK OBJECT BARU SECARA EKSPLISIT
                // Memastikan variabel cleanUlok dan cleanWork masuk ke setiap baris
                const rowEntry = {
                    "Nomor Ulok": cleanUlok,
                    "Lingkup_Pekerjaan": cleanWork,
                    "Kategori": taskName,
                    "h_awal": formatDateDDMMYYYY(rangeStart),
                    "h_akhir": formatDateDDMMYYYY(rangeEnd)
                };

                // Validasi data sebelum push (opsional tapi disarankan)
                if (rowEntry["Nomor Ulok"] && rowEntry["Kategori"]) {
                    dayInsertPayload.push(rowEntry);
                }
            }
        });
    });

    try {
        console.log(`📤 Mengirim Data Utama (${statusType}):`, payload);

        // Kirim data utama dulu
        const response = await fetch(ENDPOINTS.insertData, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || 'Gagal menyimpan data ke server');
        }

        // Kirim data harian (jika ada)
        if (dayInsertPayload.length > 0) {
            console.log(`📤 Mengirim ${dayInsertPayload.length} baris ke Day Insert Endpoint...`);
            console.log("🔍 Sample Data:", JSON.stringify(dayInsertPayload[0])); // Debug sample

            const dayResponse = await fetch(ENDPOINTS.dayInsert, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dayInsertPayload)
            });

            const dayResult = await dayResponse.json();

            if (!dayResponse.ok) {
                console.warn('⚠️ Gagal insert data harian:', dayResult.message);
            } else {
                console.log('✅ Day insert berhasil:', dayResult);
            }
        }

        if (isLocking) {
            alert("✅ Sukses! Jadwal telah DIKUNCI.");
            isProjectLocked = true;
        } else {
            alert("✅ Data tersimpan sebagai 'Active'.");
            isProjectLocked = false;
        }

        renderApiData();
        renderChart();

    } catch (error) {
        console.error("❌ Error saving:", error);
        alert(`Gagal menyimpan (${statusType}): ` + error.message);
    } finally {
        if (btnTarget) {
            btnTarget.innerText = originalText;
            btnTarget.disabled = false;
        }
    }
}

// ==================== TASK MANIPULATION ====================
function applyTaskSchedule(silentMode = false) {
    if (!currentProject || !currentTasks.length) return false;

    let hasError = false;
    const updatedTasks = [];

    for (const task of currentTasks) {
        const rangesContainer = document.getElementById(`ranges-${task.id}`);
        if (!rangesContainer) {
            updatedTasks.push(task);
            continue;
        }

        const rangeElements = rangesContainer.querySelectorAll('.range-input-group');
        const ranges = [];
        let totalDuration = 0;
        let minStart = Infinity;

        rangeElements.forEach((rangeEl, rangeIndex) => {
            const startInput = rangeEl.querySelector('[data-type="start"]');
            const endInput = rangeEl.querySelector('[data-type="end"]');

            const startDay = parseInt(startInput.value) || 0;
            const endDay = parseInt(endInput.value) || 0;

            console.log(`📊 Task ${task.name} - Range ${rangeIndex}: start=${startDay}, end=${endDay}`);

            if (startDay === 0 && endDay === 0) {
                console.log(`   ⏭️ Skipping empty range`);
                return;
            }

            if (endDay < startDay) {
                alert(`Error pada ${task.name}: Hari selesai (${endDay}) tidak boleh lebih kecil dari hari mulai (${startDay})!`);
                hasError = true;
                return;
            }

            const duration = endDay - startDay + 1;
            totalDuration += duration;

            if (startDay < minStart) {
                minStart = startDay;
            }

            ranges.push({ start: startDay, end: endDay, duration });
            console.log(`   ✅ Range added:`, { start: startDay, end: endDay, duration });
        });

        if (hasError) break;

        updatedTasks.push({
            ...task,
            start: minStart === Infinity ? 0 : minStart,
            duration: totalDuration,
            inputData: { ranges }
        });
    }

    if (hasError) return false;

    currentTasks = updatedTasks;
    projectTasks[currentProject.ulok] = updatedTasks;
    hasUserInput = true;

    renderChart();
    updateStats();
    document.getElementById('exportButtons').style.display = 'flex';

    if (!silentMode) {
        document.getElementById('ganttChart').scrollIntoView({ behavior: 'smooth' });
        saveProjectSchedule("Active");
    }

    return true;
}

function resetTaskSchedule() {
    if (!currentProject || !currentTasks) return;
    currentTasks.forEach(task => {
        task.start = 0;
        task.duration = 0;
        task.inputData = { ranges: [] };
    });
    hasUserInput = false;
    renderApiData();
    showPleaseInputMessage();
    if (typeof updateStats === 'function') {
        updateStats();
    }
}

// ==================== HELPER API DATA (RAB) ====================
function updateProjectFromRab(rabData) {
    if (!rabData || !currentProject) return;
    const getFirstNonEmpty = (keys) => {
        for (const key of keys) {
            const val = rabData[key];
            if (val !== undefined && val !== null && String(val).trim() !== '') return val;
        }
        return undefined;
    };
    const alamat = getFirstNonEmpty(['Alamat', 'alamat']);
    if (alamat) currentProject.alamat = alamat;
    const cabang = getFirstNonEmpty(['Cabang', 'cabang']);
    if (cabang) currentProject.cabang = cabang;
    const storeVal = getFirstNonEmpty(['Nama Toko', 'Store', 'Nama_Toko']);
    if (storeVal) currentProject.store = storeVal;
}

// ==================== RENDERING (INFO & STATS) ====================
function renderProjectInfo() {
    if (!currentProject) return;
    const info = document.getElementById('projectInfo');

    let html = `
        <div class="project-detail">
            <div class="project-label">No. Ulok</div>
            <div class="project-value">${currentProject.ulokClean || currentProject.ulok}</div>
        </div>
        <div class="project-detail">
            <div class="project-label">Jenis Proyek</div>
            <div class="project-value">${currentProject.projectType}</div>
        </div>
        <div class="project-detail">
            <div class="project-label">Nama Toko</div>
            <div class="project-value">${currentProject.store}</div>
        </div>
        <div class="project-detail">
            <div class="project-label">Lingkup Pekerjaan</div>
            <div class="project-value">${currentProject.work}</div>
        </div>
        <div class="project-detail">
            <div class="project-label">Cabang</div>
            <div class="project-value">${currentProject.cabang}</div>
        </div>
    `;
    info.innerHTML = html;
}

function updateStats() {
    if (!currentProject) return;

    // Count tasks that have ranges or duration > 0
    const inputedTasks = currentTasks.filter(t => {
        const hasRanges = t.inputData && t.inputData.ranges && t.inputData.ranges.length > 0;
        return t.duration > 0 || hasRanges;
    });
    const totalInputed = inputedTasks.length;

    let maxEnd = 0;
    if (inputedTasks.length > 0) {
        inputedTasks.forEach(task => {
            if (task.inputData && task.inputData.ranges) {
                task.inputData.ranges.forEach(range => {
                    if (range.end > maxEnd) {
                        maxEnd = range.end;
                    }
                });
            }
        });
    }
    const stats = document.getElementById('stats');
    stats.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${currentTasks.length}</div>
            <div class="stat-label">Total Tahapan</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${totalInputed}</div>
            <div class="stat-label">Tahapan Terinput</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${maxEnd}</div>
            <div class="stat-label">Estimasi Selesai (hari)</div>
        </div>
    `;
}

// ==================== CHART RENDERING ====================
function renderChart() {
    if (!currentProject) return;
    const chart = document.getElementById('ganttChart');
    const DAY_WIDTH = 40;

    let maxTaskEndDay = 0;
    currentTasks.forEach(task => {
        if (task.inputData && task.inputData.ranges) {
            task.inputData.ranges.forEach(range => {
                if (range.end > maxTaskEndDay) {
                    maxTaskEndDay = range.end;
                }
            });
        }
    });

    const totalDaysToRender = Math.max(
        (currentProject.work === 'ME' ? totalDaysME : totalDaysSipil),
        maxTaskEndDay + 10
    );

    const totalChartWidth = totalDaysToRender * DAY_WIDTH;
    const projectStartDate = new Date(currentProject.startDate);

    // Render Header dengan supervision day highlighting
    let html = '<div class="chart-header">';
    html += '<div class="task-column">Tahapan</div>';
    html += `<div class="timeline-column" style="width: ${totalChartWidth}px;">`;
    for (let i = 0; i < totalDaysToRender; i++) {
        const currentDate = new Date(projectStartDate);
        currentDate.setDate(projectStartDate.getDate() + i);

        const dayNumber = i + 1;
        const isSupervisionDay = supervisionDays[dayNumber] === true;
        const supervisionClass = isSupervisionDay ? "supervision-active" : "";

        html += `
                <div class="day-header ${supervisionClass}" 
                    style="width: ${DAY_WIDTH}px; box-sizing: border-box;"
                    title="${isSupervisionDay ? "Hari Pengawasan" : ""}">
                    <span class="d-date" style="font-weight:bold; font-size:14px;">${dayNumber}</span>
                </div>
            `;
    }
    html += "</div></div>";
    html += '<div class="chart-body">';

    currentTasks.forEach(task => {
        const ranges = task.inputData?.ranges || [];

        // Skip tasks that have no ranges/bars to display
        if (ranges.length === 0 && task.duration === 0) return;

        const keterlambatan = task.keterlambatan || 0;

        // Calculate total duration from ranges if not set
        const totalDuration = task.duration > 0 ? task.duration :
            ranges.reduce((sum, r) => sum + (r.duration || 0), 0);

        // Calculate total delay from all ranges
        const totalRangeDelay = ranges.reduce((sum, r) => sum + (r.keterlambatan || 0), 0);
        const displayDelay = totalRangeDelay > 0 ? totalRangeDelay : keterlambatan;

        html += '<div class="task-row">';
        html += `<div class="task-name">
            <span>${task.name}</span>
            <span class="task-duration">Total Durasi: ${totalDuration} hari${displayDelay > 0 ? ` <span style="color: #e53e3e;">(+${displayDelay} hari delay)</span>` : ''}</span>
        </div>`;
        html += `<div class="timeline" style="width: ${totalChartWidth}px;">`;

        ranges.forEach((range, idx) => {
            const leftPos = (range.start - 1) * DAY_WIDTH;
            const widthPos = (range.duration * DAY_WIDTH) - 1;

            const tStart = new Date(projectStartDate);
            tStart.setDate(projectStartDate.getDate() + (range.start - 1));
            const tEnd = new Date(tStart);
            tEnd.setDate(tStart.getDate() + range.duration - 1);

            // Determine bar color based on delay
            const hasDelay = range.keterlambatan && range.keterlambatan > 0;
            const barClass = hasDelay ? "bar on-time has-delay" : "bar on-time";
            const barStyle = hasDelay
                ? `left: ${leftPos}px; width: ${widthPos}px; box-sizing: border-box; border: 2px solid #e53e3e;`
                : `left: ${leftPos}px; width: ${widthPos}px; box-sizing: border-box;`;

            html += `<div class="${barClass}" data-task-id="${task.id}-${idx}" 
                    style="${barStyle}" 
                    title="${task.name} (Range ${idx + 1}): ${formatDateID(tStart)} - ${formatDateID(tEnd)}${hasDelay ? ` | Keterlambatan: +${range.keterlambatan} hari` : ''}">
                ${range.duration}
            </div>`;

            // Render delay bar immediately after this range if it has delay
            if (range.keterlambatan && range.keterlambatan > 0) {
                const delayLeftPos = range.end * DAY_WIDTH;
                const delayWidthPos = range.keterlambatan * DAY_WIDTH - 1;
                const tEndWithDelay = new Date(tEnd);
                tEndWithDelay.setDate(tEnd.getDate() + range.keterlambatan);

                html += `<div class="bar delayed" data-task-id="${task.id}-${idx}-delay"
                        style="left: ${delayLeftPos}px; width: ${delayWidthPos}px; box-sizing: border-box; background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%); opacity: 0.85;"
                        title="Keterlambatan ${task.name} (Range ${idx + 1}): +${range.keterlambatan} hari (s/d ${formatDateID(tEndWithDelay)})">
                    +${range.keterlambatan}
                </div>`;
            }
        });

        // Legacy: Bar keterlambatan dari task level (jika tidak ada delay per range)
        if (keterlambatan > 0 && totalRangeDelay === 0 && ranges.length > 0) {
            const lastRange = ranges[ranges.length - 1];
            const lastEnd = new Date(projectStartDate);
            lastEnd.setDate(projectStartDate.getDate() + lastRange.end - 1);

            const delayLeftPos = (lastRange.end) * DAY_WIDTH;
            const delayWidthPos = (keterlambatan * DAY_WIDTH) - 1;
            const tEndWithDelay = new Date(lastEnd);
            tEndWithDelay.setDate(lastEnd.getDate() + keterlambatan);

            html += `<div class="bar delayed" data-task-id="${task.id}-delay" 
                    style="left: ${delayLeftPos}px; width: ${delayWidthPos}px; box-sizing: border-box; background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%);" 
                    title="Keterlambatan ${task.name}: +${keterlambatan} hari (s/d ${formatDateID(tEndWithDelay)})">
                +${keterlambatan}
            </div>`;
        }

        html += '</div></div>';
    });
    html += '</div>';
    chart.innerHTML = html;
    setTimeout(drawDependencyLines, 50);
}

function drawDependencyLines() {
    const existingSvg = document.querySelector('.dependency-svg');
    if (existingSvg) existingSvg.remove();

    const chartBody = document.querySelector('.chart-body');
    if (!chartBody) return;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('dependency-svg');
    svg.style.width = `${chartBody.scrollWidth}px`;
    svg.style.height = `${chartBody.scrollHeight}px`;
    chartBody.appendChild(svg);
    const bodyRect = chartBody.getBoundingClientRect();

    currentTasks.forEach(task => {
        if (task.dependencies && task.dependencies.length > 0) {
            task.dependencies.forEach(depId => {
                const fromBar = document.querySelector(`.bar[data-task-id="${depId}"]`);
                const toBar = document.querySelector(`.bar[data-task-id="${task.id}"]`);
                if (fromBar && toBar) {
                    const r1 = fromBar.getBoundingClientRect();
                    const r2 = toBar.getBoundingClientRect();
                    const x1 = (r1.right - bodyRect.left) + chartBody.scrollLeft;
                    const y1 = (r1.top + r1.height / 2 - bodyRect.top) + chartBody.scrollTop;
                    const x2 = (r2.left - bodyRect.left) + chartBody.scrollLeft;
                    const y2 = (r2.top + r2.height / 2 - bodyRect.top) + chartBody.scrollTop;

                    const d = `M ${x1} ${y1} C ${x1 + 20} ${y1}, ${x2 - 20} ${y2}, ${x2} ${y2}`;
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('d', d);
                    path.classList.add('dependency-line');
                    svg.appendChild(path);
                }
            });
        }
    });
}

// ==================== EXPORT EXCEL ====================
function exportToExcel() {
    if (!currentProject || !currentTasks.length) return;
    const startDate = new Date(currentProject.startDate);
    const data = [
        ["Laporan Jadwal Proyek"],
        ["No. Ulok", currentProject.ulok],
        ["Nama Toko", currentProject.store],
        ["Cabang", currentProject.cabang],
        [],
        ["No", "Tahapan", "Mulai", "Selesai", "Durasi"]
    ];
    currentTasks.forEach((task, i) => {
        if (task.duration === 0) return;
        const ranges = task.inputData?.ranges || [];
        if (ranges.length > 0) {
            const firstRange = ranges[0];
            const lastRange = ranges[ranges.length - 1];

            const tStart = new Date(startDate);
            tStart.setDate(startDate.getDate() + (firstRange.start - 1));
            const tEnd = new Date(startDate);
            tEnd.setDate(startDate.getDate() + (lastRange.end - 1));

            data.push([i + 1, task.name, formatDateID(tStart), formatDateID(tEnd), task.duration]);
        }
    });
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jadwal");
    XLSX.writeFile(wb, `Jadwal_${currentProject.ulokClean}.xlsx`);
}

// ==================== SUPERVISION DAY HANDLING ====================
// Parse Pengawasan_1 to Pengawasan_10 from gantt_data
function parseSupervisionFromGanttData(ganttData) {
    if (!ganttData) return;

    supervisionDays = {}; // Reset supervision days

    // Check Pengawasan_1 to Pengawasan_10
    for (let i = 1; i <= 10; i++) {
        const key = `Pengawasan_${i}`;
        const value = ganttData[key];

        if (value !== undefined && value !== null && value !== "") {
            // Value contains the day number
            const dayNum = Number.parseInt(value, 10);
            if (!isNaN(dayNum) && dayNum > 0) {
                supervisionDays[dayNum] = true;
                console.log(`👁️ Pengawasan found: Day ${dayNum} (from ${key})`);
            }
        }
    }

    console.log("📋 Supervision days loaded:", supervisionDays);
}

// ==================== START ====================
loadDataAndInit();
window.addEventListener('resize', () => {
    if (currentProject && hasUserInput) drawDependencyLines();
});