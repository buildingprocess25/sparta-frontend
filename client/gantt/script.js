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
        dependencyInsert: `${API_BASE_URL}/gantt/dependency/insert`
    };

    // ==================== 3. STATE MANAGEMENT ====================
    let projects = [];
    let currentProject = null;
    let projectTasks = {};
    let currentTasks = [];
    let ganttApiData = null;
    let rawGanttData = null;
    let dayGanttData = null;
    let dependencyData = [];
    let filteredCategories = null;
    let isLoadingGanttData = false;
    let hasUserInput = false;
    let isProjectLocked = false;
    let supervisionDays = {};
    let isInitializing = true; 

    // ==================== 4. RULES & TEMPLATES ====================
    const SUPERVISION_RULES = {
        10: [2, 5, 8, 10],
        14: [2, 7, 10, 14],
        20: [2, 12, 16, 20],
        30: [2, 7, 14, 18, 23, 30],
        35: [2, 7, 17, 22, 28, 35],
        40: [2, 7, 17, 25, 33, 40],
        48: [2, 10, 25, 32, 41, 48]
    };

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
        return formatDateID(targetDate);
    }

    function calculateSupervisionDays() {
        supervisionDays = {}; 
        if (!currentProject || !currentProject.duration) return;
        const dur = parseInt(currentProject.duration);
        if (isNaN(dur)) return;
        const days = SUPERVISION_RULES[dur];
        if (days && Array.isArray(days)) {
            days.forEach(dayNum => { supervisionDays[dayNum] = true; });
        }
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
                    if (parts.length >= 3) projectName = parts[1].replace(/$$ME$$|$$Sipil$$/gi, "").trim();
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
                    cabang: "",
                    kategoriLokasi: ""
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

        ulokSelect.addEventListener('change', () => {
            isInitializing = false;
            changeUlok();
        });

        const urlParams = new URLSearchParams(window.location.search);
        const autoUlok = urlParams.get('ulok');
        const autoLingkup = urlParams.get('lingkup');
        const isLocked = urlParams.get('locked');
        let foundMatch = false;

        const normalizeUlok = (code) => {
            if (!code) return '';
            return String(code).replace(/-/g, '').toUpperCase().trim();
        };

        if (autoUlok) {
            const normalizedAutoUlok = normalizeUlok(autoUlok);
            const targetProject = projects.find(p => {
                const normalizedUlokClean = normalizeUlok(p.ulokClean);
                const normalizedUlok = normalizeUlok(p.ulok);
                const isCodeMatch = normalizedUlokClean === normalizedAutoUlok ||
                    normalizedUlok.includes(normalizedAutoUlok) ||
                    normalizedAutoUlok.includes(normalizedUlokClean);
                const isScopeMatch = autoLingkup ? p.work.toLowerCase() === autoLingkup.toLowerCase() : true;
                return isCodeMatch && isScopeMatch;
            });

            if (targetProject) {
                ulokSelect.value = targetProject.ulok;
                foundMatch = true;
                changeUlok();
                if (isLocked === 'true') {
                    ulokSelect.disabled = true;
                    ulokSelect.style.backgroundColor = "#e9ecef";
                    ulokSelect.style.cursor = "not-allowed";
                    ulokSelect.title = "Terkunci: Mode Review RAB";
                    const roleBadge = document.getElementById("roleBadge");
                    if (roleBadge && !document.getElementById('lock-badge')) {
                        roleBadge.innerHTML += ` <span id="lock-badge" style="font-size:0.8em; background:#feb2b2; color:#9b2c2c; padding:2px 6px; border-radius:4px; margin-left:10px;">🔒 Mode RAB</span>`;
                    }
                }
            } else {
                const partialMatch = projects.find(p => {
                    const normalizedUlokClean = normalizeUlok(p.ulokClean);
                    return normalizedUlokClean === normalizedAutoUlok;
                });
                if (partialMatch) {
                    ulokSelect.value = partialMatch.ulok;
                    foundMatch = true;
                    changeUlok();
                    if (isLocked === 'true') {
                        ulokSelect.disabled = true;
                        ulokSelect.style.backgroundColor = "#e9ecef";
                        ulokSelect.style.cursor = "not-allowed";
                    }
                }
            }
        }

        if (!foundMatch && !ulokSelect.value) {
            ulokSelect.value = "";
            showSelectProjectMessage();
            localStorage.removeItem("lastSelectedUlok");
        }

        setTimeout(() => {
            isInitializing = false;
        }, 1000);
    }

    // ==================== 7. CORE: SELECT PROJECT & FETCH GANTT ====================
    async function changeUlok() {
        const ulokSelect = document.getElementById("ulokSelect");
        const selectedUlok = ulokSelect.value;

        supervisionDays = {};
        dayGanttData = null;
        rawGanttData = null;
        ganttApiData = null;
        dependencyData = [];
        filteredCategories = null;
        isProjectLocked = false;
        hasUserInput = false;

        if (!selectedUlok) {
            currentProject = null;
            showSelectProjectMessage();
            return;
        }

        localStorage.setItem("lastSelectedUlok", selectedUlok);
        currentProject = projects.find(p => p.ulok === selectedUlok);

        isLoadingGanttData = true;

        await fetchGanttData(selectedUlok);

        calculateSupervisionDays();

        renderProjectInfo();
        renderApiData();
        renderBottomActionBar();

        if (currentTasks.length > 0) {
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
        } else {
             // Handle jika tasks kosong sama sekali
             document.getElementById("ganttChart").innerHTML = `
                <div style="text-align: center; padding: 60px; color: #6c757d;">
                    <h2 style="margin-bottom: 15px;">🚫 Tidak Ada Item Pekerjaan</h2>
                    <p>Data RAB kosong atau tidak tersedia untuk kategori ini.</p>
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
            if (data.dependency_data) dependencyData = data.dependency_data;
            if (data.filtered_categories && Array.isArray(data.filtered_categories)) {
                filteredCategories = data.filtered_categories;
            }

            if (rawGanttData) {
                const status = String(rawGanttData.Status || '').toLowerCase();
                isProjectLocked = ['terkunci', 'locked', 'published'].includes(status);

                parseGanttDataToTasks(rawGanttData, selectedValue, dayGanttData);

                if (currentTasks.length === 0) {
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

    // --- MODIFIED FUNCTION: loadDefaultTasks ---
    function loadDefaultTasks(selectedValue) {
        let template = currentProject.work === 'ME' ? taskTemplateME : taskTemplateSipil;
        
        if (filteredCategories && Array.isArray(filteredCategories) && filteredCategories.length > 0) {
            console.log("📋 Menggunakan Filter Kategori dari RAB:", filteredCategories);
            
            currentTasks = filteredCategories.map((rabItemName, index) => {
                const rabNameClean = rabItemName.toLowerCase().trim();
                const templateMatch = template.find(t => {
                    const tName = t.name.toLowerCase().trim();
                    return tName === rabNameClean || tName.includes(rabNameClean) || rabNameClean.includes(tName);
                });
                const finalName = templateMatch ? templateMatch.name : rabItemName;

                return {
                    id: index + 1,
                    name: finalName, 
                    start: 0,
                    duration: 0,
                    dependencies: [], // ARRAY
                    keterlambatan: 0,
                    inputData: { ranges: [] }
                };
            });
        } else {
            console.warn("⚠️ Data RAB kosong. Tidak menampilkan tahapan pekerjaan.");
            currentTasks = []; 
        }

        projectTasks[selectedValue] = currentTasks;
        hasUserInput = false;
        isProjectLocked = false;
        renderApiData();
    }

    // ==================== 8. PARSING LOGIC ====================
    function parseGanttDataToTasks(ganttData, selectedValue, dayGanttDataArray = null) {
        if (!currentProject) return;

        let dynamicTasks = [];
        let earliestDate = null;
        let tempTaskList = [];
        
        // --- (Bagian logika RAB / Save Data lama tetap sama) ---
        if (filteredCategories && Array.isArray(filteredCategories) && filteredCategories.length > 0) {
            let template = currentProject.work === 'ME' ? taskTemplateME : taskTemplateSipil;
            tempTaskList = filteredCategories.map((catNameFromRab, index) => {
                const rabNameClean = catNameFromRab.toLowerCase().trim();
                const templateItem = template.find(t => {
                    const tName = t.name.toLowerCase().trim();
                    return tName === rabNameClean || tName.includes(rabNameClean) || rabNameClean.includes(tName);
                });
                const officialName = templateItem ? templateItem.name : catNameFromRab; 
                let savedKeterlambatan = 0;
                if (ganttData) {
                    let i = 1;
                    while (true) {
                        const keyName = `Kategori_${i}`;
                        const keyDelay = `Keterlambatan_Kategori_${i}`;
                        if (!ganttData.hasOwnProperty(keyName)) break;
                        const oldName = (ganttData[keyName] || "").toLowerCase().trim();
                        if (oldName && (oldName === officialName.toLowerCase().trim() || oldName.includes(rabNameClean))) {
                            savedKeterlambatan = parseInt(ganttData[keyDelay]) || 0;
                            break;
                        }
                        i++;
                    }
                }
                return { id: index + 1, name: officialName, keterlambatan: savedKeterlambatan };
            });
        } else {
            let i = 1;
            while (ganttData) {
                const kategoriKey = `Kategori_${i}`;
                const keterlambatanKey = `Keterlambatan_Kategori_${i}`;
                if (!ganttData.hasOwnProperty(kategoriKey)) break;
                const kategoriName = ganttData[kategoriKey];
                const keterlambatan = parseInt(ganttData[keterlambatanKey]) || 0;
                if (kategoriName && kategoriName.trim() !== '') {
                    tempTaskList.push({ id: i, name: kategoriName, keterlambatan: keterlambatan });
                }
                i++;
            }
        }

        // --- (Bagian mapping tanggal tetap sama) ---
        const categoryRangesMap = {};
        if (dayGanttDataArray && Array.isArray(dayGanttDataArray) && dayGanttDataArray.length > 0) {
            dayGanttDataArray.forEach(entry => {
                const hAwalStr = entry.h_awal;
                if (hAwalStr) {
                    const parsedDate = parseDateDDMMYYYY(hAwalStr);
                    if (parsedDate && !isNaN(parsedDate.getTime())) {
                        if (!earliestDate || parsedDate < earliestDate) earliestDate = parsedDate;
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

        // --- UPDATE LOGIC MAPPING DEPENDENCY ---
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

            // [FIX] Mengambil SEMUA parent ID, bukan cuma satu
            let dependencyTaskIds = [];
            if (dependencyData && dependencyData.length > 0) {
                // Cari semua entri di dependencyData dimana 'Kategori_Terikat' (Anak) == Task ini
                const parents = dependencyData.filter(d =>
                    d.Kategori_Terikat && 
                    (String(d.Kategori_Terikat).toLowerCase().trim() === normalizedName || normalizedName.includes(String(d.Kategori_Terikat).toLowerCase().trim()))
                );

                parents.forEach(p => {
                    if (p.Kategori) {
                        const parentNameNorm = String(p.Kategori).toLowerCase().trim();
                        const parentTask = tempTaskList.find(t => {
                            const tName = t.name.toLowerCase().trim();
                            return tName === parentNameNorm || tName.includes(parentNameNorm) || parentNameNorm.includes(tName);
                        });
                        if (parentTask) dependencyTaskIds.push(parentTask.id);
                    }
                });
            }

            dynamicTasks.push({
                id: item.id,
                name: item.name,
                start: minStart,
                duration: totalDuration,
                dependencies: dependencyTaskIds, // ARRAY
                keterlambatan: item.keterlambatan || 0,
                inputData: { ranges: ranges }
            });
        });

        currentTasks = dynamicTasks;
        projectTasks[selectedValue] = currentTasks;
    }

    // ==================== 9. UI RENDERING ====================
    function renderApiData() {
        const container = document.getElementById("apiData");
        if (isLoadingGanttData) {
            container.innerHTML = `<div class="api-card"><div class="api-card-title">Memuat data...</div></div>`;
            return;
        }

        if (APP_MODE === 'kontraktor') {
            if (isProjectLocked) {
                container.innerHTML = `
                    <div class="api-card locked">
                        <h3 style="color: #2f855a; margin:0;">Jadwal Terkunci</h3>
                        <p style="margin-top:5px;">Jadwal sudah diterbitkan dan tidak dapat diubah.</p>
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

    window.renderPicDelayForm = function (container) {
        if (!currentTasks || currentTasks.length === 0) {
            container.innerHTML = `
                <div class="api-card warning">
                    <h3 style="color: #c05621; margin:0;">Data Pekerjaan Kosong</h3>
                    <p style="margin-top:5px;">Tidak ada item pekerjaan yang tersedia untuk proyek ini.</p>
                </div>`;
            return;
        }

        let html = '';
        let optionsHtml = '<option value="">-- Pilih Tahapan --</option>';
        if (dayGanttData) {
            dayGanttData.forEach((d, idx) => {
                const delayVal = parseInt(d.keterlambatan || 0);
                const delayText = delayVal > 0 ? ` (+${delayVal} Hari)` : '';
                optionsHtml += `<option value="${idx}" data-idx="${idx}" data-delay="${delayVal}">${d.Kategori} (${d.h_awal} - ${d.h_akhir})${delayText}</option>`;
            });
        }

        const dur = currentProject.duration || '-';
        html += `
            <div class="api-card info" style="margin-bottom: 15px;">
                <h3 style="color: #2b6cb0; margin:0; font-size: 15px;">ℹ️ Info Pengawasan</h3>
                <p style="margin-top:5px; font-size:13px; color:#4a5568;">
                    Hari pengawasan ditentukan otomatis berdasarkan durasi proyek (<strong>${dur} Hari</strong>). 
                    Silakan input keterlambatan jika ada.
                </p>
            </div>

            <div class="delay-control-card">
                <div class="delay-title"><span>Input Keterlambatan</span></div>
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
    window.renderContractorInputForm = function (container) {
        if (!currentTasks || currentTasks.length === 0) {
            container.innerHTML = `
                <div class="api-card warning">
                    <h3 style="color: #c05621; margin:0;">Data Pekerjaan Kosong</h3>
                    <p style="margin-top:5px;">Data RAB dari server kosong. Tidak ada tahapan pekerjaan yang ditampilkan.</p>
                </div>`;
            return;
        }

        // Header Container
        let html = `
        <div class="api-card">
            <div class="api-card-header">
                <div class="api-card-title">Input Jadwal & Keterikatan</div>
                <div class="api-card-subtitle">Tentukan urutan kerja dan durasi hari untuk setiap tahapan.</div>
            </div>
            
            <div class="table-responsive-wrapper">
                <table class="schedule-input-table">
                    <thead>
                        <tr>
                            <th style="width: 5%;">No</th>
                            <th style="width: 30%;">Tahapan Pekerjaan</th>
                            <th style="width: 25%;">Keterikatan (Syarat Mulai)</th>
                            <th style="width: 40%;">Durasi (Hari Ke-)</th>
                        </tr>
                    </thead>
                    <tbody>`;

        currentTasks.forEach((task, index) => {
            const ranges = task.inputData.ranges || [];
            
            // Logic Dependensi (Parent/Child)
            const childTask = currentTasks.find(t => t.dependencies && t.dependencies.includes(task.id));
            const selectedChildId = childTask ? childTask.id : "";

            let dependencyOptions = `<option value="" class="text-gray-400">- Tidak Ada (Mulai Awal) -</option>`;

            // Filter: Hanya tampilkan task yang ID-nya lebih besar (logic sederhana waterfall)
            // Atau tampilkan semua kecuali diri sendiri untuk fleksibilitas
            currentTasks.forEach(candidate => {
                if (candidate.id > task.id) {
                    const selected = (candidate.id == selectedChildId) ? 'selected' : '';
                    dependencyOptions += `<option value="${candidate.id}" ${selected}>${candidate.id}. ${candidate.name}</option>`;
                }
            });

            html += `
            <tr>
                <td class="text-center font-bold">${task.id}</td>
                <td>
                    <div class="task-name-cell">${escapeHtml(task.name)}</div>
                </td>
                <td>
                    <select class="form-control dep-select-table" data-task-id="${task.id}">
                        ${dependencyOptions}
                    </select>
                    <div class="input-hint">Pilih tahapan selanjutnya setelah ini selesai.</div>
                </td>
                <td>
                    <div class="ranges-wrapper" id="ranges-${task.id}">`;

            // Render Existing Ranges
            const rangesToRender = ranges.length > 0 ? ranges : [{ start: 0, end: 0 }];
            rangesToRender.forEach((r, idx) => {
                const isSaved = ranges.length > 0;
                html += createRangeHTML(task.id, idx, r.start, r.end, isSaved);
            });

            html += `
                    </div>
                    <button class="btn-add-range-table" onclick="addRange(${task.id})">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Tambah Periode
                    </button>
                </td>
            </tr>`;
        });

        html += `
                    </tbody>
                </table>
            </div>

            <div class="task-input-actions">
                <button class="btn-reset-schedule" onclick="resetTaskSchedule()">Reset Semua</button>
                <button class="btn-apply-schedule" onclick="applyTaskSchedule()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                    </svg>
                    Hitung & Terapkan Jadwal
                </button>
            </div>
        </div>`;
        
        container.innerHTML = html;
    }

    window.createRangeHTML = function (taskId, idx, start, end, isSaved = false) {
        const maxDuration = currentProject && currentProject.duration ? parseInt(currentProject.duration) : 999;
        const validationLogic = `if(parseInt(this.value) > ${maxDuration}) { alert('Maksimal durasi proyek ini adalah ${maxDuration} hari'); this.value = ${maxDuration}; } if(this.value < 0) this.value = 1;`;

        // Style tombol hapus
        const deleteBtn = isSaved 
            ? `<button class="btn-icon-delete saved" onclick="removeRange(${taskId}, ${idx}, true)" title="Hapus Data Tersimpan">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>`
            : `<button class="btn-icon-delete" onclick="removeRange(${taskId}, ${idx}, false)" title="Hapus Baris">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>`;

        const readOnlyAttr = isSaved ? 'readonly' : '';
        const savedClass = isSaved ? 'input-saved' : '';

        return `
        <div class="range-row-table" id="range-group-${taskId}-${idx}" data-range-idx="${idx}">
            <div class="input-pill">
                <span class="pill-label">H</span>
                <input type="number" class="pill-input ${savedClass}" id="start-${taskId}-${idx}" 
                    data-task-id="${taskId}" data-type="start" value="${start}" 
                    min="1" max="${maxDuration}" placeholder="Start"
                    oninput="${validationLogic}" ${readOnlyAttr}>
            </div>
            <span class="range-arrow">➜</span>
            <div class="input-pill">
                <span class="pill-label">H</span>
                <input type="number" class="pill-input ${savedClass}" id="end-${taskId}-${idx}" 
                    data-task-id="${taskId}" data-type="end" value="${end}" 
                    min="1" max="${maxDuration}" placeholder="End"
                    oninput="${validationLogic}" ${readOnlyAttr}>
            </div>
            ${deleteBtn}
        </div>`;
    }

    // ==================== 10. ACTIONS: KONTRAKTOR ====================
    window.addRange = function (taskId) {
        const container = document.getElementById(`ranges-${taskId}`);
        const uniqueIdx = Date.now();
        container.insertAdjacentHTML('beforeend', createRangeHTML(taskId, uniqueIdx, 0, 0, false));
    }

    window.removeRange = async function (taskId, idx, isSaved) {
        const rowId = `range-group-${taskId}-${idx}`;
        const element = document.getElementById(rowId);
        const taskObj = currentTasks.find(t => t.id === taskId);

        if (!isSaved) {
            if (element) element.remove();
            if (taskObj && taskObj.inputData && taskObj.inputData.ranges) {
                taskObj.inputData.ranges.splice(idx, 1);
            }
            renderChart();
            renderApiData();
            return;
        }

        if (!confirm("Data ini sudah tersimpan di server. Yakin ingin menghapusnya?")) return;

        const taskName = taskObj ? taskObj.name : "";
        if (!taskName) {
            alert("Nama tahapan tidak valid.");
            return;
        }

        let dateStartStr = "";
        let dateEndStr = "";
        let foundMatch = false;

        if (dayGanttData && Array.isArray(dayGanttData)) {
            const rawDataList = dayGanttData.filter(d =>
                d.Kategori.toLowerCase().trim() === taskName.toLowerCase().trim()
            );
            if (rawDataList[idx]) {
                dateStartStr = rawDataList[idx].h_awal;
                dateEndStr = rawDataList[idx].h_akhir;
                foundMatch = true;
            }
        }

        if (!foundMatch) {
            const startVal = parseInt(document.getElementById(`start-${taskId}-${idx}`).value) || 0;
            const endVal = parseInt(document.getElementById(`end-${taskId}-${idx}`).value) || 0;
            dateStartStr = getTaskDateString(startVal);
            dateEndStr = getTaskDateString(endVal);
        }

        if (!dateStartStr || !dateEndStr) {
            alert("Gagal mendapatkan format tanggal yang valid untuk dihapus.");
            return;
        }

        const lingkupValue = currentProject.work.toUpperCase() === "ME" ? "ME" : "SIPIL";
        const payload = {
            "nomor_ulok": currentProject.ulokClean,
            "lingkup_pekerjaan": lingkupValue,
            "remove_kategori_data": [
                {
                    "Kategori": taskName,
                    "h_awal": dateStartStr,
                    "h_akhir": dateEndStr
                }
            ]
        };

        try {
            document.body.style.cursor = 'wait';
            const response = await fetch(ENDPOINTS.dayInsert, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const responseText = await response.text();
                throw new Error(responseText);
            }

            if (taskObj && taskObj.inputData && taskObj.inputData.ranges) {
                taskObj.inputData.ranges.splice(idx, 1);
            }
            if (dayGanttData) {
                const globalIdx = dayGanttData.findIndex(d =>
                    d.Kategori.toLowerCase().trim() === taskName.toLowerCase().trim() &&
                    d.h_awal === dateStartStr &&
                    d.h_akhir === dateEndStr
                );
                if (globalIdx !== -1) {
                    dayGanttData.splice(globalIdx, 1);
                }
            }

            renderApiData();
            renderChart();
            alert("Data berhasil dihapus.");

        } catch (err) {
            console.error("Remove Failed:", err);
            alert("Gagal menghapus: " + err.message);
        } finally {
            document.body.style.cursor = 'default';
        }
    }

    window.resetTaskSchedule = function () {
        if (!confirm("Reset semua inputan?")) return;
        currentTasks.forEach(t => {
            t.inputData.ranges = [];
            t.start = 0;
            t.duration = 0;
            t.dependencies = [];
        });
        hasUserInput = false;
        dependencyData = [];
        renderApiData();
        renderBottomActionBar();
        document.getElementById("ganttChart").innerHTML = `
            <div style="text-align: center; padding: 60px; color: #6c757d;">
                <div style="font-size: 48px; margin-bottom: 20px;">ℹ️</div>
                <h2 style="margin-bottom: 15px;">Belum Ada Jadwal</h2>
                <p>Silakan input jadwal pada form di atas.</p>
            </div>`;
        updateStats();
    }

    window.applyTaskSchedule = async function () { 
        if (isInitializing) return;
        document.body.style.cursor = 'wait';
        const btnApply = document.querySelector('.btn-apply-schedule');
        if (btnApply) btnApply.textContent = "Menyimpan...";

        let tempTasks = JSON.parse(JSON.stringify(currentTasks));
        let error = false;
        const maxAllowedDay = currentProject && currentProject.duration ? parseInt(currentProject.duration) : 999;

        // [FIX] Reset array dependencies
        tempTasks.forEach(t => t.dependencies = []); 
        let newDependencyList = [];

        // Loop setiap input dropdown
        currentTasks.forEach(realTask => {
            const container = document.getElementById(`ranges-${realTask.id}`);
            const depSelect = document.querySelector(`.dep-select[data-task-id="${realTask.id}"]`);
            const selectedChildId = depSelect ? parseInt(depSelect.value) : null;

            // [FIX] Logic Push ke Array Dependencies
            if (selectedChildId) {
                const childTaskInTemp = tempTasks.find(t => t.id === selectedChildId);
                const parentTaskInTemp = tempTasks.find(t => t.id === realTask.id);
                
                if (childTaskInTemp && parentTaskInTemp) {
                    // Masukkan ID Parent ke dalam list dependencies Anak
                    if(!childTaskInTemp.dependencies.includes(realTask.id)){
                        childTaskInTemp.dependencies.push(realTask.id);
                    }
                    
                    newDependencyList.push({
                        parentName: parentTaskInTemp.name,
                        childName: childTaskInTemp.name
                    });
                }
            }

            if (container) {
                let newRanges = [];
                Array.from(container.children).forEach(row => {
                    const s = parseInt(row.querySelector('[data-type="start"]').value) || 0;
                    const e = parseInt(row.querySelector('[data-type="end"]').value) || 0;
                    if (s !== 0 && e !== 0) {
                        if (e < s) error = true;
                        if (e > maxAllowedDay) error = true;
                        newRanges.push({ start: s, end: e, duration: e - s + 1 });
                    }
                });
                const myTaskInTemp = tempTasks.find(t => t.id === realTask.id);
                if (myTaskInTemp) myTaskInTemp.inputData = { ranges: newRanges };
            }
        });

        if (error) {
            alert("Terdapat kesalahan pada input tanggal (Cek durasi max / start > end).");
            document.body.style.cursor = 'default';
            if (btnApply) btnApply.textContent = "Hitung & Terapkan Jadwal";
            return;
        }

        console.log("⚠️ Validasi strict mode dinonaktifkan: Overlap jadwal diperbolehkan.");

        tempTasks.forEach(task => {
            const ranges = task.inputData.ranges;
            const totalDur = ranges.reduce((sum, r) => sum + r.duration, 0);
            const minStart = ranges.length ? Math.min(...ranges.map(r => r.start)) : 0;
            task.start = minStart;
            task.duration = totalDur;
            if (task.computed) task.computed.shift = 0;
        });

        currentTasks = tempTasks;
        hasUserInput = true;

        try {
            await saveProjectSchedule("Active");

            if (dependencyData.length > 0) {
                const removePayload = {
                    "nomor_ulok": currentProject.ulokClean,
                    "lingkup_pekerjaan": currentProject.work.toUpperCase(),
                    // Hapus semua dependensi lama (karena API backend mungkin perlu clear all first)
                    "remove_dependency_data": dependencyData.map(d => ({
                        "Kategori": d.Kategori,
                        "Kategori_Terikat": d.Kategori_Terikat 
                    }))
                };
                await fetch(ENDPOINTS.dependencyInsert, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(removePayload)
                });
            }

            if (newDependencyList.length > 0) {
                const insertPayload = {
                    "nomor_ulok": currentProject.ulokClean,
                    "lingkup_pekerjaan": currentProject.work.toUpperCase(),
                    "dependency_data": newDependencyList.map(item => ({
                        "Kategori": item.parentName.toUpperCase(),
                        "Kategori_Terikat": item.childName.toUpperCase()
                    }))
                };
                await fetch(ENDPOINTS.dependencyInsert, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(insertPayload)
                });
            }

            dependencyData = newDependencyList.map(item => ({
                "Nomor Ulok": currentProject.ulokClean,
                "Lingkup_Pekerjaan": currentProject.work.toUpperCase(),
                "Kategori": item.parentName,
                "Kategori_Terikat": item.childName
            }));

        } catch (err) {
            console.error("Sync Error:", err);
            alert("Jadwal tersimpan, namun gagal menyimpan data keterikatan: " + err.message);
        } finally {
            document.body.style.cursor = 'default';
            if (btnApply) btnApply.textContent = "Hitung & Terapkan Jadwal";
        }

        renderChart();
        updateStats();
        renderApiData(); 
        renderBottomActionBar(); 
    }

    window.renderBottomActionBar = function () {
        const container = document.getElementById('bottom-action-container');
        if (!container) return;
        container.innerHTML = '';
        if (APP_MODE !== 'kontraktor') return;

        // Jangan render tombol jika tasks kosong
        if (!currentTasks || currentTasks.length === 0) return;

        if (isProjectLocked) {
            container.innerHTML = `
                <div class="bottom-info-text">
                    ✅ <strong>Status: Terkunci.</strong> Jadwal telah diterbitkan ke PIC.
                </div>`;
            return;
        }

        const isAllDatesFilled = currentTasks.length > 0 && currentTasks.every(t =>
            t.inputData && t.inputData.ranges && t.inputData.ranges.length > 0
        );

        const sortedTasks = [...currentTasks].sort((a, b) => a.id - b.id);
        const lastTaskId = sortedTasks.length > 0 ? sortedTasks[sortedTasks.length - 1].id : 0;

        // [FIX] Validasi Koneksi menggunakan Array dependencies
        const isAllConnected = sortedTasks.every(task => {
            if (task.id === lastTaskId) return true; 
            // Cek apakah ada task lain yang dependencies-nya mengandung task.id ini
            return currentTasks.some(child => child.dependencies && child.dependencies.includes(task.id));
        });

        const isReadyToLock = isAllDatesFilled && isAllConnected;
        let btnText = isReadyToLock ? "Kunci & Terbitkan Jadwal" : "Lengkapi Jadwal Dahulu";
        let btnAttr = isReadyToLock ? "" : "disabled";
        let infoText = isReadyToLock
            ? "Pastikan grafik di atas sudah sesuai sebelum mengunci."
            : "Harap lengkapi <strong>Durasi</strong> dan <strong>Keterikatan</strong> pada semua tahapan.";

        container.innerHTML = `
            <div class="bottom-info-text">
                ℹ️ ${infoText}
            </div>
            <button class="btn-publish-bottom" onclick="confirmAndPublish()" ${btnAttr}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                ${btnText}
            </button>
        `;
    }

    window.confirmAndPublish = function () {
        if (isInitializing) return;

        const isAllDatesFilled = currentTasks.every(t =>
            t.inputData && t.inputData.ranges && t.inputData.ranges.length > 0
        );

        if (!isAllDatesFilled) {
            alert("Gagal Kunci Jadwal:\nHarap lengkapi durasi/tanggal pada SEMUA tahapan pekerjaan terlebih dahulu.");
            return;
        }

        const sortedTasks = [...currentTasks].sort((a, b) => a.id - b.id);
        const lastTaskId = sortedTasks[sortedTasks.length - 1].id;
        
        // [FIX] Validasi Broken Chains dengan Array dependencies
        const brokenChains = sortedTasks.filter(task => {
            if (task.id === lastTaskId) return false;
            // Harus ada task lain yang dependencies-nya mengandung task.id ini
            const hasNextStep = currentTasks.some(child => child.dependencies && child.dependencies.includes(task.id));
            return !hasNextStep;
        });

        if (brokenChains.length > 0) {
            const listNames = brokenChains.map(t => `- ${t.name}`).join("\n");
            alert(
                `❌ GAGAL KUNCI JADWAL\n\n` +
                `Agar alur pekerjaan tersambung, Anda wajib memilih "Tahapan Selanjutnya" pada setiap baris.\n` +
                `(Kecuali tahapan paling akhir).\n\n` +
                `Tahapan berikut belum memiliki kelanjutan (belum dipilih sebagai parent oleh tahapan lain):\n` +
                `${listNames}\n\n` +
                `Solusi: Pilih tahapan selanjutnya pada dropdown baris tersebut.`
            );
            return; 
        }

        if (!confirm("Yakin kunci jadwal? Data tidak bisa diubah lagi.")) return;
        saveProjectSchedule("Terkunci");
    }

    async function saveProjectSchedule(status) {
        if (isInitializing) return;

        const overlay = document.getElementById('loading-overlay');
        const loadingTitle = document.getElementById('loading-title');
        const loadingDesc = document.getElementById('loading-desc');
        const isPublishing = status === 'Terkunci';

        if (isPublishing && overlay) {
            loadingTitle.textContent = "Sedang Menerbitkan Jadwal...";
            loadingDesc.textContent = "Mohon tunggu, jangan tutup halaman ini.";
            overlay.classList.remove('hidden-overlay');
            overlay.classList.add('active');
        }

        const payload = {
            "Nomor Ulok": currentProject.ulokClean,
            "Lingkup_Pekerjaan": currentProject.work.toUpperCase(),
            "Status": status,
            "Email_Pembuat": loggedInUserEmail || "-",
            "Nama_Toko": currentProject.store,
            "Proyek": currentProject.projectType,
            "Alamat": currentProject.alamat || "-",
            "Cabang": loggedInUserCabang || "-",
            "Nama_Kontraktor": "PT KONTRAKTOR",
        };

        currentTasks.forEach(t => {
            const ranges = t.inputData.ranges || [];
            payload[`Kategori_${t.id}`] = t.name;

            if (ranges.length > 0) {
                payload[`Kategori_${t.id}`] = t.name;
                const pStart = new Date(currentProject.startDate);
                const tStart = new Date(pStart); tStart.setDate(pStart.getDate() + ranges[0].start - 1);
                const tEnd = new Date(pStart); tEnd.setDate(pStart.getDate() + ranges[ranges.length - 1].end - 1);
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
            await fetch(ENDPOINTS.insertData, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (dayPayload.length > 0) {
                await fetch(ENDPOINTS.dayInsert, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dayPayload) });
            }

            if (isPublishing) {
                if (overlay) {
                    loadingTitle.textContent = "Berhasil!";
                    loadingDesc.textContent = "Jadwal terkunci. Mengalihkan ke halaman utama...";
                }
                setTimeout(() => {
                    window.location.href = "../../gantt/index.html";
                }, 1500);
            } else {
                alert(`Jadwal berhasil disimpan (Status: ${status})`);
                renderChart();
            }

        } catch (err) {
            console.error(err);
            if (isPublishing && overlay) {
                overlay.classList.remove('active');
                overlay.classList.add('hidden-overlay');
            }
            alert("Gagal menyimpan data: " + err.message);
        }
    }

    // ==================== 11. ACTIONS: PIC ====================
    window.onDelaySelectChange = function () {
        const sel = document.getElementById('delayTaskSelect');
        const opt = sel.options[sel.selectedIndex];
        document.getElementById('delayDaysInput').value = opt.getAttribute('data-delay') || 0;
    }

    window.submitDelay = async function () {
        const sel = document.getElementById('delayTaskSelect');
        const idx = sel.options[sel.selectedIndex].getAttribute('data-idx');
        const days = document.getElementById('delayDaysInput').value;

        if (!dayGanttData || !dayGanttData[idx]) return alert("Data tidak valid");
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
            await fetch(ENDPOINTS.dayKeterlambatan, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            alert("Keterlambatan diterapkan");
            changeUlok();
        } catch (err) {
            alert("Error: " + err.message);
        }
    }

    // ==================== 12. CHART RENDER ====================
    function renderChart() {
        const chart = document.getElementById('ganttChart');
        if (!chart) return;

        if (!currentTasks || currentTasks.length === 0) {
            chart.innerHTML = '';
            return;
        }

        const DAY_WIDTH = 40;
        const ROW_HEIGHT = 50;
        const effectiveEndDates = {}; 

        currentTasks.forEach(t => t.computed = { shift: 0 });

        // [FIX] Kalkulasi Ripple Effect dengan Multiple Dependencies
        currentTasks.forEach(task => {
            const ranges = task.inputData?.ranges || [];
            let maxShift = 0;

            if (task.dependencies && task.dependencies.length > 0) {
                // Cek semua parent, ambil shift terbesar
                task.dependencies.forEach(parentId => {
                    const parentTask = currentTasks.find(t => t.id === parentId);
                    if (parentTask) {
                        const parentExistingShift = parentTask.computed.shift || 0;
                        let parentInputDelay = 0;
                        const pRanges = parentTask.inputData?.ranges || [];
                        if (pRanges.length > 0) {
                            parentInputDelay = parseInt(pRanges[pRanges.length - 1].keterlambatan || 0);
                        }
                        
                        const potentialShift = parentExistingShift + parentInputDelay;
                        if (potentialShift > maxShift) {
                            maxShift = potentialShift;
                        }
                    }
                });
            }
            
            task.computed.shift = maxShift;
            
            if (ranges.length > 0) {
                const lastRange = ranges[ranges.length - 1];
                const actualEnd = lastRange.end + maxShift;
                const ownDelay = parseInt(lastRange.keterlambatan || 0);
                effectiveEndDates[task.id] = actualEnd + ownDelay;
            } else {
                effectiveEndDates[task.id] = 0;
            }
        });

        let maxTaskEndDay = 0;
        currentTasks.forEach(task => {
            const ranges = task.inputData?.ranges || [];
            const shift = task.computed.shift;
            ranges.forEach(range => {
                const ownDelay = parseInt(range.keterlambatan || 0);
                const totalEnd = range.end + shift + ownDelay;
                if (totalEnd > maxTaskEndDay) maxTaskEndDay = totalEnd;
            });
        });

        const projectDuration = parseInt(currentProject?.duration || 30);
        const totalDaysToRender = Math.max(projectDuration, maxTaskEndDay) + 5;
        const totalChartWidth = totalDaysToRender * DAY_WIDTH;

        const headerTitle = "Timeline Project";
        let html = '<div class="chart-header">';
        html += '<div class="task-column">Tahapan</div>';
        html += `<div class="timeline-column" style="width: ${totalChartWidth}px;">`;

        for (let i = 0; i < totalDaysToRender; i++) {
            const dayNumber = i + 1;
            const isSup = supervisionDays[dayNumber] === true;
            const clss = isSup ? "day-header supervision-active" : "day-header";
            html += `<div class="${clss}" style="width:${DAY_WIDTH}px; box-sizing: border-box;" title="${headerTitle}"><span class="d-date" style="font-weight:bold; font-size:14px;">${dayNumber}</span></div>`;
        }
        html += "</div></div>";

        html += '<div class="chart-body" style="position:relative;">';

        let taskCoordinates = {};

        currentTasks.forEach((task, index) => {
            const ranges = task.inputData?.ranges || [];
            const shift = task.computed.shift;
            let durTxt = ranges.reduce((s, r) => s + r.duration, 0);

            const maxEnd = ranges.length ? Math.max(...ranges.map(r => r.end + shift + (parseInt(r.keterlambatan) || 0))) : 0;
            const minStart = ranges.length ? Math.min(...ranges.map(r => r.start + shift)) : 0;

            taskCoordinates[task.id] = {
                centerY: (index * ROW_HEIGHT) + (ROW_HEIGHT / 2),
                endX: maxEnd * DAY_WIDTH,
                startX: (minStart - 1) * DAY_WIDTH
            };

            html += `<div class="task-row"><div class="task-name"><span>${task.name}</span><span class="task-duration">${durTxt} hari</span></div>`;
            html += `<div class="timeline" style="width: ${totalChartWidth}px;">`;

            ranges.forEach((range) => {
                const actualStart = range.start + shift;
                const actualEnd = range.end + shift;
                const leftPos = (actualStart - 1) * DAY_WIDTH;
                const widthPos = (range.duration * DAY_WIDTH) - 1;
                const hasDelay = range.keterlambatan && range.keterlambatan > 0;
                const isShifted = shift > 0;

                let barClass = "bar on-time";
                if (isShifted) barClass = "bar shifted";
                else if (hasDelay) barClass = "bar on-time has-delay";

                const borderStyle = (hasDelay && !isShifted) ? "border: 2px solid #e53e3e;" : "";

                html += `<div class="${barClass}" style="left: ${leftPos}px; width: ${widthPos}px; ${borderStyle}" title="${task.name}"> ${range.duration} Hari</div>`;

                if (hasDelay) {
                    const delayLeftPos = actualEnd * DAY_WIDTH;
                    const delayWidthPos = range.keterlambatan * DAY_WIDTH - 1;
                    html += `<div class="bar delayed" style="left:${delayLeftPos}px; width:${delayWidthPos}px; background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%); opacity: 0.85;">+${range.keterlambatan}</div>`;
                }
            });

            for (const [day, isActive] of Object.entries(supervisionDays)) {
                if (isActive) {
                    const dInt = parseInt(day);
                    const inRange = ranges.some(r => dInt >= (r.start + shift) && dInt <= (r.end + shift));
                    if (inRange) html += `<div class="supervision-marker" style="left:${(dInt - 1) * DAY_WIDTH}px"></div>`;
                }
            }
            html += `</div></div>`;
        });

        const svgDefs = `
            <defs>
                <marker id="depArrow" viewBox="0 0 10 6" refX="7" refY="3" markerWidth="8" markerHeight="6" orient="auto">
                    <path d="M0,0 L10,3 L0,6 Z" class="dependency-arrow" fill="#4299e1" opacity="0.95"></path>
                </marker>
            </defs>`;

        let svgLines = '';
        
        // [FIX] Loop Multiple Dependencies untuk menggambar garis
        currentTasks.forEach(task => {
            if (task.dependencies && task.dependencies.length > 0) {
                task.dependencies.forEach(parentId => {
                    const parent = taskCoordinates[parentId];
                    const me = taskCoordinates[task.id];
                    if (parent && me && parent.endX !== undefined && me.startX !== undefined) {
                        const startX = parent.endX;
                        const startY = parent.centerY;
                        const endX = me.startX;
                        const endY = me.centerY;
                        const deltaX = endX - startX;
                        let tension = 40;
                        if (deltaX < 40) tension = 60;
                        if (deltaX < 0) tension = 100;
                        const cp1x = startX + tension;
                        const cp1y = startY;
                        const cp2x = endX - tension;
                        const cp2y = endY;
                        const path = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
                        const parentTask = currentTasks.find(t => t.id === parentId);
                        const tooltipText = parentTask ? `${task.name} menunggu ${parentTask.name}` : '';
                        svgLines += `<path d="${path}" class="dependency-line" marker-end="url(#depArrow)" opacity="0.95"><title>${tooltipText}</title></path>`;
                        svgLines += `<circle class="dependency-node" cx="${startX}" cy="${startY}" r="4" />`;
                        svgLines += `<circle class="dependency-node" cx="${endX}" cy="${endY}" r="4" />`;
                    }
                });
            }
        });

        const svgHeight = currentTasks.length * ROW_HEIGHT;
        html += `
            <svg class="chart-lines-svg" style="position:absolute; top:0; left:250px; width:${totalChartWidth}px; height:${svgHeight}px; pointer-events:none; z-index:10;">
                ${svgDefs}
                ${svgLines}
            </svg>
        `;

        html += `</div>`;
        chart.innerHTML = html;
    }

    function updateProjectFromRab(rab) {
        if (rab.Alamat) currentProject.alamat = rab.Alamat;
        if (rab.Nama_Toko) currentProject.store = rab.Nama_Toko;
        if (rab.Durasi_Pekerjaan) currentProject.duration = rab.Durasi_Pekerjaan;
        if (rab.Kategori_Lokasi) currentProject.kategoriLokasi = rab.Kategori_Lokasi;
        calculateSupervisionDays();
    }

    function renderProjectInfo() {
        const durationDisplay = currentProject.duration ? `${currentProject.duration} Hari` : '-';
        const kategoriLokasiDisplay = currentProject.kategoriLokasi || '-';
        document.getElementById("projectInfo").innerHTML = `
            <div class="project-detail"><div class="project-label">No. Ulok</div><div class="project-value">${currentProject.ulokClean}</div></div>
            <div class="project-detail"><div class="project-label">Nama Toko</div><div class="project-value">${currentProject.store}</div></div>
            <div class="project-detail"><div class="project-label">Lingkup Pekerjaan</div><div class="project-value">${currentProject.work}</div></div>
            <div class="project-detail"><div class="project-label">Durasi Pekerjaan</div><div class="project-value">${durationDisplay}</div></div>
            <div class="project-detail"><div class="project-label">Kategori Lokasi</div><div class="project-value">${kategoriLokasiDisplay}</div></div>
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