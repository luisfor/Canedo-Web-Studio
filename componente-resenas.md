# Componente del kit — Slider de reseñas estilo Google

Carrusel de testimonios con tarjetas tipo reseña de Google (5 estrellas, avatar
con inicial, nombre y negocio), autoplay con pausa al interactuar, flechas que
NO tapan el contenido y puntos de posición. Probado en producción en
canedostudio.com (2026-08-17).

**Regla de contenido**: las reseñas de un cliente deben ser REALES (copiadas de
su ficha de Google). Las de ejemplo solo valen como maqueta temporal, con el
compromiso de sustituirlas — la regla de oro del kit es no inventar datos.

---

## 1. HTML (dentro de una `<section>`)

Las flechas van FUERA de `.carousel`, como hijas directas del contenedor
`.testimonials-grid`. Eso es lo que impide que tapen las tarjetas.

```html
<div class="testimonials-grid">
  <button class="carousel-nav carousel-prev" aria-label="Reseña anterior" data-carousel-prev>‹</button>
  <div class="carousel" data-carousel>
    <div class="carousel-track" data-carousel-track>

      <article class="testimonial-card carousel-slide">
        <div class="stars" aria-label="5 de 5 estrellas">
          <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
        </div>
        <p class="testimonial-text">"Texto de la reseña…"</p>
        <div class="testimonial-author">
          <span class="avatar" aria-hidden="true">M</span>
          <div>
            <strong>María Gómez</strong>
            <span>Dueña, Clínica Estética</span>
          </div>
        </div>
      </article>
      <!-- …repetir 4-6 tarjetas… -->

    </div>
    <div class="carousel-dots" data-carousel-dots></div>
  </div>
  <button class="carousel-nav carousel-next" aria-label="Reseña siguiente" data-carousel-next>›</button>
</div>
```

## 2. CSS

Usa las variables del kit (`--card-bg`, `--border-color`, `--accent`, `--gold`,
`--text`, `--mute`, `--bg`, `--ease-luxe`, `--disp`). Si el proyecto no las
tiene, definirlas primero. Lo importante: **el track NO lleva padding** (ese
fue el bug del desalineado) y las flechas se posicionan en los bordes del
`.testimonials-grid`, que tiene `padding: 0 56px` para hacerles hueco.

```css
.testimonials-grid { position: relative; margin-top: 2rem; padding: 0 56px; }
.testimonials-grid .carousel { position: relative; overflow: hidden; border-radius: 16px; }
.testimonials-grid .carousel-track {
  display: flex; gap: 1.5rem;
  transition: transform 0.45s var(--ease-luxe);
  will-change: transform;
}
.testimonials-grid .carousel-slide { flex: 0 0 100%; min-width: 0; }
@media (min-width: 768px)  { .testimonials-grid .carousel-slide { flex: 0 0 calc(50% - 0.75rem); } }
@media (min-width: 1024px) { .testimonials-grid .carousel-slide { flex: 0 0 calc(33.333% - 1rem); } }

.testimonials-grid .carousel-nav {
  position: absolute; top: 50%; transform: translateY(-50%);
  width: 44px; height: 44px; border-radius: 50%;
  background: rgba(20,20,28,0.95); border: 1px solid var(--border-color);
  color: var(--text); font-size: 1.5rem; cursor: pointer; z-index: 20;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s var(--ease-luxe);
  backdrop-filter: blur(8px); box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}
.testimonials-grid .carousel-nav:hover { background: var(--accent); color: var(--bg); border-color: var(--accent); }
.testimonials-grid .carousel-nav:disabled { opacity: 0.2; cursor: not-allowed; }
.testimonials-grid .carousel-prev { left: 0; }
.testimonials-grid .carousel-next { right: 0; }

.testimonials-grid .carousel-dots { display: flex; justify-content: center; gap: 0.8rem; margin-top: 2rem; }
.testimonials-grid .carousel-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--border-color); cursor: pointer; transition: all 0.2s var(--ease-luxe); }
.testimonials-grid .carousel-dot.active { background: var(--accent); transform: scale(1.3); }

.testimonial-card {
  background: var(--card-bg); border: 1px solid var(--border-color);
  border-radius: 12px; padding: 1.8rem;
  display: flex; flex-direction: column; gap: 1rem;
  transition: transform 0.2s var(--ease-luxe), box-shadow 0.2s var(--ease-luxe);
}
.testimonial-card:hover { transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.3); }
.stars { color: var(--gold); font-size: 1.2rem; letter-spacing: 0.1rem; }
.testimonial-text { font-size: 0.95rem; line-height: 1.6; color: var(--text); flex: 1; font-style: italic; }
.testimonial-author { display: flex; align-items: center; gap: 0.8rem; margin-top: auto; }
.testimonial-author .avatar {
  display: flex; align-items: center; justify-content: center;
  width: 42px; height: 42px; border-radius: 50%;
  background: var(--accent); color: var(--bg); font-weight: 600; font-family: var(--disp);
}
.testimonial-author strong { display: block; font-size: 1rem; color: var(--text); }
.testimonial-author span { font-size: 0.8rem; color: var(--mute); }
```

