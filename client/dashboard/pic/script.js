document.addEventListener('DOMContentLoaded', () => {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
        alert("Anda belum login atau sesi telah habis.");
        window.location.replace('auth/pic/login.html');
    }
    const apiUrl = `https://sparta-backend.onrender.com/api/user_info_by_email?email=${userEmail}`;
    const nameElement = document.getElementById('name');
    const cabangElement = document.getElementById('cabang');

    async function getUserData() {
        try {
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            console.log("Data dari API:", data); 

            if (data.status === 'success') {
                nameElement.textContent = `Halo, ${data.name || "User"}`;
                const usercabang = data.cabang ? data.cabang : "-"; 
                cabangElement.textContent = usercabang;
            } else {
                console.warn("User tidak ditemukan atau status bukan success:", data);
                nameElement.textContent = "Halo, User";
                cabangElement.textContent = "-";
            }
        } catch (error) {
            console.error("Gagal mengambil data user:", error);
            nameElement.textContent = "Halo, User";
            cabangElement.textContent = "-";
        }
    }
    getUserData();
});