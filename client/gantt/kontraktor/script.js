const API_BASE_URL = "https://sparta-backend.onrender.com/api";
const ENDPOINTS = {
    ulokList: `${API_BASE_URL}/get_ulok_by_email`,
    ganttData: `${API_BASE_URL}/get_gantt_data`,
    insertData: `${API_BASE_URL}/gantt/insert`, // Endpoint Insert
};

let projects = [];
let currentProject = null;
let projectTasks = {};
let ganttApiData = null;
let ganttApiError = null;
let isLoadingGanttData = false;
let hasUserInput = false; // Track apakah user sudah input jadwal
let isProjectLocked = false; // Track status dikunci/belum

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
    { id: 15, name: 'Pekerjaan Tambahan', start: 0, duration: 0, dependencies: [] },
    { id: 16, name: 'Pekerjaan SBO', start: 0, duration: 0, dependencies: [] },
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
        // Reset Template Default
        if (project.work === 'ME') {
            projectTasks[project.ulok] = JSON.parse(JSON.stringify(taskTemplateME));
        } else {
            projectTasks[project.ulok] = JSON.parse(JSON.stringify(taskTemplateSipil));
        }
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

    try {
        const response = await fetch(url);

        if (response.status === 404) {
            throw new Error("DATA_NOT_FOUND");
        }

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Error fetch');

        ganttApiData = data;

        // Update project info dari RAB jika ada
        if (currentProject && data?.rab) {
            updateProjectFromRab(data.rab);
        }

        // ==================== CEK GANTT_DATA ====================
        if (data.gantt_data && typeof data.gantt_data === 'object') {
            console.log("📊 gantt_data ditemukan di response");

            const ganttData = data.gantt_data;
            const ganttStatus = String(ganttData.Status || '').trim().toLowerCase();

            // Cek Status di gantt_data
            if (ganttStatus === 'terkunci' || ganttStatus === 'locked' || ganttStatus === 'published') {
                isProjectLocked = true;
                hasUserInput = true;
                console.log("🔒 Status Gantt: TERKUNCI");

                // Parse data kategori dari gantt_data untuk chart
                parseGanttDataToTasks(ganttData, selectedValue);

            } else {
                // Status Active - tampilkan data di input form
                isProjectLocked = false;
                console.log("🔓 Status Gantt: ACTIVE - Menampilkan data di form input");

                // Parse data kategori dari gantt_data ke input form
                parseGanttDataToTasks(ganttData, selectedValue);
                hasUserInput = true;
            }

        } else if (data.existing_tasks && Array.isArray(data.existing_tasks) && data.existing_tasks.length > 0) {
            // Fallback ke existing_tasks jika gantt_data tidak ada
            console.log("📋 Menggunakan existing_tasks");

            currentTasks = data.existing_tasks.map(t => ({
                id: t.id,
                name: t.name,
                start: t.start,
                duration: t.duration,
                dependencies: t.dependencies || [],
                inputData: { startDay: t.start, endDay: (t.start + t.duration - 1) }
            }));

            projectTasks[selectedValue] = currentTasks;
            hasUserInput = true;
            isProjectLocked = false;

        } else {
            throw new Error("DATA_EMPTY");
        }

    } catch (error) {
        console.warn('⚠️ Menggunakan template default:', error.message);
        ganttApiError = null;

        if (currentProject) {

            if (currentProject.work === 'ME') {
                currentTasks = JSON.parse(JSON.stringify(taskTemplateME));
            } else {
                currentTasks = JSON.parse(JSON.stringify(taskTemplateSipil));
            }
            projectTasks[selectedValue] = currentTasks;
            hasUserInput = false;

            isProjectLocked = false;
        }

    } finally {
        isLoadingGanttData = false;
        renderProjectInfo();

        renderApiData();

        if (hasUserInput) {
            renderChart();
        } else {
            showPleaseInputMessage();
        }
        updateStats();
    }
}

