// Import Firebase modules (mismo método que donaciones.js)
import { db } from '../../admin/js/firebase.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// Formulario de contacto dinámico con Firebase
document.addEventListener('DOMContentLoaded', function() {
    const contactCategory = document.getElementById('contactCategory');
    const dynamicForm = document.getElementById('dynamicForm');
    const messageLabel = document.getElementById('messageLabel');
    const contactForm = document.getElementById('contactForm');
    const submitSuccessMessage = document.getElementById('submitSuccessMessage');
    const submitErrorMessage = document.getElementById('submitErrorMessage');

    // Solo continuar si los elementos existen (página de contacto)
    if (!contactCategory || !dynamicForm) {
        return;
    }

    // Labels personalizados para cada categoría
    const categoryLabels = {
        'new': 'Cuéntanos un poco sobre ti y cómo podemos ayudarte',
        'request': 'Comparte tu petición de oración o testimonio',
        'suggestion': 'Comparte tu sugerencia o comentario'
    };

    // Manejar cambio de categoría
    contactCategory.addEventListener('change', function() {
        const selectedCategory = this.value;
        submitSuccessMessage.classList.add('d-none');
        submitErrorMessage.classList.add('d-none');

        if (selectedCategory) {
            // Mostrar el formulario
            dynamicForm.classList.remove('d-none');
            messageLabel.textContent = categoryLabels[selectedCategory] || 'Mensaje';

            // Hacer scroll suave hacia el formulario
            setTimeout(() => {
                dynamicForm.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            }, 100);
        } else {
            // Ocultar el formulario si no hay categoría seleccionada
            dynamicForm.classList.add('d-none');
        }
    });

    // Manejar envío del formulario
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Ocultar mensajes previos
        submitSuccessMessage.classList.add('d-none');
        submitErrorMessage.classList.add('d-none');
        
        // Validar formulario
        if (!validateForm()) {
            return;
        }
        
        // Recopilar datos del formulario
        const formData = {
            category: contactCategory.value,
            name: document.getElementById('name').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            message: document.getElementById('message').value.trim(),
            timestamp: serverTimestamp(),
            status: 'nuevo',
            adminNotes: ''
        };
        
        // Deshabilitar botón de envío
        const submitButton = document.getElementById('submitButton');
        const originalText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando...';
        
        // Enviar al panel administrativo (Firestore)
        sendToAdminPanel(formData)
            .then(response => {
                // Éxito
                submitSuccessMessage.classList.remove('d-none');
                contactForm.reset();
                dynamicForm.classList.add('d-none');
                
                // Hacer scroll al mensaje de éxito
                submitSuccessMessage.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            })
            .catch(error => {
                // Error
                submitErrorMessage.classList.remove('d-none');
                
                // Hacer scroll al mensaje de error
                submitErrorMessage.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            })
            .finally(() => {
                // Rehabilitar botón
                submitButton.disabled = false;
                submitButton.textContent = originalText;
            });
    });

    // Función para enviar datos al panel administrativo (Firestore)
    async function sendToAdminPanel(formData) {
        try {
            // Agregar documento a la colección 'contactMessages'
            const docRef = await addDoc(collection(db, 'contactMessages'), formData);
            
            return { success: true, id: docRef.id };
            
        } catch (error) {
            throw error;
        }
    }

    // Función para validar el formulario
    function validateForm() {
        const name = document.getElementById('name');
        const email = document.getElementById('email');
        const phone = document.getElementById('phone');
        const message = document.getElementById('message');
        
        let isValid = true;
        
        // Limpiar estados de validación previos
        clearValidationStates();
        
        // Validar nombre
        if (!name.value.trim()) {
            showFieldError(name, 'Nombre completo es requerido');
            isValid = false;
        }
        
        // Validar email
        if (!email.value.trim()) {
            showFieldError(email, 'Correo electrónico es requerido');
            isValid = false;
        } else if (!isValidEmail(email.value.trim())) {
            showFieldError(email, 'Correo electrónico no válido');
            isValid = false;
        }
        
        // Validar teléfono
        if (!phone.value.trim()) {
            showFieldError(phone, 'Número de teléfono es requerido');
            isValid = false;
        }
        
        // Validar mensaje
        if (!message.value.trim()) {
            showFieldError(message, 'Este campo es requerido');
            isValid = false;
        }
        
        return isValid;
    }
    
    // Función para mostrar error en un campo
    function showFieldError(field, message) {
        field.classList.add('is-invalid');
        const feedback = field.parentNode.querySelector('.invalid-feedback');
        if (feedback) {
            feedback.textContent = message;
        }
    }
    
    // Función para limpiar estados de validación
    function clearValidationStates() {
        const fields = ['name', 'email', 'phone', 'message'];
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            field.classList.remove('is-invalid', 'is-valid');
        });
    }
    
    // Función para validar email
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    // Limpiar mensajes de estado cuando se cambie la categoría
    contactCategory.addEventListener('change', function() {
        submitSuccessMessage.classList.add('d-none');
        submitErrorMessage.classList.add('d-none');
    });
});
