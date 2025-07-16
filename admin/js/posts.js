import { db } from "./firebase.js";
import { doc, deleteDoc, collection, addDoc, getDocs, query, orderBy, where, Timestamp, updateDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// Variables globales
let postsData = [];
let scheduledPostsChecker;
let lastCheck = 0;
const CHECK_INTERVAL = 60000; // 1 minuto

// Inicializar cuando se carga el DOM
document.addEventListener('DOMContentLoaded', function() {
    initializePostsModule();
    
    // Inicializar reloj de hora actual
    startCurrentTimeClock();
    
    // Manejar cuando la página pierde visibilidad
    document.addEventListener('visibilitychange', handleVisibilityChange);
});

// Manejar cambios de visibilidad de la página
function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
        // Si han pasado más de CHECK_INTERVAL ms desde la última verificación
        const now = Date.now();
        if (now - lastCheck >= CHECK_INTERVAL) {
            checkScheduledPosts();
            lastCheck = now;
        }
    }
}

// Función para verificar y publicar posts programados
async function checkScheduledPosts() {
    // Evitar verificaciones muy frecuentes
    const now = Date.now();
    if (now - lastCheck < CHECK_INTERVAL) {
        return;
    }
    lastCheck = now;

    try {
        // Usar método simple: obtener todos los posts programados y filtrar
        const scheduledQuery = query(
            collection(db, 'posts'),
            where('status', '==', 'scheduled')
        );
        
        const allScheduled = await getDocs(scheduledQuery);
        
        if (allScheduled.size === 0) {
            return;
        }
        
        const currentTime = Timestamp.now();
        const postsToPublish = [];
        
        // Filtrar posts que ya deben publicarse
        allScheduled.forEach(doc => {
            const data = doc.data();
            const postRef = doc.ref;
            
            if (data.scheduledFor && data.scheduledFor <= currentTime) {
                postsToPublish.push({ ref: postRef, data: data });
            }
        });

        // Publicar posts que ya alcanzaron su fecha programada
        if (postsToPublish.length > 0) {
            const updatePromises = postsToPublish.map(async ({ ref, data }) => {
                try {
                    await updateDoc(ref, {
                        status: 'published',
                        scheduledFor: null,
                        publishedAt: Timestamp.now(),
                        updatedAt: Timestamp.now()
                    });
                    return true;
                } catch (updateError) {
                    return false;
                }
            });

            const results = await Promise.all(updatePromises);
            const successCount = results.filter(result => result === true).length;
            
            if (successCount > 0) {
                loadPosts(); // Recargar la tabla
                showAlert('success', `${successCount} posts programados han sido publicados`);
            }
        }
        
    } catch (error) {
        // Mostrar mensaje específico según el error
        if (error.message && error.message.includes('net::ERR_BLOCKED_BY_CLIENT')) {
            showAlert('warning', 'Conexión bloqueada. Desactiva tu bloqueador de anuncios para este sitio.');
        }
    }
}

// ================== POSTS MODULE ==================

