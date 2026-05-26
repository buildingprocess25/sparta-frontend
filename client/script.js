document.addEventListener('DOMContentLoaded', () => {
    const dashboardLink = document.querySelector('a[href="/auth/index.html"]');
    if (!dashboardLink) return;
    dashboardLink.addEventListener('click', (e) => {
        e.preventDefault();
        const now = new Date();
        const wibParts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Jakarta',
            weekday: 'short',
            hour: '2-digit',
            hour12: false,
        }).formatToParts(now);
        const weekday = wibParts.find((part) => part.type === 'weekday')?.value;
        const hour = parseInt(wibParts.find((part) => part.type === 'hour')?.value || '0', 10);

        // --- Konfigurasi Jadwal ---
        // Senin (1) s/d Jumat (5)
        const isWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday);
        // Jam 06:00 s/d 23:59 WIB (Tutup tepat jam 24:00)
        const isWorkingHours = hour >= 6 && hour < 24;
        // --- Validasi ---
        if (isWeekday && isWorkingHours) {
            // Jika valid, lanjutkan navigasi secara manual
            window.location.href = dashboardLink.href;
        } else {
            // Jika tidak valid, tampilkan peringatan
            alert('⚠️ AKSES DITOLAK\n\nSistem SPARTA hanya dapat diakses pada:\nHari: Senin - Jumat\nPukul: 06.00 - 24.00 WIB');
        }
    });
});
