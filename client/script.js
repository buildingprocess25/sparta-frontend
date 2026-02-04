document.addEventListener('DOMContentLoaded', () => {
    const dashboardLink = document.querySelector('a[href="/auth/index.html"]');
    if (!dashboardLink) return;
    dashboardLink.addEventListener('click', (e) => {
        e.preventDefault();
        const now = new Date();
        const day = now.getDay();   // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
        const hour = now.getHours(); // 0 - 23

        // --- Konfigurasi Jadwal ---
        // Senin (1) s/d Jumat (5)
        const isWeekday = day >= 1 && day <= 5;
        // Jam 06:00 s/d 17:59 (Tutup tepat jam 18:00)
        const isWorkingHours = hour >= 6 && hour < 18;
        // --- Validasi ---
        if (isWeekday && isWorkingHours) {
            // Jika valid, lanjutkan navigasi secara manual
            window.location.href = dashboardLink.href;
        } else {
            // Jika tidak valid, tampilkan peringatan
            alert('⚠️ AKSES DITOLAK\n\nSistem SPARTA hanya dapat diakses pada:\nHari: Senin - Jumat\nPukul: 06.00 - 18.00 WIB');
        }
    });
});