function initializePostsModule() {
    const quickPostForm = document.getElementById('quickPostForm');
    const postImageInput = document.getElementById('postImage');
    
    if (quickPostForm) {
        quickPostForm.addEventListener('submit', handlePostSubmit);
        
        // Inicializar selector de hora
        initializeTimeSelector();
        
        // Manejar cambio en tipo de publicación
        document.getElementById('publishNow')?.addEventListener('change', function() {
            const scheduleContainer = document.getElementById('scheduleContainer');
            scheduleContainer.classList.add('d-none');
            document.getElementById('scheduleDate').required = false;
            document.getElementById('scheduleHour').required = false;
            document.getElementById('scheduleMinute').required = false;
            // Limpiar y deshabilitar selectores
            document.getElementById('scheduleDate').value = '';
            document.getElementById('scheduleHour').innerHTML = '<option value="">Hora</option>';
            document.getElementById('scheduleMinute').innerHTML = '<option value="">Min</option>';
            document.getElementById('scheduleHour').disabled = true;
            document.getElementById('scheduleMinute').disabled = true;
            // Repoblar minutos
            populateMinutes();
        });
        
        document.getElementById('publishLater')?.addEventListener('change', function() {
            const scheduleContainer = document.getElementById('scheduleContainer');
            scheduleContainer.classList.remove('d-none');
            document.getElementById('scheduleDate').required = true;
            document.getElementById('scheduleHour').required = true;
            document.getElementById('scheduleMinute').required = true;
            
            // Establecer fecha mínima como hoy
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('scheduleDate').min = today;

            // Limpiar selectores de hora
            document.getElementById('scheduleDate').value = '';
            document.getElementById('scheduleHour').innerHTML = '<option value="">Hora</option>';
            document.getElementById('scheduleHour').disabled = true;
            document.getElementById('scheduleMinute').disabled = true;
            // Repoblar minutos
            populateMinutes();
        });

        // Manejar cambio de fecha
        document.getElementById('scheduleDate')?.addEventListener('change', function() {
            const selectedDate = this.value;
            const hourSelect = document.getElementById('scheduleHour');
            const minuteSelect = document.getElementById('scheduleMinute');
            
            if (!selectedDate) {
                hourSelect.disabled = true;
                minuteSelect.disabled = true;
                hourSelect.value = '';
                minuteSelect.value = '';
                return;
            }

            // Habilitar selectores de hora y actualizar opciones
            updateTimeOptions(selectedDate);
        });
    }
    
    if (postImageInput) {
        postImageInput.addEventListener('change', handleImagePreview);
    }
    
    loadPosts();

    // Iniciar verificador de posts programados
    // Verificar cada minuto
    checkScheduledPosts(); // Verificar inmediatamente al cargar
    scheduledPostsChecker = setInterval(checkScheduledPosts, 60000);

    // Limpiar el intervalo cuando se cierra la página
    window.addEventListener('unload', () => {
        if (scheduledPostsChecker) {
            clearInterval(scheduledPostsChecker);
        }
    });
}

// Manejar vista previa de imagen
function handleImagePreview(event) {
    const file = event.target.files[0];
    const previewContainer = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    
    if (!previewContainer || !previewImg) {
        console.warn('Elementos de vista previa no encontrados');
        return;
    }
    
    if (file && file.type.startsWith('image/')) {
        // Validar tamaño de archivo (40MB máximo)
        if (file.size > 40 * 1024 * 1024) {
            showAlert('warning', 'El archivo debe ser menor a 40MB');
            event.target.value = '';
            previewContainer.classList.add('d-none');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImg.src = e.target.result;
            previewContainer.classList.remove('d-none');
        };
        reader.readAsDataURL(file);
    } else {
        previewContainer.classList.add('d-none');
        if (file) {
            showAlert('warning', 'Por favor selecciona un archivo de imagen válido');
            event.target.value = '';
        }
    }
}
window.deletePost = async function(postId) {
    const confirmDelete = confirm('¿Estás seguro de eliminar este post? Esta acción no se puede deshacer.');

    if (!confirmDelete) return;

    try {
        const post = postsData.find(p => p.id === postId);
        
        // 1. Eliminar archivo en VPS (si existe URL)
        if (post.imageUrl) {
            const filename = decodeURIComponent(post.imageUrl.split('/').pop());
            await fetch("https://storage.cjetechnology.org/delete.php", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename })
            });
        }

        // 2. Eliminar en Firestore
        await deleteDoc(doc(db, 'posts', postId));

        showAlert('success', 'Post eliminado correctamente');
        loadPosts();
    } catch (error) {
        console.error('Error al eliminar post:', error);
        showAlert('danger', 'Error al eliminar el post');
    }
};
// Manejar envío del formulario de posts
async function handlePostSubmit(event) {
    event.preventDefault();
    
    // Encontrar el botón de submit que está en el modal footer
    const submitButton = document.querySelector('button[type="submit"][form="quickPostForm"]');
    if (!submitButton) {
        showAlert('danger', 'Error: No se encontró el botón de envío');
        return;
    }
    const originalText = submitButton.innerHTML;
    
    try {
        // Deshabilitar botón y mostrar loading
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Creando...';
        
        const formData = new FormData(event.target);
        const publishType = document.querySelector('input[name="publishType"]:checked').value;
        const scheduleDate = document.getElementById('scheduleDate').value;
        const scheduleHour = document.getElementById('scheduleHour').value;
        const scheduleMinute = document.getElementById('scheduleMinute').value;
        
        // Validar fecha y hora de programación si es necesario
        if (publishType === 'later') {
            if (!scheduleDate) {
                showAlert('warning', 'Por favor selecciona una fecha de publicación');
                return;
            }
            if (!scheduleHour) {
                showAlert('warning', 'Por favor selecciona una hora de publicación');
                return;
            }
            if (!scheduleMinute) {
                showAlert('warning', 'Por favor selecciona los minutos de publicación');
                return;
            }

            // Combinar fecha y hora
            const scheduleTime = `${scheduleHour}:${scheduleMinute}`;
            const scheduledDateTime = new Date(scheduleDate + 'T' + scheduleTime);
            const now = new Date();

            if (scheduledDateTime <= now) {
                showAlert('warning', 'La fecha y hora de programación deben ser futuras');
                return;
            }
        }

        const postData = {
            title: document.getElementById('postTitle').value.trim(),
            description: document.getElementById('postDescription').value.trim(),
            category: document.getElementById('postCategory').value,
            createdAt: Timestamp.now()
        };

        // Configurar estado y programación
        if (publishType === 'now') {
            postData.status = 'published';
            postData.publishedAt = Timestamp.now();
        } else {
            // Combinar hora y minutos para crear la hora completa
            const scheduleTime = `${scheduleHour}:${scheduleMinute}`;
            postData.status = 'scheduled';
            postData.scheduledFor = Timestamp.fromDate(new Date(scheduleDate + 'T' + scheduleTime));
        }
        
        // Subir imagen
        const imageFile = document.getElementById('postImage').files[0];
        if (imageFile) {
            const imageUrl = await subirImagenAVPS(imageFile);
            postData.imageUrl = imageUrl;
        }
        
        // Guardar en Firestore
        await addDoc(collection(db, 'posts'), postData);
        
        // Mostrar éxito
        showAlert('success', 'Post creado exitosamente');
        
        // Cerrar modal y limpiar formulario
        const modalElement = document.getElementById('quickPostModal');
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
            modal.hide();
        }
        
        event.target.reset();
        const imagePreview = document.getElementById('imagePreview');
        if (imagePreview) {
            imagePreview.classList.add('d-none');
        }
        
        // Recargar posts
        loadPosts();
        
    } catch (error) {
        console.error('Error al crear post:', error);
        showAlert('danger', 'Error al crear el post');
    } finally {
        // Restaurar botón
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
}
async function subirImagenAVPS(imageFile) {
    const formData = new FormData();
    formData.append("image", imageFile);
  
    const response = await fetch("https://storage.cjetechnology.org/upload.php", {
      method: "POST",
      body: formData,
    });
  
    const result = await response.json();
    if (result.success) {
      return result.url;
    } else {
      throw new Error(result.message || "Error al subir la imagen.");
    }
  }
  

