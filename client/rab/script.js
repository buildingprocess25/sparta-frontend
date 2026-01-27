/**
 * CLEAN CODE RAB SCRIPT
 * Functionality remains 100% identical.
 * Structure optimized for readability and maintainability.
 */

// --- Configuration & Constants ---
const CONFIG = {
    API_BASE_URL: "https://sparta-backend-5hdj.onrender.com",
    SESSION: { START: 6, END: 18 }
};

const DATA = {
    sipilCategories: [
        "PEKERJAAN PERSIAPAN", "PEKERJAAN BOBOKAN / BONGKARAN", "PEKERJAAN TANAH", 
        "PEKERJAAN PONDASI & BETON", "PEKERJAAN PASANGAN", "PEKERJAAN BESI", 
        "PEKERJAAN KERAMIK", "PEKERJAAN PLUMBING", "PEKERJAAN SANITARY & ACECORIES", 
        "PEKERJAAN JANITOR", "PEKERJAAN ATAP", "PEKERJAAN KUSEN, PINTU & KACA", 
        "PEKERJAAN FINISHING", "PEKERJAAN BEANSPOT", "PEKERJAAN AREA TERBUKA",
        "PEKERJAAN TAMBAHAN", "PEKERJAAN SBO"
    ],
    meCategories: [
        "INSTALASI", "FIXTURE", "PEKERJAAN TAMBAHAN", "PEKERJAAN SBO"
    ],
    branchGroups: {
        "BANDUNG 1": ["BANDUNG 1", "BANDUNG 2"], "BANDUNG 2": ["BANDUNG 1", "BANDUNG 2"],
        "LOMBOK": ["LOMBOK", "SUMBAWA"], "SUMBAWA": ["LOMBOK", "SUMBAWA"],
        "MEDAN": ["MEDAN", "ACEH"], "ACEH": ["MEDAN", "ACEH"],
        "PALEMBANG": ["PALEMBANG", "BENGKULU", "BANGKA", "BELITUNG"],
        "BENGKULU": ["PALEMBANG", "BENGKULU", "BANGKA", "BELITUNG"],
        "BANGKA": ["PALEMBANG", "BENGKULU", "BANGKA", "BELITUNG"],
        "BELITUNG": ["PALEMBANG", "BENGKULU", "BANGKA", "BELITUNG"],
        "SIDOARJO": ["SIDOARJO", "SIDOARJO BPN_SMD", "MANOKWARI", "NTT", "SORONG"],
        "SIDOARJO BPN_SMD": ["SIDOARJO", "SIDOARJO BPN_SMD", "MANOKWARI", "NTT", "SORONG"],
        "MANOKWARI": ["SIDOARJO", "SIDOARJO BPN_SMD", "MANOKWARI", "NTT", "SORONG"],
        "NTT": ["SIDOARJO", "SIDOARJO BPN_SMD", "MANOKWARI", "NTT", "SORONG"],
        "SORONG": ["SIDOARJO", "SIDOARJO BPN_SMD", "MANOKWARI", "NTT", "SORONG"]
    },
    branchToUlokMap: {
        "LUWU": "2VZ1", "KARAWANG": "1JZ1", "REMBANG": "2AZ1", "BANJARMASIN": "1GZ1",
        "PARUNG": "1MZ1", "TEGAL": "2PZ1", "GORONTALO": "2SZ1", "PONTIANAK": "1PZ1",
        "LOMBOK": "1SZ1", "KOTABUMI": "1VZ1", "SERANG": "2GZ1", "CIANJUR": "2JZ1",
        "BALARAJA": "TZ01", "SIDOARJO": "UZ01", "MEDAN": "WZ01", "BOGOR": "XZ01",
        "JEMBER": "YZ01", "BALI": "QZ01", "PALEMBANG": "PZ01", "KLATEN": "OZ01",
        "MAKASSAR": "RZ01", "PLUMBON": "VZ01", "PEKANBARU": "1AZ1", "JAMBI": "1DZ1",
        "HEAD OFFICE": "Z001", "BANDUNG 1": "BZ01", "BANDUNG 2": "NZ01", "BEKASI": "CZ01",
        "CILACAP": "IZ01", "CILEUNGSI": "JZ01", "SEMARANG": "HZ01", "CIKOKOL": "KZ01",
        "LAMPUNG": "LZ01", "MALANG": "MZ01", "MANADO": "1YZ1", "BATAM": "2DZ1", "MADIUN": "2MZ1"
    }
};

