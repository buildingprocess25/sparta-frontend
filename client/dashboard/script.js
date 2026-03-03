document.addEventListener('DOMContentLoaded', () => {
    // 1. Ambil Role DAN Cabang dari Session
    const userRole = sessionStorage.getItem('userRole'); 
    const userCabang = sessionStorage.getItem('loggedInUserCabang'); 
    
    // 2. Security Check & Redirect
    if (!userRole) {
        alert("Sesi Anda telah habis. Silakan login kembali.");
        window.location.replace('https://sparta-alfamart.vercel.app');
        return;
    }

    // 3. Centralized Menu Catalog (Single Source of Truth)
    const MENU_CATALOG = {
        'menu-rab': { href: '../../rab/', title: 'Penawaran Final Kontraktor', desc: 'Buat penawaran final.' },
        'menu-materai': { href: '../../materai/', title: 'Dokumen Final RAB Termaterai', desc: 'Buat dan lihat RAB Final Termaterai.' },
        'menu-spk': { href: '../../spk/', title: 'Surat Perintah Kerja', desc: 'Form surat perintah kerja untuk kontraktor.' },
        'menu-pengawasan': { href: '../../inputpic/', title: 'PIC Pengawasan', desc: 'Form input pic pengawasan pekerjaan proyek.' },
        'menu-opname': { href: '../../opname/', title: 'Opname', desc: 'Form opname proyek toko.' },
        'menu-dokumentasi': { href: '../../ftdokumen/', title: 'Dokumentasi Bangunan Toko Baru', desc: 'Form dokumentasi foto bangunan.' },
        'menu-tambahspk': { href: '../../tambahspk/', title: 'Tambahan Surat Perintah Kerja', desc: 'Form pertambahan hari surat perintah kerja.' },
        'menu-svdokumen': { href: '../../svdokumen/', title: 'Penyimpanan Dokumen Toko', desc: 'Form penyimpanan dokumen.' },
        'menu-gantt': { href: '../../gantt/', title: 'Gantt Chart', desc: 'Progress pekerjaan toko.' },
        'menu-sp': { 
            href: '../../dashboard/', 
            title: 'Surat Peringatan', 
            desc: 'Form surat peringatan.',
            // Inject custom logic khusus untuk menu ini
            onClick: (e) => { 
                e.preventDefault(); 
                alert('Fitur Surat Peringatan belum tersedia.'); 
            }
        },
        'menu-userlog': { href: '../../userlog/', title: 'User Log', desc: 'Log aktivitas pengguna.' },
        'menu-resend': { href: '../../resend/', title: 'Resend Email', desc: 'Resend email approval.' },
        'menu-monitoring': { href: '../../monitoring/', title: 'Monitoring', desc: 'Monitoring proyek toko.' }
    };

    // 4. Role-Based Access Control (RBAC) Config
    const roleConfig = {
        'BRANCH BUILDING & MAINTENANCE MANAGER': ['menu-spk', 'menu-pengawasan', 'menu-opname', 'menu-tambahspk', 'menu-gantt', 'menu-dokumentasi', 'menu-svdokumen'],
        'BRANCH BUILDING SUPPORT DOKUMENTASI' : ['menu-spk', 'menu-pengawasan', 'menu-opname', 'menu-tambahspk', 'menu-gantt', 'menu-dokumentasi', 'menu-svdokumen'],
        'BRANCH BUILDING COORDINATOR': ['menu-dokumentasi', 'menu-svdokumen','menu-gantt', 'menu-opname'],
        'BRANCH BUILDING SUPPORT': ['menu-dokumentasi', 'menu-opname', 'menu-gantt', 'menu-svdokumen'],
        'KONTRAKTOR': ['menu-rab', 'menu-materai', 'menu-opname', 'menu-gantt']
    };

    const currentRole = userRole.toUpperCase();
    const isHeadOffice = userCabang && userCabang.toUpperCase() === 'HEAD OFFICE';
    const isContractor = currentRole === 'KONTRAKTOR';

    // Set allowed menus
    let allowedMenuIds = roleConfig[currentRole] ? [...roleConfig[currentRole]] : [];

    // Aturan Head Office
    if (isHeadOffice && !isContractor) {
        allowedMenuIds.push('menu-userlog', 'menu-resend', 'menu-monitoring', 'menu-sp');
    } 

    if (allowedMenuIds.length === 0) {
        console.warn(`User Role "${currentRole}" tidak dikenali atau tidak memiliki akses menu.`);
    }

    // 5. Dynamic Rendering Engine
    const menuContainer = document.getElementById('menu-container');
    
    // Pastikan container bersih sebelum dirender ulang
    menuContainer.innerHTML = ''; 

    // Eksekusi render hanya untuk menu yang diizinkan
    allowedMenuIds.forEach(id => {
        const menuData = MENU_CATALOG[id];
        
        // Error handling jika ada ID di roleConfig tapi tidak ada di MENU_CATALOG
        if (!menuData) {
            console.error(`Missing metadata for menu ID: ${id}`);
            return; 
        }

        // Buat elemen <a>
        const linkEl = document.createElement('a');
        linkEl.href = menuData.href;
        linkEl.className = 'menu-item';
        linkEl.id = id;

        // Pasang event listener khusus jika ada di metadata (contoh: menu-sp)
        if (typeof menuData.onClick === 'function') {
            linkEl.addEventListener('click', menuData.onClick);
        }

        // Inject HTML inner content
        linkEl.innerHTML = `
            <h3>${menuData.title}</h3>
            <p>${menuData.desc}</p>
        `;

        // Masukkan elemen ke dalam DOM
        menuContainer.appendChild(linkEl);
    });

    // 6. Fitur Logout
    const logoutBtn = document.getElementById('logout-button-form');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            if(confirm("Apakah Anda yakin ingin keluar?")) {
                sessionStorage.clear(); 
                window.location.replace('https://sparta-alfamart.vercel.app');
            }
        });
    }
});