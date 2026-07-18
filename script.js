
(() => {
  const loader = document.getElementById('siteLoader');
  window.addEventListener('load', () => {
    setTimeout(() => loader && loader.classList.add('hide'), 1300);
  });

  const menuToggle = document.getElementById('menuToggle');
  const menuDrawer = document.getElementById('menuDrawer');
  const closeEls = document.querySelectorAll('[data-close-menu], .menu-links a');
  const openMenu = () => { document.body.classList.add('menu-open'); menuDrawer?.classList.add('open'); menuToggle?.classList.add('active'); menuToggle?.setAttribute('aria-expanded','true'); menuDrawer?.setAttribute('aria-hidden','false'); };
  const closeMenu = () => { document.body.classList.remove('menu-open'); menuDrawer?.classList.remove('open'); menuToggle?.classList.remove('active'); menuToggle?.setAttribute('aria-expanded','false'); menuDrawer?.setAttribute('aria-hidden','true'); };
  menuToggle?.addEventListener('click', () => menuDrawer?.classList.contains('open') ? closeMenu() : openMenu());
  closeEls.forEach(el => el.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  // Conditional form fields
  document.querySelectorAll('[data-reveal]').forEach(radio => {
    const update = () => {
      const target = document.getElementById(radio.dataset.reveal);
      const checked = radio.checked;
      if (target) target.classList.toggle('show', checked);
    };
    document.querySelectorAll(`input[name="${radio.name}"]`).forEach(el => el.addEventListener('change', update));
    update();
  });
  document.querySelectorAll('[data-select-reveal]').forEach(select => {
    const target = document.getElementById(select.dataset.selectReveal);
    const update = () => target && target.classList.toggle('show', select.value === 'Other');
    select.addEventListener('change', update); update();
  });

  // Formspree AJAX submit
  const form = document.querySelector('form[data-formspree-form="true"]');
  if (form) {
    const status = form.querySelector('[data-form-status]');
    const button = form.querySelector('button[type="submit"]');
    const originalText = button ? button.textContent : 'Submit Application';
    const setStatus = (type, message) => { if (!status) return; status.className = `form-status show ${type}`; status.textContent = message; };
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const data = new FormData(form);
      if (button) { button.disabled = true; button.textContent = 'Submitting...'; }
      setStatus('loading', 'Submitting your application securely. Please wait...');
      try {
        const res = await fetch(form.action, { method: 'POST', body: data, headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error('Submission failed');
        setStatus('success', 'Application submitted successfully. Redirecting...');
        window.location.href = 'application-thank-you.html';
      } catch (err) {
        if (button) { button.disabled = false; button.textContent = originalText; }
        setStatus('error', 'We could not submit the form right now. Please try again, or contact TWS on WhatsApp if the issue continues.');
      }
    });
  }

  // Performance video cards
  const modal = document.createElement('div');
  modal.className = 'video-modal';
  modal.innerHTML = '<div class="video-modal-inner"><button type="button" aria-label="Close video">×</button><video controls playsinline></video></div>';
  document.body.appendChild(modal);
  const modalVideo = modal.querySelector('video');
  const modalClose = modal.querySelector('button');
  const closeModal = () => { modal.classList.remove('open'); modalVideo.pause(); modalVideo.removeAttribute('src'); };
  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  document.querySelectorAll('[data-video-card]').forEach(card => {
    const video = card.querySelector('video');
    card.addEventListener('mouseenter', () => { video.muted = true; video.loop = true; video.play().catch(()=>{}); });
    card.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0; });
    card.addEventListener('click', () => { modalVideo.src = video.currentSrc || video.getAttribute('src'); modal.classList.add('open'); modalVideo.play().catch(()=>{}); });
  });
})();