// --- State Management ---
const state = {
    categorizedPrices: {},
    pendingStoreCodes: [],
    approvedStoreCodes: [],
    rejectedSubmissionsList: [],
    originalFormData: null
};

// --- DOM Elements Cache ---
const elements = {};

// Auth Check
if (!sessionStorage.getItem('loggedInUserCabang')) {
    window.location.replace('../../auth/index.html');
}

// --- Utility Functions ---
const Utils = {
    formatRupiah: (num) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num),
    parseRupiah: (str) => parseFloat(String(str).replace(/Rp\s?|\./g, "").replace(/,/g, ".")) || 0,
    formatNumber: (num) => (num === null || isNaN(num)) ? '0' : new Intl.NumberFormat('id-ID').format(num),
    parseNumber: (str) => typeof str !== 'string' ? (Number(str) || 0) : (parseFloat(String(str).replace(/\./g, '').replace(/,/g, '.')) || 0),
    
    initializeSelect2: (selector) => {
        $(selector).select2({ width: '100%' });
    },

    showMessage: (msg, type = 'info') => {
        const el = elements.messageDiv;
        el.textContent = msg;
        el.style.display = 'block';
        el.style.backgroundColor = type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : type === 'warn' ? '#ffc107' : '#007bff';
        if (type === 'success') setTimeout(() => window.location.reload(), 2000);
    }
};

// --- Business Logic Functions ---

function hitungLuasTerbangunan() {
    const lb = parseFloat(document.getElementById("luas_bangunan")?.value);
    const lat = parseFloat(document.getElementById("luas_area_terbuka")?.value);

    if (isNaN(lb) && isNaN(lat)) {
        document.getElementById("luas_terbangunan").value = "";
        return;
    }
    const hasil = (isNaN(lb) ? 0 : lb) + ((isNaN(lat) ? 0 : lat) / 2);
    if (hasil < 0) return; // Should not happen based on formula
    document.getElementById("luas_terbangunan").value = hasil.toFixed(2);
}

function updateNomorUlok() {
    const kode = document.getElementById('lokasi_cabang').value;
    const tgl = document.getElementById('lokasi_tanggal').value;
    const manual = document.getElementById('lokasi_manual').value;
    const isRenov = document.getElementById('toggle_renovasi').checked;

    if (kode && tgl.length === 4 && manual.length === 4) {
        let ulok = `${kode}${tgl}${manual}`;
        if (isRenov) ulok += "R";
        document.getElementById('lokasi').value = ulok;
    } else {
        document.getElementById('lokasi').value = '';
    }
}

function getCurrentFormData() {
    const formData = new FormData(elements.form);
    const data = Object.fromEntries(formData.entries());
    let itemIndex = 1;

    document.querySelectorAll(".boq-table-body:not(.hidden) .boq-item-row").forEach(row => {
        const jenis = row.querySelector('.jenis-pekerjaan').value;
        const vol = parseFloat(row.querySelector('.volume').value) || 0;

        if (jenis && vol > 0) {
            data[`Kategori_Pekerjaan_${itemIndex}`] = row.dataset.category;
            data[`Jenis_Pekerjaan_${itemIndex}`] = jenis;
            data[`Satuan_Item_${itemIndex}`] = row.querySelector('.satuan').value;
            data[`Volume_Item_${itemIndex}`] = vol;
            data[`Harga_Material_Item_${itemIndex}`] = Utils.parseNumber(row.querySelector('.harga-material').value);
            data[`Harga_Upah_Item_${itemIndex}`] = Utils.parseNumber(row.querySelector('.harga-upah').value);
            itemIndex++;
        }
    });
    // Ensure Nama Toko fallback
    data["nama_toko"] = data["Nama_Toko"] || document.getElementById("nama_toko")?.value?.trim() || "";
    return JSON.stringify(data);
}

