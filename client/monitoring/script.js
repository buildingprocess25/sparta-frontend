document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. GLOBAL VARIABLES & AUTH
    // ==========================================
    let rawData = []; 
    let filteredData = []; 
    
    // --- Cek Sesi ---
    const userRole = sessionStorage.getItem('userRole'); 
    const userCabang = sessionStorage.getItem('loggedInUserCabang'); 
    const isHO = userCabang === 'HEAD OFFICE'; 
    
    if (!userRole) {
        window.location.href = '../../auth/index.html';
        return;
    }

    // Tampilkan User Info
    const emailDisplay = sessionStorage.getItem('loggedInUserEmail') || 'User';
    document.getElementById('userNameDisplay').textContent = emailDisplay;
    document.getElementById('roleBadge').textContent = `${userCabang} - ${userRole}`;

    // --- Sembunyikan Box Filter jika bukan HEAD OFFICE ---
    const controlsDiv = document.querySelector('.controls');
    if (!isHO && controlsDiv) {
        controlsDiv.style.display = 'none';
    }

    // ==========================================
    // 2. MODAL & DRILL-DOWN LOGIC
    // ==========================================
    const projectModal = document.getElementById('projectModal');
    const closeModal = document.getElementById('closeModal');
    const totalProyekCard = document.getElementById('card-total-proyek-wrapper');
    const totalSpkCard = document.getElementById('card-total-spk-wrapper'); 
    const totalJhkCard = document.getElementById('card-total-jhk-wrapper'); 
    const avgCostM2Card = document.getElementById('card-avg-cost-m2-wrapper'); 
    const avgKeterlambatanCard = document.getElementById('card-avg-keterlambatan-wrapper'); // BARU

    // Variabel View List Toko & Detail
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

    // --- FUNGSI 1: Modal untuk Total Proyek ---
    const showProjectDetails = () => {
        currentModalContext = 'PROJECT'; 
        if(modalMainTitle) modalMainTitle.textContent = "Detail Status Proyek"; 
        if(btnBackToSummary) btnBackToSummary.style.display = 'flex'; 

        if(modalSummaryView && modalListView && modalStoreDetailView) {
            modalSummaryView.style.display = 'block';
            modalListView.style.display = 'none';
            modalStoreDetailView.style.display = 'none';
        }

        currentGroupedProjects = {
            'Approval RAB': [], 'Proses PJU': [], 'Approval SPK': [],
            'Ongoing': [], 'Kerja Tambah Kurang': [], 'Done': []
        };

        filteredData.forEach(item => {
            const hasPenawaranFinal = item["Total Penawaran Final"] && String(item["Total Penawaran Final"]).trim() !== "";
            const hasSPK = item["Nominal SPK"] && String(item["Nominal SPK"]).trim() !== "";
            const hasSerahTerima = (item["tanggal_serah_terima"] && String(item["tanggal_serah_terima"]).trim() !== "") || 
                                   (item["Tgl Serah Terima"] && String(item["Tgl Serah Terima"]).trim() !== "");
            const hasOpnameFinal = item["tanggal_opname_final"] && String(item["tanggal_opname_final"]).trim() !== "";
            const hasStatus = item["Status"] && String(item["Status"]).trim() !== "";

            if (hasOpnameFinal) {
                currentGroupedProjects['Done'].push(item);
            } 
            else if (hasSerahTerima && !hasOpnameFinal) {
                currentGroupedProjects['Kerja Tambah Kurang'].push(item);
            } 
            else if (hasSPK && !hasSerahTerima) {
                currentGroupedProjects['Ongoing'].push(item);
            } 
            else if (hasStatus && !hasSPK) {
                currentGroupedProjects['Approval SPK'].push(item);
            }
            else if (hasPenawaranFinal && !hasSPK) {
                currentGroupedProjects['Approval RAB'].push(item);
                currentGroupedProjects['Proses PJU'].push(item);
            }
        });

        if(grid) {
            grid.innerHTML = Object.entries(currentGroupedProjects).map(([label, items], index) => `
                <div class="modal-stat-item" data-status="${label}" style="animation-delay: ${0.1 + (index * 0.05)}s; cursor: pointer;">
                    <span class="modal-stat-label">${label}</span>
                    <span class="modal-stat-value">${items.length}</span>
                </div>
            `).join('');
        }
        if(projectModal) projectModal.style.display = 'flex';
    };

    const renderStoreList = (status) => {
        const items = currentGroupedProjects[status] || [];
        if(listStatusTitle) listStatusTitle.textContent = `Daftar Toko: ${status} (${items.length})`;
        
        if (!storeListContainer) return;

        if (items.length === 0) {
            storeListContainer.innerHTML = '<div style="text-align:center; color:#718096; padding: 30px;">Tidak ada toko dalam status ini.</div>';
        } else {
            storeListContainer.innerHTML = items.map(item => {
                let extraInfo = '';
                if (status === 'Ongoing' && item["Awal_SPK"]) extraInfo = ` | Mulai SPK: ${item["Awal_SPK"]}`;
                const lingkup = item.Lingkup_Pekerjaan ? item.Lingkup_Pekerjaan : '-';
                const rawIndex = filteredData.indexOf(item);

                return `
                <div class="store-item" data-index="${rawIndex}">
                    <div class="store-info">
                        <strong>${item.Nama_Toko || 'Tanpa Nama'} <span style="font-weight: 500; color: #3b82f6;">(${lingkup})</span></strong>
                        <span>${item.Cabang || '-'} | ${item.Kode_Toko || '-'}${extraInfo}</span>
                    </div>
                    <div class="store-badge">${item.Kategori || '-'}</div>
                </div>
            `}).join('');
        }

        if(modalSummaryView && modalListView && modalStoreDetailView) {
            modalSummaryView.style.display = 'none';
            modalStoreDetailView.style.display = 'none';
            modalListView.style.display = 'block';
        }
    };

    // --- FUNGSI 2: Modal untuk Total Nilai SPK ---
    const showSpkDetails = () => {
        if (!filteredData || filteredData.length === 0) return;
        currentModalContext = 'SPK'; 

        if (modalMainTitle) modalMainTitle.textContent = "Detail Nilai SPK";
        if (btnBackToSummary) btnBackToSummary.style.display = 'none'; 

        const spkItems = filteredData.filter(item => parseCurrency(item["Nominal SPK"]) > 0)
            .sort((a, b) => parseCurrency(b["Nominal SPK"]) - parseCurrency(a["Nominal SPK"]));

        if(listStatusTitle) listStatusTitle.textContent = `Daftar Proyek & Nilai SPK (${spkItems.length})`;

        if (storeListContainer) {
            if (spkItems.length === 0) {
                storeListContainer.innerHTML = '<div style="text-align:center; color:#718096; padding: 30px;">Tidak ada data SPK.</div>';
            } else {
                storeListContainer.innerHTML = spkItems.map(item => {
                    const lingkup = item.Lingkup_Pekerjaan ? item.Lingkup_Pekerjaan : '-';
                    const nilaiSpk = formatRupiah(parseCurrency(item["Nominal SPK"]));
                    const ulok = item["Nomor Ulok"] || '-';
                    return `
                    <div class="store-item" style="cursor: default;">
                        <div class="store-info">
                            <strong>${item.Nama_Toko || 'Tanpa Nama'} <span style="font-weight: 500; color: #3b82f6;">(${lingkup})</span></strong>
                            <span>Ulok: ${ulok} | ${item.Cabang || '-'}</span>
                        </div>
                        <div class="store-badge" style="background:#fff7ed; color:#c05621; border: 1px solid #fed7aa; font-size: 13px;">
                            ${nilaiSpk}
                        </div>
                    </div>
                `}).join('');
            }
        }

        if (modalSummaryView && modalListView && modalStoreDetailView) {
            modalSummaryView.style.display = 'none';
            modalStoreDetailView.style.display = 'none';
            modalListView.style.display = 'block';
        }

        if (projectModal) projectModal.style.display = 'flex';
    };

    // --- FUNGSI 3: Modal untuk Total JHK Pekerjaan ---
    const showJhkDetails = () => {
        if (!filteredData || filteredData.length === 0) return;
        currentModalContext = 'JHK'; 

        if (modalMainTitle) modalMainTitle.textContent = "Detail JHK Pekerjaan";
        if (btnBackToSummary) btnBackToSummary.style.display = 'none'; 

        const jhkItems = filteredData.filter(item => {
            const d = parseFloat(item["Durasi SPK"]) || 0;
            const t = parseFloat(item["tambah_spk"]) || 0;
            const k = parseFloat(item["Keterlambatan"]) || 0;
            return (d + t + k) > 0;
        }).sort((a, b) => {
            const jhkA = (parseFloat(a["Durasi SPK"]) || 0) + (parseFloat(a["tambah_spk"]) || 0) + (parseFloat(a["Keterlambatan"]) || 0);
            const jhkB = (parseFloat(b["Durasi SPK"]) || 0) + (parseFloat(b["tambah_spk"]) || 0) + (parseFloat(b["Keterlambatan"]) || 0);
            return jhkB - jhkA;
        });

        if(listStatusTitle) listStatusTitle.textContent = `Daftar Proyek & Total JHK (${jhkItems.length})`;

        if (storeListContainer) {
            if (jhkItems.length === 0) {
                storeListContainer.innerHTML = '<div style="text-align:center; color:#718096; padding: 30px;">Tidak ada data JHK.</div>';
            } else {
                storeListContainer.innerHTML = jhkItems.map(item => {
                    const lingkup = item.Lingkup_Pekerjaan ? item.Lingkup_Pekerjaan : '-';
                    const ulok = item["Nomor Ulok"] || '-';
                    const rawIndex = filteredData.indexOf(item);
                    
                    const d = parseFloat(item["Durasi SPK"]) || 0;
                    const t = parseFloat(item["tambah_spk"]) || 0;
                    const k = parseFloat(item["Keterlambatan"]) || 0;
                    const totalJhk = d + t + k;

                    return `
                    <div class="store-item" data-index="${rawIndex}">
                        <div class="store-info">
                            <strong>${item.Nama_Toko || 'Tanpa Nama'} <span style="font-weight: 500; color: #3b82f6;">(${lingkup})</span></strong>
                            <span>Ulok: ${ulok} | ${item.Cabang || '-'}</span>
                        </div>
                        <div class="store-badge" style="background:#f0fff4; color:#2f855a; border: 1px solid #bbf7d0; font-size: 13px;">
                            ${totalJhk} Hari
                        </div>
                    </div>
                `}).join('');
            }
        }

        if (modalSummaryView && modalListView && modalStoreDetailView) {
            modalSummaryView.style.display = 'none';
            modalStoreDetailView.style.display = 'none';
            modalListView.style.display = 'block';
        }

        if (projectModal) projectModal.style.display = 'flex';
    };

    // --- FUNGSI 4: Modal untuk Rata-rata Cost /m² ---
    const showAvgCostM2Details = () => {
        if (!filteredData || filteredData.length === 0) return;
        currentModalContext = 'COST_M2'; 

        if (modalMainTitle) modalMainTitle.textContent = "Detail Cost /m² per Proyek";
        if (btnBackToSummary) btnBackToSummary.style.display = 'none'; 

        const costItems = filteredData.filter(item => {
            const opname = parseCurrency(item["Grand Total Opname Final"]);
            const luas = parseFloat(item["Luas Terbangunan"]) || 0;
            return opname > 0 && luas > 0;
        }).sort((a, b) => {
            const costA = parseCurrency(a["Grand Total Opname Final"]) / (parseFloat(a["Luas Terbangunan"]) || 1);
            const costB = parseCurrency(b["Grand Total Opname Final"]) / (parseFloat(b["Luas Terbangunan"]) || 1);
            return costB - costA;
        });

        if(listStatusTitle) listStatusTitle.textContent = `Daftar Proyek & Cost/m² (${costItems.length})`;

        if (storeListContainer) {
            if (costItems.length === 0) {
                storeListContainer.innerHTML = '<div style="text-align:center; color:#718096; padding: 30px;">Tidak ada data Cost/m².</div>';
            } else {
                storeListContainer.innerHTML = costItems.map(item => {
                    const lingkup = item.Lingkup_Pekerjaan ? item.Lingkup_Pekerjaan : '-';
                    const ulok = item["Nomor Ulok"] || '-';
                    const rawIndex = filteredData.indexOf(item);
                    
                    const opname = parseCurrency(item["Grand Total Opname Final"]);
                    const luas = parseFloat(item["Luas Terbangunan"]) || 1;
                    const costPerM2 = formatRupiah(Math.round(opname / luas));

                    return `
                    <div class="store-item" data-index="${rawIndex}">
                        <div class="store-info">
                            <strong>${item.Nama_Toko || 'Tanpa Nama'} <span style="font-weight: 500; color: #3b82f6;">(${lingkup})</span></strong>
                            <span>Ulok: ${ulok} | ${item.Cabang || '-'}</span>
                        </div>
                        <div class="store-badge" style="background:#faf5ff; color:#805ad5; border: 1px solid #e9d8fd; font-size: 13px;">
                            ${costPerM2} /m²
                        </div>
                    </div>
                `}).join('');
            }
        }

        if (modalSummaryView && modalListView && modalStoreDetailView) {
            modalSummaryView.style.display = 'none';
            modalStoreDetailView.style.display = 'none';
            modalListView.style.display = 'block';
        }

        if (projectModal) projectModal.style.display = 'flex';
    };

    // --- FUNGSI 5: Modal untuk Keterlambatan (BARU) ---
    const showKeterlambatanDetails = () => {
        if (!filteredData || filteredData.length === 0) return;
        currentModalContext = 'KETERLAMBATAN'; 

        if (modalMainTitle) modalMainTitle.textContent = "Detail Keterlambatan Proyek";
        if (btnBackToSummary) btnBackToSummary.style.display = 'none'; 

        // Filter toko yang punya Keterlambatan > 0, lalu urutkan
        const delayItems = filteredData.filter(item => {
            const telat = parseFloat(item["Keterlambatan"]) || 0;
            return telat > 0;
        }).sort((a, b) => {
            const telatA = parseFloat(a["Keterlambatan"]) || 0;
            const telatB = parseFloat(b["Keterlambatan"]) || 0;
            return telatB - telatA;
        });

        if(listStatusTitle) listStatusTitle.textContent = `Daftar Proyek Terlambat (${delayItems.length})`;

        if (storeListContainer) {
            if (delayItems.length === 0) {
                storeListContainer.innerHTML = '<div style="text-align:center; color:#718096; padding: 30px;">Tidak ada data proyek yang terlambat.</div>';
            } else {
                storeListContainer.innerHTML = delayItems.map(item => {
                    const lingkup = item.Lingkup_Pekerjaan ? item.Lingkup_Pekerjaan : '-';
                    const ulok = item["Nomor Ulok"] || '-';
                    const rawIndex = filteredData.indexOf(item);
                    const telat = parseFloat(item["Keterlambatan"]) || 0;

                    return `
                    <div class="store-item" data-index="${rawIndex}">
                        <div class="store-info">
                            <strong>${item.Nama_Toko || 'Tanpa Nama'} <span style="font-weight: 500; color: #3b82f6;">(${lingkup})</span></strong>
                            <span>Ulok: ${ulok} | ${item.Cabang || '-'}</span>
                        </div>
                        <div class="store-badge" style="background:#fff5f5; color:#e53e3e; border: 1px solid #fed7d7; font-size: 13px;">
                            ${telat} Hari
                        </div>
                    </div>
                `}).join('');
            }
        }

        if (modalSummaryView && modalListView && modalStoreDetailView) {
            modalSummaryView.style.display = 'none';
            modalStoreDetailView.style.display = 'none';
            modalListView.style.display = 'block';
        }

        if (projectModal) projectModal.style.display = 'flex';
    };


    // --- FUNGSI 6: Render Detail Toko Spesifik (Diperbarui) ---
    const renderStoreDetail = (index) => {
        const item = filteredData[index];
        if (!item) return;

        if (detailStoreTitle) {
            const lingkup = item.Lingkup_Pekerjaan ? item.Lingkup_Pekerjaan : '-';
            detailStoreTitle.textContent = `Info: ${item.Nama_Toko || 'Tanpa Nama'} (${lingkup})`;
        }

        if (storeDetailContainer) {
            if (currentModalContext === 'JHK') {
                const durasi = parseFloat(item["Durasi SPK"]) || 0;
                const tambah = parseFloat(item["tambah_spk"]) || 0;
                const telat = parseFloat(item["Keterlambatan"]) || 0;
                const totalJhk = durasi + tambah + telat;

                storeDetailContainer.innerHTML = `
                    <div class="detail-grid">
                        <div class="detail-item"><span class="detail-label">Cabang</span><span class="detail-value">${item.Cabang || '-'}</span></div>
                        <div class="detail-item"><span class="detail-label">Kode Toko / Ulok</span><span class="detail-value">${item.Kode_Toko || '-'} / ${item["Nomor Ulok"] || '-'}</span></div>
                        
                        <div class="detail-item"><span class="detail-label">Total Hari Kerja (JHK)</span><span class="detail-value" style="color:#2f855a; font-size: 16px;">${totalJhk} Hari</span></div>
                        <div class="detail-item"><span class="detail-label">Rincian Waktu</span>
                            <span class="detail-value" style="font-weight: 500; line-height: 1.5;">
                                Durasi SPK: <strong>${durasi}</strong> Hari <br>
                                Tambah SPK: <strong>${tambah}</strong> Hari <br>
                                Keterlambatan: <strong style="color:#e53e3e;">${telat}</strong> Hari
                            </span>
                        </div>
                    </div>
                `;
            } else if (currentModalContext === 'COST_M2') {
                const luasBangunan = parseFloat(item["Luas Bangunan"]) || 0;
                const luasTerbangun = parseFloat(item["Luas Terbangunan"]) || 0;
                const luasTerbuka = parseFloat(item["Luas Area Terbuka"]) || 0;
                const luasParkir = parseFloat(item["Luas Area Parkir"]) || 0;
                const luasSales = parseFloat(item["Luas Area Sales"]) || 0;
                const luasGudang = parseFloat(item["Luas Gudang"]) || 0;
                const opnameFinal = formatRupiah(parseCurrency(item["Grand Total Opname Final"]));
                const costPerM2 = formatRupiah(Math.round(parseCurrency(item["Grand Total Opname Final"]) / (luasTerbangun || 1)));

                storeDetailContainer.innerHTML = `
                    <div class="detail-grid">
                        <div class="detail-item"><span class="detail-label">Grand Total Opname Final</span><span class="detail-value" style="color:#2f855a; font-size: 16px;">${opnameFinal}</span></div>
                        <div class="detail-item"><span class="detail-label">Cost /m² (Luas Terbangun)</span><span class="detail-value" style="color:#805ad5; font-size: 16px;">${costPerM2}</span></div>
                        
                        <div class="detail-item"><span class="detail-label">Luas Bangunan</span><span class="detail-value">${luasBangunan} m²</span></div>
                        <div class="detail-item"><span class="detail-label">Luas Terbangunan</span><span class="detail-value">${luasTerbangun} m²</span></div>
                        
                        <div class="detail-item"><span class="detail-label">Luas Area Terbuka</span><span class="detail-value">${luasTerbuka} m²</span></div>
                        <div class="detail-item"><span class="detail-label">Luas Area Parkir</span><span class="detail-value">${luasParkir} m²</span></div>
                        
                        <div class="detail-item"><span class="detail-label">Luas Area Sales</span><span class="detail-value">${luasSales} m²</span></div>
                        <div class="detail-item"><span class="detail-label">Luas Gudang</span><span class="detail-value">${luasGudang} m²</span></div>
                    </div>
                `;
            } else if (currentModalContext === 'KETERLAMBATAN') {
                // Tampilan Detail khusus untuk Keterlambatan (BARU)
                const akhirSpk = item["Akhir_SPK"] || '-';
                const tambahSpk = item["tambah_spk"] || '0';
                const tglSerahTerima = item["tanggal_serah_terima"] || item["Tgl Serah Terima"] || '-';
                const telat = parseFloat(item["Keterlambatan"]) || 0;

                storeDetailContainer.innerHTML = `
                    <div class="detail-grid">
                        <div class="detail-item"><span class="detail-label">Total Keterlambatan</span><span class="detail-value" style="color:#e53e3e; font-size: 16px;">${telat} Hari</span></div>
                        <div class="detail-item"><span class="detail-label">Kode Toko / Ulok</span><span class="detail-value">${item.Kode_Toko || '-'} / ${item["Nomor Ulok"] || '-'}</span></div>
                        
                        <div class="detail-item"><span class="detail-label">Akhir SPK</span><span class="detail-value">${akhirSpk}</span></div>
                        <div class="detail-item"><span class="detail-label">Tambah SPK</span><span class="detail-value">${tambahSpk} Hari</span></div>
                        
                        <div class="detail-item"><span class="detail-label">Tanggal Serah Terima</span><span class="detail-value" style="color:#2f855a;">${tglSerahTerima}</span></div>
                        <div class="detail-item"><span class="detail-label">Cabang</span><span class="detail-value">${item.Cabang || '-'}</span></div>
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

        if (modalListView && modalStoreDetailView) {
            modalListView.style.display = 'none';
            modalStoreDetailView.style.display = 'block';
        }
    };

    // Event Listeners untuk interaksi Modal
    if(totalProyekCard) totalProyekCard.addEventListener('click', showProjectDetails);
    if(totalSpkCard) totalSpkCard.addEventListener('click', showSpkDetails); 
    if(totalJhkCard) totalJhkCard.addEventListener('click', showJhkDetails); 
    if(avgCostM2Card) avgCostM2Card.addEventListener('click', showAvgCostM2Details); 
    if(avgKeterlambatanCard) avgKeterlambatanCard.addEventListener('click', showKeterlambatanDetails); // EVENT KLIK BARU
    
    // Event Delegation: Menangkap klik pada card stat di dalam modal
    if(grid) {
        grid.addEventListener('click', (e) => {
            const statItem = e.target.closest('.modal-stat-item');
            if (!statItem) return; 
            
            const status = statItem.getAttribute('data-status');
            renderStoreList(status);
        });
    }

    // Event Delegation: Menangkap klik pada list toko 
    if(storeListContainer) {
        storeListContainer.addEventListener('click', (e) => {
            const storeItem = e.target.closest('.store-item');
            if (!storeItem) return;
            
            const itemIndex = storeItem.getAttribute('data-index');
            if(itemIndex !== null) {
                renderStoreDetail(itemIndex);
            }
        });
    }

    // Navigasi Back
    if(btnBackToSummary) {
        btnBackToSummary.addEventListener('click', () => {
            modalListView.style.display = 'none';
            modalSummaryView.style.display = 'block';
        });
    }

    if(btnBackToList) {
        btnBackToList.addEventListener('click', () => {
            modalStoreDetailView.style.display = 'none';
            modalListView.style.display = 'block';
        });
    }

    if(closeModal) {
        closeModal.addEventListener('click', () => {
            if(projectModal) projectModal.style.display = 'none';
        });
    }
    
    window.addEventListener('click', (e) => {
        if (e.target === projectModal) {
            projectModal.style.display = 'none';
        }
    });

    // ==========================================
    // 3. HELPER FUNCTIONS
    // ==========================================
    
    const formatRupiah = (num) => {
        return "Rp " + new Intl.NumberFormat("id-ID", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(num);
    };

    const parseCurrency = (value) => {
        if (value === null || value === undefined || value === '') return 0;
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            if (value.includes('#REF!') || value.includes('Error')) return 0;
            const cleanStr = value.replace(/\./g, '').replace(/,/g, '.');
            const floatVal = parseFloat(cleanStr);
            return isNaN(floatVal) ? 0 : floatVal;
        }
        return 0;
    };

    const getYearFromDate = (dateStr) => {
        if (!dateStr) return null;
        const match = dateStr.match(/\d{4}/);
        return match ? match[0] : null;
    };

    const easeOutExpo = (x) => {
        return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
    };

    function animateValue(id, start, end, duration, formatter = (val) => val) {
        const obj = document.getElementById(id);
        if(!obj) return;
        let startTimestamp = null;
        
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const timeProgress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easedProgress = easeOutExpo(timeProgress);
            
            const currentVal = Math.floor(easedProgress * (end - start) + start);
            obj.innerHTML = formatter(currentVal);
            
            if (timeProgress < 1) {
                window.requestAnimationFrame(step);
            } else {
                obj.innerHTML = formatter(end); 
            }
        };
        window.requestAnimationFrame(step);
    }

    // ==========================================
    // 4. FETCH DATA & INIT
    // ==========================================
    async function initDashboard() {
        const API_URL = "https://sparta-backend-5hdj.onrender.com/api/opname/summary-data";
        
        document.getElementById('card-total-proyek').textContent = "...";

        try {
            const response = await fetch(API_URL);
            const result = await response.json();

            if (result.status === 'success' && Array.isArray(result.data)) {
                rawData = result.data;
                populateFilters(rawData);
                applyFilters(); 
            } else {
                console.error("Data API kosong/format salah");
                document.getElementById('card-total-proyek').textContent = "0";
            }
        } catch (error) {
            console.error("Error Fetching:", error);
            document.getElementById('card-total-proyek').textContent = "Err";
        }
    }

    // ==========================================
    // 5. FILTER LOGIC
    // ==========================================
    function populateFilters(data) {
        const cabangSelect = document.getElementById('filterCabang');
        const tahunSelect = document.getElementById('filterTahun');

        const uniqueCabang = [...new Set(data.map(item => item.Cabang))]
            .filter(c => c && c.trim() !== "")
            .sort();

        cabangSelect.innerHTML = ''; 

        if (!isHO) {
            const opt = document.createElement('option');
            opt.value = userCabang;
            opt.textContent = userCabang;
            cabangSelect.appendChild(opt);
            cabangSelect.value = userCabang;
        } else {
            cabangSelect.innerHTML = '<option value="ALL">Semua Cabang</option>';
            uniqueCabang.forEach(cab => {
                const opt = document.createElement('option');
                opt.value = cab;
                opt.textContent = cab;
                cabangSelect.appendChild(opt);
            });
        }

        const uniqueTahun = [...new Set(data.map(item => getYearFromDate(item.Awal_SPK)))]
            .filter(y => y)
            .sort((a, b) => b - a);

        tahunSelect.innerHTML = '<option value="ALL">Semua Tahun</option>';
        uniqueTahun.forEach(thn => {
            const opt = document.createElement('option');
            opt.value = thn;
            opt.textContent = thn;
            tahunSelect.appendChild(opt);
        });
        
        if(uniqueTahun.length > 0) tahunSelect.value = uniqueTahun[0];
        else tahunSelect.value = "ALL";
    }

    function applyFilters() {
        const selectedCabang = document.getElementById('filterCabang').value;
        const selectedTahun = document.getElementById('filterTahun').value;

        filteredData = rawData.filter(item => {
            const matchCabang = (selectedCabang === 'ALL') || (item.Cabang === selectedCabang);
            const itemYear = getYearFromDate(item.Awal_SPK) || getYearFromDate(item.tanggal_opname_final);
            const matchTahun = (selectedTahun === 'ALL') || (itemYear == selectedTahun);
            return matchCabang && matchTahun;
        });

        renderKPI(filteredData);
    }

    const btnFilter = document.getElementById('btnApplyFilter');
    if(btnFilter) {
        btnFilter.addEventListener('click', (e) => {
            e.preventDefault();
            applyFilters();
        });
    }

    // ==========================================
    // 6. RENDER KPI CARDS
    // ==========================================
    function renderKPI(data) {
        let totalProyek = data.length;
        let totalSPK = 0;
        let totalJHK = 0;
        let totalKeterlambatan = 0;
        let totalDenda = 0;
        let totalOpname = 0;
        let totalLuasTerbangun = 0;

        data.forEach(item => {
            totalSPK += parseCurrency(item["Nominal SPK"]);
            
            const durasiSpk = parseFloat(item["Durasi SPK"]) || 0;
            const tambahSpk = parseFloat(item["tambah_spk"]) || 0;
            const keterlambatan = parseFloat(item["Keterlambatan"]) || 0;
            
            totalJHK += (durasiSpk + tambahSpk + keterlambatan);
            totalKeterlambatan += keterlambatan;
            totalDenda += parseCurrency(item["Denda"]);
            
            totalOpname += parseCurrency(item["Grand Total Opname Final"]);
            totalLuasTerbangun += parseFloat(item["Luas Terbangunan"]) || 0;
        });

        const avgKeterlambatan = totalProyek > 0 ? Math.round(totalKeterlambatan / totalProyek) : 0;
        const avgCostM2 = totalLuasTerbangun > 0 ? (totalOpname / totalLuasTerbangun) : 0;

        const animDuration = 1500; 
        
        animateValue("card-total-proyek", 0, totalProyek, animDuration);
        animateValue("card-total-spk", 0, totalSPK, animDuration, formatRupiah);
        animateValue("card-jhk", 0, totalJHK, animDuration, (val) => val + " Hari");
        animateValue("card-avg-keterlambatan", 0, avgKeterlambatan, animDuration, (val) => val + " Hari");
        animateValue("card-total-denda", 0, totalDenda, animDuration, formatRupiah);
        animateValue("card-avg-cost-m2", 0, avgCostM2, animDuration, formatRupiah);
    }

    initDashboard();
});