// Import Firebase modules
import { db } from './firebase.js';
import { 
    collection, 
    getDocs, 
    doc, 
    updateDoc, 
    query, 
    orderBy, 
    onSnapshot,
    deleteDoc 
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// Gestión de mensajes de contacto en el panel administrativo
class MessagesManager {
    constructor() {
        this.messages = [];
        this.currentMessage = null;
        this.unsubscribe = null; // Para el listener de Firestore
        this.filters = {
            category: '',
            status: '',
            search: ''
        };
        this.init();
    }

    init() {
        this.setupRealtimeListener();
        this.bindEvents();
        this.updateStats();
        this.renderMessages();
    }

    bindEvents() {
        // Botón de actualizar (ya no necesario con listener en tiempo real)
        document.getElementById('refreshMessages')?.addEventListener('click', () => {
            this.showNotification('Los mensajes se actualizan automáticamente', 'info');
        });

        // Marcar todos como leídos
        document.getElementById('markAllRead')?.addEventListener('click', () => {
            this.markAllAsRead();
        });

        // Filtros
        document.getElementById('applyFilters')?.addEventListener('click', () => {
            this.applyFilters();
        });

        // Eventos del modal
        document.getElementById('markAsRead')?.addEventListener('click', () => {
            this.markAsRead();
        });

        document.getElementById('saveMessageChanges')?.addEventListener('click', () => {
            this.saveChanges();
        });

        // Botón de eliminar en el modal
        document.getElementById('deleteMessageModal')?.addEventListener('click', () => {
            if (this.currentMessage) {
                this.deleteMessage(this.currentMessage.id);
            }
        });

        // Búsqueda en tiempo real
        document.getElementById('searchMessages')?.addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.renderMessages();
        });

        // Eventos de los botones de acción en la tabla
        const tbody = document.getElementById('messagesTableBody');
        if (tbody) {
            tbody.addEventListener('click', (e) => {
                const button = e.target.closest('button');
                if (!button) return;

                const messageId = button.dataset.messageId;
                if (!messageId) return;

                if (button.classList.contains('view-message')) {
                    this.viewMessage(messageId);
                } else if (button.classList.contains('mark-read')) {
                    this.quickMarkAsRead(messageId);
                } else if (button.classList.contains('delete-message')) {
                    this.deleteMessage(messageId);
                }
            });
        }
    }

    setupRealtimeListener() {
        try {
            // Crear query para obtener mensajes ordenados por timestamp
            const messagesQuery = query(
                collection(db, 'contactMessages'), 
                orderBy('timestamp', 'desc')
            );

            // Configurar listener en tiempo real
            this.unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
                this.messages = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    // Convertir timestamp de Firestore a string si existe
                    if (data.timestamp && data.timestamp.toDate) {
                        data.timestamp = data.timestamp.toDate().toISOString();
                    }
                    this.messages.push({
                        id: doc.id,
                        ...data
                    });
                });
                
                console.log('Mensajes actualizados desde Firestore:', this.messages.length);
                this.updateStats();
                this.renderMessages();
            }, (error) => {
                console.error('Error en listener de Firestore:', error);
                this.showNotification('Error al cargar mensajes desde Firestore', 'error');
            });
        } catch (error) {
            console.error('Error al configurar listener:', error);
            this.messages = [];
        }
    }

    async updateMessageInFirestore(messageId, updates) {
        try {
            const messageRef = doc(db, 'contactMessages', messageId);
            await updateDoc(messageRef, updates);

        } catch (error) {

            throw error;
        }
    }

    // Método para limpiar listeners cuando sea necesario
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    updateStats() {
        const totalMessages = this.messages.length;
        const pendingMessages = this.messages.filter(m => m.status === 'nuevo').length;
        const today = new Date().toDateString();
        const newContactsToday = this.messages.filter(m => 
            new Date(m.timestamp).toDateString() === today
        ).length;
        const prayerRequests = this.messages.filter(m => m.category === 'request').length;

        // Actualizar elementos del DOM
        document.getElementById('totalMessages').textContent = totalMessages;
        document.getElementById('pendingMessages').textContent = pendingMessages;
        document.getElementById('newContactsToday').textContent = newContactsToday;
        document.getElementById('prayerRequests').textContent = prayerRequests;

        // Actualizar badge de notificación
        const badge = document.getElementById('messageBadge');
        if (badge) {
            if (pendingMessages > 0) {
                badge.classList.remove('d-none');
                badge.textContent = pendingMessages > 99 ? '99+' : pendingMessages;
            } else {
                badge.classList.add('d-none');
            }
        }
    }

    renderMessages() {
        const tbody = document.getElementById('messagesTableBody');
        if (!tbody) return;

        let filteredMessages = this.messages;

        // Aplicar filtros
        if (this.filters.category) {
            filteredMessages = filteredMessages.filter(m => m.category === this.filters.category);
        }
        
        if (this.filters.status) {
            filteredMessages = filteredMessages.filter(m => m.status === this.filters.status);
        }
        
        if (this.filters.search) {
            const search = this.filters.search.toLowerCase();
            filteredMessages = filteredMessages.filter(m => 
                m.name.toLowerCase().includes(search) || 
                m.email.toLowerCase().includes(search)
            );
        }

        // Ordenar por fecha (más recientes primero)
        filteredMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (filteredMessages.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        <i class="bi bi-envelope fs-1 d-block mb-2"></i>
                        No hay mensajes que coincidan con los filtros
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filteredMessages.map(message => `
            <tr class="${message.status === 'nuevo' ? 'table-warning' : ''}">
                <td>
                    <span class="badge ${this.getStatusBadgeClass(message.status)}">
                        ${this.getStatusText(message.status)}
                    </span>
                </td>
                <td>
                    <span class="badge ${this.getCategoryBadgeClass(message.category)}">
                        ${this.getCategoryText(message.category)}
                    </span>
                </td>
                <td>${message.name}</td>
                <td>
                    <a href="mailto:${message.email}" class="text-decoration-none">
                        ${message.email}
                    </a>
                </td>
                <td>
                    <a href="tel:${message.phone}" class="text-decoration-none">
                        ${message.phone}
                    </a>
                </td>
                <td>
                    <small>
                        ${this.formatDate(message.timestamp)}
                    </small>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary view-message" data-message-id="${message.id}" title="Ver detalles">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-outline-success mark-read" data-message-id="${message.id}" title="Marcar como leído">
                            <i class="bi bi-check"></i>
                        </button>
                        <button class="btn btn-outline-danger delete-message" data-message-id="${message.id}" title="Eliminar mensaje">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    getStatusBadgeClass(status) {
        switch (status) {
            case 'nuevo': return 'bg-warning';
            case 'leido': return 'bg-info';
            case 'respondido': return 'bg-success';
            default: return 'bg-secondary';
        }
    }

    getStatusText(status) {
        switch (status) {
            case 'nuevo': return 'Nuevo';
            case 'leido': return 'Leído';
            case 'respondido': return 'Respondido';
            default: return 'Desconocido';
        }
    }

    getCategoryBadgeClass(category) {
        switch (category) {
            case 'new': return 'bg-primary';
            case 'request': return 'bg-success';
            case 'suggestion': return 'bg-info';
            default: return 'bg-secondary';
        }
    }

    getCategoryText(category) {
        switch (category) {
            case 'new': return 'Nuevo Miembro';
            case 'request': return 'Petición';
            case 'suggestion': return 'Sugerencia';
            default: return 'Otro';
        }
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    viewMessage(messageId) {
        const message = this.messages.find(m => m.id === messageId);
        if (!message) return;

        this.currentMessage = message;

        // Llenar el modal con los datos
        document.getElementById('modalCategory').textContent = this.getCategoryText(message.category);
        document.getElementById('modalName').textContent = message.name;
        document.getElementById('modalEmail').textContent = message.email;
        document.getElementById('modalPhone').textContent = message.phone;
        document.getElementById('modalDate').textContent = this.formatDate(message.timestamp);
        document.getElementById('modalMessage').textContent = message.message;
        document.getElementById('statusSelect').value = message.status;
        document.getElementById('adminNotes').value = message.adminNotes || '';

        // Mostrar el modal
        const modal = new bootstrap.Modal(document.getElementById('messageDetailModal'));
        modal.show();

        // Marcar como leído automáticamente al abrir
        if (message.status === 'nuevo') {
            setTimeout(() => {
                this.quickMarkAsRead(messageId);
            }, 2000);
        }
    }

    markAsRead() {
        if (!this.currentMessage) return;
        this.quickMarkAsRead(this.currentMessage.id);
    }

    async quickMarkAsRead(messageId) {
        try {
            const message = this.messages.find(m => m.id === messageId);
            if (message && message.status === 'nuevo') {
                await this.updateMessageInFirestore(messageId, { status: 'leido' });
                // El listener automáticamente actualizará la UI
            }
        } catch (error) {
            console.error('Error al marcar como leído:', error);
            this.showNotification('Error al marcar el mensaje como leído', 'error');
        }
    }

    async markAllAsRead() {
        try {
            const newMessages = this.messages.filter(m => m.status === 'nuevo');
            
            if (newMessages.length === 0) {
                this.showNotification('No hay mensajes nuevos para marcar', 'info');
                return;
            }

            // Actualizar todos los mensajes nuevos en paralelo
            const updatePromises = newMessages.map(message => 
                this.updateMessageInFirestore(message.id, { status: 'leido' })
            );
            
            await Promise.all(updatePromises);
            
            // Mostrar notificación
            this.showNotification(`${newMessages.length} mensajes marcados como leídos`, 'success');
        } catch (error) {
            console.error('Error al marcar todos como leídos:', error);
            this.showNotification('Error al marcar mensajes como leídos', 'error');
        }
    }

    async saveChanges() {
        if (!this.currentMessage) return;

        try {
            const newStatus = document.getElementById('statusSelect').value;
            const adminNotes = document.getElementById('adminNotes').value;

            await this.updateMessageInFirestore(this.currentMessage.id, {
                status: newStatus,
                adminNotes: adminNotes
            });
            
            this.showNotification('Cambios guardados correctamente', 'success');
        } catch (error) {
            console.error('Error al guardar cambios:', error);
            this.showNotification('Error al guardar los cambios', 'error');
        }
    }

    async deleteMessage(messageId) {
        const message = this.messages.find(m => m.id === messageId);
        if (!message) return;

        // Confirmar antes de eliminar
        if (!confirm(`¿Estás seguro de que deseas eliminar el mensaje de ${message.name}?`)) {
            return;
        }

        try {
            // Eliminar de Firestore
            const messageRef = doc(db, 'contactMessages', messageId);
            await deleteDoc(messageRef);
            
            this.showNotification('Mensaje eliminado correctamente', 'success');
            
            // Cerrar el modal si está abierto
            if (this.currentMessage?.id === messageId) {
                const modal = document.getElementById('messageDetailModal');
                if (modal) {
                    const bsModal = bootstrap.Modal.getInstance(modal);
                    if (bsModal) bsModal.hide();
                }
            }
        } catch (error) {
            console.error('Error al eliminar mensaje:', error);
            this.showNotification('Error al eliminar el mensaje', 'error');
        }
    }

    applyFilters() {
        this.filters.category = document.getElementById('categoryFilter').value;
        this.filters.status = document.getElementById('statusFilter').value;
        this.renderMessages();
    }

    showNotification(message, type = 'info') {
        // Mapear tipos de error a clases de Bootstrap
        const typeClass = type === 'error' ? 'danger' : type;
        
        // Crear notificación toast
        const toastHtml = `
            <div class="toast align-items-center text-white bg-${typeClass} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body">
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>
        `;

        // Agregar al container de toasts (crear si no existe)
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }

        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        const toastElement = toastContainer.lastElementChild;
        const toast = new bootstrap.Toast(toastElement);
        toast.show();

        // Remover el elemento después de que se oculte
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }
}

// Inicializar cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', function() {
    window.messagesManager = new MessagesManager();

});

export default MessagesManager; 