// --- Table & Row Manipulation ---

function createTableStructure(categoryName, scope) {
    const wrapper = document.createElement('div');
    
    // Header Title
    const title = document.createElement('h2');
    title.className = 'text-lg font-semibold mt-6 mb-2 section-title';
    title.textContent = categoryName;

    // Table Container
    const container = document.createElement('div');
    container.className = 'table-container';
    
    // Table HTML
    const table = document.createElement('table');
    table.innerHTML = `
        <colgroup>
            <col class="col-no"><col class="col-jenis-pekerjaan"><col class="col-satuan">
            <col class="col-volume"><col class="col-harga"><col class="col-harga">
            <col class="col-total"><col class="col-total"><col class="col-total-harga"><col class="col-aksi">
        </colgroup>
        <thead>
            <tr><th rowspan="2">No</th><th rowspan="2">Jenis Pekerjaan</th><th rowspan="2">Satuan</th><th colspan="1">Volume</th><th colspan="2">Harga Satuan (Rp)</th><th colspan="2">Total Harga Satuan (Rp)</th><th colspan="1">Total Harga (Rp)</th><th rowspan="2">Aksi</th></tr>
            <tr><th>a</th><th>Material<br>(b)</th><th>Upah<br>(c)</th><th>Material<br>(d = a × b)</th><th>Upah<br>(e = a × c)</th><th>(f = d + e)</th></tr>
        </thead>
        <tbody class="boq-table-body" data-category="${categoryName}" data-scope="${scope}"></tbody>
        <tfoot>
            <tr><td colspan="8" style="text-align: right; font-weight: bold">Sub Total:</td><td class="sub-total-amount" style="font-weight: bold; text-align: center">Rp 0</td><td></td></tr>
        </tfoot>`;
    
    container.appendChild(table);

    // Add Button
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'add-row-btn';
    btn.dataset.category = categoryName;
    btn.dataset.scope = scope;
    btn.textContent = `Tambah Item ${categoryName}`;
    
    // Event listener for adding row
    btn.addEventListener("click", () => handleAddRow(btn, categoryName, scope));

    wrapper.appendChild(title);
    wrapper.appendChild(container);
    wrapper.appendChild(btn);

    return wrapper;
}

function createBoQRow(category, scope) {
    const row = document.createElement("tr");
    row.classList.add("boq-item-row");
    row.dataset.scope = scope; 
    row.dataset.category = category;

    row.innerHTML = `
        <td class="col-no"><span class="row-number"></span></td>
        <td class="col-jenis-pekerjaan"><select class="jenis-pekerjaan form-control" name="Jenis_Pekerjaan_Item" required><option value="">-- Pilih --</option></select></td>
        <td class="col-satuan"><input type="text" class="satuan form-control auto-filled" name="Satuan_Item" required readonly /></td>
        <td class="col-volume"><input type="text" class="volume form-control" name="Volume_Item" value="0.00" inputmode="decimal" /></td>
        <td class="col-harga"><input type="text" class="harga-material form-control auto-filled" name="Harga_Material_Item" inputmode="numeric" required readonly /></td>
        <td class="col-harga"><input type="text" class="harga-upah form-control auto-filled" name="Harga_Upah_Item" inputmode="numeric" required readonly /></td>
        <td class="col-total"><input type="text" class="total-material form-control auto-filled" disabled /></td>
        <td class="col-total"><input type="text" class="total-upah form-control auto-filled" disabled /></td>
        <td class="col-total-harga"><input type="text" class="total-harga form-control auto-filled" disabled /></td>
        <td class="col-aksi"><button type="button" class="delete-row-btn">Hapus</button></td>
    `;
    
    // Attach Listeners
    const volInput = row.querySelector(".volume");
    volInput.addEventListener("input", (e) => {
        // Sanitize input
        e.target.value = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1').replace(/(\.\d{2})\d+/, '$1');
        calculateTotalPrice(e.target);
    });

    row.querySelector(".delete-row-btn").addEventListener("click", () => { 
        $(row.querySelector('.jenis-pekerjaan')).select2('destroy');
        row.remove(); 
        updateAllRowNumbersAndTotals(); 
        refreshJenisPekerjaanOptions(category);
    });

    const select = row.querySelector('.jenis-pekerjaan');
    $(select).on('change', function (e) {
        autoFillPrices(e.target);
        refreshJenisPekerjaanOptions(row.dataset.category);
    });
    Utils.initializeSelect2(select);
    
    return row;
}

