import { auth } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const loginForm = document.getElementById('adminLoginForm');
const errorMessage = document.getElementById('errorMessage');
const loginButton = loginForm?.querySelector('button');
const loginText = loginButton?.querySelector('.login-text');
const spinner = loginButton?.querySelector('.spinner-border');

// Redirigir si ya está logueado
onAuthStateChanged(auth, (user) => {
    if (user && window.location.pathname.includes('login')) {
        window.location.href = 'index.html';
    }
});

// Logout solo si el botón existe (index.html)
const logoutButton = document.getElementById('logoutButton');
if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = 'login.html';
    });
}

// Manejar envío de formulario solo si existe
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        loginButton.disabled = true;
        loginText.textContent = 'Iniciando sesión...';
        spinner.classList.remove('d-none');
        errorMessage.classList.add('d-none');

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            let errorMsg = 'Error al iniciar sesión';
            if (error.code === 'auth/invalid-credential') {
                errorMsg = 'Correo o contraseña inválidos';
            }

            errorMessage.textContent = errorMsg;
            errorMessage.classList.remove('d-none');
        } finally {
            loginButton.disabled = false;
            loginText.textContent = 'Iniciar Sesión';
            spinner.classList.add('d-none');
        }
    });
}
