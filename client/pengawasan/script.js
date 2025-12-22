const SCRIPT_URL = "https://sparta-backend-5hdj.onrender.com.com/api/form";
const form = document.getElementById("pic-form");
const loading = document.getElementById("loading");
const submitBtn = document.getElementById("submit-btn");
const errorMessage = document.getElementById("error-message");
const successMessage = document.getElementById("success-message");
const popup = document.getElementById("popup");
const popupMessage = document.getElementById("popup-message");
const cabangInput = document.getElementById("cabang");
const picSelect = document.getElementById("pic_building_support");
const kodeUlokInput = document.getElementById("kode_ulok");
const namaTokoInput = document.getElementById("nama_toko");
const logoutLink = document.getElementById("logout-link");
const rabUrlInput = document.getElementById("rab_url");
const rabStatus = document.getElementById("rab-status");
const spkUrlInput = document.getElementById("spk_url");
const spkStatus = document.getElementById("spk-status");
const kategoriLokasiInput = document.getElementById("kategori_lokasi");
const tanggalSpkInput = document.getElementById("tanggal_spk");

    let currentRabUrl = "";
    let currentSpkUrl = "";

    function initializePage(userData) {
        const loggedInCabang = userData.cabang;
        const today = new Date().toISOString().split("T")[0];
        const cabangSelect = document.getElementById("cabang");
        cabangSelect.innerHTML = "";
        const option = document.createElement("option");
        option.value = loggedInCabang;
        option.textContent = loggedInCabang.toUpperCase();
        option.selected = true;
        cabangSelect.appendChild(option);
        cabangSelect.disabled = true;
        cabangSelect.dispatchEvent(new Event("change"));
    }

    function hideMessages() {
        errorMessage.classList.remove("show");
        successMessage.classList.remove("show");
    }

    function showError(message) {
        hideMessages();
        errorMessage.textContent = message;
        errorMessage.classList.add("show");
    }

    function showSuccess(message) {
        hideMessages();
        successMessage.textContent = message;
        successMessage.classList.add("show");
    }

    function showPopup(message) {
        popupMessage.textContent = message;
        popup.classList.add("show");
    }

    function closePopup() {
        popup.classList.remove("show");
    }

    function showStatus(element, message, type) {
        element.textContent = message;
        element.className = `status-indicator ${type}`;
        element.style.display = "block";
    }

    function clearUrlFields() {
        currentRabUrl = "";
        rabUrlInput.value = "";
        rabStatus.style.display = "none";
        currentSpkUrl = "";
        spkUrlInput.value = "";
        spkStatus.style.display = "none";
        namaTokoInput.value = "";
        kategoriLokasiInput.value = "";
        tanggalSpkInput.value = "";
    }

    async function fetchNamaToko(kodeUlok) {
        try {
            namaTokoInput.value = "Mencari nama toko...";
            const response = await fetch(
            `${SCRIPT_URL}?form=input-pic&getNamaToko=true&kode_ulok=${encodeURIComponent(
                kodeUlok
                )}`
            );
            const result = await response.json();
            if (result.status === "success" && result.namaToko) {
                namaTokoInput.value = result.namaToko.toUpperCase();
            } else {
                namaTokoInput.value = "Nama Toko Tidak Ditemukan";
            }
        } catch (error) {
            console.error("Error fetching Nama Toko:", error);
            namaTokoInput.value = "Gagal mengambil data Nama Toko";
        }
    }

    async function fetchSpkUrl(kodeUlok) {
        try {
            showStatus(
                spkStatus,
                `Mencari semua SPK untuk kode ulok ${kodeUlok}...`,
                "loading"
            );
            const response = await fetch(
                `${SCRIPT_URL}?form=input-pic&getAllSpkUrls=true&kode_ulok=${encodeURIComponent(
                    kodeUlok
                )}`
            );
            const result = await response.json();
            if (result.status === "success" && result.spkUrls && result.spkUrls.length > 0) {
                const urls = result.spkUrls.join(', ');
                currentSpkUrl = urls;
                spkUrlInput.value = urls;
                showStatus(
                    spkStatus,
                    `✅ ${result.spkUrls.length} link SPK ditemukan`,
                    "success"
                );
            } else {
                currentSpkUrl = "";
                spkUrlInput.value = "";
                showStatus(
                    spkStatus,
                    "❌ SPK tidak ditemukan untuk kode ulok ini",
                    "error"
                );
            }
        } catch (error) {
            console.error("Error fetching SPK URL:", error);
            currentSpkUrl = "";
            spkUrlInput.value = "";
            showStatus(spkStatus, "❌ Gagal mengambil data SPK", "error");
            }
    }

    async function fetchRabUrl(kodeUlok) {
        try {
            showStatus(
                rabStatus,
                `Mencari semua RAB untuk kode ulok ${kodeUlok}...`,
                "loading"
            );
            const response = await fetch(
                `${SCRIPT_URL}?form=input-pic&getAllRabUrls=true&kode_ulok=${encodeURIComponent(
                kodeUlok
                )}`
            );
            const result = await response.json();
            if (result.status === "success" && result.rabUrls && result.rabUrls.length > 0) {
                const urls = result.rabUrls.join(', ');
                currentRabUrl = urls;
                rabUrlInput.value = urls;
                showStatus(
                rabStatus,
                `✅ ${result.rabUrls.length} link RAB ditemukan`,
                "success"
                );
            } else {
                currentRabUrl = "";
                rabUrlInput.value = "";
                showStatus(
                rabStatus,
                "❌ RAB tidak ditemukan untuk kode ulok ini",
                "error"
                );
            }
        } catch (error) {
            console.error("Error fetching RAB URL:", error);
            currentRabUrl = "";
            rabUrlInput.value = "";
            showStatus(rabStatus, "❌ Gagal mengambil data RAB", "error");
        }
    }

    async function fetchSpkDetails(kodeUlok) {
        try {
            const response = await fetch(
                `${SCRIPT_URL}?form=input-pic&getSpkDetails=true&kode_ulok=${encodeURIComponent(
                kodeUlok
                )}`
            );
            const result = await response.json();
            if (result.status === "success") {
                if (result.durasi) {
                kategoriLokasiInput.value = result.durasi;
                }
                if (result.waktuMulai) {
                tanggalSpkInput.value = result.waktuMulai;
                }
            }
        } catch (error) {
            console.error("Error fetching SPK details:", error);
        }
    }
    cabangInput.addEventListener("change", async function () {
        const cabang = cabangInput.value.trim();
        if (!cabang) return;
        clearUrlFields();
        kodeUlokInput.innerHTML = '<option value="">-- Memuat Kode Ulok --</option>';
        try {
            const response = await fetch(
                `${SCRIPT_URL}?form=input-pic&getKodeUlokByCabang=true&cabang=${encodeURIComponent(
                cabang
                )}`
            );
            const result = await response.json();
            kodeUlokInput.innerHTML = '<option value="">-- Pilih Kode Ulok --</option>';
            if (result.status === "success" && result.kodeUlokList.length > 0) {
                result.kodeUlokList.forEach((kode) => {
                const option = document.createElement("option");
                option.value = kode;
                option.textContent = kode;
                kodeUlokInput.appendChild(option);
                });
            } else {
            const opt = document.createElement("option");
            opt.textContent = "Tidak ada kode ulok";
            opt.disabled = true;
            kodeUlokInput.appendChild(opt);
            }
        } catch (err) {
            showError("Gagal memuat daftar kode ulok.");
        }
        picSelect.innerHTML = '<option value="">-- Memuat PIC --</option>';
        try {
            const response = await fetch(
                `${SCRIPT_URL}?form=input-pic&cabang=${encodeURIComponent(cabang)}`
            );
            const result = await response.json();
            picSelect.innerHTML = '<option value="">-- Pilih PIC Building Support --</option>';
            if (result.status === "success" && result.picList.length > 0) {
                result.picList.forEach((pic) => {
                const option = document.createElement("option");
                option.value = JSON.stringify({
                    email: pic.email,
                    nama: pic.nama,
                    jabatan: pic.jabatan,
                });
                option.textContent = pic.nama.toUpperCase();
                picSelect.appendChild(option);
                });
            } else {
                const opt = document.createElement("option");
                opt.textContent = "PIC tidak ditemukan";
                opt.disabled = true;
                picSelect.appendChild(opt);
            }
        } catch (err) {
            showError("Gagal mengambil data PIC.");
        }
    });
    kodeUlokInput.addEventListener("change", async function () {
        const kodeUlok = kodeUlokInput.value.trim();
        if (kodeUlok) {
            await fetchNamaToko(kodeUlok);
            await fetchSpkDetails(kodeUlok);
            await fetchSpkUrl(kodeUlok);
            await fetchRabUrl(kodeUlok);
        } else {
            clearUrlFields();
        }
    });
    form.addEventListener("submit", async function (e) {
        e.preventDefault();
        if (!currentSpkUrl) {
            const msg = "SPK tidak ditemukan. Pastikan kode ulok dan lingkup pekerjaan sudah benar dan SPK sudah terdata.";
            showError(msg);
            showPopup(msg);
            return;
        }
        if (!currentRabUrl) {
            const msg =
            "RAB tidak ditemukan. Pastikan kode ulok dan lingkup pekerjaan sudah benar dan RAB sudah terdata.";
            showError(msg);
            showPopup(msg);
            return;
        }
        loading.classList.add("show");
        submitBtn.disabled = true;
        hideMessages();
        try {
            const picData = JSON.parse(form.pic_building_support.value);
            const jsonData = {
                form: "input-pic",
                cabang: form.cabang.value,
                kode_ulok: form.kode_ulok.value,
                nama_toko: form.nama_toko.value,
                kategori_lokasi: form.kategori_lokasi.value,
                tanggal_spk: form.tanggal_spk.value,
                pic_building_support: picData.email,
                pic_nama: picData.nama,
                spk_url: currentSpkUrl,
                rab_url: currentRabUrl,
            };
            const response = await fetch(SCRIPT_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(jsonData),
            });
            const result = await response.json();
            if (result.status === "success") {
                const pesan = `Form berhasil dikirim!`;
                showSuccess(pesan);
                showPopup(pesan);
                form.reset();
                clearUrlFields();
                cabangInput.dispatchEvent(new Event("change"));
            } else {
                const msg =
                result.message || "Terjadi kesalahan saat menyimpan data.";
                showError(msg);
                showPopup(`${msg} Silakan coba lagi.`);
            }
        } catch (error) {
            console.error("Error:", error);
            const msg = "Terjadi kesalahan fatal saat mengirim data.";
            showError(msg);
            showPopup(msg);
            } finally {
            loading.classList.remove("show");
            submitBtn.disabled = false;
        }
    });
    function checkSessionTime() {
        try {
            const startHour = 6;
            const endHour = 18;
            const now = new Date();
            const options = { timeZone: "Asia/Jakarta", hour: '2-digit', hour12: false };
            const currentHour = parseInt(new Intl.DateTimeFormat('en-US', options).format(now));
            if (currentHour < startHour || currentHour >= endHour) {
                const token = sessionStorage.getItem("authToken");
                if (token) {
                sessionStorage.removeItem("authToken");
                alert("Sesi Anda telah berakhir karena di luar jam operasional (06:00 - 18:00 WIB).");
                window.location.href = "https://sparta-alfamart.vercel.app";
                }
            }
        } catch (err) {
            console.error("Gagal menjalankan pengecekan jam sesi:", err);
        }
    }
    checkSessionTime();
    setInterval(checkSessionTime, 300000);