function buildTables(scope, data) { // Although logic exists, we ensure initial build is correct
    const wrapper = scope === 'Sipil' ? elements.sipilTablesWrapper : elements.meTablesWrapper;
    wrapper.innerHTML = ''; // Clear existing
    const categories = scope === 'Sipil' ? DATA.sipilCategories : DATA.meCategories;
    
    categories.forEach(cat => wrapper.appendChild(createTableStructure(cat, scope)));
}

async function handleAddRow(button, category, scope) {
    const tableContainer = button.parentElement.querySelector('.table-container');
    if (tableContainer) tableContainer.style.display = 'block';

    const dataSource = scope === "Sipil" ? state.categorizedPrices.categorizedSipilPrices : state.categorizedPrices.categorizedMePrices;
    
    if (!dataSource || Object.keys(dataSource).length === 0) {
        await fetchAndPopulatePrices();
    }

    const targetTbody = document.querySelector(`.boq-table-body[data-category="${category}"]`);
    if (targetTbody) {
        const newRow = createBoQRow(category, scope);
        targetTbody.appendChild(newRow);
        populateJenisPekerjaanOptionsForNewRow(newRow);
        updateAllRowNumbersAndTotals();
    }
}

// --- Pricing & Calculation Logic ---

function populateJenisPekerjaanOptionsForNewRow(rowElement) {
    const { category, scope } = rowElement.dataset;
    const selectEl = rowElement.querySelector(".jenis-pekerjaan");
    if (!selectEl) return;

    const dataSource = (scope === "Sipil") ? state.categorizedPrices.categorizedSipilPrices : state.categorizedPrices.categorizedMePrices;
    const items = dataSource ? (dataSource[category] || []) : [];
    
    // Filter existing
    const selectedValues = Array.from(document.querySelectorAll(`.boq-table-body[data-category="${category}"] .jenis-pekerjaan`))
        .map(s => s.value).filter(v => v !== "");

    selectEl.innerHTML = '<option value="">-- Pilih Jenis Pekerjaan --</option>';
    
    if (items.length > 0) {
        items.forEach(item => {
            const opt = document.createElement("option");
            opt.value = item["Jenis Pekerjaan"];
            opt.textContent = item["Jenis Pekerjaan"];
            if (selectedValues.includes(opt.value)) opt.disabled = true;
            selectEl.appendChild(opt);
        });
    } else {
        selectEl.innerHTML = '<option value="">-- Tidak ada item --</option>';
    }
}

function refreshJenisPekerjaanOptions(category) {
    const selects = document.querySelectorAll(`.boq-table-body[data-category="${category}"] .jenis-pekerjaan`);
    const selectedValues = Array.from(selects).map(s => s.value).filter(v => v !== "");

    selects.forEach(sel => {
        Array.from(sel.options).forEach(opt => {
            if (!opt.value) return;
            opt.disabled = (opt.value !== sel.value && selectedValues.includes(opt.value));
        });
    });
}

