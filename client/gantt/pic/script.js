// eslint-disable-next-line no-undef
/* global XLSX */

if (!sessionStorage.getItem("loggedInUserCabang")) {
  window.location.replace("../../auth/pic/login.html")
}

const API_BASE_URL = "https://sparta-backend-5hdj.onrender.com/api"
const ENDPOINTS = {
  ulokList: `${API_BASE_URL}/get_ulok_by_cabang_pic`,
  ganttData: `${API_BASE_URL}/get_gantt_data`,
  insertData: `${API_BASE_URL}/gantt/insert`, // Endpoint Insert
}

let projects = []
let currentProject = null
const projectTasks = {}
let ganttApiData = null
let ganttApiError = null
let isLoadingGanttData = false
let hasUserInput = false // Track apakah user sudah input jadwal
let isProjectLocked = false // Track status dikunci/belum
let filteredCategories = null
let rawGanttData = null // Store raw gantt_data for delay values
let dayGanttData = null // Store day_gantt_data for multi-range bars

let checkpoints = {} // Format: { taskId: [{ day: number, taskName: string }] }

// ==================== TASK TEMPLATES ====================
const taskTemplateME = [
  { id: 1, name: "Instalasi", start: 0, duration: 0, dependencies: [] },
  { id: 2, name: "Fixture", start: 0, duration: 0, dependencies: [] },
  { id: 3, name: "Pekerjaan Tambahan", start: 0, duration: 0, dependencies: [] },
  { id: 4, name: "Pekerjaan SBO", start: 0, duration: 0, dependencies: [] },
]

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
]

let currentTasks = []
const totalDaysME = 100
const totalDaysSipil = 205

// ==================== HELPER FUNCTIONS ====================
function formatDateID(date) {
  const options = { day: "numeric", month: "short", year: "numeric" }
  return date.toLocaleDateString("id-ID", options)
}

function extractUlokAndLingkup(value) {
  if (!value) return { ulok: "", lingkup: "" }

  const trimmed = String(value).trim()
  const parts = trimmed.split("-")

  if (parts.length < 2) {
    return { ulok: trimmed, lingkup: "" }
  }

  const lingkupRaw = parts.pop()
  const ulok = parts.join("-")
  const lingkupUpper = lingkupRaw.replace(/[^a-zA-Z]/g, "").toUpperCase()
  const lingkup = lingkupUpper === "ME" ? "ME" : "Sipil"

  return { ulok, lingkup }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function showLoadingMessage() {
  const chart = document.getElementById("ganttChart")
  chart.innerHTML = `
        <div style="text-align: center; padding: 60px; color: #6c757d;">
            <div style="font-size: 48px; margin-bottom: 20px;">⏳</div>
            <h2 style="margin-bottom: 15px;">Memuat Data...</h2>
            <p>Sedang mengambil data proyek dari server.</p>
        </div>
    `
}

function showErrorMessage(message) {
  const chart = document.getElementById("ganttChart")
  chart.innerHTML = `
        <div style="text-align: center; padding: 60px; color: #e53e3e;">
            <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
            <h2 style="margin-bottom: 15px;">Terjadi Kesalahan</h2>
            <p>${message}</p>
            <button onclick="loadDataAndInit()" style="margin-top: 20px; padding: 10px 20px; background: #3182ce; color: white; border: none; border-radius: 6px; cursor: pointer;">
                🔄 Coba Lagi
            </button>
        </div>
    `
}

function showSelectProjectMessage() {
  const chart = document.getElementById("ganttChart")
  chart.innerHTML = `
        <div style="text-align: center; padding: 60px; color: #6c757d;">
            <h2 style="margin-bottom: 15px;">📋 Pilih No. Ulok</h2>
            <p>Data berhasil dimuat. Silakan pilih proyek di atas.</p>
        </div>
    `
  document.getElementById("projectInfo").innerHTML = ""
  document.getElementById("stats").innerHTML = ""
  document.getElementById("exportButtons").style.display = "none"
  ganttApiData = null
  ganttApiError = null
  hasUserInput = false
  isProjectLocked = false
  filteredCategories = null
  rawGanttData = null
  dayGanttData = null
  checkpoints = {} // Clear checkpoints on error
  renderCheckpointList() // Render empty list
  renderApiData()
}

function showPleaseInputMessage() {
  const chart = document.getElementById("ganttChart")
  chart.innerHTML = `
        <div style="text-align: center; padding: 60px; color: #6c757d;">
            <div style="font-size: 48px; margin-bottom: 20px;">⏱️</div>
            <h2 style="margin-bottom: 15px;">Silakan Input Jadwal Pengerjaan</h2>
            <p>Masukkan hari mulai dan selesai untuk setiap tahapan di form di atas, kemudian klik <strong>"Terapkan Jadwal"</strong>.</p>
        </div>
    `
}

// ==================== PARSE PROJECT DATA ====================
function parseProjectFromLabel(label, value) {
  const parts = label.split(" - ")
  const { ulok: ulokClean, lingkup } = extractUlokAndLingkup(value)

  const ulokNumber = ulokClean || value.replace(/-ME|-Sipil/gi, "")
  let projectName = "Reguler"
  let storeName = "Tidak Diketahui"
  let workType = lingkup || "Sipil"
  let projectType = "Reguler"

  if (label.toUpperCase().includes("(ME)")) {
    workType = "ME"
  }

  if (parts.length >= 3) {
    projectName = parts[1].replace(/$$ME$$|$$Sipil$$/gi, "").trim()
    storeName = parts[2].trim()
    if (label.toUpperCase().includes("RENOVASI") || ulokNumber.includes("-R")) {
      projectType = "Renovasi"
    }
  } else if (parts.length === 2) {
    storeName = parts[1].replace(/$$ME$$|$$Sipil$$/gi, "").trim()
  }

  return {
    ulok: value,
    ulokClean: ulokClean || ulokNumber,
    ulokNumber: ulokNumber,
    name: projectName,
    store: storeName,
    work: workType,
    lingkup: workType,
    startDate: new Date().toISOString().split("T")[0],
    durasi: workType === "ME" ? 37 : 184,
    alamat: "",
    status: "Berjalan",
  }
}

// ==================== FETCH DATA FROM API ====================
async function loadDataAndInit() {
  try {
    showLoadingMessage()
    const userCabang = sessionStorage.getItem("loggedInUserCabang")
    const urlWithParam = `${ENDPOINTS.ulokList}?cabang=${encodeURIComponent(userCabang)}`
    const response = await fetch(urlWithParam)
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      throw new Error(errData.message || `HTTP Error: ${response.status}`)
    }

    const apiData = await response.json()

    if (!Array.isArray(apiData)) {
      throw new Error("Format data API tidak valid (harus array)")
    }

    projects = apiData.map((item) => parseProjectFromLabel(item.label, item.value))

    if (projects.length === 0) {
      showErrorMessage("Tidak ada data proyek ditemukan untuk email ini.")
      return
    }

    initChart()
  } catch (error) {
    console.error("❌ Error loading data:", error)
    showErrorMessage(`Gagal memuat data: ${error.message}`)
  }
}

