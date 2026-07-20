
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
