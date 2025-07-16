// donations.js - Manejo de donaciones en el panel administrativo
import { db } from "./firebase.js";
import { 
    collection, 
    query, 
    orderBy, 
    onSnapshot, 
    doc, 
    updateDoc,
    Timestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// Variables globales
let currentDonations = [];

// Exponer currentDonations globalmente para que posts.js pueda acceder
window.currentDonations = currentDonations;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    initializeDonations();
});

// Función principal de inicialización
function initializeDonations() {
    loadDonations();
    setupEventListeners();
    
    // Escuchar evento de eliminación desde posts.js
    window.addEventListener('donationDeleted', function() {
        loadDonations();
    });
}

// Event listeners
function setupEventListeners() {
    // Botón de actualizar
    const refreshBtn = document.getElementById('refreshDonations');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadDonations);
    }

    // Botón de exportar
    const exportBtn = document.getElementById('exportDonations');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportDonationsToPDF);
    }
}

// Cargar donaciones desde Firestore
function loadDonations() {
    const donationsRef = collection(db, 'donaciones');
    const q = query(donationsRef, orderBy('timestamp', 'desc'));

    // Escuchar cambios en tiempo real
    onSnapshot(q, (snapshot) => {
        currentDonations = [];
        snapshot.forEach((doc) => {
            const donation = {
                id: doc.id,
                ...doc.data()
            };
            currentDonations.push(donation);
        });
        
        // Actualizar también la variable global
        window.currentDonations = currentDonations;
        
        renderDonationsTable();
        updateDonationsStatsByStatus();
    }, (error) => {
        console.error('Error al cargar donaciones:', error);
    });
}