function initChart() {
  const ulokSelect = document.getElementById("ulokSelect")
  ulokSelect.innerHTML = '<option value="">-- Pilih Proyek --</option>'

  projects.forEach((project) => {
    // Reset Template Default
    projectTasks[project.ulok] = []
    const option = document.createElement("option")
    option.value = project.ulok
    option.textContent = `${project.ulok} | ${project.store} (${project.work})`
    ulokSelect.appendChild(option)
  })
  ulokSelect.addEventListener("change", (e) => {
    const selectedUlok = e.target.value
    if (selectedUlok) {
      localStorage.setItem("lastSelectedUlok", selectedUlok)
    } else {
      localStorage.removeItem("lastSelectedUlok")
    }
    if (!selectedUlok) {
      showSelectProjectMessage()
      return
    }
    currentProject = projects.find((p) => p.ulok === selectedUlok)
    if (projectTasks[selectedUlok]) {
      currentTasks = projectTasks[selectedUlok]
    }
    hasUserInput = false
    isProjectLocked = false
    fetchGanttDataForSelection(selectedUlok)
    renderProjectInfo()
    updateStats()
    document.getElementById("exportButtons").style.display = "block"
    const checkpointSection = document.getElementById("checkpointSection")
    if (checkpointSection) checkpointSection.style.display = "block"
    populateCheckpointTasks()
  })
  const savedUlok = localStorage.getItem("lastSelectedUlok")
  if (savedUlok) {
    const projectExists = projects.some((p) => p.ulok === savedUlok)
    if (projectExists) {
      ulokSelect.value = savedUlok
      ulokSelect.dispatchEvent(new Event("change"))
    }
  }
  showSelectProjectMessage()
}

// ==================== GANTT DATA FETCH (API) ====================
async function fetchGanttDataForSelection(selectedValue) {
  if (!selectedValue) {
    ganttApiData = null
    renderApiData()
    return
  }

  const { ulok, lingkup } = extractUlokAndLingkup(selectedValue)
  isLoadingGanttData = true
  ganttApiError = null
  renderApiData()

  const url = `${ENDPOINTS.ganttData}?ulok=${encodeURIComponent(ulok)}&lingkup=${encodeURIComponent(lingkup)}`

  try {
    const response = await fetch(url)

    if (response.status === 404) {
      throw new Error("DATA_NOT_FOUND")
    }

    const data = await response.json()
    if (!response.ok) throw new Error(data.message || "Error fetch")

    ganttApiData = data

    // Update project info dari RAB jika ada
    if (currentProject && data?.rab) {
      updateProjectFromRab(data.rab)
    }

    // ==================== SIMPAN FILTERED CATEGORIES ====================
    if (data.filtered_categories && Array.isArray(data.filtered_categories)) {
      filteredCategories = data.filtered_categories
      console.log("📂 Filtered Categories:", filteredCategories)
    } else {
      filteredCategories = null
    }

    // ==================== SIMPAN DAY_GANTT_DATA ====================
    if (data.day_gantt_data && Array.isArray(data.day_gantt_data)) {
      dayGanttData = data.day_gantt_data
      console.log("📅 day_gantt_data ditemukan:", dayGanttData.length, "entries")
    } else {
      dayGanttData = null
    }

    // Load and render checkpoints if available
    if (data.checkpoints && typeof data.checkpoints === "object") {
      console.log("📍 Checkpoints found in API response.")
      checkpoints = {} // Clear existing
      for (const taskId in data.checkpoints) {
        if (data.checkpoints.hasOwnProperty(taskId)) {
          checkpoints[taskId] = data.checkpoints[taskId].map((cp) => ({
            day: Number.parseInt(cp.day),
            taskName: cp.taskName,
          }))
        }
      }
      renderCheckpointList() // Render the list
    } else {
      checkpoints = {} // Clear if no checkpoints data
      renderCheckpointList() // Render empty list
    }

    // ==================== CEK GANTT_DATA ====================
    if (data.gantt_data && typeof data.gantt_data === "object") {
      console.log("📊 gantt_data ditemukan di response")

      const ganttData = data.gantt_data
      rawGanttData = ganttData // Store for delay reference
      const ganttStatus = String(ganttData.Status || "")
        .trim()
        .toLowerCase()

      // Cek Status di gantt_data
      if (ganttStatus === "terkunci" || ganttStatus === "locked" || ganttStatus === "published") {
        isProjectLocked = true
        hasUserInput = true
        console.log("🔒 Status Gantt: TERKUNCI")

        // Parse data kategori dari gantt_data untuk chart dengan day_gantt_data
        parseGanttDataToTasks(ganttData, selectedValue, dayGanttData)
      } else {
        // Status Active - tampilkan data di input form
        isProjectLocked = false
        console.log("🔓 Status Gantt: ACTIVE - Menampilkan data di form input")

        // Parse data kategori dari gantt_data ke input form dengan day_gantt_data
        parseGanttDataToTasks(ganttData, selectedValue, dayGanttData)
        hasUserInput = true
      }
    } else if (data.existing_tasks && Array.isArray(data.existing_tasks) && data.existing_tasks.length > 0) {
      // Fallback ke existing_tasks jika gantt_data tidak ada
      console.log("📋 Menggunakan existing_tasks")

      currentTasks = data.existing_tasks.map((t) => ({
        id: t.id,
        name: t.name,
        start: t.start,
        duration: t.duration,
        dependencies: t.dependencies || [],
        inputData: { startDay: t.start, endDay: t.start + t.duration - 1 },
      }))

      projectTasks[selectedValue] = currentTasks
      hasUserInput = true
      isProjectLocked = false
    } else {
      throw new Error("DATA_EMPTY")
    }
  } catch (error) {
    console.warn("⚠️ Menggunakan template default:", error.message)
    ganttApiError = null
    rawGanttData = null // Reset raw data on error
    dayGanttData = null // Reset day gantt data on error
    checkpoints = {} // Clear checkpoints on error
    renderCheckpointList() // Render empty list

    if (currentProject) {
      let templateTasks
      if (currentProject.work === "ME") {
        templateTasks = JSON.parse(JSON.stringify(taskTemplateME))
      } else {
        templateTasks = JSON.parse(JSON.stringify(taskTemplateSipil))
      }

      // Filter tasks berdasarkan filtered_categories jika ada
      if (filteredCategories && Array.isArray(filteredCategories) && filteredCategories.length > 0) {
        currentTasks = templateTasks.filter((task) => {
          return filteredCategories.some(
            (cat) =>
              task.name.toUpperCase().includes(cat.toUpperCase()) ||
              cat.toUpperCase().includes(task.name.toUpperCase()),
          )
        })
        // Re-assign ID agar berurutan
        currentTasks = currentTasks.map((task, idx) => ({ ...task, id: idx + 1 }))
        console.log(`📋 Tasks filtered: ${currentTasks.length} dari ${templateTasks.length}`)
      } else {
        currentTasks = templateTasks
      }

      projectTasks[selectedValue] = currentTasks
      hasUserInput = false

      isProjectLocked = false
    }
  } finally {
    isLoadingGanttData = false
    renderProjectInfo()

    renderApiData()

    if (hasUserInput) {
      renderChart()
    } else {
      showPleaseInputMessage()
    }
    updateStats()
  }
}