// Cargar posts desde Firestore
async function loadPosts() {
    try {
        const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        postsData = [];
        querySnapshot.forEach((doc) => {
            postsData.push({ id: doc.id, ...doc.data() });
        });
        
        renderPostsTable();
    } catch (error) {
        console.error('Error al cargar posts:', error);
        showAlert('danger', 'Error al cargar los posts');
    }
}

// Renderizar tabla de posts
function renderPostsTable() {
    const tbody = document.getElementById('postsTableBody');
    
    if (!tbody) return;
    
    if (postsData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    <i class="bi bi-file-text fs-1 d-block mb-2"></i>
                    No hay posts disponibles
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = postsData.map(post => `
        <tr>
            <td>
                <img src="${post.imageUrl || 'https://via.placeholder.com/60x40'}" 
                     alt="${post.title}" class="img-thumbnail" style="width: 60px; height: 40px; object-fit: cover;">
            </td>
            <td>
                <strong>${post.title}</strong>
                <br><small class="text-muted">${post.category}</small>
            </td>
            <td>
                <div style="max-width: 200px;">
                    ${post.description.length > 100 ? post.description.substring(0, 100) + '...' : post.description}
                </div>
            </td>
            <td>
                <small>
                    Creado: ${formatDate(post.createdAt)}
                    ${post.publishedAt ? `<br>Publicado: ${formatDate(post.publishedAt)}` : ''}
                    ${post.updatedAt ? '<br><span class="text-muted">(Editado)</span>' : ''}
                </small>
            </td>
            <td>
                <span class="badge ${getStatusBadgeClass(post.status)}">
                    ${getStatusText(post.status)}
                </span>
                ${post.scheduledFor ? 
                    `<br><small class="text-${isScheduledSoon(post.scheduledFor) ? 'danger' : 'muted'}">
                        Programado: ${formatDate(post.scheduledFor)}
                    </small>` 
                    : ''}
            </td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="editPost('${post.id}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="deletePost('${post.id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}



// ================== UTILITY FUNCTIONS ==================

// Función para mostrar la hora actual en tiempo real
function startCurrentTimeClock() {
    function updateCurrentTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        
        // Actualizar en modal de crear post
        const currentTimeEl = document.getElementById('currentTime');
        if (currentTimeEl) {
            currentTimeEl.textContent = timeString;
        }
        
        // Actualizar en modal de editar post
        const editCurrentTimeEl = document.getElementById('editCurrentTime');
        if (editCurrentTimeEl) {
            editCurrentTimeEl.textContent = timeString;
        }
    }
    
    // Actualizar inmediatamente
    updateCurrentTime();
    
    // Actualizar cada segundo
    setInterval(updateCurrentTime, 1000);
}

// Inicializar selector de hora
function initializeTimeSelector() {
    const hourSelect = document.getElementById('scheduleHour');
    const minuteSelect = document.getElementById('scheduleMinute');
    if (!hourSelect || !minuteSelect) return;

    // Mantener los selects deshabilitados hasta que se seleccione fecha
    hourSelect.disabled = true;
    minuteSelect.disabled = true;

    // Poblar minutos (intervalos de 15 minutos)
    populateMinutes();

    // Manejar cambio de hora
    hourSelect.addEventListener('change', function() {
        validateScheduledTime();
    });

    // Manejar cambio de minutos
    minuteSelect.addEventListener('change', function() {
        validateScheduledTime();
    });
}

// Poblar opciones de minutos
function populateMinutes() {
    const minuteSelect = document.getElementById('scheduleMinute');
    if (!minuteSelect) return;

    minuteSelect.innerHTML = '<option value="">Min</option>';
    
    // Todos los minutos de 00 a 59
    for (let minute = 0; minute < 60; minute++) {
        const option = document.createElement('option');
        option.value = minute.toString().padStart(2, '0');
        option.textContent = minute.toString().padStart(2, '0');
        minuteSelect.appendChild(option);
    }
}

// Validar que la hora seleccionada sea válida para la fecha
function validateScheduledTime() {
    const dateInput = document.getElementById('scheduleDate');
    const hourSelect = document.getElementById('scheduleHour');
    const minuteSelect = document.getElementById('scheduleMinute');
    
    if (!dateInput.value || !hourSelect.value || !minuteSelect.value) return;

    const timeString = `${hourSelect.value}:${minuteSelect.value}`;
    const selectedDateTime = new Date(dateInput.value + 'T' + timeString);
    const now = new Date();
    const isToday = selectedDateTime.toDateString() === now.toDateString();

    // Si es hoy y la fecha/hora es pasada
    if (isToday && selectedDateTime <= now) {
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const selectedHour = parseInt(hourSelect.value);
        const selectedMinute = parseInt(minuteSelect.value);
        
        // Mensaje más específico según el caso
        if (selectedHour < currentHour) {
            showAlert('warning', 'No puedes seleccionar una hora pasada. Hora actual: ' + now.toLocaleTimeString('es-CO', {hour: '2-digit', minute: '2-digit'}));
        } else if (selectedHour === currentHour && selectedMinute <= currentMinute) {
            showAlert('warning', `Selecciona minutos futuros. Son las ${now.toLocaleTimeString('es-CO', {hour: '2-digit', minute: '2-digit'})} - Selecciona minuto ${currentMinute + 1} o posterior.`);
        }
        
        // Limpiar selección
        minuteSelect.value = '';
    }
}

// Actualizar opciones de hora basado en la fecha seleccionada
function updateTimeOptions(selectedDate) {
    const hourSelect = document.getElementById('scheduleHour');
    const minuteSelect = document.getElementById('scheduleMinute');
    if (!hourSelect || !minuteSelect) return;

    if (!selectedDate) {
        hourSelect.disabled = true;
        minuteSelect.disabled = true;
        hourSelect.innerHTML = '<option value="">Hora</option>';
        return;
    }

    // Validar que la fecha sea hoy o futura
    const now = new Date();
    const selected = new Date(selectedDate + 'T00:00:00'); // Asegurar formato correcto
    const isToday = selected.toDateString() === now.toDateString();
    const isFuture = selected.getTime() > now.getTime();
    
    // Verificar si la fecha es pasada (anterior a hoy)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const selectedStart = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate());
    const isPast = selectedStart.getTime() < todayStart.getTime();

    if (isPast) {
        hourSelect.disabled = true;
        minuteSelect.disabled = true;
        hourSelect.innerHTML = '<option value="">Fecha pasada</option>';
        showAlert('warning', 'No se puede programar para fechas pasadas');
        return;
    }

    // Habilitar los selects
    hourSelect.disabled = false;
    minuteSelect.disabled = false;
    
    // Limpiar y repoblar horas
    hourSelect.innerHTML = '<option value="">Hora</option>';
    
    // Repoblar minutos cada vez que se selecciona una fecha
    populateMinutes();

    // Generar opciones de hora
    let startHour = 0;
    if (isToday) {
        // Si es hoy, empezar desde la hora actual (permitir hora actual)
        startHour = now.getHours();
    }

    // Agregar opciones de hora de startHour a 23
    for (let hour = startHour; hour < 24; hour++) {
        const option = document.createElement('option');
        option.value = hour.toString().padStart(2, '0');
        
        // Formato 12 horas para mejor UX
        const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const ampm = hour < 12 ? 'AM' : 'PM';
        
        // Marcar hora actual con indicador
        if (isToday && hour === now.getHours()) {
            option.textContent = `${hour12} ${ampm} (actual)`;
        } else {
            option.textContent = `${hour12} ${ampm}`;
        }
        
        hourSelect.appendChild(option);
    }

    // Si es hoy y ya no hay horas disponibles (después de las 23:59)
    if (isToday && startHour >= 24) {
        hourSelect.innerHTML = '<option value="">Sin horas</option>';
        hourSelect.disabled = true;
        minuteSelect.disabled = true;
        populateMinutes(); // Asegurar que los minutos estén poblados
        minuteSelect.disabled = true;
        showAlert('info', 'Ya no hay horas disponibles para hoy. Selecciona una fecha futura.');
    }
    
    // Si es muy tarde en el día actual, mostrar aviso
    if (isToday && now.getHours() >= 23) {
        const availableMinutes = 59 - now.getMinutes();
        if (availableMinutes <= 5) {
            showAlert('info', `Quedan pocos minutos disponibles para hoy (${availableMinutes} min). Considera seleccionar mañana.`);
        }
    }
}

// Verificar si un post está próximo a publicarse (menos de 1 hora)
function isScheduledSoon(timestamp) {
    if (!timestamp) return false;
    const scheduledDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMinutes = (scheduledDate - now) / (1000 * 60);
    return diffMinutes <= 60 && diffMinutes > 0;
}

// Obtener clase de badge según estado
function getStatusBadgeClass(status) {
    switch (status) {
        case 'published': return 'bg-success';
        case 'scheduled': return 'bg-info';
        default: return 'bg-warning';
    }
}

// Obtener texto de estado
function getStatusText(status) {
    switch (status) {
        case 'published': return 'Publicado';
        case 'scheduled': return 'Programado';
        default: return 'Borrador';
    }
}

// Formatear fecha
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Formatear números
function formatNumber(num) {
    return new Intl.NumberFormat('es-CO').format(num || 0);
}

// Mostrar alertas
function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Auto-eliminar después de 5 segundos
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}



// Funciones globales para botones
window.editPost = async function(postId) {
    const post = postsData.find(p => p.id === postId);
    if (!post) {
        showAlert('warning', 'Post no encontrado');
        return;
    }

    // Llenar el formulario con los datos del post
    document.getElementById('editPostId').value = post.id;
    document.getElementById('editPostTitle').value = post.title;
    document.getElementById('editPostCategory').value = post.category;
    document.getElementById('editPostDescription').value = post.description;

    // Configurar estado de publicación
    if (post.scheduledFor) {
        document.getElementById('editPublishLater').checked = true;
        document.getElementById('editScheduleContainer').classList.remove('d-none');
        // Convertir Timestamp a formato datetime-local
        const date = post.scheduledFor.toDate();
        const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
        document.getElementById('editScheduleDate').value = localDateTime;
    } else {
        document.getElementById('editPublishNow').checked = true;
        document.getElementById('editScheduleContainer').classList.add('d-none');
    }

    // Mostrar imagen actual
    if (post.imageUrl) {
        document.getElementById('currentImage').src = post.imageUrl;
        document.getElementById('currentImageContainer').classList.remove('d-none');
    } else {
        document.getElementById('currentImageContainer').classList.add('d-none');
    }

    // Configurar eventos de radio buttons
    document.getElementById('editPublishNow').addEventListener('change', function() {
        document.getElementById('editScheduleContainer').classList.add('d-none');
    });
    document.getElementById('editPublishLater').addEventListener('change', function() {
        document.getElementById('editScheduleContainer').classList.remove('d-none');
    });

    // Configurar envío del formulario
    const form = document.getElementById('editPostForm');
    form.onsubmit = async function(e) {
        e.preventDefault();
        await handleEditPostSubmit(post);
    };

    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('editPostModal'));
    modal.show();
};

// Manejar envío del formulario de edición
async function handleEditPostSubmit(originalPost) {
    const submitButton = document.querySelector('button[type="submit"][form="editPostForm"]');
    const originalText = submitButton.innerHTML;
    
    try {
        // Deshabilitar botón y mostrar loading
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Guardando...';
        
        const postData = {
            title: document.getElementById('editPostTitle').value.trim(),
            description: document.getElementById('editPostDescription').value.trim(),
            category: document.getElementById('editPostCategory').value,
            imageUrl: originalPost.imageUrl, // Mantener la imagen original
            updatedAt: Timestamp.now()
        };

        // Manejar programación
        const publishType = document.querySelector('input[name="editPublishType"]:checked').value;
        if (publishType === 'now') {
            postData.status = 'published';
            postData.scheduledFor = null;
        } else {
            const scheduleDate = new Date(document.getElementById('editScheduleDate').value);
            if (isNaN(scheduleDate.getTime())) {
                throw new Error('Fecha de programación inválida');
            }
            postData.status = 'scheduled';
            postData.scheduledFor = Timestamp.fromDate(scheduleDate);
        }

        // Actualizar en Firestore
        const postRef = doc(db, 'posts', originalPost.id);
        await updateDoc(postRef, postData);
        
        // Mostrar éxito
        showAlert('success', 'Post actualizado exitosamente');
        
        // Cerrar modal
        const modalElement = document.getElementById('editPostModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        modal.hide();
        
        // Recargar posts
        loadPosts();
        
    } catch (error) {
        console.error('Error al actualizar post:', error);
        showAlert('danger', error.message || 'Error al actualizar el post');
    } finally {
        // Restaurar botón
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
};

// Función para eliminar donaciones
window.deleteDonation = async function(donationId) {
    const confirmDelete = confirm('¿Estás seguro de eliminar esta donación? Esta acción no se puede deshacer.');
    
    if (!confirmDelete) return;
    
    try {
        // Eliminar documento en Firestore
        await deleteDoc(doc(db, 'donaciones', donationId));
        
        showAlert('success', 'Donación eliminada correctamente');
        
        // Recargar donaciones usando el evento personalizado para que donations.js se actualice
        window.dispatchEvent(new CustomEvent('donationDeleted'));
        
    } catch (error) {
        console.error('Error al eliminar donación:', error);
        showAlert('danger', 'Error al eliminar la donación');
    }
};

window.viewDonation = function(donationId) {
    // Obtener donación desde el módulo principal de donations.js
    if (window.currentDonations && window.currentDonations.length > 0) {
        const donation = window.currentDonations.find(d => d.id === donationId);
        if (donation) {
            showDonationModal(donation);
            return;
        }
    }
    
    showAlert('warning', 'Donación no encontrada');
};

window.printReceipt = function(donationId) {
    // Obtener donación desde el módulo principal de donations.js
    if (window.currentDonations && window.currentDonations.length > 0) {
        const donation = window.currentDonations.find(d => d.id === donationId);
        if (donation) {
            generateReceipt(donation);
            return;
        }
    }
    
    showAlert('warning', 'Donación no encontrada');
};

// Función para mostrar modal de donación
function showDonationModal(donation) {
    const modalHtml = `
        <div class="modal fade" id="donationViewModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-info text-white">
                        <h5 class="modal-title">
                            <i class="bi bi-heart-fill me-2"></i>Detalles de Donación
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <p><strong>Donante:</strong> ${donation.donante || 'Anónimo'}</p>
                                <p><strong>Email:</strong> ${donation.email || 'N/A'}</p>
                                <p><strong>Teléfono:</strong> ${donation.telefono || 'N/A'}</p>
                            </div>
                            <div class="col-md-6">
                                <p><strong>Monto:</strong> <span class="text-success">$${formatNumber(donation.monto)}</span></p>
                                <p><strong>Método:</strong> ${donation.metodo || 'N/A'}</p>
                                <p><strong>Estado:</strong> 
                                    <span class="badge ${donation.estado === 'Confirmado' ? 'bg-success' : 'bg-warning'}">
                                        ${donation.estado || 'Pendiente'}
                                    </span>
                                </p>
                            </div>
                        </div>
                        <hr>
                        <p><strong>Categoría:</strong> ${getCategoryDisplayName(donation.categoria) || 'No especificada'}</p>
                        <p><strong>Fecha:</strong> ${formatDate(donation.fecha)}</p>
                        ${donation.comentario ? `<p><strong>Comentario:</strong> ${donation.comentario}</p>` : ''}
                        ${donation.transactionId ? `<p><strong>ID Transacción:</strong> ${donation.transactionId}</p>` : ''}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        <button type="button" class="btn btn-primary" onclick="printReceipt('${donation.id}')">
                            <i class="bi bi-printer me-2"></i>Imprimir Recibo
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Eliminar modal existente si existe
    const existingModal = document.getElementById('donationViewModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Agregar modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('donationViewModal'));
    modal.show();
    
    // Limpiar modal cuando se cierre
    document.getElementById('donationViewModal').addEventListener('hidden.bs.modal', function() {
        this.remove();
    });
}

// Función para generar recibo de donación
function generateReceipt(donation) {
    const receiptWindow = window.open('', '_blank');
    
    // Generar número de recibo único
    const receiptNumber = `RDP-${Date.now().toString().slice(-8)}`;
    const currentDate = new Date().toLocaleDateString('es-ES');
    
    const receiptHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Recibo de Donación - ${receiptNumber}</title>
            <meta charset="UTF-8">
            <style>
                @page {
                    margin: 20mm;
                    size: A4;
                }
                body { 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                    padding: 0;
                    margin: 0;
                    line-height: 1.6;
                    color: #333;
                }
                .receipt-container {
                    max-width: 800px;
                    margin: 0 auto;
                    border: 2px solid #007bff;
                    border-radius: 10px;
                    overflow: hidden;
                }
                .header { 
                    background: linear-gradient(135deg, #007bff, #0056b3);
                    color: white;
                    padding: 30px 20px;
                    text-align: center;
                    position: relative;
                }
                .logo {
                    width: 80px;
                    height: 80px;
                    background: white;
                    border-radius: 50%;
                    margin: 0 auto 15px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 40px;
                    color: #007bff;
                    font-weight: bold;
                }
                .church-name {
                    font-size: 28px;
                    font-weight: bold;
                    margin-bottom: 5px;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                }
                .church-subtitle {
                    font-size: 16px;
                    opacity: 0.9;
                    margin-bottom: 15px;
                }
                .receipt-title {
                    font-size: 24px;
                    font-weight: bold;
                    background: rgba(255,255,255,0.2);
                    padding: 10px 20px;
                    border-radius: 20px;
                    display: inline-block;
                }
                .receipt-info {
                    background: #f8f9fa;
                    padding: 20px;
                    border-bottom: 1px solid #dee2e6;
                }
                .receipt-number {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 10px;
                }
                .details { 
                    padding: 30px 20px;
                    background: white;
                }
                .detail-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 12px 0;
                    border-bottom: 1px solid #eee;
                }
                .detail-row:last-child {
                    border-bottom: 2px solid #007bff;
                    font-weight: bold;
                }
                .detail-label {
                    color: #666;
                    font-weight: 500;
                }
                .detail-value {
                    font-weight: 600;
                    color: #333;
                }
                .amount-section {
                    background: #e8f4fd;
                    padding: 20px;
                    margin: 20px 0;
                    border-radius: 8px;
                    border-left: 5px solid #007bff;
                }
                .amount { 
                    font-size: 36px; 
                    font-weight: bold; 
                    color: #28a745;
                    text-align: center;
                    margin-bottom: 10px;
                }
                .amount-words {
                    text-align: center;
                    font-style: italic;
                    color: #666;
                    text-transform: uppercase;
                }
                .footer { 
                    background: #f8f9fa;
                    padding: 25px 20px;
                    text-align: center;
                    color: #666;
                    border-top: 1px solid #dee2e6;
                }
                .blessing {
                    font-size: 18px;
                    color: #007bff;
                    font-weight: 600;
                    margin-bottom: 15px;
                }
                .verse {
                    font-style: italic;
                    font-size: 14px;
                    margin: 15px 0;
                    padding: 15px;
                    background: white;
                    border-radius: 5px;
                    border-left: 4px solid #ffc107;
                }
                .signature-section {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #dee2e6;
                }
                .signature-box {
                    text-align: center;
                    width: 200px;
                }
                .signature-line {
                    border-top: 1px solid #333;
                    margin-top: 40px;
                    padding-top: 5px;
                    font-size: 12px;
                }
                .watermark {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) rotate(-45deg);
                    font-size: 100px;
                    color: rgba(0, 123, 255, 0.05);
                    font-weight: bold;
                    z-index: 0;
                }
                @media print {
                    body { margin: 0; }
                    .receipt-container { border: none; }
                }
            </style>
        </head>
        <body>
            <div class="receipt-container">
                <div class="watermark">REY DE PAZ</div>
                
                <!-- Header con logo -->
                <div class="header">
                    <div class="logo"><img src="../pages/assets/279173196_109644341734170_7397879930178052213_n.jpg" alt="Logo" style="height: 80px;"></div>
                    <div class="church-name">IGLESIA REY DE PAZ</div>
                    <div class="church-subtitle">Santa Bárbara, Antioquia</div>
                    <div class="receipt-title">RECIBO DE DONACIÓN</div>
                </div>
                
                <!-- Información del recibo -->
                <div class="receipt-info">
                    <div class="receipt-number">
                        <span><strong>Recibo N°:</strong> ${receiptNumber}</span>
                        <span><strong>Fecha de emisión:</strong> ${currentDate}</span>
                    </div>
                </div>
                
                <!-- Detalles de la donación -->
                <div class="details">
                    <div class="detail-row">
                        <span class="detail-label">Donante:</span>
                        <span class="detail-value">${donation.donante || 'Anónimo'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Teléfono:</span>
                        <span class="detail-value">${donation.telefono || 'No proporcionado'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Email:</span>
                        <span class="detail-value">${donation.email || 'No proporcionado'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Fecha de donación:</span>
                        <span class="detail-value">${formatDate(donation.fecha)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Tipo de donación:</span>
                        <span class="detail-value">${getCategoryDisplayName(donation.categoria) || 'No especificada'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Método de pago:</span>
                        <span class="detail-value">${donation.metodo || 'No especificado'}</span>
                    </div>
                </div>
                
                <!-- Monto principal -->
                <div class="amount-section">
                    <div class="amount">$${formatNumber(donation.monto)} COP</div>
                    <div class="amount-words">
                        ${numberToWords(donation.monto)} PESOS COLOMBIANOS
                    </div>
                </div>
            </div>
            <div class="small text-center text-muted">Derechos de privacidad reservados y protegidos</div>
        </body>
        </html>
    `;
    
    receiptWindow.document.write(receiptHtml);
    receiptWindow.document.close();
    
    // Imprimir automáticamente después de cargar
    receiptWindow.onload = function() {
        receiptWindow.print();
    };
}

// Función auxiliar para convertir números a palabras (básica)
function numberToWords(num) {
    if (num === 0) return "CERO";
    
    const ones = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
    const tens = ["", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
    const hundreds = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];
    
    if (num < 10) return ones[num];
    if (num < 100) {
        if (num < 20) {
            const teens = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"];
            return teens[num - 10];
        }
        return tens[Math.floor(num/10)] + (num % 10 !== 0 ? " Y " + ones[num % 10] : "");
    }
    if (num < 1000) {
        return hundreds[Math.floor(num/100)] + (num % 100 !== 0 ? " " + numberToWords(num % 100) : "");
    }
    
    // Para números más grandes, usar formato simplificado
    return `${Math.floor(num/1000)} MIL ${num % 1000 !== 0 ? numberToWords(num % 1000) : ""}`.trim();
}

// Función auxiliar para obtener nombre de categoría
function getCategoryDisplayName(categoria) {
    const categoryNames = {
        'diezmo': 'Diezmo',
        'ofrenda': 'Ofrenda',
        'misiones': 'Misiones',
        'protempo': 'Pro-tempo',
        'apoyo_social': 'Apoyo social',
        'otro': 'Otro'
    };
    return categoryNames[categoria] || categoria;
} 