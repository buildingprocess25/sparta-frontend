document.addEventListener('DOMContentLoaded', () => {
    const docTypeSelect = document.getElementById('docTypeSelect');
    const lingkupSelect = document.getElementById('lingkupSelect');
    const resendForm = document.getElementById('resendForm');

    // Daftar master lingkup pekerjaan. Bisa diekspansi sesuai kebutuhan SPARTA.
    const lingkupOptions = {
        rab: ['Renovasi Sipil', 'Sipil', 'MEP', 'Sipil & MEP'],
        spk: ['Sipil', 'Renovasi Sipil', 'MEP', 'Sipil & MEP']
    };

    /**
     * Populate dropdown lingkup pekerjaan berdasarkan doc type.
     * Mencegah hardcode HTML dan memastikan validitas data.
     */
    function populateLingkup(docType) {
        // Reset opsi
        lingkupSelect.innerHTML = '<option value="" disabled selected>Pilih Lingkup Pekerjaan</option>';
        
        const options = lingkupOptions[docType] || [];
        options.forEach(item => {
            const optionEl = document.createElement('option');
            optionEl.value = item;
            optionEl.textContent = item;
            lingkupSelect.appendChild(optionEl);
        });
    }

    // 1. Inisialisasi awal saat load
    populateLingkup(docTypeSelect.value);

    // 2. Listener jika user mengganti RAB / SPK
    docTypeSelect.addEventListener('change', (e) => {
        populateLingkup(e.target.value);
    });

    // 3. Submit Handler
    resendForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        // Ambil nilai
        const ulok = document.getElementById('ulokInput').value.trim();
        const lingkup = lingkupSelect.value;
        const docType = docTypeSelect.value;

        // Validasi ekstra (karena disabled select value bisa bernilai string kosong)
        if (!lingkup) {
            alert('Silakan pilih lingkup pekerjaan terlebih dahulu.');
            return;
        }

        const submitBtn = document.getElementById('submitBtn');
        const btnText = document.getElementById('btnText');
        const btnSpinner = document.getElementById('btnSpinner');
        const alertBox = document.getElementById('alertBox');

        // Dynamic API routing
        const API_URL = docType === 'spk'
            ? 'https://send-email-app.onrender.com/api/resend-email-spk'
            : 'https://send-email-app.onrender.com/api/resend-email';

        // State: Loading
        submitBtn.disabled = true;
        btnText.textContent = 'Memproses...';
        btnSpinner.classList.remove('d-none');
        alertBox.style.display = 'none';
        alertBox.className = 'alert mt-4 mb-0 shadow-sm'; 

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ulok: ulok, lingkup: lingkup })
            });

            const result = await response.json();

            if (response.ok) {
                alertBox.classList.add('alert-success', 'border-success');
                alertBox.innerHTML = `<i class="fa-solid fa-circle-check me-2"></i> ${result.message} <br> <small class="mt-1 d-block">Terkirim ke: <strong>${result.recipient}</strong> (${result.role})</small>`;
            } else {
                alertBox.classList.add('alert-warning', 'border-warning');
                alertBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation me-2"></i> ${result.error || result.message || 'Terjadi kesalahan.'}`;
            }

        } catch (error) {
            console.error('Fetch error:', error);
            alertBox.classList.add('alert-danger', 'border-danger');
            alertBox.innerHTML = `<i class="fa-solid fa-circle-xmark me-2"></i> Gagal terhubung ke server Render. Pastikan API berjalan.`;
        } finally {
            // State: Restore
            submitBtn.disabled = false;
            btnText.textContent = 'Kirim Ulang Email';
            btnSpinner.classList.add('d-none');
            alertBox.style.display = 'block';
        }
    });
});