// ==================== PARSE GANTT_DATA TO TASKS ====================
function parseGanttDataToTasks(ganttData, selectedValue) {
    if (!currentProject || !ganttData) return;

    // Tentukan template berdasarkan lingkup pekerjaan
    const template = currentProject.work === 'ME'
        ? JSON.parse(JSON.stringify(taskTemplateME))
        : JSON.parse(JSON.stringify(taskTemplateSipil));

    // ==================== CARI TANGGAL PALING AWAL ====================
    let earliestDate = null;
    
    for (let i = 1; i <= template.length + 5; i++) {
        const mulaiKey = `Hari_Mulai_Kategori_${i}`;
        const hariMulai = ganttData[mulaiKey];
        
        if (hariMulai && hariMulai.trim() !== '') {
            const dateObj = new Date(hariMulai);
            if (!isNaN(dateObj.getTime())) {
                if (!earliestDate || dateObj < earliestDate) {
                    earliestDate = dateObj;
                }
            }
        }
    }

    // Jika tidak ada tanggal valid, gunakan tanggal hari ini
    if (!earliestDate) {
        earliestDate = new Date();
    }

    // Set project start date ke tanggal paling awal
    const projectStartDate = earliestDate;
    currentProject.startDate = projectStartDate.toISOString().split('T')[0];
    
    console.log(`📆 Project Start Date (dari gantt_data): ${currentProject.startDate}`);

    // ==================== PARSE SETIAP KATEGORI ====================
    template.forEach((task, index) => {
        const kategoriNum = index + 1;
        const kategoriKey = `Kategori_${kategoriNum}`;
        const mulaiKey = `Hari_Mulai_Kategori_${kategoriNum}`;
        const selesaiKey = `Hari_Selesai_Kategori_${kategoriNum}`;

        const kategoriName = ganttData[kategoriKey];
        const hariMulai = ganttData[mulaiKey];
        const hariSelesai = ganttData[selesaiKey];

        // Jika kategori kosong atau tanggal kosong, skip
        if (!kategoriName || !hariMulai || !hariSelesai || 
            hariMulai.trim() === '' || hariSelesai.trim() === '') {
            task.start = 0;
            task.duration = 0;
            task.inputData = { startDay: 0, endDay: 0 };
            return;
        }

        // Konversi tanggal ke Date object
        const startDate = new Date(hariMulai);
        const endDate = new Date(hariSelesai);

        // Validasi tanggal
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            task.start = 0;
            task.duration = 0;
            task.inputData = { startDay: 0, endDay: 0 };
            return;
        }

        // Hitung selisih hari dari project start date
        const msPerDay = 1000 * 60 * 60 * 24;
        const diffStartMs = startDate - projectStartDate;
        const diffEndMs = endDate - projectStartDate;

        const startDay = Math.round(diffStartMs / msPerDay) + 1; // H1, H2, dst
        const endDay = Math.round(diffEndMs / msPerDay) + 1;

        // Hitung durasi
        const duration = endDay - startDay + 1;

        task.start = startDay > 0 ? startDay : 1;
        task.duration = duration > 0 ? duration : 1;
        task.inputData = {
            startDay: startDay > 0 ? startDay : 1,
            endDay: endDay > 0 ? endDay : 1
        };

        console.log(`📅 ${task.name}: H${task.start} - H${task.inputData.endDay} (${task.duration} hari) | ${hariMulai} ~ ${hariSelesai}`);
    });

    currentTasks = template;
    projectTasks[selectedValue] = currentTasks;
    
    console.log(`✅ Total tasks parsed: ${currentTasks.filter(t => t.duration > 0).length}`);
}

