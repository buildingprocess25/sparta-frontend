document.addEventListener('DOMContentLoaded', () => {
    // Referensi Elemen DOM
    const docTypeSelect = document.getElementById('docTypeSelect');
    const cabangSelect = document.getElementById('cabangSelect');
    const ulokSelect = document.getElementById('ulokSelect');
    const lingkupSelect = document.getElementById('lingkupSelect');
    const resendForm = document.getElementById('resendForm');

    // Gunakan Base URL dari server Render Anda
    const BASE_URL = 'https://send-email-app.onrender.com';

    /**
     * Utility Fetch Data dengan Error Handling
     */
    async function fetchData(endpoint) {
        try {
            const response = await fetch(`${BASE_URL}${endpoint}`);
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`Gagal mengambil data dari ${endpoint}:`, error);
            return null; // Return null agar UI bisa tahu terjadi kegagalan
        }
    }

    function populateSelect(selectEl, responseData, placeholderText) {
        // 1. Reset isi dropdown
        selectEl.innerHTML = `<option value="" disabled selected>${placeholderText}</option>`;
        
        // 2. Ekstrak Array dari response API
        let dataArray = [];
        if (responseData && Array.isArray(responseData.data)) {
            // Tangkap array dari dalam object wrapper { data: [...] }
            dataArray = responseData.data; 
        } else if (Array.isArray(responseData)) {
            // Fallback jika response langsung berupa array [...]
            dataArray = responseData;
        }

        // 3. Validasi isi data
        if (dataArray.length === 0) {
            selectEl.innerHTML = `<option value="" disabled selected>Data tidak tersedia</option>`;
            selectEl.disabled = true;
            return;
        }

        // 4. Render ke DOM
        dataArray.forEach(item => {
            // Evaluasi apakah item berupa Object atau String murni ("ACEH", "BALARAJA")
            const isObject = typeof item === 'object' && item !== null;
            
            // Karena payload Cabang berupa array string, 'val' dan 'label' akan langsung memakai 'item'
            // Logika fallback isObject tetap dipertahankan jaga-jaga endpoint Ulok/Lingkup mereturn Object
            const val = isObject ? (item.id || item.ulok || item.kode || item.nama) : item; 
            const label = isObject ? (item.nama || item.name || item.id || item.lingkup) : item;

            const optionEl = document.createElement('option');
            optionEl.value = val;
            optionEl.textContent = label;
            selectEl.appendChild(optionEl);
        });

        // Enable dropdown setelah selesai render
        selectEl.disabled = false;
    }

    /**
     * 1. INIT: Load Master Cabang saat halaman dibuka
     */
    async function initCabang() {
        cabangSelect.innerHTML = `<option value="" disabled selected>Memuat cabang...</option>`;
        const dataCabang = await fetchData('/api/cabang-list');
        
        if (dataCabang) {
            populateSelect(cabangSelect, dataCabang, 'Pilih Cabang');
        } else {
            cabangSelect.innerHTML = `<option value="" disabled selected>Gagal memuat cabang</option>`;
        }
    }
    
    // Jalankan init
    initCabang();

    /**
     * 2. EVENT LISTENER: Cabang berubah -> Fetch Ulok
     */
    cabangSelect.addEventListener('change', async (e) => {
        const selectedCabang = e.target.value;
        
        // Reset state child dropdowns (Penting untuk mencegah stale data)
        ulokSelect.innerHTML = `<option value="" disabled selected>Memuat ulok...</option>`;
        ulokSelect.disabled = true;
        lingkupSelect.innerHTML = `<option value="" disabled selected>Pilih Ulok terlebih dahulu</option>`;
        lingkupSelect.disabled = true;

        if (!selectedCabang) return;

        const dataUlok = await fetchData(`/api/ulok-by-cabang?cabang=${encodeURIComponent(selectedCabang)}`);
        populateSelect(ulokSelect, dataUlok, 'Pilih Nomor Ulok');
    });

    /**
     * 3. EVENT LISTENER: Ulok berubah -> Fetch Lingkup Pekerjaan
     */
    ulokSelect.addEventListener('change', async (e) => {
        const selectedUlok = e.target.value;

        // Reset child dropdown
        lingkupSelect.innerHTML = `<option value="" disabled selected>Memuat lingkup...</option>`;
        lingkupSelect.disabled = true;

        if (!selectedUlok) return;

        const dataLingkup = await fetchData(`/api/lingkup-by-ulok?ulok=${encodeURIComponent(selectedUlok)}`);
        populateSelect(lingkupSelect, dataLingkup, 'Pilih Lingkup Pekerjaan');
    });

    /**
     * 4. SUBMIT HANDLER
     */
    resendForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const docType = docTypeSelect.value;
        const ulok = ulokSelect.value;
        const lingkup = lingkupSelect.value;
        const cabang = cabangSelect.value;

        // Proteksi layer ganda, pastikan tidak submit string kosong
        if (!ulok || !lingkup || !cabang) {
            alert('Harap lengkapi Cabang, Ulok, dan Lingkup Pekerjaan.');
            return;
        }

        const submitBtn = document.getElementById('submitBtn');
        const btnText = document.getElementById('btnText');
        const btnSpinner = document.getElementById('btnSpinner');
        const alertBox = document.getElementById('alertBox');

        const API_URL = docType === 'spk'
            ? `${BASE_URL}/api/resend-email-spk`
            : `${BASE_URL}/api/resend-email`;

        // UI State: Loading
        submitBtn.disabled = true;
        btnText.textContent = 'Memproses...';
        btnSpinner.classList.remove('d-none');
        alertBox.style.display = 'none';
        alertBox.className = 'alert mt-4 mb-0 shadow-sm'; 

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ulok: ulok, lingkup: lingkup, cabangInput: cabang})
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
            alertBox.innerHTML = `<i class="fa-solid fa-circle-xmark me-2"></i> Gagal terhubung ke server. Pastikan API berjalan.`;
        } finally {
            // UI State: Reset
            submitBtn.disabled = false;
            btnText.textContent = 'Kirim Ulang Email';
            btnSpinner.classList.add('d-none');
            alertBox.style.display = 'block';
        }
    });
});