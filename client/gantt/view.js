/* global XLSX */

document.addEventListener('DOMContentLoaded', () => {
    // ==================== 1. CONFIGURATION (VIEWER MODE) ====================
    // Bypass Auth: Set mode langsung ke viewer
    const APP_MODE = 'viewer';
    console.log(`⚙️ Mode Aplikasi: ${APP_MODE.toUpperCase()}`);

    // Update UI Header (Info User Tamu)
    const roleBadge = document.getElementById('roleBadge');
    if (roleBadge) roleBadge.textContent = "GUEST / VIEWER";

    const nameDisplay = document.getElementById('userNameDisplay');
    if (nameDisplay) nameDisplay.textContent = "Mode Tampilan";

    // ==================== 2. CONFIGURATION & ENDPOINTS ====================
    const API_BASE_URL = "https://sparta-backend-5hdj.onrender.com/api";

    const ENDPOINTS = {
        ganttData: `${API_BASE_URL}/get_gantt_data`,
        // Endpoint write/edit tidak diperlukan di view.js
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
    let isProjectLocked = true; // Selalu anggap terkunci (Read Only)
    let supervisionDays = {};
    let isInitializing = true;

    // ==================== 4. RULES & TEMPLATES ====================

    // MAPPING HARI PENGAWASAN
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

    function showLoadingMessage() {
        document.getElementById("ganttChart").innerHTML = `
            <div style="text-align: center; padding: 60px; color: #6c757d;">
                <div style="font-size: 48px; margin-bottom: 20px;">⏳</div>
                <h2 style="margin-bottom: 15px;">Memuat Data...</h2>
            </div>`;
    }

    function calculateSupervisionDays() {
        supervisionDays = {};
        if (!currentProject || !currentProject.duration) return;

        const dur = parseInt(currentProject.duration);
        if (isNaN(dur)) return;

        const days = SUPERVISION_RULES[dur];
        if (days && Array.isArray(days)) {
            days.forEach(dayNum => {
                supervisionDays[dayNum] = true;
            });
        }
    }

    // ==================== 6. CORE: INIT VIA URL (PENGGANTI AUTH) ====================
    async function loadDataAndInit() {
        try {
            showLoadingMessage();

            // 1. Ambil Parameter URL
            const urlParams = new URLSearchParams(window.location.search);
            const autoUlok = urlParams.get('ulok');
            const autoLingkup = urlParams.get('lingkup') || 'Sipil'; // Default Sipil jika kosong

            if (!autoUlok) {
                document.getElementById("ganttChart").innerHTML = `
                    <div style="text-align:center; padding:40px; color:#666;">
                        <h2>⚠️ Parameter Tidak Ditemukan</h2>
                        <p>Link tidak valid. Pastikan URL mengandung parameter ?ulok=...</p>
                    </div>`;
                return;
            }

            console.log(`🔗 Init View: Ulok=${autoUlok}, Lingkup=${autoLingkup}`);

            // 2. Buat Project Object
            const dummyValue = `${autoUlok}-${autoLingkup}`;
            const tempProject = {
                ulok: dummyValue,         
                ulokClean: autoUlok,      
                store: "Memuat...",       // Akan diupdate via API nanti
                work: autoLingkup,
                projectType: "Reguler",
                startDate: new Date().toISOString().split("T")[0],
                duration: 0,
                alamat: "",
                kategoriLokasi: ""
            };

            projects = [tempProject];
            currentProject = tempProject;

            // 3. Init UI
            initUI();

        } catch (error) {
            console.error(error);
            document.getElementById("ganttChart").innerHTML = `<div style="text-align:center; color:red; padding:40px;">Error: ${error.message}</div>`;
        }
    }

    function initUI() {
        const ulokSelect = document.getElementById("ulokSelect");
        if (ulokSelect) {
            ulokSelect.innerHTML = '';
            projects.forEach(project => {
                projectTasks[project.ulok] = [];
                const option = document.createElement("option");
                option.value = project.ulok;
                option.textContent = `${project.ulokClean} (${project.work})`;
                ulokSelect.appendChild(option);
            });
            ulokSelect.value = projects[0].ulok;
            ulokSelect.disabled = true; // Dropdown dikunci karena view only
        }

        // Langsung load data
        changeUlok();

        setTimeout(() => {
            isInitializing = false;
        }, 1000);
    }

    // ==================== 7. CORE: FETCH GANTT DATA ====================
    async function changeUlok() {
        const ulokSelect = document.getElementById("ulokSelect");
        const selectedUlok = ulokSelect ? ulokSelect.value : projects[0].ulok;

        // Reset States
        supervisionDays = {};
        dayGanttData = null;
        rawGanttData = null;
        ganttApiData = null;
        dependencyData = [];
        filteredCategories = null;
        isProjectLocked = true;
        hasUserInput = false;

        currentProject = projects.find(p => p.ulok === selectedUlok);
        isLoadingGanttData = true;

        await fetchGanttData(selectedUlok);

        calculateSupervisionDays();
        renderProjectInfo();
        
        // Hide API/Form Container for Viewer
        const apiContainer = document.getElementById("apiData");
        if (apiContainer) apiContainer.style.display = 'none';

        if (hasUserInput) {
            renderChart();
        } else {
            document.getElementById("ganttChart").innerHTML = `
                <div style="text-align: center; padding: 60px; color: #6c757d;">
                    <div style="font-size: 48px; margin-bottom: 20px;">ℹ️</div>
                    <h2 style="margin-bottom: 15px;">Data Jadwal Kosong</h2>
                    <p>Belum ada jadwal yang dibuat untuk proyek ini.</p>
                </div>`;
        }

        updateStats();
    }

    async function fetchGanttData(selectedValue) {
        const { ulok, lingkup } = extractUlokAndLingkup(selectedValue);
        const url = `${ENDPOINTS.ganttData}?ulok=${encodeURIComponent(ulok)}&lingkup=${encodeURIComponent(lingkup)}`;

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

    function loadDefaultTasks(selectedValue) {
        let template = currentProject.work === 'ME' ? taskTemplateME : taskTemplateSipil;
        let tasksToUse = JSON.parse(JSON.stringify(template));

        if (filteredCategories && filteredCategories.length > 0) {
            const normalizedFilteredCategories = filteredCategories.map(c => c.toLowerCase().trim());
            tasksToUse = tasksToUse.filter(task => {
                const normalizedTaskName = task.name.toLowerCase().trim();
                return normalizedFilteredCategories.some(fc =>
                    normalizedTaskName.includes(fc) || fc.includes(normalizedTaskName)
                );
            });
            tasksToUse = tasksToUse.map((task, index) => ({
                ...task,
                id: index + 1
            }));
        }

        currentTasks = tasksToUse.map(t => ({
            ...t,
            inputData: { ranges: [] }
        }));
        projectTasks[selectedValue] = currentTasks;
        hasUserInput = false;
    }

    // ==================== 8. PARSING LOGIC (SAMA PERSIS DENGAN SCRIPT.JS) ====================
    function parseGanttDataToTasks(ganttData, selectedValue, dayGanttDataArray = null) {
        if (!currentProject) return;

        let dynamicTasks = [];
        let earliestDate = null;
        let tempTaskList = [];

        // --- Logika Sinkronisasi Data RAB (Sama dengan script.js) ---
        if (filteredCategories && Array.isArray(filteredCategories) && filteredCategories.length > 0) {
            let template = currentProject.work === 'ME' ? taskTemplateME : taskTemplateSipil;
            const normalizedCategories = filteredCategories.map(c => c.toLowerCase().trim());

            tempTaskList = normalizedCategories.map((catName, index) => {
                const templateItem = template.find(t => t.name.toLowerCase().trim() === catName);
                const officialName = templateItem ? templateItem.name : filteredCategories[index];

                let savedKeterlambatan = 0;
                if (ganttData) {
                    let i = 1;
                    while (true) {
                        const keyName = `Kategori_${i}`;
                        const keyDelay = `Keterlambatan_Kategori_${i}`;
                        if (!ganttData.hasOwnProperty(keyName)) break;

                        if (ganttData[keyName] && ganttData[keyName].toLowerCase().trim() === officialName.toLowerCase().trim()) {
                            savedKeterlambatan = parseInt(ganttData[keyDelay]) || 0;
                            break;
                        }
                        i++;
                    }
                }

                return {
                    id: index + 1,
                    name: officialName,
                    keterlambatan: savedKeterlambatan
                };
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
                    tempTaskList.push({
                        id: i,
                        name: kategoriName,
                        keterlambatan: keterlambatan
                    });
                }
                i++;
            }
        }

        // --- LOGIKA RANGE & TANGGAL ---
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

        // --- MAPPING FINAL ---
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

            let dependencyTaskId = null;
            if (dependencyData && dependencyData.length > 0) {
                const depAsChild = dependencyData.find(d =>
                    d.Kategori_Terikat && String(d.Kategori_Terikat).toLowerCase().trim() === normalizedName
                );
                if (depAsChild && depAsChild.Kategori) {
                    const parentNameNorm = String(depAsChild.Kategori).toLowerCase().trim();
                    const parentTask = tempTaskList.find(t => t.name.toLowerCase().trim() === parentNameNorm);
                    if (parentTask) dependencyTaskId = parentTask.id;
                }
            }

            dynamicTasks.push({
                id: item.id,
                name: item.name,
                start: minStart,
                duration: totalDuration,
                dependencies: [],
                dependency: dependencyTaskId,
                keterlambatan: item.keterlambatan || 0,
                inputData: { ranges: ranges }
            });
        });

        currentTasks = dynamicTasks;
        projectTasks[selectedValue] = currentTasks;
    }

    // ==================== 9. CHART RENDER (SAMA PERSIS DENGAN SCRIPT.JS) ====================
    function renderChart() {
        const chart = document.getElementById('ganttChart');
        if (!chart) return;

        const DAY_WIDTH = 40;
        const ROW_HEIGHT = 50;
        const VERTICAL_OFFSET = 13;

        // --- 1. LOGIKA RIPPLE EFFECT ---
        const effectiveEndDates = {};
        currentTasks.forEach(t => t.computed = { shift: 0 });

        currentTasks.forEach(task => {
            const ranges = task.inputData?.ranges || [];
            let shift = 0;

            if (task.dependency) {
                const parentEffectiveEnd = effectiveEndDates[task.dependency] || 0;
                if (ranges.length > 0) {
                    const plannedStart = ranges[0].start;
                    if (plannedStart <= parentEffectiveEnd) {
                        shift = parentEffectiveEnd - plannedStart + 1;
                    }
                }
            }

            task.computed.shift = shift;

            if (ranges.length > 0) {
                const lastRange = ranges[ranges.length - 1];
                const actualEnd = lastRange.end + shift;
                const ownDelay = parseInt(lastRange.keterlambatan || 0);
                effectiveEndDates[task.id] = actualEnd + ownDelay;
            } else {
                effectiveEndDates[task.id] = 0;
            }
        });

        // --- 2. HITUNG DIMENSI CHART ---
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

        // --- 3. RENDER HEADER ---
        const headerTitle = "Timeline Project";
        const cursorStyle = "cursor: default;";

        let html = '<div class="chart-header">';
        html += '<div class="task-column">Tahapan</div>';
        html += `<div class="timeline-column" style="width: ${totalChartWidth}px;">`;

        for (let i = 0; i < totalDaysToRender; i++) {
            const dayNumber = i + 1;
            const isSup = supervisionDays[dayNumber] === true;
            const clss = isSup ? "day-header supervision-active" : "day-header";
            html += `<div class="${clss}" style="width:${DAY_WIDTH}px; box-sizing: border-box; ${cursorStyle}" title="${headerTitle}"><span class="d-date" style="font-weight:bold; font-size:14px;">${dayNumber}</span></div>`;
        }
        html += "</div></div>";

        html += '<div class="chart-body" style="position:relative;">';

        let taskCoordinates = {};

        // --- 4. RENDER TASKS (BARS) ---
        currentTasks.forEach((task, index) => {
            const ranges = task.inputData?.ranges || [];
            const shift = task.computed.shift;

            let durTxt = ranges.reduce((s, r) => s + r.duration, 0);

            // Koordinat Bar (Visual)
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

        // --- 5. RENDER DEPENDENCY LINES (SVG) ---
        const svgDefs = `
            <defs>
                <marker id="depArrow" viewBox="0 0 10 6" refX="7" refY="3" markerWidth="8" markerHeight="6" orient="auto">
                    <path d="M0,0 L10,3 L0,6 Z" class="dependency-arrow" fill="#4299e1" opacity="0.95"></path>
                </marker>
            </defs>`;

        let svgLines = '';
        currentTasks.forEach(task => {
            if (task.dependency) {
                const parent = taskCoordinates[task.dependency];
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
                    const parentTask = currentTasks.find(t => t.id === task.dependency);
                    const tooltipText = parentTask ? `${task.name} menunggu ${parentTask.name}` : '';

                    svgLines += `<path d="${path}" class="dependency-line" marker-end="url(#depArrow)" opacity="0.95"><title>${tooltipText}</title></path>`;
                    svgLines += `<circle class="dependency-node" cx="${startX}" cy="${startY}" r="4" />`;
                    svgLines += `<circle class="dependency-node" cx="${endX}" cy="${endY}" r="4" />`;
                }
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
        if (rab.nama_toko) currentProject.store = rab.nama_toko;
        if (rab.Durasi_Pekerjaan) currentProject.duration = rab.Durasi_Pekerjaan;
        if (rab.Kategori_Lokasi) currentProject.kategoriLokasi = rab.Kategori_Lokasi;

        const ulokSelect = document.getElementById("ulokSelect");
        if (ulokSelect && ulokSelect.options.length > 0) {
            ulokSelect.options[0].textContent = `${currentProject.ulokClean} | ${currentProject.store} (${currentProject.work})`;
        }

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