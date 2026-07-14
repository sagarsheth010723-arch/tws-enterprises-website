
// =========================
// TWS Website V13 Final JS
// Clean single-controller build
// Fixes menu double-toggle issue
// =========================

// Sticky header
const siteHeader = document.querySelector('.site-header');
window.addEventListener('scroll', () => {
  if (siteHeader) {
    siteHeader.classList.toggle('scrolled', window.scrollY > 8);
  }
}, { passive: true });

// Current year
document.querySelectorAll('[data-year]').forEach(el => {
  el.textContent = new Date().getFullYear();
});

// Reveal on scroll
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// Button ripple
document.querySelectorAll('.btn').forEach(btn => {
  btn.addEventListener('click', e => {
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.style.cssText = `
      position:absolute;
      border-radius:50%;
      background:rgba(255,255,255,.45);
      width:20px;
      height:20px;
      left:${e.clientX - rect.left - 10}px;
      top:${e.clientY - rect.top - 10}px;
      transform:scale(0);
      animation:twsRipple .5s ease-out forwards;
      pointer-events:none;
    `;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 520);
  });
});

const rippleStyle = document.createElement('style');
rippleStyle.textContent = '@keyframes twsRipple{to{transform:scale(10);opacity:0}}';
document.head.appendChild(rippleStyle);

// Top-right dropdown + mobile accordion menu
(() => {
  const header = document.querySelector('.mobile-optimized-header, .top-right-menu-header');
  const trigger = document.querySelector('[data-mega-trigger]');
  const panel = document.querySelector('[data-mega-panel]');

  if (!header || !trigger || !panel) return;

  const isOpen = () => header.classList.contains('menu-open');

  const openMenu = () => {
    header.classList.add('menu-open');
    trigger.setAttribute('aria-expanded', 'true');
    if (window.innerWidth <= 700) {
      document.body.classList.add('menu-lock');
    }
  };

  const closeMenu = () => {
    header.classList.remove('menu-open');
    trigger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('menu-lock');
  };

  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (isOpen()) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  panel.addEventListener('click', (event) => {
    if (event.target.closest('[data-accordion-button]')) return;

    if (event.target.closest('a')) {
      closeMenu();
    }
  });

  document.querySelectorAll('[data-accordion-button]').forEach(button => {
    button.addEventListener('click', (event) => {
      if (window.innerWidth > 700) return;

      event.preventDefault();
      event.stopPropagation();

      const section = button.closest('.mobile-accordion');
      if (!section) return;

      const willOpen = !section.classList.contains('active');

      document.querySelectorAll('.mobile-accordion.active').forEach(openSection => {
        if (openSection !== section) {
          openSection.classList.remove('active');
          const btn = openSection.querySelector('[data-accordion-button]');
          if (btn) btn.setAttribute('aria-expanded', 'false');
        }
      });

      section.classList.toggle('active', willOpen);
      button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });
  });

  document.addEventListener('click', (event) => {
    if (!header.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 700) {
      document.body.classList.remove('menu-lock');
    }
  });
})();

// Mobile touch/tap animation polish
(() => {
  const selectors = [
    '.service-card',
    '.tool-card',
    '.content-card',
    '.process-card',
    '.standard-card',
    '.app-phone',
    '.phone-card',
    '.tablet-device',
    '.tablet-float',
    '.btn',
    '.header-cta',
    '.top-menu-button',
    '.dropdown-section a',
    '.dropdown-section-title',
    '.float-wa'
  ];

  const elements = document.querySelectorAll(selectors.join(','));

  elements.forEach((element) => {
    element.classList.add('tap-target');

    element.addEventListener('touchstart', () => {
      element.classList.add('is-tapping');
    }, { passive: true });

    element.addEventListener('touchend', () => {
      setTimeout(() => element.classList.remove('is-tapping'), 140);
    }, { passive: true });

    element.addEventListener('touchcancel', () => {
      element.classList.remove('is-tapping');
    }, { passive: true });
  });
})();



// V15 Application Form conditional fields
(() => {
  document.querySelectorAll('[data-select-other]').forEach(select => {
    const target = document.getElementById(select.dataset.selectOther);
    if (!target) return;

    const sync = () => {
      const show = select.value === 'Other';
      target.classList.toggle('show', show);
      target.querySelectorAll('input, textarea, select').forEach(input => {
        input.required = show;
      });
    };

    select.addEventListener('change', sync);
    sync();
  });

  document.querySelectorAll('[data-show-field]').forEach(radio => {
    const group = document.querySelectorAll(`input[name="${radio.name}"]`);
    const target = document.getElementById(radio.dataset.showField);
    if (!target) return;

    const sync = () => {
      const show = radio.checked;
      target.classList.toggle('show', show);
      target.querySelectorAll('input, textarea, select').forEach(input => {
        input.required = show;
      });
    };

    group.forEach(item => item.addEventListener('change', sync));
    sync();
  });
})();


// V21 Formspree AJAX submit flow
// Submits in the background and redirects users to the TWS thank-you page.
(() => {
  const form = document.querySelector('form[data-formspree-form="true"]');
  if (!form) return;

  const statusBox = form.querySelector('[data-form-status]');
  const submitButton = form.querySelector('button[type="submit"]');
  const originalButtonText = submitButton ? submitButton.textContent : 'Submit Application';

  const setStatus = (type, message) => {
    if (!statusBox) return;
    statusBox.className = `form-submit-status show ${type}`;
    statusBox.textContent = message;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const action = form.getAttribute('action');
    const formData = new FormData(form);

    form.classList.add('is-submitting');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Submitting...';
    }
    setStatus('loading', 'Submitting your application securely. Please wait...');

    try {
      const response = await fetch(action, {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Submission failed');
      }

      setStatus('success', 'Application submitted successfully. Redirecting...');
      window.location.href = 'application-thank-you.html';
    } catch (error) {
      form.classList.remove('is-submitting');
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
      setStatus('error', 'We could not submit the form right now. Please try again, or contact TWS on WhatsApp if the issue continues.');
    }
  });
})();
