document.addEventListener('DOMContentLoaded', () => {
    // 1. Ambil Role DAN Cabang dari Session
    const userRole = sessionStorage.getItem('userRole'); 
    const userCabang = sessionStorage.getItem('loggedInUserCabang'); 
    
    // 2. Security Check
    if (!userRole) {
        alert("Sesi Anda telah habis. Silakan login kembali.");
        window.location.href = 'https://sparta-alfamart.vercel.app';
        return;
    }

    // 3. Konfigurasi Role (HANYA MENU STANDAR/UMUM)
    const roleConfig = {
        'BRANCH BUILDING & MAINTENANCE MANAGER': [
            'menu-spk', 'menu-pengawasan', 'menu-opname', 
            'menu-tambahspk', 'menu-gantt', 'menu-dokumentasi', 
            'menu-svdokumen'
        ],
        'BRANCH BUILDING COORDINATOR': [
            'menu-dokumentasi', 'menu-svdokumen','menu-gantt', 'menu-opname'
        ],
        'BRANCH BUILDING SUPPORT': [
            'menu-dokumentasi', 'menu-opname', 'menu-gantt', 'menu-svdokumen'
        ],
        'KONTRAKTOR': [
            'menu-rab', 'menu-materai', 'menu-opname', 'menu-gantt'
        ]
    };

    // 4. Logika Filter Menu
    const currentRole = userRole.toUpperCase(); 
    
    // Langkah A: Ambil menu dasar sesuai Role pengguna
    let allowedMenus = roleConfig[currentRole] ? [...roleConfig[currentRole]] : [];

    // Langkah B: Logika Khusus HEAD OFFICE (Dengan Pengecualian Kontraktor)
    const isHeadOffice = userCabang && userCabang.toUpperCase() === 'HEAD OFFICE';
    const isContractor = currentRole === 'KONTRAKTOR';

    // ATURAN: Hanya Staff Internal HO yang dapat menu tambahan. 
    // Kontraktor (meskipun HO) TIDAK boleh melihat User Log / SP.
    if (isHeadOffice && !isContractor) {
        console.log("User HEAD OFFICE (Internal) terdeteksi. Menambahkan menu khusus.");
        
        allowedMenus.push('menu-userlog');
    } 

    // Debugging
    console.log(`Role: ${currentRole}, Cabang: ${userCabang}`);
    console.log(`Menu yang ditampilkan:`, allowedMenus);

    if (allowedMenus.length === 0) {
        console.warn(`User Role "${currentRole}" tidak dikenali atau tidak memiliki akses menu.`);
    }

    // 5. Render Tampilan Menu
    const allMenuItems = document.querySelectorAll('.menu-item');
    allMenuItems.forEach(item => {
        if (allowedMenus.includes(item.id)) {
            item.style.display = 'block'; 
        } else {
            item.style.display = 'none';
        }
    });

    // 6. Fitur Logout
    const logoutBtn = document.getElementById('logout-button-form');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            if(confirm("Apakah Anda yakin ingin keluar?")) {
                sessionStorage.clear(); 
                window.location.href = 'https://sparta-alfamart.vercel.app';
            }
        });
    }
});