// ==================== PARSE GANTT_DATA TO TASKS ====================
function parseGanttDataToTasks(ganttData, selectedValue, dayGanttDataArray = null) {
  if (!currentProject || !ganttData) return

  const dynamicTasks = []
  let earliestDate = null
  const tempTaskList = []
  let i = 1

  // Extract categories from gantt_data
  while (true) {
    const kategoriKey = `Kategori_${i}`
    const keterlambatanKey = `Keterlambatan_Kategori_${i}`

    if (!ganttData.hasOwnProperty(kategoriKey)) {
      break
    }

    const kategoriName = ganttData[kategoriKey]
    const keterlambatan = Number.parseInt(ganttData[keterlambatanKey]) || 0

    if (kategoriName && kategoriName.trim() !== "") {
      tempTaskList.push({
        id: i,
        name: kategoriName,
        keterlambatan: keterlambatan,
      })
    }
    i++
  }

  // Parse day_gantt_data to get ranges for each category
  const categoryRangesMap = {}

  if (dayGanttDataArray && Array.isArray(dayGanttDataArray) && dayGanttDataArray.length > 0) {
    console.log("📅 Parsing day_gantt_data for ranges...")

    // Find earliest date from day_gantt_data
    dayGanttDataArray.forEach((entry) => {
      const hAwalStr = entry.h_awal
      if (hAwalStr) {
        const parsedDate = parseDateDDMMYYYY(hAwalStr)
        if (parsedDate && !isNaN(parsedDate.getTime())) {
          if (!earliestDate || parsedDate < earliestDate) {
            earliestDate = parsedDate
          }
        }
      }
    })

    if (!earliestDate) {
      earliestDate = new Date()
    }

    const projectStartDate = earliestDate
    currentProject.startDate = projectStartDate.toISOString().split("T")[0]
    console.log(`📆 Project Start Date (dari day_gantt_data): ${currentProject.startDate}`)

    const msPerDay = 1000 * 60 * 60 * 24

    // Group ranges by category
    dayGanttDataArray.forEach((entry) => {
      const kategori = entry.Kategori
      if (!kategori) return

      const hAwalStr = entry.h_awal
      const hAkhirStr = entry.h_akhir

      if (!hAwalStr || !hAkhirStr) return

      const startDate = parseDateDDMMYYYY(hAwalStr)
      const endDate = parseDateDDMMYYYY(hAkhirStr)

      if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return
      }

      const startDay = Math.round((startDate - projectStartDate) / msPerDay) + 1
      const endDay = Math.round((endDate - projectStartDate) / msPerDay) + 1
      const duration = endDay - startDay + 1

      if (!categoryRangesMap[kategori]) {
        categoryRangesMap[kategori] = []
      }

      categoryRangesMap[kategori].push({
        start: startDay > 0 ? startDay : 1,
        end: endDay > 0 ? endDay : 1,
        duration: duration > 0 ? duration : 1,
      })
    })

    console.log("📊 Category Ranges Map:", categoryRangesMap)
  } else {
    // No day_gantt_data, use current date as start
    earliestDate = new Date()
    currentProject.startDate = earliestDate.toISOString().split("T")[0]
    console.log(`📆 Project Start Date (default): ${currentProject.startDate}`)
  }

  // Build dynamic tasks with ranges from day_gantt_data
  tempTaskList.forEach((item) => {
    // Find matching ranges by normalizing category names
    const normalizedName = item.name.toLowerCase().trim()
    let ranges = []

    // Try to find ranges by matching category name
    for (const [kategori, rangeArray] of Object.entries(categoryRangesMap)) {
      const normalizedKategori = kategori.toLowerCase().trim()
      if (
        normalizedName === normalizedKategori ||
        normalizedName.includes(normalizedKategori) ||
        normalizedKategori.includes(normalizedName)
      ) {
        ranges = rangeArray
        break
      }
    }

    // Calculate total duration from all ranges
    let totalDuration = 0
    let minStart = 0
    let maxEnd = 0

    if (ranges.length > 0) {
      totalDuration = ranges.reduce((sum, r) => sum + r.duration, 0)
      minStart = Math.min(...ranges.map((r) => r.start))
      maxEnd = Math.max(...ranges.map((r) => r.end))
    }

    dynamicTasks.push({
      id: item.id,
      name: item.name,
      start: minStart,
      duration: totalDuration,
      dependencies: [],
      keterlambatan: item.keterlambatan || 0,
      inputData: {
        ranges: ranges,
        startDay: minStart,
        endDay: maxEnd,
      },
    })
  })

  currentTasks = dynamicTasks
  projectTasks[selectedValue] = currentTasks

  console.log(`✅ Data API berhasil diparsing: ${currentTasks.length} tahapan ditemukan.`)
}

// Helper function to parse DD/MM/YYYY date format
function parseDateDDMMYYYY(dateStr) {
  if (!dateStr) return null

  const parts = dateStr.split("/")
  if (parts.length !== 3) return null

  const day = Number.parseInt(parts[0], 10)
  const month = Number.parseInt(parts[1], 10) - 1 // Month is 0-indexed
  const year = Number.parseInt(parts[2], 10)

  const date = new Date(year, month, day)
  return isNaN(date.getTime()) ? null : date
}

function renderApiData() {
  const container = document.getElementById("apiData")
  if (!container) return

  if (ganttApiError) {
    container.innerHTML = `<div class="api-card error"><p>${ganttApiError}</p></div>`
    return
  }

  // Jika project terkunci, tampilkan form input keterlambatan
  if (isProjectLocked && rawGanttData) {
    container.innerHTML = `
            <div class="api-card locked" style="border: 2px solid #48bb78; background: #f0fff4; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h3 style="color: #2f855a; margin:0;">✅ Jadwal Terkunci</h3>
                <p style="margin:5px 0 0 0; color: #276749;">Jadwal sudah dikunci. Anda dapat menginput keterlambatan di bawah.</p>
            </div>
            <div class="delay-control-card">
                <div class="delay-title">
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Input Keterlambatan (Delay)
                </div>
                <div class="delay-form-row">
                    <div class="form-group" style="flex: 2;">
                        <label>Pilih Tahapan Pekerjaan</label>
                        <select id="delayTaskSelect" class="form-control">
                            <option value="">-- Pilih Tahapan --</option>
                        </select>
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label>Jml Hari (Delay)</label>
                        <input type="number" id="delayDaysInput" class="form-control" placeholder="0" min="0">
                    </div>
                    <button onclick="handleDelayUpdate('apply')" class="btn-terapkan-delay">
                        Terapkan
                    </button>
                </div>
            </div>
        `
    populateTaskOptionsFromGanttData()
    return
  }

  // Jika belum terkunci (status Active), tampilkan pesan
  if (!isProjectLocked && rawGanttData) {
    container.innerHTML = `
            <div class="api-card warning" style="border: 2px solid #ed8936; background: #fffaf0; padding: 20px; border-radius: 8px; text-align: center;">
                <div style="font-size: 36px; margin-bottom: 10px;">🔓</div>
                <h3 style="color: #c05621; margin:0 0 10px 0;">Gantt Chart Belum Dikunci</h3>
                <p style="margin:0; color: #9c4221;">Jadwal pengerjaan belum dikunci oleh Kontraktor.<br>Silakan tunggu hingga kontraktor mengunci jadwal untuk dapat menginput keterlambatan.</p>
            </div>`
    return
  }

  // Jika tidak ada gantt_data sama sekali (belum dibuat kontraktor)
  if (!rawGanttData && currentProject) {
    container.innerHTML = `
            <div class="api-card info" style="border: 2px solid #3182ce; background: #ebf8ff; padding: 20px; border-radius: 8px; text-align: center;">
                <div style="font-size: 36px; margin-bottom: 10px;">📝</div>
                <h3 style="color: #2b6cb0; margin:0 0 10px 0;">Jadwal Belum Dibuat</h3>
                <p style="margin:0; color: #2c5282;">Jadwal pengerjaan belum dibuat oleh Kontraktor.<br>Silakan tunggu hingga kontraktor membuat dan mengunci jadwal.</p>
            </div>`
    return
  }

  // Default: tidak ada data
  container.innerHTML = ""
}

