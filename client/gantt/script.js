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
        // endpoint pengawasanInsert DIHAPUS
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
    let isInitializing = true; // Flag untuk mencegah auto-save saat load/refresh
    // isSupervisionLocked DIHAPUS karena otomatis

    // ==================== 4. RULES & TEMPLATES ====================

    // MAPPING HARI PENGAWASAN (BARU)
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

    // FUNGSI BARU: Hitung Pengawasan Otomatis
    function calculateSupervisionDays() {
        supervisionDays = {}; // Reset

        if (!currentProject || !currentProject.duration) return;

        const dur = parseInt(currentProject.duration);
        if (isNaN(dur)) return;

        const days = SUPERVISION_RULES[dur];
        if (days && Array.isArray(days)) {
            days.forEach(dayNum => {
                supervisionDays[dayNum] = true;
            });
            console.log(`🔍 Pengawasan Auto (${dur} Hari):`, days);
        } else {
            console.warn(`⚠️ Tidak ada mapping pengawasan untuk durasi ${dur} hari.`);
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

        // 1. Populate Dropdown
        projects.forEach(project => {
            projectTasks[project.ulok] = []; // Inisialisasi storage task
            const option = document.createElement("option");

            // Value di sini adalah format gabungan: "Z001-2512-0001-ME"
            option.value = project.ulok;

            // Label dropdown
            option.textContent = `${project.ulok} | ${project.store} (${project.work})`;
            ulokSelect.appendChild(option);
        });

        ulokSelect.addEventListener('change', () => {
            // User manual change - pastikan initialization selesai
            isInitializing = false;
            changeUlok();
        });

        // ============================================================
        // 2. LOGIKA AUTO-LOAD (ULOK + LINGKUP) DARI RAB
        // ============================================================
        const urlParams = new URLSearchParams(window.location.search);

        // Ambil parameter (contoh: ulok="Z00126016565" atau "Z001-2601-6565", lingkup="Sipil")
        const autoUlok = urlParams.get('ulok');
        const autoLingkup = urlParams.get('lingkup');
        const isLocked = urlParams.get('locked');

        let foundMatch = false;

        // Helper: Normalize ulok code (hapus semua dash untuk perbandingan)
        const normalizeUlok = (code) => {
            if (!code) return '';
            return String(code).replace(/-/g, '').toUpperCase().trim();
        };

        if (autoUlok) {
            const normalizedAutoUlok = normalizeUlok(autoUlok);
            console.log(`🔗 Mencari proyek: Kode=${autoUlok} (normalized: ${normalizedAutoUlok}), Lingkup=${autoLingkup || 'Semua'}`);

            // Cari opsi yang COCOK KEDUANYA (Kode & Lingkup)
            const targetProject = projects.find(p => {
                // Normalize kedua sisi untuk perbandingan yang akurat
                const normalizedUlokClean = normalizeUlok(p.ulokClean);
                const normalizedUlok = normalizeUlok(p.ulok);

                // 1. Cek Kode Ulok (Normalized Match)
                const isCodeMatch = normalizedUlokClean === normalizedAutoUlok ||
                    normalizedUlok.includes(normalizedAutoUlok) ||
                    normalizedAutoUlok.includes(normalizedUlokClean);

                // 2. Cek Lingkup (Case Insensitive)
                const isScopeMatch = autoLingkup
                    ? p.work.toLowerCase() === autoLingkup.toLowerCase()
                    : true;

                if (isCodeMatch && isScopeMatch) {
                    console.log(`   ✓ Match found: ${p.ulok} (ulokClean: ${p.ulokClean}, work: ${p.work})`);
                }

                return isCodeMatch && isScopeMatch;
            });

            if (targetProject) {
                // Jika ketemu, pilih value dropdown yang sesuai (misal "Z001-2601-6565-Sipil")
                ulokSelect.value = targetProject.ulok;
                foundMatch = true;

                console.log("✅ Proyek ditemukan & dipilih:", targetProject.ulok);

                // Load Data Gantt Chart
                changeUlok();

                // Kunci Dropdown jika mode locked
                if (isLocked === 'true') {
                    ulokSelect.disabled = true;
                    ulokSelect.style.backgroundColor = "#e9ecef";
                    ulokSelect.style.cursor = "not-allowed";
                    ulokSelect.title = "Terkunci: Mode Review RAB";

                    // Tambahan Badge Visual (Opsional)
                    const roleBadge = document.getElementById("roleBadge");
                    if (roleBadge && !document.getElementById('lock-badge')) {
                        roleBadge.innerHTML += ` <span id="lock-badge" style="font-size:0.8em; background:#feb2b2; color:#9b2c2c; padding:2px 6px; border-radius:4px; margin-left:10px;">🔒 Mode RAB</span>`;
                    }
                }
            } else {
                console.warn("⚠️ Data URL valid, tapi proyek tidak ditemukan di list akun ini.");
                console.log("   Available projects:", projects.map(p => `${p.ulok} (${p.work})`));

                // Fallback: Coba cari hanya berdasarkan kode ulok jika lingkup tidak ketemu
                const partialMatch = projects.find(p => {
                    const normalizedUlokClean = normalizeUlok(p.ulokClean);
                    return normalizedUlokClean === normalizedAutoUlok;
                });

                if (partialMatch) {
                    console.log("   Partial match found:", partialMatch.ulok);
                    ulokSelect.value = partialMatch.ulok;
                    foundMatch = true;
                    changeUlok();

                    if (isLocked === 'true') {
                        ulokSelect.disabled = true;
                        ulokSelect.style.backgroundColor = "#e9ecef";
                        ulokSelect.style.cursor = "not-allowed";
                        ulokSelect.title = "Terkunci: Mode Review RAB";
                    }
                }
            }
        }

        // 3. Fallback jika tidak ada parameter URL
        if (!foundMatch && !ulokSelect.value) {
            ulokSelect.value = "";
            showSelectProjectMessage();
            localStorage.removeItem("lastSelectedUlok");
        }

        // Set flag bahwa inisialisasi selesai setelah delay singkat
        // untuk memastikan semua proses load sudah complete
        setTimeout(() => {
            isInitializing = false;
            console.log("✅ Inisialisasi selesai, save operations enabled");
        }, 1000);
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

        // Set loading state untuk mencegah perubahan selama fetch
        isLoadingGanttData = true;

        await fetchGanttData(selectedUlok);

        // Setelah fetch, update pengawasan otomatis berdasarkan durasi
        calculateSupervisionDays();

        // Render semua komponen
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
            if (data.dependency_data) dependencyData = data.dependency_data;
            if (data.filtered_categories && Array.isArray(data.filtered_categories)) {
                filteredCategories = data.filtered_categories;
            }

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
        let tasksToUse = JSON.parse(JSON.stringify(template));

        // Filter tasks based on filtered_categories from API if available
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

            // Find dependency from API data
            let dependencyTaskId = null;
            if (dependencyData && dependencyData.length > 0) {
                const depEntry = dependencyData.find(d =>
                    d.Kategori && d.Kategori.toLowerCase().trim() === normalizedName
                );
                if (depEntry && depEntry.Kategori_Terikat) {
                    const terikatName = depEntry.Kategori_Terikat.toLowerCase().trim();
                    const terikatTask = tempTaskList.find(t =>
                        t.name.toLowerCase().trim() === terikatName
                    );
                    if (terikatTask) {
                        dependencyTaskId = terikatTask.id;
                    }
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

    // --- FORM PIC (DELAY ONLY - SUPERVISION AUTO) ---
    window.renderPicDelayForm = function (container) {
        let html = '';

        let optionsHtml = '<option value="">-- Pilih Tahapan --</option>';
        if (dayGanttData) {
            dayGanttData.forEach((d, idx) => {
                const delayVal = parseInt(d.keterlambatan || 0);
                const delayText = delayVal > 0 ? ` (+${delayVal} Hari)` : '';
                optionsHtml += `<option value="${idx}" data-idx="${idx}" data-delay="${delayVal}">${d.Kategori} (${d.h_awal} - ${d.h_akhir})${delayText}</option>`;
            });
        }

        // Info Pengawasan Auto
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
                <div class="delay-title">
                    <span>Input Keterlambatan</span>
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
    window.renderContractorInputForm = function (container) {
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
                        <select class="form-control dep-select" data-task-id="${task.id}" style="font-size:12px; padding:6px; width:100%;" onchange="handleDependencyChange(${task.id}, this.value)">
                            ${dependencyOptions}
                        </select>
                        <div style="font-size:10px; color:#a0aec0; margin-top:4px; line-height:1.2;">
                            *Mulai setelah tahapan ini
                        </div>
                    </div>

                    <div style="width:70%;">
                        <label style="font-size:11px; color:#718096; font-weight:600; display:block; margin-bottom:4px;">Durasi (Hari Ke- sampai Hari Ke-)</label>
                        <div class="task-ranges-container" id="ranges-${task.id}">`;

            const rangesToRender = ranges.length > 0 ? ranges : [{ start: 0, end: 0 }];

            rangesToRender.forEach((r, idx) => {
                const isSaved = ranges.length > 0;
                html += createRangeHTML(task.id, idx, r.start, r.end, isSaved);
            });

            html += `   </div>
                        <button class="btn-add-range" onclick="addRange(${task.id})" style="margin-top:8px;">+ Tambah Durasi</button>
                    </div>
                </div>
            </div>`;
        });

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

    window.createRangeHTML = function (taskId, idx, start, end, isSaved = false) {
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
    window.addRange = function (taskId) {
        const container = document.getElementById(`ranges-${taskId}`);
        const uniqueIdx = Date.now();
        container.insertAdjacentHTML('beforeend', createRangeHTML(taskId, uniqueIdx, 0, 0, false));
    }

    window.removeRange = async function (taskId, idx, isSaved) {
        const rowId = `range-group-${taskId}-${idx}`;
        const element = document.getElementById(rowId);

        if (!isSaved) {
            if (element) element.remove();
            return;
        }

        if (!confirm("Data ini sudah tersimpan di server. Yakin ingin menghapusnya?")) return;

        const startVal = parseInt(document.getElementById(`start-${taskId}-${idx}`).value) || 0;
        const endVal = parseInt(document.getElementById(`end-${taskId}-${idx}`).value) || 0;

        const taskObj = currentTasks.find(t => t.id === taskId);
        const taskName = taskObj ? taskObj.name : "";

        if (startVal === 0 || endVal === 0 || !taskName) {
            alert("Data tidak valid/kosong, dihapus dari tampilan saja.");
            if (element) element.remove();
            return;
        }

        const dateStartStr = getTaskDateString(startVal);
        const dateEndStr = getTaskDateString(endVal);

        if (!dateStartStr || !dateEndStr) {
            alert("Gagal mengonversi tanggal. Cek Start Date Project.");
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
                throw new Error(`Server Error (${response.status}): ${responseText}`);
            }

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

    window.handleDependencyChange = async function (taskId, newDependencyTaskId) {
        // Cegah save saat inisialisasi/refresh
        if (isInitializing) {
            console.log("⏳ Skip dependency save - masih dalam proses inisialisasi");
            return;
        }

        const task = currentTasks.find(t => t.id === parseInt(taskId));
        if (!task || !currentProject) return;

        const oldDependencyTaskId = task.dependency;
        const oldDependencyTask = oldDependencyTaskId ? currentTasks.find(t => t.id === parseInt(oldDependencyTaskId)) : null;
        const newDependencyTask = newDependencyTaskId ? currentTasks.find(t => t.id === parseInt(newDependencyTaskId)) : null;

        try {
            document.body.style.cursor = 'wait';

            if (oldDependencyTask) {
                await removeDependency(task.name, oldDependencyTask.name);
            }
            if (newDependencyTask) {
                await saveDependency(task.name, newDependencyTask.name);
            }

            task.dependency = newDependencyTaskId ? parseInt(newDependencyTaskId) : null;
            updateLocalDependencyData(task.name, newDependencyTask ? newDependencyTask.name : null);
            console.log(`Dependency updated: ${task.name} -> ${newDependencyTask ? newDependencyTask.name : 'None'}`);

        } catch (err) {
            console.error("Dependency update failed:", err);
            alert("Gagal update keterikatan: " + err.message);
            const depSelect = document.querySelector(`.dep-select[data-task-id="${taskId}"]`);
            if (depSelect) depSelect.value = oldDependencyTaskId || '';
        } finally {
            document.body.style.cursor = 'default';
        }
    }

    async function saveDependency(kategori, kategoriTerikat) {
        const payload = {
            "nomor_ulok": currentProject.ulokClean,
            "lingkup_pekerjaan": currentProject.work.toUpperCase(),
            "dependency_data": [
                {
                    "Kategori": kategori.toUpperCase(),
                    "Kategori_Terikat": kategoriTerikat.toUpperCase()
                }
            ]
        };

        const response = await fetch(ENDPOINTS.dependencyInsert, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server Error (${response.status}): ${errorText}`);
        }
        return await response.json();
    }

    async function removeDependency(kategori, kategoriTerikat) {
        const payload = {
            "nomor_ulok": currentProject.ulokClean,
            "lingkup_pekerjaan": currentProject.work.toUpperCase(),
            "remove_dependency_data": [
                {
                    "Kategori": kategori.toUpperCase(),
                    "Kategori_Terikat": kategoriTerikat.toUpperCase()
                }
            ]
        };

        const response = await fetch(ENDPOINTS.dependencyInsert, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server Error (${response.status}): ${errorText}`);
        }
        return await response.json();
    }

    function updateLocalDependencyData(kategori, kategoriTerikat) {
        dependencyData = dependencyData.filter(d =>
            d.Kategori.toLowerCase().trim() !== kategori.toLowerCase().trim()
        );
        if (kategoriTerikat) {
            dependencyData.push({
                "Nomor Ulok": currentProject.ulokClean,
                "Lingkup_Pekerjaan": currentProject.work.toUpperCase(),
                "Kategori": kategori,
                "Kategori_Terikat": kategoriTerikat
            });
        }
    }

    window.resetTaskSchedule = function () {
        if (!confirm("Reset semua inputan?")) return;

        currentTasks.forEach(t => {
            t.inputData.ranges = [];
            t.start = 0;
            t.duration = 0;
            t.dependency = null;
        });
        hasUserInput = false;
        dependencyData = [];
        renderApiData();
        document.getElementById("ganttChart").innerHTML = `
            <div style="text-align: center; padding: 60px; color: #6c757d;">
                <div style="font-size: 48px; margin-bottom: 20px;">ℹ️</div>
                <h2 style="margin-bottom: 15px;">Belum Ada Jadwal</h2>
                <p>Silakan input jadwal pada form di atas.</p>
            </div>`;
        updateStats();
    }

    window.applyTaskSchedule = function () {
        // Cegah save saat inisialisasi/refresh
        if (isInitializing) {
            console.log("⏳ Skip apply schedule - masih dalam proses inisialisasi");
            return;
        }

        let tempTasks = [];
        let error = false;
        const maxAllowedDay = parseInt(currentProject.duration) || 999;

        currentTasks.forEach(t => {
            const container = document.getElementById(`ranges-${t.id}`);
            const depSelect = document.querySelector(`.dep-select[data-task-id="${t.id}"]`);
            const depValue = depSelect ? depSelect.value : "";

            if (!container) { tempTasks.push(t); return; }

            let newRanges = [];
            Array.from(container.children).forEach(row => {
                const s = parseInt(row.querySelector('[data-type="start"]').value) || 0;
                const e = parseInt(row.querySelector('[data-type="end"]').value) || 0;

                if (s === 0 || e === 0) return; 

                if (e < s) {
                    error = true;
                    alert(`Error Tahapan ${t.name}: Hari Selesai lebih kecil dari Mulai`);
                }

                if (e > maxAllowedDay) {
                    error = true;
                    alert(`Error Tahapan ${t.name}: Hari Selesai (${e}) tidak boleh melebihi Durasi Pekerjaan (${maxAllowedDay} Hari).`);
                }
                newRanges.push({ start: s, end: e, duration: (e > 0 ? e - s + 1 : 0) });
            });

            tempTasks.push({
                ...t,
                dependency: depValue,
                inputData: { ranges: newRanges }
            });
        });

        if (error) return;

        let processedTasksMap = {};

        tempTasks.forEach(task => {
            const ranges = task.inputData.ranges;
            if (task.dependency) {
                const parentId = parseInt(task.dependency);
                const parentEndDay = processedTasksMap[parentId] || 0;
                const requiredStart = parentEndDay + 1;

                if (ranges.length > 0) {
                    const currentStart = ranges[0].start;
                    if (currentStart < requiredStart && currentStart !== 0) {
                        const shiftDays = requiredStart - currentStart;
                        ranges.forEach(r => {
                            r.start += shiftDays;
                            r.end += shiftDays;
                        });
                    }
                }
            }

            const totalDur = ranges.reduce((sum, r) => sum + r.duration, 0);
            const minStart = ranges.length ? Math.min(...ranges.map(r => r.start)) : 0;
            const maxEnd = ranges.length ? Math.max(...ranges.map(r => r.end)) : 0;

            processedTasksMap[task.id] = maxEnd;
            task.start = minStart;
            task.duration = totalDur;
        });

        currentTasks = tempTasks;
        hasUserInput = true;
        saveProjectSchedule("Active");
        renderChart();
        updateStats();
        renderApiData();
    }

    window.confirmAndPublish = function () {
        // Cegah save saat inisialisasi/refresh
        if (isInitializing) {
            console.log("⏳ Skip publish - masih dalam proses inisialisasi");
            return;
        }

        const isAllTasksFilled = currentTasks.every(t =>
            t.inputData && t.inputData.ranges && t.inputData.ranges.length > 0
        );

        if (!isAllTasksFilled) {
            alert("Harap lengkapi semua tahapan pekerjaan terlebih dahulu sebelum mengunci jadwal.");
            return;
        }
        if (!confirm("Yakin kunci jadwal? Data tidak bisa diubah lagi.")) return;
        saveProjectSchedule("Terkunci");
    }

    async function saveProjectSchedule(status) {
        // Double check: Cegah save saat inisialisasi
        if (isInitializing) {
            console.warn("⚠️ Blocked auto-save during initialization");
            return;
        }

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

            if (ranges.length > 0) {
                // Pindahkan pengisian nama kategori ke dalam blok IF ini
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

            alert(`Berhasil disimpan status: ${status}`);
            if (status === 'Terkunci') {
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
    // ==================== 12. CHART RENDER (UPDATED) ====================
    function renderChart() {
        const chart = document.getElementById('ganttChart');
        const DAY_WIDTH = 40;
        const ROW_HEIGHT = 50;

        // --- 1. LOGIKA RIPPLE EFFECT (Kalkulasi Pergeseran) ---
        // Map untuk menyimpan kapan sebuah Task ID benar-benar selesai (termasuk delay)
        const effectiveEndDates = {};

        currentTasks.forEach(task => {
            const ranges = task.inputData?.ranges || [];
            let shift = 0;

            // Cek Dependency
            if (task.dependency) {
                // Ambil tanggal selesai efektif dari parent
                const parentEffectiveEnd = effectiveEndDates[task.dependency] || 0;

                if (ranges.length > 0) {
                    const plannedStart = ranges[0].start;
                    // Jika jadwal rencana mulai SEBELUM atau SAMA DENGAN parent selesai
                    // Maka harus digeser maju
                    if (plannedStart <= parentEffectiveEnd) {
                        shift = parentEffectiveEnd - plannedStart + 1;
                    }
                }
            }

            // Simpan data kalkulasi ke dalam object task sementara (untuk rendering)
            task.computed = {
                shift: shift
            };

            // Hitung kapan task ini selesai untuk digunakan oleh child-nya nanti
            if (ranges.length > 0) {
                const lastRange = ranges[ranges.length - 1];
                // End Date = (Planned End + Shift) + Own Delay
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

        const projectDuration = parseInt(currentProject.duration) || (currentProject.work === 'ME' ? 100 : 205);
        const totalDaysToRender = Math.max(projectDuration, maxTaskEndDay) + 5; // Buffer 5 hari
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

        // --- 4. RENDER TASKS ---
        currentTasks.forEach((task, index) => {
            const ranges = task.inputData?.ranges || [];
            const shift = task.computed.shift; // Ambil nilai shift yang sudah dihitung

            let durTxt = ranges.reduce((s, r) => s + r.duration, 0);

            // Koordinat untuk garis panah (menggunakan posisi yang sudah digeser/shifted)
            const maxEnd = ranges.length ? Math.max(...ranges.map(r => r.end + shift + (parseInt(r.keterlambatan) || 0))) : 0;
            const minStart = ranges.length ? Math.min(...ranges.map(r => r.start + shift)) : 0;

            taskCoordinates[task.id] = {
                y: (index * ROW_HEIGHT) + (ROW_HEIGHT / 2),
                endX: maxEnd * DAY_WIDTH,
                startX: (minStart - 1) * DAY_WIDTH
            };

            html += `<div class="task-row"><div class="task-name"><span>${task.name}</span><span class="task-duration">${durTxt} hari</span></div>`;
            html += `<div class="timeline" style="width: ${totalChartWidth}px;">`;

            ranges.forEach((range) => {
                // Posisi visual memperhitungkan shift
                const actualStart = range.start + shift;
                const actualEnd = range.end + shift;

                const leftPos = (actualStart - 1) * DAY_WIDTH;
                const widthPos = (range.duration * DAY_WIDTH) - 1;

                const hasDelay = range.keterlambatan && range.keterlambatan > 0;
                const isShifted = shift > 0;

                // Tentukan Class Warna
                let barClass = "bar on-time";
                if (isShifted) {
                    barClass = "bar shifted"; // KUNING/ORANYE jika tergeser dependency
                } else if (hasDelay) {
                    barClass = "bar on-time has-delay"; // HIJAU/MERAH BORDER jika dia sendiri yang telat
                }

                const borderStyle = (hasDelay && !isShifted) ? "border: 2px solid #e53e3e;" : "";

                html += `<div class="${barClass}" style="left: ${leftPos}px; width: ${widthPos}px; box-sizing: border-box; ${borderStyle}" title="${task.name} (Shift: ${shift} hari)"> ${range.duration}</div>`;

                // Render Extension Merah (Keterlambatan sendiri)
                if (hasDelay) {
                    const delayLeftPos = actualEnd * DAY_WIDTH; // Mulai dari ujung bar yang sudah di-shift
                    const delayWidthPos = range.keterlambatan * DAY_WIDTH - 1;
                    html += `<div class="bar delayed" style="left:${delayLeftPos}px; width:${delayWidthPos}px; background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%); opacity: 0.85;">+${range.keterlambatan}</div>`;
                }
            });

            // Supervision Markers (Visual Only - disesuaikan dengan posisi bar yang terlihat)
            for (const [day, isActive] of Object.entries(supervisionDays)) {
                if (isActive) {
                    const dInt = parseInt(day);
                    // Cek apakah hari pengawasan jatuh pada range yang SUDAH DI-SHIFT
                    const inRange = ranges.some(r => dInt >= (r.start + shift) && dInt <= (r.end + shift));
                    if (inRange) html += `<div class="supervision-marker" style="left:${(dInt - 1) * DAY_WIDTH}px"></div>`;
                }
            }
            html += `</div></div>`;
        });

        // --- 5. RENDER DEPENDENCY LINES (SVG) ---
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

                    // Kurva Bezier
                    const path = `M ${startX} ${startY} 
                                C ${startX + 30} ${startY}, 
                                ${endX - 30} ${endY}, 
                                ${endX} ${endY}`;

                    const parentTask = currentTasks.find(t => t.id === task.dependency);
                    const tooltipText = parentTask ? `${task.name} bergantung pada ${parentTask.name}` : '';

                    svgLines += `<path d="${path}" class="dependency-line" data-from="${task.dependency}" data-to="${task.id}">
                        <title>${tooltipText}</title>
                    </path>`;

                    const arrowSize = 6;
                    svgLines += `<polygon points="${endX},${endY} ${endX - arrowSize},${endY - arrowSize / 2} ${endX - arrowSize},${endY + arrowSize / 2}" class="dependency-arrow" fill="#667eea"/>`;
                }
            }
        });

        const svgHeight = currentTasks.length * ROW_HEIGHT;
        html += `
            <svg class="chart-lines-svg" style="width:${totalChartWidth}px; height:${svgHeight}px;">
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#667eea"/>
                    </marker>
                </defs>
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

        // Re-calculate supervision when RAB updates duration
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