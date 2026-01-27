/**
 * SPARTA RAB Frontend Script
 * refactor: modularize codebase, optimize state management, and enforce clean code.
 */

// ==========================================
// 1. CONFIGURATION & CONSTANTS
// ==========================================
const CONFIG = {
    API_URL: "https://sparta-backend-5hdj.onrender.com",
    // API_URL: "https://building-alfamart.onrender.com", // Fallback/Dev
    AUTH_REDIRECT: '../../auth/index.html',
    SIPIL_CATEGORIES: [
        "PEKERJAAN PERSIAPAN", "PEKERJAAN BOBOKAN / BONGKARAN", "PEKERJAAN TANAH",
        "PEKERJAAN PONDASI & BETON", "PEKERJAAN PASANGAN", "PEKERJAAN BESI",
        "PEKERJAAN KERAMIK", "PEKERJAAN PLUMBING", "PEKERJAAN SANITARY & ACECORIES",
        "PEKERJAAN JANITOR", "PEKERJAAN ATAP", "PEKERJAAN KUSEN, PINTU & KACA",
        "PEKERJAAN FINISHING", "PEKERJAAN BEANSPOT", "PEKERJAAN AREA TERBUKA",
        "PEKERJAAN TAMBAHAN", "PEKERJAAN SBO"
    ],
    ME_CATEGORIES: [
        "INSTALASI", "FIXTURE", "PEKERJAAN TAMBAHAN", "PEKERJAAN SBO"
    ],
    BRANCH_GROUPS: {
        "BANDUNG 1": ["BANDUNG 1", "BANDUNG 2"],
        "BANDUNG 2": ["BANDUNG 1", "BANDUNG 2"],
        "LOMBOK": ["LOMBOK", "SUMBAWA"],
        "SUMBAWA": ["LOMBOK", "SUMBAWA"],
        "MEDAN": ["MEDAN", "ACEH"],
        "ACEH": ["MEDAN", "ACEH"],
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
    BRANCH_TO_ULOK: {
        "LUWU": "2VZ1", "KARAWANG": "1JZ1", "REMBANG": "2AZ1", "BANJARMASIN": "1GZ1",
        "PARUNG": "1MZ1", "TEGAL": "2PZ1", "GORONTALO": "2SZ1", "PONTIANAK": "1PZ1",
        "LOMBOK": "1SZ1", "KOTABUMI": "1VZ1", "SERANG": "2GZ1", "CIANJUR": "2JZ1",
        "BALARAJA": "TZ01", "SIDOARJO": "UZ01", "MEDAN": "WZ01", "BOGOR": "XZ01",
        "JEMBER": "YZ01", "BALI": "QZ01", "PALEMBANG": "PZ01", "KLATEN": "OZ01",
        "MAKASSAR": "RZ01", "PLUMBON": "VZ01", "PEKANBARU": "1AZ1", "JAMBI": "1DZ1",
        "HEAD OFFICE": "Z001", "BANDUNG 1": "BZ01", "BANDUNG 2": "NZ01", "BEKASI": "CZ01",
        "CILACAP": "IZ01", "CILEUNGSI": "JZ01", "SEMARANG": "HZ01", "CIKOKOL": "KZ01",
        "LAMPUNG": "LZ01", "MALANG": "MZ01", "MANADO": "1YZ1", "BATAM": "2DZ1",
        "MADIUN": "2MZ1"
    }
};

// ==========================================
// 2. STATE MANAGEMENT
// ==========================================
const State = {
    categorizedPrices: {},
    pendingStoreCodes: [],
    approvedStoreCodes: [],
    rejectedSubmissionsList: [],
    originalFormData: null
};

// ==========================================
// 3. UTILITIES & FORMATTERS
// ==========================================
const Formatter = {
    toRupiah: (number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(number),
    
    parseRupiah: (formattedString) => parseFloat(String(formattedString).replace(/Rp\s?|\./g, "").replace(/,/g, ".")) || 0,
    
    formatNumber: (num) => (num === null || isNaN(num)) ? '0' : new Intl.NumberFormat('id-ID').format(num),
    
    parseNumber: (str) => typeof str !== 'string' ? (Number(str) || 0) : (parseFloat(String(str).replace(/\./g, '').replace(/,/g, '.')) || 0),
    
    handleCurrencyInput: (event) => {
        const input = event.target;
        let numericValue = input.value.replace(/[^0-9]/g, '');
        if (numericValue === '') {
            input.value = '';
            Calculator.calculateRowTotal(input);
            return;
        }
        const number = parseInt(numericValue, 10);
        input.value = Formatter.formatNumber(number);
        Calculator.calculateRowTotal(input);
    }
};

// ==========================================
// 4. CALCULATION ENGINE
// ==========================================
const Calculator = {
    calculateLuasTerbangunan: () => {
        const luasBangunan = parseFloat(document.getElementById("luas_bangunan")?.value);
        const luasAreaTerbuka = parseFloat(document.getElementById("luas_area_terbuka")?.value);

        if (isNaN(luasBangunan) && isNaN(luasAreaTerbuka)) {
            document.getElementById("luas_terbangunan").value = "";
            return;
        }

        const lb = isNaN(luasBangunan) ? 0 : luasBangunan;
        const lat = isNaN(luasAreaTerbuka) ? 0 : luasAreaTerbuka;
        const hasil = lb + (lat / 2);

        if (hasil < 0) {
            document.getElementById("luas_terbangunan").value = "";
            UI.showMessage("Luas Terbangunan tidak boleh bernilai minus.", "error");
            return;
        }
        document.getElementById("luas_terbangunan").value = hasil.toFixed(2);
    },

    calculateRowTotal: (inputElement) => {
        const row = inputElement.closest("tr");
        if (!row) return;

        const volume = parseFloat(row.querySelector("input.volume").value) || 0;
        const material = Formatter.parseNumber(row.querySelector("input.harga-material").value);
        const upah = Formatter.parseNumber(row.querySelector("input.harga-upah").value);

        const totalMaterial = volume * material;
        const totalUpah = volume * upah;

        row.querySelector("input.total-material").value = Formatter.toRupiah(totalMaterial);
        row.querySelector("input.total-upah").value = Formatter.toRupiah(totalUpah);
        row.querySelector("input.total-harga").value = Formatter.toRupiah(totalMaterial + totalUpah);

        Calculator.calculateSectionSubTotal(row.closest(".boq-table-body"));
        Calculator.calculateGrandTotal();
    },

    calculateSectionSubTotal: (tbodyElement) => {
        let subTotal = 0;
        tbodyElement.querySelectorAll(".boq-item-row .total-harga").forEach(input => {
            subTotal += Formatter.parseRupiah(input.value);
        });
        const subTotalEl = tbodyElement.closest("table").querySelector(".sub-total-amount");
        if (subTotalEl) subTotalEl.textContent = Formatter.toRupiah(subTotal);
    },

    calculateGrandTotal: () => {
        let total = 0;
        document.querySelectorAll(".boq-table-body:not(.hidden) .total-harga").forEach(input => {
            total += Formatter.parseRupiah(input.value);
        });

        const elements = {
            grand: document.getElementById("grand-total-amount"),
            rounding: document.getElementById("pembulatan-amount"),
            ppn: document.getElementById("ppn-amount"),
            final: document.getElementById("final-total-amount")
        };

        if (elements.grand) elements.grand.textContent = Formatter.toRupiah(total);

        // Round down to nearest 10,000
        const pembulatan = Math.floor(total / 10000) * 10000;
        const ppn = pembulatan * 0.11;
        const finalTotal = pembulatan + ppn;

        if (elements.rounding) elements.rounding.textContent = Formatter.toRupiah(pembulatan);
        if (elements.ppn) elements.ppn.textContent = Formatter.toRupiah(ppn);
        if (elements.final) elements.final.textContent = Formatter.toRupiah(finalTotal);
    }
};

// ==========================================
// 5. TABLE & DOM MANAGER
// ==========================================
const TableManager = {
    initSelect2: (selector) => {
        $(selector).select2({ width: '100%' });
    },

    populateJobsForNewRow: (rowElement) => {
        const category = rowElement.dataset.category;
        const scope = rowElement.dataset.scope;
        const selectEl = rowElement.querySelector(".jenis-pekerjaan");
        if (!selectEl) return;

        const dataSource = (scope === "Sipil") ? State.categorizedPrices.categorizedSipilPrices :
                           (scope === "ME") ? State.categorizedPrices.categorizedMePrices : {};
        const itemsInCategory = dataSource ? (dataSource[category] || []) : [];

        // Get currently selected values to prevent duplicates
        const selectedValues = Array.from(
            document.querySelectorAll(`.boq-table-body[data-category="${category}"] .jenis-pekerjaan`)
        ).map(sel => sel.value).filter(v => v !== "");

        selectEl.innerHTML = '<option value="">-- Pilih Jenis Pekerjaan --</option>';

        if (itemsInCategory.length > 0) {
            itemsInCategory.forEach(item => {
                const option = document.createElement("option");
                option.value = item["Jenis Pekerjaan"];
                option.textContent = item["Jenis Pekerjaan"];
                option.title = item["Jenis Pekerjaan"];
                if (selectedValues.includes(item["Jenis Pekerjaan"])) {
                    option.disabled = true;
                }
                selectEl.appendChild(option);
            });
        } else {
            selectEl.innerHTML = '<option value="">-- Tidak ada item --</option>';
        }
    },

    refreshJobOptions: (category) => {
        const selectedValues = Array.from(
            document.querySelectorAll(`.boq-table-body[data-category="${category}"] .jenis-pekerjaan`)
        ).map(sel => sel.value).filter(v => v !== "");

        document.querySelectorAll(`.boq-table-body[data-category="${category}"] .jenis-pekerjaan`)
            .forEach(select => {
                const currentValue = select.value;
                Array.from(select.options).forEach(opt => {
                    if (opt.value === "") return;
                    const isSelectedElsewhere = selectedValues.includes(opt.value);
                    opt.disabled = (opt.value !== currentValue && isSelectedElsewhere);
                });
            });
    },

    handleJobSelection: (selectElement) => {
        const row = selectElement.closest("tr");
        if (!row) return;

        const selectedJob = selectElement.value;
        const category = row.dataset.category;
        const currentScope = document.getElementById("lingkup_pekerjaan").value;

        // UI Helpers
        const inputs = {
            vol: row.querySelector(".volume"),
            mat: row.querySelector(".harga-material"),
            upah: row.querySelector(".harga-upah"),
            satuan: row.querySelector(".satuan")
        };

        // Reset Styles
        Object.values(inputs).forEach(el => el.classList.remove('auto-filled', 'kondisional-input'));
        
        selectElement.title = selectElement.selectedIndex > 0 ? selectElement.options[selectElement.selectedIndex].text : '';

        if (!selectedJob) {
            inputs.vol.value = "0.00"; inputs.vol.readOnly = false;
            inputs.mat.value = "0"; inputs.mat.readOnly = true;
            inputs.upah.value = "0"; inputs.upah.readOnly = true;
            inputs.satuan.value = "";
            Calculator.calculateRowTotal(selectElement);
            return;
        }

        inputs.mat.removeEventListener('input', Formatter.handleCurrencyInput);
        inputs.upah.removeEventListener('input', Formatter.handleCurrencyInput);

        const dataSource = (currentScope === "Sipil") ? State.categorizedPrices.categorizedSipilPrices : State.categorizedPrices.categorizedMePrices;
        const itemData = dataSource?.[category]?.find(item => item["Jenis Pekerjaan"] === selectedJob);

        if (itemData) {
            inputs.satuan.value = itemData["Satuan"];
            inputs.satuan.classList.add('auto-filled');

            if (itemData["Satuan"] === "Ls") {
                inputs.vol.value = "1.00";
                inputs.vol.readOnly = true;
                inputs.vol.classList.add('auto-filled');
            } else {
                inputs.vol.value = "0.00";
                inputs.vol.readOnly = false;
            }

            const isMatCond = itemData["Harga Material"] === "Kondisional";
            const isUpahCond = itemData["Harga Upah"] === "Kondisional";

            // Material Logic
            if (isMatCond) {
                inputs.mat.value = "0";
                inputs.mat.readOnly = true;
                inputs.mat.classList.add("auto-filled");
            } else {
                inputs.mat.value = Formatter.formatNumber(itemData["Harga Material"]);
                inputs.mat.readOnly = true;
                inputs.mat.classList.add("auto-filled");
            }

            // Upah Logic
            if (isMatCond || isUpahCond) {
                inputs.upah.value = "0";
                inputs.upah.readOnly = false;
                inputs.upah.classList.add("kondisional-input");
                inputs.upah.addEventListener("input", Formatter.handleCurrencyInput);
                inputs.upah.focus();
            } else {
                inputs.upah.value = Formatter.formatNumber(itemData["Harga Upah"]);
                inputs.upah.readOnly = true;
                inputs.upah.classList.add("auto-filled");
            }
        }
        Calculator.calculateRowTotal(selectElement);
    },

    createRow: (category, scope) => {
        const row = document.createElement("tr");
        row.classList.add("boq-item-row");
        row.dataset.scope = scope;
        row.dataset.category = category;
        
        row.innerHTML = `
            <td class="col-no"><span class="row-number"></span></td>
            <td class="col-jenis-pekerjaan"><select class="jenis-pekerjaan form-control" required><option value="">-- Pilih --</option></select></td>
            <td class="col-satuan"><input type="text" class="satuan form-control auto-filled" readonly required/></td>
            <td class="col-volume"><input type="text" class="volume form-control" value="0.00" inputmode="decimal" /></td>
            <td class="col-harga"><input type="text" class="harga-material form-control auto-filled" readonly required/></td>
            <td class="col-harga"><input type="text" class="harga-upah form-control auto-filled" readonly required/></td>
            <td class="col-total"><input type="text" class="total-material form-control auto-filled" disabled /></td>
            <td class="col-total"><input type="text" class="total-upah form-control auto-filled" disabled /></td>
            <td class="col-total-harga"><input type="text" class="total-harga form-control auto-filled" disabled /></td>
            <td class="col-aksi"><button type="button" class="delete-row-btn">Hapus</button></td>
        `;

        // Volume Validation & Calculation
        row.querySelector(".volume").addEventListener("input", (e) => {
            e.target.value = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1').replace(/(\.\d{2})\d+/, '$1');
            Calculator.calculateRowTotal(e.target);
        });

        // Delete Handler
        row.querySelector(".delete-row-btn").addEventListener("click", () => {
            const select = row.querySelector('.jenis-pekerjaan');
            $(select).select2('destroy');
            const cat = row.dataset.category;
            row.remove();
            TableManager.updateIndicesAndTotals();
            TableManager.refreshJobOptions(cat);
        });

        // Select Handler
        const select = row.querySelector('.jenis-pekerjaan');
        $(select).on('change', function (e) {
            TableManager.handleJobSelection(e.target);
            TableManager.refreshJobOptions(row.dataset.category);
        });

        TableManager.initSelect2(select);
        return row;
    },

    updateIndicesAndTotals: () => {
        document.querySelectorAll(".boq-table-body").forEach(tbody => {
            tbody.querySelectorAll(".boq-item-row").forEach((row, index) => {
                row.querySelector(".row-number").textContent = index + 1;
            });
            Calculator.calculateSectionSubTotal(tbody);
        });
        Calculator.calculateGrandTotal();
    },

    buildTables: (scope) => {
        const wrapper = (scope === 'Sipil') ? document.getElementById("sipil-tables-wrapper") : document.getElementById("me-tables-wrapper");
        const categories = (scope === 'Sipil') ? CONFIG.SIPIL_CATEGORIES : CONFIG.ME_CATEGORIES;
        
        wrapper.innerHTML = ''; // Clear existing
        
        categories.forEach(category => {
            const container = document.createElement('div');
            container.innerHTML = `
                <h2 class="text-lg font-semibold mt-6 mb-2 section-title">${category}</h2>
                <div class="table-container" style="display:none;">
                    <table>
                        <colgroup>
                            <col class="col-no"><col class="col-jenis-pekerjaan"><col class="col-satuan">
                            <col class="col-volume"><col class="col-harga"><col class="col-harga">
                            <col class="col-total"><col class="col-total"><col class="col-total-harga"><col class="col-aksi">
                        </colgroup>
                        <thead>
                            <tr>
                                <th rowspan="2">No</th><th rowspan="2">Jenis Pekerjaan</th><th rowspan="2">Satuan</th>
                                <th>Volume</th><th colspan="2">Harga Satuan (Rp)</th><th colspan="2">Total Harga Satuan (Rp)</th>
                                <th>Total Harga (Rp)</th><th rowspan="2">Aksi</th>
                            </tr>
                            <tr>
                                <th>a</th><th>Material (b)</th><th>Upah (c)</th><th>Material (d=a×b)</th>
                                <th>Upah (e=a×c)</th><th>(f=d+e)</th>
                            </tr>
                        </thead>
                        <tbody class="boq-table-body" data-category="${category}" data-scope="${scope}"></tbody>
                        <tfoot>
                            <tr>
                                <td colspan="8" style="text-align: right; font-weight: bold">Sub Total:</td>
                                <td class="sub-total-amount" style="font-weight: bold; text-align: center">Rp 0</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <button type="button" class="add-row-btn" data-category="${category}" data-scope="${scope}">
                    Tambah Item ${category}
                </button>
            `;
            
            // Add Row Listener
            container.querySelector(".add-row-btn").addEventListener("click", async (e) => {
                const btn = e.target;
                const cat = btn.dataset.category;
                const scp = btn.dataset.scope;
                
                // Show table container if hidden
                const tblCont = btn.parentElement.querySelector('.table-container');
                if (tblCont) tblCont.style.display = 'block';

                // Fetch if missing
                const dataSource = scp === "Sipil" ? State.categorizedPrices.categorizedSipilPrices : State.categorizedPrices.categorizedMePrices;
                if (!dataSource || Object.keys(dataSource).length === 0) {
                    await API.fetchPrices();
                }

                const tbody = container.querySelector(`.boq-table-body`);
                if (tbody) {
                    const row = TableManager.createRow(cat, scp);
                    tbody.appendChild(row);
                    TableManager.populateJobsForNewRow(row);
                    TableManager.updateIndicesAndTotals();
                }
            });

            wrapper.appendChild(container);
        });
    }
};

// ==========================================
// 6. UI & FORM LOGIC
// ==========================================
const UI = {
    showMessage: (msg, type = "info") => {
        const el = document.getElementById("message");
        el.innerHTML = msg;
        el.style.display = 'block';
        el.style.backgroundColor = type === "error" ? "#dc3545" : type === "success" ? "#28a745" : "#007bff";
        if (type === "warning") el.style.backgroundColor = "#ffc107";
    },

    updateUlok: () => {
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
    },

    checkRejectedData: () => {
        const fullUlok = document.getElementById('lokasi').value.replace(/-/g, '');
        const scope = document.getElementById('lingkup_pekerjaan').value;

        if ((fullUlok.length !== 12 && fullUlok.length !== 13) || !scope) return;

        const rejected = State.rejectedSubmissionsList.find(item => {
            const itemUlok = item['Nomor Ulok'].replace(/-/g, '');
            const itemScope = item['Lingkup_Pekerjaan'] || item['Lingkup Pekerjaan'];
            return itemUlok === fullUlok && itemScope === scope;
        });

        if (rejected) {
            if (confirm(`Ditemukan data REVISI untuk Ulok ${rejected['Nomor Ulok']} (${scope}). Muat data?`)) {
                FormManager.populate(rejected);
                UI.showMessage(`Memuat data revisi untuk ${scope}.`, "warning");
            }
        }
    },

    setupRenovasiToggle: () => {
        const toggle = document.getElementById('toggle_renovasi');
        const manual = document.getElementById('lokasi_manual');
        const sep = document.getElementById('separator_renov');
        const suf = document.getElementById('suffix_renov');

        toggle.addEventListener('change', () => {
            const isRenov = toggle.checked;
            sep.style.display = isRenov ? 'inline' : 'none';
            suf.style.display = isRenov ? 'block' : 'none';
            manual.placeholder = isRenov ? "C0B4" : "0001";
            if (!isRenov) manual.value = manual.value.replace(/[^0-9]/g, '');
            UI.updateUlok();
        });

        manual.addEventListener('input', function() {
            this.value = toggle.checked 
                ? this.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
                : this.value.replace(/[^0-9]/g, '');
            UI.updateUlok();
            UI.checkRejectedData();
        });
    }
};

// ==========================================
// 7. FORM DATA MANAGER
// ==========================================
const FormManager = {
    getCurrentData: () => {
        const formData = new FormData(document.getElementById("form"));
        const data = Object.fromEntries(formData.entries());
        
        let idx = 1;
        document.querySelectorAll(".boq-table-body:not(.hidden) .boq-item-row").forEach(row => {
            const job = row.querySelector('.jenis-pekerjaan').value;
            const vol = parseFloat(row.querySelector('.volume').value) || 0;
            if (job && vol > 0) {
                data[`Kategori_Pekerjaan_${idx}`] = row.dataset.category;
                data[`Jenis_Pekerjaan_${idx}`] = job;
                data[`Satuan_Item_${idx}`] = row.querySelector('.satuan').value;
                data[`Volume_Item_${idx}`] = vol;
                data[`Harga_Material_Item_${idx}`] = Formatter.parseNumber(row.querySelector('.harga-material').value);
                data[`Harga_Upah_Item_${idx}`] = Formatter.parseNumber(row.querySelector('.harga-upah').value);
                idx++;
            }
        });
        return JSON.stringify(data);
    },

    populate: async (data) => {
        const form = document.getElementById("form");
        form.reset();
        
        // Populate specific fields
        if (data["Nomor Ulok"]) {
            const clean = data["Nomor Ulok"].replace(/-/g, "");
            const isRenov = clean.endsWith("R");
            const match = isRenov ? clean.match(/^(.{4})(.{4})(.{4})R$/) : clean.match(/^(.{4})(.{4})(.{4})$/);
            
            if (match) {
                document.getElementById("lokasi_cabang").value = match[1];
                document.getElementById("lokasi_tanggal").value = match[2];
                document.getElementById("lokasi_manual").value = match[3];
                const toggle = document.getElementById("toggle_renovasi");
                toggle.checked = isRenov;
                toggle.dispatchEvent(new Event('change'));
            }
        }

        const toko = data["nama_toko"] || data["Nama_Toko"];
        if (toko) document.getElementById("nama_toko").value = toko;

        // Populate standard inputs
        for (const key in data) {
            const input = form.querySelector(`[name="${key}"]`);
            if (input && key !== "Nomor Ulok") input.value = data[key];
        }

        // Handle Table
        const scopeSelect = document.getElementById("lingkup_pekerjaan");
        const scope = scopeSelect.value;
        document.getElementById("sipil-tables-wrapper").classList.toggle("hidden", scope !== "Sipil");
        document.getElementById("me-tables-wrapper").classList.toggle("hidden", scope !== "ME");

        await API.fetchPrices(); // Ensure prices are loaded

        const details = data["Item_Details_JSON"] ? JSON.parse(data["Item_Details_JSON"]) : data;
        
        for (let i = 1; i <= 200; i++) {
            if (!details[`Jenis_Pekerjaan_${i}`]) continue;
            
            const cat = details[`Kategori_Pekerjaan_${i}`];
            const tbody = document.querySelector(`.boq-table-body[data-category="${cat}"][data-scope="${scope}"]`);
            
            if (tbody) {
                tbody.closest(".table-container").style.display = "block";
                const row = TableManager.createRow(cat, scope);
                tbody.appendChild(row);
                TableManager.populateJobsForNewRow(row);

                // Fill Values
                const jobSelect = row.querySelector(".jenis-pekerjaan");
                jobSelect.value = details[`Jenis_Pekerjaan_${i}`];
                TableManager.handleJobSelection(jobSelect); // Trigger auto-fill logic

                row.querySelector(".volume").value = details[`Volume_Item_${i}`] || "0.00";
                
                // Override prices if allowed (Kondisional logic handled by handleJobSelection, but we override here for history)
                const matIn = row.querySelector(".harga-material");
                const upahIn = row.querySelector(".harga-upah");
                if (!matIn.readOnly) matIn.value = Formatter.formatNumber(details[`Harga_Material_Item_${i}`]);
                if (!upahIn.readOnly) upahIn.value = Formatter.formatNumber(details[`Harga_Upah_Item_${i}`]);

                Calculator.calculateRowTotal(row.querySelector(".volume"));
            }
        }
        TableManager.updateIndicesAndTotals();
        State.originalFormData = FormManager.getCurrentData();
    }
};

// ==========================================
// 8. API HANDLER
// ==========================================
const API = {
    fetchPrices: async () => {
        const cabang = document.getElementById("cabang").value;
        const lingkup = document.getElementById("lingkup_pekerjaan").value;

        if (!cabang || !lingkup) return;

        UI.showMessage(`Memuat data harga untuk Cabang ${cabang} - ${lingkup}...`);
        
        try {
            const res = await fetch(`${CONFIG.API_URL}/get-data?cabang=${cabang}&lingkup=${lingkup}`);
            if (!res.ok) throw new Error("Gagal mengambil data");
            const data = await res.json();

            // Rebuild skeleton tables
            TableManager.buildTables(lingkup);

            if (lingkup === 'Sipil') State.categorizedPrices.categorizedSipilPrices = data;
            else State.categorizedPrices.categorizedMePrices = data;

            UI.showMessage(""); // Clear message
            document.getElementById("message").style.display = 'none';
        } catch (err) {
            UI.showMessage(`Error: ${err.message}`, "error");
        }
    },

    checkStatus: async (email, cabang) => {
        try {
            UI.showMessage("Memuat data status...");
            const res = await fetch(`${CONFIG.API_URL}/api/check_status?email=${encodeURIComponent(email)}&cabang=${encodeURIComponent(cabang)}`);
            const result = await res.json();
            
            if (result.active_codes) {
                State.pendingStoreCodes = result.active_codes.pending || [];
                State.approvedStoreCodes = result.active_codes.approved || [];
            }
            
            if (result.rejected_submissions?.length > 0) {
                State.rejectedSubmissionsList = result.rejected_submissions;
                const codes = State.rejectedSubmissionsList.map(i => i['Nomor Ulok']).join(', ');
                UI.showMessage(`Ditemukan pengajuan ditolak: <strong>${codes}</strong>.`, "warning");
            } else {
                document.getElementById("message").style.display = 'none';
            }
        } catch (error) {
            console.error(error);
            UI.showMessage("Gagal memuat status.", "error");
        }
    },

    submit: async () => {
        const form = document.getElementById("form");
        
        // 1. Validasi Input HTML
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        // 2. Cek Perubahan Data
        const currentData = FormManager.getCurrentData();
        if (State.originalFormData && currentData === State.originalFormData) {
            UI.showMessage("Tidak ada perubahan terdeteksi.", "warning");
            return;
        }

        // 3. Validasi Luas Terbangunan
        const lt = parseFloat(document.getElementById("luas_terbangunan")?.value);
        if (!lt || lt <= 0) {
            UI.showMessage("Error: Luas Terbangunan tidak valid.", "error");
            return;
        }

        // --- MULAI PROSES PENGIRIMAN ---
        
        const btn = document.getElementById("submit-button");
        btn.disabled = true;

        // A. TAMPILKAN LOADING SCREEN (STATE 1: MENGIRIM)
        const loadingOverlay = document.getElementById("loading-overlay");
        const loadingTitle = document.getElementById("loading-title");
        const loadingDesc = document.getElementById("loading-desc");

        if (loadingOverlay) {
            // Set teks awal
            loadingTitle.textContent = "Sedang Mengirim Data...";
            loadingDesc.textContent = "Mohon tunggu sebentar.";
            
            // Munculkan overlay
            loadingOverlay.classList.remove("hidden-overlay");
            loadingOverlay.classList.add("active");
        }

        // Persiapan Data
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        data["nama_toko"] = data["Nama_Toko"] || document.getElementById("nama_toko")?.value?.trim() || "";
        data["Cabang"] = document.getElementById("cabang").value;
        data["Email_Pembuat"] = sessionStorage.getItem("loggedInUserEmail");
        data["Grand Total"] = Formatter.parseRupiah(document.getElementById("grand-total-amount").textContent);

        let idx = 1;
        document.querySelectorAll(".boq-table-body:not(.hidden) .boq-item-row").forEach(row => {
            const job = row.querySelector(".jenis-pekerjaan").value;
            const vol = parseFloat(row.querySelector(".volume").value) || 0;
            if (job && vol > 0) {
                data[`Kategori_Pekerjaan_${idx}`] = row.dataset.category;
                data[`Jenis_Pekerjaan_${idx}`] = job;
                data[`Satuan_Item_${idx}`] = row.querySelector(".satuan").value;
                data[`Volume_Item_${idx}`] = vol;
                data[`Harga_Material_Item_${idx}`] = Formatter.parseNumber(row.querySelector(".harga-material").value);
                data[`Harga_Upah_Item_${idx}`] = Formatter.parseNumber(row.querySelector(".harga-upah").value);
                data[`Total_Material_Item_${idx}`] = Formatter.parseRupiah(row.querySelector(".total-material").value);
                data[`Total_Upah_Item_${idx}`] = Formatter.parseRupiah(row.querySelector(".total-upah").value);
                data[`Total_Harga_Item_${idx}`] = Formatter.parseRupiah(row.querySelector(".total-harga").value);
                idx++;
            }
        });

        try {
            const res = await fetch(`${CONFIG.API_URL}/api/submit_rab`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            const result = await res.json();
            
            if (res.ok && result.status === "success") {
                // B. UPDATE LOADING SCREEN
                if (loadingOverlay) {
                    loadingTitle.textContent = "Data Berhasil Disimpan!";
                    loadingDesc.textContent = "Mengarahkan ke Gantt Chart...";
                }

                // AMBIL ULOK DARI DATA YANG DIKIRIM
                const targetUlok = data["Nomor Ulok"]; 
                setTimeout(() => {
                    // Kita kirim parameter ?ulok=... dan ?locked=true
                    window.location.href = `../../gantt/index.html?ulok=${encodeURIComponent(targetUlok)}&locked=true`;
                }, 1500);

            } else {
                throw new Error(result.message || "Server error");
            }

        } catch (err) {
            // C. JIKA ERROR: SEMBUNYIKAN OVERLAY
            if (loadingOverlay) {
                loadingOverlay.classList.remove("active");
                loadingOverlay.classList.add("hidden-overlay");
            }
            
            UI.showMessage(`Error: ${err.message}`, "error");
            btn.disabled = false;
        }
    }
};

// ==========================================
// 9. INITIALIZATION
// ==========================================
async function init() {
    if (!sessionStorage.getItem('loggedInUserCabang')) window.location.replace(CONFIG.AUTH_REDIRECT);

    // Setup measurements
    document.getElementById("luas_bangunan")?.addEventListener("input", Calculator.calculateLuasTerbangunan);
    document.getElementById("luas_area_terbuka")?.addEventListener("input", Calculator.calculateLuasTerbangunan);
    document.getElementById('lokasi_tanggal').addEventListener('input', () => { UI.updateUlok(); UI.checkRejectedData(); });
    document.getElementById('lokasi_cabang').addEventListener('change', () => { UI.updateUlok(); UI.checkRejectedData(); });
    UI.setupRenovasiToggle();

    // Populate Branch Selects
    const userCabang = sessionStorage.getItem('loggedInUserCabang')?.toUpperCase();
    const userEmail = sessionStorage.getItem('loggedInUserEmail');
    const locSelect = document.getElementById('lokasi_cabang');
    const cabSelect = document.getElementById("cabang");

    // Logic for User Cabang Role
    if (userCabang === 'CIKOKOL') {
        const opt = document.createElement('option'); opt.value = "KZ01"; opt.textContent = "CIKOKOL (KZ01)"; locSelect.appendChild(opt);
    } else if (userCabang === 'BANDUNG') {
        [{n:"BANDUNG 1",c:"BZ01"}, {n:"BANDUNG 2",c:"NZ01"}].forEach(b => {
            const opt = document.createElement('option'); opt.value = b.c; opt.textContent = `${b.n} (${b.c})`; locSelect.appendChild(opt);
        });
    } else {
        const ulokCode = CONFIG.BRANCH_TO_ULOK[userCabang];
        if (ulokCode) {
            const opt = document.createElement('option'); opt.value = ulokCode; opt.textContent = ulokCode; locSelect.appendChild(opt);
            locSelect.value = ulokCode;
            locSelect.disabled = true;
        }
    }

    cabSelect.innerHTML = '';
    const group = CONFIG.BRANCH_GROUPS[userCabang];
    if (group) {
        group.forEach(n => {
            const opt = document.createElement('option'); opt.value = n; opt.textContent = n; cabSelect.appendChild(opt);
        });
        cabSelect.value = userCabang;
    } else {
        const opt = document.createElement('option'); opt.value = userCabang; opt.textContent = userCabang; cabSelect.appendChild(opt);
        cabSelect.disabled = true;
    }

    // Status Check
    if (userEmail && userCabang) await API.checkStatus(userEmail, userCabang);

    // Event Listeners for Scope change
    document.getElementById("lingkup_pekerjaan").addEventListener("change", (e) => {
        const val = e.target.value;
        document.getElementById("sipil-tables-wrapper").classList.toggle("hidden", val !== "Sipil");
        document.getElementById("me-tables-wrapper").classList.toggle("hidden", val !== "ME");
        if (document.getElementById("cabang").value && val) API.fetchPrices();
        UI.checkRejectedData();
    });

    document.getElementById("cabang").addEventListener("change", () => {
        if (document.getElementById("lingkup_pekerjaan").value) API.fetchPrices();
    });

    // Submit
    document.getElementById("submit-button").addEventListener("click", (e) => {
        e.preventDefault();
        API.submit();
    });

    // Reset
    document.querySelector("button[type='reset']").addEventListener("click", () => {
        if (confirm("Reset seluruh data form?")) window.location.reload();
    });

    // Session Timer
    setInterval(() => {
        const now = new Date();
        const hr = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: "Asia/Jakarta", hour: '2-digit', hour12: false }).format(now));
        if (hr < 6 || hr >= 18) {
            sessionStorage.clear();
            alert("Sesi berakhir (06:00 - 18:00 WIB).");
            window.location.href = "/";
        }
    }, 300000);
}

document.addEventListener("DOMContentLoaded", init);