function populateTaskOptions() {
  const select = document.getElementById("delayTaskSelect")
  if (!select || !currentTasks || currentTasks.length === 0) return
  select.innerHTML = '<option value="">-- Pilih Tahapan --</option>'

  currentTasks.forEach((task) => {
    const option = document.createElement("option")
    option.value = task.name
    option.textContent = task.name
    select.appendChild(option)
  })
}

// Populate dropdown dari gantt_data dengan nilai keterlambatan
function populateTaskOptionsFromGanttData() {
  const select = document.getElementById("delayTaskSelect")
  if (!select || !rawGanttData) return
  select.innerHTML = '<option value="">-- Pilih Tahapan --</option>'

  // Loop melalui kategori di gantt_data
  let i = 1
  while (true) {
    const kategoriKey = `Kategori_${i}`
    const keterlambatanKey = `Keterlambatan_Kategori_${i}`

    if (!rawGanttData.hasOwnProperty(kategoriKey)) break

    const kategoriName = rawGanttData[kategoriKey]
    const keterlambatan = rawGanttData[keterlambatanKey] || "0"

    // Hanya tambahkan jika kategori tidak kosong
    if (kategoriName && kategoriName.trim() !== "") {
      const option = document.createElement("option")
      option.value = kategoriName
      option.dataset.kategoriIndex = i // Store index for reference
      option.dataset.keterlambatan = keterlambatan

      // Format: "Nama Kategori (Keterlambatan: X hari)"
      const delayText =
        keterlambatan !== "0" && keterlambatan !== ""
          ? ` (Keterlambatan: ${keterlambatan} hari)`
          : " (Keterlambatan: 0 hari)"
      option.textContent = kategoriName + delayText

      select.appendChild(option)
    }
    i++
  }

  // Add event listener to auto-fill delay input when selecting
  select.addEventListener("change", function () {
    const selectedOption = this.options[this.selectedIndex]
    const delayInput = document.getElementById("delayDaysInput")
    if (selectedOption && selectedOption.dataset.keterlambatan && delayInput) {
      delayInput.value = selectedOption.dataset.keterlambatan || "0"
    }
  })
}

function populateCheckpointTasksFromGanttData() {
  const select = document.getElementById("checkpointTaskSelect")
  if (!select || !rawGanttData) return
  select.innerHTML = '<option value="">-- Pilih Tahapan --</option>'

  // Loop melalui kategori di gantt_data sama seperti delay dropdown
  let i = 1
  while (true) {
    const kategoriKey = `Kategori_${i}`

    if (!rawGanttData.hasOwnProperty(kategoriKey)) break

    const kategoriName = rawGanttData[kategoriKey]

    // Hanya tambahkan jika kategori tidak kosong
    if (kategoriName && kategoriName.trim() !== "") {
      const option = document.createElement("option")
      option.value = i // Store kategori index sebagai value
      option.dataset.kategoriIndex = i
      option.dataset.taskName = kategoriName
      option.textContent = kategoriName

      select.appendChild(option)
    }
    i++
  }
}

