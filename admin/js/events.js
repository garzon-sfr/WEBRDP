import { db } from "./firebase.js";
import { doc, deleteDoc, collection, addDoc, getDocs, query, orderBy, where, Timestamp, updateDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// Variables globales
let eventsData = [];

// Inicializar cuando se carga el DOM
document.addEventListener('DOMContentLoaded', function() {
    initializeEventsModule();
});

// ================== EVENTS MODULE ==================

function initializeEventsModule() {
    const eventForm = document.getElementById('eventForm');
    
    if (eventForm) {
        eventForm.addEventListener('submit', handleEventSubmit);
    }
    
    loadEvents();
}

// Manejar envío del formulario de eventos
async function handleEventSubmit(event) {
    event.preventDefault();
    
    const submitButton = document.querySelector('button[type="submit"][form="eventForm"]');
    const originalText = submitButton.innerHTML;
    
    try {
        // Deshabilitar botón y mostrar loading
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>Guardando...';
        
        const eventId = document.getElementById('eventId').value;
        const eventData = {
            title: document.getElementById('eventTitle').value.trim(),
            type: document.getElementById('eventType').value,
            description: document.getElementById('eventDescription').value.trim(),
            eventDate: document.getElementById('eventDate').value,
            status: document.getElementById('eventStatus').value,
            color: document.getElementById('eventColor').value,
            updatedAt: Timestamp.now()
        };

        if (eventId) {
            // Actualizar evento existente
            await updateDoc(doc(db, 'events', eventId), eventData);
            showAlert('success', 'Evento actualizado exitosamente');
        } else {
            // Crear nuevo evento
            eventData.createdAt = Timestamp.now();
            await addDoc(collection(db, 'events'), eventData);
            showAlert('success', 'Evento creado exitosamente');
        }
        
        // Cerrar modal y limpiar formulario
        const modalElement = document.getElementById('eventModal');
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
            modal.hide();
        }
        
        event.target.reset();
        document.getElementById('eventId').value = '';
        
        // Recargar eventos
        loadEvents();
        
    } catch (error) {
        showAlert('danger', 'Error al guardar el evento');
    } finally {
        // Restaurar botón
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
}

// Cargar eventos desde Firestore
async function loadEvents() {
    try {
        const q = query(collection(db, 'events'), orderBy('eventDate', 'asc'));
        const querySnapshot = await getDocs(q);
        
        eventsData = [];
        querySnapshot.forEach((doc) => {
            eventsData.push({ id: doc.id, ...doc.data() });
        });
        
        renderEventsTable();
    } catch (error) {
        showAlert('danger', 'Error al cargar los eventos');
    }
}

// Renderizar tabla de eventos
function renderEventsTable() {
    const tbody = document.getElementById('eventsTableBody');
    
    if (!tbody) return;
    
    if (eventsData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    <i class="bi bi-calendar fs-1 d-block mb-2"></i>
                    No hay eventos disponibles
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = eventsData.map(event => `
        <tr>
            <td>
                <div class="d-flex align-items-center">
                    <div class="badge bg-${event.color || 'primary'} me-2">${formatEventDate(event.eventDate)}</div>
                </div>
            </td>
            <td>
                <strong>${event.title}</strong>
                <br><small class="text-muted">${event.type}</small>
            </td>
            <td>
                <span class="badge bg-${getTypeColor(event.type)}">${event.type}</span>
            </td>
            <td>
                <div style="max-width: 200px;">
                    ${event.description.length > 80 ? event.description.substring(0, 80) + '...' : event.description}
                </div>
            </td>
            <td>
                <span class="badge ${getStatusBadgeClass(event.status)}">
                    ${getStatusText(event.status)}
                </span>
            </td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="editEvent('${event.id}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteEvent('${event.id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Función para editar evento
window.editEvent = function(eventId) {
    const event = eventsData.find(e => e.id === eventId);
    if (!event) {
        showAlert('warning', 'Evento no encontrado');
        return;
    }

    // Llenar el formulario con los datos del evento
    document.getElementById('eventId').value = event.id;
    document.getElementById('eventTitle').value = event.title;
    document.getElementById('eventType').value = event.type;
    document.getElementById('eventDescription').value = event.description;
    document.getElementById('eventDate').value = event.eventDate;
    document.getElementById('eventStatus').value = event.status;
    document.getElementById('eventColor').value = event.color || 'primary';

    // Cambiar título del modal
    document.getElementById('eventModalLabel').innerHTML = '<i class="bi bi-pencil-square me-2"></i>Editar Evento';

    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('eventModal'));
    modal.show();
};

// Función para eliminar evento
window.deleteEvent = async function(eventId) {
    const confirmDelete = confirm('¿Estás seguro de eliminar este evento? Esta acción no se puede deshacer.');

    if (!confirmDelete) return;

    try {
        await deleteDoc(doc(db, 'events', eventId));
        showAlert('success', 'Evento eliminado correctamente');
        loadEvents();
    } catch (error) {
        showAlert('danger', 'Error al eliminar el evento');
    }
};

// ================== UTILITY FUNCTIONS ==================

// Formatear fecha del evento
function formatEventDate(dateString) {
    if (!dateString) return 'Sin fecha';
    
    try {
        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, '0');
        const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 
                       'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        const month = months[date.getMonth()];
        
        return `${day} ${month}`;
    } catch (error) {
        return 'Fecha inválida';
    }
}

// Obtener color según tipo de evento
function getTypeColor(type) {
    switch (type) {
        case 'Culto de Adoración': return 'success';
        case 'Conferencia': return 'info';
        case 'Servicio Comunitario': return 'warning';
        case 'Estudio Bíblico': return 'primary';
        case 'Actividad Juvenil': return 'secondary';
        case 'Oración': return 'success';
        default: return 'secondary';
    }
}

// Obtener clase de badge según estado
function getStatusBadgeClass(status) {
    switch (status) {
        case 'activo': return 'bg-success';
        case 'cancelado': return 'bg-danger';
        case 'completado': return 'bg-secondary';
        default: return 'bg-warning';
    }
}

// Obtener texto de estado
function getStatusText(status) {
    switch (status) {
        case 'activo': return 'Activo';
        case 'cancelado': return 'Cancelado';
        case 'completado': return 'Completado';
        default: return 'Pendiente';
    }
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

// Resetear modal al abrirlo para crear nuevo evento
document.getElementById('eventModal').addEventListener('show.bs.modal', function () {
    const eventId = document.getElementById('eventId').value;
    if (!eventId) {
        // Nuevo evento
        document.getElementById('eventModalLabel').innerHTML = '<i class="bi bi-calendar-plus me-2"></i>Agregar Nuevo Evento';
        document.getElementById('eventForm').reset();
        document.getElementById('eventId').value = '';
    }
}); 