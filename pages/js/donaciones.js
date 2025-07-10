// Import Firebase modules
import { db } from '../../admin/js/firebase.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// Variables globales para donaciones
let currentDonationMethod = '';

// Formulario de donaciones dinámico
document.addEventListener('DOMContentLoaded', function() {
    const donationCategory = document.getElementById('donationCategory');
    const dynamicDonationForm = document.getElementById('dynamicDonationForm');
    const commentLabel = document.getElementById('commentLabel');
    const donationForm = document.getElementById('donationForm');
    const submitDonationSuccessMessage = document.getElementById('submitDonationSuccessMessage');
    const submitDonationErrorMessage = document.getElementById('submitDonationErrorMessage');

    // Labels personalizados para cada categoría
    const categoryLabels = {
        'diezmo': 'Comparte tu testimonio sobre el diezmo (opcional)',
        'ofrenda': 'Comparte tu corazón de ofrenda (opcional)',
        'misiones': 'Comparte tu visión misionera (opcional)',
        'protempo': 'Comparte tu motivación para el pro-tempo (opcional)',
        'apoyo_social': 'Comparte cómo quieres ayudar (opcional)',
        'otro': 'Describe el propósito de tu donación (opcional)'
    };

    // Manejar cambio de categoría
    if (donationCategory) {
        donationCategory.addEventListener('change', function() {
            const selectedCategory = this.value;
            submitDonationSuccessMessage.classList.add('d-none');
            submitDonationErrorMessage.classList.add('d-none');

            if (selectedCategory) {
                // Mostrar el formulario
                dynamicDonationForm.classList.remove('d-none');
                if (commentLabel) {
                    commentLabel.textContent = categoryLabels[selectedCategory] || 'Comentario (opcional)';
                }

                // Hacer scroll suave hacia el formulario
                setTimeout(() => {
                    dynamicDonationForm.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'start' 
                    });
                }, 100);
            } else {
                // Ocultar el formulario si no hay categoría seleccionada
                dynamicDonationForm.classList.add('d-none');
            }
        });
    }

    // Manejar envío del formulario
    if (donationForm) {
        donationForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Ocultar mensajes previos
            submitDonationSuccessMessage.classList.add('d-none');
            submitDonationErrorMessage.classList.add('d-none');
            
            // Validar formulario
            if (!validateDonationForm()) {
                return;
            }
            
            // Recopilar datos del formulario
            const donationData = {
                categoria: donationCategory.value,
                donante: document.getElementById('donorName').value.trim(),
                telefono: document.getElementById('donorPhone').value.trim(),
                email: document.getElementById('donorEmail').value.trim(),
                monto: parseFloat(document.getElementById('donationAmount').value),
                fecha: new Date().toISOString().split('T')[0], // Fecha automática
                metodo: document.getElementById('donationMethod').value,
                comentario: document.getElementById('donationComment').value.trim(),
                estado: 'Pendiente',
                timestamp: new Date().toISOString()
            };
            
            // Deshabilitar botón de envío
            const submitButton = document.getElementById('submitDonation');
            const originalText = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="bi bi-spinner-border spinner-border-sm me-2"></i>Procesando...';
            
            // Enviar al panel administrativo
            sendDonationToAdmin(donationData)
                .then(response => {
                    // Éxito
                    submitDonationSuccessMessage.classList.remove('d-none');
                    
                    // Cerrar modal de formulario después de un momento
                    setTimeout(() => {
                        const modal = bootstrap.Modal.getInstance(document.getElementById('donationModal'));
                        modal.hide();
                        
                        // Mostrar QR de pago
                        showQRPayment(donationData);
                    }, 1500);
                })
                .catch(error => {
                    // Error
                    console.error('Error al enviar donación:', error);
                    submitDonationErrorMessage.classList.remove('d-none');
                    
                    // Hacer scroll al mensaje de error
                    submitDonationErrorMessage.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center' 
                    });
                })
                .finally(() => {
                    // Rehabilitar botón
                    submitButton.disabled = false;
                    submitButton.innerHTML = originalText;
                });
        });
    }

    // Función para validar el formulario de donación
    function validateDonationForm() {
        const donorName = document.getElementById('donorName');
        const donorPhone = document.getElementById('donorPhone');
        const donorEmail = document.getElementById('donorEmail');
        const donationAmount = document.getElementById('donationAmount');
        
        let isValid = true;
        
        // Limpiar estados de validación previos
        clearDonationValidationStates();
        
        // Validar nombre
        if (!donorName.value.trim()) {
            showDonationFieldError(donorName, 'Nombre completo es requerido');
            isValid = false;
        }
        
        // Validar teléfono (requerido)
        if (!donorPhone.value.trim()) {
            showDonationFieldError(donorPhone, 'Número de teléfono es requerido');
            isValid = false;
        }
        
        // Validar email (opcional, pero si se proporciona debe ser válido)
        if (donorEmail.value.trim() && !isValidEmail(donorEmail.value.trim())) {
            showDonationFieldError(donorEmail, 'Correo electrónico no válido');
            isValid = false;
        }
        
        // Validar monto
        if (!donationAmount.value || parseFloat(donationAmount.value) < 1000) {
            showDonationFieldError(donationAmount, 'Monto mínimo $1,000 COP');
            isValid = false;
        }
        
        return isValid;
    }
    
    // Función para mostrar error en un campo
    function showDonationFieldError(field, message) {
        field.classList.add('is-invalid');
        const feedback = field.parentNode.querySelector('.invalid-feedback');
        if (feedback) {
            feedback.textContent = message;
        }
    }
    
    // Función para limpiar estados de validación
    function clearDonationValidationStates() {
        const fields = ['donorName', 'donorPhone', 'donorEmail', 'donationAmount'];
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.classList.remove('is-invalid', 'is-valid');
            }
        });
    }
    
    // Función para validar email
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    // Función para enviar datos al panel administrativo (Firestore)
    async function sendDonationToAdmin(donationData) {
        try {
            // Preparar datos para Firestore
            const donationRecord = {
                categoria: donationData.categoria,
                donante: donationData.donante,
                telefono: donationData.telefono,
                email: donationData.email,
                monto: donationData.monto,
                fecha: donationData.fecha,
                metodo: donationData.metodo,
                comentario: donationData.comentario,
                estado: donationData.estado,
                timestamp: serverTimestamp(),
                createdAt: new Date().toISOString()
            };

            // Agregar documento a la colección 'donaciones'
            const docRef = await addDoc(collection(db, 'donaciones'), donationRecord);
            
            console.log('Donación guardada en Firestore con ID:', docRef.id);
            return { success: true, id: docRef.id };
            
        } catch (error) {
            console.error('Error al guardar en Firestore:', error);
            throw error;
        }
    }
    
    // Limpiar mensajes de estado cuando se cambie la categoría
    if (donationCategory) {
        donationCategory.addEventListener('change', function() {
            submitDonationSuccessMessage.classList.add('d-none');
            submitDonationErrorMessage.classList.add('d-none');
        });
    }
});