// Renderizar tabla de donaciones
function renderDonationsTable() {
    const tbody = document.getElementById('donationsTableBody');
    if (!tbody) return;

    if (currentDonations.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">
                    <i class="bi bi-heart fs-1 d-block mb-2"></i>
                    No hay donaciones registradas
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = '';
    currentDonations.forEach(donation => {
        const row = document.createElement('tr');
        
        // Formatear fecha
        let fechaFormatted = 'No disponible';
        if (donation.fecha) {
            fechaFormatted = new Date(donation.fecha).toLocaleDateString('es-ES');
        } else if (donation.timestamp) {
            const timestamp = donation.timestamp.toDate ? donation.timestamp.toDate() : new Date(donation.timestamp);
            fechaFormatted = timestamp.toLocaleDateString('es-ES');
        }

        // Badge de estado
        const estadoBadge = getEstadoBadge(donation.estado);
        
        // Formatear monto
        const montoFormatted = donation.monto ? 
            `$${donation.monto.toLocaleString('es-CO')}` : 
            'No especificado';

        // Nombre del donante (solucionando el problema de "anónimo")
        const donanteName = donation.donante && donation.donante.trim() ? 
            donation.donante : 
            'Sin nombre';

        row.innerHTML = `
            <td>${fechaFormatted}</td>
            <td>${donanteName}</td>
            <td>${donation.email || 'No proporcionado'}</td>
            <td class="fw-bold text-success">${montoFormatted}</td>
            <td>
                <span class="badge bg-info">${donation.metodo || 'No especificado'}</span>
            </td>
            <td>${estadoBadge}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="viewDonation('${donation.id}')" title="Ver detalles">
                        <i class="bi bi-eye"></i>
                    </button>
                    ${donation.telefono ? `
                        <button class="btn btn-outline-warning" onclick="sendWhatsApp('${donation.telefono}', '${donation.donante}', '${donation.monto}')" title="Enviar comprobante por WhatsApp">
                            <i class="bi bi-whatsapp"></i>
                        </button>
                    ` : ''}
                    <button class="btn btn-outline-secondary" onclick="printReceipt('${donation.id}')" title="Imprimir recibo">
                        <i class="bi bi-printer"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteDonation('${donation.id}')" title="Eliminar donación">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Obtener badge de estado
function getEstadoBadge(estado) {
    switch (estado?.toLowerCase()) {
        case 'confirmado':
            return '<span class="badge bg-success">Confirmado</span>';
        case 'comprobante enviado':
        case 'comprobante_enviado':
            return '<span class="badge bg-info">Comprobante Enviado</span>';
        case 'pendiente':
            return '<span class="badge bg-warning">Pendiente</span>';
        case 'rechazado':
            return '<span class="badge bg-danger">Rechazado</span>';
        default:
            return '<span class="badge bg-secondary">Sin estado</span>';
    }
}

// NUEVA FUNCIÓN: Actualizar estadísticas por estado
function updateDonationsStatsByStatus() {
    if (!currentDonations.length) {
        updateStatsDisplayByStatus(0, 0, 0, 0, 0, 0, 0, 0);
        return;
    }

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    // Filtrar donaciones por estado
    const confirmedDonations = currentDonations.filter(d => 
        d.estado?.toLowerCase() === 'confirmado'
    );
    const pendingDonations = currentDonations.filter(d => 
        !d.estado || 
        d.estado?.toLowerCase() === 'pendiente' ||
        d.estado?.toLowerCase() === 'comprobante enviado' ||
        d.estado?.toLowerCase() === 'comprobante_enviado'
    );
    const rejectedDonations = currentDonations.filter(d => d.estado?.toLowerCase() === 'rechazado');
    
    // Calcular montos por estado
    const confirmedAmount = confirmedDonations.reduce((sum, d) => sum + (d.monto || 0), 0);
    const pendingAmount = pendingDonations.reduce((sum, d) => sum + (d.monto || 0), 0);
    const rejectedAmount = rejectedDonations.reduce((sum, d) => sum + (d.monto || 0), 0);
    
    // Donaciones confirmadas del mes actual
    const monthlyConfirmed = confirmedDonations.reduce((sum, donation) => {
        const donationDate = donation.fecha ? 
            new Date(donation.fecha) : 
            (donation.timestamp?.toDate ? donation.timestamp.toDate() : new Date());
        
        if (donationDate.getMonth() === currentMonth && donationDate.getFullYear() === currentYear) {
            return sum + (donation.monto || 0);
        }
        return sum;
    }, 0);

    // Promedio de donaciones confirmadas
    const avgConfirmed = confirmedDonations.length > 0 ? confirmedAmount / confirmedDonations.length : 0;

    updateStatsDisplayByStatus(
        confirmedAmount, confirmedDonations.length,
        pendingAmount, pendingDonations.length,
        rejectedAmount, rejectedDonations.length,
        monthlyConfirmed, avgConfirmed
    );
}

// NUEVA FUNCIÓN: Actualizar display de estadísticas por estado
function updateStatsDisplayByStatus(confirmedAmount, confirmedCount, pendingAmount, pendingCount, rejectedAmount, rejectedCount, monthlyConfirmed, avgConfirmed) {
    const elements = {
        confirmedAmount: document.getElementById('confirmedAmount'),
        confirmedCount: document.getElementById('confirmedCount'),
        pendingAmount: document.getElementById('pendingAmount'),
        pendingCount: document.getElementById('pendingCount'),
        rejectedAmount: document.getElementById('rejectedAmount'),
        rejectedCount: document.getElementById('rejectedCount'),
        monthlyConfirmed: document.getElementById('monthlyConfirmed'),
        avgConfirmedDonation: document.getElementById('avgConfirmedDonation')
    };

    if (elements.confirmedAmount) {
        elements.confirmedAmount.textContent = `$${confirmedAmount.toLocaleString('es-CO')}`;
    }
    if (elements.confirmedCount) {
        elements.confirmedCount.textContent = confirmedCount.toString();
    }
    if (elements.pendingAmount) {
        elements.pendingAmount.textContent = `$${pendingAmount.toLocaleString('es-CO')}`;
    }
    if (elements.pendingCount) {
        elements.pendingCount.textContent = pendingCount.toString();
    }
    if (elements.rejectedAmount) {
        elements.rejectedAmount.textContent = `$${rejectedAmount.toLocaleString('es-CO')}`;
    }
    if (elements.rejectedCount) {
        elements.rejectedCount.textContent = rejectedCount.toString();
    }
    if (elements.monthlyConfirmed) {
        elements.monthlyConfirmed.textContent = `$${monthlyConfirmed.toLocaleString('es-CO')}`;
    }
    if (elements.avgConfirmedDonation) {
        elements.avgConfirmedDonation.textContent = `$${Math.round(avgConfirmed).toLocaleString('es-CO')} promedio`;
    }
}

// Actualizar estadísticas de donaciones (función anterior - mantener por compatibilidad)
function updateDonationsStats() {
    updateDonationsStatsByStatus();
}

// Actualizar display de estadísticas (función anterior - mantener por compatibilidad)
function updateStatsDisplay(total, monthly, count, average) {
    // Esta función se mantiene vacía para compatibilidad, las nuevas estadísticas usan updateStatsDisplayByStatus
}

// Ver detalles de una donación
function viewDonation(donationId) {
    const donation = currentDonations.find(d => d.id === donationId);
    if (!donation) {
        alert('Donación no encontrada');
        return;
    }

    // Formatear fecha
    const fechaFormatted = donation.fecha ? 
        new Date(donation.fecha).toLocaleDateString('es-ES') : 
        'No disponible';

    // Formatear monto
    const montoFormatted = donation.monto ? 
        `$${donation.monto.toLocaleString('es-CO')} COP` : 
        'No especificado';

    // Llenar el modal con los datos
    document.getElementById('donationModalCategory').textContent = getCategoryDisplayName(donation.categoria) || 'No especificada';
    document.getElementById('donationModalDonor').textContent = donation.donante || 'No proporcionado';
    document.getElementById('donationModalPhone').textContent = donation.telefono || 'No proporcionado';
    document.getElementById('donationModalEmail').textContent = donation.email || 'No proporcionado';
    document.getElementById('donationModalDate').textContent = fechaFormatted;
    document.getElementById('donationModalAmount').textContent = montoFormatted;
    document.getElementById('donationModalMethod').textContent = donation.metodo || 'No especificado';
    document.getElementById('donationModalComment').textContent = donation.comentario || 'Sin comentario';
    
    // Configurar el selector de estado
    const statusSelect = document.getElementById('donationStatusSelect');
    statusSelect.value = donation.estado || 'Pendiente';
    
    // Configurar las notas del administrador
    document.getElementById('donationAdminNotes').value = donation.adminNotes || '';
    
    // Configurar botones de acción dinámicamente
    const actionsContainer = document.getElementById('donationModalActions');
    actionsContainer.innerHTML = '';
    
    // Botón de confirmar
    if (donation.estado !== 'Confirmado') {
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'btn btn-success me-2';
        confirmBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Confirmar';
        confirmBtn.onclick = () => markAsConfirmed(donationId);
        actionsContainer.appendChild(confirmBtn);
    }
    
    // Botón de WhatsApp
    if (donation.telefono) {
        const whatsappBtn = document.createElement('button');
        whatsappBtn.className = 'btn btn-warning me-2';
        whatsappBtn.innerHTML = '<i class="bi bi-whatsapp me-2"></i>WhatsApp';
        whatsappBtn.onclick = () => sendWhatsApp(donation.telefono, donation.donante, donation.monto);
        actionsContainer.appendChild(whatsappBtn);
    }

    // Guardar el ID de la donación actual para uso en otras funciones
    document.getElementById('donationDetailModal').setAttribute('data-donation-id', donationId);
    
    // Mostrar el modal
    const modal = new bootstrap.Modal(document.getElementById('donationDetailModal'));
    modal.show();
}

// Función para obtener el nombre de categoría para mostrar
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

// Guardar cambios de la donación
async function saveDonationChanges() {
    const modal = document.getElementById('donationDetailModal');
    const donationId = modal.getAttribute('data-donation-id');
    
    if (!donationId) {
        alert('Error: No se pudo identificar la donación');
        return;
    }

    const newStatus = document.getElementById('donationStatusSelect').value;
    const adminNotes = document.getElementById('donationAdminNotes').value.trim();

    try {
        const donationRef = doc(db, 'donaciones', donationId);
        await updateDoc(donationRef, {
            estado: newStatus,
            adminNotes: adminNotes,
            lastModified: Timestamp.now()
        });
        
        alert('Cambios guardados correctamente');
        
        // Cerrar el modal
        const modalInstance = bootstrap.Modal.getInstance(modal);
        modalInstance.hide();
        
    } catch (error) {
        console.error('Error al guardar cambios:', error);
        alert('Error al guardar los cambios');
    }
}

// Inicializar event listeners para el modal de donaciones
document.addEventListener('DOMContentLoaded', function() {
    // Event listener para guardar cambios
    const saveDonationBtn = document.getElementById('saveDonationChanges');
    if (saveDonationBtn) {
        saveDonationBtn.addEventListener('click', saveDonationChanges);
    }
});

// Marcar como confirmado
async function markAsConfirmed(donationId) {
    if (!confirm('¿Marcar esta donación como confirmada?')) {
        return;
    }

    try {
        const donationRef = doc(db, 'donaciones', donationId);
        await updateDoc(donationRef, {
            estado: 'Confirmado',
            confirmedAt: Timestamp.now()
        });
        
        alert('Donación marcada como confirmada');
        
        // Si estamos en el modal, cerrarlo
        const modal = document.getElementById('donationDetailModal');
        if (modal && modal.getAttribute('data-donation-id') === donationId) {
            const modalInstance = bootstrap.Modal.getInstance(modal);
            if (modalInstance) {
                modalInstance.hide();
            }
        }
        
    } catch (error) {
        console.error('Error al confirmar donación:', error);
        alert('Error al confirmar la donación');
    }
}

// Enviar comprobante por WhatsApp
async function sendWhatsApp(telefono, donante, monto) {
    try {
        // Limpiar el número de teléfono (quitar espacios, guiones, etc.)
        const cleanPhone = telefono.replace(/\D/g, '');
        
        // Agregar código de país si no lo tiene
        const phoneNumber = cleanPhone.startsWith('57') ? cleanPhone : `57${cleanPhone}`;
        
        // Mensaje predeterminado
        const message = `Hola ${donante}, gracias por tu donación de $${parseInt(monto).toLocaleString('es-CO')} COP. Por favor envía tu comprobante de pago para procesar tu donación. ¡Que Dios te bendiga!`;
        
        // Crear URL de WhatsApp
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
        
        // Abrir WhatsApp
        window.open(whatsappUrl, '_blank');
        
        // Actualizar estado de la donación
        const donation = currentDonations.find(d => d.telefono === telefono && d.donante === donante);
        if (donation) {
            const donationRef = doc(db, 'donaciones', donation.id);
            await updateDoc(donationRef, {
                estado: 'Comprobante Enviado',
                whatsappSentAt: Timestamp.now()
            });
            
            // Si estamos en el modal, actualizar el modal y cerrarlo
            const modal = document.getElementById('donationDetailModal');
            if (modal && modal.getAttribute('data-donation-id') === donation.id) {
                alert('WhatsApp enviado y estado actualizado');
                const modalInstance = bootstrap.Modal.getInstance(modal);
                if (modalInstance) {
                    modalInstance.hide();
                }
            }
        }
        
    } catch (error) {
        console.error('Error al enviar WhatsApp:', error);
        alert('Error al enviar mensaje de WhatsApp');
    }
}

// NUEVA FUNCIÓN: Exportar donaciones confirmadas usando impresión nativa
function exportDonationsToPDF() {
    // Filtrar donaciones confirmadas - incluye "Confirmado" y "Comprobante Enviado"
    const confirmedDonations = currentDonations.filter(d => 
        d.estado?.toLowerCase() === 'confirmado' || 
        d.estado?.toLowerCase() === 'comprobante enviado' ||
        d.estado?.toLowerCase() === 'comprobante_enviado'
    );
    
    if (confirmedDonations.length === 0) {
        alert('No hay donaciones confirmadas para exportar');
        return;
    }

    // Calcular total
    const totalAmount = confirmedDonations.reduce((sum, d) => sum + (d.monto || 0), 0);
    
    // Generar número de extracto único
    const extractNumber = `EXT-${Date.now().toString().slice(-8)}`;
    const currentDate = new Date().toLocaleDateString('es-ES');
    
    // Abrir nueva ventana para el extracto
    const extractWindow = window.open('', '_blank');
    
    const extractHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Extracto de Donaciones - ${extractNumber}</title>
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
                    line-height: 1.4;
                    color: #333;
                    font-size: 12px;
                }
                .extract-container {
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
                    width: 60px;
                    height: 60px;
                    background: white;
                    border-radius: 50%;
                    margin: 0 auto 15px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 30px;
                    color: #007bff;
                    font-weight: bold;
                }
                .church-name {
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 5px;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                }
                .church-subtitle {
                    font-size: 14px;
                    opacity: 0.9;
                    margin-bottom: 15px;
                }
                .extract-title {
                    font-size: 20px;
                    font-weight: bold;
                    background: rgba(255,255,255,0.2);
                    padding: 10px 20px;
                    border-radius: 20px;
                    display: inline-block;
                }
                .extract-info {
                    background: #f8f9fa;
                    padding: 15px;
                    border-bottom: 1px solid #dee2e6;
                    display: flex;
                    justify-content: space-between;
                    font-size: 11px;
                }
                .extract-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 0;
                }
                .extract-table th {
                    background: #343a40;
                    color: white;
                    padding: 12px 8px;
                    text-align: left;
                    font-size: 11px;
                    font-weight: bold;
                }
                .extract-table td {
                    padding: 8px;
                    border-bottom: 1px solid #eee;
                    font-size: 10px;
                }
                .extract-table tr:nth-child(even) {
                    background: #f8f9fa;
                }
                .total-section {
                    background: #e8f4fd;
                    padding: 20px;
                    text-align: center;
                    border-top: 3px solid #007bff;
                }
                .total-amount { 
                    font-size: 24px; 
                    font-weight: bold; 
                    color: #28a745;
                    margin-bottom: 10px;
                }
                .total-count {
                    font-size: 14px;
                    color: #666;
                    margin-bottom: 5px;
                }
                .footer { 
                    background: #f8f9fa;
                    padding: 15px;
                    text-align: center;
                    color: #666;
                    border-top: 1px solid #dee2e6;
                    font-size: 10px;
                }
                .note {
                    font-style: italic;
                    color: #666;
                    margin-top: 10px;
                    font-size: 10px;
                }
                @media print {
                    body { margin: 0; font-size: 10px; }
                    .extract-container { border: none; }
                    .header { background: #007bff !important; }
                }
            </style>
        </head>
        <body>
            <div class="extract-container">
                
                <!-- Header con logo -->
                <div class="header">
                    <div class="logo">RDP</div>
                    <div class="church-name">IGLESIA REY DE PAZ</div>
                    <div class="church-subtitle">Santa Bárbara, Antioquia</div>
                    <div class="extract-title">EXTRACTO DE DONACIONES CONFIRMADAS</div>
                </div>
                
                <!-- Información del extracto -->
                <div class="extract-info">
                    <span><strong>Extracto N°:</strong> ${extractNumber}</span>
                    <span><strong>Fecha de Reporte:</strong> ${currentDate}</span>
                    <span><strong>Total de Registros:</strong> ${confirmedDonations.length}</span>
                </div>
                
                <!-- Tabla de donaciones -->
                <table class="extract-table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Donante</th>
                            <th>Monto</th>
                            <th>Método</th>
                            <th>Categoría</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${confirmedDonations.map(donation => {
                            const fecha = donation.fecha ? 
                                new Date(donation.fecha).toLocaleDateString('es-ES') : 
                                'N/A';
                            const donante = donation.donante || 'Anónimo';
                            const monto = `$${(donation.monto || 0).toLocaleString('es-CO')}`;
                            const metodo = donation.metodo || 'N/A';
                            const categoria = getCategoryDisplayName(donation.categoria) || 'N/A';
                            const estado = donation.estado || 'N/A';
                            
                            return `
                                <tr>
                                    <td>${fecha}</td>
                                    <td>${donante}</td>
                                    <td style="font-weight: bold; color: #28a745;">${monto}</td>
                                    <td>${metodo}</td>
                                    <td>${categoria}</td>
                                    <td><span style="font-size: 9px; background: #28a745; color: white; padding: 2px 6px; border-radius: 10px;">${estado}</span></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
                
                <!-- Total -->
                <div class="total-section">
                    <div class="total-amount">$${totalAmount.toLocaleString('es-CO')} COP</div>
                    <div class="total-count">Total de ${confirmedDonations.length} donaciones confirmadas</div>
                    <div class="note">* Incluye donaciones confirmadas y con comprobante enviado</div>
                </div>
                
                <!-- Footer -->
                <div class="footer">
                    <div>Iglesia Rey de Paz - Santa Bárbara, Antioquia</div>
                    <div style="margin-top: 5px;">Este extracto fue generado automáticamente el ${new Date().toLocaleString('es-ES')}</div>
                </div>
            </div>
        </body>
        </html>
    `;
    
    extractWindow.document.write(extractHtml);
    extractWindow.document.close();
    
    // Imprimir automáticamente después de cargar
    extractWindow.onload = function() {
        extractWindow.print();
    };
    
    alert('Extracto generado. Se abrirá la ventana de impresión.');
}

// Función de exportar anterior (mantener por compatibilidad pero cambiar a PDF)
function exportDonations() {
    exportDonationsToPDF();
}

// Hacer funciones globales para los botones
window.viewDonation = viewDonation;
window.markAsConfirmed = markAsConfirmed;
window.sendWhatsApp = sendWhatsApp; 
window.getCategoryDisplayName = getCategoryDisplayName; 