async function handleDelayUpdate(action) {
  if (!currentProject) return alert("Silakan pilih No. Ulok terlebih dahulu.")

  const taskSelect = document.getElementById("delayTaskSelect")
  const daysInput = document.getElementById("delayDaysInput")

  const taskName = taskSelect.value
  const selectedOption = taskSelect.options[taskSelect.selectedIndex]
  const kategoriIndex = selectedOption?.dataset?.kategoriIndex || null

  let days = Number.parseInt(daysInput.value)
  if (!taskName) return alert("Harap pilih tahapan pekerjaan.")

  if (action === "reset") {
    if (!confirm(`Hapus keterlambatan untuk tahapan "${taskName}"?`)) return
    days = 0
  } else {
    if (isNaN(days) || days < 0) return alert("Harap masukkan jumlah hari yang valid.")
  }

  const btnApply = document.querySelector(".btn-terapkan-delay") // Changed from btn-apply to btn-terapkan-delay
  const btnReset = document.querySelector(".btn-reset-delay") // Changed from btn-reset to btn-reset-delay
  const originalApplyText = btnApply?.innerText
  const originalResetText = btnReset?.innerText

  if (action === "apply" && btnApply) {
    btnApply.innerText = "Processing..."
    btnApply.disabled = true
  } else if (action === "reset" && btnReset) {
    btnReset.innerText = "Processing..."
    btnReset.disabled = true
  }

  try {
    // Build payload dengan data dari rawGanttData yang sudah ada
    const payload = {
      "Nomor Ulok": currentProject.ulokClean || currentProject.ulok.split("-").slice(0, -1).join("-"),
      Lingkup_Pekerjaan: currentProject.work.toUpperCase(),
      Status: "Terkunci", // Tetap terkunci karena hanya update keterlambatan
      Email_Pembuat: rawGanttData?.Email_Pembuat || sessionStorage.getItem("loggedInUserEmail") || "user@unknown.com",
      Proyek: rawGanttData?.Proyek || currentProject.projectType || "Reguler",
      Alamat: rawGanttData?.Alamat || currentProject.alamat || "-",
      Cabang: rawGanttData?.Cabang || "HEAD OFFICE",
      Nama_Toko: rawGanttData?.Nama_Toko || currentProject.store || "-",
      Nama_Kontraktor: rawGanttData?.Nama_Kontraktor || "PT KONTRAKTOR",
    }

    // Copy semua kategori dari rawGanttData
    if (rawGanttData) {
      let i = 1
      while (true) {
        const kategoriKey = `Kategori_${i}`
        if (!rawGanttData.hasOwnProperty(kategoriKey)) break

        payload[`Kategori_${i}`] = rawGanttData[kategoriKey] || ""
        payload[`Hari_Mulai_Kategori_${i}`] = rawGanttData[`Hari_Mulai_Kategori_${i}`] || ""
        payload[`Hari_Selesai_Kategori_${i}`] = rawGanttData[`Hari_Selesai_Kategori_${i}`] || ""

        // Update keterlambatan untuk kategori yang dipilih
        if (kategoriIndex && Number.parseInt(kategoriIndex) === i) {
          payload[`Keterlambatan_Kategori_${i}`] = String(days)
        } else {
          payload[`Keterlambatan_Kategori_${i}`] = rawGanttData[`Keterlambatan_Kategori_${i}`] || "0"
        }
        i++
      }
    }

    console.log("📤 Sending delay update:", payload)

    const response = await fetch(ENDPOINTS.insertData, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()

    if (response.ok) {
      alert(action === "reset" ? "✅ Keterlambatan dihapus!" : "✅ Keterlambatan berhasil diterapkan!")
      daysInput.value = ""
      taskSelect.value = ""
      // Refresh data
      fetchGanttDataForSelection(currentProject.ulok)
    } else {
      throw new Error(result.message || "Gagal menyimpan data")
    }
  } catch (error) {
    console.error("❌ Error updating delay:", error)
    alert("Terjadi kesalahan: " + error.message)
  } finally {
    if (btnApply) {
      btnApply.innerText = originalApplyText || "Terapkan"
      btnApply.disabled = false
    }
    if (btnReset) {
      btnReset.innerText = originalResetText || "Hapus"
      btnReset.disabled = false
    }
  }
}

// ==================== CHANGE ULOK (SELECT PROJECT) ====================
async function changeUlok() {
  supervisionDays = {} // Clear supervisionDays when project changes
  const ulokSelect = document.getElementById("ulokSelect")
  const selectedUlok = ulokSelect.value

  if (!selectedUlok) {
    currentProject = null
    currentTasks = []
    hasUserInput = false
    showSelectProjectMessage()
    return
  }

  currentProject = projects.find((p) => p.ulok === selectedUlok)
  // Kita set currentTasks dari template dulu, nanti di-override fetchGanttData jika ada di DB
  currentTasks = projectTasks[selectedUlok]
  hasUserInput = false
  isProjectLocked = false // Reset lock state

  fetchGanttDataForSelection(selectedUlok)

  renderProjectInfo()
  updateStats()
  document.getElementById("exportButtons").style.display = "none"
  const checkpointSection = document.getElementById("checkpointSection")
  if (checkpointSection) checkpointSection.style.display = "block"
  populateCheckpointTasks()
}

// ==================== LOGIC SIMPAN & KUNCI (UPDATE) ====================
function confirmAndPublish() {
  // Cek apakah data sudah ada
  const totalDuration = currentTasks.reduce((acc, t) => acc + t.duration, 0)
  if (totalDuration === 0) {
    alert("⚠️ Jadwal masih kosong. Mohon isi durasi dan klik 'Terapkan Jadwal' terlebih dahulu.")
    return
  }

  const isSure = confirm(
    "KONFIRMASI PENGUNCIAN JADWAL\n\n" +
      "Apakah Anda yakin ingin MENGUNCI jadwal ini?\n" +
      "Setelah dikunci, inputan akan hilang dan data tidak dapat diubah lagi.\n\n" +
      "Lanjutkan?",
  )

  if (isSure) {
    // Panggil fungsi simpan dengan status "Terkunci"
    saveProjectSchedule("Terkunci")
  }
}

async function saveProjectSchedule(statusType = "Active") {
  if (!currentProject) return

  const userEmail = sessionStorage.getItem("loggedInUserEmail") || "user@unknown.com"

  // Validasi dasar
  if (!currentProject.ulokClean || !currentProject.work) {
    alert("⚠️ Data proyek tidak lengkap. Silakan refresh halaman.")
    return
  }

  // Tentukan pesan sukses berdasarkan status
  const isLocking = statusType === "Terkunci"
  const loadingText = isLocking ? "🔒 Mengunci..." : "💾 Menyimpan..."

  // Siapkan Payload
  const payload = {
    "Nomor Ulok": currentProject.ulokClean,
    Lingkup_Pekerjaan: currentProject.work.toUpperCase(),
    Status: statusType, // <--- DINAMIS ("Active" atau "Terkunci")
    Email_Pembuat: userEmail,
    Proyek: currentProject.projectType || "Reguler",
    Alamat: currentProject.alamat || "-",
    Cabang: "HEAD OFFICE",
    Nama_Toko: currentProject.store || "-",
    Nama_Kontraktor: "PT KONTRAKTOR",
  }

  // Konversi Data Tahapan ke Format Tanggal
  const projectStartDate = new Date(currentProject.startDate)

  currentTasks.forEach((task) => {
    const tStart = new Date(projectStartDate)
    tStart.setDate(projectStartDate.getDate() + (task.start - 1))

    const durationToAdd = task.duration > 0 ? task.duration - 1 : 0
    const tEnd = new Date(tStart)
    tEnd.setDate(tStart.getDate() + durationToAdd)

    const formatDateISO = (date) => date.toISOString().split("T")[0]

    payload[`Kategori_${task.id}`] = task.name
    payload[`Hari_Mulai_Kategori_${task.id}`] = formatDateISO(tStart)
    payload[`Hari_Selesai_Kategori_${task.id}`] = formatDateISO(tEnd)
    payload[`Keterlambatan_Kategori_${task.id}`] = "0"
  })

  // Add checkpoints to payload if they exist
  if (Object.keys(checkpoints).length > 0) {
    payload.checkpoints = []
    for (const taskId in checkpoints) {
      if (checkpoints.hasOwnProperty(taskId)) {
        checkpoints[taskId].forEach((cp) => {
          payload.checkpoints.push({
            taskId: Number.parseInt(taskId),
            day: cp.day,
            taskName: cp.taskName,
          })
        })
      }
    }
    console.log("🚀 Adding checkpoints to payload:", payload.checkpoints)
  }

  // Add supervisionDays to payload if they exist
  if (Object.keys(supervisionDays).length > 0) {
    payload.supervision_days = Object.keys(supervisionDays).map(Number)
    console.log("👁️ Adding supervision days to payload:", payload.supervision_days)
  }

  // Indikator Loading di Tombol yang sesuai
  const btnTarget = isLocking ? document.querySelector(".btn-publish") : document.querySelector(".btn-apply-schedule")

  const originalText = btnTarget ? btnTarget.innerText : isLocking ? "Kunci Jadwal" : "Terapkan Jadwal"

  if (btnTarget) {
    btnTarget.innerText = loadingText
    btnTarget.disabled = true
  }

  try {
    console.log(`Save Payload:">${payload})`)

    const response = await fetch(ENDPOINTS.insertData, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message || "Gagal menyimpan data ke server")
    }

    // === SUKSES ===
    if (isLocking) {
      alert("✅ Sukses! Jadwal telah DIKUNCI.")
      isProjectLocked = true // Update state lokal jadi terkunci
    } else {
      // Jika hanya Active (Terapkan Jadwal), beri notif kecil atau alert
      alert("✅ Data tersimpan sebagai 'Active'.")
      isProjectLocked = false
    }

    // Render ulang UI sesuai status baru
    renderApiData()
    renderChart()
  } catch (error) {
    console.error("❌ Error saving:", error)
    alert(`Gagal menyimpan (${statusType}): ` + error.message)
  } finally {
    if (btnTarget) {
      btnTarget.innerText = originalText
      btnTarget.disabled = false
    }
  }
}

