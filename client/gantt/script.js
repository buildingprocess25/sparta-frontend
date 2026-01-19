/* global XLSX */

document.addEventListener('DOMContentLoaded', () => {
    // ==================== 1. ROLE & SESSION HANDLING ====================
    const userRole = sessionStorage.getItem('userRole');
    const loggedInUserEmail = sessionStorage.getItem('loggedInUserEmail');
    const loggedInUserCabang = sessionStorage.getItem('loggedInUserCabang');

    // Security Check
    if (!userRole) {
        alert("Sesi Anda telah habis atau tidak valid. Silakan login kembali.");
        window.location.replace('../../auth/index.html'); // Sesuaikan dengan path login Anda
        return;
    }

    // Role Mapping Configuration
    // Kita kelompokkan Role menjadi dua "Mode": 'kontraktor' atau 'pic'
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

    // Update UI Header (Matches Svdokumen Style)
    // 1. Set Role
    const roleBadge = document.getElementById('roleBadge');
    if (roleBadge) {
        roleBadge.textContent = userRole; 
    }
    
    // 2. Set User Name (Identifier)
    const nameDisplay = document.getElementById('userNameDisplay');
    if (nameDisplay) {
        // Jika Kontraktor -> Tampilkan Email, Jika PIC -> Tampilkan Cabang/User
        const displayName = APP_MODE === 'kontraktor' ? loggedInUserEmail : (loggedInUserCabang || 'User PIC');
        nameDisplay.textContent = displayName;
    }

    // ==================== 2. CONFIGURATION ====================
    const API_BASE_URL = "https://sparta-backend-5hdj.onrender.com/api";

    const ENDPOINTS = {
        // Logika endpoint list proyek:
        // Jika KONTRAKTOR -> ambil by email
        // Jika PIC (Manager/Coord/Support) -> ambil by cabang
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
    let filteredCategories = null;
    let supervisionDays = {}; 
    let checkpoints = {}; 

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

    // ==================== 5. HELPER FUNCTIONS ====================
    function formatDateID(date) {
        return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
    }

    function parseDateDDMMYYYY(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.split('/');
        if (parts.length !== 3) return null;
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const date = new Date(year, month, day);
        return isNaN(date.getTime()) ? null : date;
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
        document.getElementById("exportButtons").style.display = "none";
        
        const cpSection = document.getElementById("checkpointSection");
        if(cpSection) cpSection.style.display = "none";
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
        // Hapus listener lama jika ada (optional, browser handles this usually)
        ulokSelect.innerHTML = '<option value="">-- Pilih Proyek --</option>';

        projects.forEach(project => {
            projectTasks[project.ulok] = [];
            const option = document.createElement("option");
            option.value = project.ulok;
            option.textContent = `${project.ulok} | ${project.store} (${project.work})`;
            ulokSelect.appendChild(option);
        });

        // Event listener pasang disini, bukan di HTML onchange
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
        checkpoints = {};
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
        
        if (hasUserInput || isProjectLocked) {
            renderChart();
            document.getElementById("exportButtons").style.display = "block";
        } else {
             document.getElementById("ganttChart").innerHTML = `
                <div style="text-align: center; padding: 60px; color: #6c757d;">
                    <div style="font-size: 48px; margin-bottom: 20px;">ℹ️</div>
                    <h2 style="margin-bottom: 15px;">Belum Ada Jadwal</h2>
                    <p>${APP_MODE === 'kontraktor' ? 'Silakan input jadwal pada form di atas.' : 'Menunggu Kontraktor membuat jadwal.'}</p>
                </div>`;
        }
        
        updateStats();

        // Checkpoint UI only for PIC roles
        const cpSection = document.getElementById("checkpointSection");
        if(APP_MODE === 'pic') {
            if(cpSection) cpSection.style.display = "block";
            populateCheckpointTasks();
            renderCheckpointList();
        } else {
            if(cpSection) cpSection.style.display = "none";
        }
    }

    async function fetchGanttData(selectedValue) {
        const { ulok, lingkup } = extractUlokAndLingkup(selectedValue);
        const url = `${ENDPOINTS.ganttData}?ulok=${encodeURIComponent(ulok)}&lingkup=${encodeURIComponent(lingkup)}`;
        
        isLoadingGanttData = true;
        renderApiData(); // Show loading in input area

        try {
            const response = await fetch(url);
            if (response.status === 404) throw new Error("NOT_FOUND");
            const data = await response.json();
            
            ganttApiData = data;
            rawGanttData = data.gantt_data;

            if (data.rab) updateProjectFromRab(data.rab);
            if (data.day_gantt_data) dayGanttData = data.day_gantt_data;
            
            if (data.checkpoints) {
                 for (const taskId in data.checkpoints) {
                    checkpoints[taskId] = data.checkpoints[taskId].map(cp => ({ day: parseInt(cp.day), taskName: cp.taskName }));
                }
            }
            if (rawGanttData) parseSupervisionFromGanttData(rawGanttData);

            if (rawGanttData) {
                const status = String(rawGanttData.Status || '').toLowerCase();
                isProjectLocked = ['terkunci', 'locked', 'published'].includes(status);
                parseGanttDataToTasks(rawGanttData, selectedValue, dayGanttData);
                hasUserInput = true;
            } else {
                loadDefaultTasks(selectedValue);
            }

        } catch (e) {
            console.warn("Using default template", e);
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
    function parseGanttDataToTasks(ganttData, selectedValue, dayData) {
        let tasks = [];
        let i = 1;
        let earliestDate = new Date(); 

        let tempCategories = [];
        while(true) {
            if(!ganttData[`Kategori_${i}`]) break;
            tempCategories.push({
                id: i,
                name: ganttData[`Kategori_${i}`],
                keterlambatan: parseInt(ganttData[`Keterlambatan_Kategori_${i}`]) || 0
            });
            i++;
        }

        let rangeMap = {}; 
        
        if (dayData && dayData.length > 0) {
            dayData.forEach(d => {
                const dt = parseDateDDMMYYYY(d.h_awal);
                if(dt && dt < earliestDate) earliestDate = dt;
            });
            currentProject.startDate = earliestDate.toISOString().split('T')[0];

            dayData.forEach(d => {
                const kat = d.Kategori;
                if(!kat) return;
                const startD = parseDateDDMMYYYY(d.h_awal);
                const endD = parseDateDDMMYYYY(d.h_akhir);
                if(!startD || !endD) return;

                const msDay = 86400000;
                const s = Math.round((startD - earliestDate) / msDay) + 1;
                const e = Math.round((endD - earliestDate) / msDay) + 1;
                
                if(!rangeMap[kat]) rangeMap[kat] = [];
                rangeMap[kat].push({
                    start: s > 0 ? s : 1,
                    end: e > 0 ? e : 1,
                    duration: (e - s + 1) > 0 ? (e - s + 1) : 1,
                    keterlambatan: parseInt(d.keterlambatan || 0)
                });
            });
        }

        tasks = tempCategories.map(cat => {
            let ranges = [];
            const normName = cat.name.toLowerCase().trim();
            for(const [k, v] of Object.entries(rangeMap)) {
                if(normName.includes(k.toLowerCase().trim()) || k.toLowerCase().trim().includes(normName)) {
                    ranges = v;
                    break;
                }
            }

            const totalDur = ranges.reduce((acc, r) => acc + r.duration, 0);
            const minStart = ranges.length ? Math.min(...ranges.map(r => r.start)) : 0;
            
            return {
                id: cat.id,
                name: cat.name,
                start: minStart,
                duration: totalDur,
                keterlambatan: cat.keterlambatan,
                dependencies: [],
                inputData: { ranges: ranges }
            };
        });

        currentTasks = tasks;
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

        // Logic Switch Tampilan berdasarkan Mode
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
                        <h3 style="color: #c05621; margin:0;">🔓 Menunggu Kontraktor</h3>
                        <p style="margin-top:5px;">Kontraktor belum mengunci jadwal. Anda belum dapat input keterlambatan.</p>
                    </div>`;
            } else {
                renderPicDelayForm(container);
            }
        }
    }

    // --- FORM KONTRAKTOR ---
    window.renderContractorInputForm = function(container) { // Attach to window for onclick access
        let html = `<div class="api-card"><div class="api-card-title">Input Jadwal (Multi-Range)</div><div class="task-input-container">`;
        
        currentTasks.forEach(task => {
            const ranges = task.inputData.ranges || [];
            html += `<div class="task-input-row-multi" id="task-row-${task.id}">
                <div class="task-input-label-multi">${escapeHtml(task.name)}</div>
                <div class="task-ranges-container" id="ranges-${task.id}">`;
            
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
        
        currentTasks.forEach(t => {
            const ranges = t.inputData.ranges || [];
            if(ranges.length > 0) {
                 const pStart = new Date(currentProject.startDate);
                 const tStart = new Date(pStart); tStart.setDate(pStart.getDate() + ranges[0].start - 1);
                 const tEnd = new Date(pStart); tEnd.setDate(pStart.getDate() + ranges[ranges.length-1].end - 1);
                 
                 payload[`Kategori_${t.id}`] = t.name; 
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
            if(status === 'Terkunci') { isProjectLocked = true; renderApiData(); }
            
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
        if(APP_MODE !== 'pic') return;
        
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

    // ==================== 12. CHART RENDER ====================
    function renderChart() {
        const chart = document.getElementById("ganttChart");
        const DAY_WIDTH = 40;
        
        let maxEnd = 0;
        currentTasks.forEach(t => {
            (t.inputData.ranges||[]).forEach(r => maxEnd = Math.max(maxEnd, r.end));
        });
        
        // Cek juga checkpoint untuk menentukan panjang chart
        let maxCp = 0;
        Object.values(checkpoints).forEach(arr => arr.forEach(c => maxCp = Math.max(maxCp, c.day)));

        const totalDays = Math.max(maxEnd + 10, maxCp + 5, currentProject.work==='ME'?50:100);
        const totalW = totalDays * DAY_WIDTH;

        let html = `<div class="chart-header"><div class="task-column">Tahapan</div><div class="timeline-column" style="width:${totalW}px">`;
        for(let i=1; i<=totalDays; i++) {
            const isSup = supervisionDays[i];
            const clss = isSup ? "day-header supervision-active" : "day-header";
            const title = APP_MODE === 'pic' ? "Klik untuk set Pengawasan" : "";
            html += `<div class="${clss}" style="width:${DAY_WIDTH}px" onclick="handleHeaderClick(${i}, this)" title="${title}">${i}</div>`;
        }
        html += `</div></div><div class="chart-body">`;

        currentTasks.forEach((t) => {
            const ranges = t.inputData.ranges || [];
            if(!ranges.length && t.duration===0) return;
            
            let durTxt = ranges.reduce((s,r)=>s+r.duration,0);
            html += `<div class="task-row"><div class="task-name"><span>${t.name}</span><span class="task-duration">${durTxt} hari</span></div>`;
            html += `<div class="timeline" style="width:${totalW}px">`;

            ranges.forEach((r) => {
                const l = (r.start - 1) * DAY_WIDTH;
                const w = r.duration * DAY_WIDTH;
                html += `<div class="bar on-time ${r.keterlambatan > 0 ? 'has-delay':''}" style="left:${l}px; width:${w}px" title="Durasi: ${r.duration}">${r.duration}</div>`;
                
                if(r.keterlambatan > 0) {
                    const lD = r.end * DAY_WIDTH;
                    const wD = r.keterlambatan * DAY_WIDTH;
                    html += `<div class="bar delayed" style="left:${lD}px; width:${wD}px" title="Telat: ${r.keterlambatan}">+${r.keterlambatan}</div>`;
                }
            });

            if(checkpoints[t.id]) {
                checkpoints[t.id].forEach(cp => {
                    const lC = (cp.day - 1) * DAY_WIDTH;
                    html += `<div class="checkpoint-marker" style="left:${lC}px"><div class="checkpoint-label">CP ${cp.day}</div></div>`;
                });
            }
            
            // Render supervision marker di baris task jika range masuk
            for(const [day, isActive] of Object.entries(supervisionDays)) {
                if(isActive) {
                    const dInt = parseInt(day);
                    // Cek apakah hari ini masuk di salah satu range task ini
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
    }

    // ==================== 13. CHECKPOINTS & INFO ====================
    window.populateCheckpointTasks = function() {
        const sel = document.getElementById("checkpointTaskSelect");
        if(!sel) return;
        sel.innerHTML = '<option value="">-- Pilih --</option>';
        currentTasks.forEach(t => sel.innerHTML += `<option value="${t.id}">${t.name}</option>`);
    }

    window.addCheckpoint = function() {
        const tId = document.getElementById("checkpointTaskSelect").value;
        const d = parseInt(document.getElementById("checkpointDayInput").value);
        if(!tId || !d) return;
        
        if(!checkpoints[tId]) checkpoints[tId] = [];
        checkpoints[tId].push({day: d, taskName: currentTasks.find(x=>x.id==tId).name});
        renderCheckpointList();
        renderChart();
    }

    window.removeCheckpoint = function(tid, d) {
        if(!confirm("Hapus checkpoint?")) return;
        checkpoints[tid] = checkpoints[tid].filter(x => x.day !== d);
        renderCheckpointList();
        renderChart();
    }

    window.renderCheckpointList = function() {
        const div = document.getElementById("checkpointList");
        if(!div) return;
        div.innerHTML = '';
        Object.entries(checkpoints).forEach(([tid, cps]) => {
            cps.forEach(cp => {
                div.innerHTML += `<div class="checkpoint-item"><span>${cp.taskName} (Hari ${cp.day})</span> <button class="btn-checkpoint-delete" onclick="removeCheckpoint(${tid}, ${cp.day})">Hapus</button></div>`;
            });
        });
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

    // ==================== 14. EXPORT ====================
    window.exportToExcel = function() {
        if (!currentProject || !currentTasks.length) return;
        const startDate = new Date(currentProject.startDate);
        const data = [
            ["Laporan Jadwal Proyek"],
            ["No. Ulok", currentProject.ulok],
            ["Nama Toko", currentProject.store],
            [],
            ["No", "Tahapan", "Range Hari", "Total Durasi"]
        ];
        
        currentTasks.forEach((task, i) => {
            const ranges = task.inputData.ranges || [];
            if (ranges.length === 0) return;
            
            const rangeStr = ranges.map(r => `H${r.start}-H${r.end}`).join(", ");
            const totalDur = ranges.reduce((sum,r)=>sum+r.duration,0);
            
            data.push([i + 1, task.name, rangeStr, totalDur]);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Jadwal");
        XLSX.writeFile(wb, `Jadwal_${currentProject.ulokClean}.xlsx`);
    }

    // Start
    loadDataAndInit();
});