## 3. JavaScript (vanilla, sin librerías)

Registra la llamada en el `boot()` dentro de `safe("testimonialsCarousel", initTestimonialsCarousel);`.
`prefersReduced` ya existe en el `main.js` del kit.

```js
function initTestimonialsCarousel() {
  var carousel = document.querySelector('[data-carousel]');
  if (!carousel) return;

  /* Los botones viven FUERA de .carousel → buscar en el padre */
  var scope = carousel.closest('.testimonials-grid') || carousel.parentElement;
  var track = carousel.querySelector('[data-carousel-track]');
  var prevBtn = scope.querySelector('[data-carousel-prev]');
  var nextBtn = scope.querySelector('[data-carousel-next]');
  var dotsContainer = carousel.querySelector('[data-carousel-dots]') || scope.querySelector('[data-carousel-dots]');
  if (!track || !prevBtn || !nextBtn) return;

  var slides = track.querySelectorAll('.carousel-slide');
  if (slides.length < 2) return;

  var current = 0, step = 0, maxIndex = 0;
  var AUTOPLAY_MS = 4500, autoTimer = null, pauseTimer = null;
  var dots = [];
  var buildDots = null;

  /* Medidas reales del DOM (nada de cálculos a mano) */
  function measure() {
    var gap = parseFloat(window.getComputedStyle(track).gap) || 0;
    var slideW = slides[0].getBoundingClientRect().width;
    step = slideW + gap;
    var visible = Math.max(1, Math.round((carousel.clientWidth + gap) / step));
    maxIndex = Math.max(0, slides.length - visible);
    if (current > maxIndex) current = maxIndex;
    apply();
  }

  function apply() {
    track.style.transform = 'translateX(' + (-current * step) + 'px)';
    for (var d = 0; d < dots.length; d++) dots[d].classList.toggle('active', d === current);
    prevBtn.disabled = current === 0;
    nextBtn.disabled = current === maxIndex;
  }

  function goTo(idx) {
    if (idx < 0) idx = 0;
    if (idx > maxIndex) idx = maxIndex;
    current = idx;
    apply();
  }

  if (dotsContainer) {
    buildDots = function () {
      dotsContainer.innerHTML = '';
      dots = [];
      for (var i = 0; i <= maxIndex; i++) {
        var dot = document.createElement('button');
        dot.className = 'carousel-dot' + (i === current ? ' active' : '');
        dot.setAttribute('aria-label', 'Ir a la posición ' + (i + 1));
        dot._idx = i;
        dot.addEventListener('click', function () { goTo(this._idx); restartAutoplay(); });
        dotsContainer.appendChild(dot);
        dots.push(dot);
      }
    };
  }

  /* Autoplay con bucle: al final vuelve al principio */
  function nextSlide() { goTo(current >= maxIndex ? 0 : current + 1); }
  function startAutoplay() {
    if (prefersReduced) return;
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = setInterval(nextSlide, AUTOPLAY_MS);
  }
  function stopAutoplay() { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; } }
  function restartAutoplay() {
    stopAutoplay();
    if (pauseTimer) clearTimeout(pauseTimer);
    pauseTimer = setTimeout(startAutoplay, 2500);
  }

  prevBtn.addEventListener('click', function () { goTo(current - 1); restartAutoplay(); });
  nextBtn.addEventListener('click', function () { goTo(current + 1); restartAutoplay(); });

  /* Pausa al interactuar (ratón o táctil) sobre toda la zona */
  scope.addEventListener('mouseenter', stopAutoplay);
  scope.addEventListener('mouseleave', startAutoplay);
  scope.addEventListener('touchstart', stopAutoplay, { passive: true });
  scope.addEventListener('touchend', restartAutoplay);

  window.addEventListener('resize', function () {
    measure();
    if (buildDots) buildDots();
    apply();
  });

  measure();
  if (buildDots) buildDots();
  apply();
  startAutoplay();
}
```

