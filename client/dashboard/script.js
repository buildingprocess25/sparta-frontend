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
    // Jangan masukkan menu khusus HO (userlog/sp) di sini.
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
    // Kita gunakan [...array] untuk menyalin data agar roleConfig asli tidak berubah
    let allowedMenus = roleConfig[currentRole] ? [...roleConfig[currentRole]] : [];

    // Langkah B: Cek apakah user dari HEAD OFFICE
    const isHeadOffice = userCabang && userCabang.toUpperCase() === 'HEAD OFFICE';

    if (isHeadOffice) {
        console.log("User HEAD OFFICE terdeteksi. Menambahkan menu khusus.");
        
        // Langkah C: TAMBAHKAN menu khusus HO ke dalam daftar menu Role yang sudah ada.
        // Dengan cara ini, batasan Role tetap berlaku, tapi mereka dapat fitur tambahan.
        allowedMenus.push('menu-userlog');
        allowedMenus.push('menu-sp');
        
        // Catatan: Jika Anda ingin menu tertentu (misal SPK) bisa dilihat 
        // oleh SEMUA orang Head Office (meskipun role aslinya gak punya), 
        // Anda bisa menambahkannya manual di sini:
        // allowedMenus.push('menu-spk'); 
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
        // Cek apakah ID menu ada di dalam daftar allowedMenus
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