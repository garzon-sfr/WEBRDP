import { auth, db } from "./firebase.js"; 
import "./posts.js"; 
import "./donations.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// Autenticación y correo
onAuthStateChanged(auth, (user) => {
  const userEmail = document.getElementById("userEmail");
  if (user) {
    if (userEmail) {
      userEmail.textContent = user.email;
    }
  } else {
    window.location.href = "login.html";
  }
});

// Cierre de sesión
const logoutButton = document.getElementById("logoutButton");
if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });
}

// Badge de mensajes nuevos
const badge = document.getElementById("messageBadge");
if (badge) {
  // Query para mensajes con status "nuevo"
  const q = query(collection(db, "contactMessages"), where("status", "==", "nuevo"));
  
  // Listener en tiempo real para actualizar el badge
  onSnapshot(q, (snapshot) => {
    const unreadCount = snapshot.size;
    if (unreadCount > 0) {
      badge.classList.remove("d-none");
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
    } else {
      badge.classList.add("d-none");
    }
  });
}
