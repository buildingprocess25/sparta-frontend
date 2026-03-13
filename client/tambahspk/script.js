const API_PROXY_URL = "https://pengawasan-tambahspk.onrender.com/api/form";
// Arahkan ke halaman login baru di folder auth
const LOGIN_PAGE_URL = "../auth/index.html"; 

let currentUser = null;
let ulokData = [];
let originalEndDateISO = '';
let newEndDateISO = '';

const ulokSelect = document.getElementById('nomor_ulok');
const pertambahanHariInput = document.getElementById('pertambahan_hari');
const tglSpkAkhirInput = document.getElementById('tanggal_spk_akhir');
const tglSpkAkhirBaruInput = document.getElementById('tanggal_spk_akhir_baru');
const logoutBtn = document.getElementById('logoutBtn');

// --- MODIFIKASI 1: Tombol Logout jadi Tombol Back ---
if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
        // Langsung kembali ke dashboard tanpa menghapus sesi
        window.location.href = "../dashboard/index.html";
    });
}

function formatDisplayDate(dateObj) {
    if (!dateObj) return "";
    return dateObj.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function formatISODate(dateObj) {
    if (!dateObj) return "";
    const offset = dateObj.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(dateObj.getTime() - offset);
    return adjustedDate.toISOString().split('T')[0];
}

function parseISODate(dateString) {
    if (!dateString) return null;
    return new Date(dateString + 'T00:00:00');
}

function updateDates() {
    const selectedUlok = ulokSelect.value;
    const daysToAdd = parseInt(pertambahanHariInput.value, 10);

    tglSpkAkhirInput.value = '';
    tglSpkAkhirBaruInput.value = '';
    originalEndDateISO = '';
    newEndDateISO = '';

    const spkInfo = ulokData.find(item => item.ulok === selectedUlok);

    if (spkInfo && spkInfo.waktuSelesai) {
        const originalEndDate = parseISODate(spkInfo.waktuSelesai);

        if (originalEndDate) {
            tglSpkAkhirInput.value = formatDisplayDate(originalEndDate);
            originalEndDateISO = formatISODate(originalEndDate);

            if (!isNaN(daysToAdd) && daysToAdd > 0) {
                const newEndDate = new Date(originalEndDate.getTime());
                newEndDate.setDate(newEndDate.getDate() + daysToAdd);

                tglSpkAkhirBaruInput.value = formatDisplayDate(newEndDate);
                newEndDateISO = formatISODate(newEndDate);
            }
        }
    }
}

async function populateUlokDropdown(cabang) {
    ulokSelect.disabled = true;

    try {
        const fetchUrl = `${API_PROXY_URL}?form=perpanjangan_spk&action=getUlokByCabang&cabang=${encodeURIComponent(cabang)}`;
        const response = await fetch(fetchUrl);
        const result = await response.json();

        if (result.status === "success" && result.data && result.data.length > 0) {
            ulokSelect.innerHTML = '';
            const defaultOption = document.createElement('option');
            defaultOption.value = "";
            defaultOption.textContent = "Pilih Nomor Ulok...";
            defaultOption.disabled = true;
            defaultOption.selected = true;
            ulokSelect.appendChild(defaultOption);

            ulokData = result.data;

            ulokData.forEach(item => {
                if (item && item.ulok) {
                    const option = document.createElement('option');
                    option.value = item.ulok;
                    option.textContent = item.ulok;
                    ulokSelect.appendChild(option);
                }
            });
            ulokSelect.disabled = false;
        } else {
            ulokSelect.innerHTML = `<option value="" disabled selected>Tidak ada data Ulok untuk cabang ini</option>`;
        }
    } catch (error) {
        console.error("Gagal memuat Nomor Ulok:", error);
        ulokSelect.innerHTML = `<option value="" disabled selected>Gagal memuat data</option>`;
    }
}

document.addEventListener("DOMContentLoaded", function() {
    (function checkAuth() {
        const isAuthenticated = sessionStorage.getItem("authenticated");
        const userCabang = sessionStorage.getItem("loggedInUserCabang");
        const userEmail = sessionStorage.getItem("loggedInUserEmail");

        if (isAuthenticated !== "true" || !userCabang) {
            alert("Sesi tidak valid atau telah berakhir. Silakan login kembali.");
            window.location.href = LOGIN_PAGE_URL;
            return;
        }
        currentUser = {
            cabang: userCabang,
            email: userEmail,
            nama: userEmail ? userEmail.split('@')[0] : "User"
        };
        
        populateUlokDropdown(currentUser.cabang);
    })();

    const alasanContainer = document.getElementById("alasan-container");
    const tambahAlasanBtn = document.getElementById("tambah-alasan-btn");
    const hiddenTextarea = document.getElementById("alasan_spk_hidden");
    const form = document.getElementById("pertambahan-spk-form");
    const submitBtn = document.getElementById('submit-btn');
    const btnText = document.getElementById('btn-text');
    const btnSpinner = document.getElementById('btn-spinner');

    const successModal = document.getElementById('success-modal');
    const modalMessage = document.getElementById('modal-message');
    const newReportBtn = document.getElementById('buat-laporan-baru-btn');

    ulokSelect.addEventListener('change', updateDates);
    pertambahanHariInput.addEventListener('input', updateDates);

    const createAlasanItem = () => {
        const div = document.createElement("div");
        div.className = "alasan-item";
        div.innerHTML = `
            <input type="text" placeholder="Tuliskan satu alasan di sini..." />
            <button type="button" class="remove-alasan-btn">&times;</button>
            `;
        alasanContainer.appendChild(div);
        div.querySelector("input").focus();
    };

    const updateHiddenTextarea = () => {
        const inputs = alasanContainer.querySelectorAll(".alasan-item input");
        const alasanArray = [];
        inputs.forEach((input) => {
            if (input.value.trim() !== "") {
                alasanArray.push(`- ${input.value.trim()}`);
            }
        });
        hiddenTextarea.value = alasanArray.join("\n");
    };

    createAlasanItem();

    tambahAlasanBtn.addEventListener("click", () => {
        const lastItem = alasanContainer.lastElementChild;
        if (lastItem) {
            const lastInput = lastItem.querySelector("input");
            if (lastInput.value.trim() === "") {
                alert("Harap isi alasan saat ini sebelum menambahkan yang baru.");
                lastInput.focus();
                return;
            }
            lastInput.readOnly = true;
            lastInput.classList.add("locked");
            lastItem.classList.add("locked-item");
        }
        createAlasanItem();
    });

    alasanContainer.addEventListener("click", function(e) {
        if (e.target.classList.contains("remove-alasan-btn")) {
            e.target.closest(".alasan-item").remove();
            updateHiddenTextarea();
        } else if (e.target.classList.contains("locked")) {
            const targetInput = e.target;
            targetInput.readOnly = false;
            targetInput.classList.remove("locked");
            targetInput.parentElement.classList.remove("locked-item");
            targetInput.focus();
            targetInput.setSelectionRange(targetInput.value.length, targetInput.value.length);
        }
    });

    alasanContainer.addEventListener("input", updateHiddenTextarea);

    newReportBtn.addEventListener('click', () => window.location.reload());

    const readFileAsBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]); // Ambil bagian base64 saja
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    };

    form.addEventListener("submit", async function(e) {
        e.preventDefault();
        updateHiddenTextarea();
        if (hiddenTextarea.value.trim() === "") {
            alert("Harap isi setidaknya satu alasan pertambahan SPK.");
            if (alasanContainer.children.length === 0) createAlasanItem();
            else alasanContainer.querySelector("input").focus();
            return;
        }

        if (!originalEndDateISO || !newEndDateISO) {
            alert("Data tanggal tidak valid. Pastikan Nomor Ulok dan Pertambahan Hari sudah benar.");
            return;
        }

        const fileInput = document.getElementById('lampiran_pdf');
        let fileBase64 = null;
        let fileName = null;

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            if (file.size > 5 * 1024 * 1024) {
                alert("Ukuran file terlalu besar. Maksimal 5MB.");
                return;
            }
            try {
                fileBase64 = await readFileAsBase64(file);
                fileName = file.name;
            } catch (err) {
                alert("Gagal memproses file upload.");
                return;
            }
        }

        submitBtn.disabled = true;
        btnText.style.display = 'none';
        btnSpinner.style.display = 'flex';

        // Menggunakan data currentUser yang diset di awal
        const formData = {
            nomor_ulok: document.getElementById("nomor_ulok").value,
            pertambahan_hari: document.getElementById("pertambahan_hari").value,
            tanggal_spk_akhir: originalEndDateISO,
            tanggal_spk_akhir_baru: newEndDateISO,
            alasan_spk: hiddenTextarea.value,
            dibuat_oleh_nama: currentUser.nama, 
            dibuat_oleh_email: currentUser.email,
            cabang_pembuat: currentUser.cabang,
            lampiran_user_base64: fileBase64,
            lampiran_user_name: fileName
        };

        try {
            const response = await fetch(`${API_PROXY_URL}?form=perpanjangan_spk`, {
                method: "POST",
                mode: "cors",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.status === "success") {
                modalMessage.textContent = result.message;
                successModal.classList.add('show');
            } else {
                throw new Error(result.message || "Terjadi kesalahan di server.");
            }
        } catch (error) {
            alert("Gagal mengirim data: " + error.message);
        } finally {
            submitBtn.disabled = false;
            btnText.style.display = 'inline';
            btnSpinner.style.display = 'none';
        }
    });
});

// --- MODIFIKASI 3: Pengecekan Jam Sesi ---
function checkSessionTime() {
    try {
        const startHour = 6;
        const endHour = 18;

        const now = new Date();
        const options = {
            timeZone: "Asia/Jakarta",
            hour: '2-digit',
            hour12: false
        };
        const currentHour = parseInt(new Intl.DateTimeFormat('en-US', options).format(now));

        // Jika diluar jam kerja
        if (currentHour < startHour || currentHour >= endHour) {
            const isAuthenticated = sessionStorage.getItem("authenticated");

            if (isAuthenticated === "true") {
                // Clear session dan tendang
                sessionStorage.clear();
                alert("Sesi Anda telah berakhir karena di luar jam operasional (06:00 - 18:00 WIB).");
                window.location.href = LOGIN_PAGE_URL;
            }
        }
    } catch (err) {
        console.error("Gagal menjalankan pengecekan jam sesi:", err);
    }
}
checkSessionTime();
setInterval(checkSessionTime, 300000); // Cek tiap 5 menit