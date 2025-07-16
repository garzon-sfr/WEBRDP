
// events.js - Carga inmediata de publicaciones desde Firebase (configuración simple)

// Variables globales
let allPosts = [];
let allEvents = [];
let db;

// Configuración Firebase inline
const firebaseConfig = {
    apiKey: "AIzaSyCFkBd5Iw4gOkfamvdSnsQrpe1Ut3TKCF8",
    authDomain: "webrdp-779cb.firebaseapp.com",
    projectId: "webrdp-779cb",
    storageBucket: "webrdp-779cb.appspot.com",
    messagingSenderId: "633572180200",
    appId: "1:633572180200:web:dbac22ecb4f7a8baa9895d"
};

// Inicializar Firebase cuando se carga la página
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Importar Firebase dinámicamente (versión actualizada para compatibilidad con admin)
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js');
        const { getFirestore, collection, query, where, orderBy, getDocs } = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
        
        // Inicializar Firebase
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        
        // Cargar publicaciones
        await loadPublishedPosts(collection, query, where, orderBy, getDocs);
        displayLatestPost();
        displayHistoryCarousel();
        
        // Cargar eventos
        try {
            await loadActiveEvents(collection, query, where, orderBy, getDocs);
        } catch (eventError) {
            // Mostrar contenido estático en caso de error
            displayUpcomingEvents();
        }
        
    } catch (error) {
        displayErrorState();
    }
});

