
const header = document.querySelector('.site-header');
window.addEventListener('scroll', () => {
  header && header.classList.toggle('scrolled', window.scrollY > 8);
}, {passive:true});

const toggle = document.querySelector('.menu-toggle');
const menu = document.querySelector('[data-menu]');
if(toggle && menu){
  toggle.addEventListener('click', () => menu.classList.toggle('open'));
}

document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if(entry.isIntersecting){
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, {threshold:.12});
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

document.querySelectorAll('.btn').forEach(btn => {
  btn.addEventListener('click', e => {
    const r = btn.getBoundingClientRect();
    const dot = document.createElement('span');
    dot.style.cssText = `position:absolute;border-radius:50%;background:rgba(255,255,255,.45);width:20px;height:20px;left:${e.clientX-r.left-10}px;top:${e.clientY-r.top-10}px;transform:scale(0);animation:ripple .5s ease-out forwards;pointer-events:none;`;
    btn.appendChild(dot);
    setTimeout(() => dot.remove(), 520);
  });
});
const style = document.createElement('style');
style.textContent='@keyframes ripple{to{transform:scale(10);opacity:0}}';
document.head.appendChild(style);



// V8 Mega dropdown menu
const megaTrigger = document.querySelector('[data-mega-trigger]');
const megaPanel = document.querySelector('[data-mega-panel]');
const dropdownHeader = document.querySelector('.dropdown-header');

if (megaTrigger && megaPanel && dropdownHeader) {
  megaTrigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = dropdownHeader.classList.toggle('menu-open');
    megaTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  document.addEventListener('click', (event) => {
    if (!dropdownHeader.contains(event.target)) {
      dropdownHeader.classList.remove('menu-open');
      megaTrigger.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      dropdownHeader.classList.remove('menu-open');
      megaTrigger.setAttribute('aria-expanded', 'false');
    }
  });

  megaPanel.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      dropdownHeader.classList.remove('menu-open');
      megaTrigger.setAttribute('aria-expanded', 'false');
    });
  });
}



// V10 Top-right dropdown menu controller
(() => {
  const header = document.querySelector('.top-right-menu-header');
  const trigger = document.querySelector('[data-mega-trigger]');
  const panel = document.querySelector('[data-mega-panel]');
  if (!header || !trigger || !panel) return;

  const closeMenu = () => {
    header.classList.remove('menu-open');
    trigger.setAttribute('aria-expanded', 'false');
  };

  const openMenu = () => {
    header.classList.add('menu-open');
    trigger.setAttribute('aria-expanded', 'true');
  };

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    header.classList.contains('menu-open') ? closeMenu() : openMenu();
  });

  panel.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });

  document.addEventListener('click', (event) => {
    if (!header.contains(event.target)) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });
})();



// V11 mobile accordion menu
(() => {
  const header = document.querySelector('.mobile-optimized-header');
  const trigger = document.querySelector('[data-mega-trigger]');
  const panel = document.querySelector('[data-mega-panel]');
  if (!header || !trigger || !panel) return;

  const closeMenu = () => {
    header.classList.remove('menu-open');
    document.body.classList.remove('menu-lock');
    trigger.setAttribute('aria-expanded', 'false');
  };

  const openMenu = () => {
    header.classList.add('menu-open');
    if (window.innerWidth <= 700) document.body.classList.add('menu-lock');
    trigger.setAttribute('aria-expanded', 'true');
  };

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    header.classList.contains('menu-open') ? closeMenu() : openMenu();
  });

  document.querySelectorAll('[data-accordion-button]').forEach(button => {
    button.addEventListener('click', () => {
      if (window.innerWidth > 700) return;

      const section = button.closest('.mobile-accordion');
      const isOpen = section.classList.contains('active');

      document.querySelectorAll('.mobile-accordion.active').forEach(openSection => {
        if (openSection !== section) {
          openSection.classList.remove('active');
          const btn = openSection.querySelector('[data-accordion-button]');
          if (btn) btn.setAttribute('aria-expanded', 'false');
        }
      });

      section.classList.toggle('active', !isOpen);
      button.setAttribute('aria-expanded', !isOpen ? 'true' : 'false');
    });
  });

  panel.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => closeMenu());
  });

  document.addEventListener('click', (event) => {
    if (!header.contains(event.target)) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 700) document.body.classList.remove('menu-lock');
  });
})();



// V12 touch/tap animation polish for mobile users
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
