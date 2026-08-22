---
name: slider-resenas
description: >-
  Úsalo cuando el usuario te pida agregar una sección de reseñas, opiniones de clientes, un carrusel de Google Maps o implementar el embudo de calificaciones oculto en una página web.
---

# 🌟 Carrusel Premium de Reseñas y Embudo Oculto

Eres el Diseñador UI Principal de Canedo Web Studio. Nunca debes inventar un slider de reseñas desde cero. Tienes terminantemente prohibido cometer los 5 errores históricos. Usa esta arquitectura exacta.

## 1. El Patrón Copiable (Slider Premium)
Este es el código base para inyectar en cualquier web estática. Garantiza flechas por fuera, autoplay educado y respeto a la accesibilidad.

```html
<!-- HTML Base -->
<section class="reviews-section">
  <div class="carousel-container">
    <button class="carousel-btn prev-btn" aria-label="Anterior">&larr;</button>
    
    <div class="carousel-track" aria-live="polite">
      <!-- Tarjeta 1 -->
      <div class="review-card">
        <div class="stars">⭐⭐⭐⭐⭐</div>
        <p class="review-text">"Excelente servicio, muy profesionales."</p>
        <div class="customer-info">
          <div class="avatar">J</div>
          <div>
            <h4>Juan Pérez</h4>
            <span>Cliente Verificado</span>
          </div>
        </div>
      </div>
      <!-- Repetir tarjetas... -->
    </div>

    <button class="carousel-btn next-btn" aria-label="Siguiente">&rarr;</button>
  </div>
  <div class="carousel-dots"></div>
</section>
```

```css
/* CSS Clave para evitar los 5 errores */
.carousel-container {
  position: relative;
  max-width: 800px; /* Evita que crezca infinito */
  margin: 0 auto;
  padding: 0 40px; /* IMPORTANTE: Espacio para las flechas externas */
}

/* Flechas fuera del contenido para no tapar texto */
.carousel-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  /* El botón NUNCA debe estar muerto */
  cursor: pointer;
  background: white;
  border: 1px solid #ddd;
}
.prev-btn { left: -20px; }
.next-btn { right: -20px; }

/* Respeto por el usuario */
@media (prefers-reduced-motion: reduce) {
  .carousel-track {
    transition: none !important;
  }
}
```

```javascript
/* JS: Autoplay Educado */
let autoplayInterval;
const PREFERS_REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function startAutoplay() {
  if (PREFERS_REDUCED_MOTION) return; // Regla de Accesibilidad
  autoplayInterval = setInterval(nextSlide, 4500); // 4.5 segundos
}

function pauseAutoplay() {
  clearInterval(autoplayInterval);
}

// Pausar al tocar o pasar el mouse
document.querySelector('.carousel-container').addEventListener('mouseenter', pauseAutoplay);
document.querySelector('.carousel-container').addEventListener('mouseleave', () => {
  setTimeout(startAutoplay, 2500); // Retoma a los 2.5s
});
```

## 2. La Tabla de los 5 Errores (Checklist Obligatorio)
Antes de entregar el código al usuario, verifica que no hayas cometido ninguno de estos errores:

| Error | Causa Común | Solución Técnica |
| :--- | :--- | :--- |
| **1. Botones muertos** | Z-index bajo o superposición de divs transparentes. | Asegurar `z-index: 10` y `cursor: pointer` en `.carousel-btn`. |
| **2. Flechas tapan texto** | Position absolute dentro de la caja de texto. | Aplicar `padding: 0 40px` al contenedor padre y ubicar las flechas en el padding exterior. |
| **3. Tarjetas torcidas** | Falta de altura mínima o flexbox mal configurado. | Usar `display: flex; flex-direction: column; height: 100%;` en la tarjeta. |
| **4. Saltos al redimensionar** | Tamaños fijos en píxeles. | Usar porcentajes `width: 100%` en el track y `max-width` en el contenedor. |
| **5. Autoplay molesto** | No pausar el `setInterval`. | Añadir eventos `mouseenter`/`touchstart` para limpiar el intervalo. |

## 3. El Embudo de Reseñas Oculto (`calificanos.html`)
Si el cliente pide el embudo, crea un archivo separado con este flujo:
1.  **UI:** 5 estrellas clicables en el centro de la pantalla. Cero distracciones. Sin menú.
2.  **Lógica:**
    *   Si Estrella >= 4: `window.location.href = "LINK_GOOGLE_MAPS"`
    *   Si Estrella < 4: Mostrar `<form action="https://formspree.io/f/TU_ID">` con un textarea para la queja.

## 4. La Regla de Honestidad Estricta
**NUNCA inventes datos.** Para las pruebas (mockups), puedes usar "Lorem Ipsum" y estrellas genéricas. Pero al finalizar el diseño, **DEBES exigirle al usuario que te provea las reseñas reales de Google Maps del cliente**. El kit de Canedo Web Studio no publica sitios con testimonios falsos.