function autoFillPrices(selectElement) {
    const row = selectElement.closest("tr");
    if (!row) return;

    const val = selectElement.value;
    const { category } = row.dataset;
    const scope = elements.lingkupSelect.value;
    
    const els = {
        vol: row.querySelector(".volume"),
        mat: row.querySelector(".harga-material"),
        upah: row.querySelector(".harga-upah"),
        sat: row.querySelector(".satuan")
    };

    // Reset State
    [els.vol, els.mat, els.upah, els.sat].forEach(el => el.classList.remove('auto-filled', 'kondisional-input'));
    
    // Remove temporary listeners
    els.mat.removeEventListener('input', handleCurrencyInput);
    els.upah.removeEventListener('input', handleCurrencyInput);

    if (!val) {
        els.vol.value = "0.00"; els.vol.readOnly = false;
        els.mat.value = "0"; els.mat.readOnly = true;
        els.upah.value = "0"; els.upah.readOnly = true;
        els.sat.value = "";
        calculateTotalPrice(selectElement);
        return;
    }

    const dataSource = (scope === "Sipil") ? state.categorizedPrices.categorizedSipilPrices : state.categorizedPrices.categorizedMePrices;
    const itemData = dataSource?.[category]?.find(i => i["Jenis Pekerjaan"] === val);

    if (itemData) {
        els.sat.value = itemData["Satuan"];
        els.sat.classList.add('auto-filled');
        
        const isLs = itemData["Satuan"] === "Ls";
        els.vol.value = isLs ? "1.00" : "0.00";
        els.vol.readOnly = isLs;
        if(isLs) els.vol.classList.add('auto-filled');

        const isMatCond = itemData["Harga Material"] === "Kondisional";
        const isUpahCond = itemData["Harga Upah"] === "Kondisional";

        // Material Logic
        els.mat.value = isMatCond ? "0" : Utils.formatNumber(itemData["Harga Material"]);
        els.mat.readOnly = true; 
        els.mat.classList.add("auto-filled");

        // Upah Logic (Editable if either is conditional)
        if (isMatCond || isUpahCond) {
            els.upah.value = "0";
            els.upah.readOnly = false;
            els.upah.classList.add("kondisional-input");
            els.upah.addEventListener("input", handleCurrencyInput);
            els.upah.focus();
        } else {
            els.upah.value = Utils.formatNumber(itemData["Harga Upah"]);
            els.upah.readOnly = true;
            els.upah.classList.add("auto-filled");
        }
    }
    calculateTotalPrice(selectElement);
}

const handleCurrencyInput = (e) => {
    let val = e.target.value.replace(/[^0-9]/g, '');
    e.target.value = val === '' ? '' : Utils.formatNumber(parseInt(val, 10));
    calculateTotalPrice(e.target);
};

function calculateTotalPrice(inputElement) {
    const row = inputElement.closest("tr");
    if (!row) return;

    const vol = parseFloat(row.querySelector(".volume").value) || 0;
    const mat = Utils.parseNumber(row.querySelector(".harga-material").value);
    const upah = Utils.parseNumber(row.querySelector(".harga-upah").value);

    const totMat = vol * mat;
    const totUpah = vol * upah;

    row.querySelector(".total-material").value = Utils.formatRupiah(totMat);
    row.querySelector(".total-upah").value = Utils.formatRupiah(totUpah);
    row.querySelector(".total-harga").value = Utils.formatRupiah(totMat + totUpah);

    calculateSubTotal(row.closest(".boq-table-body"));
    calculateGrandTotal();
}

const calculateSubTotal = (tbody) => {
    let sum = 0;
    tbody.querySelectorAll(".total-harga").forEach(inp => sum += Utils.parseRupiah(inp.value));
    const label = tbody.closest("table").querySelector(".sub-total-amount");
    if (label) label.textContent = Utils.formatRupiah(sum);
};

