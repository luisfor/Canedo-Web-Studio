/**
 * Starter Template Main Script
 * Vanilla JS, No Dependencies
 */

document.addEventListener('DOMContentLoaded', () => {
  initReveals();
  initSlider();
});

/**
 * ============================================================================
 * IntersectionObserver Reveals
 * ============================================================================
 */
function initReveals() {
  const reveals = document.querySelectorAll('.reveal');
  if (!reveals.length) return;

  // Respect prefers-reduced-motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    reveals.forEach(el => el.classList.add('is-visible'));
    return;
  }

  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.15
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  reveals.forEach(el => observer.observe(el));
}

/**
 * ============================================================================
 * Carousel / Slider
 * Architecture: State variable (currentIndex), goTo(index), and apply()
 * ============================================================================
 */
function initSlider() {
  const sliderTrack = document.querySelector('[data-slider-track]');
  if (!sliderTrack) return;

  const cards = document.querySelectorAll('.slider-card');
  const btnPrev = document.querySelector('[data-slider-prev]');
  const btnNext = document.querySelector('[data-slider-next]');
  const dotsContainer = document.querySelector('[data-slider-dots]');
  
  if (!cards.length) return;

  let currentIndex = 0;
  let maxIndex = 0;
  let visibleCards = 1;
  let startX = 0;
  let isDragging = false;

  // Render Dots dynamically based on total cards
  function renderDots() {
    if (!dotsContainer) return;
    dotsContainer.innerHTML = '';
    // If only 1 card is visible and total cards <= visible, hide controls
    if (cards.length <= visibleCards) {
      if (btnPrev) btnPrev.style.display = 'none';
      if (btnNext) btnNext.style.display = 'none';
      return;
    }

    if (btnPrev) btnPrev.style.display = 'flex';
    if (btnNext) btnNext.style.display = 'flex';

    for (let i = 0; i <= maxIndex; i++) {
      const dot = document.createElement('button');
      dot.className = 'carousel-dot';
      dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
      if (i === currentIndex) dot.classList.add('active');
      
      dot.addEventListener('click', () => goTo(i));
      dotsContainer.appendChild(dot);
    }
  }

  function updateDots() {
    if (!dotsContainer) return;
    const dots = dotsContainer.querySelectorAll('.carousel-dot');
    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === currentIndex);
    });
  }

  function calculateConfig() {
    const trackWidth = sliderTrack.parentElement.clientWidth;
    const cardWidth = cards[0].offsetWidth;
    
    // Estimate how many cards fit in the viewport
    visibleCards = Math.round(trackWidth / cardWidth) || 1;
    maxIndex = Math.max(0, cards.length - visibleCards);
    
    // Ensure current index doesn't exceed new max index on resize
    if (currentIndex > maxIndex) {
      currentIndex = maxIndex;
    }
  }

  function apply() {
    const cardWidth = cards[0].offsetWidth;
    const style = window.getComputedStyle(cards[0]);
    const marginRight = parseFloat(style.marginRight) || 0;
    
    const offset = currentIndex * (cardWidth + marginRight);
    sliderTrack.style.transform = `translateX(-${offset}px)`;
    
    updateDots();
    
    // Update button states for accessibility
    if (btnPrev) btnPrev.disabled = currentIndex === 0;
    if (btnNext) btnNext.disabled = currentIndex === maxIndex;
  }

  function goTo(index) {
    if (index < 0) index = 0;
    if (index > maxIndex) index = maxIndex;
    currentIndex = index;
    apply();
  }

  function next() {
    if (currentIndex < maxIndex) {
      goTo(currentIndex + 1);
    } else {
      goTo(0); // Optional: loop back
    }
  }

  function prev() {
    if (currentIndex > 0) {
      goTo(currentIndex - 1);
    } else {
      goTo(maxIndex); // Optional: loop to end
    }
  }

  // Event Listeners
  if (btnNext) btnNext.addEventListener('click', next);
  if (btnPrev) btnPrev.addEventListener('click', prev);

  window.addEventListener('resize', () => {
    // Debounce recommended for production, simplified here
    calculateConfig();
    renderDots();
    apply();
  });

  // Basic Swipe Support
  sliderTrack.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    isDragging = true;
  }, { passive: true });

  sliderTrack.addEventListener('touchend', (e) => {
    if (!isDragging) return;
    const endX = e.changedTouches[0].clientX;
    const diff = startX - endX;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0) next();
      else prev();
    }
    isDragging = false;
  }, { passive: true });

  // Init
  calculateConfig();
  renderDots();
  apply();
}
