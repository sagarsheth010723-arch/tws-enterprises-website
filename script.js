
(() => {
  const preloader=document.getElementById('preloader');
  const hideLoader=()=>preloader?.classList.add('hidden');
  window.addEventListener('load',()=>setTimeout(hideLoader,650)); setTimeout(hideLoader,1800);
  const mobile=document.getElementById('mobileMenu'); const toggle=document.getElementById('menuToggle');
  const openMenu=()=>{mobile?.classList.add('open');mobile?.setAttribute('aria-hidden','false');document.body.classList.add('menu-open')};
  const closeMenu=()=>{mobile?.classList.remove('open');mobile?.setAttribute('aria-hidden','true');document.body.classList.remove('menu-open')};
  toggle?.addEventListener('click',openMenu); document.querySelectorAll('[data-close-menu]').forEach(x=>x.addEventListener('click',closeMenu));
  document.querySelectorAll('.mobile-menu a').forEach(x=>x.addEventListener('click',closeMenu));
  const slides=[...document.querySelectorAll('.hero-slide')],dots=[...document.querySelectorAll('.hero-dots button')]; let index=0,timer;
  const show=i=>{if(!slides.length)return;index=(i+slides.length)%slides.length;slides.forEach((s,n)=>s.classList.toggle('active',n===index));dots.forEach((d,n)=>d.classList.toggle('active',n===index));};
  const autoplay=()=>{clearInterval(timer);timer=setInterval(()=>show(index+1),6000)}; document.querySelector('[data-hero-next]')?.addEventListener('click',()=>{show(index+1);autoplay()}); document.querySelector('[data-hero-prev]')?.addEventListener('click',()=>{show(index-1);autoplay()}); dots.forEach(d=>d.addEventListener('click',()=>{show(Number(d.dataset.slide));autoplay()})); autoplay();
  const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target)}}),{threshold:.12}); document.querySelectorAll('.reveal').forEach(x=>io.observe(x));
  document.querySelectorAll('form[data-formspree-form="true"]').forEach(form=>{const status=form.querySelector('[data-form-status]'); const button=form.querySelector('button[type="submit"]'); form.addEventListener('submit',async e=>{e.preventDefault();if(!form.checkValidity()){form.reportValidity();return}; const original=button?.textContent||'Submit'; if(button){button.disabled=true;button.textContent='Submitting...'}; if(status){status.className='form-submit-status show';status.textContent='Submitting your details securely...'}; try{const r=await fetch(form.action,{method:'POST',body:new FormData(form),headers:{Accept:'application/json'}});if(!r.ok)throw new Error(); if(form.classList.contains('tws-application-form'))location.href='application-thank-you.html';else{form.reset();if(status)status.textContent='Submitted successfully.'}}catch(err){if(status)status.textContent='Submission failed. Please contact TWS on WhatsApp.'}finally{if(button){button.disabled=false;button.textContent=original}}})});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
})();

/* V38 navigation polish */
(() => {
  const current=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  document.querySelectorAll('.desktop-nav a[href]').forEach(link=>{
    const href=(link.getAttribute('href')||'').split('#')[0].toLowerCase();
    if(href===current){
      link.classList.add('current');
      const group=link.closest('.nav-group');
      if(group) group.classList.add('current');
    }
  });
  document.querySelectorAll('.desktop-nav .nav-group').forEach(group=>{
    const button=group.querySelector(':scope > button');
    group.addEventListener('mouseenter',()=>button?.setAttribute('aria-expanded','true'));
    group.addEventListener('mouseleave',()=>button?.setAttribute('aria-expanded','false'));
    group.addEventListener('focusin',()=>button?.setAttribute('aria-expanded','true'));
    group.addEventListener('focusout',e=>{if(!group.contains(e.relatedTarget))button?.setAttribute('aria-expanded','false')});
  });
  document.querySelectorAll('.mobile-menu details').forEach(detail=>{
    const marker=detail.querySelector('summary span');
    const sync=()=>{if(marker) marker.textContent=detail.open?'×':'+'};
    detail.addEventListener('toggle',sync); sync();
  });
})();


/* V41 in-site YouTube modal */
(() => {
  const selectors = '.performance-card, .performance-gallery-card, .mobile-performance a';

  const extractVideoId = (link) => {
    const explicit = link.dataset.video;
    if (explicit) return explicit;
    try {
      const url = new URL(link.href, window.location.href);
      if (url.hostname.includes('youtu.be')) return url.pathname.split('/').filter(Boolean)[0] || '';
      const parts = url.pathname.split('/').filter(Boolean);
      const shortsIndex = parts.indexOf('shorts');
      if (shortsIndex !== -1 && parts[shortsIndex + 1]) return parts[shortsIndex + 1];
      const embedIndex = parts.indexOf('embed');
      if (embedIndex !== -1 && parts[embedIndex + 1]) return parts[embedIndex + 1];
      return url.searchParams.get('v') || '';
    } catch (_) {
      return '';
    }
  };

  let modal;
  let frame;
  let closeButton;
  let lastTrigger;

  const ensureModal = () => {
    if (modal) return;
    modal = document.createElement('div');
    modal.className = 'video-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="video-modal-dialog" role="dialog" aria-modal="true" aria-label="TWS performance video">
        <button class="video-modal-close" type="button" aria-label="Close video">×</button>
        <div class="video-modal-frame">
          <iframe title="TWS performance video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
        </div>
      </div>`;
    document.body.appendChild(modal);
    frame = modal.querySelector('iframe');
    closeButton = modal.querySelector('.video-modal-close');
    closeButton.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
  };

  const openModal = (videoId, trigger) => {
    if (!videoId) return;
    ensureModal();
    lastTrigger = trigger;
    frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0&playsinline=1`;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('video-modal-open');
    window.setTimeout(() => closeButton.focus(), 50);
  };

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('video-modal-open');
    frame.src = '';
    lastTrigger?.focus?.();
  }

  document.querySelectorAll(selectors).forEach((link) => {
    const videoId = extractVideoId(link);
    if (!videoId) return;
    link.dataset.video = videoId;
    link.removeAttribute('target');
    link.removeAttribute('rel');
    link.setAttribute('aria-haspopup', 'dialog');
    link.addEventListener('click', (event) => {
      event.preventDefault();
      openModal(videoId, link);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal?.classList.contains('open')) closeModal();
  });
})();
