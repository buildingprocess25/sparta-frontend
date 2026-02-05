/* ======================== CONSTANTS & UTILS ======================== */
const API_BASE_URL = "https://opnamebnm-mgbe.onrender.com"; 
const INACTIVITY_LIMIT_MS = 60 * 60 * 1000; // 1 Jam

// Format Rupiah
const formatRupiah = (number) => {
    const numericValue = Number(number) || 0;
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(numericValue);
};

// Convert string/number to clean number
const toNumInput = (v) => {
    if (v === null || v === undefined) return 0;
    const s = String(v).trim().replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
};

const toNumID = (v) => {
    if (v === null || v === undefined) return 0;
    const s = String(v).trim();
    const cleaned = s.replace(/[^\d,.-]/g, "");
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
};

/* ======================== STATE MANAGEMENT ======================== */
const AppState = {
    user: null,
    loading: true,
    activeView: 'dashboard',
    selectedStore: null,
    selectedUlok: null,
    selectedLingkup: null,
    opnameItems: [],
    stores: [],
    uloks: [],
    idleTimer: null,
};

/* ======================== AUTH SYSTEM (INTEGRATED) ======================== */
const Auth = {
    init: async () => {
        const savedUser = sessionStorage.getItem("user");
        const mainAuthEmail = sessionStorage.getItem("loggedInUserEmail");
        const mainAuthCabang = sessionStorage.getItem("loggedInUserCabang");

        if (savedUser) {
            try {
                AppState.user = JSON.parse(savedUser);
                Auth.startIdleTimer();
            } catch {
                sessionStorage.removeItem("user");
            }
        } 
        else if (mainAuthEmail && mainAuthCabang) {
            console.log("Mendeteksi sesi Sparta Utama. Mencoba login otomatis ke Opname...");
            try {
                // Mencoba login menggunakan data dari Session Storage (Integrasi)
                const result = await Auth.login(mainAuthEmail, mainAuthCabang);
                if (result.success) {
                    console.log("Auto-login Opname berhasil.");
                } else {
                    console.warn("Auto-login Opname gagal:", result.message);
                }
            } catch (e) {
                console.error("Kesalahan saat auto-login:", e);
            }
        }

        AppState.loading = false;
        Render.app();
    },

    login: async (username, password) => {
        try {
            const now = new Date();
            const wibTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
            const hour = wibTime.getHours();
            
            if (hour < 6 || hour >= 24) {
                const currentTime = wibTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
                throw new Error(`Sesi habis. Login 06.00–24.00 WIB. (Saat ini: ${currentTime})`);
            }

            const res = await fetch(`${API_BASE_URL}/api/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });
            const userData = await res.json();
            if (!res.ok) throw new Error(userData.message || "Login failed");

            AppState.user = userData;
            sessionStorage.setItem("user", JSON.stringify(userData));
            Auth.startIdleTimer();
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    logout: () => {
        AppState.user = null;
        sessionStorage.removeItem("user");
        clearTimeout(AppState.idleTimer);
        AppState.activeView = 'dashboard';
        AppState.selectedStore = null;

        // Redirect ke Dashboard Utama karena tidak ada login page lokal
        window.location.href = "../../dashboard/index.html";
    },

    startIdleTimer: () => {
        clearTimeout(AppState.idleTimer);
        AppState.idleTimer = setTimeout(() => Auth.logout(), INACTIVITY_LIMIT_MS);
        window.onclick = () => { 
            if(AppState.user) { 
                clearTimeout(AppState.idleTimer); 
                AppState.idleTimer = setTimeout(() => Auth.logout(), INACTIVITY_LIMIT_MS); 
            }
        };
    }
};

/* ======================== PDF HELPER FUNCTIONS ======================== */
const COMPANY_NAME = "PT. SUMBER ALFARIA TRIJAYA, Tbk";
const REPORT_TITLE = "BERITA ACARA OPNAME PEKERJAAN";
const LOGO_URL_FALLBACK = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAADwAAAAhwBAMAAABikNZBAAAAGFBMVEVHcEzqHC0DXab";

const toNumberID_PDF = (v) => {
    if (v === null || v === undefined) return 0;
    const s = String(v).trim();
    if (!s) return 0;
    const cleaned = s.replace(/[^\d,.-]/g, "");
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
};

const toNumberVol_PDF = (v) => {
    if (v === null || v === undefined) return 0;
    let s = String(v).trim();
    if (!s) return 0;
    if (s.includes(",") && s.includes(".")) {
        s = s.replace(/\./g, "").replace(",", ".");
    } else if (s.includes(",")) {
        s = s.replace(",", ".");
    }
    const n = Number(s.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
};

const fetchRabData = async (kode_toko, no_ulok, lingkup) => {
    try {
        const url = new URL(`${API_BASE_URL}/api/rab`);
        url.searchParams.set("kode_toko", kode_toko);
        if (no_ulok) url.searchParams.set("no_ulok", no_ulok);
        if (lingkup) url.searchParams.set("lingkup", lingkup);
        const response = await fetch(url.toString());
        if (!response.ok) throw new Error("Gagal mengambil data RAB");
        return await response.json();
    } catch (error) {
        console.error(error);
        return [];
    }
};

const fetchPicList = async ({ noUlok, lingkup, kodeToko }) => {
    try {
        const url = new URL(`${API_BASE_URL}/api/pic-list`);
        url.searchParams.set("no_ulok", noUlok);
        if (lingkup) url.searchParams.set("lingkup", lingkup);
        if (kodeToko) url.searchParams.set("kode_toko", kodeToko);
        const res = await fetch(url.toString());
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json.pic_list) ? json.pic_list : [];
    } catch (e) { return []; }
};

const fetchPicKontraktorData = async (noUlok) => {
    try {
        const res = await fetch(`${API_BASE_URL}/api/pic-kontraktor?no_ulok=${encodeURIComponent(noUlok)}`);
        if (!res.ok) return { pic_username: "N/A", kontraktor_username: "N/A" };
        const json = await res.json();
        return { pic_username: json.pic_username ?? "N/A", kontraktor_username: json.kontraktor_username ?? "N/A" };
    } catch (e) { return { pic_username: "N/A", kontraktor_username: "N/A" }; }
};

const fetchPicKontraktorOpnameData = async (noUlok) => {
    try {
        const res = await fetch(`${API_BASE_URL}/api/pic-kontraktor-opname?no_ulok=${encodeURIComponent(noUlok)}`);
        if (!res.ok) return { pic_username: "N/A", kontraktor_username: "N/A", name: "" };
        const json = await res.json();
        return {
            pic_username: json.pic_username ?? "N/A",
            kontraktor_username: json.kontraktor_username ?? "N/A",
            name: json.name ?? "",
        };
    } catch (e) { return { pic_username: "N/A", kontraktor_username: "N/A", name: "" }; }
};

const toBase64 = async (url) => {
    try {
        if (!url) return null;

        if (url.startsWith("data:image")) {
            return url;
        }

        if (url.startsWith('http') || url.startsWith('https')) {
            const proxyUrl = `${API_BASE_URL}/api/image-proxy?url=${encodeURIComponent(url)}`;
            try {
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error('Proxy failed');
                const blob = await response.blob();
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (e) {
                console.warn("Proxy gagal, mencoba fetch langsung...", e);
                // Fallback fetch biasa di bawah
            }
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

    } catch (error) {
        console.error(`Gagal load gambar: ${url}`, error);
        return null;
    }
};

const groupDataByCategory = (data) => {
    const categories = {};
    data.forEach((item) => {
        const categoryName = (item.kategori_pekerjaan || "LAINNYA").toUpperCase();
        if (!categories[categoryName]) categories[categoryName] = [];
        categories[categoryName].push(item);
    });
    return categories;
};

const wrapText = (doc, text, maxWidth) => {
    const words = text.split(" ");
    const lines = [];
    let currentLine = "";
    for (let word of words) {
        const testLine = currentLine + (currentLine ? " " : "") + word;
        const textWidth = doc.getTextWidth(testLine);
        if (textWidth > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
};

const PDFGenerator = {
    generateFinalOpnamePDF: async (submissions, selectedStore, selectedUlok, selectedLingkup, user) => {
        if (!window.jspdf) { alert("Library PDF belum dimuat."); return; }
        const { jsPDF } = window.jspdf;
        
        console.log("Memulai pembuatan PDF Full Version...");
        const doc = new jsPDF();
        const currentDate = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 14;

        // --- PRELOAD LOGO ---
        let logoData = null;
        try { logoData = await toBase64(LOGO_URL_FALLBACK); } catch(e) {}

        // --- HELPER: Print Header (HANYA HALAMAN 1) ---
        const printHeader = () => {
            let currentY = 12;
            const logoW = 48; const logoH = 20;

            // 1. Logo Tengah
            if (logoData) {
                doc.addImage(logoData, "PNG", (pageWidth - logoW) / 2, currentY, logoW, logoH);
            }
            currentY += logoH + 6;

            // 2. Identitas Perusahaan
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(9).setFont("helvetica", "bold");
            doc.text(COMPANY_NAME, margin, currentY); 
            
            // Info Departemen
            currentY += 5;
            doc.setFont("helvetica", "normal");
            doc.text("BUILDING & MAINTENANCE DEPT", margin, currentY); 

            // Info Cabang
            const cabangTxt = selectedStore.cabang || selectedStore.nama_cabang || selectedStore.kota || "";
            if (cabangTxt) {
                currentY += 5;
                doc.text(`CABANG: ${cabangTxt}`, margin, currentY);
            }

            // Garis Pembatas Header
            currentY += 6;
            doc.setDrawColor(0); 
            doc.setLineWidth(0.5);
            doc.line(margin, currentY, pageWidth - margin, currentY);
            
            return currentY + 8; // Kembalikan posisi Y terakhir
        };

        // --- HELPER: Footer (Nomor Halaman) ---
        const addFooter = (pageNum) => {
            doc.setFontSize(8);
            doc.setTextColor(128, 128, 128);
            doc.text(
                `Halaman ${pageNum} - Dicetak pada: ${new Date().toLocaleString("id-ID")}`,
                pageWidth / 2,
                pageHeight - 10,
                { align: "center" }
            );
            doc.setTextColor(0, 0, 0);
        };

        // --- HELPER: Print Summary Box ---
        const printSummaryBox = (label, totalReal, startY) => {
            const totalPembulatan = Math.floor(totalReal / 10000) * 10000;
            const ppn = totalPembulatan * 0.11;
            const grandTotal = totalPembulatan + ppn;

            doc.autoTable({
                body: [
                    [label, formatRupiah(totalReal)],
                    ["PEMBULATAN", formatRupiah(totalPembulatan)],
                    ["PPN 11%", formatRupiah(ppn)],
                    [`GRAND TOTAL ${label.replace("TOTAL ", "")}`, formatRupiah(grandTotal)]
                ],
                startY: startY,
                margin: { left: pageWidth - 95, right: 14 },
                tableWidth: 85,
                theme: "grid",
                styles: { fontSize: 9, halign: "right", cellPadding: 3 },
                columnStyles: { 0: { fontStyle: "bold", cellWidth: 35, halign: "left" } },
                didParseCell: (data) => {
                    if (data.row.index === 3) {
                        data.cell.styles.fillColor = [144, 238, 144]; // Hijau
                        data.cell.styles.fontStyle = "bold";
                    }
                }
            });
            
            return { finalY: doc.lastAutoTable.finalY + 15, grandTotal: grandTotal };
        };

        const lingkupFix = (selectedLingkup || "").toUpperCase();
        
        // --- FETCH DATA ---
        const rabData = await fetchRabData(selectedStore.kode_toko, selectedUlok, lingkupFix);
        const picKontraktorData = await fetchPicKontraktorData(selectedUlok);
        const fromOpname = await fetchPicKontraktorOpnameData(selectedUlok);
        
        // Fallback data nama PIC/Kontraktor
        if (fromOpname?.name && String(fromOpname.name).trim()) picKontraktorData.name = String(fromOpname.name).trim();
        if (!picKontraktorData.pic_username || picKontraktorData.pic_username === "N/A") {
            if (fromOpname?.pic_username) picKontraktorData.pic_username = String(fromOpname.pic_username).trim();
        }
        if (!picKontraktorData.kontraktor_username || picKontraktorData.kontraktor_username === "N/A") {
            if (fromOpname?.kontraktor_username) picKontraktorData.kontraktor_username = String(fromOpname.kontraktor_username).trim();
        }

        const picList = await fetchPicList({ noUlok: selectedUlok, lingkup: lingkupFix, kodeToko: selectedStore.kode_toko });

        // ==========================================
        // HALAMAN 1: HEADER & INFO
        // ==========================================
        
        // 1. Cetak Header (Hanya di Halaman 1)
        let lastY = printHeader();

        // 2. Judul Laporan
        doc.setFont("helvetica", "bold").setFontSize(14);
        doc.text(REPORT_TITLE, pageWidth / 2, lastY + 5, { align: "center" });
        lastY += 15;

        // 3. Info Proyek
        doc.setFont("helvetica", "normal").setFontSize(10);
        const dataOpname = submissions && submissions.length > 0 ? submissions[0] : {};
        const finalNamaToko = dataOpname.nama_toko || selectedStore.nama_toko || "-";
        const finalAlamat = dataOpname.alamat || selectedStore.alamat || "-";
        const picLine = picList && picList.length > 0 ? picList.join(", ") : (picKontraktorData.name || picKontraktorData.pic_username || "N/A");

        doc.text(`NOMOR ULOK : ${selectedUlok || "-"}`, margin, lastY); lastY += 6;
        doc.text(`LINGKUP PEKERJAAN : ${lingkupFix}`, margin, lastY); lastY += 6;
        doc.text(`NAMA TOKO : ${finalNamaToko}`, margin, lastY); lastY += 6;
        doc.text(`ALAMAT : ${finalAlamat}`, margin, lastY); lastY += 6;
        doc.text(`TANGGAL OPNAME : ${currentDate}`, margin, lastY); lastY += 6;
        doc.text(`NAMA PIC : ${picLine}`, margin, lastY); lastY += 6;
        doc.text(`NAMA KONTRAKTOR : ${picKontraktorData.kontraktor_username || "N/A"}`, margin, lastY); 
        lastY += 12;

        // --- DATA PREPARATION ---
        const rabPure = rabData.filter(item => !item.is_il);
        const rabIL = rabData.filter(item => item.is_il);
        
        let totalRealRAB = 0;
        let grandTotalRAB = 0;
        
        let totalRealIL = 0;
        let grandTotalIL = 0;

        // ==========================================
        // SECTION 1: RAB FINAL (Murni)
        // ==========================================
        doc.setFontSize(12).setFont("helvetica", "bold");
        doc.text("RAB FINAL", margin, lastY);
        doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.3);
        doc.line(margin, lastY + 2, pageWidth - margin, lastY + 2);
        lastY += 10;

        const rabCategories = groupDataByCategory(rabPure);
        let categoryNumber = 1;

        if (rabPure.length === 0) {
            doc.setFontSize(10).setFont("helvetica", "italic");
            doc.text("Tidak ada data RAB awal.", margin, lastY);
            lastY += 10;
        } else {
            for (const categoryName of Object.keys(rabCategories)) {
                // Cek Page Break
                if (lastY + 40 > pageHeight - 20) { 
                    addFooter(doc.getNumberOfPages()); 
                    doc.addPage(); 
                    lastY = margin + 10; // Halaman baru tanpa Header Logo
                }
                
                doc.setFontSize(11).setFont("helvetica", "bold");
                doc.text(`${categoryNumber}. ${categoryName}`, margin, lastY);
                lastY += 10;
                categoryNumber++;

                let catMaterialTotal = 0;
                let catUpahTotal = 0;

                const categoryTableBody = rabCategories[categoryName].map((item, idx) => {
                    const volume = toNumberVol_PDF(item.volume);
                    const hargaMaterial = toNumberID_PDF(item.harga_material);
                    const hargaUpah = toNumberID_PDF(item.harga_upah);
                    const totalHarga = volume * (hargaMaterial + hargaUpah);

                    catMaterialTotal += (volume * hargaMaterial);
                    catUpahTotal += (volume * hargaUpah);
                    totalRealRAB += totalHarga;

                    return [
                        idx + 1, item.jenis_pekerjaan, item.satuan, volume.toFixed(2),
                        formatRupiah(hargaMaterial), formatRupiah(hargaUpah),
                        formatRupiah(volume * hargaMaterial), formatRupiah(volume * hargaUpah),
                        formatRupiah(totalHarga)
                    ];
                });

                categoryTableBody.push(["", "", "", "", "", "SUB TOTAL", formatRupiah(catMaterialTotal), formatRupiah(catUpahTotal), formatRupiah(catMaterialTotal + catUpahTotal)]);

                doc.autoTable({
                    head: [
                        ["NO.", "JENIS PEKERJAAN", "SATUAN", "VOLUME", { content: "HARGA SATUAN (Rp)", colSpan: 2, styles: { halign: "center" } }, { content: "TOTAL HARGA (Rp)", colSpan: 3, styles: { halign: "center" } }],
                        ["", "", "", "", "Material", "Upah", "Material", "Upah", "TOTAL HARGA (Rp)"]
                    ],
                    body: categoryTableBody,
                    startY: lastY,
                    margin: { left: margin, right: margin },
                    theme: "grid",
                    styles: { fontSize: 8, cellPadding: 2, lineWidth: 0.1 },
                    headStyles: { fillColor: [205, 234, 242], textColor: [0, 0, 0], fontSize: 8, fontStyle: "bold", halign: "center" },
                    columnStyles: { 0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 40 }, 8: { fontStyle: "bold", halign: "right" } },
                    didParseCell: (data) => {
                        if(data.section === 'body') {
                            if (data.row.index === data.table.body.length - 1) {
                                data.cell.styles.fillColor = [242, 242, 242];
                                if(data.column.index >= 5) data.cell.styles.fontStyle = 'bold';
                            }
                        }
                        if(data.column.index > 2) data.cell.styles.halign = 'right';
                    }
                });
                lastY = doc.lastAutoTable.finalY + 10;
            }
        }

        // Summary RAB
        if (lastY + 40 > pageHeight - 20) { 
            addFooter(doc.getNumberOfPages()); 
            doc.addPage(); 
            lastY = margin + 10; 
        }
        const summaryRAB = printSummaryBox("TOTAL RAB", totalRealRAB, lastY);
        lastY = summaryRAB.finalY;
        grandTotalRAB = summaryRAB.grandTotal;

        // ==========================================
        // SECTION 2: INSTRUKSI LAPANGAN (IL)
        // ==========================================
        if (rabIL.length > 0) {
            addFooter(doc.getNumberOfPages()); 
            doc.addPage(); 
            lastY = margin + 10; // Halaman Baru, tanpa Logo
            
            doc.setFontSize(12).setFont("helvetica", "bold");
            doc.text("INSTRUKSI LAPANGAN (IL)", margin, lastY);
            doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.3);
            doc.line(margin, lastY + 2, pageWidth - margin, lastY + 2);
            lastY += 10;

            const ilCategories = groupDataByCategory(rabIL);
            let ilCatNumber = 1;

            for (const categoryName of Object.keys(ilCategories)) {
                if (lastY + 40 > pageHeight - 20) { 
                    addFooter(doc.getNumberOfPages()); 
                    doc.addPage(); 
                    lastY = margin + 10;
                }
                
                doc.setFontSize(11).setFont("helvetica", "bold");
                doc.text(`${ilCatNumber}. ${categoryName}`, margin, lastY);
                lastY += 10;
                ilCatNumber++;

                let catMaterialTotal = 0;
                let catUpahTotal = 0;

                const categoryTableBody = ilCategories[categoryName].map((item, idx) => {
                    const volume = toNumberVol_PDF(item.volume);
                    const hargaMaterial = toNumberID_PDF(item.harga_material);
                    const hargaUpah = toNumberID_PDF(item.harga_upah);
                    const totalHarga = volume * (hargaMaterial + hargaUpah);

                    catMaterialTotal += (volume * hargaMaterial);
                    catUpahTotal += (volume * hargaUpah);
                    totalRealIL += totalHarga;

                    return [
                        idx + 1, item.jenis_pekerjaan, item.satuan, volume.toFixed(2),
                        formatRupiah(hargaMaterial), formatRupiah(hargaUpah),
                        formatRupiah(volume * hargaMaterial), formatRupiah(volume * hargaUpah),
                        formatRupiah(totalHarga)
                    ];
                });

                categoryTableBody.push(["", "", "", "", "", "SUB TOTAL", formatRupiah(catMaterialTotal), formatRupiah(catUpahTotal), formatRupiah(catMaterialTotal + catUpahTotal)]);

                doc.autoTable({
                    head: [
                        ["NO.", "JENIS PEKERJAAN", "SATUAN", "VOLUME", { content: "HARGA SATUAN (Rp)", colSpan: 2, styles: { halign: "center" } }, { content: "TOTAL HARGA (Rp)", colSpan: 3, styles: { halign: "center" } }],
                        ["", "", "", "", "Material", "Upah", "Material", "Upah", "TOTAL HARGA (Rp)"]
                    ],
                    body: categoryTableBody,
                    startY: lastY,
                    margin: { left: margin, right: margin },
                    theme: "grid",
                    styles: { fontSize: 8, cellPadding: 2, lineWidth: 0.1 },
                    headStyles: { fillColor: [255, 245, 157], textColor: [0, 0, 0], fontSize: 8, fontStyle: "bold", halign: "center" },
                    columnStyles: { 0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 40 }, 8: { fontStyle: "bold", halign: "right" } },
                    didParseCell: (data) => {
                        if(data.section === 'body') {
                            if (data.row.index === data.table.body.length - 1) {
                                data.cell.styles.fillColor = [255, 249, 196];
                                if(data.column.index >= 5) data.cell.styles.fontStyle = 'bold';
                            }
                        }
                        if(data.column.index > 2) data.cell.styles.halign = 'right';
                    }
                });
                lastY = doc.lastAutoTable.finalY + 10;
            }

            if (lastY + 40 > pageHeight - 20) { 
                addFooter(doc.getNumberOfPages()); 
                doc.addPage(); 
                lastY = margin + 10;
            }
            const summaryIL = printSummaryBox("TOTAL IL", totalRealIL, lastY);
            lastY = summaryIL.finalY;
            grandTotalIL = summaryIL.grandTotal;
        }

        // ==========================================
        // SECTION 3: TAMBAH / KURANG
        // ==========================================
        if (submissions && submissions.length > 0) {
            const groupsByType = { "PEKERJAAN TAMBAH": [], "PEKERJAAN KURANG": [] };
            submissions.forEach(it => {
                const sel = toNumberVol_PDF(it.selisih);
                if (sel !== 0) {
                    const type = sel < 0 ? "PEKERJAAN KURANG" : "PEKERJAAN TAMBAH";
                    groupsByType[type].push(it);
                }
            });

            for (const [sectionName, itemsArr] of Object.entries(groupsByType)) {
                if (itemsArr.length === 0) continue;

                addFooter(doc.getNumberOfPages()); 
                doc.addPage(); 
                lastY = margin + 10; // Halaman Baru, tanpa Logo

                doc.setFontSize(12).setFont("helvetica", "bold");
                doc.text(sectionName, margin, lastY);
                doc.setDrawColor(180, 180, 180); doc.line(margin, lastY+2, pageWidth-margin, lastY+2);
                lastY += 10;

                const catGroups = groupDataByCategory(itemsArr);
                let kIdx = 1;

                for (const [kategori, kItems] of Object.entries(catGroups)) {
                    if (lastY + 20 > pageHeight - 20) { 
                        addFooter(doc.getNumberOfPages()); 
                        doc.addPage(); 
                        lastY = margin + 10;
                    }
                    
                    doc.setFontSize(11).setFont("helvetica", "bold");
                    doc.text(`${kIdx}. ${kategori}`, margin, lastY);
                    lastY += 10; kIdx++;

                    const rows = kItems.map((item, idx) => {
                        const sel = toNumberVol_PDF(item.selisih);
                        const hMat = toNumberID_PDF(item.harga_material);
                        const hUpah = toNumberID_PDF(item.harga_upah);
                        const deltaNominal = sel * (hMat + hUpah);
                        const namaPekerjaan = item.jenis_pekerjaan + (item.is_il ? " (IL)" : "");

                        return [
                            idx + 1, namaPekerjaan, item.vol_rab, item.satuan,
                            item.volume_akhir, `${item.selisih} ${item.satuan}`, formatRupiah(deltaNominal)
                        ];
                    });

                    doc.autoTable({
                        head: [["NO.", "JENIS PEKERJAAN", "VOL RAB", "SATUAN", "VOLUME AKHIR", "SELISIH", "NILAI SELISIH (Rp)"]],
                        body: rows,
                        startY: lastY,
                        margin: { left: margin, right: margin },
                        theme: "grid",
                        styles: { fontSize: 8, cellPadding: 3, lineWidth: 0.1 },
                        headStyles: { fillColor: [205, 234, 242], textColor: [0,0,0], fontSize: 8.5, fontStyle: "bold", halign: "center" },
                        columnStyles: { 6: { halign: "right", fontStyle: "bold" }, 2: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
                        didParseCell: (data) => {
                            if(data.section === 'body') {
                                const originalItem = kItems[data.row.index];
                                if (originalItem && originalItem.is_il) {
                                    data.cell.styles.fillColor = [255, 249, 196]; 
                                }
                            }
                        }
                    });
                    lastY = doc.lastAutoTable.finalY + 10;
                }

                const totalRealBlock = itemsArr.reduce((sum, item) => {
                    return sum + (toNumberVol_PDF(item.selisih) * (toNumberID_PDF(item.harga_material) + toNumberID_PDF(item.harga_upah)));
                }, 0);
                
                if (lastY + 40 > pageHeight - 20) { 
                    addFooter(doc.getNumberOfPages()); 
                    doc.addPage(); 
                    lastY = margin + 10;
                }
                const summaryBlock = printSummaryBox("TOTAL " + sectionName, totalRealBlock, lastY);
                lastY = summaryBlock.finalY;
            }
        }

        // ==========================================
        // SECTION 4: STATUS PEKERJAAN
        // ==========================================
        addFooter(doc.getNumberOfPages()); 
        doc.addPage(); 
        lastY = margin + 10; // Halaman Baru, tanpa Logo

        let totalTambah = 0; let totalKurang = 0;
        submissions.forEach(item => {
            const sel = toNumberVol_PDF(item.selisih);
            const unit = toNumberID_PDF(item.harga_material) + toNumberID_PDF(item.harga_upah);
            const delta = sel * unit;
            if (delta > 0) totalTambah += delta;
            else if (delta < 0) totalKurang += delta;
        });

        const totalTambahBulat = Math.floor(totalTambah / 10000) * 10000;
        const totalKurangBulat = Math.ceil(totalKurang / 10000) * 10000;
        const ppnTambah = totalTambahBulat * 0.11;
        const ppnKurang = totalKurangBulat * 0.11;
        const totalTambahPPN = totalTambahBulat + ppnTambah;
        const totalKurangPPN = totalKurangBulat + ppnKurang;
        
        const totalSetelahPPNRAB = grandTotalRAB + grandTotalIL;
        const deltaPPN = totalTambahPPN + totalKurangPPN;
        const totalSetelahPPNOpname = totalSetelahPPNRAB + deltaPPN;

        doc.setFontSize(12).setFont("helvetica", "bold");
        doc.text("STATUS PEKERJAAN", margin, lastY);
        doc.line(margin, lastY+2, pageWidth-margin, lastY+2);
        lastY += 10;

        const deltaNominal = totalSetelahPPNOpname - totalSetelahPPNRAB;
        let statusText = "Sesuai Target";
        if (deltaNominal > 0) statusText = "Pekerjaan Tambah";
        if (deltaNominal < 0) statusText = "Pekerjaan Kurang";

        const statusTableBody = [
            [{ content: `STATUS: ${statusText}`, colSpan: 2, styles: { fillColor: [245, 245, 245], fontStyle: "bold", fontSize: 12 } }],
            ["Total Awal (RAB + IL) incl. PPN", formatRupiah(totalSetelahPPNRAB)],
            ["Pekerjaan Tambah (incl. PPN)", formatRupiah(totalTambahPPN)],
            ["Pekerjaan Kurang (incl. PPN)", formatRupiah(totalKurangPPN)],
            ["Selisih Pekerjaan Tambah dan Kurang", `${deltaNominal >= 0 ? "+" : ""}${formatRupiah(deltaNominal)}`],
            ["Opname Final (incl. PPN)", formatRupiah(totalSetelahPPNOpname)]
        ];

        doc.autoTable({
            body: statusTableBody,
            startY: lastY,
            margin: { left: margin, right: margin },
            theme: "grid",
            styles: { fontSize: 11, halign: "left", cellPadding: 4 },
            columnStyles: { 1: { halign: "right", cellWidth: 80 } },
            didParseCell: (data) => {
                if (data.row.index === statusTableBody.length - 1) {
                    data.cell.styles.fillColor = [144, 238, 144];
                    data.cell.styles.fontStyle = "bold";
                }
            }
        });
        lastY = doc.lastAutoTable.finalY + 15;

        // ==========================================
        // SECTION 5: LAMPIRAN FOTO
        // ==========================================
        const itemsWithPhotos = (submissions || []).filter(item => item.foto_url);
        if (itemsWithPhotos.length > 0) {
            addFooter(doc.getNumberOfPages()); 
            doc.addPage(); 
            let pageNum = doc.getNumberOfPages();
            
            // Header Foto (Tanpa Logo, hanya Judul)
            let photoY = margin + 10;

            doc.setFontSize(12).setFont("helvetica", "bold");
            doc.text("LAMPIRAN FOTO BUKTI", pageWidth / 2, photoY + 5, { align: "center" });
            doc.line(margin, photoY + 8, pageWidth - margin, photoY + 8);
            
            photoY += 15; 
            let columnIndex = 0;
            const columnWidth = (pageWidth - margin * 3) / 2;
            const leftColumnX = margin;
            const rightColumnX = margin + columnWidth + margin;

            const base64Photos = await Promise.all(itemsWithPhotos.map(it => toBase64(it.foto_url)));
            
            itemsWithPhotos.forEach((item, index) => {
                const imgData = base64Photos[index];
                if (imgData) {
                    const imgProps = doc.getImageProperties(imgData);
                    const maxWidth = columnWidth - 10;
                    const maxHeight = 80;
                    let imgWidth = maxWidth;
                    let imgHeight = (imgProps.height * imgWidth) / imgProps.width;
                    if (imgHeight > maxHeight) {
                        imgHeight = maxHeight;
                        imgWidth = (imgProps.width * imgHeight) / imgProps.height;
                    }

                    if (photoY + imgHeight + 35 > pageHeight - 20) {
                        addFooter(pageNum); 
                        doc.addPage(); 
                        pageNum++;
                        photoY = margin + 10 + 5; // Reset Y ke atas halaman baru
                        columnIndex = 0;
                    }

                    const currentX = columnIndex === 0 ? leftColumnX : rightColumnX;
                    
                    doc.setFontSize(9).setFont("helvetica", "bold");
                    const judulFoto = `${index+1}. ${item.jenis_pekerjaan}` + (item.is_il ? " (IL)" : "");
                    const titleLines = wrapText(doc, judulFoto, maxWidth);
                    let titleY = photoY;
                    titleLines.forEach(line => { doc.text(line, currentX, titleY); titleY += 5; });

                    const imageStartY = photoY + (titleLines.length * 5) + 2;
                    doc.setDrawColor(200); doc.rect(currentX, imageStartY, imgWidth + 4, imgHeight + 4);
                    doc.addImage(imgData, currentX + 2, imageStartY + 2, imgWidth, imgHeight);

                    if (columnIndex === 0) {
                        columnIndex = 1;
                    } else {
                        columnIndex = 0;
                        photoY = imageStartY + imgHeight + 25;
                    }
                }
            });
            addFooter(pageNum);
        } else {
            addFooter(doc.getNumberOfPages());
        }

        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i < totalPages; i++) {
            doc.setPage(i);
        }

        doc.save(`BA_Opname_${selectedStore.kode_toko}_${selectedUlok}.pdf`);
        console.log("PDF selesai dibuat.");
    }
};

/* ======================== RENDERER (VIEW CONTROLLER) ======================== */
const Render = {
    app: () => {
        const app = document.getElementById('app');
        app.innerHTML = '';

        if (AppState.loading) {
            app.innerHTML = `
                <div class="loading-screen">
                    <div class="spinner"></div>
                    <h2 style="color: var(--primary);">Memuat Data...</h2>
                </div>`;
            return;
        }

        if (!AppState.user) {
            // Karena tidak ada form login lokal, redirect ke dashboard utama
            alert("Sesi Anda telah berakhir atau belum login. Silakan login kembali melalui Dashboard Utama.");
            window.location.href = "../../auth/index.html"; 
            return;
        }

        app.appendChild(Render.header());
        app.appendChild(Render.userInfo());

        const contentDiv = document.createElement('div');
        contentDiv.id = 'main-content';
        app.appendChild(contentDiv);

        switch (AppState.activeView) {
            case 'dashboard': Render.dashboard(contentDiv); break;
            case 'store-selection-pic': Render.storeSelection(contentDiv, 'opname'); break;
            case 'opname': Render.opnameForm(contentDiv); break;
            case 'final-opname-selection': Render.storeSelection(contentDiv, 'final-opname'); break;
            case 'final-opname-detail': Render.finalOpnameView(contentDiv); break;
            case 'store-selection-kontraktor': Render.storeSelection(contentDiv, 'approval'); break;
            case 'approval-detail': Render.approvalDetail(contentDiv, "Halaman Approval"); break;
            case 'history-selection-kontraktor': Render.storeSelection(contentDiv, 'history'); break;
            case 'history-detail-kontraktor': Render.finalOpnameView(contentDiv); break;
            default: Render.dashboard(contentDiv);
        }
    },

    header: () => {
        const header = document.createElement('header');
        header.className = 'app-header';
        
        header.innerHTML = `
            <img src="../../assets/Alfamart-Emblem.png" alt="Alfamart" class="header-logo" onerror="this.style.display='none'; this.parentElement.insertAdjacentHTML('afterbegin', '<b style=\\'position:absolute;left:20px;color:white\\'>ALFAMART</b>')">
            <div style="text-align:center;">
                <h1>Opname</h1>
            </div>
            <button class="header-logout" id="btn-logout">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
                <span>Dashboard</span>
            </button>
        `;
        header.querySelector('#btn-logout').onclick = () => Auth.logout();
        return header;
    },

    userInfo: () => {
        const wrapper = document.createElement('div');
        wrapper.className = 'user-greeting-wrapper';
        const roleDisplay = AppState.user.role === 'pic' ? 'PIC' : 'Kontraktor';
        wrapper.innerHTML = `
            <div class="user-info">
                Semangat Pagi, ${AppState.user.username} | ${roleDisplay}
            </div>
        `;
        return wrapper;
    },

    // Render.login DIHAPUS karena sudah terintegrasi

    dashboard: (container) => {
        const role = AppState.user.role;
        let buttons = '';

        if (role === 'pic') {
            buttons = `
                <button onclick="AppState.activeView='store-selection-pic'; Render.app()" class="btn btn-primary d-flex flex-column align-center justify-center" style="height:140px; font-size:1.1rem; gap:12px;">
                    <span style="font-size:36px">📝</span> 
                    <span>Input Opname Harian</span>
                </button>
                <button onclick="AppState.activeView='final-opname-selection'; Render.app()" class="btn btn-success d-flex flex-column align-center justify-center" style="height:140px; font-size:1.1rem; gap:12px;">
                    <span style="font-size:36px">✅</span> 
                    <span>Lihat Opname Final</span>
                </button>
            `;
        } else if (role === 'kontraktor') {
            buttons = `
                <button onclick="AppState.activeView='store-selection-kontraktor'; Render.app()" class="btn btn-info d-flex flex-column align-center justify-center" style="height:140px; font-size:1.1rem; gap:12px;">
                    <span style="font-size:36px">🔔</span> 
                    <span>Persetujuan Opname</span>
                </button>
                <button onclick="AppState.activeView='history-selection-kontraktor'; Render.app()" class="btn btn-secondary d-flex flex-column align-center justify-center" style="height:140px; font-size:1.1rem; gap:12px;">
                    <span style="font-size:36px">📂</span> 
                    <span>Histori Opname</span>
                </button>
            `;
        }

        container.innerHTML = `
            <div class="container" style="padding-top:40px;">
                <div class="card text-center" style="max-width:800px; margin:0 auto;">
                    <h2 style="color:var(--primary); margin-bottom:10px;">Selamat Datang, ${AppState.user.kontraktor_username || AppState.user.name || AppState.user.username}!</h2>
                    <p style="color:var(--text-muted); margin-bottom:30px;">Silakan pilih menu di bawah ini untuk memulai.</p>
                    
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;">
                        ${buttons}
                    </div>
                </div>
            </div>
        `;
    },

    storeSelection: async (container, type) => {
        container.innerHTML = `
            <div class="container text-center" style="padding-top:40px;">
                <div class="card">
                    <h3>Memuat Data Pekerjaan...</h3>
                    <div style="margin-top:10px; font-size:0.9rem; color:#666;">Sinkronisasi data Toko & RAB...</div>
                </div>
            </div>`;

        let url = "";
        const u = AppState.user;
        
        if ((type === 'opname' || type === 'final-opname') && u.role === 'pic') {
            url = `${API_BASE_URL}/api/toko?username=${u.username}`;
        } else if (u.role === 'kontraktor') {
            url = `${API_BASE_URL}/api/toko_kontraktor?username=${u.username}`;
        }

        try {
            const res = await fetch(url);
            const stores = await res.json();
            
            if (!Array.isArray(stores)) throw new Error("Gagal mengambil data toko.");

            const combinedList = [];

            stores.forEach(store => {
                if (store.no_uloks && Array.isArray(store.no_uloks) && store.no_uloks.length > 0) {
                    store.no_uloks.forEach(ulokNo => {
                        combinedList.push({
                            store: store,
                            ulok: ulokNo
                        });
                    });
                }
            });

            combinedList.sort((a, b) => {
                const nameCompare = a.store.nama_toko.localeCompare(b.store.nama_toko);
                if (nameCompare !== 0) return nameCompare;
                return a.ulok.localeCompare(b.ulok);
            });

            const renderList = (filter = "") => {
                const f = filter.toLowerCase();
                const filtered = combinedList.filter(item => 
                    item.store.nama_toko.toLowerCase().includes(f) || 
                    item.store.kode_toko.toLowerCase().includes(f) ||
                    item.ulok.toLowerCase().includes(f)
                );

                let html = `
                    <div class="container" style="padding-top:20px;">
                        <div class="card">
                            <div class="d-flex align-center gap-2" style="margin-bottom:24px; border-bottom:1px solid #eee; padding-bottom:16px;">
                                <button id="btn-back-store" class="btn btn-back">← Dashboard</button>
                                <div>
                                    <h2 style="color:var(--primary); margin:0;">Pilih Pekerjaan</h2>
                                    <span style="font-size:0.9rem; color:#666;">Daftar Toko & ULOK (Sesuai RAB)</span>
                                </div>
                            </div>
                            
                            <div style="margin-bottom:24px;">
                                <input type="text" id="store-search" class="form-input" placeholder="🔍 Cari Toko atau No. ULOK..." value="${filter}">
                            </div>
                            
                            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:16px;">
                                ${filtered.map((item, idx) => `
                                    <button class="btn btn-secondary job-item" data-idx="${idx}" style="height:auto; min-height:110px; flex-direction:column; align-items:flex-start; text-align:left; padding:16px; border-left:5px solid var(--secondary-yellow); position:relative; overflow:hidden;">
                                        
                                        <div style="font-size:1.1rem; font-weight:700; color:var(--neutral-700); margin-bottom:4px;">
                                            ${item.store.nama_toko}
                                        </div>
                                        
                                        <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:12px;">
                                            Kode: <strong>${item.store.kode_toko}</strong>
                                        </div>

                                        <div class="badge badge-success" style="font-size:0.85rem; padding:6px 10px; background-color:#e0f2fe; color:#0284c7; border:1px solid #bae6fd;">
                                            📄 ULOK: ${item.ulok}
                                        </div>
                                    </button>
                                `).join('')}
                            </div>
                            
                            ${filtered.length === 0 ? `
                                <div class="text-center" style="padding:40px; color:#666;">
                                    <div style="font-size:30px; margin-bottom:10px;">📭</div>
                                    <p>Tidak ada data pekerjaan yang sesuai.</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
                container.innerHTML = html;

                container.querySelector('#btn-back-store').onclick = () => { AppState.activeView = 'dashboard'; Render.app(); };
                
                const searchInput = document.getElementById('store-search');
                searchInput.oninput = (e) => { 
                    renderList(e.target.value); 
                    document.getElementById('store-search').focus(); 
                };

                container.querySelectorAll('.job-item').forEach((btn, index) => {
                    btn.onclick = () => {
                        const selectedItem = filtered[index];
                        AppState.selectedStore = selectedItem.store;
                        AppState.selectedUlok = selectedItem.ulok;
                        AppState.selectedLingkup = null; 

                        if (type === 'opname') AppState.activeView = 'opname';
                        else if (type === 'final-opname') AppState.activeView = 'final-opname-detail';
                        else if (type === 'approval') AppState.activeView = 'approval-detail';
                        else if (type === 'history') AppState.activeView = 'history-detail-kontraktor';
                        
                        Render.app();
                    };
                });
            };

            renderList();

        } catch (e) {
            console.error(e);
            container.innerHTML = `
                <div class="container" style="padding-top:40px;">
                    <div class="alert-error">
                        <h3>Gagal Memuat Data</h3>
                        <p>${e.message}</p>
                        <button class="btn btn-back" onclick="AppState.activeView='dashboard'; Render.app()" style="margin-top:10px;">Dashboard</button>
                    </div>
                </div>`;
        }
    },

    opnameForm: async (container) => {
        if (!AppState.selectedUlok) {
            AppState.activeView = 'store-selection-pic';
            Render.app();
            return;
        }

        if (!AppState.selectedLingkup) {
            container.innerHTML = `
                <div class="container" style="padding-top:40px;">
                    <div class="card text-center" style="max-width:600px; margin:0 auto;">
                        <h2 style="color:var(--primary);">Pilih Lingkup Pekerjaan</h2>
                        <div class="badge badge-success" style="margin:10px auto; display:inline-block;">ULOK: ${AppState.selectedUlok}</div>
                        
                        <div class="d-flex justify-center gap-2" style="margin-top:30px; margin-bottom:30px;">
                            <button class="btn btn-primary" id="btn-sipil" style="min-width:120px;">SIPIL</button>
                            <button class="btn btn-info" id="btn-me" style="min-width:120px;">ME</button>
                        </div>
                        <button class="btn btn-back" id="btn-cancel-lingkup">Kembali ke Daftar Toko</button>
                    </div>
                </div>
            `;
            
            container.querySelector('#btn-sipil').onclick = () => { AppState.selectedLingkup = 'SIPIL'; Render.opnameForm(container); };
            container.querySelector('#btn-me').onclick = () => { AppState.selectedLingkup = 'ME'; Render.opnameForm(container); };
            
            container.querySelector('#btn-cancel-lingkup').onclick = () => { 
                AppState.selectedStore = null;
                AppState.selectedUlok = null;
                AppState.activeView = 'store-selection-pic'; 
                Render.app(); 
            };
            return;
        }

        container.innerHTML = '<div class="loading-screen"><h3>Memuat Data...</h3></div>';
        
        try {
            const base = `${API_BASE_URL}/api/opname?kode_toko=${encodeURIComponent(AppState.selectedStore.kode_toko)}&no_ulok=${encodeURIComponent(AppState.selectedUlok)}&lingkup=${encodeURIComponent(AppState.selectedLingkup)}`;
            const res = await fetch(base);
            let data = await res.json();
            
            AppState.opnameItems = data.map((task, index) => {
                const volRab = toNumInput(task.vol_rab);
                const volAkhirNum = toNumInput(task.volume_akhir);
                const hargaMaterial = toNumID(task.harga_material);
                const hargaUpah = toNumID(task.harga_upah);
                
                const selisihNum = volAkhirNum - volRab;
                const total_harga = selisihNum * (hargaMaterial + hargaUpah);
                
                const alreadySubmitted = task.isSubmitted === true || !!task.item_id || ["PENDING", "APPROVED", "REJECTED"].includes(String(task.approval_status || "").toUpperCase());
                
                return { 
                    ...task, 
                    id: index + 1, 
                    harga_material: hargaMaterial, 
                    harga_upah: hargaUpah, 
                    isSubmitted: alreadySubmitted, 
                    volume_akhir: alreadySubmitted ? String(volAkhirNum) : "", 
                    selisih: (Math.round((selisihNum + Number.EPSILON) * 100) / 100).toFixed(2), 
                    total_harga,
                    catatan: task.catatan || "",
                    approval_status: task.approval_status || (alreadySubmitted ? "Pending" : "")
                };
            });

            

            let isFinalized = false;
            let canFinalize = false;
            let statusMessage = "Menunggu Approval Semua Item";

            // 1. Cek Data Server: Apakah Opname SUDAH Final (Locked)?
            try {
                const checkUrl = `https://sparta-backend-5hdj.onrender.com/api/check_status_item_opname?no_ulok=${AppState.selectedUlok}&lingkup_pekerjaan=${AppState.selectedLingkup}`;
                const statusRes = await fetch(checkUrl);
                const statusData = await statusRes.json();

                if (statusData.tanggal_opname_final) {
                    isFinalized = true;
                    statusMessage = "Opname Selesai (Final)";
                }
            } catch (err) {
                console.warn("Gagal cek status final:", err);
            }

            // 2. [LOGIKA BARU] Validasi Item di Tabel (Termasuk IL)
            // Tombol "Opname Final" hanya aktif jika SEMUA item di tabel statusnya 'APPROVED'
            if (!isFinalized) {
                const allItems = AppState.opnameItems;
                const totalItems = allItems.length;
                const approvedCount = allItems.filter(item => 
                    String(item.approval_status || "").toUpperCase() === "APPROVED"
                ).length;
                if (totalItems > 0 && totalItems === approvedCount) {
                    canFinalize = true;
                    statusMessage = "Opname Final";
                } else {
                    canFinalize = false;
                    statusMessage = `Menunggu Approval (${approvedCount}/${totalItems})`;
                }
            }

            const renderTable = () => {
                const items = AppState.opnameItems;
                
                // Hitung total awal untuk render pertama
                const totalVal = items.reduce((sum, i) => sum + (i.total_harga || 0), 0);
                const ppn = totalVal * 0.11;
                const grandTotal = totalVal * 1.11;

                let btnColor = '#6c757d'; 
                if (isFinalized) btnColor = '#28a745'; 
                else if (canFinalize) btnColor = '#007bff';

                const email = sessionStorage.getItem("loggedInUserEmail") || "";
                const cabang = sessionStorage.getItem("loggedInUserCabang") || "";
                
                // [MODIFIKASI] Logic Link IL dengan Parameter Auto-Fill
                const currentUlok = encodeURIComponent(AppState.selectedUlok || "");
                const currentToko = encodeURIComponent(AppState.selectedStore?.nama_toko || "");
                let ilParams = [`ulok=${currentUlok}`, `toko=${currentToko}`];

                if(email && cabang) {
                    try {
                        const token = btoa(JSON.stringify({ email, cabang }));
                        ilParams.push(`user=${token}`);
                } catch(e) { console.error("Gagal encode user IL", e); }
                }

                let ilLink = `../il/index.html?${ilParams.join('&')}`;

                let html = `
                <div class="container" style="padding-top:20px; padding-left:10px; padding-right:10px; max-width:100%;">
                    <div class="card" style="border-radius:0;">
                        <div class="d-flex align-center gap-2" style="margin-bottom:20px;">
                            <button id="btn-back-main" class="btn btn-back">← Kembali</button>
                            <div>
                                <h2 style="color:var(--primary); margin:0;">Input Opname</h2>
                                <span style="color:#666;">${AppState.selectedStore.nama_toko} (ULOK: ${AppState.selectedUlok})</span>
                            </div>
                        </div>

                        <div class="table-container" style="overflow-x:auto;">
                            <table style="width:100%; min-width:1400px; border-collapse:collapse;">
                                <thead>
                                    <tr style="background:var(--primary); color:white;">
                                        <th style="padding:10px;">Kategori</th><th style="padding:10px;">Jenis Pekerjaan</th>
                                        <th class="text-center">Vol RAB</th><th class="text-center">Sat</th>
                                        <th class="text-right">H. Mat</th><th class="text-right">H. Upah</th>
                                        <th class="text-center">Vol Akhir</th><th class="text-center">Selisih</th>
                                        <th class="text-right">Total</th>
                                        <th class="text-center">Foto</th><th style="padding:10px;">Catatan</th>
                                        <th class="text-center">Status</th><th class="text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${items.map(item => {
                                        let rowBg = '';
                                        if (item.is_il) rowBg = '#fff9c4'; 
                                        else if (item.isSubmitted) rowBg = '#f0fff0';
                                        
                                        const selisihVal = parseFloat(item.selisih);
                                        let selisihColor = 'black';
                                        if (selisihVal < 0) selisihColor = 'red';
                                        else if (selisihVal > 0) selisihColor = 'green';

                                        return `
                                        <tr style="border-bottom:1px solid #ddd; background:${rowBg}">
                                            <td style="padding:10px;">
                                                ${item.kategori_pekerjaan}
                                                ${item.is_il ? '<br><span class="badge" style="background:#ffeb3b; color:#000; font-size:9px;">Instruksi Lapangan</span>' : ''}
                                            </td>
                                            <td style="padding:10px;">${item.jenis_pekerjaan}</td>
                                            <td class="text-center">${item.vol_rab}</td><td class="text-center">${item.satuan}</td>
                                            <td class="text-right">${formatRupiah(item.harga_material)}</td><td class="text-right">${formatRupiah(item.harga_upah)}</td>
                                            
                                            <td class="text-center">
                                                <input type="number" class="form-input vol-input" data-id="${item.id}" value="${item.volume_akhir}" 
                                                style="width:80px; text-align:center;" ${item.isSubmitted?'disabled':''}>
                                            </td>
                                            
                                            <td class="text-center font-bold" id="selisih-${item.id}" style="color:${selisihColor}">
                                                ${(item.volume_akhir!=='') ? item.selisih : '-'}
                                            </td>
                                            
                                            <td class="text-right font-bold" id="total-${item.id}" style="color:${item.total_harga<0?'red':'black'}">
                                                ${formatRupiah(item.total_harga)}
                                            </td>
                                            
                                            <td class="text-center">
                                                ${item.foto_url ? `<a href="${item.foto_url}" target="_blank">Lihat</a>` : 
                                                (!item.isSubmitted ? `<input type="file" class="file-input" data-id="${item.id}" id="f-${item.id}" hidden><label for="f-${item.id}" class="btn btn-sm btn-outline">Upload</label>`:'-')}
                                            </td>
                                            <td>${item.catatan||'-'}</td>
                                            <td class="text-center"><span class="badge badge-success">${item.approval_status||'-'}</span></td>
                                            <td class="text-center">
                                                ${!item.isSubmitted ? `<button class="btn btn-primary btn-sm save-btn" data-id="${item.id}">Simpan</button>` : 
                                                item.approval_status==='REJECTED' ? `<button class="btn btn-warning btn-sm perbaiki-btn" data-id="${item.id}">Perbaiki</button>` : 'Saved'}
                                            </td>
                                        </tr>
                                    `}).join('')}
                                </tbody>
                            </table>
                        </div>

                        ${!isFinalized ? `
                        <div style="margin-top: 20px; margin-bottom: 0px;">
                            <a href="${ilLink}" class="btn" 
                            style="width: 100%; background-color: #FFC107; font-weight: bold; color: #000; text-decoration: none; display: block; text-align: center; padding: 12px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                Instruksi Lapangan
                            </a>
                        </div>
                        ` : ''}

                        <div style="margin-top:20px; padding:15px; background:#f8f9fa;">
                            <div class="d-flex justify-between"><span>Total :</span> <b id="summary-total" style="color:${totalVal<0?'red':'black'}">${formatRupiah(totalVal)}</b></div>
                            <div class="d-flex justify-between"><span>PPN 11%:</span> <b id="summary-ppn" style="color:${ppn<0?'red':'black'}">${formatRupiah(ppn)}</b></div>
                            <div class="d-flex justify-between" style="font-size:1.2rem; margin-top:10px;"><span>Grand Total:</span> <b id="summary-grand" style="color:${grandTotal<0?'red':'black'}">${formatRupiah(grandTotal)}</b></div>
                        </div>

                        <div style="margin-top: 20px;">
                             <button id="btn-final" class="btn" style="width:100%; padding:14px; font-size:1.1rem; font-weight:bold; 
                                background-color: ${btnColor}; color: white; cursor: ${(!canFinalize || isFinalized) ? 'not-allowed' : 'pointer'};" 
                                ${(!canFinalize || isFinalized) ? 'disabled' : ''}>
                                ${statusMessage}
                            </button>
                            ${!canFinalize && !isFinalized ? '<p style="text-align:center; color:#dc3545; font-size:0.85rem; margin-top:8px;">*Pastikan semua pekerjaan berstatus APPROVED untuk melakukan Opname Final.</p>' : ''}
                        </div>
                    </div>
                </div>`;
                
                container.innerHTML = html;
                
                // --- EVENT LISTENERS ---
                container.querySelector('#btn-back-main').onclick = () => { AppState.selectedLingkup = null; Render.opnameForm(container); };

                // LOGIKA BARU: Update DOM secara langsung tanpa render ulang tabel
                container.querySelectorAll('.vol-input').forEach(input => {
                    input.oninput = (e) => {
                        const id = parseInt(e.target.dataset.id);
                        const item = AppState.opnameItems.find(i => i.id === id);
                        
                        // 1. Update data di memory
                        item.volume_akhir = e.target.value;
                        const vAkhir = toNumInput(item.volume_akhir);
                        const vRab = toNumInput(item.vol_rab);
                        
                        const selisihNum = vAkhir - vRab;
                        item.selisih = selisihNum.toFixed(2);
                        item.total_harga = selisihNum * (item.harga_material + item.harga_upah);

                        // 2. Update Cell Selisih (Tanpa Render Ulang)
                        const selisihEl = document.getElementById(`selisih-${id}`);
                        if (selisihEl) {
                            selisihEl.innerText = item.selisih;
                            selisihEl.style.color = selisihNum < 0 ? 'red' : (selisihNum > 0 ? 'green' : 'black');
                        }

                        // 3. Update Cell Total Baris (Tanpa Render Ulang)
                        const totalEl = document.getElementById(`total-${id}`);
                        if (totalEl) {
                            totalEl.innerText = formatRupiah(item.total_harga);
                            totalEl.style.color = item.total_harga < 0 ? 'red' : 'black';
                        }

                        // 4. Hitung Ulang Summary Bawah
                        const newTotalVal = AppState.opnameItems.reduce((sum, i) => sum + (i.total_harga || 0), 0);
                        const newPpn = newTotalVal * 0.11;
                        const newGrandTotal = newTotalVal * 1.11;

                        // 5. Update DOM Summary Bawah (Tanpa Render Ulang)
                        const elSumTotal = document.getElementById('summary-total');
                        const elSumPpn = document.getElementById('summary-ppn');
                        const elSumGrand = document.getElementById('summary-grand');

                        if (elSumTotal) {
                            elSumTotal.innerText = formatRupiah(newTotalVal);
                            elSumTotal.style.color = newTotalVal < 0 ? 'red' : 'black';
                        }
                        if (elSumPpn) {
                            elSumPpn.innerText = formatRupiah(newPpn);
                            elSumPpn.style.color = newPpn < 0 ? 'red' : 'black';
                        }
                        if (elSumGrand) {
                            elSumGrand.innerText = formatRupiah(newGrandTotal);
                            elSumGrand.style.color = newGrandTotal < 0 ? 'red' : 'black';
                        }
                    }
                });

                container.querySelectorAll('.file-input').forEach(inp => {
                    inp.onchange = async (e) => {
                        const f = e.target.files[0];
                        if(!f) return;
                        const id = parseInt(e.target.dataset.id);
                        const fd = new FormData(); fd.append("file", f);
                        try {
                            const r = await fetch(`${API_BASE_URL}/api/upload`, { method:"POST", body:fd });
                            const d = await r.json();
                            AppState.opnameItems.find(i=>i.id===id).foto_url = d.link;
                            renderTable(); // Untuk upload foto, render ulang tidak masalah karena jarang dilakukan
                        } catch(err) { alert("Upload gagal"); }
                    }
                });

                container.querySelectorAll('.save-btn').forEach(btn => {
                    btn.onclick = async () => {
                        const id = parseInt(btn.dataset.id);
                        const item = AppState.opnameItems.find(i=>i.id===id);
                        if(!item.volume_akhir) { alert("Isi volume akhir!"); return; }
                        btn.innerText="..."; btn.disabled=true;
                        try {
                            const payload = {
                                kode_toko: AppState.selectedStore.kode_toko,
                                nama_toko: AppState.selectedStore.nama_toko,
                                pic_username: AppState.user.username,
                                no_ulok: AppState.selectedUlok,
                                kategori_pekerjaan: item.kategori_pekerjaan,
                                jenis_pekerjaan: item.jenis_pekerjaan,
                                vol_rab: item.vol_rab,
                                satuan: item.satuan,
                                volume_akhir: item.volume_akhir,
                                selisih: item.selisih,
                                foto_url: item.foto_url,
                                harga_material: item.harga_material,
                                harga_upah: item.harga_upah,
                                total_harga_akhir: item.total_harga,
                                lingkup_pekerjaan: AppState.selectedLingkup,
                                is_il: item.is_il
                            };
                            await fetch(`${API_BASE_URL}/api/opname/item/submit`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)});
                            item.isSubmitted=true; item.approval_status="Pending";
                            renderTable();
                        } catch(e) { alert(e.message); btn.disabled=false; btn.innerText="Simpan"; }
                    }
                });

                container.querySelectorAll('.perbaiki-btn').forEach(btn => {
                    btn.onclick = () => {
                        const id = parseInt(btn.dataset.id);
                        const item = AppState.opnameItems.find(i => i.id === id);
                        item.isSubmitted = false;
                        item.approval_status = "Pending";
                        item.volume_akhir = "";
                        item.selisih = "";
                        item.total_harga = 0;
                        renderTable();
                    }
                });

                if(canFinalize && !isFinalized) {
                    const bf = container.querySelector('#btn-final');
                    bf.onclick = async () => {
                        if(!confirm("Yakin finalisasi? Tidak bisa dibatalkan.")) return;
                        bf.innerText="Processing..."; bf.disabled=true;
                        try {
                            const r = await fetch(`https://sparta-backend-5hdj.onrender.com/api/opname_locked`, {
                                method:"POST", headers:{"Content-Type":"application/json"},
                                body:JSON.stringify({ status:"locked", ulok:AppState.selectedUlok, lingkup_pekerjaan:AppState.selectedLingkup })
                            });
                            const d = await r.json();
                            if(r.ok) { alert("Berhasil!"); isFinalized=true; canFinalize=false; Render.opnameForm(container); }
                            else { alert(d.message); bf.disabled=false; bf.innerText="Opname Final"; }
                        } catch(e) { alert(e.message); bf.disabled=false; }
                    }
                }
            };
            renderTable();

        } catch(e) { container.innerHTML=`<div class="alert-error">${e.message}</div>`; }
    },

    finalOpnameView: async (container) => {
        if (!AppState.selectedUlok) {
            if (AppState.user.role === 'pic') AppState.activeView = 'final-opname-selection';
            else AppState.activeView = 'history-selection-kontraktor';
            Render.app();
            return;
        }

        if (!AppState.selectedLingkup) {
            container.innerHTML = `
                <div class="container" style="padding-top:40px;">
                    <div class="card text-center" style="max-width:600px; margin:0 auto;">
                        <h2 style="color:var(--primary);">Pilih Lingkup Laporan</h2>
                        <div class="badge badge-success" style="margin:10px auto; display:inline-block;">ULOK: ${AppState.selectedUlok}</div>
                        
                        <div class="d-flex justify-center gap-2" style="margin-top:30px; margin-bottom:30px;">
                            <button class="btn btn-primary" id="btn-sipil-final" style="min-width:120px;">SIPIL</button>
                            <button class="btn btn-info" id="btn-me-final" style="min-width:120px;">ME</button>
                        </div>
                        <button class="btn btn-back" id="btn-cancel-lingkup-final">Kembali ke Daftar</button>
                    </div>
                </div>
            `;
            container.querySelector('#btn-sipil-final').onclick = () => { AppState.selectedLingkup = 'SIPIL'; Render.finalOpnameView(container); };
            container.querySelector('#btn-me-final').onclick = () => { AppState.selectedLingkup = 'ME'; Render.finalOpnameView(container); };
            
            container.querySelector('#btn-cancel-lingkup-final').onclick = () => { 
                AppState.selectedStore = null;
                AppState.selectedUlok = null;
                if (AppState.user.role === 'pic') {
                    AppState.activeView = 'final-opname-selection';
                } else {
                    AppState.activeView = 'history-selection-kontraktor';
                }
                Render.app();
            };
            return;
        }

        container.innerHTML = '<div class="container text-center" style="padding-top:40px;"><div class="card"><h3>Memuat Data Opname Final...</h3></div></div>';
        
        try {
            const url = `${API_BASE_URL}/api/opname/final?kode_toko=${encodeURIComponent(AppState.selectedStore.kode_toko)}&no_ulok=${encodeURIComponent(AppState.selectedUlok)}&lingkup=${encodeURIComponent(AppState.selectedLingkup)}`;
            
            const res = await fetch(url);
            const rawData = await res.json();
            const submissions = Array.isArray(rawData) ? rawData : [];

            if (submissions.length === 0) {
                 container.innerHTML = `
                    <div class="container" style="padding-top:40px;">
                        <div class="card text-center">
                            <div style="font-size:50px; margin-bottom:20px;">📭</div>
                            <h2 style="color:#666;">Data Tidak Ditemukan</h2>
                            <p>Belum ada data opname <b>FINAL</b> untuk <b>${AppState.selectedLingkup}</b> di ULOK ini.</p>
                            <br>
                            <button class="btn btn-back" id="btn-back-empty">Kembali</button>
                        </div>
                    </div>
                `;
                container.querySelector('#btn-back-empty').onclick = () => { AppState.selectedLingkup = null; Render.finalOpnameView(container); };
                return;
            }

            const items = submissions.map((task, index) => {
                const volAkhirNum = toNumInput(task.volume_akhir);
                const hargaMaterial = toNumID(task.harga_material);
                const hargaUpah = toNumID(task.harga_upah);
                const total_harga = volAkhirNum * (hargaMaterial + hargaUpah);
                
                return { 
                    ...task, 
                    total_harga, 
                    vol_akhir_num: volAkhirNum, 
                    harga_satuan: hargaMaterial + hargaUpah 
                };
            });

            const totalBiaya = items.reduce((sum, i) => sum + i.total_harga, 0);

            const html = `
                <div class="container" style="padding-top:20px;">
                    <div class="card">
                        <div class="d-flex align-center gap-2" style="margin-bottom:20px; border-bottom:2px solid #eee; padding-bottom:15px; flex-wrap:wrap;">
                            <button id="btn-back-final-view" class="btn btn-back">← Kembali</button>
                            <div style="flex:1;">
                                <h2 style="color:var(--primary); margin:0;">Riwayat Opname Final</h2>
                                <span style="font-size:0.9rem; color:#64748b;">
                                    ${AppState.selectedStore.nama_toko} • ULOK: ${AppState.selectedUlok} • ${AppState.selectedLingkup}
                                </span>
                            </div>
                            <button id="btn-download-pdf" class="btn btn-primary">
                                📄 Download PDF
                            </button>
                        </div>

                        <div class="table-container">
                            <table style="width:100%;">
                                <thead>
                                    <tr style="background:#f1f5f9; color:#334155;">
                                        <th style="padding:12px;">Kategori</th>
                                        <th style="padding:12px;">Jenis Pekerjaan</th>
                                        <th class="text-center">Vol Akhir</th>
                                        <th class="text-center">Status</th>
                                        <th class="text-center">Tgl Submit</th>
                                        <th class="text-center">PIC</th>
                                        <th class="text-center">Kontraktor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${items.map((item, idx) => {
                                        // --- LOGIKA BARU: Warna Kuning untuk IL ---
                                        const rowBg = item.is_il ? '#fff9c4' : 'transparent';
                                        
                                        return `
                                        <tr style="border-bottom:1px solid #eee; background-color:${rowBg};">
                                            <td style="padding:12px; font-weight:600; color:#64748b;">
                                                ${item.kategori_pekerjaan}
                                                ${item.is_il ? '<br><span class="badge" style="background:#ffeb3b; color:#000; font-size:9px;">Instruksi Lapangan</span>' : ''}
                                            </td>
                                            <td style="padding:12px;">${item.jenis_pekerjaan}</td>
                                            <td class="text-center font-bold">
                                                ${item.volume_akhir} ${item.satuan}
                                            </td>
                                            <td class="text-center">
                                                <span class="badge badge-success" style="font-size:11px;">${item.approval_status || 'Approved'}</span>
                                            </td>
                                            <td class="text-center" style="font-size:0.9rem;">
                                                ${item.tanggal_submit || '-'}
                                            </td>
                                            <td class="text-center" style="font-size:0.9rem;">
                                                ${item.pic_name || item.pic_username || '-'}
                                            </td>
                                            <td class="text-center" style="font-size:0.9rem;">
                                                ${item.kontraktor_name || item.display_kontraktor || item.kontraktor_username || '-'}
                                            </td>
                                        </tr>
                                    `}).join('')}
                                </tbody>
                            </table>
                        </div>

                        <div style="margin-top:20px; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                            <div class="d-flex justify-between" style="max-width:400px; margin-left:auto;">
                                <span>Total Estimasi:</span> 
                                <strong>${formatRupiah(totalBiaya)}</strong>
                            </div>
                        </div>

                    </div>
                </div>
            `;
            container.innerHTML = html;

            container.querySelector('#btn-back-final-view').onclick = () => { AppState.selectedLingkup = null; Render.finalOpnameView(container); };
            
            container.querySelector('#btn-download-pdf').onclick = () => {
                const btn = document.getElementById('btn-download-pdf');
                btn.innerText = "Memproses PDF...";
                btn.disabled = true;
                setTimeout(() => {
                    PDFGenerator.generateFinalOpnamePDF(items, AppState.selectedStore, AppState.selectedUlok, AppState.selectedLingkup, AppState.user);
                    btn.innerText = "📄 Download PDF";
                    btn.disabled = false;
                }, 500);
            };

        } catch (e) {
            container.innerHTML = `<div class="container"><div class="alert-error">Error memuat data final: ${e.message}</div><button class="btn btn-back" onclick="Render.app()">Kembali</button></div>`;
        }
    },
    
    approvalDetail: async (container) => {
        if (!AppState.selectedUlok) {
            AppState.activeView = 'store-selection-kontraktor';
            Render.app();
            return;
        }

        if (!AppState.selectedLingkup) {
            container.innerHTML = `
                <div class="container" style="padding-top:40px;">
                    <div class="card text-center" style="max-width:600px; margin:0 auto;">
                        <h2 style="color:var(--primary);">Pilih Lingkup Pekerjaan</h2>
                        <div class="badge badge-success" style="margin:10px auto; display:inline-block;">ULOK: ${AppState.selectedUlok}</div>
                        
                        <div class="d-flex justify-center gap-2" style="margin-top:30px; margin-bottom:30px;">
                            <button class="btn btn-primary" id="btn-sipil" style="min-width:120px;">SIPIL</button>
                            <button class="btn btn-info" id="btn-me" style="min-width:120px;">ME</button>
                        </div>
                        <button class="btn btn-back" id="btn-cancel-lingkup">Kembali ke Daftar Approval</button>
                    </div>
                </div>
            `;
            
            container.querySelector('#btn-sipil').onclick = () => { AppState.selectedLingkup = 'SIPIL'; Render.approvalDetail(container); };
            container.querySelector('#btn-me').onclick = () => { AppState.selectedLingkup = 'ME'; Render.approvalDetail(container); };
            
            container.querySelector('#btn-cancel-lingkup').onclick = () => { 
                AppState.selectedStore = null;
                AppState.selectedUlok = null;
                AppState.activeView = 'store-selection-kontraktor'; 
                Render.app(); 
            };
            return;
        }

        container.innerHTML = '<div class="container text-center" style="padding-top:40px;"><div class="card"><h3>Memuat Data Opname Pending...</h3></div></div>';
        
        try {
            const url = `${API_BASE_URL}/api/opname/pending?kode_toko=${AppState.selectedStore.kode_toko}&no_ulok=${AppState.selectedUlok}&lingkup=${AppState.selectedLingkup}`;
            const res = await fetch(url);
            const rawData = await res.json();
            const pendingItems = Array.isArray(rawData) ? rawData : [];
            
            const renderApprovalTable = () => {
                let html = `
                <div class="container" style="padding-top:20px; max-width: 100vw; padding-left: 16px; padding-right: 16px;">
                    <div class="card" style="border-radius:12px; padding:16px;">
                        <div class="d-flex align-center gap-2" style="margin-bottom:24px; flex-wrap:wrap;">
                            <button id="btn-back-lingkup" class="btn btn-back">← Kembali</button>
                            <h2 style="color:var(--primary);">Persetujuan Opname</h2>
                        </div>
                        <p style="margin-bottom:20px; color:#64748b;">
                            <strong>${AppState.selectedStore.nama_toko}</strong> | ULOK: ${AppState.selectedUlok} | Lingkup: ${AppState.selectedLingkup}
                        </p>

                        <div id="approval-message" style="display:none; padding:10px; border-radius:8px; margin-bottom:15px;"></div>

                        <div class="table-container">
                            <table style="width:100%; min-width:1000px;">
                                <thead>
                                    <tr style="background:#f2f2f2;">
                                        <th style="padding:12px;">Kategori</th>
                                        <th style="padding:12px;">Jenis Pekerjaan</th>
                                        <th style="padding:12px; text-align:center;">Volume Akhir</th>
                                        <th style="padding:12px; text-align:center;">Foto</th>
                                        <th style="padding:12px;">PIC</th>
                                        <th style="padding:12px;">Waktu Submit</th>
                                        <th style="padding:12px; min-width:200px;">Catatan</th>
                                        <th style="padding:12px; text-align:center; min-width:180px;">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody id="approval-tbody">
                                    ${pendingItems.length === 0 ? 
                                        '<tr><td colspan="8" class="text-center" style="padding:20px;">Tidak ada opname yang menunggu persetujuan.</td></tr>' : 
                                        pendingItems.map(item => `
                                        <tr id="row-${item.item_id}" style="border-bottom:1px solid #ddd;">
                                            <td>${item.kategori_pekerjaan}</td>
                                            <td>${item.jenis_pekerjaan}</td>
                                            <td class="text-center"><b>${item.volume_akhir}</b> ${item.satuan || ''}</td>
                                            <td class="text-center">
                                                ${item.foto_url ? `<a href="${item.foto_url}" target="_blank" class="btn btn-outline" style="padding:4px 8px; font-size:12px;">Lihat</a>` : '<span style="color:#999;">-</span>'}
                                            </td>
                                            <td>${item.name || '-'}</td>
                                            <td>${item.tanggal_submit || '-'}</td>
                                            <td>
                                                <textarea id="note-${item.item_id}" class="form-input" rows="2" placeholder="Catatan (opsional)..." style="font-size:0.9rem;"></textarea>
                                            </td>
                                            <td class="text-center">
                                                <div class="d-flex justify-center gap-2">
                                                    <button class="btn btn-success btn-approve" data-id="${item.item_id}" data-jenis="${item.jenis_pekerjaan}" style="padding:6px 12px; font-size:0.85rem;">Approve</button>
                                                    <button class="btn btn-primary btn-reject" data-id="${item.item_id}" style="padding:6px 12px; font-size:0.85rem; background-color:#dc3545;">Reject</button>
                                                </div>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>`;
                
                container.innerHTML = html;

                container.querySelector('#btn-back-lingkup').onclick = () => { 
                    AppState.selectedLingkup = null; 
                    Render.approvalDetail(container); 
                };

                const showMsg = (msg, isError = false) => {
                    const el = document.getElementById('approval-message');
                    el.style.display = 'block';
                    el.className = isError ? 'alert-error' : 'badge-success'; 
                    el.style.backgroundColor = isError ? '#ffe5e5' : '#dcfce7';
                    el.style.color = isError ? '#cc0000' : '#166534';
                    el.innerText = msg;
                    setTimeout(() => { el.style.display = 'none'; }, 3000);
                };

                container.querySelectorAll('.btn-approve').forEach(btn => {
                    btn.onclick = async () => {
                        const itemId = btn.dataset.id;
                        const jenisPekerjaan = btn.dataset.jenis;
                        const noteVal = document.getElementById(`note-${itemId}`).value;
                        const row = document.getElementById(`row-${itemId}`);
                        const btnReject = row.querySelector('.btn-reject');

                        btn.disabled = true; btn.innerText = '...'; btnReject.disabled = true;

                        try {
                            const payload1 = {
                                item_id: itemId,
                                kontraktor_username: AppState.user.username || AppState.user.name,
                                catatan: noteVal
                            };

                            const res1 = await fetch(`${API_BASE_URL}/api/opname/approve`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(payload1)
                            });
                            
                            if (!res1.ok) {
                                const errData = await res1.json();
                                throw new Error(errData.message || "Gagal approve item");
                            }

                            await new Promise(r => setTimeout(r, 2000));

                            const payload2 = {
                                no_ulok: AppState.selectedUlok,
                                lingkup_pekerjaan: AppState.selectedLingkup,
                                jenis_pekerjaan: jenisPekerjaan
                            };

                            const res2 = await fetch(`https://sparta-backend-5hdj.onrender.com/api/process_summary_opname`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(payload2)
                            });

                            if (!res2.ok) {
                                const errData2 = await res2.json();
                                console.warn("Warning Summary:", errData2.message);
                            }

                            showMsg("Berhasil di-approve!");
                            row.remove();

                            if(document.querySelectorAll('#approval-tbody tr').length === 0) {
                                document.getElementById('approval-tbody').innerHTML = '<tr><td colspan="8" class="text-center" style="padding:20px;">Semua data telah diproses.</td></tr>';
                            }

                        } catch (e) {
                            showMsg(`Error: ${e.message}`, true);
                            btn.disabled = false; btn.innerText = 'Approve'; btnReject.disabled = false;
                        }
                    };
                });

                container.querySelectorAll('.btn-reject').forEach(btn => {
                    btn.onclick = async () => {
                        const itemId = btn.dataset.id;
                        const noteVal = document.getElementById(`note-${itemId}`).value;
                        const row = document.getElementById(`row-${itemId}`);
                        const btnApprove = row.querySelector('.btn-approve');

                        if(!confirm("Yakin ingin menolak (REJECT) item ini?")) return;

                        btn.disabled = true; btn.innerText = '...'; btnApprove.disabled = true;

                        try {
                            const payload = {
                                item_id: itemId,
                                kontraktor_username: AppState.user.username || AppState.user.name,
                                catatan: noteVal
                            };

                            const res = await fetch(`${API_BASE_URL}/api/opname/reject`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(payload)
                            });

                            if (!res.ok) {
                                const data = await res.json();
                                throw new Error(data.message || "Gagal reject");
                            }

                            showMsg("Berhasil di-reject!");
                            row.remove();

                            if(document.querySelectorAll('#approval-tbody tr').length === 0) {
                                document.getElementById('approval-tbody').innerHTML = '<tr><td colspan="8" class="text-center" style="padding:20px;">Semua data telah diproses.</td></tr>';
                            }

                        } catch (e) {
                            showMsg(`Error: ${e.message}`, true);
                            btn.disabled = false; btn.innerText = 'Reject'; btnApprove.disabled = false;
                        }
                    };
                });
            };

            renderApprovalTable();

        } catch (e) {
            container.innerHTML = `<div class="container"><div class="alert-error">Gagal mengambil data pending: ${e.message}</div><button class="btn btn-back" onclick="AppState.selectedLingkup=null; Render.approvalDetail(document.getElementById('main-content'))">Kembali</button></div>`;
        }
    },
};

/* ======================== INIT ======================== */
window.addEventListener('DOMContentLoaded', () => {
    Auth.init();
});