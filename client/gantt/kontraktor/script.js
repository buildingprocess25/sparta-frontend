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

            parseGanttDataToTasks(ganttData, selectedValue);
            hasUserInput = true;

        } else {
            console.warn("⚠️ Response API valid, tetapi tidak memiliki properti 'gantt_data'.");
            throw new Error("Format data API tidak valid: 'gantt_data' hilang.");
        }

    } catch (error) {
        console.warn('⚠️ Menggunakan template default:', error.message);
        ganttApiError = null;

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

        if (hasUserInput && currentTasks.length > 0) {
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
function parseGanttDataToTasks(ganttData, selectedValue) {
    if (!currentProject || !ganttData) return;

    let dynamicTasks = [];
    let earliestDate = null;
    let tempTaskList = [];
    let i = 1;

    while (true) {
        const kategoriKey = `Kategori_${i}`;
        const mulaiKey = `Hari_Mulai_Kategori_${i}`;
        const selesaiKey = `Hari_Selesai_Kategori_${i}`;
        const keterlambatanKey = `Keterlambatan_Kategori_${i}`;

        if (!ganttData.hasOwnProperty(kategoriKey)) {
            break;
        }

        const kategoriName = ganttData[kategoriKey];
        const hariMulai = ganttData[mulaiKey];
        const hariSelesai = ganttData[selesaiKey];
        const keterlambatan = parseInt(ganttData[keterlambatanKey]) || 0;

        if (kategoriName) {
            let sDate = null;
            if (hariMulai && hariMulai.trim() !== '') {
                sDate = new Date(hariMulai);
                if (!isNaN(sDate.getTime())) {
                    if (!earliestDate || sDate < earliestDate) {
                        earliestDate = sDate;
                    }
                }
            }

            tempTaskList.push({
                id: i,
                name: kategoriName,
                rawStart: sDate,
                rawEnd: hariSelesai ? new Date(hariSelesai) : null,
                keterlambatan: keterlambatan
            });
        }
        i++;
    }

    if (!earliestDate) {
        earliestDate = new Date();
    }

    const projectStartDate = earliestDate;
    currentProject.startDate = projectStartDate.toISOString().split('T')[0];
    console.log(`📆 Project Start Date (dari gantt_data): ${currentProject.startDate}`);
    const msPerDay = 1000 * 60 * 60 * 24;

    tempTaskList.forEach(item => {
        let startDay = 0;
        let duration = 0;
        let endDay = 0;

        if (item.rawStart && item.rawEnd && !isNaN(item.rawStart) && !isNaN(item.rawEnd)) {
            const diffStartMs = item.rawStart - projectStartDate;
            const diffEndMs = item.rawEnd - projectStartDate;

            startDay = Math.round(diffStartMs / msPerDay) + 1;
            endDay = Math.round(diffEndMs / msPerDay) + 1;
            duration = endDay - startDay + 1;
        }

        dynamicTasks.push({
            id: item.id,
            name: item.name,
            start: startDay > 0 ? startDay : 0,
            duration: duration > 0 ? duration : 0,
            dependencies: [],
            keterlambatan: item.keterlambatan || 0,
            inputData: {
                ranges: startDay > 0 ? [{ start: startDay, end: endDay, duration: duration }] : []
            }
        });
    });
    currentTasks = dynamicTasks;
    projectTasks[selectedValue] = currentTasks;

    console.log(`✅ Data API berhasil diparsing: ${currentTasks.length} tahapan ditemukan.`);
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

    if (!currentProject.ulokClean || !currentProject.work) {
        alert("⚠️ Data proyek tidak lengkap. Silakan refresh halaman.");
        return;
    }

    const isLocking = statusType === "Terkunci";
    const loadingText = isLocking ? "🔒 Mengunci..." : "💾 Menyimpan...";

    const payload = {
        "Nomor Ulok": currentProject.ulokClean,
        "Lingkup_Pekerjaan": currentProject.work.toUpperCase(),
        "Status": statusType,
        "Email_Pembuat": userEmail,
        "Proyek": currentProject.projectType || "Reguler",
        "Alamat": currentProject.alamat || "-",
        "Cabang": currentProject.cabang || "-",
        "Nama_Toko": currentProject.store || "-",
        "Nama_Kontraktor": "PT KONTRAKTOR",
    };

    const projectStartDate = new Date(currentProject.startDate);

    currentTasks.forEach((task) => {
        const ranges = task.inputData?.ranges || [];
        
        if (ranges.length > 0) {
            const firstRange = ranges[0];
            const lastRange = ranges[ranges.length - 1];
            
            const tStart = new Date(projectStartDate);
            tStart.setDate(projectStartDate.getDate() + (firstRange.start - 1));
            
            const tEnd = new Date(projectStartDate);
            tEnd.setDate(projectStartDate.getDate() + (lastRange.end - 1));
            
            const formatDateISO = (date) => date.toISOString().split('T')[0];
            
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

    // Build payload for day insert endpoint (massive data format)
    const dayInsertPayload = [];
    const formatDateDDMMYYYY = (date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    currentTasks.forEach((task) => {
        const ranges = task.inputData?.ranges || [];
        
        ranges.forEach((range) => {
            if (range.start > 0 && range.end > 0) {
                const rangeStart = new Date(projectStartDate);
                rangeStart.setDate(projectStartDate.getDate() + (range.start - 1));
                
                const rangeEnd = new Date(projectStartDate);
                rangeEnd.setDate(projectStartDate.getDate() + (range.end - 1));
                
                dayInsertPayload.push({
                    "Nomor Ulok": currentProject.ulokClean,
                    "Lingkup_Pekerjaan": currentProject.work.toUpperCase(),
                    "Kategori": task.name,
                    "h_awal": formatDateDDMMYYYY(rangeStart),
                    "h_akhir": formatDateDDMMYYYY(rangeEnd)
                });
            }
        });
    });

    try {
        console.log(`📤 Mengirim Data (${statusType}):`, payload);
        console.log(`📤 Mengirim Day Insert Data:`, dayInsertPayload);

        // Send to main gantt insert endpoint
        const response = await fetch(ENDPOINTS.insertData, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Gagal menyimpan data ke server');
        }

        // Send to day insert endpoint if there's data
        if (dayInsertPayload.length > 0) {
            console.log(`📤 Mengirim ke Day Insert Endpoint...`);
            const dayResponse = await fetch(ENDPOINTS.dayInsert, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dayInsertPayload)
            });

            const dayResult = await dayResponse.json();

            if (!dayResponse.ok) {
                console.warn('⚠️ Day insert warning:', dayResult.message || 'Gagal menyimpan data hari');
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

        rangeElements.forEach(rangeEl => {
            const startInput = rangeEl.querySelector('[data-type="start"]');
            const endInput = rangeEl.querySelector('[data-type="end"]');
            
            const startDay = parseInt(startInput.value) || 0;
            const endDay = parseInt(endInput.value) || 0;

            if (startDay === 0 && endDay === 0) return;

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
    const inputedTasks = currentTasks.filter(t => t.duration > 0);
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

    let html = '<div class="chart-header">';
    html += '<div class="task-column">Tahapan</div>';
    html += `<div class="timeline-column" style="width: ${totalChartWidth}px;">`;

    for (let i = 0; i < totalDaysToRender; i++) {
        const currentDate = new Date(projectStartDate);
        currentDate.setDate(projectStartDate.getDate() + i);
        const isSunday = currentDate.getDay() === 0;
        const dayNumber = i + 1;
        
        html += `
            <div class="day-header" style="width: ${DAY_WIDTH}px; box-sizing: border-box; ${isSunday ? 'background-color:#ffe3e3;' : ''}">
                <span class="d-date" style="font-weight:bold; font-size:14px;">${dayNumber}</span>
            </div>
        `;
    }
    html += '</div></div>';
    html += '<div class="chart-body">';
    
    currentTasks.forEach(task => {
        if (task.duration === 0) return;
        
        const keterlambatan = task.keterlambatan || 0;
        const ranges = task.inputData?.ranges || [];
        
        html += '<div class="task-row">';
        html += `<div class="task-name">
            <span>${task.name}</span>
            <span class="task-duration">Total Durasi: ${task.duration} hari${keterlambatan > 0 ? ` <span style="color: #e53e3e;">(+${keterlambatan} hari delay)</span>` : ''}</span>
        </div>`;
        html += `<div class="timeline" style="width: ${totalChartWidth}px;">`;
        
        ranges.forEach((range, idx) => {
            const leftPos = (range.start - 1) * DAY_WIDTH;
            const widthPos = (range.duration * DAY_WIDTH) - 1;
            
            const tStart = new Date(projectStartDate);
            tStart.setDate(projectStartDate.getDate() + (range.start - 1));
            const tEnd = new Date(tStart);
            tEnd.setDate(tStart.getDate() + range.duration - 1);
            
            html += `<div class="bar on-time" data-task-id="${task.id}-${idx}" 
                    style="left: ${leftPos}px; width: ${widthPos}px; box-sizing: border-box;" 
                    title="${task.name} (Range ${idx + 1}): ${formatDateID(tStart)} - ${formatDateID(tEnd)}">
                ${range.duration}
            </div>`;
        });
        
        if (keterlambatan > 0 && ranges.length > 0) {
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

// ==================== START ====================
loadDataAndInit();
window.addEventListener('resize', () => {
    if (currentProject && hasUserInput) drawDependencyLines();
});