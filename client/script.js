document.addEventListener('DOMContentLoaded', () => {
    // 1. Ambil elemen-elemen penting
    const dashboardLink = document.querySelector('a[href="/auth/index.html"]');
    const modalOverlay = document.getElementById('access-modal-overlay');
    const closeModalBtn = document.getElementById('close-modal-btn');

    // Pastikan elemen yang dibutuhkan ada agar tidak error
    if (!dashboardLink || !modalOverlay || !closeModalBtn) {
        console.error("Access Guard: Elemen penting tidak ditemukan di HTML.");
        return;
    }

    // --- Fungsi Helper untuk Modal ---
    const showModal = () => {
        modalOverlay.classList.remove('hidden');
    };

    const hideModal = () => {
        modalOverlay.classList.add('hidden');
    };


    // 2. Event Listener untuk Link Dashboard
    dashboardLink.addEventListener('click', (e) => {
        e.preventDefault(); // Selalu cegah default dulu

        const now = new Date();
        const day = now.getDay();   // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
        const hour = now.getHours(); // 0 - 23

        // --- Konfigurasi Jadwal ---
        const isWeekday = day >= 1 && day <= 5; // Senin (1) - Jumat (5)
        const isWorkingHours = hour >= 6 && hour < 18; // 06:00 - 17:59

        // --- Validasi ---
        if (isWeekday && isWorkingHours) {
            // Valid: Lanjutkan navigasi
            window.location.href = dashboardLink.href;
        } else {
            // Tidak Valid: Tampilkan Modal Kustom (Bukan alert biasa)
            showModal();
        }
    });


    // 3. Event Listeners untuk Menutup Modal
    // Tutup saat tombol 'Tutup' diklik
    closeModalBtn.addEventListener('click', hideModal);

    // Tutup saat area gelap di luar kotak modal diklik (Opsional, untuk UX yang lebih baik)
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            hideModal();
        }
    });

    // Tutup saat tombol Escape ditekan di keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
            hideModal();
        }
    });
});