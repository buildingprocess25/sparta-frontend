document.addEventListener('DOMContentLoaded', () => {
    // 1. Ambil Role dari Session
    const userRole = sessionStorage.getItem('userRole'); 
    
    // 2. Security Check: Jika tidak ada role, tendang ke login
    if (!userRole) {
        alert("Sesi Anda telah habis. Silakan login kembali.");
        // Pastikan URL ini benar mengarah ke halaman login Anda
        window.location.href = 'https://sparta-alfamart.vercel.app';
        return;
    }

    // 3. Konfigurasi Role (Sesuai 4 Role Anda)
    const roleConfig = {
        'BRANCH BUILDING & MAINTENANCE MANAGER': [
            'menu-spk', 'menu-pengawasan', 'menu-opname', 
            'menu-tambahspk', 'menu-gantt', 'menu-dokumentasi', 
            'menu-svdokumen', 'menu-sp' // <-- SAYA TAMBAHKAN INI AGAR MENU SP MUNCUL
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
    // Kita pastikan role yang diambil di-uppercase agar cocok dengan Key di atas
    const currentRole = userRole.toUpperCase(); 
    const allowedMenus = roleConfig[currentRole] || [];

    // Jika role tidak dikenali
    if (allowedMenus.length === 0) {
        console.warn(`Role "${currentRole}" tidak memiliki akses menu atau tidak dikenali.`);
    }

    // Loop semua item menu
    const allMenuItems = document.querySelectorAll('.menu-item');
    allMenuItems.forEach(item => {
        if (allowedMenus.includes(item.id)) {
            item.style.display = 'block'; 
        } else {
            item.style.display = 'none';
        }
    });

    // 5. Fitur Logout
    const logoutBtn = document.getElementById('logout-button-form');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Mencegah reload default jika ada
            if(confirm("Apakah Anda yakin ingin keluar?")) {
                sessionStorage.clear();
                window.location.href = 'https://sparta-alfamart.vercel.app';
            }
        });
    }
});