/* =========================================
   1. Global Configuration & State
   ========================================= */
const CONFIG = {
  API_BASE_URL: "https://opnamebnm-mgbe.onrender.com", // Sesuaikan dengan environment variable jika ada
  INACTIVITY_LIMIT_MS: 60 * 60 * 1000, // 1 jam
};

const state = {
  user: null,
  loading: true,
  authError: "",
  idleTimer: null,
};

// =========================================
// 2. Auth Logic (from AuthContext.js)
// =========================================

function initAuth() {
  // Cleanup localStorage (migrasi lama)
  try {
    localStorage.removeItem("user");
  } catch (e) {}

  // Check sessionStorage
  const savedUser = sessionStorage.getItem("user");
  if (savedUser) {
    try {
      state.user = JSON.parse(savedUser);
    } catch (e) {
      sessionStorage.removeItem("user");
    }
  }
  
  state.loading = false;
  render(); // Initial render

  if (state.user) {
    setupActivityListeners();
    startIdleTimer();
  }
}

function startIdleTimer() {
  clearTimeout(state.idleTimer);
  state.idleTimer = setTimeout(() => {
    logout(true);
  }, CONFIG.INACTIVITY_LIMIT_MS);
}

function onUserActivity() {
  if (state.user) {
    startIdleTimer();
  }
}

function setupActivityListeners() {
  const events = ["click", "keydown", "mousemove", "scroll", "touchstart", "wheel", "visibilitychange"];
  events.forEach((evt) => window.addEventListener(evt, onUserActivity, { passive: true }));
}

function removeActivityListeners() {
  const events = ["click", "keydown", "mousemove", "scroll", "touchstart", "wheel", "visibilitychange"];
  events.forEach((evt) => window.removeEventListener(evt, onUserActivity));
}

async function login(username, password) {
  try {
    // Time restriction logic (06:00 - 24:00 WIB)
    const now = new Date();
    const wibTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const hour = wibTime.getHours();

    if (hour < 6 || hour >= 24) {
      const currentTime = wibTime.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return {
        success: false,
        message: `Sesi Anda telah berakhir.\nLogin hanya 06.00–18.00 WIB.\nSekarang pukul ${currentTime} WIB.`,
      };
    }

    // Call API
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const userData = await res.json();
    if (!res.ok) throw new Error(userData.message || "Login failed");

    // Success
    state.user = userData;
    sessionStorage.setItem("user", JSON.stringify(userData));
    try { localStorage.removeItem("user"); } catch (e) {}

    setupActivityListeners();
    startIdleTimer();
    
    return { success: true, user: userData };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, message: error.message };
  }
}

function logout(isAuto = false) {
  state.user = null;
  try { sessionStorage.removeItem("user"); } catch (e) {}
  try { localStorage.removeItem("user"); } catch (e) {}
  
  clearTimeout(state.idleTimer);
  removeActivityListeners();

  if (isAuto) {
    console.log("Auto-logout by inactivity.");
    // Bisa tambahkan alert di sini jika perlu
  }
  
  render(); // Re-render to show Login page
}

// =========================================
// 3. Rendering Logic (App.js & Components)
// =========================================

const root = document.getElementById("root");

function render() {
  root.innerHTML = "";

  if (state.loading) {
    renderLoading();
  } else if (!state.user) {
    renderLogin();
  } else {
    renderAppLayout();
  }
}

// --- Loading Component ---
function renderLoading() {
  const html = `
    <div class="loading-screen">
      <div class="loading-content">
        <div class="loading-icon">🏪</div>
        <h2 class="loading-text">Loading...</h2>
      </div>
    </div>
  `;
  root.innerHTML = html;
}

