document.addEventListener('DOMContentLoaded', () => {
    const userRole = sessionStorage.getItem('userRole'); 
    if (!userRole) {
        alert("Anda harus login terlebih dahulu!");
        window.location.href = 'https://sparta-alfamart.vercel.app';
        return;
    }
    const roleConfig = {
        'BRANCH BUILDING & MAINTENANCE MANAGER': [
            'menu-spk', 'menu-pengawasan', 'menu-opname', 'menu-tambahspk'
        ],
        'BRANCH BUILDING COORDINATOR': [
            'menu-dokumentasi', 'menu-pengawasan', 'menu-svdokumen'
        ],
        'BRANCH BUILDING SUPPORT': [
            'menu-pengawasan', 'menu-dokumentasi', 'menu-opname', 'menu-gantt', 'menu-svdokumen'
        ]
    };
    const allowedMenus = roleConfig[userRole] || [];
    const allMenuItems = document.querySelectorAll('.menu-item');

    allMenuItems.forEach(item => {
        if (allowedMenus.includes(item.id)) {
            item.style.display = 'block'; 
        } else {
            item.style.display = 'none';
        }
    });
    const logoutBtn = document.getElementById('logout-button-form');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.clear();
            window.location.href = 'https://sparta-alfamart.vercel.app';
        });
    }
});