function renderApiData() {
    const container = document.getElementById('apiData');
    if (!container) return;
    // 1. Kondisi Loading
    if (isLoadingGanttData) {
        container.innerHTML = `
            <div class="api-card">
                <div class="api-card-title">Memuat data...</div>
                <div class="api-row">Mohon tunggu sebentar.</div>
            </div>`;
        return;
    }
    // 2. Kondisi Error
    if (ganttApiError) {
        container.innerHTML = `
            <div class="api-card api-error">
                <div class="api-card-title">Gagal memuat data</div>
                <div class="api-row">${escapeHtml(ganttApiError)}</div>
            </div>`;
        return;
    }
    // 3. Kondisi Belum Pilih Proyek (PERBAIKAN DISINI)
    if (!currentProject) {
        container.innerHTML = ''; // Pastikan container dibersihkan saat reset
        return;
    }
    // 4. Kondisi TERKUNCI (Published)
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
    // 5. Kondisi Normal (Input Form)
    let html = '<div class="api-card task-input-card">';
    html += '<div class="api-card-title">Input Pengerjaan Tahapan</div>';
    html += '<div class="task-input-container">';

    currentTasks.forEach((task) => {
        const taskData = task.inputData || { startDay: 0, endDay: 0 };
        html += `
            <div class="task-input-row">
                <div class="task-input-label">${escapeHtml(task.name)}</div>
                <div class="task-input-fields">
                    <div class="input-group">
                        <label>H</label>
                        <input type="number" class="task-day-input" id="task-start-${task.id}" value="${taskData.startDay}" min="0">
                    </div>
                    <span class="input-separator">s/d</span>
                    <div class="input-group">
                        <label>H</label>
                        <input type="number" class="task-day-input" id="task-end-${task.id}" value="${taskData.endDay}" min="0">
                    </div>
                </div>
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
    // Kita set currentTasks dari template dulu, nanti di-override fetchGanttData jika ada di DB
    currentTasks = projectTasks[selectedUlok];
    hasUserInput = false;
    isProjectLocked = false; // Reset lock state

    fetchGanttDataForSelection(selectedUlok);

    renderProjectInfo();
    updateStats();
    document.getElementById('exportButtons').style.display = 'none';
}

// ==================== LOGIC SIMPAN & KUNCI (UPDATE) ====================
function confirmAndPublish() {
    // Cek apakah data sudah ada
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
        // Panggil fungsi simpan dengan status "Terkunci"
        saveProjectSchedule("Terkunci");
    }
}

async function saveProjectSchedule(statusType = "Active") {
    if (!currentProject) return;

    const userEmail = sessionStorage.getItem('loggedInUserEmail') || "user@unknown.com";

    // Validasi dasar
    if (!currentProject.ulokClean || !currentProject.work) {
        alert("⚠️ Data proyek tidak lengkap. Silakan refresh halaman.");
        return;
    }

    // Tentukan pesan sukses berdasarkan status
    const isLocking = statusType === "Terkunci";
    const loadingText = isLocking ? "🔒 Mengunci..." : "💾 Menyimpan...";

    // Siapkan Payload
    const payload = {
        "Nomor Ulok": currentProject.ulokClean,
        "Lingkup_Pekerjaan": currentProject.work.toUpperCase(),
        "Status": statusType, // <--- DINAMIS ("Active" atau "Terkunci")
        "Email_Pembuat": userEmail,
        "Proyek": currentProject.projectType || "Reguler",
        "Alamat": currentProject.alamat || "-",
        "Cabang": "HEAD OFFICE",
        "Nama_Toko": currentProject.store || "-",
        "Nama_Kontraktor": "PT KONTRAKTOR",
    };

    // Konversi Data Tahapan ke Format Tanggal
    const projectStartDate = new Date(currentProject.startDate);

    currentTasks.forEach((task) => {
        const tStart = new Date(projectStartDate);
        tStart.setDate(projectStartDate.getDate() + (task.start - 1));

        const durationToAdd = task.duration > 0 ? task.duration - 1 : 0;
        const tEnd = new Date(tStart);
        tEnd.setDate(tStart.getDate() + durationToAdd);

        const formatDateISO = (date) => date.toISOString().split('T')[0];

        payload[`Kategori_${task.id}`] = task.name;
        payload[`Hari_Mulai_Kategori_${task.id}`] = formatDateISO(tStart);
        payload[`Hari_Selesai_Kategori_${task.id}`] = formatDateISO(tEnd);
        payload[`Keterlambatan_Kategori_${task.id}`] = "0";
    });

    // Indikator Loading di Tombol yang sesuai
    const btnTarget = isLocking
        ? document.querySelector('.btn-publish')
        : document.querySelector('.btn-apply-schedule');

    const originalText = btnTarget ? btnTarget.innerText : (isLocking ? 'Kunci Jadwal' : 'Terapkan Jadwal');

    if (btnTarget) {
        btnTarget.innerText = loadingText;
        btnTarget.disabled = true;
    }

    try {
        console.log(`📤 Mengirim Data (${statusType}):`, payload);

        const response = await fetch(ENDPOINTS.insertData, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'Gagal menyimpan data ke server');
        }

        // === SUKSES ===
        if (isLocking) {
            alert("✅ Sukses! Jadwal telah DIKUNCI.");
            isProjectLocked = true; // Update state lokal jadi terkunci
        } else {
            // Jika hanya Active (Terapkan Jadwal), beri notif kecil atau alert
            alert("✅ Data tersimpan sebagai 'Active'.");
            isProjectLocked = false;
        }

        // Render ulang UI sesuai status baru
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
        const startInput = document.getElementById(`task-start-${task.id}`);
        const endInput = document.getElementById(`task-end-${task.id}`);

        if (!startInput || !endInput) {
            updatedTasks.push(task);
            continue;
        }
        const startDay = parseInt(startInput.value) || 0;
        const endDay = parseInt(endInput.value) || 0;
        if (startDay === 0 && endDay === 0) {
            updatedTasks.push({ ...task, start: 0, duration: 0, inputData: { startDay: 0, endDay: 0 } });
            continue;
        }
        if (endDay < startDay) {
            alert(`Error pada ${task.name}: Hari selesai (${endDay}) tidak boleh lebih kecil dari hari mulai (${startDay})!`);
            hasError = true;
            break;
        }
        const duration = endDay - startDay + 1;
        updatedTasks.push({ ...task, start: startDay, duration: duration, inputData: { startDay, endDay } });
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
    if (!currentProject) return;

    // Reset data di memori
    if (currentProject.work === 'ME') {
        currentTasks = JSON.parse(JSON.stringify(taskTemplateME));
    } else {
        currentTasks = JSON.parse(JSON.stringify(taskTemplateSipil));
    }

    projectTasks[currentProject.ulok] = currentTasks;
    hasUserInput = false;

    // Render ulang form menjadi 0 semua
    renderApiData();
    showPleaseInputMessage(); // Hapus chart, minta input
    updateStats();
    document.getElementById('exportButtons').style.display = 'none';
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
    `;
    info.innerHTML = html;
}

function updateStats() {
    if (!currentProject) return;
    const inputedTasks = currentTasks.filter(t => t.duration > 0);
    const totalInputed = inputedTasks.length;
    let maxEnd = 0;
    if (inputedTasks.length > 0) {
        maxEnd = Math.max(...inputedTasks.map(t => t.start + t.duration - 1));
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

    // Tentukan lebar chart
    let maxTaskEndDay = 0;
    currentTasks.forEach(task => {
        const end = task.start + task.duration;
        if (end > maxTaskEndDay) maxTaskEndDay = end;
    });
    const totalDaysToRender = Math.max(
        (currentProject.work === 'ME' ? totalDaysME : totalDaysSipil),
        maxTaskEndDay + 10
    );
    const totalChartWidth = totalDaysToRender * DAY_WIDTH;
    const projectStartDate = new Date(currentProject.startDate);

    // Render Header
    let html = '<div class="chart-header">';
    html += '<div class="task-column">Tahapan</div>';
    html += `<div class="timeline-column" style="width: ${totalChartWidth}px;">`;
    for (let i = 0; i < totalDaysToRender; i++) {
        const currentDate = new Date(projectStartDate);
        currentDate.setDate(projectStartDate.getDate() + i);
        const dateNum = currentDate.getDate();
        const monthName = currentDate.toLocaleDateString('id-ID', { month: 'short' });
        const isSunday = currentDate.getDay() === 0;
        html += `
            <div class="day-header" style="width: ${DAY_WIDTH}px; ${isSunday ? 'background-color:#ffe3e3;' : ''}">
                <span class="d-date">${dateNum}</span>
                <span class="d-month">${monthName}</span>
            </div>
        `;
    }
    html += '</div></div>';

    // Render Body
    html += '<div class="chart-body">';
    currentTasks.forEach(task => {
        if (task.duration === 0) return; // Skip yang 0 durasi

        const leftPos = (task.start - 1) * DAY_WIDTH;
        const widthPos = task.duration * DAY_WIDTH;

        // Tgl asli
        const tStart = new Date(projectStartDate);
        tStart.setDate(projectStartDate.getDate() + (task.start - 1));
        const tEnd = new Date(tStart);
        tEnd.setDate(tStart.getDate() + task.duration);

        html += '<div class="task-row">';
        html += `<div class="task-name">
            <span>${task.name}</span>
            <span class="task-duration">Durasi: ${task.duration} hari</span>
        </div>`;
        html += `<div class="timeline" style="width: ${totalChartWidth}px;">`;
        html += `<div class="bar on-time" data-task-id="${task.id}" 
                style="left: ${leftPos}px; width: ${widthPos}px;" 
                title="${task.name}: ${formatDateID(tStart)} - ${formatDateID(tEnd)}">
            ${task.duration}h
        </div>`;
        html += '</div></div>';
    });
    html += '</div>';

    chart.innerHTML = html;

    // Draw lines after render
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
        [],
        ["No", "Tahapan", "Mulai", "Selesai", "Durasi"]
    ];
    currentTasks.forEach((task, i) => {
        if (task.duration === 0) return;
        const tStart = new Date(startDate); tStart.setDate(startDate.getDate() + (task.start - 1));
        const tEnd = new Date(tStart); tEnd.setDate(tStart.getDate() + task.duration - 1);
        data.push([i + 1, task.name, formatDateID(tStart), formatDateID(tEnd), task.duration]);
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