// Cargar todas las publicaciones publicadas
async function loadPublishedPosts(collection, query, where, orderBy, getDocs) {
    try {
        const publishedQuery = query(
            collection(db, 'posts'),
            where('status', '==', 'published')
        );
        
        const querySnapshot = await getDocs(publishedQuery);
        allPosts = [];
        
        querySnapshot.forEach((doc) => {
            allPosts.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Ordenar manualmente por fecha
        allPosts.sort((a, b) => {
            if (a.createdAt && b.createdAt) {
                const dateA = a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                const dateB = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                return dateB - dateA;
            }
            return 0;
        });
        
    } catch (error) {
        allPosts = [];
    }
}

// Cargar eventos activos desde Firestore
// IMPORTANTE: NO usar orderBy() junto con where() - requiere índice compuesto en Firebase
// Solución: usar solo where() y ordenar manualmente en JavaScript
async function loadActiveEvents(collection, query, where, orderBy, getDocs) {
    try {
        // Usar consulta simple sin orderBy() para evitar error de índice
        const eventsQuery = query(
            collection(db, 'events'),
            where('status', '==', 'activo')
        );
        
        const querySnapshot = await getDocs(eventsQuery);
        allEvents = [];
        
        querySnapshot.forEach((doc) => {
            const eventData = {
                id: doc.id,
                ...doc.data()
            };
            allEvents.push(eventData);
        });

        // Ordenar manualmente por fecha en JavaScript (reemplaza orderBy de Firebase)
        allEvents.sort((a, b) => {
            const dateA = new Date(a.eventDate);
            const dateB = new Date(b.eventDate);
            return dateA - dateB; // Orden ascendente por fecha
        });
        
        // Mostrar eventos en la interfaz
        displayUpcomingEvents();
        
    } catch (error) {
        allEvents = [];
        displayUpcomingEvents(); // Mostrar mensaje de no eventos
    }
}

// Mostrar eventos próximos en la página
// NUEVA LÓGICA: Mantener horarios regulares + agregar eventos dinámicos
function displayUpcomingEvents() {
    // Obtener elementos de la interfaz
    const loadingElement = document.getElementById('events-loading');
    const dynamicContent = document.getElementById('events-dynamic-content');
    const staticContent = document.getElementById('events-static-content');
    
    if (!loadingElement || !dynamicContent || !staticContent) {
        return;
    }

    // Filtrar eventos futuros
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const futureEvents = allEvents.filter(event => {
        const eventDate = new Date(event.eventDate);
        return eventDate >= today;
    }).slice(0, 4); // Mostrar máximo 4 eventos

    // Ocultar loading
    loadingElement.style.display = 'none';

    // SIEMPRE mostrar contenido estático (horarios regulares)
    staticContent.style.display = 'block';
    
    if (futureEvents.length === 0) {
        // Solo mostrar contenido estático (sin eventos dinámicos)
        dynamicContent.style.display = 'none';
        return;
    }

    // Generar HTML de eventos dinámicos (se agregarán ENCIMA del contenido estático)
    let eventsHTML = `
        <div class="alert alert-success border-0 mb-4" role="alert">
            <div class="d-flex align-items-center">
                <i class="bi bi-calendar-check me-3 fs-4"></i>
                <div>
                    <h6 class="alert-heading mb-1">
                        <i class="bi bi-arrow-clockwise me-2"></i>
                        ${futureEvents.length} evento${futureEvents.length > 1 ? 's' : ''} especial${futureEvents.length > 1 ? 'es' : ''}
                    </h6>
                    <small class="mb-0">Eventos programados por la administración, además de nuestros horarios regulares.</small>
                </div>
            </div>
        </div>
    `;

    futureEvents.forEach(event => {
        const formattedDate = formatEventDate(event.eventDate);
        const colorClass = getEventColorClass(event.color || 'primary');
        const fullDate = formatFullEventDate(event.eventDate);
        
        eventsHTML += `
            <div class="mb-4 p-3 border rounded bg-white shadow-sm">
                <div class="d-flex align-items-center mb-2">
                    <div class="badge bg-${colorClass} me-2">${formattedDate}</div>
                    <div class="small text-muted">${event.type || 'Evento'}</div>
                    <span class="badge bg-success ms-auto small">
                        <i class="bi bi-star-fill me-1"></i>Especial
                    </span>
                </div>
                <a class="link-dark text-decoration-none" href="#!" onclick="showEventDetails('${event.id}')">
                    <h5 class="mb-1 text-primary">${event.title}</h5>
                </a>
                <p class="text-muted mb-1">${event.description}</p>
                <small class="text-success fw-medium">
                    <i class="bi bi-calendar3 me-1"></i>
                    ${fullDate}
                </small>
            </div>
        `;
    });

    // Agregar separador visual
    eventsHTML += `
        <hr class="my-4">
        <div class="text-center mb-3">
            <small class="text-muted">
                <i class="bi bi-arrow-down me-1"></i>
                Horarios regulares de la iglesia
            </small>
        </div>
    `;

    // Mostrar eventos dinámicos ANTES del contenido estático
    // ELIMINAR CLASES QUE OCULTAN EL ELEMENTO
    dynamicContent.className = dynamicContent.className.replace('d-none', '');
    dynamicContent.classList.remove('d-none');
    
    dynamicContent.innerHTML = eventsHTML;
    dynamicContent.style.display = 'block';
    dynamicContent.style.visibility = 'visible';
    dynamicContent.style.opacity = '1';
    
    // Aplicar estilos finales limpios
    dynamicContent.style.backgroundColor = '';
    dynamicContent.style.border = '';
    dynamicContent.style.padding = '';
    dynamicContent.style.margin = '';
    dynamicContent.style.minHeight = '';
}

// Formatear fecha del evento para mostrar (formato corto)
function formatEventDate(dateString) {
    if (!dateString) return 'TBD';
    
    try {
        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, '0');
        const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 
                       'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        const month = months[date.getMonth()];
        
        return `${day} ${month}`;
    } catch (error) {
        return 'TBD';
    }
}

// Formatear fecha completa del evento
function formatFullEventDate(dateString) {
    if (!dateString) return 'Fecha por confirmar';
    
    try {
        const date = new Date(dateString);
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        return date.toLocaleDateString('es-ES', options);
    } catch (error) {
        return 'Fecha por confirmar';
    }
}

// Obtener clase de color para el badge
function getEventColorClass(color) {
    const colorMap = {
        'success': 'success',
        'info': 'info', 
        'warning': 'warning',
        'primary': 'primary',
        'secondary': 'secondary'
    };
    return colorMap[color] || 'primary';
}

// Mostrar estado de error
function displayErrorState() {
    const latestPostContent = document.getElementById('latestPostContent');
    const historyCarouselInner = document.getElementById('historyCarouselInner');
    
    if (latestPostContent) {
        latestPostContent.innerHTML = `
            <div class="text-center text-danger">
                <h2 class="fw-bolder mb-4">Error de conexión</h2>
                <p class="lead text-muted mb-4">
                    No se pudo conectar con la base de datos. Intenta recargar la página.
                </p>
                <div class="d-grid gap-2 d-sm-flex justify-content-sm-start">
                    <button class="btn btn-primary btn-lg px-4 me-sm-3" onclick="window.location.reload()">
                        <i class="bi bi-arrow-clockwise me-2"></i>Recargar
                    </button>
                    <a class="btn btn-outline-secondary btn-lg px-4" href="../index.html">Inicio</a>
                </div>
            </div>
        `;
    }
    
    if (historyCarouselInner) {
        historyCarouselInner.innerHTML = `
            <div class="carousel-item active">
                <div class="text-center py-5 text-danger">
                    <i class="bi bi-exclamation-triangle display-4 mb-3"></i>
                    <h3>Error de conexión</h3>
                    <p>No se pudo cargar el contenido</p>
                </div>
            </div>
        `;
    }
}

// Mostrar la última publicación
function displayLatestPost() {
    const latestPostContent = document.getElementById('latestPostContent');
    const latestPostImage = document.getElementById('latestPostImage');
    
    if (!latestPostContent || !latestPostImage) return;

    if (allPosts.length === 0) {
        latestPostContent.innerHTML = `
            <div class="text-center">
                <h2 class="fw-bolder mb-4">Próximamente</h2>
                <p class="lead text-muted mb-4">
                    Estamos preparando contenido especial para compartir con nuestra comunidad.
                </p>
                <div class="d-grid gap-2 d-sm-flex justify-content-sm-start">
                    <a class="btn btn-primary btn-lg px-4 me-sm-3" href="contact.html">Contáctanos</a>
                    <a class="btn btn-outline-secondary btn-lg px-4" href="../index.html">Inicio</a>
                </div>
            </div>
        `;
        latestPostImage.style.backgroundImage = 'url("assets/279173196_109644341734170_7397879930178052213_n.jpg")';
        return;
    }

    const latestPost = allPosts[0];
    const imageUrl = latestPost.imageUrl || 'assets/279173196_109644341734170_7397879930178052213_n.jpg';
    const date = formatDate(latestPost.createdAt);

    latestPostContent.innerHTML = `
        <div class="badge bg-primary bg-gradient rounded-pill mb-2">${latestPost.category || 'Iglesia'}</div>
        <h1 class="fw-bolder">${latestPost.title || 'Sin título'}</h1>
        <p class="lead">
            ${(latestPost.description || '').substring(0, 150)}${(latestPost.description || '').length > 150 ? '...' : ''}
        </p>
        <div class="d-grid gap-2 d-sm-flex justify-content-sm-start">
            <a class="btn btn-primary btn-lg px-4 me-sm-3" href="#!" onclick="openPostModal('${latestPost.id}')">
                Leer más
            </a>
            <a class="btn btn-outline-secondary btn-lg" href="#historias-pasadas">
                Ver más historias
            </a>
        </div>
        <div class="mt-4">
            <small class="text-muted">
                <i class="bi bi-calendar3 me-1"></i>
                ${date}
            </small>
        </div>
    `;

    latestPostImage.style.backgroundImage = `url("${imageUrl}")`;
}

// Mostrar carrusel de historias pasadas
function displayHistoryCarousel() {
    const carouselInner = document.getElementById('historyCarouselInner');
    if (!carouselInner) return;

    if (allPosts.length <= 1) {
        carouselInner.innerHTML = `
            <div class="carousel-item active">
                <div class="text-center py-5">
                    <i class="bi bi-clock-history display-4 text-muted mb-3"></i>
                    <h3 class="text-muted">Más historias próximamente</h3>
                    <p class="text-muted">Estamos trabajando en más contenido para compartir.</p>
                </div>
            </div>
        `;
        return;
    }

    // Usar los posts restantes (excluyendo el primero)
    const historyPosts = allPosts.slice(1);
    const postsPerSlide = window.innerWidth >= 768 ? 3 : 1;
    const slides = [];

    for (let i = 0; i < historyPosts.length; i += postsPerSlide) {
        slides.push(historyPosts.slice(i, i + postsPerSlide));
    }

    let carouselHTML = '';
    
    slides.forEach((slide, index) => {
        const isActive = index === 0 ? 'active' : '';
        carouselHTML += `<div class="carousel-item ${isActive}">`;
        
        if (window.innerWidth >= 768) {
            // Desktop: Mostrar 3 cards por slide
            carouselHTML += '<div class="row">';
            slide.forEach(post => {
                carouselHTML += `
                    <div class="col-md-4 mb-4">
                        ${generatePostCard(post)}
                    </div>
                `;
            });
            carouselHTML += '</div>';
        } else {
            // Móvil: Scroll horizontal
            carouselHTML += `
                <div class="mobile-scroll-container">
                    <div class="mobile-scroll-wrapper">
            `;
            historyPosts.forEach(post => {
                carouselHTML += generateMobileCard(post);
            });
            carouselHTML += `
                    </div>
                </div>
            `;
        }
        
        carouselHTML += '</div>';
    });

    carouselInner.innerHTML = carouselHTML;
}

// Generar card para desktop
function generatePostCard(post) {
    const imageUrl = post.imageUrl || 'assets/279173196_109644341734170_7397879930178052213_n.jpg';
    const date = formatDate(post.createdAt);
    
    return `
        <div class="post-card card h-100 shadow-sm" onclick="openPostModal('${post.id}')">
            <div class="card-img-container">
                <img src="${imageUrl}" class="card-img-top" alt="${post.title || 'Imagen de publicación'}" />
                <div class="card-overlay">
                    <i class="bi bi-eye-fill"></i>
                </div>
            </div>
            <div class="card-body d-flex flex-column">
                <div class="badge bg-primary rounded-pill align-self-start mb-2">
                    ${post.category || 'Iglesia'}
                </div>
                <h5 class="card-title">${post.title || 'Sin título'}</h5>
                <p class="card-text flex-grow-1">
                    ${(post.description || '').substring(0, 100)}${(post.description || '').length > 100 ? '...' : ''}
                </p>
            </div>
            <div class="card-footer bg-transparent border-0">
                <small class="text-primary fw-bold">
                    <i class="bi bi-calendar3 me-1"></i>
                    ${date}
                </small>
            </div>
        </div>
    `;
}

// Generar card para móvil
function generateMobileCard(post) {
    const imageUrl = post.imageUrl || 'assets/279173196_109644341734170_7397879930178052213_n.jpg';
    const date = formatDate(post.createdAt);
    
    return `
        <div class="mobile-card" onclick="openPostModal('${post.id}')">
            <div class="mobile-card-img">
                <img src="${imageUrl}" alt="${post.title || 'Imagen de publicación'}" />
                <div class="mobile-card-overlay">
                    <i class="bi bi-eye-fill"></i>
                </div>
            </div>
            <div class="mobile-card-content">
                <h6 class="mobile-card-title">${post.title || 'Sin título'}</h6>
                <p class="mobile-card-text">
                    ${(post.description || '').substring(0, 80)}${(post.description || '').length > 80 ? '...' : ''}
                </p>
                <div class="mobile-card-date">${date}</div>
            </div>
        </div>
    `;
}

// Abrir modal de publicación
function openPostModal(postId) {
    const post = allPosts.find(p => p.id === postId);
    if (!post) return;

    const imageUrl = post.imageUrl || 'assets/279173196_109644341734170_7397879930178052213_n.jpg';
    const date = formatDate(post.createdAt);

    // Crear modal dinámicamente con mejor accesibilidad
    const modalHTML = `
        <div class="modal fade" id="postModal" tabindex="-1" aria-labelledby="postModalLabel">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h1 class="modal-title fs-5" id="postModalLabel">${post.title || 'Sin título'}</h1>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-0">
                        <div class="modal-image-container">
                            <img src="${imageUrl}" class="w-100" alt="${post.title || 'Imagen de publicación'}" />
                        </div>
                        <div class="p-4">
                            <div class="d-flex align-items-center mb-3">
                                <span class="badge bg-primary rounded-pill me-2">${post.category || 'Iglesia'}</span>
                                <small class="text-muted">
                                    <i class="bi bi-calendar3 me-1"></i>
                                    ${date}
                                </small>
                            </div>
                            <div class="post-content">
                                ${(post.description || '').replace(/\n/g, '<br>')}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        <button type="button" class="btn btn-primary" onclick="sharePost('${post.id}')">
                            <i class="bi bi-share me-1"></i>
                            Compartir
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remover modal existente si existe
    const existingModal = document.getElementById('postModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Agregar modal al body
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Mostrar modal con mejor manejo de accesibilidad
    const modalElement = document.getElementById('postModal');
    const modal = new bootstrap.Modal(modalElement, {
        backdrop: true,
        keyboard: true,
        focus: true
    });
    
    // Mejorar accesibilidad
    modalElement.addEventListener('shown.bs.modal', function () {
        // Asegurar que aria-hidden se elimine cuando el modal está visible
        this.removeAttribute('aria-hidden');
        // Enfocar el botón de cerrar como fallback
        const closeButton = this.querySelector('.btn-close');
        if (closeButton) closeButton.focus();
    });
    
    modalElement.addEventListener('hidden.bs.modal', function () {
        // Restaurar aria-hidden cuando se oculta
        this.setAttribute('aria-hidden', 'true');
        // Limpiar modal del DOM
        this.remove();
    });
    
    modal.show();
}

// Compartir publicación
function sharePost(postId) {
    const post = allPosts.find(p => p.id === postId);
    if (!post) return;

    if (navigator.share) {
        navigator.share({
            title: post.title || 'Publicación de Iglesia Rey de Paz',
            text: (post.description || '').substring(0, 100) + '...',
            url: window.location.href
        });
    } else {
        // Fallback: copiar al portapapeles
        const textToCopy = `${post.title || 'Publicación de Iglesia Rey de Paz'}\n\n${(post.description || '').substring(0, 200)}...\n\n${window.location.href}`;
        
        navigator.clipboard.writeText(textToCopy).then(() => {
            showToast('Enlace copiado al portapapeles');
        }).catch(() => {
            showToast('No se pudo copiar el enlace');
        });
    }
}

// Mostrar notificación toast
function showToast(message) {
    // Crear toast
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Mostrar toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    // Ocultar toast después de 3 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 400);
    }, 3000);
}

// Formatear fecha
function formatDate(timestamp) {
    if (!timestamp) return 'Fecha no disponible';
    
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        return 'Fecha no disponible';
    }
}

// Scroll to top
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// Mostrar detalles de evento
function showEventDetails(eventId) {
    const event = allEvents.find(e => e.id === eventId);
    if (!event) {
        return;
    }

    const fullDate = formatFullEventDate(event.eventDate);
    const colorClass = getEventColorClass(event.color || 'primary');

    // Crear modal dinámicamente con mejor accesibilidad
    const modalHTML = `
        <div class="modal fade" id="eventModal" tabindex="-1" aria-labelledby="eventModalLabel">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-${colorClass} text-white">
                        <h1 class="modal-title fs-5" id="eventModalLabel">
                            <i class="bi bi-calendar-event me-2"></i>
                            ${event.title}
                        </h1>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label class="fw-bold text-muted small">TIPO DE EVENTO</label>
                                    <div class="d-flex align-items-center mt-1">
                                        <span class="badge bg-${colorClass} me-2">${event.type}</span>
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="fw-bold text-muted small">FECHA Y HORA</label>
                                    <div class="mt-1">
                                        <i class="bi bi-calendar3 me-2 text-primary"></i>
                                        ${fullDate}
                                    </div>
                                </div>
                            </div>
                            
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label class="fw-bold text-muted small">ESTADO</label>
                                    <div class="mt-1">
                                        <span class="badge ${getStatusBadgeClass(event.status)} fs-6">
                                            ${getStatusText(event.status)}
                                        </span>
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="fw-bold text-muted small">UBICACIÓN</label>
                                    <div class="mt-1">
                                        <i class="bi bi-geo-alt me-2 text-primary"></i>
                                        Iglesia Rey de Paz - Santa Bárbara
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <label class="fw-bold text-muted small">DESCRIPCIÓN</label>
                            <div class="mt-2 p-3 bg-light rounded">
                                ${event.description.replace(/\n/g, '<br>')}
                            </div>
                        </div>
                        
                        <div class="alert alert-info" role="alert">
                            <i class="bi bi-info-circle me-2"></i>
                            Para más información o confirmación de asistencia, contáctanos a través de nuestras redes sociales.
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        <button type="button" class="btn btn-primary" onclick="shareEvent('${event.id}')">
                            <i class="bi bi-share me-1"></i>
                            Compartir evento
                        </button>
                        <a href="contact.html" class="btn btn-success">
                            <i class="bi bi-envelope me-1"></i>
                            Más información
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remover modal existente si existe
    const existingModal = document.getElementById('eventModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Agregar modal al body
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Mostrar modal con mejor manejo de accesibilidad
    const modalElement = document.getElementById('eventModal');
    const modal = new bootstrap.Modal(modalElement, {
        backdrop: true,
        keyboard: true,
        focus: true
    });
    
    // Mejorar accesibilidad
    modalElement.addEventListener('shown.bs.modal', function () {
        // Asegurar que aria-hidden se elimine cuando el modal está visible
        this.removeAttribute('aria-hidden');
        // Enfocar el primer elemento interactivo
        const firstFocusable = this.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) firstFocusable.focus();
    });
    
    modalElement.addEventListener('hidden.bs.modal', function () {
        // Restaurar aria-hidden cuando se oculta
        this.setAttribute('aria-hidden', 'true');
        // Limpiar modal del DOM
        this.remove();
    });
    
    modal.show();
}

// Compartir evento
function shareEvent(eventId) {
    const event = allEvents.find(e => e.id === eventId);
    if (!event) return;

    const fullDate = formatFullEventDate(event.eventDate);
    const shareText = `🎉 ${event.title}\n\n📅 ${fullDate}\n📍 Iglesia Rey de Paz - Santa Bárbara\n\n${event.description}\n\n#IglesiaReyDePaz #Eventos`;

    if (navigator.share) {
        navigator.share({
            title: `Evento: ${event.title}`,
            text: shareText,
            url: window.location.href
        });
    } else {
        // Fallback: copiar al portapapeles
        navigator.clipboard.writeText(shareText + `\n\n${window.location.href}`).then(() => {
            showToast('Información del evento copiada al portapapeles');
        }).catch(() => {
            showToast('No se pudo copiar la información');
        });
    }
}

// Función auxiliar para obtener clase de estado
function getStatusBadgeClass(status) {
    switch (status) {
        case 'activo': return 'bg-success';
        case 'cancelado': return 'bg-danger';
        case 'completado': return 'bg-secondary';
        default: return 'bg-warning';
    }
}

// Función auxiliar para obtener texto de estado
function getStatusText(status) {
    switch (status) {
        case 'activo': return 'Confirmado';
        case 'cancelado': return 'Cancelado';
        case 'completado': return 'Finalizado';
        default: return 'Pendiente';
    }
}

// Hacer funciones globales para HTML inline handlers
window.openPostModal = openPostModal;
window.sharePost = sharePost;
window.scrollToTop = scrollToTop;
window.showEventDetails = showEventDetails;
window.shareEvent = shareEvent;

// Hacer funciones de debug globales
window.displayUpcomingEvents = displayUpcomingEvents;
window.allEvents = allEvents;

// Responsive: Recargar carrusel en resize
window.addEventListener('resize', debounce(() => {
    displayHistoryCarousel();
}, 250));

// Utility: Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Events.js - Gestión de eventos dinámicos para pages/events.html 