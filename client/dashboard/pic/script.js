document.getElementById('logout-button-form').addEventListener('click', () => {
    sessionStorage.clear();
    window.location.href = 'https://sparta-alfamart.vercel.app';
});