// --- Login Component (from Login.js) ---
function renderLogin() {
  // Reset error state on fresh render if needed, 
  // but usually we want to keep it if render called after failed login
  
  const html = `
    <div class="login-wrapper">
      <div class="login-card">
        <a href="https://sparta-alfamart.vercel.app/dashboard/pic/index.html" class="btn-back-link">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>Kembali</span>
        </a>

        <div class="login-header">
          <img src="frontend/src/images/Alfamart-Emblem.png" alt="Logo Alfamart" style="height: 50px; margin-bottom: 1rem;" />
          <h1>Building & Maintenance</h1>
          <h3>Opname</h3>
        </div>

        ${state.authError ? `<div class="alert-error">${state.authError}</div>` : ''}

        <form id="loginForm">
          <div class="form-group-custom">
            <label for="username">Username / Email</label>
            <input id="username" type="text" class="input-custom" placeholder="Masukkan email Anda" required />
          </div>

          <div class="form-group-custom">
            <label for="password">Password</label>
            <div class="password-wrapper">
              <input id="password" type="password" class="input-custom" placeholder="Masukkan kata sandi Anda" required />
              <button type="button" class="toggle-password-btn" id="togglePassword" title="Lihat password">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" id="eyeIconClosed">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L6.228 6.228" />
                </svg>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" id="eyeIconOpen" style="display: none;">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>

          <button type="submit" class="btn-submit-custom" id="btnLoginBtn">Login</button>
        </form>
      </div>
    </div>
  `;
  
  root.innerHTML = html;

  // Event Listeners for Login
  const form = document.getElementById("loginForm");
  const toggleBtn = document.getElementById("togglePassword");
  const passInput = document.getElementById("password");
  const eyeClosed = document.getElementById("eyeIconClosed");
  const eyeOpen = document.getElementById("eyeIconOpen");
  const submitBtn = document.getElementById("btnLoginBtn");

  // Toggle Password
  toggleBtn.addEventListener("click", () => {
    const isPassword = passInput.type === "password";
    passInput.type = isPassword ? "text" : "password";
    eyeClosed.style.display = isPassword ? "none" : "block";
    eyeOpen.style.display = isPassword ? "block" : "none";
    toggleBtn.title = isPassword ? "Sembunyikan password" : "Lihat password";
  });

  // Submit Handler
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const password = passInput.value;

    submitBtn.textContent = "Loading...";
    submitBtn.disabled = true;
    state.authError = "";
    
    // Re-render UI partial (optional) or just update DOM directly to avoid flicker
    // Here we wait for result
    const result = await login(username, password);

    if (result.success) {
      render(); // Will render AppLayout
    } else {
      state.authError = result.message;
      submitBtn.textContent = "Login";
      submitBtn.disabled = false;
      renderLogin(); // Re-render to show error message
    }
  });
}

// --- Main App Layout (Header + Dashboard) ---
function renderAppLayout() {
  const appContainer = document.createElement("div");
  appContainer.style.minHeight = "100vh";
  appContainer.style.backgroundColor = "var(--gray-100)";

  // Construct Header HTML
  const headerHtml = `
    <header class="main-header">
      <div class="header-container">
        <div class="desktop-header">
          <div class="header-logo-container">
            <img src="frontend/src/images/Alfamart-Emblem.png" alt="Alfamart" class="header-logo-img" />
            <img src="frontend/public/Building-Logo.png" alt="Building & Maintenance" class="building-logo-img" />
          </div>
          <h1 class="header-title">Sistem Opname</h1>
          <div class="header-user-section">
            <div class="header-user-info">
              <div class="header-user-name">${state.user?.name || 'User'}</div>
              <div class="header-user-role">${state.user?.role === "pic" ? state.user?.store : state.user?.company}</div>
            </div>
            <button id="btnLogout" class="btn btn-outline btn-header-logout">Logout</button>
          </div>
        </div>

        <div class="mobile-header">
          <div class="mobile-header-logos">
            <img src="frontend/src/images/Alfamart-Emblem.png" alt="Alfamart" class="header-logo-img" style="position:static; transform:none; height:40px;" />
            <img src="frontend/public/Building-Logo.png" alt="Building & Maintenance" class="building-logo-img" style="height:38px; transform:none; animation:none; opacity:1;" />
          </div>
          <div class="mobile-header-user">
            <div>
              <div class="header-user-name">${state.user?.name || 'User'}</div>
              <div style="font-size: 11px; opacity: 0.9;">${state.user?.role === "pic" ? state.user?.store : state.user?.company}</div>
            </div>
            <button id="btnLogoutMobile" class="btn btn-outline btn-header-logout" style="padding: 6px 12px; fontSize: 12px;">Logout</button>
          </div>
        </div>
      </div>
    </header>
    
    <main id="dashboard-container"></main>
  `;

  appContainer.innerHTML = headerHtml;
  root.appendChild(appContainer);

  // Bind Logout Events
  const btnLogout = document.getElementById("btnLogout");
  const btnLogoutMobile = document.getElementById("btnLogoutMobile");
  if (btnLogout) btnLogout.addEventListener("click", () => logout());
  if (btnLogoutMobile) btnLogoutMobile.addEventListener("click", () => logout());

  // Render Dashboard Logic
  renderDashboard();
}

function renderDashboard() {
  const container = document.getElementById("dashboard-container");
  
  // Karena file Dashboard.js mengandung banyak import sub-komponen yang tidak disediakan 
  // dalam teks prompt (hanya file utama), saya membuat placeholder ini.
  // Di Vanilla JS, Anda bisa memindahkan logika dari Dashboard.js ke sini.
  
  container.innerHTML = `
    <div class="container" style="padding-top: 2rem; text-align: center;">
      <div class="card">
        <h2>Selamat Datang, ${state.user?.name}</h2>
        <p>Dashboard berhasil dimuat.</p>
        <p style="margin-top:1rem; color: var(--gray-600);">
          <em>Catatan Engineer:</em> Konten Dashboard.js asli memuat banyak sub-komponen (OpnameForm, HistoryView, dll) 
          yang perlu dikonversi satu per satu. Struktur sudah siap untuk menerima logika tersebut di fungsi <code>renderDashboard()</code>.
        </p>
      </div>
    </div>
  `;
}

// =========================================
// 4. Initialize App
// =========================================
document.addEventListener("DOMContentLoaded", initAuth);