// Mostrar formulario de donación
function mostrarFormulario(metodo) {
    currentDonationMethod = metodo;
    
    // Configurar el modal según el método
    const modal = document.getElementById('donationModal');
    const modalHeader = document.getElementById('modalHeader');
    const modalTitle = document.getElementById('donationModalLabel');
    const donationIcon = document.getElementById('donationIcon');
    const donationTitle = document.getElementById('donationTitle');
    const submitButton = document.getElementById('submitDonation');
    const methodInput = document.getElementById('donationMethod');
    
    // Limpiar formulario
    document.getElementById('donationForm').reset();
    document.getElementById('dynamicDonationForm').classList.add('d-none');
    document.getElementById('donationCategory').value = '';
    
    // Configurar según el método
    if (metodo === 'bancolombia') {
        modalHeader.className = 'modal-header bg-primary text-white';
        modalTitle.innerHTML = '<i class="bi bi-bank me-2"></i>Donación por Bancolombia';
        donationIcon.innerHTML = '<i class="bi bi-bank"></i>';
        donationTitle.textContent = 'Donación por Bancolombia';
        submitButton.className = 'btn btn-primary btn-lg';
        submitButton.innerHTML = '<i class="bi bi-credit-card me-2"></i>Continuar al Pago';
        methodInput.value = 'Bancolombia';
    } else if (metodo === 'nequi') {
        modalHeader.className = 'modal-header bg-success text-white';
        modalTitle.innerHTML = '<i class="bi bi-phone me-2"></i>Donación por Nequi';
        donationIcon.innerHTML = '<i class="bi bi-phone"></i>';
        donationTitle.textContent = 'Donación por Nequi';
        submitButton.className = 'btn btn-success btn-lg';
        submitButton.innerHTML = '<i class="bi bi-phone me-2"></i>Continuar al Pago';
        methodInput.value = 'Nequi';
    }
    
    // Mostrar modal
    const donationModal = new bootstrap.Modal(modal);
    donationModal.show();
}

// Mostrar QR de pago
function showQRPayment(donationData) {
    // Configurar información del QR
    document.getElementById('qrDonor').textContent = donationData.donante;
    document.getElementById('qrPhone').textContent = donationData.telefono;
    document.getElementById('qrCategory').textContent = getCategoryDisplayName(donationData.categoria);
    document.getElementById('qrAmount').textContent = donationData.monto.toLocaleString('es-CO');
    document.getElementById('qrMethod').textContent = donationData.metodo;
    
    // Configurar imagen QR según el método
    const qrImage = document.getElementById('qrImage');
    if (donationData.metodo === 'Bancolombia') {
        qrImage.src = 'assets/qr-bancolombia.jpg';
    } else if (donationData.metodo === 'Nequi') {
        qrImage.src = 'assets/QRnequi.png';
    }
    
    // Mostrar modal QR
    const qrModal = new bootstrap.Modal(document.getElementById('qrModal'));
    qrModal.show();
}

// Obtener nombre de categoría para mostrar
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

// Confirmar pago realizado
function confirmarPago() {
    // Mostrar mensaje de confirmación
    alert('¡Gracias por tu donación! Hemos registrado tu pago y pronto recibirás una confirmación por correo electrónico.');
    
    // Cerrar modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('qrModal'));
    modal.hide();
    
    // Limpiar formulario
    document.getElementById('donationForm').reset();
    document.getElementById('dynamicDonationForm').classList.add('d-none');
    document.getElementById('donationCategory').value = '';
}

// Hacer funciones globales para que puedan ser llamadas desde los botones
window.mostrarFormulario = mostrarFormulario;
window.confirmarPago = confirmarPago;