const calculateGrandTotal = () => {
    let total = 0;
    document.querySelectorAll(".boq-table-body:not(.hidden) .total-harga").forEach(inp => total += Utils.parseRupiah(inp.value));
    
    if (elements.grandTotal) elements.grandTotal.textContent = Utils.formatRupiah(total);
    
    const round = Math.floor(total / 10000) * 10000;
    const ppn = round * 0.11;
    
    if (elements.roundTotal) elements.roundTotal.textContent = Utils.formatRupiah(round);
    if (elements.ppnTotal) elements.ppnTotal.textContent = Utils.formatRupiah(ppn);
    if (elements.finalTotal) elements.finalTotal.textContent = Utils.formatRupiah(round + ppn);
};

const updateAllRowNumbersAndTotals = () => {
    document.querySelectorAll(".boq-table-body").forEach(tbody => {
        tbody.querySelectorAll(".boq-item-row").forEach((row, i) => row.querySelector(".row-number").textContent = i + 1);
        calculateSubTotal(tbody);
    });
    calculateGrandTotal();
};

// --- Data Fetching & Submission ---

async function fetchAndPopulatePrices() {
    const cab = elements.cabangSelect.value;
    const scope = elements.lingkupSelect.value;
    if (!cab || !scope) return;

    Utils.showMessage(`Memuat data harga ${cab} - ${scope}...`);

    try {
        const res = await fetch(`${CONFIG.API_BASE_URL}/get-data?cabang=${cab}&lingkup=${scope}`);
        if (!res.ok) throw new Error("Gagal mengambil data");
        const data = await res.json();
        
        buildTables(scope, data); // Rebuilds clean tables

        if (scope === 'Sipil') state.categorizedPrices.categorizedSipilPrices = data;
        else state.categorizedPrices.categorizedMePrices = data;

        Utils.showMessage("Data siap.", 'success-silent'); // Custom logic for silent success
        elements.messageDiv.style.display = 'none';
    } catch (e) {
        Utils.showMessage(`Error: ${e.message}`, 'error');
    }
}