// ==================== TASK MANIPULATION ====================
function applyTaskSchedule(silentMode = false) {
  if (!currentProject || !currentTasks.length) return false

  let hasError = false
  const updatedTasks = []

  for (const task of currentTasks) {
    const startInput = document.getElementById(`task-start-${task.id}`)
    const endInput = document.getElementById(`task-end-${task.id}`)

    if (!startInput || !endInput) {
      updatedTasks.push(task)
      continue
    }
    const startDay = Number.parseInt(startInput.value) || 0
    const endDay = Number.parseInt(endInput.value) || 0
    if (startDay === 0 && endDay === 0) {
      updatedTasks.push({ ...task, start: 0, duration: 0, inputData: { startDay: 0, endDay: 0 } })
      continue
    }
    if (endDay < startDay) {
      alert(`Error pada ${task.name}: Hari selesai (${endDay}) tidak boleh lebih kecil dari hari mulai (${startDay})!`)
      hasError = true
      break
    }
    const duration = endDay - startDay + 1
    updatedTasks.push({ ...task, start: startDay, duration: duration, inputData: { startDay, endDay } })
  }

  if (hasError) return false

  currentTasks = updatedTasks
  projectTasks[currentProject.ulok] = updatedTasks
  hasUserInput = true

  renderChart()
  updateStats()
  document.getElementById("exportButtons").style.display = "flex"

  if (!silentMode) {
    document.getElementById("ganttChart").scrollIntoView({ behavior: "smooth" })

    saveProjectSchedule("Active")
  }

  return true
}

function resetTaskSchedule() {
  if (!currentProject) return

  // Reset data di memori
  if (currentProject.work === "ME") {
    currentTasks = JSON.parse(JSON.stringify(taskTemplateME))
  } else {
    currentTasks = JSON.parse(JSON.stringify(taskTemplateSipil))
  }

  projectTasks[currentProject.ulok] = currentTasks
  hasUserInput = false

  // Render ulang form menjadi 0 semua
  renderApiData()
  showPleaseInputMessage() // Hapus chart, minta input
  updateStats()
  document.getElementById("exportButtons").style.display = "none"
  checkpoints = {}
  renderCheckpointList()
  supervisionDays = {} // Reset supervision days on reset
}

// ==================== HELPER API DATA (RAB) ====================
function updateProjectFromRab(rabData) {
  if (!rabData || !currentProject) return
  const getFirstNonEmpty = (keys) => {
    for (const key of keys) {
      const val = rabData[key]
      if (val !== undefined && val !== null && String(val).trim() !== "") return val
    }
    return undefined
  }
  const alamat = getFirstNonEmpty(["Alamat", "alamat"])
  if (alamat) currentProject.alamat = alamat
  const storeVal = getFirstNonEmpty(["Nama Toko", "Store", "Nama_Toko"])
  if (storeVal) currentProject.store = storeVal
}

// ==================== RENDERING (INFO & STATS) ====================
function renderProjectInfo() {
  if (!currentProject) return
  const info = document.getElementById("projectInfo")

  const html = `
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
    `
  info.innerHTML = html
}

