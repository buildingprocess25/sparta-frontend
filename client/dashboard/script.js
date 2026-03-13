document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 0. LOGIC SIDEBAR TOGGLE
    // ==========================================
    const toggleBtn = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('app-sidebar');

    if (toggleBtn && sidebar) {
        // Tweak UX Mobile: Langsung lipat sidebar jika diakses dari layar HP/Mobile
        if (window.innerWidth <= 768) {
            sidebar.classList.add('collapsed');
        }

        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }

    // ==========================================
    // 1. GLOBAL VARIABLES & AUTH & ROLE
    // ==========================================
    let rawData = []; 
    let filteredData = []; 
    
    const userRole = sessionStorage.getItem('userRole') || ''; 
    const userCabang = sessionStorage.getItem('loggedInUserCabang') || ''; 
    
    // Identifikasi Kontraktor (Mengambil Email dan Nama PT dari Sesi)
    const userEmail = sessionStorage.getItem('loggedInUserEmail') || ''; 
    const userNamaPT = sessionStorage.getItem('loggedInUserName') || ''; 
    
    const isHO = userCabang.toUpperCase() === 'HEAD OFFICE'; 
    const currentRole = userRole.toUpperCase();
    const isContractor = currentRole === 'KONTRAKTOR';

    const BRANCH_GROUPS = {
        "LOMBOK": ["LOMBOK", "SUMBAWA"],
        "MEDAN": ["MEDAN", "ACEH"],
        "LAMPUNG": ["LAMPUNG", "LAMPUNG_KOTABUMI"],
        "PALEMBANG": ["PALEMBANG", "BENGKULU", "BANGKA", "BELITUNG"],
        "SIDOARJO": ["SIDOARJO", "SIDOARJO BPN_SMD", "MANOKWARI", "NTT", "SORONG"]
    };
    const userBranchGroup = BRANCH_GROUPS[userCabang.toUpperCase()] || null;
    
    if (!userRole) {
        alert("Sesi Anda telah habis. Silakan login kembali.");
        window.location.replace('https://sparta-alfamart.vercel.app');
        return;
    }

    // ==========================================
    // 2. RENDER MENU SIDEBAR (Tanpa Asset Gambar)
    // ==========================================
    const MENU_CATALOG = {
        'menu-rab': { href: '../../rab/', title: 'RAB Kontraktor', desc: 'Penawaran Final Kontraktor' },
        'menu-materai': { href: '../../materai/', title: 'Dokumen Termaterai', desc: 'Dokumen Termaterai RAB' },
        'menu-spk': { href: '../../spk/', title: 'SPK', desc: 'Surat Perintah Kerja' },
        'menu-pengawasan': { href: '../../inputpic/', title: 'PIC Pengawasan', desc: 'Input PIC Pekerjaan' },
        'menu-opname': { href: '../../opname/', title: 'Opname', desc: 'Form Opname Pekerjaan' },
        'menu-dokumentasi': { href: '../../ftdokumen/', title: 'Dokumentasi Bangunan', desc: 'Foto Bangunan Toko Baru' },
        'menu-tambahspk': { href: '../../tambahspk/', title: 'Pertambahan SPK', desc: 'Form Pertambahan Hari SPK' },
        'menu-svdokumen': { href: '../../svdokumen/', title: 'Penyimpanan Dokumen', desc: 'Penyimpanan Dokumen Toko' },
        'menu-gantt': { href: '../../gantt/', title: 'Gantt Chart', desc: 'Progress Pekerjaan' },
        'menu-userlog': { href: '../../userlog/', title: 'User Log', desc: 'Pengguna Aplikasi' },
        'menu-resend': { href: '../../resend/', title: 'Resend Email', desc: 'Kirim Ulang Email Persetujuan' },
        'menu-sp': { href: '../../dashboard/', title: 'Surat Peringatan', desc: 'Form Surat Peringatan', onClick: (e) => { e.preventDefault(); alert('Fitur dalam pengembangan.'); } },
    };

    const roleConfig = {
        'BRANCH BUILDING & MAINTENANCE MANAGER': ['menu-spk', 'menu-pengawasan', 'menu-opname', 'menu-tambahspk', 'menu-gantt', 'menu-dokumentasi', 'menu-svdokumen'],
        'BRANCH BUILDING SUPPORT DOKUMENTASI' : ['menu-spk', 'menu-pengawasan', 'menu-opname', 'menu-tambahspk', 'menu-gantt', 'menu-dokumentasi', 'menu-svdokumen'],
        'BRANCH BUILDING COORDINATOR': ['menu-dokumentasi', 'menu-svdokumen','menu-gantt', 'menu-opname'],
        'BRANCH BUILDING SUPPORT': ['menu-dokumentasi', 'menu-opname', 'menu-gantt', 'menu-svdokumen'],
        'KONTRAKTOR': ['menu-rab', 'menu-materai', 'menu-opname', 'menu-gantt']
    };

    let allowedMenuIds = roleConfig[currentRole] ? [...roleConfig[currentRole]] : [];
    if (isHO && !isContractor) allowedMenuIds.push('menu-userlog', 'menu-resend', 'menu-sp');

    if (currentRole === 'BRANCH BUILDING COORDINATOR' && userCabang.toUpperCase() === 'BATAM') {
        const specialBatamMenus = ['menu-spk', 'menu-pengawasan', 'menu-tambahspk'];
        specialBatamMenus.forEach(menuId => {
            if (!allowedMenuIds.includes(menuId)) {
                allowedMenuIds.push(menuId);
            }
        });
    }

    const menuContainer = document.getElementById('menu-container');
    menuContainer.innerHTML = ''; 
    allowedMenuIds.forEach(id => {
        const menuData = MENU_CATALOG[id];
        if (!menuData) return; 
        const linkEl = document.createElement('a');
        linkEl.href = menuData.href;
        linkEl.className = 'menu-item';
        if (menuData.onClick) linkEl.addEventListener('click', menuData.onClick);
        
        linkEl.innerHTML = `
            <div class="menu-text">
                <h3>${menuData.title}</h3>
                <p>${menuData.desc}</p>
            </div>
        `;
        menuContainer.appendChild(linkEl);
    });

    document.getElementById('logout-button-form')?.addEventListener('click', (e) => {
        e.preventDefault(); 
        if(confirm("Apakah Anda yakin ingin keluar?")) {
            sessionStorage.clear(); 
            window.location.replace('https://sparta-alfamart.vercel.app');
        }
    });

    // ==========================================
    // 3. LOGIC MONITORING PANE VIEW
    // ==========================================
    const monitoringSection = document.getElementById('monitoring-section');
    monitoringSection.style.display = 'flex'; 

    // Jika KONTRAKTOR, sembunyikan semua card kecuali Total Proyek
    if (isContractor) {
        document.querySelectorAll('.stat-card').forEach(card => {
            if (card.id !== 'card-total-proyek-wrapper') {
                card.style.display = 'none';
            }
        });
    }

    const projectModal = document.getElementById('projectModal');
    const closeModal = document.getElementById('closeModal');
    
    const totalProyekCard = document.getElementById('card-total-proyek-wrapper');
    const totalPenawaranCard = document.getElementById('card-total-penawaran-wrapper'); 
    const totalSpkCard = document.getElementById('card-total-spk-wrapper'); 
    const totalJhkCard = document.getElementById('card-total-jhk-wrapper');
    const totalDendaCard = document.getElementById('card-total-denda-wrapper');
    const avgCostM2Card = document.getElementById('card-avg-cost-m2-wrapper'); 
    const avgKeterlambatanCard = document.getElementById('card-avg-keterlambatan-wrapper');
    const nilaiTokoCard = document.getElementById('card-nilai-toko-wrapper');
    const nilaiKontraktorCard = document.getElementById('card-nilai-kontraktor-wrapper');
    const avgBeanspotCard = document.getElementById('card-avg-beanspot-wrapper');
    
    const modalMainTitle = document.getElementById('modalMainTitle'); 
    const modalSummaryView = document.getElementById('modalSummaryView');
    const modalListView = document.getElementById('modalListView');
    const modalStoreDetailView = document.getElementById('modalStoreDetailView');
    const storeListContainer = document.getElementById('storeListContainer');
    const storeDetailContainer = document.getElementById('storeDetailContainer');
    const listStatusTitle = document.getElementById('listStatusTitle');
    const detailStoreTitle = document.getElementById('detailStoreTitle'); 
    const btnBackToSummary = document.getElementById('btnBackToSummary');
    const btnBackToList = document.getElementById('btnBackToList'); 
    const grid = document.getElementById('modalStatsGrid');

    let currentGroupedProjects = {}; 
    let currentModalContext = 'PROJECT';
    let currentPenawaranGroups = []; 
    let currentSpkGroups = [];
    let currentCostGroups = [];
    let currentKontraktorGroups = [];
    let currentBeanspotItems = [];
    let currentDendaItems = [];

    // --- FETCH & FILTER LOGIC ---
    async function initDashboardData() {
        const API_URL = "https://sparta-backend-5hdj.onrender.com/api/opname/summary-data";
        if(document.getElementById('card-total-proyek')) document.getElementById('card-total-proyek').textContent = "...";
        
        try {
            const response = await fetch(API_URL);
            const result = await response.json();
            if (result.status === 'success' && Array.isArray(result.data)) {
                rawData = result.data;
                populateFilters(rawData);
                applyFilters(); 
            }
        } catch (error) {
            console.error("Error Fetching:", error);
            if(document.getElementById('card-total-proyek')) document.getElementById('card-total-proyek').textContent = "Err";
        }
    }

    function populateFilters(data) {
        const cabangSelect = document.getElementById('filterCabang');
        const tahunSelect = document.getElementById('filterTahun');

        if (isHO) {
            // HO melihat semua cabang
            cabangSelect.style.display = 'inline-block';
            const uniqueCabang = [...new Set(data.map(item => item.Cabang))].filter(c => c && c.trim() !== "").sort();
            cabangSelect.innerHTML = '<option value="ALL">Semua Cabang</option>';
            uniqueCabang.forEach(cab => { cabangSelect.innerHTML += `<option value="${cab}">${cab}</option>`; });
        } else if (userBranchGroup && !isContractor) {
            // Head Branch melihat anggota grupnya
            cabangSelect.style.display = 'inline-block';
            cabangSelect.innerHTML = '<option value="ALL_GROUP">Semua Cabang (Grup)</option>';
            userBranchGroup.forEach(cab => {
                cabangSelect.innerHTML += `<option value="${cab}">${cab}</option>`;
            });
        } else {
            // Cabang biasa atau Kontraktor tidak bisa melihat filter cabang
            cabangSelect.style.display = 'none';
        }

        const uniqueTahun = [...new Set(data.map(item => getYearFromDate(item["Timestamp"])))].filter(y => y).sort((a, b) => b - a);
        tahunSelect.innerHTML = '<option value="ALL">Semua Tahun</option>';
        uniqueTahun.forEach(thn => { tahunSelect.innerHTML += `<option value="${thn}">${thn}</option>`; });
        tahunSelect.value = 'ALL';
    }

    function applyFilters() {
        const selectedTahun = document.getElementById('filterTahun').value;
        
        filteredData = rawData.filter(item => {
            // 1. Logika Filtering Cabang
            let matchCabang = false;

            if (isHO) {
                const selectedCabang = document.getElementById('filterCabang').value;
                matchCabang = (selectedCabang === 'ALL') || (item.Cabang && item.Cabang.toUpperCase() === selectedCabang.toUpperCase());
            } else if (userBranchGroup && !isContractor) {
                const selectedCabang = document.getElementById('filterCabang').value;
                if (selectedCabang === 'ALL_GROUP') {
                    // Jika pilih semua cabang grup, cek apakah cabang item ada di dalam array grup
                    matchCabang = item.Cabang && userBranchGroup.includes(item.Cabang.toUpperCase());
                } else {
                    matchCabang = item.Cabang && item.Cabang.toUpperCase() === selectedCabang.toUpperCase();
                }
            } else {
                matchCabang = item.Cabang && item.Cabang.toUpperCase() === userCabang.toUpperCase();
            }
            
            // 2. Logika Filtering Tahun
            const itemYear = getYearFromDate(item["Timestamp"]);
            const matchTahun = (selectedTahun === 'ALL') || (itemYear == selectedTahun);
            
            // 3. Logika Filtering Khusus KONTRAKTOR
            let matchKontraktor = true;
            if (isContractor) {
                const vendorName = item.Kontraktor ? item.Kontraktor.toUpperCase().trim() : '';
                const sessionNamaPT = userNamaPT.toUpperCase().trim();
                const sessionEmail = userEmail.toUpperCase().trim();
                
                matchKontraktor = false;
                if (sessionNamaPT && vendorName.includes(sessionNamaPT)) {
                    matchKontraktor = true;
                } else if (sessionEmail && vendorName.includes(sessionEmail)) {
                    matchKontraktor = true;
                } else if (sessionNamaPT && sessionNamaPT.includes(vendorName) && vendorName !== '') {
                    matchKontraktor = true;
                }
            }

            return matchCabang && matchTahun && matchKontraktor;
        });
        
        renderKPI(filteredData);
    }

    document.getElementById('btnApplyFilter')?.addEventListener('click', applyFilters);

    function renderKPI(data) {
        let totalProyek = data.length, totalPenawaran = 0, totalSPK = 0, totalJHK = 0, totalKeterlambatan = 0, totalDenda = 0, totalOpname = 0, totalLuasTerbangun = 0;
        let uniqueUlokLuas = {}, sumNilaiToko = 0, countNilaiToko = 0, countKeterlambatan = 0;
        let sumAvgKontraktor = 0, countKontraktorGroups = 0;
        const groupedKontraktorData = {};
        let sumBeanspot = 0, countBeanspot = 0;
        currentBeanspotItems = [];
        currentDendaItems = [];
        
        let miniStats = { 'Approval RAB': 0, 'Proses PJU': 0, 'Approval SPK': 0, 'Ongoing': 0, 'Proses Kerja Tambah Kurang': 0, 'Done': 0 };
        currentGroupedProjects = { 'Approval RAB': [], 'Proses PJU': [], 'Approval SPK': [], 'Ongoing': [], 'Proses Kerja Tambah Kurang': [], 'Done': [] };

        data.forEach(item => {
            totalPenawaran += parseCurrency(item["Total Penawaran Final"]); 
            totalSPK += parseCurrency(item["Nominal SPK"]);
            
            const nt = parseScore(item["Nilai Toko"]);
            if (nt > 0) { sumNilaiToko += nt; countNilaiToko++; }
            
            const durasiSpk = parseFloat(item["Durasi SPK"]) || 0;
            const tambahSpk = parseFloat(item["tambah_spk"]) || 0;
            const keterlambatan = parseFloat(item["Keterlambatan"]) || 0;
            if (keterlambatan > 0) countKeterlambatan++;
            
            totalJHK += (durasiSpk + tambahSpk + keterlambatan);
            totalKeterlambatan += keterlambatan;
            totalDenda += parseCurrency(item["Denda"]);
            if (parseCurrency(item["Denda"]) > 0) {
                currentDendaItems.push(item);
            }
            totalOpname += parseCurrency(item["Grand Total Opname Final"]);
            
            const ulok = item["Nomor Ulok"] || 'Tanpa Ulok-' + Math.random();
            const luas = parseFloat(item["Luas Terbangunan"]) || 0;
            if (!uniqueUlokLuas[ulok] && luas > 0) { uniqueUlokLuas[ulok] = luas; totalLuasTerbangun += luas; }

            const hasStatusRab = item["Status_Rab"] && String(item["Status_Rab"]).trim() !== "";
            const hasPenawaranFinal = item["Total Penawaran Final"] && String(item["Total Penawaran Final"]).trim() !== "";
            const hasStatus = item["Status"] && String(item["Status"]).trim() !== "";
            const hasSPK = item["Nominal SPK"] && String(item["Nominal SPK"]).trim() !== "";
            const hasSerahTerima = (item["tanggal_serah_terima"] && String(item["tanggal_serah_terima"]).trim() !== "") || (item["Tgl Serah Terima"] && String(item["Tgl Serah Terima"]).trim() !== "");
            const hasOpnameFinal = item["tanggal_opname_final"] && String(item["tanggal_opname_final"]).trim() !== "";

            // Pengelompokan Status Corong Utama
            if (hasOpnameFinal) { miniStats['Done']++; currentGroupedProjects['Done'].push(item); }
            else if (hasSerahTerima && !hasOpnameFinal) { miniStats['Proses Kerja Tambah Kurang']++; currentGroupedProjects['Proses Kerja Tambah Kurang'].push(item); }
            else if (hasSPK && !hasSerahTerima) { miniStats['Ongoing']++; currentGroupedProjects['Ongoing'].push(item); }
            else if (hasStatus && !hasSPK) { miniStats['Approval SPK']++; currentGroupedProjects['Approval SPK'].push(item); }
            else if (hasPenawaranFinal && !hasSPK) { miniStats['Proses PJU']++; currentGroupedProjects['Proses PJU'].push(item); }
            else if (hasStatusRab && !hasPenawaranFinal) { miniStats['Approval RAB']++; currentGroupedProjects['Approval RAB'].push(item); }

            const kontraktor = item["Kontraktor"] && item["Kontraktor"].trim() !== "" ? item["Kontraktor"] : 'Tanpa Kontraktor';
            if (nt > 0) {
                if (!groupedKontraktorData[kontraktor]) groupedKontraktorData[kontraktor] = { total: 0, count: 0 };
                groupedKontraktorData[kontraktor].total += nt;
                groupedKontraktorData[kontraktor].count++;
            }

            const beanspotVal = parseCurrency(item["Pekerjaan Beanspot"]);
            if (beanspotVal > 0) {
                sumBeanspot += beanspotVal;
                countBeanspot++;
                currentBeanspotItems.push(item);
            }
        });

        const avgKeterlambatan = countKeterlambatan > 0 ? Math.round(totalKeterlambatan / countKeterlambatan) : 0;
        const avgCostM2 = totalLuasTerbangun > 0 ? (totalOpname / totalLuasTerbangun) : 0;
        const avgNilaiToko = countNilaiToko > 0 ? (sumNilaiToko / countNilaiToko) : 0;
        const avgJHK = totalProyek > 0 ? Math.round(totalJHK / totalProyek) : 0;

        Object.values(groupedKontraktorData).forEach(g => { sumAvgKontraktor += (g.total / g.count); countKontraktorGroups++; });
        const avgNilaiKontraktor = countKontraktorGroups > 0 ? (sumAvgKontraktor / countKontraktorGroups) : 0;
        const avgBeanspot = countBeanspot > 0 ? (sumBeanspot / countBeanspot) : 0;

        const animDuration = 1500; 

        // RENDER 6 MINI STATS DI DALAM CARD TOTAL PROYEK (Berlaku untuk semua)
        const miniContainer = document.getElementById('mini-project-stats');
        if (miniContainer) {
            miniContainer.innerHTML = Object.entries(miniStats).map(([label, count]) => `
                <div class="mini-stat-item"><span class="mini-stat-label">${label}</span><span class="mini-stat-value">${count}</span></div>
            `).join('');
        }

        animateValue("card-total-proyek", 0, totalProyek, animDuration);
        
        // Render sisa kartu jika BUKAN Kontraktor
        if (!isContractor) {
            if(document.getElementById('card-total-penawaran')) animateValue("card-total-penawaran", 0, totalPenawaran, animDuration, formatRupiah); 
            animateValue("card-total-spk", 0, totalSPK, animDuration, formatRupiah);
            animateValue("card-jhk", 0, avgJHK, animDuration, (val) => val + " Hari");
            animateValue("card-avg-keterlambatan", 0, avgKeterlambatan, animDuration, (val) => val + " Hari");
            animateValue("card-total-denda", 0, totalDenda, animDuration, formatRupiah);
            animateValue("card-avg-cost-m2", 0, avgCostM2, animDuration, formatRupiah);
            if(document.getElementById('card-nilai-toko')) animateValue("card-nilai-toko", 0, avgNilaiToko, animDuration, formatScore, true);
            if(document.getElementById('card-nilai-kontraktor')) animateValue("card-nilai-kontraktor", 0, avgNilaiKontraktor, animDuration, formatScore, true);
            if(document.getElementById('card-avg-beanspot')) animateValue("card-avg-beanspot", 0, avgBeanspot, animDuration, formatRupiah);
        }
    }

    // --- MODAL FUNCTIONS ---
    const showProjectDetails = () => {
        currentModalContext = 'PROJECT'; 
        if(modalMainTitle) modalMainTitle.textContent = "Detail Status Proyek"; 
        if(btnBackToSummary) btnBackToSummary.style.display = 'flex'; 
        if(modalSummaryView && modalListView && modalStoreDetailView) { modalSummaryView.style.display = 'block'; modalListView.style.display = 'none'; modalStoreDetailView.style.display = 'none'; }

        if(grid) {
            grid.innerHTML = Object.entries(currentGroupedProjects).map(([label, items], index) => `
                <div class="modal-stat-item" data-status="${label}">
                    <span class="modal-stat-label">${label}</span><span class="modal-stat-value">${items.length}</span>
                </div>
            `).join('');
        }
        if(projectModal) projectModal.style.display = 'flex';
    };

    const renderStoreList = (status) => {
        const items = currentGroupedProjects[status] || [];
        if(listStatusTitle) listStatusTitle.textContent = `Daftar Toko: ${status} (${items.length})`;
        
        if (storeListContainer) {
            if (items.length === 0) storeListContainer.innerHTML = '<div style="text-align:center; color:#718096; padding: 30px;">Tidak ada toko dalam status ini.</div>';
            else {
                storeListContainer.innerHTML = items.map(item => {
                    let extraInfo = '';
                    if (status === 'Ongoing' && item["Awal_SPK"]) {
                        extraInfo = ` | Mulai SPK: ${item["Awal_SPK"]}`;
                    }
                    
                    if (status === 'Approval RAB' && item["Status_Rab"]) {
                        extraInfo = ` | Status RAB: <span style="color: #d97706; font-weight: 600;">${item["Status_Rab"]}</span>`;
                    }

                    const lingkup = item.Lingkup_Pekerjaan ? item.Lingkup_Pekerjaan : '-';
                    
                    return `
                    <div class="store-item" data-index="${filteredData.indexOf(item)}">
                        <div class="store-info">
                            <strong>${item.Nama_Toko || 'Tanpa Nama'} <span style="font-weight: 500; color: #3b82f6;">(${lingkup})</span></strong>
                            <span>${item.Cabang || '-'} | ${item.Kode_Toko || '-'}${extraInfo}</span>
                        </div>
                        <div class="store-badge">${item.Kategori || '-'}</div>
                    </div>`
                }).join('');
            }
        }
        if(modalSummaryView && modalListView && modalStoreDetailView) { 
            modalSummaryView.style.display = 'none'; 
            modalStoreDetailView.style.display = 'none'; 
            modalListView.style.display = 'block'; 
        }
    };

    const showPenawaranDetails = () => {
        if (!filteredData || filteredData.length === 0) return;
        currentModalContext = 'PENAWARAN'; 
        if (modalMainTitle) modalMainTitle.textContent = "Detail Nilai Penawaran (Grup by Ulok)";
        if (btnBackToSummary) btnBackToSummary.style.display = 'none'; 

        const groupedPenawaran = {};
        filteredData.forEach(item => {
            const penawaranVal = parseCurrency(item["Total Penawaran Final"]);
            if (penawaranVal > 0) {
                const ulok = item["Nomor Ulok"] || 'Tanpa Ulok';
                if (!groupedPenawaran[ulok]) groupedPenawaran[ulok] = { ulok: ulok, namaToko: item.Nama_Toko || 'Tanpa Nama', cabang: item.Cabang || '-', totalPenawaran: 0, items: [] };
                groupedPenawaran[ulok].totalPenawaran += penawaranVal;
                groupedPenawaran[ulok].items.push(item); 
            }
        });
        currentPenawaranGroups = Object.values(groupedPenawaran).sort((a, b) => b.totalPenawaran - a.totalPenawaran);
        if(listStatusTitle) listStatusTitle.textContent = `Daftar Lokasi & Total Penawaran (${currentPenawaranGroups.length} Lokasi)`;

        if (storeListContainer) {
            storeListContainer.innerHTML = currentPenawaranGroups.length === 0 ? '<div style="text-align:center; color:#718096; padding: 30px;">Tidak ada data Penawaran.</div>' : currentPenawaranGroups.map((group, index) => {
                const lingkupText = group.items.map(i => i.Lingkup_Pekerjaan).filter(Boolean).join(' & ') || '-';
                return `
                <div class="store-item" data-penawaran-index="${index}">
                    <div class="store-info"><strong>${group.namaToko} <span style="font-weight: 500; color: #4338ca;">(${lingkupText})</span></strong>
                    <span>Ulok: ${group.ulok} | ${group.cabang}</span></div>
                    <div class="store-badge" style="background:#e0e7ff; color:#4338ca; border: 1px solid #c7d2fe;">${formatRupiah(group.totalPenawaran)}</div>
                </div>`
            }).join('');
        }
        if (modalSummaryView && modalListView && modalStoreDetailView) { modalSummaryView.style.display = 'none'; modalStoreDetailView.style.display = 'none'; modalListView.style.display = 'block'; }
        if (projectModal) projectModal.style.display = 'flex';
    };

    const renderPenawaranDetail = (groupIndex) => {
        const group = currentPenawaranGroups[groupIndex];
        if (!group) return;
        if (detailStoreTitle) detailStoreTitle.textContent = `Rincian Penawaran: ${group.namaToko} (Ulok: ${group.ulok})`;

        if (storeDetailContainer) {
            const itemSipil = group.items.find(i => i.Lingkup_Pekerjaan && i.Lingkup_Pekerjaan.toLowerCase().includes('sipil'));
            const itemME = group.items.find(i => i.Lingkup_Pekerjaan && i.Lingkup_Pekerjaan.toLowerCase().includes('me'));
            const refItem = itemSipil || itemME || group.items[0];

            storeDetailContainer.innerHTML = `
                <div class="detail-grid">
                    <div class="detail-item"><span class="detail-label">Total Akumulasi Penawaran</span><span class="detail-value" style="color:#4338ca; font-size: 16px;">${formatRupiah(group.totalPenawaran)}</span></div>
                    <div class="detail-item"><span class="detail-label">Rincian Per Lingkup</span><span class="detail-value" style="font-weight: 500; line-height: 1.5;">Sipil: <strong>${formatRupiah(itemSipil ? parseCurrency(itemSipil["Total Penawaran Final"]) : 0)}</strong> <br>ME: <strong>${formatRupiah(itemME ? parseCurrency(itemME["Total Penawaran Final"]) : 0)}</strong></span></div>
                    <div class="detail-item"><span class="detail-label">Cabang</span><span class="detail-value">${group.cabang}</span></div>
                    <div class="detail-item"><span class="detail-label">Kode Toko / Ulok</span><span class="detail-value">${refItem.Kode_Toko || '-'} / ${group.ulok}</span></div>
                    <div class="detail-item"><span class="detail-label">Kontraktor Sipil</span><span class="detail-value">${itemSipil ? itemSipil.Kontraktor || '-' : '-'}</span></div>
                    <div class="detail-item"><span class="detail-label">Kontraktor ME</span><span class="detail-value">${itemME ? itemME.Kontraktor || '-' : '-'}</span></div>
                </div>
            `;
        }
        if (modalListView && modalStoreDetailView) { modalListView.style.display = 'none'; modalStoreDetailView.style.display = 'block'; }
    };

    const showSpkDetails = () => {
        if (!filteredData || filteredData.length === 0) return;
        currentModalContext = 'SPK'; 
        if (modalMainTitle) modalMainTitle.textContent = "Detail Nilai SPK (Grup by Ulok)";
        if (btnBackToSummary) btnBackToSummary.style.display = 'none'; 

        const groupedSPK = {};
        filteredData.forEach(item => {
            const spkVal = parseCurrency(item["Nominal SPK"]);
            if (spkVal > 0) {
                const ulok = item["Nomor Ulok"] || 'Tanpa Ulok';
                if (!groupedSPK[ulok]) groupedSPK[ulok] = { ulok: ulok, namaToko: item.Nama_Toko || 'Tanpa Nama', cabang: item.Cabang || '-', totalSPK: 0, items: [] };
                groupedSPK[ulok].totalSPK += spkVal;
                groupedSPK[ulok].items.push(item); 
            }
        });
        currentSpkGroups = Object.values(groupedSPK).sort((a, b) => b.totalSPK - a.totalSPK);
        if(listStatusTitle) listStatusTitle.textContent = `Daftar Lokasi & Total SPK (${currentSpkGroups.length} Lokasi)`;

        if (storeListContainer) {
            storeListContainer.innerHTML = currentSpkGroups.length === 0 ? '<div style="text-align:center; color:#718096; padding: 30px;">Tidak ada data SPK.</div>' : currentSpkGroups.map((group, index) => {
                const lingkupText = group.items.map(i => i.Lingkup_Pekerjaan).filter(Boolean).join(' & ') || '-';
                return `
                <div class="store-item" data-spk-index="${index}">
                    <div class="store-info"><strong>${group.namaToko} <span style="font-weight: 500; color: #c05621;">(${lingkupText})</span></strong>
                    <span>Ulok: ${group.ulok} | ${group.cabang}</span></div>
                    <div class="store-badge" style="background:#fff7ed; color:#c05621; border: 1px solid #fed7aa;">${formatRupiah(group.totalSPK)}</div>
                </div>`
            }).join('');
        }
        if (modalSummaryView && modalListView && modalStoreDetailView) { modalSummaryView.style.display = 'none'; modalStoreDetailView.style.display = 'none'; modalListView.style.display = 'block'; }
        if (projectModal) projectModal.style.display = 'flex';
    };

    const showJhkDetails = () => {
        if (!filteredData || filteredData.length === 0) return;
        currentModalContext = 'JHK'; 
        if (modalMainTitle) modalMainTitle.textContent = "Detail JHK Pekerjaan";
        if (btnBackToSummary) btnBackToSummary.style.display = 'none'; 

        const jhkItems = filteredData.filter(item => (parseFloat(item["Durasi SPK"]) || 0) + (parseFloat(item["tambah_spk"]) || 0) + (parseFloat(item["Keterlambatan"]) || 0) > 0).sort((a, b) => {
            return ((parseFloat(b["Durasi SPK"]) || 0) + (parseFloat(b["tambah_spk"]) || 0) + (parseFloat(b["Keterlambatan"]) || 0)) - ((parseFloat(a["Durasi SPK"]) || 0) + (parseFloat(a["tambah_spk"]) || 0) + (parseFloat(a["Keterlambatan"]) || 0));
        });
        if(listStatusTitle) listStatusTitle.textContent = `Daftar Proyek & Total JHK (${jhkItems.length})`;

        if (storeListContainer) {
            storeListContainer.innerHTML = jhkItems.length === 0 ? '<div style="text-align:center; color:#718096; padding: 30px;">Tidak ada data JHK.</div>' : jhkItems.map(item => {
                const totalJhk = (parseFloat(item["Durasi SPK"]) || 0) + (parseFloat(item["tambah_spk"]) || 0) + (parseFloat(item["Keterlambatan"]) || 0);
                return `
                <div class="store-item" data-index="${filteredData.indexOf(item)}">
                    <div class="store-info"><strong>${item.Nama_Toko || 'Tanpa Nama'} <span style="font-weight: 500; color: #3b82f6;">(${item.Lingkup_Pekerjaan || '-'})</span></strong>
                    <span>Ulok: ${item["Nomor Ulok"] || '-'} | ${item.Cabang || '-'}</span></div>
                    <div class="store-badge" style="background:#f0fff4; color:#2f855a; border: 1px solid #bbf7d0;">${totalJhk} Hari</div>
                </div>`
            }).join('');
        }
        if (modalSummaryView && modalListView && modalStoreDetailView) { modalSummaryView.style.display = 'none'; modalStoreDetailView.style.display = 'none'; modalListView.style.display = 'block'; }
        if (projectModal) projectModal.style.display = 'flex';
    };

    const showAvgCostM2Details = () => {
        if (!filteredData || filteredData.length === 0) return;
        currentModalContext = 'COST_M2_SUMMARY'; 
        if (modalMainTitle) modalMainTitle.textContent = "Kategori Rata-rata Cost /m²";
        if (btnBackToSummary) btnBackToSummary.style.display = 'none'; 

        const groupedCost = {};
        filteredData.forEach(item => {
            const opname = parseCurrency(item["Grand Total Opname Final"]);
            const pekTerbuka = parseCurrency(item["Pekerjaan Area Terbuka"]); // KODE BARU: Ambil nilai Pek. Area Terbuka
            
            const lTerbangun = parseFloat(item["Luas Terbangunan"]) || 0;
            const lBangunan = parseFloat(item["Luas Bangunan"]) || 0;
            const lTerbuka = parseFloat(item["Luas Area Terbuka"]) || 0;
            const ulok = item["Nomor Ulok"] || 'Tanpa Ulok';

            if (!groupedCost[ulok]) {
                groupedCost[ulok] = { 
                    ulok: ulok, 
                    namaToko: item.Nama_Toko || 'Tanpa Nama', 
                    cabang: item.Cabang || '-', 
                    totalOpname: 0, 
                    totalPekerjaanTerbuka: 0, // Variabel penampung baru
                    luasTerbangun: lTerbangun, 
                    luasBangunan: lBangunan, 
                    luasTerbuka: lTerbuka, 
                    items: [] 
                };
            }
            groupedCost[ulok].totalOpname += opname; 
            groupedCost[ulok].totalPekerjaanTerbuka += pekTerbuka; // Akumulasi Pek. Area Terbuka
            groupedCost[ulok].items.push(item);

            if (groupedCost[ulok].luasTerbangun === 0 && lTerbangun > 0) groupedCost[ulok].luasTerbangun = lTerbangun;
            if (groupedCost[ulok].luasBangunan === 0 && lBangunan > 0) groupedCost[ulok].luasBangunan = lBangunan;
            if (groupedCost[ulok].luasTerbuka === 0 && lTerbuka > 0) groupedCost[ulok].luasTerbuka = lTerbuka;
        });

        currentCostGroups = Object.values(groupedCost).map(group => {
            group.costTerbangun = group.luasTerbangun > 0 ? group.totalOpname / group.luasTerbangun : 0;
            
            group.costBangunan = group.luasBangunan > 0 ? (group.totalOpname - group.totalPekerjaanTerbuka) / group.luasBangunan : 0; 
            
            group.costTerbuka = group.luasTerbuka > 0 ? group.totalPekerjaanTerbuka / group.luasTerbuka : 0;
            
            return group;
        });

        let sumOpTer=0, sumTer=0, sumOpBan=0, sumBan=0, sumPekTerb=0, sumTerb=0;
        currentCostGroups.forEach(g => {
            if (g.luasTerbangun > 0) { sumOpTer += g.totalOpname; sumTer += g.luasTerbangun; }
            if (g.luasBangunan > 0) { sumOpBan += (g.totalOpname - g.totalPekerjaanTerbuka); sumBan += g.luasBangunan; }
            if (g.luasTerbuka > 0) { sumPekTerb += g.totalPekerjaanTerbuka; sumTerb += g.luasTerbuka; }
        });

        const summaryData = [
            { label: 'Luas Terbangun', value: formatRupiah(Math.round(sumTer > 0 ? sumOpTer / sumTer : 0)) + ' /m²', type: 'TERBANGUN' },
            { label: 'Luas Bangunan', value: formatRupiah(Math.round(sumBan > 0 ? sumOpBan / sumBan : 0)) + ' /m²', type: 'BANGUNAN' },
            { label: 'Luas Area Terbuka', value: formatRupiah(Math.round(sumTerb > 0 ? sumPekTerb / sumTerb : 0)) + ' /m²', type: 'TERBUKA' }
        ];

        if(grid) {
            grid.innerHTML = summaryData.map((item, index) => `
                <div class="modal-stat-item" data-cost-type="${item.type}">
                    <span class="modal-stat-label">Cost/m² (${item.label})</span><span class="modal-stat-value" style="color: #805ad5;">${item.value}</span>
                </div>`).join('');
        }
        if (modalSummaryView && modalListView && modalStoreDetailView) { modalSummaryView.style.display = 'block'; modalStoreDetailView.style.display = 'none'; modalListView.style.display = 'none'; }
        if (projectModal) projectModal.style.display = 'flex';
    };

    const renderCostList = (type) => {
        currentModalContext = 'COST_M2_LIST';
        if(btnBackToSummary) btnBackToSummary.style.display = 'flex';

        let sortedGroups = [...currentCostGroups]; let typeLabel = '';
        if(type === 'TERBANGUN') { sortedGroups = sortedGroups.filter(g => g.costTerbangun > 0).sort((a,b) => b.costTerbangun - a.costTerbangun); typeLabel = 'Luas Terbangun'; }
        else if(type === 'BANGUNAN') { sortedGroups = sortedGroups.filter(g => g.costBangunan > 0).sort((a,b) => b.costBangunan - a.costBangunan); typeLabel = 'Luas Bangunan'; }
        else if(type === 'TERBUKA') { sortedGroups = sortedGroups.filter(g => g.costTerbuka > 0).sort((a,b) => b.costTerbuka - a.costTerbuka); typeLabel = 'Luas Area Terbuka'; }

        if(listStatusTitle) listStatusTitle.textContent = `Daftar Lokasi & Cost/m² (${typeLabel})`;
        if(storeListContainer) {
            storeListContainer.innerHTML = sortedGroups.length === 0 ? '<div style="text-align:center; color:#718096; padding: 30px;">Tidak ada data.</div>' : sortedGroups.map(group => {
                let costVal = type === 'TERBANGUN' ? group.costTerbangun : type === 'BANGUNAN' ? group.costBangunan : group.costTerbuka;
                return `
                <div class="store-item" data-cost-index="${currentCostGroups.indexOf(group)}">
                    <div class="store-info"><strong>${group.namaToko}</strong><span>Ulok: ${group.ulok} | ${group.cabang}</span></div>
                    <div class="store-badge" style="background:#faf5ff; color:#805ad5; border: 1px solid #e9d8fd;">${formatRupiah(Math.round(costVal))} /m²</div>
                </div>`;
            }).join('');
        }
        if(modalSummaryView && modalListView && modalStoreDetailView) { modalSummaryView.style.display = 'none'; modalStoreDetailView.style.display = 'none'; modalListView.style.display = 'block'; }
    };

    const showKeterlambatanDetails = () => {
        if (!filteredData || filteredData.length === 0) return;
        currentModalContext = 'KETERLAMBATAN'; 
        if (modalMainTitle) modalMainTitle.textContent = "Detail Keterlambatan Proyek";
        if (btnBackToSummary) btnBackToSummary.style.display = 'none'; 

        const delayItems = filteredData.filter(item => (parseFloat(item["Keterlambatan"]) || 0) > 0).sort((a, b) => (parseFloat(b["Keterlambatan"]) || 0) - (parseFloat(a["Keterlambatan"]) || 0));
        if(listStatusTitle) listStatusTitle.textContent = `Daftar Proyek Terlambat (${delayItems.length})`;

        if (storeListContainer) {
            storeListContainer.innerHTML = delayItems.length === 0 ? '<div style="text-align:center; color:#718096; padding: 30px;">Tidak ada data.</div>' : delayItems.map(item => `
                <div class="store-item" data-index="${filteredData.indexOf(item)}">
                    <div class="store-info"><strong>${item.Nama_Toko || 'Tanpa Nama'} <span style="font-weight: 500; color: #3b82f6;">(${item.Lingkup_Pekerjaan || '-'})</span></strong>
                    <span>Ulok: ${item["Nomor Ulok"] || '-'} | ${item.Cabang || '-'}</span></div>
                    <div class="store-badge" style="background:#fff5f5; color:#e53e3e; border: 1px solid #fed7d7;">${parseFloat(item["Keterlambatan"]) || 0} Hari</div>
                </div>`
            ).join('');
        }
        if (modalSummaryView && modalListView && modalStoreDetailView) { modalSummaryView.style.display = 'none'; modalStoreDetailView.style.display = 'none'; modalListView.style.display = 'block'; }
        if (projectModal) projectModal.style.display = 'flex';
    };

    const showNilaiTokoDetails = () => {
        if (!filteredData || filteredData.length === 0) return;
        currentModalContext = 'NILAI_TOKO'; 
        if (modalMainTitle) modalMainTitle.textContent = "Detail Nilai Toko";
        if (btnBackToSummary) btnBackToSummary.style.display = 'none'; 

        const ntItems = filteredData.filter(item => parseFloat(item["Nilai Toko"]) > 0).sort((a, b) => (parseFloat(b["Nilai Toko"]) || 0) - (parseFloat(a["Nilai Toko"]) || 0));
        if(listStatusTitle) listStatusTitle.textContent = `Daftar Proyek & Nilai Toko (${ntItems.length})`;

        if (storeListContainer) {
            storeListContainer.innerHTML = ntItems.length === 0 ? '<div style="text-align:center; color:#718096; padding: 30px;">Tidak ada data.</div>' : ntItems.map(item => `
                <div class="store-item" data-index="${filteredData.indexOf(item)}">
                    <div class="store-info"><strong>${item.Nama_Toko || 'Tanpa Nama'} <span style="font-weight: 500; color: #3b82f6;">(${item.Lingkup_Pekerjaan || '-'})</span></strong>
                    <span>Ulok: ${item["Nomor Ulok"] || '-'} | ${item.Cabang || '-'}</span></div>
                    <div class="store-badge" style="background:#fef3c7; color:#d97706; border: 1px solid #fde68a;">Skor: ${item["Nilai Toko"] || '-'}</div>
                </div>`
            ).join('');
        }
        if (modalSummaryView && modalListView && modalStoreDetailView) { modalSummaryView.style.display = 'none'; modalStoreDetailView.style.display = 'none'; modalListView.style.display = 'block'; }
        if (projectModal) projectModal.style.display = 'flex';
    };

    const showNilaiKontraktorDetails = () => {
        if (!filteredData || filteredData.length === 0) return;
        currentModalContext = 'NILAI_KONTRAKTOR';
        if (modalMainTitle) modalMainTitle.textContent = "Detail Nilai Kontraktor";
        if (btnBackToSummary) btnBackToSummary.style.display = 'none';

        const groupedKontraktor = {};
        filteredData.forEach(item => {
            const nt = parseScore(item["Nilai Toko"]), kontraktor = item["Kontraktor"] && item["Kontraktor"].trim() !== "" ? item["Kontraktor"] : 'Tanpa Kontraktor';
            if (nt > 0) {
                if (!groupedKontraktor[kontraktor]) groupedKontraktor[kontraktor] = { namaKontraktor: kontraktor, totalNilai: 0, countToko: 0, items: [] };
                groupedKontraktor[kontraktor].totalNilai += nt; groupedKontraktor[kontraktor].countToko++; groupedKontraktor[kontraktor].items.push(item);
            }
        });

        currentKontraktorGroups = Object.values(groupedKontraktor).map(group => { group.avgNilai = group.totalNilai / group.countToko; return group; }).sort((a, b) => b.avgNilai - a.avgNilai);
        if(listStatusTitle) listStatusTitle.textContent = `Daftar Kontraktor (${currentKontraktorGroups.length})`;

        if (storeListContainer) {
            storeListContainer.innerHTML = currentKontraktorGroups.length === 0 ? '<div style="text-align:center; color:#718096; padding: 30px;">Tidak ada data.</div>' : currentKontraktorGroups.map((group, index) => `
                <div class="store-item" data-kontraktor-index="${index}">
                    <div class="store-info"><strong>${group.namaKontraktor}</strong><span>Total Digarap: ${group.countToko} Toko</span></div>
                    <div class="store-badge" style="background:#e0f2fe; color:#0284c7; border: 1px solid #bae6fd;">Rata-rata: ${formatScore(group.avgNilai)}</div>
                </div>`
            ).join('');
        }
        if (modalSummaryView && modalListView && modalStoreDetailView) { modalSummaryView.style.display = 'none'; modalStoreDetailView.style.display = 'none'; modalListView.style.display = 'block'; }
        if (projectModal) projectModal.style.display = 'flex';
    };

    const renderKontraktorDetail = (groupIndex) => {
        const group = currentKontraktorGroups[groupIndex];
        if (!group) return;
        if (detailStoreTitle) detailStoreTitle.textContent = `Kontraktor: ${group.namaKontraktor}`;

        if (storeDetailContainer) {
            const storeListHTML = group.items.map(item => `
                <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                    <div style="display: flex; flex-direction: column;"><span style="font-weight: 600; font-size: 13px; color: #1e293b;">${item["Nama_Toko"] || 'Tanpa Nama'}</span><span style="font-size: 11px; color: #64748b;">Ulok: ${item["Nomor Ulok"] || '-'}</span></div>
                    <span style="font-weight: 700; color: #d97706; font-size: 14px;">Skor: ${item["Nilai Toko"] || '-'}</span>
                </div>
            `).join('');

            storeDetailContainer.innerHTML = `
                <div class="detail-grid" style="margin-bottom: 15px;">
                    <div class="detail-item"><span class="detail-label">Total Proyek Dinilai</span><span class="detail-value" style="color:#2563eb; font-size: 16px;">${group.countToko} Toko</span></div>
                    <div class="detail-item"><span class="detail-label">Rata-rata Skor Kontraktor</span><span class="detail-value" style="color:#0284c7; font-size: 16px;">${formatScore(group.avgNilai)}</span></div>
                </div>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px;"><h4 style="margin-top: 0; margin-bottom: 10px; font-size: 13px; color: #475569;">Rincian Toko & Nilai:</h4>${storeListHTML}</div>
            `;
        }
        if (modalListView && modalStoreDetailView) { modalListView.style.display = 'none'; modalStoreDetailView.style.display = 'block'; }
    };

    const renderCostDetail = (groupIndex) => {
        const group = currentCostGroups[groupIndex];
        if (!group) return;
        if (detailStoreTitle) detailStoreTitle.textContent = `Info: ${group.namaToko} (Ulok: ${group.ulok})`;

        if (storeDetailContainer) {
            const itemSipil = group.items.find(i => i.Lingkup_Pekerjaan && i.Lingkup_Pekerjaan.toLowerCase().includes('sipil'));
            const itemME = group.items.find(i => i.Lingkup_Pekerjaan && i.Lingkup_Pekerjaan.toLowerCase().includes('me'));
            const refItem = itemSipil || itemME || group.items[0];

            const pekTerbukaSipil = itemSipil ? parseCurrency(itemSipil["Pekerjaan Area Terbuka"]) : 0;
            const pekTerbukaME = itemME ? parseCurrency(itemME["Pekerjaan Area Terbuka"]) : 0;

            storeDetailContainer.innerHTML = `
                <div class="detail-grid">
                    <div class="detail-item"><span class="detail-label">Grand Total Opname Final</span><span class="detail-value" style="color:#2f855a; font-size: 16px;">${formatRupiah(group.totalOpname)}</span></div>
                    <div class="detail-item"><span class="detail-label">Pekerjaan Area Terbuka</span><span class="detail-value" style="color:#c05621; font-size: 16px;">${formatRupiah(group.totalPekerjaanTerbuka)}</span></div>
                    
                    <div class="detail-item"><span class="detail-label">Rincian Opname</span><span class="detail-value" style="font-weight: 500; line-height: 1.5;">Sipil: <strong>${formatRupiah(itemSipil ? parseCurrency(itemSipil["Grand Total Opname Final"]) : 0)}</strong> <br>ME: <strong>${formatRupiah(itemME ? parseCurrency(itemME["Grand Total Opname Final"]) : 0)}</strong></span></div>
                    <div class="detail-item"><span class="detail-label">Rincian Area Terbuka</span><span class="detail-value" style="font-weight: 500; line-height: 1.5;">Sipil: <strong>${formatRupiah(pekTerbukaSipil)}</strong> <br>ME: <strong>${formatRupiah(pekTerbukaME)}</strong></span></div>
                    
                    <div class="detail-item"><span class="detail-label">Cost /m² (Luas Terbangun)</span><span class="detail-value" style="color:#805ad5; font-size: 15px;">${formatRupiah(Math.round(group.costTerbangun))}</span></div>
                    <div class="detail-item"><span class="detail-label">Cost /m² (Luas Bangunan)</span><span class="detail-value" style="color:#805ad5; font-size: 15px;">${formatRupiah(Math.round(group.costBangunan))}</span></div>
                    
                    <div class="detail-item"><span class="detail-label">Cost /m² (Luas Area Terbuka)</span><span class="detail-value" style="color:#805ad5; font-size: 15px;">${formatRupiah(Math.round(group.costTerbuka))}</span></div>
                    <div class="detail-item"><span class="detail-label">Cabang</span><span class="detail-value">${group.cabang}</span></div>
                    
                    <div class="detail-item"><span class="detail-label">Luas Bangunan</span><span class="detail-value">${refItem["Luas Bangunan"] || 0} m²</span></div>
                    <div class="detail-item"><span class="detail-label">Luas Terbangun</span><span class="detail-value">${refItem["Luas Terbangunan"] || 0} m²</span></div>
                    
                    <div class="detail-item"><span class="detail-label">Luas Area Terbuka</span><span class="detail-value">${refItem["Luas Area Terbuka"] || 0} m²</span></div>
                    <div class="detail-item"><span class="detail-label">Luas Area Parkir</span><span class="detail-value">${refItem["Luas Area Parkir"] || 0} m²</span></div>
                    
                    <div class="detail-item"><span class="detail-label">Luas Area Sales</span><span class="detail-value">${refItem["Luas Area Sales"] || 0} m²</span></div>
                    <div class="detail-item"><span class="detail-label">Luas Gudang</span><span class="detail-value">${refItem["Luas Gudang"] || 0} m²</span></div>
                </div>
            `;
        }
        if (modalListView && modalStoreDetailView) { modalListView.style.display = 'none'; modalStoreDetailView.style.display = 'block'; }
    };

    const renderSpkDetail = (groupIndex) => {
        const group = currentSpkGroups[groupIndex];
        if (!group) return;
        if (detailStoreTitle) detailStoreTitle.textContent = `Rincian SPK: ${group.namaToko} (Ulok: ${group.ulok})`;

        if (storeDetailContainer) {
            const itemSipil = group.items.find(i => i.Lingkup_Pekerjaan && i.Lingkup_Pekerjaan.toLowerCase().includes('sipil'));
            const itemME = group.items.find(i => i.Lingkup_Pekerjaan && i.Lingkup_Pekerjaan.toLowerCase().includes('me'));
            const refItem = itemSipil || itemME || group.items[0];

            storeDetailContainer.innerHTML = `
                <div class="detail-grid">
                    <div class="detail-item"><span class="detail-label">Total Akumulasi SPK</span><span class="detail-value" style="color:#c05621; font-size: 16px;">${formatRupiah(group.totalSPK)}</span></div>
                    <div class="detail-item"><span class="detail-label">Rincian Per Lingkup</span><span class="detail-value" style="font-weight: 500; line-height: 1.5;">Sipil: <strong>${formatRupiah(itemSipil ? parseCurrency(itemSipil["Nominal SPK"]) : 0)}</strong> <br>ME: <strong>${formatRupiah(itemME ? parseCurrency(itemME["Nominal SPK"]) : 0)}</strong></span></div>
                    <div class="detail-item"><span class="detail-label">Cabang</span><span class="detail-value">${group.cabang}</span></div>
                    <div class="detail-item"><span class="detail-label">Kode Toko / Ulok</span><span class="detail-value">${refItem.Kode_Toko || '-'} / ${group.ulok}</span></div>
                    <div class="detail-item"><span class="detail-label">Kontraktor Sipil</span><span class="detail-value">${itemSipil ? itemSipil.Kontraktor || '-' : '-'}</span></div>
                    <div class="detail-item"><span class="detail-label">Kontraktor ME</span><span class="detail-value">${itemME ? itemME.Kontraktor || '-' : '-'}</span></div>
                </div>
            `;
        }
        if (modalListView && modalStoreDetailView) { modalListView.style.display = 'none'; modalStoreDetailView.style.display = 'block'; }
    };

    const renderStoreDetail = (index) => {
        const item = filteredData[index];
        if (!item) return;
        if (detailStoreTitle) detailStoreTitle.textContent = `Info: ${item.Nama_Toko || 'Tanpa Nama'} (${item.Lingkup_Pekerjaan || '-'})`;

        if (storeDetailContainer) {
            if (currentModalContext === 'JHK') {
                const durasi = parseFloat(item["Durasi SPK"]) || 0, tambah = parseFloat(item["tambah_spk"]) || 0, telat = parseFloat(item["Keterlambatan"]) || 0;
                storeDetailContainer.innerHTML = `
                    <div class="detail-grid">
                        <div class="detail-item"><span class="detail-label">Cabang</span><span class="detail-value">${item.Cabang || '-'}</span></div>
                        <div class="detail-item"><span class="detail-label">Kode Toko / Ulok</span><span class="detail-value">${item.Kode_Toko || '-'} / ${item["Nomor Ulok"] || '-'}</span></div>
                        <div class="detail-item"><span class="detail-label">Total Hari Kerja (JHK)</span><span class="detail-value" style="color:#2f855a; font-size: 16px;">${durasi + tambah + telat} Hari</span></div>
                        <div class="detail-item"><span class="detail-label">Rincian Waktu</span><span class="detail-value" style="font-weight: 500; line-height: 1.5;">Durasi SPK: <strong>${durasi}</strong> Hari <br>Tambah SPK: <strong>${tambah}</strong> Hari <br>Keterlambatan: <strong style="color:#e53e3e;">${telat}</strong> Hari</span></div>
                    </div>
                `;
            } else if (currentModalContext === 'KETERLAMBATAN') {
                storeDetailContainer.innerHTML = `
                    <div class="detail-grid">
                        <div class="detail-item"><span class="detail-label">Total Keterlambatan</span><span class="detail-value" style="color:#e53e3e; font-size: 16px;">${parseFloat(item["Keterlambatan"]) || 0} Hari</span></div>
                        <div class="detail-item"><span class="detail-label">Kode Toko / Ulok</span><span class="detail-value">${item.Kode_Toko || '-'} / ${item["Nomor Ulok"] || '-'}</span></div>
                        <div class="detail-item"><span class="detail-label">Akhir SPK</span><span class="detail-value">${item["Akhir_SPK"] || '-'}</span></div>
                        <div class="detail-item"><span class="detail-label">Tambah SPK</span><span class="detail-value">${item["tambah_spk"] || '0'} Hari</span></div>
                        <div class="detail-item"><span class="detail-label">Tanggal Serah Terima</span><span class="detail-value" style="color:#2f855a;">${item["tanggal_serah_terima"] || item["Tgl Serah Terima"] || '-'}</span></div>
                        <div class="detail-item"><span class="detail-label">Cabang</span><span class="detail-value">${item.Cabang || '-'}</span></div>
                    </div>
                `;
            } else if (currentModalContext === 'NILAI_TOKO') {
                storeDetailContainer.innerHTML = `
                    <div class="detail-grid">
                        <div class="detail-item"><span class="detail-label">Grand Total Opname Final</span><span class="detail-value" style="color:#2f855a; font-size: 16px;">${formatRupiah(parseCurrency(item["Grand Total Opname Final"]))}</span></div>
                        <div class="detail-item"><span class="detail-label">Nilai Toko</span><span class="detail-value" style="color:#d97706; font-size: 16px;">${item["Nilai Toko"] || '-'}</span></div>
                        <div class="detail-item"><span class="detail-label">Kode Toko / Ulok</span><span class="detail-value">${item.Kode_Toko || '-'} / ${item["Nomor Ulok"] || '-'}</span></div>
                        <div class="detail-item"><span class="detail-label">Cabang</span><span class="detail-value">${item.Cabang || '-'}</span></div>
                        <div class="detail-item" style="grid-column: span 2; border-bottom: none;"><span class="detail-label">Kontraktor</span><span class="detail-value">${item["Kontraktor"] || '-'}</span></div>
                    </div>
                `;
            } else {
                storeDetailContainer.innerHTML = `
                    <div class="detail-grid">
                        <div class="detail-item"><span class="detail-label">Cabang</span><span class="detail-value">${item.Cabang || '-'}</span></div>
                        <div class="detail-item"><span class="detail-label">Kode Toko / Ulok</span><span class="detail-value">${item.Kode_Toko || '-'} / ${item["Nomor Ulok"] || '-'}</span></div>
                        <div class="detail-item"><span class="detail-label">Kategori</span><span class="detail-value">${item.Kategori || '-'}</span></div>
                        <div class="detail-item"><span class="detail-label">Kontraktor</span><span class="detail-value">${item.Kontraktor || '-'}</span></div>
                        <div class="detail-item"><span class="detail-label">Awal & Akhir SPK</span><span class="detail-value">${item.Awal_SPK || '-'} s/d ${item.Akhir_SPK || '-'}</span></div>
                        <div class="detail-item"><span class="detail-label">Tanggal Serah Terima</span><span class="detail-value">${item.tanggal_serah_terima || item["Tgl Serah Terima"] || '-'}</span></div>
                        <div class="detail-item"><span class="detail-label">Nominal SPK</span><span class="detail-value">${formatRupiah(parseCurrency(item["Nominal SPK"]))}</span></div>
                        <div class="detail-item"><span class="detail-label">Kerja Tambah / Kurang</span><span class="detail-value" style="color:#d62828;">+ ${formatRupiah(parseCurrency(item.Kerja_Tambah))} <br> - ${formatRupiah(parseCurrency(item.Kerja_Kurang))}</span></div>
                        <div class="detail-item"><span class="detail-label">Opname Final</span><span class="detail-value" style="color:#2f855a;">${formatRupiah(parseCurrency(item["Grand Total Opname Final"]))}</span></div>
                        <div class="detail-item"><span class="detail-label">Denda Keterlambatan</span><span class="detail-value" style="color:#e53e3e;">${formatRupiah(parseCurrency(item.Denda))}</span></div>
                    </div>
                `;
            }
        }
        if (modalListView && modalStoreDetailView) { modalListView.style.display = 'none'; modalStoreDetailView.style.display = 'block'; }
    };

    const showAvgBeanspotDetails = () => {
        if (!filteredData || filteredData.length === 0) return; 
        
        currentModalContext = 'BEANSPOT';
        if (modalMainTitle) modalMainTitle.textContent = "Daftar Toko Pekerjaan Beanspot";
        if (btnBackToSummary) btnBackToSummary.style.display = 'none';

        const sortedItems = [...currentBeanspotItems].sort((a, b) => parseCurrency(b["Pekerjaan Beanspot"]) - parseCurrency(a["Pekerjaan Beanspot"]));

        if(listStatusTitle) listStatusTitle.textContent = `Total Toko Beanspot (${sortedItems.length})`;

        if (storeListContainer) {
            if (sortedItems.length === 0) {
                storeListContainer.innerHTML = '<div style="text-align:center; color:#718096; padding: 30px;">Tidak ada data Beanspot.</div>';
            } else {
                storeListContainer.innerHTML = sortedItems.map((item) => {
                    const val = parseCurrency(item["Pekerjaan Beanspot"]);
                    return `
                    <div class="store-item" style="cursor: default; border-color: #fbcfe8;">
                        <div class="store-info">
                            <strong>${item.Nama_Toko || 'Tanpa Nama'}</strong>
                            <span>Ulok: ${item["Nomor Ulok"] || '-'} | ${item.Cabang || '-'}</span>
                        </div>
                        <div class="store-badge" style="background:#fdf2f8; color:#db2777; border: 1px solid #fbcfe8; font-size: 13px;">
                            ${formatRupiah(val)}
                        </div>
                    </div>`;
                }).join('');
            }
        }
        
        if (modalSummaryView && modalListView && modalStoreDetailView) { 
            modalSummaryView.style.display = 'none'; 
            modalStoreDetailView.style.display = 'none'; 
            modalListView.style.display = 'block'; 
        }
        if (projectModal) projectModal.style.display = 'flex';
    };

    const showTotalDendaDetails = () => {
        if (!filteredData || filteredData.length === 0) return; 
        
        currentModalContext = 'DENDA';
        if (modalMainTitle) modalMainTitle.textContent = "Daftar Toko Terkena Denda";
        if (btnBackToSummary) btnBackToSummary.style.display = 'none';

        // Urutkan dari nominal denda terbesar ke terkecil
        const sortedItems = [...currentDendaItems].sort((a, b) => parseCurrency(b["Denda"]) - parseCurrency(a["Denda"]));

        if(listStatusTitle) listStatusTitle.textContent = `Total Toko Terkena Denda (${sortedItems.length})`;

        if (storeListContainer) {
            if (sortedItems.length === 0) {
                storeListContainer.innerHTML = '<div style="text-align:center; color:#718096; padding: 30px;">Tidak ada data proyek yang terkena denda.</div>';
            } else {
                storeListContainer.innerHTML = sortedItems.map((item) => {
                    const dendaVal = parseCurrency(item["Denda"]);
                    const telat = parseFloat(item["Keterlambatan"]) || 0;
                    return `
                    <div class="store-item" style="cursor: default; border-color: #fecaca;">
                        <div class="store-info">
                            <strong>${item.Nama_Toko || 'Tanpa Nama'}</strong>
                            <span>Ulok: ${item["Nomor Ulok"] || '-'} | Telat: <b style="color: #e53e3e;">${telat} Hari</b></span>
                        </div>
                        <div class="store-badge" style="background:#fee2e2; color:#b91c1c; border: 1px solid #fecaca; font-size: 13px;">
                            ${formatRupiah(dendaVal)}
                        </div>
                    </div>`;
                }).join('');
            }
        }
        
        if (modalSummaryView && modalListView && modalStoreDetailView) { 
            modalSummaryView.style.display = 'none'; 
            modalStoreDetailView.style.display = 'none'; 
            modalListView.style.display = 'block'; 
        }
        if (projectModal) projectModal.style.display = 'flex';
    };

    // --- EVENT LISTENERS ---
    if(totalProyekCard) totalProyekCard.addEventListener('click', showProjectDetails);
    if(totalPenawaranCard) totalPenawaranCard.addEventListener('click', showPenawaranDetails); 
    if(totalSpkCard) totalSpkCard.addEventListener('click', showSpkDetails); 
    if(totalJhkCard) totalJhkCard.addEventListener('click', showJhkDetails);
    if(totalDendaCard) totalDendaCard.addEventListener('click', showTotalDendaDetails);
    if(avgCostM2Card) avgCostM2Card.addEventListener('click', showAvgCostM2Details); 
    if(avgKeterlambatanCard) avgKeterlambatanCard.addEventListener('click', showKeterlambatanDetails); 
    if(nilaiTokoCard) nilaiTokoCard.addEventListener('click', showNilaiTokoDetails);
    if(nilaiKontraktorCard) nilaiKontraktorCard.addEventListener('click', showNilaiKontraktorDetails);
    if(avgBeanspotCard) avgBeanspotCard.addEventListener('click', showAvgBeanspotDetails);
    
    if(grid) grid.addEventListener('click', (e) => { const statItem = e.target.closest('.modal-stat-item'); if (!statItem) return; const status = statItem.getAttribute('data-status'); if (status) renderStoreList(status); const costType = statItem.getAttribute('data-cost-type'); if (costType) renderCostList(costType); });
    
    if(storeListContainer) storeListContainer.addEventListener('click', (e) => {
        const storeItem = e.target.closest('.store-item'); if (!storeItem) return;
        const itemIndex = storeItem.getAttribute('data-index'); if(itemIndex !== null) return renderStoreDetail(itemIndex);
        const penawaranIndex = storeItem.getAttribute('data-penawaran-index'); if(penawaranIndex !== null) return renderPenawaranDetail(penawaranIndex); 
        const spkIndex = storeItem.getAttribute('data-spk-index'); if (spkIndex !== null) return renderSpkDetail(spkIndex);
        const costIndex = storeItem.getAttribute('data-cost-index'); if (costIndex !== null) return renderCostDetail(costIndex);
        const kontraktorIndex = storeItem.getAttribute('data-kontraktor-index'); if (kontraktorIndex !== null) return renderKontraktorDetail(kontraktorIndex);
    });

    if(btnBackToSummary) btnBackToSummary.addEventListener('click', () => { modalListView.style.display = 'none'; modalSummaryView.style.display = 'block'; });
    if(btnBackToList) btnBackToList.addEventListener('click', () => { modalStoreDetailView.style.display = 'none'; modalListView.style.display = 'block'; });
    if(closeModal) closeModal.addEventListener('click', () => { if(projectModal) projectModal.style.display = 'none'; });
    window.addEventListener('click', (e) => { if (e.target === projectModal) projectModal.style.display = 'none'; });

    // --- HELPERS ---
    const formatRupiah = (num) => "Rp " + new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
    const formatScore = (num) => new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);
    const parseCurrency = (value) => { if (!value) return 0; if (typeof value === 'number') return value; const cleanStr = value.replace(/\./g, '').replace(/,/g, '.'); return isNaN(parseFloat(cleanStr)) ? 0 : parseFloat(cleanStr); };
    const parseScore = (value) => { if (!value) return 0; let num = typeof value === 'number' ? value : parseFloat(value.replace(/,/g, '.')); if (isNaN(num)) return 0; return num > 100 ? num / 100 : num; };
    const getYearFromDate = (dateStr) => { if (!dateStr) return null; const dateObj = new Date(dateStr); if (!isNaN(dateObj.getTime())) return dateObj.getFullYear().toString(); const match = String(dateStr).match(/\d{4}/); return match ? match[0] : null; };
    const easeOutExpo = (x) => x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
    function animateValue(id, start, end, duration, formatter = (val) => val, isFloat = false) {
        const obj = document.getElementById(id); if(!obj) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            let currentVal = easeOutExpo(progress) * (end - start) + start;
            if (!isFloat) currentVal = Math.floor(currentVal);
            obj.innerHTML = formatter(currentVal);
            if (progress < 1) window.requestAnimationFrame(step); else obj.innerHTML = formatter(end);
        };
        window.requestAnimationFrame(step);
    }

    // ==========================================
    // INIT EXECUTION - SANGAT PENTING
    // ==========================================
    initDashboardData();
});