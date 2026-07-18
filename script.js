
(() => {
  const loader = document.getElementById('siteLoader');
  window.addEventListener('load', () => {
    setTimeout(() => loader && loader.classList.add('hide'), 1450);
  });

  const toggle = document.getElementById('menuToggle');
  const drawer = document.getElementById('menuDrawer');
  const closeItems = document.querySelectorAll('[data-close-menu]');

  const openMenu = () => {
    toggle?.classList.add('active');
    drawer?.classList.add('open');
    document.body.classList.add('menu-open');
    toggle?.setAttribute('aria-expanded','true');
    drawer?.setAttribute('aria-hidden','false');
  };

  const closeMenu = () => {
    toggle?.classList.remove('active');
    drawer?.classList.remove('open');
    document.body.classList.remove('menu-open');
    toggle?.setAttribute('aria-expanded','false');
    drawer?.setAttribute('aria-hidden','true');
  };

  toggle?.addEventListener('click', () => drawer?.classList.contains('open') ? closeMenu() : openMenu());
  closeItems.forEach(el => el.addEventListener('click', closeMenu));
  drawer?.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, {threshold:.12});
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  document.querySelectorAll('form[data-formspree-form="true"]').forEach(form => {
    const statusBox = form.querySelector('[data-form-status]');
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton ? submitButton.textContent : 'Submit';
    const setStatus = (type, message) => {
      if (!statusBox) return;
      statusBox.className = `form-submit-status show ${type}`;
      statusBox.textContent = message;
    };
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const formData = new FormData(form);
      if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Submitting...'; }
      setStatus('loading', 'Submitting your details securely. Please wait...');
      try {
        const response = await fetch(form.action, { method:'POST', body:formData, headers:{'Accept':'application/json'} });
        if (!response.ok) throw new Error('Submission failed');
        setStatus('success', 'Submitted successfully. Redirecting...');
        if (form.classList.contains('tws-application-form')) {
          window.location.href = 'application-thank-you.html';
        } else {
          form.reset();
          if (submitButton) { submitButton.disabled = false; submitButton.textContent = originalButtonText; }
        }
      } catch (error) {
        if (submitButton) { submitButton.disabled = false; submitButton.textContent = originalButtonText; }
        setStatus('error', 'Submission could not be completed right now. Please try again or contact TWS on WhatsApp.');
      }
    });
  });
})();