function updateStats() {
  if (!currentProject) return

  // Count tasks that have ranges or duration > 0
  const inputedTasks = currentTasks.filter((t) => {
    const hasRanges = t.inputData && t.inputData.ranges && t.inputData.ranges.length > 0
    return t.duration > 0 || hasRanges
  })
  const totalInputed = inputedTasks.length

  let maxEnd = 0
  if (inputedTasks.length > 0) {
    inputedTasks.forEach((task) => {
      if (task.inputData && task.inputData.ranges && task.inputData.ranges.length > 0) {
        task.inputData.ranges.forEach((range) => {
          if (range.end > maxEnd) {
            maxEnd = range.end
          }
        })
      } else if (task.start + task.duration - 1 > maxEnd) {
        maxEnd = task.start + task.duration - 1
      }
    })
  }
  const stats = document.getElementById("stats")
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
    `
}

// ==================== CHART RENDERING ====================
function renderChart() {
  if (!currentProject) return
  const chart = document.getElementById("ganttChart")
  const DAY_WIDTH = 40

  // Tentukan lebar chart berdasarkan ranges
  let maxTaskEndDay = 0
  currentTasks.forEach((task) => {
    if (task.inputData && task.inputData.ranges && task.inputData.ranges.length > 0) {
      task.inputData.ranges.forEach((range) => {
        if (range.end > maxTaskEndDay) {
          maxTaskEndDay = range.end
        }
      })
    } else {
      const end = task.start + task.duration
      if (end > maxTaskEndDay) maxTaskEndDay = end
    }
  })

  let maxCheckpointDay = 0
  for (const taskId in checkpoints) {
    if (checkpoints.hasOwnProperty(taskId)) {
      checkpoints[taskId].forEach((cp) => {
        if (cp.day > maxCheckpointDay) {
          maxCheckpointDay = cp.day
        }
      })
    }
  }
  const maxDayToRender = Math.max(maxTaskEndDay, maxCheckpointDay)

  const totalDaysToRender = Math.max(
    currentProject.work === "ME" ? totalDaysME : totalDaysSipil,
    maxDayToRender + 10, // Add some buffer
  )

  const totalChartWidth = totalDaysToRender * DAY_WIDTH
  const projectStartDate = new Date(currentProject.startDate)

  // Render Header dengan click handler untuk supervision
  let html = '<div class="chart-header">'
  html += '<div class="task-column">Tahapan</div>'
  html += `<div class="timeline-column" style="width: ${totalChartWidth}px;">`
  for (let i = 0; i < totalDaysToRender; i++) {
    const currentDate = new Date(projectStartDate)
    currentDate.setDate(projectStartDate.getDate() + i)

    const isSunday = currentDate.getDay() === 0
    const dayNumber = i + 1
    const isSupervisionDay = supervisionDays[dayNumber] === true
    const supervisionClass = isSupervisionDay ? "supervision-active" : ""

    html += `
                <div class="day-header ${supervisionClass}" 
                     style="width: ${DAY_WIDTH}px; box-sizing: border-box; ${isSunday ? "background-color:#ffe3e3;" : ""}"
                     onclick="handleSupervisionDayClick(${dayNumber}, this)"
                     title="${isSupervisionDay ? "Hari Pengawasan - Klik untuk menghapus" : "Klik untuk menerapkan pengawasan"}">
                    <span class="d-date" style="font-weight:bold; font-size:14px;">${dayNumber}</span>
                </div>
            `
  }
  html += "</div></div>"

  // Render Body
  html += '<div class="chart-body">'
  currentTasks.forEach((task) => {
    const ranges = task.inputData?.ranges || []

    // Skip tasks that have no ranges/bars to display
    if (ranges.length === 0 && task.duration === 0) return

    const keterlambatan = task.keterlambatan || 0

    // Calculate total duration from ranges if available
    const totalDuration = task.duration > 0 ? task.duration : ranges.reduce((sum, r) => sum + (r.duration || 0), 0)

    html += '<div class="task-row">'
    html += `<div class="task-name">
            <span>${task.name}</span>
            <span class="task-duration">Total Durasi: ${totalDuration} hari${keterlambatan > 0 ? ` <span style="color: #e53e3e;">(+${keterlambatan} hari delay)</span>` : ""}</span>
        </div>`
    html += `<div class="timeline" style="width: ${totalChartWidth}px;">`

    // Render bars from ranges if available
    if (ranges.length > 0) {
      ranges.forEach((range, idx) => {
        const leftPos = (range.start - 1) * DAY_WIDTH
        const widthPos = range.duration * DAY_WIDTH - 1

        const tStart = new Date(projectStartDate)
        tStart.setDate(projectStartDate.getDate() + (range.start - 1))
        const tEnd = new Date(tStart)
        tEnd.setDate(tStart.getDate() + range.duration - 1)

        html += `<div class="bar on-time" data-task-id="${task.id}-${idx}"
                        style="left: ${leftPos}px; width: ${widthPos}px; box-sizing: border-box;"
                        title="${task.name} (Range ${idx + 1}): ${formatDateID(tStart)} - ${formatDateID(tEnd)}">
                    ${range.duration}
                </div>`
      })

      // Bar keterlambatan (merah) - setelah range terakhir
      if (keterlambatan > 0) {
        const lastRange = ranges[ranges.length - 1]
        const lastEnd = new Date(projectStartDate)
        lastEnd.setDate(projectStartDate.getDate() + lastRange.end - 1)

        const delayLeftPos = lastRange.end * DAY_WIDTH
        const delayWidthPos = keterlambatan * DAY_WIDTH - 1
        const tEndWithDelay = new Date(lastEnd)
        tEndWithDelay.setDate(lastEnd.getDate() + keterlambatan)

        html += `<div class="bar delayed" data-task-id="${task.id}-delay"
                        style="left: ${delayLeftPos}px; width: ${delayWidthPos}px; box-sizing: border-box; background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%);"
                        title="Keterlambatan ${task.name}: +${keterlambatan} hari (s/d ${formatDateID(tEndWithDelay)})">
                    +${keterlambatan}
                </div>`
      }
    } else {
      // Fallback to old single-bar rendering if no ranges
      const leftPos = (task.start - 1) * DAY_WIDTH
      const widthPos = task.duration * DAY_WIDTH

      const tStart = new Date(projectStartDate)
      tStart.setDate(projectStartDate.getDate() + (task.start - 1))
      const tEnd = new Date(tStart)
      tEnd.setDate(tStart.getDate() + task.duration - 1)

      html += `<div class="bar on-time" data-task-id="${task.id}"
                    style="left: ${leftPos}px; width: ${widthPos}px;"
                    title="${task.name}: ${formatDateID(tStart)} - ${formatDateID(tEnd)}">
                ${task.duration}h
            </div>`

      // Bar keterlambatan (merah)
      if (keterlambatan > 0) {
        const delayLeftPos = leftPos + widthPos
        const delayWidthPos = keterlambatan * DAY_WIDTH
        const tEndWithDelay = new Date(tEnd)
        tEndWithDelay.setDate(tEnd.getDate() + keterlambatan)

        html += `<div class="bar delayed" data-task-id="${task.id}-delay"
                        style="left: ${delayLeftPos}px; width: ${delayWidthPos}px; background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%);"
                        title="Keterlambatan ${task.name}: +${keterlambatan} hari (s/d ${formatDateID(tEndWithDelay)})">
                    +${keterlambatan}h
                </div>`
      }
    }

    html += "</div></div>"

    if (checkpoints[task.id]) {
      checkpoints[task.id].forEach((cp) => {
        const cpLeftPos = (cp.day - 1) * DAY_WIDTH
        html += `
                        <div class="checkpoint-marker" onclick="handleCheckpointClick(${task.id}, ${cp.day})"
                             style="left: ${cpLeftPos}px;"
                             title="Checkpoint: ${cp.taskName} - Hari ${cp.day}">
                            <div class="checkpoint-label">CP ${cp.day}</div>
                        </div>
                    `
      })
    }

    // Add supervision markers
    for (const dayNumber in supervisionDays) {
      if (supervisionDays[dayNumber]) {
        const dayInt = Number.parseInt(dayNumber, 10)
        if (dayInt >= task.start && dayInt <= task.start + task.duration - 1) {
          // Check if day falls within task duration
          const markerLeftPos = (dayInt - 1) * DAY_WIDTH
          html += `
                        <div class="supervision-marker" 
                             style="left: ${markerLeftPos}px;"
                             title="Hari Pengawasan: Hari ${dayInt}">
                        </div>
                    `
        }
      }
    }
  })
  html += "</div>"

  chart.innerHTML = html

  // Draw lines after render
  setTimeout(drawDependencyLines, 50)
}

function drawDependencyLines() {
  const existingSvg = document.querySelector(".dependency-svg")
  if (existingSvg) existingSvg.remove()

  const chartBody = document.querySelector(".chart-body")
  if (!chartBody) return

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.classList.add("dependency-svg")
  svg.style.width = `${chartBody.scrollWidth}px`
  svg.style.height = `${chartBody.scrollHeight}px`
  chartBody.appendChild(svg)
  const bodyRect = chartBody.getBoundingClientRect()

  currentTasks.forEach((task) => {
    if (task.dependencies && task.dependencies.length > 0) {
      task.dependencies.forEach((depId) => {
        const fromBar = document.querySelector(`.bar[data-task-id="${depId}"]`)
        const toBar = document.querySelector(`.bar[data-task-id="${task.id}"]`)
        if (fromBar && toBar) {
          const r1 = fromBar.getBoundingClientRect()
          const r2 = toBar.getBoundingClientRect()
          const x1 = r1.right - bodyRect.left + chartBody.scrollLeft
          const y1 = r1.top + r1.height / 2 - bodyRect.top + chartBody.scrollTop
          const x2 = r2.left - bodyRect.left + chartBody.scrollLeft
          const y2 = r2.top + r2.height / 2 - bodyRect.top + chartBody.scrollTop

          const d = `M ${x1} ${y1} C ${x1 + 20} ${y1}, ${x2 - 20} ${y2}, ${x2} ${y2}`
          const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
          path.setAttribute("d", d)
          path.classList.add("dependency-line")
          svg.appendChild(path)
        }
      })
    }
  })
}

// ==================== EXPORT EXCEL ====================
function exportToExcel() {
  if (!currentProject || !currentTasks.length) return
  const startDate = new Date(currentProject.startDate)
  const data = [
    ["Laporan Jadwal Proyek"],
    ["No. Ulok", currentProject.ulok],
    ["Nama Toko", currentProject.store],
    [],
    ["No", "Tahapan", "Mulai", "Selesai", "Durasi"],
  ]
  currentTasks.forEach((task, i) => {
    if (task.duration === 0) return
    const tStart = new Date(startDate)
    tStart.setDate(startDate.getDate() + (task.start - 1))
    const tEnd = new Date(tStart)
    tEnd.setDate(tStart.getDate() + task.duration - 1)
    data.push([i + 1, task.name, formatDateID(tStart), formatDateID(tEnd), task.duration])
  })
  const ws = window.XLSX.utils.aoa_to_sheet(data)
  const wb = window.XLSX.utils.book_new()
  window.XLSX.utils.book_append_sheet(wb, ws, "Jadwal")
  window.XLSX.writeFile(wb, `Jadwal_${currentProject.ulokClean}.xlsx`)
}

function handleCheckpointClick(taskId, day) {
  alert(
    `Checkpoint\n\nTahapan: ${checkpoints[taskId].find((cp) => cp.day === day).taskName}\nHari: ${day}\n\nKlik 'Hapus' pada daftar checkpoint untuk menghapusnya.`,
  )
}

function populateCheckpointTasks() {
  const select = document.getElementById("checkpointTaskSelect")
  if (!select) return

  select.innerHTML = '<option value="">-- Pilih Tahapan --</option>'

  // Jika ada rawGanttData (dari API), gunakan data tersebut
  if (rawGanttData) {
    let i = 1
    while (true) {
      const kategoriKey = `Kategori_${i}`

      if (!rawGanttData.hasOwnProperty(kategoriKey)) break

      const kategoriName = rawGanttData[kategoriKey]

      // Hanya tambahkan jika kategori tidak kosong
      if (kategoriName && kategoriName.trim() !== "") {
        const option = document.createElement("option")
        option.value = kategoriName
        option.dataset.kategoriIndex = i
        option.dataset.taskName = kategoriName
        option.textContent = kategoriName

        select.appendChild(option)
      }
      i++
    }
  } else if (currentTasks && currentTasks.length > 0) {
    // Fallback ke currentTasks jika rawGanttData tidak ada
    currentTasks.forEach((task) => {
      const option = document.createElement("option")
      option.value = task.id
      option.textContent = task.name
      select.appendChild(option)
    })
  }
}

function addCheckpoint() {
  const taskSelect = document.getElementById("checkpointTaskSelect")
  const dayInput = document.getElementById("checkpointDayInput")

  const taskName = taskSelect.value
  const selectedOption = taskSelect.options[taskSelect.selectedIndex]
  const kategoriIndex = selectedOption?.dataset?.kategoriIndex
  const day = Number.parseInt(dayInput.value)

  if (!taskName) {
    alert("⚠️ Silakan pilih tahapan pekerjaan!")
    return
  }
  if (!day || isNaN(day) || day < 1) {
    alert("⚠️ Silakan masukkan hari yang valid (minimal 1)!")
    return
  }

  let task = null
  let taskId = kategoriIndex ? Number.parseInt(kategoriIndex) : null

  if (!taskId) {
    // Fallback: cari dari currentTasks
    task = currentTasks.find((t) => t.id === Number.parseInt(taskSelect.value) || t.name === taskName)
    taskId = task?.id
  } else {
    // Cari task berdasarkan kategori index
    task = currentTasks.find((t) => t.id === taskId)
  }

  if (!taskId || isNaN(taskId)) {
    alert("❌ Tahapan pekerjaan tidak valid!")
    return
  }

  // Validasi durasi tahapan
  let maxDay = 1
  if (task) {
    maxDay =
      task.duration > 0
        ? task.duration
        : task.inputData?.ranges?.reduce((max, r) => Math.max(max, r.duration || 0), 0) || 1
  } else {
    // Jika task tidak ditemukan, coba hitung dari rawGanttData
    if (rawGanttData && kategoriIndex) {
      const hAwalKey = `Hari_Mulai_Kategori_${kategoriIndex}`
      const hAkhirKey = `Hari_Selesai_Kategori_${kategoriIndex}`
      if (rawGanttData[hAwalKey] && rawGanttData[hAkhirKey]) {
        const startDate = parseDateDDMMYYYY(rawGanttData[hAwalKey])
        const endDate = parseDateDDMMYYYY(rawGanttData[hAkhirKey])
        if (startDate && endDate) {
          const msPerDay = 1000 * 60 * 60 * 24
          maxDay = Math.round((endDate - startDate) / msPerDay) + 1
        }
      }
    }
  }

  if (day > maxDay) {
    alert(`⚠️ Hari checkpoint tidak boleh melebihi durasi tahapan (${maxDay} hari)!`)
    return
  }

  const confirmAdd = confirm(
    `✓ Tambah Checkpoint?\n\n` + `Tahapan: ${taskName}\n` + `Hari: ${day}\n\n` + `Apakah Anda setuju?`,
  )

  if (!confirmAdd) {
    console.log("Checkpoint addition cancelled")
    return
  }

  if (!checkpoints[taskId]) {
    checkpoints[taskId] = []
  }

  const exists = checkpoints[taskId].some((cp) => cp.day === day)
  if (exists) {
    alert(`⚠️ Checkpoint pada hari ${day} untuk tahapan ini sudah ada!`)
    return
  }

  checkpoints[taskId].push({
    day: day,
    taskName: taskName,
  })

  console.log("[v0] Checkpoint added:", checkpoints)

  taskSelect.value = ""
  dayInput.value = ""

  renderCheckpointList()
  renderChart()
}

function deleteCheckpoint(taskId, day) {
  const confirmDelete = confirm(
    `Apakah Anda yakin ingin menghapus checkpoint ini?\n\n` +
      `Tahapan: ${checkpoints[taskId].find((cp) => cp.day === day)?.taskName}\n` +
      `Hari: ${day}`,
  )

  if (!confirmDelete) return

  checkpoints[taskId] = checkpoints[taskId].filter((cp) => cp.day !== day)

  if (checkpoints[taskId].length === 0) {
    delete checkpoints[taskId]
  }

  console.log("[v0] Checkpoint deleted:", checkpoints)
  renderCheckpointList()
  renderChart()
}

function renderCheckpointList() {
  const listContainer = document.getElementById("checkpointList")
  if (!listContainer) return

  const allCheckpoints = []
  for (const [taskId, cpList] of Object.entries(checkpoints)) {
    cpList.forEach((cp) => {
      allCheckpoints.push({
        taskId: Number.parseInt(taskId),
        day: cp.day,
        taskName: cp.taskName,
      })
    })
  }

  if (allCheckpoints.length === 0) {
    listContainer.innerHTML =
      '<div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 14px;">Belum ada checkpoint</div>'
    return
  }

  allCheckpoints.sort((a, b) => a.taskId - b.taskId || a.day - b.day)

  let html = ""
  allCheckpoints.forEach((cp) => {
    html += `
            <div class="checkpoint-item">
                <div class="checkpoint-info">
                    <div class="checkpoint-task">${cp.taskName}</div>
                    <div class="checkpoint-day">📅 Hari ${cp.day}</div>
                </div>
                <button onclick="deleteCheckpoint(${cp.taskId}, ${cp.day})" class="btn-checkpoint-delete">
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                    Hapus
                </button>
            </div>
        `
  })

  listContainer.innerHTML = html
}

// ==================== SUPERVISION DAY HANDLING ====================
let supervisionDays = {} // Format: { dayNumber: true, ... }

function handleSupervisionDayClick(dayNumber, element) {
  if (supervisionDays[dayNumber]) {
    // Sudah ada pengawasan, tanyakan apakah ingin dihapus
    const confirmDelete = confirm(`Hapus pengawasan?\n\nHari: ${dayNumber}\n\nApakah Anda yakin?`)
    if (confirmDelete) {
      delete supervisionDays[dayNumber]
      element.classList.remove("supervision-active")
      renderChart() // Re-render to remove the marker
    }
  } else {
    // Belum ada pengawasan, tanyakan apakah ingin diterapkan
    const confirmAdd = confirm(`Terapkan pengawasan?\n\nHari: ${dayNumber}\n\nApakah Anda yakin?`)
    if (confirmAdd) {
      supervisionDays[dayNumber] = true
      element.classList.add("supervision-active")
      renderChart() // Re-render to add the marker
    }
  }
}

// ==================== START ====================
loadDataAndInit()
window.addEventListener("resize", () => {
  if (currentProject && hasUserInput) drawDependencyLines()
})
