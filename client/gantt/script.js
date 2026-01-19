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
        const options = { day: 'numeric', month: 'short', year: 'numeric' };
        return date.toLocaleDateString('id-ID', options);
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

        if (!selectedUlok) {
            currentProject = null;
            showSelectProjectMessage();
            return;
        }

        localStorage.setItem("lastSelectedUlok", selectedUlok);
        currentProject = projects.find(p => p.ulok === selectedUlok);
        
        await fetchGanttData(selectedUlok);
        
        renderProjectInfo();
        renderApiData(); 
        
        // Logic Tampilan Chart (Persistent):
        // Jika data sudah diinput (hasUserInput), tampilkan chart.
        // Ini berlaku untuk Kontraktor (habis refresh) atau PIC (view only)
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
            
            if (rawGanttData) parseSupervisionFromGanttData(rawGanttData);

            if (rawGanttData) {
                const status = String(rawGanttData.Status || '').toLowerCase();
                isProjectLocked = ['terkunci', 'locked', 'published'].includes(status);
                
                // Gunakan fungsi parsing yang sama persis dengan script kontraktor
                parseGanttDataToTasks(rawGanttData, selectedValue, dayGanttData);
                
                // Set flag bahwa data ada
                hasUserInput = true;
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

    // ==================== 8. PARSING LOGIC (PORTED FROM KONTRAKTOR SCRIPT) ====================
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

                // Normalize Key for Mapping
                const key = kategori.toLowerCase().trim();
                if (!categoryRangesMap[key]) {
                    categoryRangesMap[key] = [];
                }

                // Parse keterlambatan value
                const keterlambatanValue = parseInt(entry.keterlambatan, 10) || 0;

                categoryRangesMap[key].push({
                    start: startDay > 0 ? startDay : 1,
                    end: endDay > 0 ? endDay : 1,
                    duration: duration > 0 ? duration : 1,
                    keterlambatan: keterlambatanValue,
                    hAwal: hAwalStr,
                    hAkhir: hAkhirStr
                });
            });
        } else {
            // No day_gantt_data, use current date as start
            earliestDate = new Date();
            currentProject.startDate = earliestDate.toISOString().split('T')[0];
        }

        // Build dynamic tasks with ranges from day_gantt_data
        tempTaskList.forEach(item => {
            // Find matching ranges by normalizing category names
            const normalizedName = item.name.toLowerCase().trim();
            let ranges = [];

            // Try to find ranges by matching category name (Flexible Match)
            for (const [kategoriKey, rangeArray] of Object.entries(categoryRangesMap)) {
                if (normalizedName === kategoriKey ||
                    normalizedName.includes(kategoriKey) ||
                    kategoriKey.includes(normalizedName)) {
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
    }

    function parseSupervisionFromGanttData(ganttData) {
        supervisionDays = {};
        for (let i = 1; i <= 10; i++) {
            const key = `Pengawasan_${i}`;
            const value = ganttData[key];
            if (value && !isNaN(parseInt(value))) {
                supervisionDays[parseInt(value)] = true;
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
            // Logic: PIC tetap melihat warning ini, TAPI Chart di bawah tetap dirender oleh changeUlok() karena hasUserInput=true
            if (!isProjectLocked) {
                container.innerHTML = `
                    <div class="api-card warning">
                        <h3 style="color: #c05621; margin:0;">🔓 Menunggu Kunci Jadwal</h3>
                        <p style="margin-top:5px;">Kontraktor belum mengunci jadwal. Anda dapat melihat chart namun belum bisa input Pengawasan/Keterlambatan.</p>
                    </div>`;
            } else {
                renderPicDelayForm(container);
            }
        }
    }

    // --- FORM KONTRAKTOR ---
    window.renderContractorInputForm = function(container) { 
        let html = `<div class="api-card"><div class="api-card-title">Input Jadwal (Multi-Range)</div><div class="task-input-container">`;
        
        currentTasks.forEach(task => {
            const ranges = task.inputData.ranges || [];
            html += `<div class="task-input-row-multi" id="task-row-${task.id}">
                <div class="task-input-label-multi">${escapeHtml(task.name)}</div>
                <div class="task-ranges-container" id="ranges-${task.id}">`;
            
            // Render existing ranges or at least one empty
            const rangesToRender = ranges.length > 0 ? ranges : [{start: 0, end: 0}];
            
            rangesToRender.forEach((r, idx) => {
                html += createRangeHTML(task.id, idx, r.start, r.end);
            });

            html += `</div><button class="btn-add-range" onclick="addRange(${task.id})">+ Tambah Hari</button></div>`;
        });

        html += `</div>
            <div class="task-input-actions">
                <button class="btn-reset-schedule" onclick="resetTaskSchedule()">Reset</button>
                <button class="btn-apply-schedule" onclick="applyTaskSchedule()">Terapkan Jadwal</button>
            </div>
            <div class="task-input-actions" style="border-top:none; padding-top:0;">
                <button class="btn-publish" onclick="confirmAndPublish()">🔒 Kunci Jadwal</button>
            </div>
        </div>`;
        container.innerHTML = html;
    }

    window.createRangeHTML = function(taskId, idx, start, end) {
        return `
        <div class="range-input-group" data-range-idx="${idx}">
            <div class="input-group"><label>H</label><input type="number" class="task-day-input" data-task-id="${taskId}" data-type="start" value="${start}" min="0"></div>
            <span class="input-separator">-</span>
            <div class="input-group"><label>H</label><input type="number" class="task-day-input" data-task-id="${taskId}" data-type="end" value="${end}" min="0"></div>
            <button class="btn-remove-range" onclick="removeRange(${taskId}, ${idx})">×</button>
        </div>`;
    }

    // --- FORM PIC (DELAY) ---
    window.renderPicDelayForm = function(container) {
        let optionsHtml = '<option value="">-- Pilih Tahapan --</option>';
        
        if (dayGanttData) {
            dayGanttData.forEach((d, idx) => {
                optionsHtml += `<option value="${idx}" data-idx="${idx}" data-delay="${d.keterlambatan||0}">${d.Kategori} (${d.h_awal} - ${d.h_akhir}) ${d.keterlambatan ? `(+${d.keterlambatan} delay)` : ''}</option>`;
            });
        } else {
            currentTasks.forEach(t => {
                optionsHtml += `<option value="${t.name}">${t.name}</option>`;
            });
        }

        container.innerHTML = `
            <div class="delay-control-card">
                <div class="delay-title">⏱️ Input Keterlambatan (Delay)</div>
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
    }

    // ==================== 10. ACTIONS: KONTRAKTOR ====================
    window.addRange = function(taskId) {
        const container = document.getElementById(`ranges-${taskId}`);
        const idx = container.children.length;
        container.insertAdjacentHTML('beforeend', createRangeHTML(taskId, idx, 0, 0));
    }

    window.removeRange = function(taskId, idx) {
        const container = document.getElementById(`ranges-${taskId}`);
        if(container.children.length <= 1) return alert("Minimal satu range.");
        container.children[idx].remove();
    }

    window.resetTaskSchedule = function() {
        if(!confirm("Reset semua inputan?")) return;
        currentTasks.forEach(t => { t.inputData.ranges = []; t.start = 0; t.duration = 0; });
        hasUserInput = false;
        renderApiData();
    }

    window.applyTaskSchedule = function() {
        let tasks = [];
        let error = false;

        currentTasks.forEach(t => {
            const container = document.getElementById(`ranges-${t.id}`);
            if(!container) { tasks.push(t); return; }
            
            let newRanges = [];
            Array.from(container.children).forEach(row => {
                const s = parseInt(row.querySelector('[data-type="start"]').value) || 0;
                const e = parseInt(row.querySelector('[data-type="end"]').value) || 0;
                if(s === 0 && e === 0) return;
                if(e < s) { error = true; alert(`Error Tahapan ${t.name}: End < Start`); }
                newRanges.push({start: s, end: e, duration: (e-s+1)});
            });
            
            const totalDur = newRanges.reduce((sum, r) => sum + r.duration, 0);
            const minStart = newRanges.length ? Math.min(...newRanges.map(r=>r.start)) : 0;
            
            tasks.push({...t, start: minStart, duration: totalDur, inputData: {ranges: newRanges}});
        });

        if(error) return;
        currentTasks = tasks;
        hasUserInput = true;
        saveProjectSchedule("Active");
        renderChart();
        updateStats();
    }

    window.confirmAndPublish = function() {
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
        
        // Build Payload
        currentTasks.forEach(t => {
            const ranges = t.inputData.ranges || [];
            payload[`Kategori_${t.id}`] = t.name; 
            
            if(ranges.length > 0) {
                 const pStart = new Date(currentProject.startDate);
                 const tStart = new Date(pStart); tStart.setDate(pStart.getDate() + ranges[0].start - 1);
                 const tEnd = new Date(pStart); tEnd.setDate(pStart.getDate() + ranges[ranges.length-1].end - 1);
                 
                 // Note: Sending ISO format to backend
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
                    "h_awal": formatDateID(dS), // Send DD/MM/YYYY to backend for consistency
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
            
            // Re-render chart to ensure persistence UI
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
            alert("Delay disimpan");
            changeUlok(); 
        } catch (err) {
            alert("Error: " + err.message);
        }
    }

    window.handleHeaderClick = async function(dayNum, el) {
        // Feature Lock: PIC only allowed when Project is Locked
        if(APP_MODE !== 'pic' || !isProjectLocked) return;
        
        const isRemoving = supervisionDays[dayNum];
        const confirmMsg = isRemoving ? `Hapus pengawasan hari ${dayNum}?` : `Set pengawasan hari ${dayNum}?`;
        if(!confirm(confirmMsg)) return;

        const payload = {
            nomor_ulok: currentProject.ulokClean,
            lingkup_pekerjaan: currentProject.work.toUpperCase(),
            pengawasan_day: isRemoving ? 0 : dayNum,
            remove_day: isRemoving ? dayNum : undefined
        };

        try {
            await fetch(ENDPOINTS.pengawasanInsert, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)});
            if(isRemoving) delete supervisionDays[dayNum];
            else supervisionDays[dayNum] = true;
            renderChart();
        } catch (err) {
            alert("Gagal update pengawasan");
        }
    }

    // ==================== 12. CHART RENDER (PORTED FROM KONTRAKTOR SCRIPT) ====================
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

        // Use consistent total days calculation matching kontraktor script
        const totalDaysToRender = Math.max(
            (currentProject.work === 'ME' ? totalDaysME : totalDaysSipil),
            maxTaskEndDay + 10
        );

        const totalChartWidth = totalDaysToRender * DAY_WIDTH;
        const projectStartDate = new Date(currentProject.startDate);

        // Interaction Logic
        const isInteractive = APP_MODE === 'pic' && isProjectLocked;
        const headerTitle = isInteractive ? "Klik untuk set Pengawasan" : "";
        const cursorStyle = isInteractive ? "cursor: pointer;" : "cursor: default;";

        let html = '<div class="chart-header">';
        html += '<div class="task-column">Tahapan</div>';
        html += `<div class="timeline-column" style="width: ${totalChartWidth}px;">`;
        
        for (let i = 0; i < totalDaysToRender; i++) {
            const dayNumber = i + 1;
            const isSup = supervisionDays[dayNumber] === true;
            const clss = isSup ? "day-header supervision-active" : "day-header";
            const clickEvent = isInteractive ? `onclick="handleHeaderClick(${dayNumber}, this)"` : '';
            
            html += `
                <div class="${clss}" style="width:${DAY_WIDTH}px; box-sizing: border-box; ${cursorStyle}" 
                     ${clickEvent} title="${headerTitle}">
                    <span class="d-date" style="font-weight:bold; font-size:14px;">${dayNumber}</span>
                </div>
            `;
        }
        html += "</div></div>";
        html += '<div class="chart-body">';

        currentTasks.forEach(task => {
            const ranges = task.inputData?.ranges || [];
            
            // Skip rendering empty tasks if duration is 0, matching kontraktor logic
            if (ranges.length === 0 && task.duration === 0) return;

            const keterlambatan = task.keterlambatan || 0;
            const totalDuration = task.duration > 0 ? task.duration :
                ranges.reduce((sum, r) => sum + (r.duration || 0), 0);
            
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

                const hasDelay = range.keterlambatan && range.keterlambatan > 0;
                const barClass = hasDelay ? "bar on-time has-delay" : "bar on-time";
                const barStyle = hasDelay
                    ? `left: ${leftPos}px; width: ${widthPos}px; box-sizing: border-box; border: 2px solid #e53e3e;`
                    : `left: ${leftPos}px; width: ${widthPos}px; box-sizing: border-box;`;

                html += `<div class="${barClass}" data-task-id="${task.id}-${idx}" 
                        style="${barStyle}" 
                        title="${task.name}: ${formatDateID(tStart)} - ${formatDateID(tEnd)}">
                    ${range.duration}
                </div>`;

                if (hasDelay) {
                    const delayLeftPos = range.end * DAY_WIDTH;
                    const delayWidthPos = range.keterlambatan * DAY_WIDTH - 1;
                    html += `<div class="bar delayed" style="left:${delayLeftPos}px; width:${delayWidthPos}px; box-sizing: border-box; background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%); opacity: 0.85;">+${range.keterlambatan}</div>`;
                }
            });

            // Supervision Markers Logic
            for(const [day, isActive] of Object.entries(supervisionDays)) {
                if(isActive) {
                    const dInt = parseInt(day);
                    const inRange = ranges.some(r => dInt >= r.start && dInt <= r.end);
                    if(inRange) {
                        html += `<div class="supervision-marker" style="left:${(dInt-1)*DAY_WIDTH}px"></div>`;
                    }
                }
            }

            html += `</div></div>`;
        });
        html += `</div>`;
        chart.innerHTML = html;
        
        // Draw dependencies if needed
        // setTimeout(drawDependencyLines, 50);
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