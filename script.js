
(() => {
  const loader = document.getElementById('siteLoader');
  const hasSeenLoader = sessionStorage.getItem('twsLoaderSeen') === '1';
  const hideLoader = () => {
    if (!loader) return;
    loader.classList.add('is-hidden');
    sessionStorage.setItem('twsLoaderSeen', '1');
  };
  if (hasSeenLoader) {
    loader?.classList.add('is-hidden');
  } else {
    window.addEventListener('load', () => setTimeout(hideLoader, 850));
    setTimeout(hideLoader, 2200);
  }

  const menu = document.getElementById('menuDrawer');
  const toggle = document.getElementById('menuToggle');
  const openMenu = () => {
    menu?.classList.add('is-open');
    toggle?.classList.add('is-active');
    toggle?.setAttribute('aria-expanded', 'true');
    menu?.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
  };
  const closeMenu = () => {
    menu?.classList.remove('is-open');
    toggle?.classList.remove('is-active');
    toggle?.setAttribute('aria-expanded', 'false');
    menu?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
  };
  toggle?.addEventListener('click', () => menu?.classList.contains('is-open') ? closeMenu() : openMenu());
  document.querySelectorAll('[data-close-menu]').forEach(el => el.addEventListener('click', closeMenu));
  menu?.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));

  // Keep only one menu section expanded.
  document.querySelectorAll('.menu-accordion details').forEach(detail => {
    detail.addEventListener('toggle', () => {
      if (!detail.open) return;
      document.querySelectorAll('.menu-accordion details').forEach(other => {
        if (other !== detail) other.open = false;
      });
    });
  });

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  // Formspree AJAX submission.
  document.querySelectorAll('form[data-formspree-form="true"]').forEach(form => {
    const status = form.querySelector('[data-form-status]');
    const button = form.querySelector('button[type="submit"]');
    const original = button?.textContent || 'Submit';
    const showStatus = (type, message) => {
      if (!status) return;
      status.className = `form-submit-status show ${type}`;
      status.textContent = message;
    };
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      const data = new FormData(form);
      if (button) {
        button.disabled = true;
        button.textContent = 'Submitting...';
      }
      showStatus('loading', 'Submitting your details securely...');
      try {
        const response = await fetch(form.action, {
          method: 'POST',
          body: data,
          headers: { Accept: 'application/json' }
        });
        if (!response.ok) throw new Error('Submission failed');
        showStatus('success', 'Submitted successfully.');
        if (form.classList.contains('tws-application-form')) {
          window.location.href = 'application-thank-you.html';
        } else {
          form.reset();
          if (button) {
            button.disabled = false;
            button.textContent = original;
          }
        }
      } catch (error) {
        showStatus('error', 'Submission failed. Please try again or contact TWS on WhatsApp.');
        if (button) {
          button.disabled = false;
          button.textContent = original;
        }
      }
    });
  });

  // Lazy-load YouTube playlist only when requested.
  const youtubeModal = document.getElementById('youtubeModal');
  const youtubePlayer = document.getElementById('youtubePlayer');
  const openYouTube = () => {
    if (!youtubeModal || !youtubePlayer) return;
    if (!youtubePlayer.querySelector('iframe')) {
      const iframe = document.createElement('iframe');
      iframe.src = youtubePlayer.dataset.src || '';
      iframe.title = 'TWS Live Performance YouTube playlist';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      youtubePlayer.innerHTML = '';
      youtubePlayer.appendChild(iframe);
    }
    youtubeModal.classList.add('is-open');
    youtubeModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
  };
  const closeYouTube = () => {
    if (!youtubeModal || !youtubePlayer) return;
    youtubeModal.classList.remove('is-open');
    youtubeModal.setAttribute('aria-hidden', 'true');
    youtubePlayer.innerHTML = '<div class="youtube-loading">Loading playlist…</div>';
    document.body.classList.remove('no-scroll');
  };
  document.querySelectorAll('[data-open-youtube]').forEach(el => el.addEventListener('click', openYouTube));
  document.querySelectorAll('[data-close-youtube]').forEach(el => el.addEventListener('click', closeYouTube));

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeMenu();
      closeYouTube();
    }
  });
})();
