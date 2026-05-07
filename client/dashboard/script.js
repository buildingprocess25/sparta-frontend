document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. GLOBAL VARIABLES & AUTH & ROLE
    // ==========================================
    const userRole = sessionStorage.getItem('userRole') || ''; 
    const userCabang = sessionStorage.getItem('loggedInUserCabang') || ''; 
    const isHO = userCabang.toUpperCase() === 'HEAD OFFICE'; 
    const currentRole = userRole.toUpperCase();
    const isContractor = currentRole === 'KONTRAKTOR';
    
    if (!userRole) {
        alert("Sesi Anda telah habis. Silakan login kembali.");
        window.location.replace('https://sparta-alfamart.vercel.app');
        return;
    }

    // ==========================================
    // 2. RENDER MENU CARDS
    // ==========================================
    const MENU_CATALOG = {
        'menu-rab': { 
            href: '../../rab/', 
            title: 'RAB Kontraktor', 
            desc: 'Penawaran Final Kontraktor',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`
        },
        'menu-materai': { 
            href: '../../materai/', 
            title: 'Dokumen SPH', 
            desc: 'Dokumen SPH RAB',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`
        },
        'menu-spk': { 
            href: '../../spk/', 
            title: 'SPK', 
            desc: 'Surat Perintah Kerja',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg>`
        },
        'menu-pengawasan': { 
            href: '../../inputpic/', 
            title: 'PIC Pengawasan', 
            desc: 'Input PIC Pekerjaan',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-3-3.87"></path><path d="M9 21v-2a4 4 0 0 1 3-3.87"></path><circle cx="12" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M1 21v-2a4 4 0 0 1 3-3.87"></path></svg>`
        },
        'menu-opname': { 
            href: '../../opname/', 
            title: 'Opname', 
            desc: 'Form Opname Pekerjaan',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M9 14l2 2 4-4"></path></svg>`
        },
        'menu-dokumentasi': { 
            href: '../../ftdokumen/', 
            title: 'Dokumentasi', 
            desc: 'Foto Bangunan Toko Baru',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`
        },
        'menu-tambahspk': { 
            href: '../../tambahspk/', 
            title: 'Pertambahan SPK', 
            desc: 'Form Pertambahan Hari SPK',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><line x1="12" y1="14" x2="12" y2="18"></line><line x1="10" y1="16" x2="14" y2="16"></line></svg>`
        },
        'menu-svdokumen': { 
            href: '../../svdokumen/', 
            title: 'Penyimpanan Dokumen', 
            desc: 'Penyimpanan Dokumen Toko',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>`
        },
        'menu-gantt': { 
            href: '../../gantt/', 
            title: 'Gantt Chart', 
            desc: 'Progress Pekerjaan',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`
        },
        'menu-userlog': { 
            href: '../../userlog/', 
            title: 'User Log', 
            desc: 'Pengguna Aplikasi',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
        },
        'menu-resend': { 
            href: '../../resend/', 
            title: 'Resend Email', 
            desc: 'Kirim Ulang Email Persetujuan',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`
        },
        'menu-sp': { 
            href: '../../dashboard/', 
            title: 'Surat Peringatan', 
            desc: 'Form Surat Peringatan', 
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
            onClick: (e) => { e.preventDefault(); alert('Fitur dalam pengembangan.'); } 
        },
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

    // Special case for Batam Coordinator
    if (currentRole === 'BRANCH BUILDING COORDINATOR' && userCabang.toUpperCase() === 'BATAM') {
        ['menu-spk', 'menu-pengawasan', 'menu-tambahspk'].forEach(menuId => {
            if (!allowedMenuIds.includes(menuId)) allowedMenuIds.push(menuId);
        });
    }

    const menuContainer = document.getElementById('menu-container');
    if (menuContainer) {
        menuContainer.innerHTML = ''; 
        allowedMenuIds.forEach(id => {
            const menuData = MENU_CATALOG[id];
            if (!menuData) return; 
            
            const cardEl = document.createElement('a');
            cardEl.href = menuData.href;
            cardEl.className = 'menu-card';
            if (menuData.onClick) cardEl.addEventListener('click', menuData.onClick);
            
            cardEl.innerHTML = `
                <div class="menu-icon-wrapper">
                    ${menuData.icon}
                </div>
                <div class="menu-text">
                    <h3>${menuData.title}</h3>
                    <p>${menuData.desc}</p>
                </div>
                <div class="menu-card-arrow">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </div>
            `;
            menuContainer.appendChild(cardEl);
        });
    }

    // ==========================================
    // 3. LOGOUT LOGIC
    // ==========================================
    document.getElementById('logout-button-form')?.addEventListener('click', (e) => {
        e.preventDefault(); 
        if(confirm("Apakah Anda yakin ingin keluar?")) {
            sessionStorage.clear(); 
            window.location.replace('https://sparta-alfamart.vercel.app');
        }
    });
});