## 4. Los 5 errores que ya cometimos (no los repitas)

| Síntoma | Causa | Solución |
|---|---|---|
| Botones y autoplay muertos, sin error en consola | Las flechas se movieron fuera de `.carousel` pero el JS las buscaba dentro → `null` → `return` silencioso | Buscar siempre en el padre: `scope = carousel.closest('.testimonials-grid')` |
| Flechas tapan las tarjetas | Estaban dentro del contenedor con `overflow: hidden` | Flechas fuera, en `.testimonials-grid` con `padding: 0 56px` |
| Tarjetas desalineadas / huecos raros | Restos de `padding` en el track y `flex-basis: calc(100% - 104px)` de cuando las flechas iban dentro | Track sin padding; `flex: 0 0 100%` (móvil), 50% (tablet), 33.333% (desktop) |
| Salta a posiciones imposibles al redimensionar | Anchos calculados a mano | Medir el DOM real: `getBoundingClientRect().width` + `getComputedStyle(track).gap` |
| El autoplay atropella al usuario | Sin pausa al interactuar | `mouseenter`/`touchstart` paran; `mouseleave`/`touchend` reanudan a los 2,5 s; y `prefersReduced` apaga el autoplay entero |

## 5. El embudo de reseñas (página oculta `calificanos.html`)

La otra mitad del sistema de reputación. **Funcionando en producción** en
canedostudio.com/calificanos (2026-08-17). La plantilla completa lista para
copiar y pegar está en `plantilla-calificanos.html` (raíz del kit): un solo
archivo autónomo con 3 huecos marcados con ▶▶ (nombre del negocio, email del
dueño, enlace de reseña de Google).

- Página SIN menú ni enlaces, oscura y premium, enlazada solo desde el mensaje
  que el negocio manda al cliente tras la compra (WhatsApp/email).
- Pregunta: "¿Cómo calificarías tu experiencia?" con 5 estrellas interactivas.
- **4-5 estrellas** → abre el enlace directo de reseña de Google
  (`https://g.page/r/…/review`) en pestaña NUEVA con `window.open` EN EL MOMENTO
  DEL TOQUE (si se retrasa con setTimeout, el navegador la bloquea como popup);
  la página del embudo se queda abierta y el cliente vuelve al cerrar la pestaña.
  Además se muestra una pantalla intermedia ("¡Mil gracias!") con botón para
  reabrir Google y botón Volver a las estrellas.
- **1-3 estrellas** → oculta las estrellas y muestra: "Lamentamos no haber
  cumplido tus expectativas. Cuéntanos qué pasó para solucionarlo" + formulario
  que llega al email del dueño. Solución que funciona sin cuentas: **FormSubmit**
  (`formsubmit.co/ajax/[email]`, JSON con `_captcha:"false"`, `_template:"table"`,
  `_honey` como trampa anti-robots; el primer envío manda un email de activación
  que el dueño confirma con un clic — sin ese clic, NINGUNA queja llega).
  OJO: Formspree exige crear la cuenta y el formulario de verdad — un ID
  inventado devuelve 404 "Form not found".
- Así las quejas se resuelven en privado y Google solo recibe clientes felices.

### Cómo conseguir el enlace de reseña de Google (formato g.page)

Google Business Profile → "Pedir reseñas" / "Ask for reviews" → copiar el
enlace corto. El formato bueno es `https://g.page/r/XXXXXXXX/review`: abre
DIRECTO el cuadro de escribir reseña (pide iniciar sesión de Google primero).
No vale un enlace genérico a la ficha de Maps ni acortadores tipo
maps.app.goo.gl (esos abren la ficha, no el cuadro de reseña).

### Lecciones aprendidas a golpes (2026-08-17/18)

| Fallo real | Causa | Lección |
|---|---|---|
| El formulario "enviaba" pero no llegaba nada | El código hacía `preventDefault()` y mostraba éxito sin enviar nada | Verificar SIEMPRE que llega un email de verdad antes de darlo por bueno |
| 404 "Form not found" de Formspree | El ID del formulario se inventó; nunca se creó la cuenta | Formspree exige cuenta + formulario real. Si no hay acceso a la cuenta del cliente, usar FormSubmit |
| "Make sure you open this page through a web server" al probar FormSubmit con curl | FormSubmit exige cabecera Origin/Referer | Probar con `-H "Origin: https://[dominio]"` o desde la web misma |
| Las quejas no llegan tras montarlo | Falta el clic en "Activate Form" del primer email de FormSubmit | Es el paso que olvida todo el mundo; incluirlo en la entrega al cliente |
