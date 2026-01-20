/* global XLSX */

document.addEventListener('DOMContentLoaded', () => {
    // ==================== 1. ROLE & SESSION HANDLING ====================
    const userRole = sessionStorage.getItem('userRole');
    const loggedInUserEmail = sessionStorage.getItem('loggedInUserEmail');
    const loggedInUserCabang = sessionStorage.getItem('loggedInUserCabang');

    // Security Check
    if (!userRole) {
        alert("Sesi Anda telah habis atau tidak valid. Silakan login kembali.");
        window.location.replace('../../auth/index.html'); 
        return;
    }

    // Role Mapping Configuration
    let APP_MODE = 'guest'; // 'kontraktor' | 'pic'

    const picRoles = [
        'BRANCH BUILDING & MAINTENANCE MANAGER',
        'BRANCH BUILDING COORDINATOR',
        'BRANCH BUILDING SUPPORT'
    ];

    if (userRole === 'KONTRAKTOR') {
        APP_MODE = 'kontraktor';
    } else if (picRoles.includes(userRole)) {
        APP_MODE = 'pic';
    } else {
        alert(`Role "${userRole}" tidak memiliki akses ke halaman ini.`);
        window.location.href = '../../dashboard/index.html';
        return;
    }

    console.log(`🔒 Login sebagai: ${userRole}`);
    console.log(`⚙️ Mode Aplikasi: ${APP_MODE.toUpperCase()}`);

    // Update UI Header
    const roleBadge = document.getElementById('roleBadge');
    if (roleBadge) roleBadge.textContent = userRole; 
    
    const nameDisplay = document.getElementById('userNameDisplay');
    if (nameDisplay) {
        const displayName = APP_MODE === 'kontraktor' ? loggedInUserEmail : (loggedInUserCabang || 'User PIC');
        nameDisplay.textContent = displayName;
    }

    // ==================== 2. CONFIGURATION ====================
    const API_BASE_URL = "https://sparta-backend-5hdj.onrender.com/api";

    const ENDPOINTS = {
        ulokList: APP_MODE === 'kontraktor' 
            ? `${API_BASE_URL}/get_ulok_by_email?email=${encodeURIComponent(loggedInUserEmail)}`
            : `${API_BASE_URL}/get_ulok_by_cabang_pic?cabang=${encodeURIComponent(loggedInUserCabang)}`,
        
        ganttData: `${API_BASE_URL}/get_gantt_data`,
        insertData: `${API_BASE_URL}/gantt/insert`,
        dayInsert: `${API_BASE_URL}/gantt/day/insert`,
        dayKeterlambatan: `${API_BASE_URL}/gantt/day/keterlambatan`, 
        pengawasanInsert: `${API_BASE_URL}/gantt/pengawasan/insert`
    };

    // ==================== 3. STATE MANAGEMENT ====================
    let projects = [];
    let currentProject = null;
    let projectTasks = {};
    let currentTasks = [];
    let ganttApiData = null;
    let rawGanttData = null;
    let dayGanttData = null; 
    let isLoadingGanttData = false;
    let hasUserInput = false;
    let isProjectLocked = false;
    let supervisionDays = {};
    let isSupervisionLocked = false;

    // ==================== 4. TASK TEMPLATES ====================
    const taskTemplateME = [
        { id: 1, name: "Instalasi", start: 0, duration: 0, dependencies: [] },
        { id: 2, name: "Fixture", start: 0, duration: 0, dependencies: [] },
        { id: 3, name: "Pekerjaan Tambahan", start: 0, duration: 0, dependencies: [] },
        { id: 4, name: "Pekerjaan SBO", start: 0, duration: 0, dependencies: [] },
    ];

    const taskTemplateSipil = [
        { id: 1, name: "Pekerjaan Persiapan", start: 0, duration: 0, dependencies: [] },
        { id: 2, name: "Pekerjaan Bobokan/Bongkaran", start: 0, duration: 0, dependencies: [] },
        { id: 3, name: "Pekerjaan Tanah", start: 0, duration: 0, dependencies: [] },
        { id: 4, name: "Pekerjaan Pondasi & Beton", start: 0, duration: 0, dependencies: [] },
        { id: 5, name: "Pekerjaan Pasangan", start: 0, duration: 0, dependencies: [] },
        { id: 6, name: "Pekerjaan Besi", start: 0, duration: 0, dependencies: [] },
        { id: 7, name: "Pekerjaan Keramik", start: 0, duration: 0, dependencies: [] },
        { id: 8, name: "Pekerjaan Plumbing", start: 0, duration: 0, dependencies: [] },
        { id: 9, name: "Pekerjaan Sanitary & Acecories", start: 0, duration: 0, dependencies: [] },
        { id: 10, name: "Pekerjaan Janitor", start: 0, duration: 0, dependencies: [] },
        { id: 11, name: "Pekerjaan Atap", start: 0, duration: 0, dependencies: [] },
        { id: 12, name: "Pekerjaan Kusen, Pintu, dan Kaca", start: 0, duration: 0, dependencies: [] },
        { id: 13, name: "Pekerjaan Finishing", start: 0, duration: 0, dependencies: [] },
        { id: 14, name: "Pekerjaan Beanspot", start: 0, duration: 0, dependencies: [] },
        { id: 15, name: "Pekerjaan Area Terbuka", start: 0, duration: 0, dependencies: [] },
        { id: 16, name: "Pekerjaan Tambahan", start: 0, duration: 0, dependencies: [] },
        { id: 17, name: "Pekerjaan SBO", start: 0, duration: 0, dependencies: [] },
    ];

    const totalDaysME = 100;
    const totalDaysSipil = 205;

    // ==================== 5. HELPER FUNCTIONS ====================
    function formatDateID(date) {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}`;
    }

    function parseDateDDMMYYYY(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            const date = new Date(year, month, day);
            return isNaN(date.getTime()) ? null : date;
        }
        return null;
    }

    function extractUlokAndLingkup(value) {
        if (!value) return { ulok: "", lingkup: "" };
        const trimmed = String(value).trim();
        const parts = trimmed.split("-");
        if (parts.length < 2) return { ulok: trimmed, lingkup: "" };
        const lingkupRaw = parts.pop();
        const ulok = parts.join("-");
        const lingkupUpper = lingkupRaw.replace(/[^a-zA-Z]/g, "").toUpperCase();
        const lingkup = lingkupUpper === "ME" ? "ME" : "Sipil";
        return { ulok, lingkup };
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function showLoadingMessage() {
        document.getElementById("ganttChart").innerHTML = `
            <div style="text-align: center; padding: 60px; color: #6c757d;">
                <div style="font-size: 48px; margin-bottom: 20px;">⏳</div>
                <h2 style="margin-bottom: 15px;">Memuat Data...</h2>
            </div>`;
    }

    function showSelectProjectMessage() {
        document.getElementById("ganttChart").innerHTML = `
            <div style="text-align: center; padding: 60px; color: #6c757d;">
                <h2 style="margin-bottom: 15px;">📋 Pilih No. Ulok</h2>
                <p>Silakan pilih nomor Ulok pada dropdown di atas untuk memulai.</p>
            </div>`;
        document.getElementById("projectInfo").innerHTML = "";
        document.getElementById("stats").innerHTML = "";
        document.getElementById("apiData").innerHTML = "";
    }

    function getTaskDateString(dayInt) {
        if (!currentProject || !currentProject.startDate || dayInt <= 0) return null;
        const pStart = new Date(currentProject.startDate);
        const targetDate = new Date(pStart);
        targetDate.setDate(pStart.getDate() + (dayInt - 1));
        return formatDateID(targetDate); // Menggunakan fungsi formatDateID yg sudah ada
    }

    // ==================== 6. CORE: INIT & LOAD PROJECTS ====================
    async function loadDataAndInit() {
        try {
            showLoadingMessage();
            console.log(`🔗 Fetching Projects from: ${ENDPOINTS.ulokList}`);
            
            const response = await fetch(ENDPOINTS.ulokList);
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            
            const apiData = await response.json();
            if (!Array.isArray(apiData)) throw new Error("Format data API tidak valid");

            projects = apiData.map(item => {
                const label = item.label;
                const value = item.value;
                const { ulok, lingkup } = extractUlokAndLingkup(value);
                
                let projectName = "Reguler";
                let storeName = "Tidak Diketahui";
                
                const parts = label.split(" - ");
                if (parts.length >= 2) {
                    storeName = parts[parts.length - 1].replace(/\(ME\)|\(Sipil\)/gi, '').trim();
                    if(parts.length >= 3) projectName = parts[1].replace(/$$ME$$|$$Sipil$$/gi, "").trim();
                }
                
                if (label.toUpperCase().includes("RENOVASI") || ulok.includes("-R")) projectName = "Renovasi";

                return {
                    ulok: value,
                    ulokClean: ulok,
                    store: storeName,
                    work: lingkup || 'Sipil',
                    projectType: projectName,
                    startDate: new Date().toISOString().split("T")[0],
                    alamat: "",
                    cabang: ""
                };
            });

            if (projects.length === 0) {
                document.getElementById("ganttChart").innerHTML = `<div style="text-align:center; padding:40px;">Tidak ada data proyek ditemukan untuk akun ini.</div>`;
                return;
            }

            initUI();

        } catch (error) {
            console.error(error);
            document.getElementById("ganttChart").innerHTML = `<div style="text-align:center; color:red; padding:40px;">Gagal memuat list proyek: ${error.message}</div>`;
        }
    }

    function initUI() {
        const ulokSelect = document.getElementById("ulokSelect");
        ulokSelect.innerHTML = '<option value="">-- Pilih Proyek --</option>';

        projects.forEach(project => {
            projectTasks[project.ulok] = [];
            const option = document.createElement("option");
            option.value = project.ulok;
            option.textContent = `${project.ulok} | ${project.store} (${project.work})`;
            ulokSelect.appendChild(option);
        });

        ulokSelect.addEventListener('change', changeUlok);

        const savedUlok = localStorage.getItem("lastSelectedUlok");
        if (savedUlok && projects.some(p => p.ulok === savedUlok)) {
            ulokSelect.value = savedUlok;
            changeUlok();
        } else {
            showSelectProjectMessage();
        }
    }

    // ==================== 7. CORE: SELECT PROJECT & FETCH GANTT ====================
    async function changeUlok() {
        const ulokSelect = document.getElementById("ulokSelect");
        const selectedUlok = ulokSelect.value;
        
        // Reset States
        supervisionDays = {};
        dayGanttData = null;
        rawGanttData = null;
        ganttApiData = null;
        isProjectLocked = false;
        hasUserInput = false;
        isSupervisionLocked = false;

        if (!selectedUlok) {
            currentProject = null;
            showSelectProjectMessage();
            return;
        }

        localStorage.setItem("lastSelectedUlok", selectedUlok);
        currentProject = projects.find(p => p.ulok === selectedUlok);
        
        await fetchGanttData(selectedUlok);
        
        // Setelah fetch, render semua komponen
        renderProjectInfo();
        renderApiData(); 
        if (hasUserInput) {
            renderChart();
        } else {
            document.getElementById("ganttChart").innerHTML = `
                <div style="text-align: center; padding: 60px; color: #6c757d;">
                    <div style="font-size: 48px; margin-bottom: 20px;">ℹ️</div>
                    <h2 style="margin-bottom: 15px;">Belum Ada Jadwal</h2>
                    <p>${APP_MODE === 'kontraktor' ? 'Silakan input jadwal pada form di atas.' : 'Menunggu Kontraktor membuat jadwal.'}</p>
                </div>`;
        }
        
        updateStats();
    }

    async function fetchGanttData(selectedValue) {
        const { ulok, lingkup } = extractUlokAndLingkup(selectedValue);
        const url = `${ENDPOINTS.ganttData}?ulok=${encodeURIComponent(ulok)}&lingkup=${encodeURIComponent(lingkup)}`;
        
        isLoadingGanttData = true;
        renderApiData(); 

        try {
            const response = await fetch(url);
            if (response.status === 404) throw new Error("NOT_FOUND");
            const data = await response.json();
            
            ganttApiData = data;
            rawGanttData = data.gantt_data;

            if (data.rab) updateProjectFromRab(data.rab);
            if (data.day_gantt_data) dayGanttData = data.day_gantt_data;
            
            // FIX: Parsing Pengawasan
            if (rawGanttData) parseSupervisionFromGanttData(rawGanttData);

            if (rawGanttData) {
                const status = String(rawGanttData.Status || '').toLowerCase();
                isProjectLocked = ['terkunci', 'locked', 'published'].includes(status);
                
                parseGanttDataToTasks(rawGanttData, selectedValue, dayGanttData);
                
                if (currentTasks.length === 0) {
                    console.warn("Raw data ada tapi tasks kosong, load default.");
                    loadDefaultTasks(selectedValue);
                } else {
                    hasUserInput = true; 
                }
            } else {
                loadDefaultTasks(selectedValue);
            }

        } catch (e) {
            console.warn("Using default template/No Data", e);
            loadDefaultTasks(selectedValue);
        } finally {
            isLoadingGanttData = false;
        }
    }

    function loadDefaultTasks(selectedValue) {
        let template = currentProject.work === 'ME' ? taskTemplateME : taskTemplateSipil;
        currentTasks = JSON.parse(JSON.stringify(template)).map(t => ({
            ...t,
            inputData: { ranges: [] } 
        }));
        projectTasks[selectedValue] = currentTasks;
        hasUserInput = false;
        isProjectLocked = false;
    }

    // ==================== 8. PARSING LOGIC ====================
    function parseGanttDataToTasks(ganttData, selectedValue, dayGanttDataArray = null) {
        if (!currentProject || !ganttData) return;

        let dynamicTasks = [];
        let earliestDate = null;
        let tempTaskList = [];
        let i = 1;

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

        const categoryRangesMap = {};

        if (dayGanttDataArray && Array.isArray(dayGanttDataArray) && dayGanttDataArray.length > 0) {
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

            if (!earliestDate) earliestDate = new Date();

            const projectStartDate = earliestDate;
            currentProject.startDate = projectStartDate.toISOString().split('T')[0];
            const msPerDay = 1000 * 60 * 60 * 24;

            dayGanttDataArray.forEach(entry => {
                const kategori = entry.Kategori;
                if (!kategori) return;

                const hAwalStr = entry.h_awal;
                const hAkhirStr = entry.h_akhir;
                if (!hAwalStr || !hAkhirStr) return;

                const startDate = parseDateDDMMYYYY(hAwalStr);
                const endDate = parseDateDDMMYYYY(hAkhirStr);

                if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;

                const startDay = Math.round((startDate - projectStartDate) / msPerDay) + 1;
                const endDay = Math.round((endDate - projectStartDate) / msPerDay) + 1;
                const duration = endDay - startDay + 1;

                const key = kategori.toLowerCase().trim();
                if (!categoryRangesMap[key]) categoryRangesMap[key] = [];

                categoryRangesMap[key].push({
                    start: startDay > 0 ? startDay : 1,
                    end: endDay > 0 ? endDay : 1,
                    duration: duration > 0 ? duration : 1,
                    keterlambatan: parseInt(entry.keterlambatan || 0)
                });
            });
        } else {
            earliestDate = new Date();
            currentProject.startDate = earliestDate.toISOString().split('T')[0];
        }

        tempTaskList.forEach(item => {
            const normalizedName = item.name.toLowerCase().trim();
            let ranges = [];

            for (const [kategoriKey, rangeArray] of Object.entries(categoryRangesMap)) {
                if (normalizedName === kategoriKey || normalizedName.includes(kategoriKey) || kategoriKey.includes(normalizedName)) {
                    ranges = rangeArray;
                    break;
                }
            }

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
                inputData: { ranges: ranges }
            });
        });

        currentTasks = dynamicTasks;
        projectTasks[selectedValue] = currentTasks;
    }

    // FIX: Parsing Supervision Robust
    // Menggunakan loop properti objek untuk menghindari masalah "gap" pada index
    function parseSupervisionFromGanttData(ganttData) {
        supervisionDays = {};
        for (const key in ganttData) {
            if (ganttData.hasOwnProperty(key)) {
                if (key.startsWith("Pengawasan_")) {
                    const val = ganttData[key];
                    if (val && !isNaN(parseInt(val)) && parseInt(val) > 0) {
                        supervisionDays[parseInt(val)] = true;
                    }
                }
            }
        }
    }

    // ==================== 9. UI RENDERING ====================
    function renderApiData() {
        const container = document.getElementById("apiData");
        if(isLoadingGanttData) {
            container.innerHTML = `<div class="api-card"><div class="api-card-title">Memuat data...</div></div>`;
            return;
        }

        if (APP_MODE === 'kontraktor') {
            if (isProjectLocked) {
                container.innerHTML = `
                    <div class="api-card locked">
                        <h3 style="color: #2f855a; margin:0;">✅ Jadwal Terkunci</h3>
                        <p style="margin-top:5px;">Jadwal sudah diterbitkan. Hubungi Admin jika perlu revisi.</p>
                    </div>`;
            } else {
                renderContractorInputForm(container);
            }
        } 
        else if (APP_MODE === 'pic') {
            if (!isProjectLocked) {
                container.innerHTML = `
                    <div class="api-card warning">
                        <h3 style="color: #c05621; margin:0;">🔓 Menunggu Kunci Jadwal</h3>
                        <p style="margin-top:5px;">Kontraktor belum mengunci jadwal. Anda dapat melihat chart (jika ada) di bawah.</p>
                    </div>`;
            } else {
                renderPicDelayForm(container);
            }
        }
    }

    // --- FORM PIC (DELAY & SUPERVISION CONTROL) ---
    window.renderPicDelayForm = function(container) {
        let html = '';
        // TAMPILAN 1: MODE EDIT PENGAWASAN (Belum dikunci)
        if (!isSupervisionLocked) {
            html += `
            <div class="api-card info">
                <h3 style="color: #2b6cb0; margin:0; display:flex; align-items:center; gap:8px;">
                    <span>Input Pengawasan Terlebih Dahulu</span>
                </h3>
                <p style="margin-top:5px; margin-bottom:15px; font-size:14px; color:#4a5568;">
                    Klik angka/tanggal pada Header Table Chart di bawah untuk menandai hari pengawasan. 
                    Jika sudah selesai, kunci hari pengawasan untuk lanjut input keterlambatan.
                </p>
                <div style="text-align:right;">
                    <button class="btn-publish" style="background:#3182ce; width:auto;" onclick="lockSupervision()">
                        Kunci Hari Pengawasan & Input Keterlambatan
                    </button>
                </div>
            </div>`;
            container.innerHTML = html;
            return;
        }
        // TAMPILAN 2: MODE INPUT KETERLAMBATAN (Sudah dikunci)
        let optionsHtml = '<option value="">-- Pilih Tahapan --</option>';
        if (dayGanttData) {
            dayGanttData.forEach((d, idx) => {
                const delayVal = parseInt(d.keterlambatan || 0);
                const delayText = delayVal > 0 ? ` (+${delayVal} Hari)` : '';
                optionsHtml += `<option value="${idx}" data-idx="${idx}" data-delay="${delayVal}">${d.Kategori} (${d.h_awal} - ${d.h_akhir})${delayText}</option>`;
            });
        }
        html += `
            <div class="delay-control-card">
                <div class="delay-title" style="justify-content:space-between;">
                    <span>Tahap 2: Input Keterlambatan</span>
                    <button onclick="unlockSupervision()" style="background:transparent; border:1px solid #ddd; padding:4px 8px; font-size:11px; border-radius:4px; cursor:pointer; color:#555;">
                        ✏️ Ubah Pengawasan
                    </button>
                </div>
                <div class="delay-form-row">
                    <div class="form-group" style="flex: 2;">
                        <label>Pilih Tahapan</label>
                        <select id="delayTaskSelect" class="form-control" onchange="onDelaySelectChange()">${optionsHtml}</select>
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label>Jml Hari</label>
                        <input type="number" id="delayDaysInput" class="form-control" placeholder="0" min="0">
                    </div>
                    <button onclick="submitDelay()" class="btn-terapkan-delay">Simpan</button>
                </div>
            </div>`;
        
        container.innerHTML = html;
    }

    // --- FORM KONTRAKTOR ---
    window.renderContractorInputForm = function(container) { 
        let html = `<div class="api-card"><div class="api-card-title">Input Jadwal & Keterikatan</div><div class="task-input-container">`;
        
        // Cek kelengkapan data
        const isAllTasksFilled = currentTasks.every(t => 
            t.inputData && t.inputData.ranges && t.inputData.ranges.length > 0
        );

        currentTasks.forEach((task, index) => {
            const ranges = task.inputData.ranges || [];
            
            // Generate Options Dependency
            let dependencyOptions = `<option value="">- Tidak Ada -</option>`;
            currentTasks.forEach(prevTask => {
                // Tampilkan task ID sebelumnya sebagai opsi
                if (prevTask.id < task.id) {
                    const selected = (task.dependency == prevTask.id) ? 'selected' : '';
                    dependencyOptions += `<option value="${prevTask.id}" ${selected}>${prevTask.id}. ${prevTask.name}</option>`;
                }
            });

            html += `
            <div class="task-input-row-multi" id="task-row-${task.id}">
                <div style="font-weight:700; font-size:14px; color:#2d3748; margin-bottom:12px; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">
                    ${task.id}. ${escapeHtml(task.name)}
                </div>

                <div style="display:flex; align-items:flex-start; gap:25px;"> 
                    
                    <div style="width:30%; min-width: 150px;"> 
                        <label style="font-size:11px; color:#718096; font-weight:600; display:block; margin-bottom:4px;">Keterikatan</label>
                        <select class="form-control dep-select" data-task-id="${task.id}" style="font-size:12px; padding:6px; width:100%;">
                            ${dependencyOptions}
                        </select>
                        <div style="font-size:10px; color:#a0aec0; margin-top:4px; line-height:1.2;">
                            *Mulai setelah tahapan ini
                        </div>
                    </div>

                    <div style="width:70%;">
                        <label style="font-size:11px; color:#718096; font-weight:600; display:block; margin-bottom:4px;">Durasi (Hari Ke- sampai Hari Ke-)</label>
                        <div class="task-ranges-container" id="ranges-${task.id}">`;
            
            const rangesToRender = ranges.length > 0 ? ranges : [{start: 0, end: 0}];
            
            rangesToRender.forEach((r, idx) => {
                const isSaved = ranges.length > 0; 
                html += createRangeHTML(task.id, idx, r.start, r.end, isSaved);
            });

            html += `   </div>
                        <button class="btn-add-range" onclick="addRange(${task.id})" style="margin-top:8px;">+ Tambah Durasi Lain</button>
                    </div>
                </div>
            </div>`;
        });

        // Logika Tombol
        const btnDisabledAttr = isAllTasksFilled ? '' : 'disabled';
        const btnStyle = isAllTasksFilled ? '' : 'background-color: #cbd5e0; cursor: not-allowed;';
        const lockLabel = isAllTasksFilled ? '🔒 Kunci Jadwal' : '🔒 Lengkapi & Terapkan Dahulu';

        html += `</div>
            <div class="task-input-actions">
                <button class="btn-reset-schedule" onclick="resetTaskSchedule()">Reset</button>
                <button class="btn-apply-schedule" onclick="applyTaskSchedule()">⚡ Hitung & Terapkan Jadwal</button>
            </div>
            <div class="task-input-actions" style="border-top:none; padding-top:0;">
                <button class="btn-publish" onclick="confirmAndPublish()" style="${btnStyle}" ${btnDisabledAttr}>
                    ${lockLabel}
                </button>
            </div>
        </div>`;
        container.innerHTML = html;
    }

    window.createRangeHTML = function(taskId, idx, start, end, isSaved = false) {
        const btnColor = isSaved ? 'background: #fed7d7; color: #c53030;' : 'background: #e2e8f0; color: #4a5568;';
        return `
        <div class="range-input-group" id="range-group-${taskId}-${idx}" data-range-idx="${idx}">
            <div class="input-group">
                <label>H</label>
                <input type="number" class="task-day-input" id="start-${taskId}-${idx}" data-task-id="${taskId}" data-type="start" value="${start}" min="0" ${isSaved ? 'readonly style="background:#f7fafc"' : ''}>
            </div>
            <span class="input-separator">-</span>
            <div class="input-group">
                <label>H</label>
                <input type="number" class="task-day-input" id="end-${taskId}-${idx}" data-task-id="${taskId}" data-type="end" value="${end}" min="0" ${isSaved ? 'readonly style="background:#f7fafc"' : ''}>
            </div>
            <button class="btn-remove-range" style="${btnColor}" onclick="removeRange(${taskId}, ${idx}, ${isSaved})">×</button>
        </div>`;
    }

    // ==================== 10. ACTIONS: KONTRAKTOR ====================
    window.addRange = function(taskId) {
        const container = document.getElementById(`ranges-${taskId}`);
        const uniqueIdx = Date.now(); 
        container.insertAdjacentHTML('beforeend', createRangeHTML(taskId, uniqueIdx, 0, 0, false));
    }

    window.removeRange = async function(taskId, idx, isSaved) {
        const rowId = `range-group-${taskId}-${idx}`;
        const element = document.getElementById(rowId);
        
        // 1. Jika data BARU (Draft/Belum Save), hapus DOM saja
        if (!isSaved) {
            if (element) element.remove();
            return;
        }

        // 2. Jika data SUDAH TERSIMPAN (DB), Konfirmasi
        if (!confirm("Data ini sudah tersimpan di server. Yakin ingin menghapusnya?")) return;

        const startVal = parseInt(document.getElementById(`start-${taskId}-${idx}`).value) || 0;
        const endVal = parseInt(document.getElementById(`end-${taskId}-${idx}`).value) || 0;
        
        const taskObj = currentTasks.find(t => t.id === taskId);
        const taskName = taskObj ? taskObj.name : "";

        if (startVal === 0 || endVal === 0 || !taskName) {
            alert("Data tidak valid/kosong, dihapus dari tampilan saja.");
            if(element) element.remove();
            return;
        }

        const dateStartStr = getTaskDateString(startVal);
        const dateEndStr = getTaskDateString(endVal);

        if (!dateStartStr || !dateEndStr) {
            alert("Gagal mengonversi tanggal. Cek Start Date Project.");
            return;
        }

        // 3. Susun Payload (Object Tunggal)
        const payloadObj = {
            "nomor_ulok": currentProject.ulokClean,
            "lingkup_pekerjaan": currentProject.work.toUpperCase(),
            "remove_kategori_data": [
                {
                    "Kategori": taskName,
                    "h_awal": dateStartStr,
                    "h_akhir": dateEndStr
                }
            ]
        };

        try {
            // FIX: Bungkus payloadObj ke dalam Array [] karena endpoint mengharapkan List
            const finalPayload = [payloadObj];
            
            console.log("Sending Remove Payload:", finalPayload); 
            document.body.style.cursor = 'wait';
            
            const response = await fetch(ENDPOINTS.dayInsert, { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify(finalPayload) // Kirim sebagai Array
            });

            // Baca pesan error dari server jika ada
            const responseText = await response.text();

            if (!response.ok) {
                throw new Error(`Server Error (${response.status}): ${responseText}`);
            }

            // 4. Sukses
            if (element) element.remove();
            
            if (taskObj && taskObj.inputData && taskObj.inputData.ranges) {
                taskObj.inputData.ranges = taskObj.inputData.ranges.filter(r => r.start !== startVal || r.end !== endVal);
            }
            
            alert("Data berhasil dihapus.");
            renderChart();
            updateStats();
            
        } catch (err) {
            console.error("Remove Failed:", err);
            alert("Gagal menghapus: " + err.message);
        } finally {
            document.body.style.cursor = 'default';
        }
    }

    window.resetTaskSchedule = function() {
        if(!confirm("Reset semua inputan?")) return;
        
        currentTasks.forEach(t => { 
            t.inputData.ranges = []; 
            t.start = 0; 
            t.duration = 0; 
        });
        hasUserInput = false;
        
        renderApiData();
        
        document.getElementById("ganttChart").innerHTML = `
            <div style="text-align: center; padding: 60px; color: #6c757d;">
                <div style="font-size: 48px; margin-bottom: 20px;">ℹ️</div>
                <h2 style="margin-bottom: 15px;">Belum Ada Jadwal</h2>
                <p>Silakan input jadwal pada form di atas.</p>
            </div>`;
            
        updateStats();
    }

    window.applyTaskSchedule = function() {
        let tempTasks = [];
        let error = false;

        // 1. AMBIL DATA DARI INPUT (Range & Dependency)
        currentTasks.forEach(t => {
            const container = document.getElementById(`ranges-${t.id}`);
            // Ambil value dependency dari dropdown
            const depSelect = document.querySelector(`.dep-select[data-task-id="${t.id}"]`);
            const depValue = depSelect ? depSelect.value : "";

            if(!container) { tempTasks.push(t); return; }
            
            let newRanges = [];
            Array.from(container.children).forEach(row => {
                const s = parseInt(row.querySelector('[data-type="start"]').value) || 0;
                const e = parseInt(row.querySelector('[data-type="end"]').value) || 0;
                
                // Skip baris kosong 0-0, kecuali itu satu-satunya baris
                if(s === 0 && e === 0 && container.children.length > 1) return;
                
                if(e < s && e !== 0) { 
                    error = true; 
                    alert(`Error Tahapan ${t.name}: Hari Selesai lebih kecil dari Mulai`); 
                }
                newRanges.push({start: s, end: e, duration: (e > 0 ? e-s+1 : 0)});
            });
            
            tempTasks.push({
                ...t, 
                dependency: depValue, // Simpan ID dependency
                inputData: {ranges: newRanges}
            });
        });

        if(error) return;

        // 2. LOGIKA CASCADING (KETERIKATAN)
        // Kita loop task berurutan. Karena ID urut (1,2,3...), kita bisa hitung impact dari atas ke bawah.
        let processedTasksMap = {}; // Simpan max end date setiap task

        tempTasks.forEach(task => {
            const ranges = task.inputData.ranges;
            
            // Cek Dependency
            if (task.dependency) {
                const parentId = parseInt(task.dependency);
                const parentEndDay = processedTasksMap[parentId] || 0;
                
                // Syarat: Start hari pertama task ini harus > Parent End Day
                const requiredStart = parentEndDay + 1;
                
                if (ranges.length > 0) {
                    const currentStart = ranges[0].start;
                    
                    // Jika jadwal user tabrakan dengan syarat dependency (misal user input start 3, padahal parent selesai 5)
                    // Maka kita GESER otomatis (Shift)
                    if (currentStart < requiredStart && currentStart !== 0) {
                        const shiftDays = requiredStart - currentStart;
                        
                        // Geser semua split range task ini
                        ranges.forEach(r => {
                            r.start += shiftDays;
                            r.end += shiftDays;
                        });
                        
                        // Opsional: Beritahu user ada pergeseran (matikan jika ingin silent mode)
                        // console.log(`Auto-shifting task ${task.name} by ${shiftDays} days due to dependency.`);
                    }
                }
            }

            // Hitung properti summary task
            const totalDur = ranges.reduce((sum, r) => sum + r.duration, 0);
            const minStart = ranges.length ? Math.min(...ranges.map(r=>r.start)) : 0;
            const maxEnd = ranges.length ? Math.max(...ranges.map(r=>r.end)) : 0;

            // Simpan max end day untuk referensi task berikutnya
            processedTasksMap[task.id] = maxEnd;

            // Update object task
            task.start = minStart;
            task.duration = totalDur;
        });

        // 3. SIMPAN STATE
        currentTasks = tempTasks;
        hasUserInput = true;
        
        saveProjectSchedule("Active");
        
        // 4. RENDER ULANG
        renderChart();
        updateStats();
        renderApiData(); 
    }

    window.confirmAndPublish = function() {
        const isAllTasksFilled = currentTasks.every(t => 
            t.inputData && t.inputData.ranges && t.inputData.ranges.length > 0
        );

        if (!isAllTasksFilled) {
            alert("Harap lengkapi semua tahapan pekerjaan terlebih dahulu sebelum mengunci jadwal.");
            return;
        }
        if(!confirm("Yakin kunci jadwal? Data tidak bisa diubah lagi.")) return;
        saveProjectSchedule("Terkunci");
    }

    async function saveProjectSchedule(status) {
        const payload = {
            "Nomor Ulok": currentProject.ulokClean,
            "Lingkup_Pekerjaan": currentProject.work.toUpperCase(),
            "Status": status,
            "Email_Pembuat": loggedInUserEmail || "-",
            "Nama_Toko": currentProject.store,
            "Proyek": currentProject.projectType,
            "Alamat": currentProject.alamat || "-",
            "Cabang": "HEAD OFFICE",
            "Nama_Kontraktor": "PT KONTRAKTOR", 
        };
        
        currentTasks.forEach(t => {
            const ranges = t.inputData.ranges || [];
            payload[`Kategori_${t.id}`] = t.name; 
            
            if(ranges.length > 0) {
                 const pStart = new Date(currentProject.startDate);
                 const tStart = new Date(pStart); tStart.setDate(pStart.getDate() + ranges[0].start - 1);
                 const tEnd = new Date(pStart); tEnd.setDate(pStart.getDate() + ranges[ranges.length-1].end - 1);
                 
                 payload[`Hari_Mulai_Kategori_${t.id}`] = tStart.toISOString().split('T')[0];
                 payload[`Hari_Selesai_Kategori_${t.id}`] = tEnd.toISOString().split('T')[0];
                 payload[`Keterlambatan_Kategori_${t.id}`] = "0";
            }
        });

        const dayPayload = [];
        const pStart = new Date(currentProject.startDate);
        
        currentTasks.forEach(t => {
            (t.inputData.ranges || []).forEach(r => {
                const dS = new Date(pStart); dS.setDate(pStart.getDate() + r.start - 1);
                const dE = new Date(pStart); dE.setDate(pStart.getDate() + r.end - 1);
                dayPayload.push({
                    "Nomor Ulok": currentProject.ulokClean,
                    "Lingkup_Pekerjaan": currentProject.work.toUpperCase(),
                    "Kategori": t.name,
                    "h_awal": formatDateID(dS), 
                    "h_akhir": formatDateID(dE)
                });
            });
        });

        try {
            await fetch(ENDPOINTS.insertData, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)});
            
            if(dayPayload.length > 0) {
                await fetch(ENDPOINTS.dayInsert, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(dayPayload)});
            }
            
            alert(`Berhasil disimpan status: ${status}`);
            if(status === 'Terkunci') { 
                isProjectLocked = true; 
                renderApiData(); 
            }
            
            renderChart();
            
        } catch (err) {
            console.error(err);
            alert("Gagal menyimpan data: " + err.message);
        }
    }

    // ==================== 11. ACTIONS: PIC ====================
    window.onDelaySelectChange = function() {
        const sel = document.getElementById('delayTaskSelect');
        const opt = sel.options[sel.selectedIndex];
        document.getElementById('delayDaysInput').value = opt.getAttribute('data-delay') || 0;
    }

    window.submitDelay = async function() {
        const sel = document.getElementById('delayTaskSelect');
        const idx = sel.options[sel.selectedIndex].getAttribute('data-idx');
        const days = document.getElementById('delayDaysInput').value;
        
        if(!dayGanttData || !dayGanttData[idx]) return alert("Data tidak valid");
        const item = dayGanttData[idx];

        const payload = {
            nomor_ulok: currentProject.ulokClean,
            lingkup_pekerjaan: currentProject.work.toUpperCase(),
            kategori: item.Kategori.toUpperCase(),
            h_awal: item.h_awal,
            h_akhir: item.h_akhir,
            keterlambatan: days
        };

        try {
            await fetch(ENDPOINTS.dayKeterlambatan, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)});
            alert("Keterlambatan diterapkan");
            changeUlok(); 
        } catch (err) {
            alert("Error: " + err.message);
        }
    }

    window.lockSupervision = function() {
        // Validasi opsional: cek apakah ada hari pengawasan yg dipilih
        if (Object.keys(supervisionDays).length === 0) {
            if(!confirm("Anda belum memilih hari pengawasan satupun. Lanjut?")) return;
        }
        
        isSupervisionLocked = true;
        renderApiData(); // Render ulang form (ganti ke input delay)
        renderChart();   // Render ulang chart (header jadi disable)
    }

    window.unlockSupervision = function() {
        isSupervisionLocked = false;
        renderApiData(); // Render ulang form (kembali ke instruksi pengawasan)
        renderChart();   // Render ulang chart (header jadi clickable)
    }

    // FIX: LOGIKA CLICK HEADER (ADD/REMOVE)
    window.handleHeaderClick = async function(dayNum, el) {
        // 1. Cek Permission
        if(APP_MODE !== 'pic' || !isProjectLocked) return;
        if(isSupervisionLocked) {
            alert("Mode input keterlambatan sedang aktif. Klik 'Ubah Pengawasan' jika ingin mengedit hari pengawasan.");
            return;
        }
        const isRemoving = supervisionDays[dayNum];
        const confirmMsg = isRemoving ? `Hapus pengawasan hari ${dayNum}?` : `Set pengawasan hari ${dayNum}?`;
        
        // 2. Konfirmasi User
        if(!confirm(confirmMsg)) return;

        // 3. Siapkan Base Payload
        const payload = {
            "nomor_ulok": currentProject.ulokClean,
            "lingkup_pekerjaan": currentProject.work.toUpperCase()
        };

        // 4. Tentukan Mode Payload (Insert vs Remove)
        if (isRemoving) {
            // Mode Remove: Hanya kirim remove_day
            payload.remove_day = dayNum;
        } else {
            // Mode Insert: Hanya kirim pengawasan_day
            payload.pengawasan_day = dayNum;
        }

        try {
            // 5. Kirim ke API
            console.log("Sending Payload:", payload); // Debugging
            const response = await fetch(ENDPOINTS.pengawasanInsert, { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Gagal update data ke server");

            // 6. Update State Lokal & Render Ulang
            if(isRemoving) {
                delete supervisionDays[dayNum];
            } else {
                supervisionDays[dayNum] = true;
            }
            
            renderChart();

        } catch (err) {
            console.error(err);
            alert("Gagal update pengawasan: " + err.message);
        }
    }

    // ==================== 12. CHART RENDER ====================
    function renderChart() {
        const chart = document.getElementById('ganttChart');
        const DAY_WIDTH = 40;
        const ROW_HEIGHT = 50; // Tinggi baris sesuai CSS

        // 1. Hitung Lebar Chart
        let maxTaskEndDay = 0;
        currentTasks.forEach(task => {
            if (task.inputData && task.inputData.ranges) {
                task.inputData.ranges.forEach(range => {
                    if (range.end > maxTaskEndDay) maxTaskEndDay = range.end;
                });
            }
        });

        const totalDaysToRender = Math.max(
            (currentProject.work === 'ME' ? totalDaysME : totalDaysSipil),
            maxTaskEndDay + 10
        );
        const totalChartWidth = totalDaysToRender * DAY_WIDTH;
        const projectStartDate = new Date(currentProject.startDate);

        // 2. Setup Header & Interactive Logic
        const isInteractive = APP_MODE === 'pic' && isProjectLocked && !isSupervisionLocked;
        let headerTitle = "";
        if (APP_MODE === 'pic' && isProjectLocked) {
            headerTitle = isSupervisionLocked 
                ? "Klik 'Ubah Pengawasan' untuk mengedit" 
                : "Klik untuk set Pengawasan";
        }
        const cursorStyle = isInteractive ? "cursor: pointer;" : "cursor: default;";

        // 3. Render Header HTML
        let html = '<div class="chart-header">';
        html += '<div class="task-column">Tahapan</div>';
        html += `<div class="timeline-column" style="width: ${totalChartWidth}px;">`;
        for (let i = 0; i < totalDaysToRender; i++) {
            const dayNumber = i + 1;
            const isSup = supervisionDays[dayNumber] === true;
            const clss = isSup ? "day-header supervision-active" : "day-header";
            const clickEvent = isInteractive ? `onclick="handleHeaderClick(${dayNumber}, this)"` : '';
            html += `<div class="${clss}" style="width:${DAY_WIDTH}px; box-sizing: border-box; ${cursorStyle}" ${clickEvent} title="${headerTitle}"><span class="d-date" style="font-weight:bold; font-size:14px;">${dayNumber}</span></div>`;
        }
        html += "</div></div>";

        // 4. Render Body & Siapkan Koordinat Garis
        html += '<div class="chart-body" style="position:relative;">'; // Tambah relative positioning
        
        let taskCoordinates = {}; // Simpan koordinat (id -> {x, y})

        currentTasks.forEach((task, index) => {
            const ranges = task.inputData?.ranges || [];
            let durTxt = ranges.reduce((s,r)=>s+r.duration,0);
            
            // Simpan Koordinat untuk Dependency (Ambil range paling akhir untuk Start Point, range paling awal untuk End Point)
            const maxEnd = ranges.length ? Math.max(...ranges.map(r=>r.end)) : 0;
            const minStart = ranges.length ? Math.min(...ranges.map(r=>r.start)) : 0;
            
            taskCoordinates[task.id] = {
                y: (index * ROW_HEIGHT) + (ROW_HEIGHT / 2), // Titik tengah vertikal baris
                endX: maxEnd * DAY_WIDTH,
                startX: (minStart - 1) * DAY_WIDTH
            };

            // HTML Row
            html += `<div class="task-row"><div class="task-name"><span>${task.name}</span><span class="task-duration">${durTxt} hari</span></div>`;
            html += `<div class="timeline" style="width: ${totalChartWidth}px;">`;

            ranges.forEach((range, idx) => {
                const leftPos = (range.start - 1) * DAY_WIDTH;
                const widthPos = (range.duration * DAY_WIDTH) - 1;
                const tStart = new Date(projectStartDate); tStart.setDate(projectStartDate.getDate() + (range.start - 1));
                const tEnd = new Date(tStart); tEnd.setDate(tStart.getDate() + range.duration - 1);

                const hasDelay = range.keterlambatan && range.keterlambatan > 0;
                const barClass = hasDelay ? "bar on-time has-delay" : "bar on-time";
                const barStyle = hasDelay
                    ? `left: ${leftPos}px; width: ${widthPos}px; box-sizing: border-box; border: 2px solid #e53e3e;`
                    : `left: ${leftPos}px; width: ${widthPos}px; box-sizing: border-box;`;

                html += `<div class="${barClass}" style="${barStyle}" title="${task.name}"> ${range.duration}</div>`;
                
                if (hasDelay) {
                    const delayLeftPos = range.end * DAY_WIDTH;
                    const delayWidthPos = range.keterlambatan * DAY_WIDTH - 1;
                    html += `<div class="bar delayed" style="left:${delayLeftPos}px; width:${delayWidthPos}px; background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%); opacity: 0.85;">+${range.keterlambatan}</div>`;
                }
            });

            // Supervision Markers
            for(const [day, isActive] of Object.entries(supervisionDays)) {
                if(isActive) {
                    const dInt = parseInt(day);
                    const inRange = ranges.some(r => dInt >= r.start && dInt <= r.end);
                    if(inRange) html += `<div class="supervision-marker" style="left:${(dInt-1)*DAY_WIDTH}px"></div>`;
                }
            }
            html += `</div></div>`; // End Timeline & TaskRow
        });

        // 5. Generate SVG Lines (Dependency)
        let svgLines = '';
        currentTasks.forEach(task => {
            if (task.dependency) {
                const parent = taskCoordinates[task.dependency];
                const me = taskCoordinates[task.id];

                if (parent && me && parent.endX > 0 && me.startX > 0) {
                    const startX = parent.endX;
                    const startY = parent.y;
                    const endX = me.startX;
                    const endY = me.y;
                    const controlOffset = 20; 
                    const path = `M ${startX} ${startY} 
                                C ${startX + controlOffset} ${startY}, 
                                ${endX - controlOffset} ${endY}, 
                                ${endX} ${endY}`;
                    
                    svgLines += `<path d="${path}" class="dependency-line"/>`;
                }
            }
        });
        const svgHeight = currentTasks.length * ROW_HEIGHT;
        html += `
            <svg class="chart-lines-svg" style="width:${totalChartWidth}px; height:${svgHeight}px;">
                ${svgLines}
            </svg>
        `;

        html += `</div>`; // End Chart Body
        chart.innerHTML = html;
    }

    function updateProjectFromRab(rab) {
        if(rab.Alamat) currentProject.alamat = rab.Alamat;
        if(rab.Nama_Toko) currentProject.store = rab.Nama_Toko;
    }

    function renderProjectInfo() {
        document.getElementById("projectInfo").innerHTML = `
            <div class="project-detail"><div class="project-label">No. Ulok</div><div class="project-value">${currentProject.ulokClean}</div></div>
            <div class="project-detail"><div class="project-label">Toko</div><div class="project-value">${currentProject.store}</div></div>
            <div class="project-detail"><div class="project-label">Lingkup</div><div class="project-value">${currentProject.work}</div></div>
        `;
    }

    function updateStats() {
        document.getElementById("stats").innerHTML = `
            <div class="stat-card"><div class="stat-value">${currentTasks.length}</div><div class="stat-label">Total Tahapan</div></div>
        `;
    }

    // Start
    loadDataAndInit();
});