document.addEventListener('DOMContentLoaded', () => {
    const userRole = sessionStorage.getItem('userRole'); 
    const userCabang = sessionStorage.getItem('loggedInUserCabang'); 
    
    if (!userRole) {
        alert("Sesi Anda telah habis. Silakan login kembali.");
        window.location.replace('https://sparta-alfamart.vercel.app'); // Gunakan replace agar user tidak bisa 'back' ke halaman ini
        return;
    }

    const roleConfig = {
        'BRANCH BUILDING & MAINTENANCE MANAGER': ['menu-spk', 'menu-pengawasan', 'menu-opname', 'menu-tambahspk', 'menu-gantt', 'menu-dokumentasi', 'menu-svdokumen', 'menu-sp'],
        'BRANCH BUILDING SUPPORT DOKUMENTASI' : ['menu-spk', 'menu-pengawasan', 'menu-opname', 'menu-tambahspk', 'menu-gantt', 'menu-dokumentasi', 'menu-svdokumen', 'menu-sp'],
        'BRANCH BUILDING COORDINATOR': ['menu-dokumentasi', 'menu-svdokumen','menu-gantt', 'menu-opname', 'menu-sp'],
        'BRANCH BUILDING SUPPORT': ['menu-dokumentasi', 'menu-opname', 'menu-gantt', 'menu-svdokumen', 'menu-sp'],
        'KONTRAKTOR': ['menu-rab', 'menu-materai', 'menu-opname', 'menu-gantt']
    };

    const currentRole = userRole.toUpperCase(); 
    let allowedMenus = roleConfig[currentRole] ? [...roleConfig[currentRole]] : [];

    const isHeadOffice = userCabang && userCabang.toUpperCase() === 'HEAD OFFICE';
    if (isHeadOffice && currentRole !== 'KONTRAKTOR') {
        allowedMenus.push('menu-userlog', 'menu-resend', 'menu-monitoring');
    } 

    // Perbaikan DOM Manipulation: Hapus node yang tidak diizinkan dari DOM
    const allMenuItems = document.querySelectorAll('.menu-item');
    allMenuItems.forEach(item => {
        if (allowedMenus.includes(item.id)) {
            item.style.display = 'block'; 
        } else {
            item.remove(); // SECURE: Hapus elemen fisik dari DOM
        }
    });

    // Pindahkan inline onclick dari HTML ke JS
    const menuSp = document.getElementById('menu-sp');
    if (menuSp && allowedMenus.includes('menu-sp')) {
        menuSp.addEventListener('click', (e) => {
            e.preventDefault();
            alert('Fitur Surat Peringatan belum tersedia.');
        });
    }

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