async function handleFormSubmit() {
    if (!elements.form.checkValidity()) {
        elements.form.reportValidity();
        return;
    }

    const currentData = getCurrentFormData();
    if (state.originalFormData && currentData === state.originalFormData) {
        Utils.showMessage("Tidak ada perubahan yang terdeteksi.", 'warn');
        return;
    }

    const lt = parseFloat(document.getElementById("luas_terbangunan").value);
    if (!lt || lt <= 0) {
        Utils.showMessage("Luas Terbangunan tidak valid.", 'error');
        return;
    }

    elements.submitBtn.disabled = true;
    Utils.showMessage("Mengirim data...", 'info');

    try {
        const payload = JSON.parse(currentData);
        payload["Cabang"] = elements.cabangSelect.value;
        payload["Email_Pembuat"] = sessionStorage.getItem("loggedInUserEmail");
        payload["Grand Total"] = Utils.parseRupiah(elements.grandTotal.textContent);

        const res = await fetch(`${CONFIG.API_BASE_URL}/api/submit_rab`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const result = await res.json();

        if (res.ok && result.status === "success") {
            Utils.showMessage("Berhasil! Halaman akan dimuat ulang.", 'success');
        } else {
            throw new Error(result.message || "Server error");
        }
    } catch (e) {
        Utils.showMessage(`Error: ${e.message}`, 'error');
        elements.submitBtn.disabled = false;
    }
}

// --- Initialization & Event Binding ---

function checkAndPopulateRejectedData() {
    const ulok = document.getElementById('lokasi').value.replace(/-/g, '');
    const scope = elements.lingkupSelect.value;
    
    if ((ulok.length !== 12 && ulok.length !== 13) || !scope) return;

    const data = state.rejectedSubmissionsList.find(i => 
        i['Nomor Ulok'].replace(/-/g, '') === ulok && 
        (i['Lingkup_Pekerjaan'] || i['Lingkup Pekerjaan']) === scope
    );

    if (data && confirm(`Ada revisi untuk ${data['Nomor Ulok']}. Muat data?`)) {
        populateFormWithHistory(data);
    }
}

async function populateFormWithHistory(data) {
    elements.form.reset();
    elements.sipilTablesWrapper.innerHTML = "";
    elements.meTablesWrapper.innerHTML = "";

    // Parse Ulok
    const ulok = data["Nomor Ulok"].replace(/-/g, "");
    const parts = ulok.match(/^(.{4})(.{4})(.{4})(R)?$/);
    
    if (parts) {
        document.getElementById("lokasi_cabang").value = parts[1];
        document.getElementById("lokasi_tanggal").value = parts[2];
        document.getElementById("lokasi_manual").value = parts[3];
        const isRenov = !!parts[4];
        document.getElementById("toggle_renovasi").checked = isRenov;
        document.getElementById("toggle_renovasi").dispatchEvent(new Event('change'));
    }

    // Fill inputs
    Object.keys(data).forEach(k => {
        const inp = elements.form.querySelector(`[name="${k}"]`);
        if (inp && k !== "Nomor Ulok") inp.value = data[k];
    });
    // Fallback for names
    if (data["nama_toko"]) document.getElementById("nama_toko").value = data["nama_toko"];

    // Trigger loads
    elements.lingkupSelect.dispatchEvent(new Event('change'));
    await fetchAndPopulatePrices();

    // Fill Rows
    const details = data["Item_Details_JSON"] ? JSON.parse(data["Item_Details_JSON"]) : data;
    const scope = elements.lingkupSelect.value;

    for (let i = 1; i <= 200; i++) {
        if (!details[`Jenis_Pekerjaan_${i}`]) continue;
        
        const cat = details[`Kategori_Pekerjaan_${i}`];
        const tbody = document.querySelector(`.boq-table-body[data-category="${cat}"]`);
        
        if (tbody) {
            const row = createBoQRow(cat, scope);
            tbody.appendChild(row);
            populateJenisPekerjaanOptionsForNewRow(row);
            
            // Set values
            const sel = row.querySelector(".jenis-pekerjaan");
            sel.value = details[`Jenis_Pekerjaan_${i}`];
            autoFillPrices(sel); // Basic fill

            // Overrides
            row.querySelector(".volume").value = details[`Volume_Item_${i}`] || "0.00";
            if (!row.querySelector(".harga-material").readOnly) 
                row.querySelector(".harga-material").value = Utils.formatNumber(details[`Harga_Material_Item_${i}`]);
            if (!row.querySelector(".harga-upah").readOnly) 
                row.querySelector(".harga-upah").value = Utils.formatNumber(details[`Harga_Upah_Item_${i}`]);
            
            calculateTotalPrice(row.querySelector(".volume"));
        }
    }
    updateAllRowNumbersAndTotals();
    state.originalFormData = getCurrentFormData();
}

async function initializePage() {
    // Cache Elements
    elements.form = document.getElementById("form");
    elements.submitBtn = document.getElementById("submit-button");
    elements.messageDiv = document.getElementById("message");
    elements.grandTotal = document.getElementById("grand-total-amount");
    elements.roundTotal = document.getElementById("pembulatan-amount");
    elements.ppnTotal = document.getElementById("ppn-amount");
    elements.finalTotal = document.getElementById("final-total-amount");
    elements.lingkupSelect = document.getElementById("lingkup_pekerjaan");
    elements.cabangSelect = document.getElementById("cabang");
    elements.sipilTablesWrapper = document.getElementById("sipil-tables-wrapper");
    elements.meTablesWrapper = document.getElementById("me-tables-wrapper");

    const manualInput = document.getElementById('lokasi_manual');
    const toggleRenov = document.getElementById('toggle_renovasi');

    // --- Event Listeners ---
    
    // Area Calculation
    ["luas_bangunan", "luas_area_terbuka"].forEach(id => {
        document.getElementById(id)?.addEventListener("input", hitungLuasTerbangunan);
    });

    // Renovasi Toggle
    toggleRenov.addEventListener('change', () => {
        const isRenov = toggleRenov.checked;
        document.getElementById('separator_renov').style.display = isRenov ? 'inline' : 'none';
        document.getElementById('suffix_renov').style.display = isRenov ? 'block' : 'none';
        manualInput.placeholder = isRenov ? "C0B4" : "0001";
        manualInput.value = manualInput.value.replace(isRenov ? /[^a-zA-Z0-9]/g : /[^0-9]/g, '');
        updateNomorUlok();
    });

    manualInput.addEventListener('input', function() {
        this.value = toggleRenov.checked ? this.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : this.value.replace(/[^0-9]/g, '');
        updateNomorUlok();
        checkAndPopulateRejectedData();
    });

    // Ulok Updates
    ['lokasi_cabang', 'lokasi_tanggal'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            updateNomorUlok();
            checkAndPopulateRejectedData();
        });
    });

    // Scope Change - The Core Logic for Tables
    elements.lingkupSelect.addEventListener("change", () => {
        const scope = elements.lingkupSelect.value;
        elements.sipilTablesWrapper.innerHTML = '';
        elements.meTablesWrapper.innerHTML = '';
        
        elements.sipilTablesWrapper.classList.toggle("hidden", scope !== 'Sipil');
        elements.meTablesWrapper.classList.toggle("hidden", scope !== 'ME');

        if (scope && elements.cabangSelect.value) fetchAndPopulatePrices();
        checkAndPopulateRejectedData();
    });

    elements.cabangSelect.addEventListener('change', () => {
        if (elements.lingkupSelect.value) fetchAndPopulatePrices();
    });

    elements.submitBtn.addEventListener("click", (e) => {
        e.preventDefault();
        handleFormSubmit();
    });

    // --- Populate Initial Dropdowns ---
    const userCabang = sessionStorage.getItem('loggedInUserCabang')?.toUpperCase();
    const locCabSelect = document.getElementById('lokasi_cabang');
    
    // Logic Cabang (Simplified)
    if (userCabang === 'CIKOKOL') locCabSelect.add(new Option('CIKOKOL (KZ01)', 'KZ01'));
    else if (userCabang === 'BANDUNG') {
        locCabSelect.add(new Option('BANDUNG 1 (BZ01)', 'BZ01'));
        locCabSelect.add(new Option('BANDUNG 2 (NZ01)', 'NZ01'));
    } else if (DATA.branchToUlokMap[userCabang]) {
        locCabSelect.add(new Option(DATA.branchToUlokMap[userCabang], DATA.branchToUlokMap[userCabang], true, true));
        locCabSelect.disabled = true;
    }

    elements.cabangSelect.innerHTML = '';
    const group = DATA.branchGroups[userCabang];
    if (group) {
        group.forEach(b => elements.cabangSelect.add(new Option(b, b)));
        elements.cabangSelect.value = userCabang;
    } else {
        elements.cabangSelect.add(new Option(userCabang, userCabang, true, true));
        elements.cabangSelect.disabled = true;
    }

    // Status Check
    try {
        const res = await fetch(`${CONFIG.API_BASE_URL}/api/check_status?email=${encodeURIComponent(sessionStorage.getItem('loggedInUserEmail'))}&cabang=${encodeURIComponent(userCabang)}`);
        const status = await res.json();
        if (status.rejected_submissions?.length > 0) {
            state.rejectedSubmissionsList = status.rejected_submissions;
            Utils.showMessage("Ditemukan pengajuan ditolak. Cek Ulok.", 'warn');
        }
    } catch (e) { console.error("Status check failed", e); }

    // Session Timer
    setInterval(() => {
        const h = new Date().getHours();
        if (h < CONFIG.SESSION.START || h >= CONFIG.SESSION.END) {
            sessionStorage.clear();
            alert("Sesi habis.");
            window.location.href = "/login.html";
        }
    }, 300000);
}

document.addEventListener("DOMContentLoaded", initializePage);