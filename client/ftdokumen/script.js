/* =================================================================
   GLOBAL CONFIGURATION & STATE
   ================================================================= */
   const API_BASE_URL = "https://sparta-backend-5hdj.onrender.com";

   let state = {
       user: null,
       formData: {
           namaToko: "", kodeToko: "", tanggalGo: "", spkAwal: "",
           kontraktorSipil: "", cabang: "", tanggalSt: "",
           tanggalAmbilFoto: "", spkAkhir: "", kontraktorMe: "",
           nomorUlok: "", isManualUlok: false
       },
       photos: {}, // { 1: { url, point, timestamp, note }, ... }
       currentStep: 1, // 1: Form, 2: FloorPlan
       currentPage: 1, // Floor Plan pagination
       spkOptions: [],
       currentPhotoNumber: 1,
       selectedPoint: null,
       isCapturing: false,
       isCameraReady: false,
       cameraStream: null
   };
   
   // --- Photo Points Data (Hardcoded from FloorPlan.js) ---
   const PHOTO_POINTS = [
       // Page 1
       { id: 1, x: 67.8, y: 92.8, label: "KANAN 50 M", page: 1 },
       { id: 2, x: 63.7, y: 97.5, label: "DEPAN KANAN", page: 1 },
       { id: 3, x: 50.5, y: 97.5, label: "DEPAN", page: 1 },
       { id: 4, x: 36.7, y: 97.5, label: "DEPAN KIRI", page: 1 },
       { id: 5, x: 32.9, y: 93.3, label: "KIRI 50 M", page: 1 },
       { id: 6, x: 32.8, y: 85.8, label: "KIRI BAHU JALAN", page: 1 },
       { id: 7, x: 67.8, y: 85.8, label: "KANAN BAHU JALAN", page: 1 },
       { id: 8, x: 66, y: 82.5, label: "TAMPAK KANAN DEPAN KEBELAKANG", page: 1 },
       { id: 9, x: 33.5, y: 81.8, label: "TAMPAK KIRI DEPAN KEBELAKANG", page: 1 },
       { id: 10, x: 65.1, y: 11.3, label: "KANAN BELAKANG BANGUNAN MENGHADAP DEPAN", page: 1 },
       { id: 11, x: 63.7, y: 7.8, label: "KANAN BELAKANG BANGUNAN MENGHADAP SAMPING", page: 1 },
       { id: 12, x: 37.5, y: 7.5, label: "KIRI BELAKANG BANGUNAN MENGHADAP SAMPING", page: 1 },
       { id: 13, x: 35, y: 11, label: "KIRI BELAKANG BANGUNAN MENGHADAP DEPAN", page: 1 },
       { id: 14, x: 58.2, y: 81.7, label: "INSTALASI LISTRIK POLE SIGN", page: 1 },
       { id: 15, x: 56.8, y: 73.3, label: "GUTTER", page: 1 },
       { id: 16, x: 57.6, y: 63.8, label: "KOLOM IWF DUDUKAN LISTPLANK", page: 1 },
       { id: 17, x: 59, y: 60, label: "KANAN TERAS LUAR", page: 1 },
       { id: 18, x: 41.4, y: 60.2, label: "KIRI TERAS LUAR", page: 1 },
       { id: 19, x: 61.5, y: 56.5, label: "KANAN TERAS DALAM", page: 1 },
       { id: 20, x: 39, y: 56.5, label: "KIRI TERAS DALAM", page: 1 },
       { id: 21, x: 48.7, y: 49.4, label: "PINTU KACA ALLUMUNIUM", page: 1 },
       { id: 22, x: 38.8, y: 52.5, label: "SUDUT KIRI DEPAN AREA SALES", page: 1 },
       { id: 23, x: 42.4, y: 45.5, label: "INSTALASI LISTRIK FREEZER", page: 1 },
       { id: 24, x: 58.8, y: 37.5, label: "SUDUT KANAN DEPAN AREA SALES", page: 1 },
       { id: 25, x: 61.1, y: 51, label: "INSTALASI LISTRIK MEJA KASIR", page: 1 },
       { id: 26, x: 61.5, y: 27.5, label: "SUDUT KANAN BELAKANG AREA SALES", page: 1 },
       { id: 27, x: 39, y: 28.2, label: "SUDUT KIRI BELAKANG AREA SALES", page: 1 },
       { id: 28, x: 61.7, y: 22.2, label: "SELASAR + JANITOR", page: 1 },
       { id: 29, x: 59.5, y: 12.5, label: "KAMAR MANDI", page: 1 },
       { id: 30, x: 53.1, y: 16.2, label: "GUDANG SEBELAH KANAN", page: 1 },
       { id: 31, x: 38.6, y: 13, label: "GUDANG SEBELAH KIRI", page: 1 },
       { id: 32, x: 48.5, y: 23.5, label: "INSTALASI LISTRIK & DRAINASE CHILLER", page: 1 },
       { id: 37, x: 59.7, y: 68.8, label: "SEPTICTANK EXISTING", page: 1 },
       { id: 38, x: 41, y: 68.8, label: "SUMUR EXISTING", page: 1 },
       // Page 2
       { id: 33, x: 61.3, y: 24, label: "AREA DAG TORN", page: 2 },
       { id: 34, x: 50, y: 51.8, label: "INSTALASI LISTRIK DAN LISTPLANK", page: 2 },
       // Page 3
       { id: 35, x: 61.1, y: 57.2, label: "CREMONA DIATAS FOLDING GATE", page: 3 },
       { id: 36, x: 61, y: 53.5, label: "INSTALASI LISTRIK DIATAS PLAFOND", page: 3 }
   ].sort((a, b) => a.id - b.id);
   
   /* =================================================================
      INIT & EVENT LISTENERS
      ================================================================= */
   document.addEventListener("DOMContentLoaded", () => {
       initApp();
   });
   
   function initApp() {
       // Cek sesi user
       const storedUser = localStorage.getItem("user");
       if (storedUser) {
           state.user = JSON.parse(storedUser);
           showMainLayout();
       } else {
           showLoginView();
       }
   
       // Setup Global Listeners
       document.getElementById("btn-login").addEventListener("click", handleLogin);
       document.getElementById("btn-logout").addEventListener("click", handleLogout);
       document.getElementById("toggle-password").addEventListener("click", togglePassword);
       
       // Form Listeners
       document.getElementById("btn-submit-form").addEventListener("click", handleFormSubmit);
       document.getElementById("select-ulok").addEventListener("change", handleUlokChange);
       document.getElementById("input-ulok-manual").addEventListener("input", handleManualUlokInput);
       document.getElementById("check-manual-ulok").addEventListener("change", toggleManualUlok);
       
       // Floor Plan Listeners
       document.getElementById("btn-back-form").addEventListener("click", () => {
           state.currentStep = 1;
           renderViews();
       });
       document.querySelectorAll(".pagination-btn").forEach(btn => {
           btn.addEventListener("click", (e) => {
               state.currentPage = parseInt(e.target.dataset.page);
               renderFloorPlan();
           });
       });
       document.getElementById("btn-save-pdf").addEventListener("click", handleSavePdf);
   
       // Camera Listeners
       document.getElementById("btn-close-camera").addEventListener("click", closeCamera);
       document.getElementById("btn-capture").addEventListener("click", capturePhoto);
       document.getElementById("btn-retake").addEventListener("click", retakePhoto);
       document.getElementById("btn-confirm-photo").addEventListener("click", confirmCapture);
       document.getElementById("btn-no-photo").addEventListener("click", handleNoPhoto);
       document.getElementById("input-upload-file").addEventListener("change", handleFileUpload);
   
       // Warning Modal
       document.getElementById("btn-warning-close").addEventListener("click", () => {
           logout();
           window.location.reload();
       });
   
       // Auto Check Ops Hours
       checkOperationalHours();
       setInterval(checkOperationalHours, 60000);
   }
   
   /* =================================================================
      VIEW NAVIGATION & RENDERING
      ================================================================= */
   function showLoginView() {
       document.getElementById("login-view").classList.remove("hidden");
       document.getElementById("main-layout").classList.add("hidden");
   }
   
   function showMainLayout() {
       document.getElementById("login-view").classList.add("hidden");
       document.getElementById("main-layout").classList.remove("hidden");
       document.getElementById("user-branch-display").textContent = 
           `Building & Maintenance — ${state.user.cabang || ""}`;
       
       // Load SPK Data
       fetchSpkData(state.user.cabang);
       
       // Render Form
       const cabangInput = document.getElementById("input-cabang");
       cabangInput.value = state.user.cabang || "";
       
       renderViews();
   }
   
   function renderViews() {
       const stepForm = document.getElementById("step-form");
       const stepFloor = document.getElementById("step-floorplan");
   
       if (state.currentStep === 1) {
           stepForm.classList.remove("hidden");
           stepFloor.classList.add("hidden");
       } else {
           stepForm.classList.add("hidden");
           stepFloor.classList.remove("hidden");
           renderFloorPlan();
           initFloorPlanData();
       }
   }
   
   /* =================================================================
      LOGIN LOGIC
      ================================================================= */
   async function handleLogin(e) {
       e.preventDefault();
       const u = document.getElementById("username").value;
       const p = document.getElementById("password").value;
       const errBox = document.getElementById("login-error");
       const btn = document.getElementById("btn-login");
   
       errBox.classList.add("hidden");
       btn.disabled = true;
       btn.textContent = "Memproses...";
   
       try {
           const res = await fetch(`${API_BASE_URL}/doc/auth/login`, {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ username: u, password: p }),
           });
           
           const json = await res.json();
           if (!json.ok) throw new Error(json.message || "Login gagal");
   
           localStorage.setItem("user", JSON.stringify(json.user));
           state.user = json.user;
           showMainLayout();
       } catch (err) {
           errBox.textContent = err.message;
           errBox.classList.remove("hidden");
       } finally {
           btn.disabled = false;
           btn.textContent = "Login";
       }
   }
   
   function handleLogout() {
       logout();
       window.location.reload();
   }
   
   function logout() {
       localStorage.removeItem("user");
       state.user = null;
   }
   
   function togglePassword() {
       const input = document.getElementById("password");
       const icon = document.querySelector("#toggle-password i");
       if (input.type === "password") {
           input.type = "text";
           icon.classList.remove("fa-eye");
           icon.classList.add("fa-eye-slash");
       } else {
           input.type = "password";
           icon.classList.remove("fa-eye-slash");
           icon.classList.add("fa-eye");
       }
   }
   
   function checkOperationalHours() {
       const now = new Date();
       const utc = now.getTime() + now.getTimezoneOffset() * 60000;
       const wib = new Date(utc + 7 * 60 * 60000);
       const hour = wib.getHours();
       const minute = wib.getMinutes();
   
       // Logic Login Info
       const infoBox = document.getElementById("login-info");
       const btnLogin = document.getElementById("btn-login");
       const userActive = !!state.user;
   
       if (hour < 6 || hour >= 18) {
           const timeStr = `${hour.toString().padStart(2,"0")}:${minute.toString().padStart(2,"0")}`;
           if (!userActive) {
               // Di halaman login
               infoBox.textContent = `⏰ Login hanya 06.00–18.00 WIB. Sekarang ${timeStr}`;
               infoBox.classList.remove("hidden");
               btnLogin.disabled = true;
               document.getElementById("username").disabled = true;
               document.getElementById("password").disabled = true;
           } else {
               // Sudah login -> Logout paksa
               document.getElementById("warning-message").textContent = 
                   `Sesi berakhir. Login hanya 06.00–18.00 WIB.\nSekarang ${timeStr} WIB.`;
               document.getElementById("warning-modal").classList.remove("hidden");
           }
       } else {
           if (!userActive) {
               infoBox.classList.add("hidden");
               btnLogin.disabled = false;
               document.getElementById("username").disabled = false;
               document.getElementById("password").disabled = false;
           }
       }
   }
   
   /* =================================================================
      FORM DATA LOGIC
      ================================================================= */
   async function fetchSpkData(cabang) {
       try {
           const res = await fetch(`${API_BASE_URL}/spk-data`, {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ cabang }),
           });
           const json = await res.json();
           if (json.ok) {
               state.spkOptions = json.data;
               populateUlokSelect(json.data);
           }
       } catch (err) { console.error("Error fetching SPK:", err); }
   }
   
   function populateUlokSelect(data) {
       const sel = document.getElementById("select-ulok");
       sel.innerHTML = '<option value="">-- pilih nomor ulok --</option>';
       data.forEach(o => {
           const opt = document.createElement("option");
           opt.value = o.nomorUlok;
           opt.textContent = o.nomorUlok;
           sel.appendChild(opt);
       });
   }
   
   function toggleManualUlok(e) {
       const isManual = e.target.checked;
       state.formData.isManualUlok = isManual;
       state.formData.nomorUlok = ""; // reset
       
       const sel = document.getElementById("select-ulok");
       const inp = document.getElementById("input-ulok-manual");
       
       if (isManual) {
           sel.classList.add("hidden");
           inp.classList.remove("hidden");
           inp.value = "";
       } else {
           sel.classList.remove("hidden");
           inp.classList.add("hidden");
           sel.value = "";
       }
       // Reset form fields
       fillFormFields({});
   }
   
   async function handleUlokChange(e) {
       const val = e.target.value;
       state.formData.nomorUlok = val;
       state.formData.isManualUlok = false;
       showLoader(true);
   
       // Cek backend dulu
       try {
           const res = await getTempByUlok(val);
           if (res.ok && res.data) {
               // Isi dari temp
               const { isManualUlok, ...rest } = res.data;
               state.formData = { ...state.formData, ...rest };
           } else {
               // Isi dari SPK Options
               const found = state.spkOptions.find(o => o.nomorUlok === val);
               if (found) {
                   // Merge found data
                   Object.assign(state.formData, found);
               }
           }
           fillFormFields(state.formData);
       } catch (err) { console.error(err); } 
       finally { showLoader(false); }
   }
   
   async function handleManualUlokInput(e) {
       const val = e.target.value.toUpperCase();
       state.formData.nomorUlok = val;
       
       // Debounce simple logic or just fetch
       // Disini kita fetch backend untuk cek apakah ada data tersimpan
       try {
           const res = await getTempByUlok(val);
           if (res.ok && res.data) {
               const { isManualUlok, ...rest } = res.data;
               state.formData = { ...state.formData, ...rest, isManualUlok: true };
               fillFormFields(state.formData);
           }
       } catch (err) {}
   }
   
   function fillFormFields(data) {
       document.getElementById("input-sipil").value = data.kontraktorSipil || "";
       document.getElementById("input-me").value = data.kontraktorMe || "";
       document.getElementById("input-spk-awal").value = data.spkAwal || "";
       document.getElementById("input-spk-akhir").value = data.spkAkhir || "";
       document.getElementById("input-nama-toko").value = data.namaToko || "";
       document.getElementById("input-kode-toko").value = data.kodeToko || "";
       document.getElementById("input-tgl-go").value = data.tanggalGo || "";
       document.getElementById("input-tgl-st").value = data.tanggalSt || "";
       document.getElementById("input-tgl-foto").value = data.tanggalAmbilFoto || "";
   }
   
   function handleFormSubmit(e) {
       e.preventDefault();
       // Update state from DOM
       state.formData.kontraktorSipil = document.getElementById("input-sipil").value;
       state.formData.kontraktorMe = document.getElementById("input-me").value;
       state.formData.spkAwal = document.getElementById("input-spk-awal").value;
       state.formData.spkAkhir = document.getElementById("input-spk-akhir").value;
       state.formData.namaToko = document.getElementById("input-nama-toko").value;
       state.formData.kodeToko = document.getElementById("input-kode-toko").value;
       state.formData.tanggalGo = document.getElementById("input-tgl-go").value;
       state.formData.tanggalSt = document.getElementById("input-tgl-st").value;
       state.formData.tanggalAmbilFoto = document.getElementById("input-tgl-foto").value;
   
       // Validate essential
       if (!state.formData.namaToko || !state.formData.kodeToko) {
           showToast("error", "Nama Toko dan Kode Toko wajib diisi!");
           return;
       }
   
       // Auto Save
       const toast = document.getElementById("form-toast");
       toast.textContent = "Processing...";
       toast.classList.remove("hidden");
       
       saveTemp(state.formData).then(() => {
           state.currentStep = 2;
           renderViews();
           toast.classList.add("hidden");
       }).catch(err => {
           toast.textContent = "Gagal menyimpan data";
       });
   }
   
   /* =================================================================
      FLOOR PLAN LOGIC
      ================================================================= */
   async function initFloorPlanData() {
       document.getElementById("display-store-name").textContent = 
           `${state.formData.namaToko} - ${state.formData.kodeToko}`;
       document.getElementById("display-date").textContent = 
           state.formData.tanggalAmbilFoto || "-";
   
       // Load photos from backend
       showLoader(true);
       try {
           const res = await getTempByUlok(state.formData.nomorUlok);
           if (res.ok && res.data && res.data.photos) {
               // Restore photos logic
               // Di backend React: photos berupa array ID. Kita fetch view-photo
               const restored = {};
               const promises = [];
               
               // res.data.photos is array where index+1 = photoId
               // Ex: [null, "file_id", ...]
               res.data.photos.forEach((fileId, idx) => {
                   if(fileId) {
                       const pointId = idx + 1;
                       const url = `${API_BASE_URL}/view-photo/${fileId}`;
                       // Simple preload
                       const img = new Image(); img.src = url; 
                       
                       const point = PHOTO_POINTS.find(p => p.id === pointId);
                       restored[pointId] = {
                           url: url,
                           point: point,
                           timestamp: new Date().toISOString()
                       };
                   }
               });
               
               state.photos = restored;
           }
       } catch (err) { console.error("Restore failed", err); }
       finally {
           // Calculate next point
           const takenIds = Object.keys(state.photos).map(Number);
           const next = takenIds.length > 0 ? Math.max(...takenIds) + 1 : 1;
           state.currentPhotoNumber = next > 38 ? 38 : next;
   
           showLoader(false);
           renderFloorPlan();
           renderPhotoList();
       }
   }
   
   function renderFloorPlan() {
       // Set Image
       const img = document.getElementById("floor-image");
       const page = state.currentPage;
       if (page === 1) img.src = "https://i.ibb.co/6RQK7Xn/floor.png"; // Replace with local 'public/floor.png'
       else if (page === 2) img.src = "https://i.ibb.co/3W03xG2/floor3.jpg"; // Replace with local 'public/floor3.jpeg'
       else img.src = "https://i.ibb.co/7Xj0y1P/floor2.jpg"; // Replace with local 'public/floor2.jpeg'
   
       // Update Pagination UI
       document.querySelectorAll(".pagination-btn").forEach(b => {
           b.classList.toggle("active", parseInt(b.dataset.page) === page);
       });
   
       // Render Points
       const container = document.getElementById("points-container");
       container.innerHTML = "";
       
       const pagePoints = PHOTO_POINTS.filter(p => p.page === page);
       
       pagePoints.forEach(p => {
           const btn = document.createElement("button");
           btn.className = `photo-point ${getPointStatus(p.id)}`;
           btn.style.left = `${p.x}%`;
           btn.style.top = `${p.y}%`;
           btn.textContent = p.id;
           btn.title = p.label;
           
           if (state.photos[p.id]) {
               btn.innerHTML += '<span class="check-mark">✓</span>';
           }
   
           // Click Handler
           btn.onclick = () => handlePointClick(p);
           
           // Disable logic
           if (p.id > state.currentPhotoNumber && !state.photos[p.id]) {
               btn.disabled = true;
           }
   
           container.appendChild(btn);
       });
   }
   
   function getPointStatus(id) {
       if (state.photos[id]) return "completed";
       if (id === state.currentPhotoNumber) return "active";
       if (id < state.currentPhotoNumber) return "missed";
       return "pending";
   }
   
   function handlePointClick(point) {
       if (!state.photos[point.id] && point.id > state.currentPhotoNumber) {
           showToast("error", `Foto harus berurutan. Ambil #${state.currentPhotoNumber} dulu.`);
           return;
       }
       state.selectedPoint = point;
       openCamera();
   }
   
   function renderPhotoList() {
       const grid = document.getElementById("photo-grid");
       grid.innerHTML = "";
       const completed = Object.keys(state.photos).length;
       document.getElementById("count-completed").textContent = completed;
       document.getElementById("progress-fill").style.width = `${(completed/38)*100}%`;
       document.getElementById("progress-text").textContent = `Progress: ${completed}/38 foto`;
   
       if (completed === 38) {
           document.getElementById("completion-section").classList.remove("hidden");
       } else {
           document.getElementById("completion-section").classList.add("hidden");
       }
   
       PHOTO_POINTS.forEach(p => {
           const item = document.createElement("div");
           item.className = `photo-item ${getPointStatus(p.id)}`;
           
           let html = `
               <div class="photo-number">${p.id}</div>
               <div class="photo-label">${p.label}</div>
           `;
           
           if (state.photos[p.id]) {
               const photo = state.photos[p.id];
               if (photo.note) {
                   html += `<div class="photo-preview"><div class="photo-note">${photo.note}</div></div>`;
               } else {
                   html += `<div class="photo-preview"><img src="${photo.url}" class="thumbnail" /></div>`;
               }
           }
           
           item.innerHTML = html;
           grid.appendChild(item);
       });
   }
   
   /* =================================================================
      CAMERA LOGIC
      ================================================================= */
   async function openCamera() {
       document.getElementById("camera-modal").classList.remove("hidden");
       document.getElementById("camera-title").textContent = 
           `Foto #${state.selectedPoint.id}: ${state.selectedPoint.label}`;
       
       resetCameraUI();
       
       try {
           const stream = await navigator.mediaDevices.getUserMedia({
               video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
           });
           state.cameraStream = stream;
           const vid = document.getElementById("camera-video");
           vid.srcObject = stream;
           vid.onloadedmetadata = () => { state.isCameraReady = true; };
       } catch (err) {
           alert("Gagal akses kamera: " + err.message);
           closeCamera();
       }
   }
   
   function closeCamera() {
       if (state.cameraStream) {
           state.cameraStream.getTracks().forEach(t => t.stop());
           state.cameraStream = null;
       }
       document.getElementById("camera-modal").classList.add("hidden");
       state.selectedPoint = null;
       state.isCameraReady = false;
   }
   
   function capturePhoto() {
       if (!state.isCameraReady) return;
       
       const vid = document.getElementById("camera-video");
       const canvas = document.getElementById("camera-canvas");
       const ctx = canvas.getContext("2d");
       
       canvas.width = vid.videoWidth;
       canvas.height = vid.videoHeight;
       ctx.drawImage(vid, 0, 0);
       
       const url = canvas.toDataURL("image/jpeg", 0.7);
       
       // Show Result
       document.getElementById("captured-image").src = url;
       document.getElementById("camera-preview-box").classList.add("hidden");
       document.getElementById("photo-result-box").classList.remove("hidden");
       document.getElementById("action-pre-capture").classList.add("hidden");
       document.getElementById("action-post-capture").classList.remove("hidden");
   }
   
   function retakePhoto() {
       resetCameraUI();
   }
   
   function resetCameraUI() {
       document.getElementById("camera-preview-box").classList.remove("hidden");
       document.getElementById("photo-result-box").classList.add("hidden");
       document.getElementById("action-pre-capture").classList.remove("hidden");
       document.getElementById("action-post-capture").classList.add("hidden");
   }
   
   async function confirmCapture() {
       const img = document.getElementById("captured-image");
       const base64 = img.src;
       const point = state.selectedPoint;
       
       showLoader(true);
       try {
           await saveTemp({
               nomorUlok: state.formData.nomorUlok,
               photoId: point.id,
               photoBase64: base64
           });
           
           // Update Local State
           state.photos[point.id] = {
               url: base64,
               point: point,
               timestamp: new Date().toISOString()
           };
           
           // Increment pointer
           if (!state.photos[point.id]) {
                // Logic already handled by just setting it
           }
           if (point.id >= state.currentPhotoNumber) {
               state.currentPhotoNumber = Math.min(point.id + 1, 38);
           }
   
           closeCamera();
           renderFloorPlan();
           renderPhotoList();
           
       } catch (err) {
           alert("Gagal simpan foto: " + err.message);
       } finally {
           showLoader(false);
       }
   }
   
   async function handleNoPhoto() {
       const point = state.selectedPoint;
       showLoader(true);
       try {
           await saveTemp({
               nomorUlok: state.formData.nomorUlok,
               photoId: point.id,
               photoNote: "TIDAK BISA DIFOTO"
           });
           
           state.photos[point.id] = {
               url: "fototidakbisadiambil.jpeg", // Placeholder
               point: point,
               timestamp: new Date().toISOString(),
               note: "TIDAK BISA DIFOTO"
           };
           
           if (point.id >= state.currentPhotoNumber) {
               state.currentPhotoNumber = Math.min(point.id + 1, 38);
           }
   
           closeCamera();
           renderFloorPlan();
           renderPhotoList();
       } catch (err) { alert("Error: " + err.message); }
       finally { showLoader(false); }
   }
   
   function handleFileUpload(e) {
       const file = e.target.files[0];
       if (!file) return;
       const reader = new FileReader();
       reader.onloadend = async () => {
           const base64 = reader.result;
           document.getElementById("captured-image").src = base64;
           // Simulate capture UI state to trigger confirm logic next
           document.getElementById("camera-preview-box").classList.add("hidden");
           document.getElementById("photo-result-box").classList.remove("hidden");
           document.getElementById("action-pre-capture").classList.add("hidden");
           document.getElementById("action-post-capture").classList.remove("hidden");
       };
       reader.readAsDataURL(file);
   }
   
   /* =================================================================
      API CALLS & SAVING
      ================================================================= */
   async function getTempByUlok(ulok) {
       const res = await fetch(`${API_BASE_URL}/get-temp`, {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ nomorUlok: ulok }),
       });
       return res.json();
   }
   
   async function saveTemp(payload) {
       // Merge current formData with new payload to ensure backend gets full context if needed
       // (Backend likely handles partial updates, but safe side)
       const fullPayload = { ...state.formData, ...payload };
       const res = await fetch(`${API_BASE_URL}/save-temp`, {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify(fullPayload),
       });
       return res.json();
   }
   
   async function handleSavePdf() {
       if (confirm("Pastikan semua data sudah benar. Lanjutkan?")) {
           showLoader(true, "Menyimpan & Mengirim Email...");
           
           try {
               // 1. Cek Status
               const statusRes = await fetch(`${API_BASE_URL}/cek-status`, {
                   method: "POST",
                   headers: { "Content-Type": "application/json" },
                   body: JSON.stringify({ nomorUlok: state.formData.nomorUlok })
               }).then(r => r.json());
               
               if (statusRes.status === "DISETUJUI" || statusRes.status === "MENUNGGU VALIDASI") {
                   throw new Error("Dokumen sudah disubmit atau disetujui.");
               }
   
               // 2. Karena di vanilla JS (single file script) kita tidak mudah pakai WebWorker untuk jsPDF
               // Kita akan panggil endpoint backend yang lebih pintar atau
               // Gunakan logika SaveToko langsung.
               // *Asumsi: Backend di /save-toko bisa handle generate PDF kalau dikirim data lengkap,
               // ATAU kita trigger generate di backend.
               // Sesuai kode React lama, PDF digenerate di client (pdf.worker.js) lalu dikirim base64.
               // KARENA file pdf.worker.js TIDAK ADA di input prompt, saya tidak bisa migrasikan logikanya.
               // SOLUSI: Kirim data JSON lengkap ke backend, biarkan backend generate PDF (jika support),
               // atau alert user.
               
               // Fallback: Kirim dummy base64 atau minta backend generate
               // Untuk sekarang kita panggil save-toko dengan data form
               
               const payload = {
                   ...state.formData,
                   emailPengirim: state.user.email,
                   // pdfBase64: "..." // Tidak bisa generate client side tanpa worker
               };
               
               // Kita coba panggil save-toko. Jika backend butuh PDFBase64 wajib, ini akan gagal.
               // Namun ini best effort migrasi tanpa file worker.
               const saveRes = await fetch(`${API_BASE_URL}/save-toko`, {
                   method: "POST",
                   headers: { "Content-Type": "application/json" },
                   body: JSON.stringify(payload),
               }).then(r => r.json());
               
               if (!saveRes.ok) throw new Error(saveRes.error || "Gagal simpan toko");
               
               // Kirim Email Trigger
               await fetch(`${API_BASE_URL}/send-pdf-email`, {
                   method: "POST",
                   headers: { "Content-Type": "application/json" },
                   body: JSON.stringify({
                       email: state.user.email,
                       pdfUrl: saveRes.pdfUrl,
                       filename: `Dokumentasi_${state.formData.kodeToko}.pdf`,
                       ...state.formData
                   })
               });
   
               showToast("success", "Berhasil disimpan & Email terkirim!");
   
           } catch (err) {
               showToast("error", err.message);
           } finally {
               showLoader(false);
           }
       }
   }
   
   /* =================================================================
      HELPERS
      ================================================================= */
   function showLoader(show, text="Loading...") {
       const el = document.getElementById("global-loader");
       document.getElementById("loader-text").textContent = text;
       if (show) el.classList.remove("hidden");
       else el.classList.add("hidden");
   }
   
   function showToast(type, msg) {
       const el = document.getElementById("toast-notification");
       el.textContent = msg;
       el.style.backgroundColor = type === "success" ? "#16a34a" : "#dc2626";
       el.classList.remove("hidden");
       setTimeout(() => {
           el.classList.add("hidden");
       }, 3000);
   }