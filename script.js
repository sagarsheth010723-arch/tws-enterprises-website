
(() => {
  const loader = document.getElementById('siteLoader');
  window.addEventListener('load', () => setTimeout(() => loader && loader.classList.add('hide'), 1200));

  const toggle = document.getElementById('menuToggle');
  const drawer = document.getElementById('menuDrawer');
  const closeMenu = () => {toggle?.classList.remove('active');drawer?.classList.remove('open');document.body.classList.remove('menu-open');toggle?.setAttribute('aria-expanded','false');drawer?.setAttribute('aria-hidden','true')};
  const openMenu = () => {toggle?.classList.add('active');drawer?.classList.add('open');document.body.classList.add('menu-open');toggle?.setAttribute('aria-expanded','true');drawer?.setAttribute('aria-hidden','false')};
  toggle?.addEventListener('click', () => drawer?.classList.contains('open') ? closeMenu() : openMenu());
  document.querySelectorAll('[data-close-menu], .menu-links a, .menu-group a').forEach(el => el.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if(e.key === 'Escape') closeMenu(); });

  const reveal = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver(entries => entries.forEach(entry => { if(entry.isIntersecting){ entry.target.classList.add('show'); io.unobserve(entry.target); } }), {threshold:.12});
  reveal.forEach(el => io.observe(el));

  // Conditional fields support for application form
  const riskRadios = document.querySelectorAll('input[name="risk_tolerance"]');
  const riskOther = document.querySelector('[name="risk_tolerance_other"], #riskOtherInput');
  const brokerSelect = document.querySelector('[name="broker"], #brokerSelect');
  const brokerOther = document.querySelector('[name="broker_other"], [name="other_broker_name"], #otherBrokerInput, #brokerOther input');
  const toggleField = (field, show) => { if(!field) return; field.classList.toggle('show', show); const wrap = field.closest('label'); if(wrap) wrap.classList.toggle('show', show); if(show){field.required = true;} else {field.required = false; field.value = '';} };
  riskRadios.forEach(r => r.addEventListener('change', () => toggleField(riskOther, r.value.toLowerCase()==='other' && r.checked)));
  brokerSelect?.addEventListener('change', () => toggleField(brokerOther, brokerSelect.value.toLowerCase()==='other'));

  // Formspree AJAX submit
  const form = document.querySelector('form[data-formspree-form="true"]');
  if(form){
    const status = form.querySelector('[data-form-status], .form-status, .form-submit-status');
    const button = form.querySelector('button[type="submit"], .form-submit');
    const original = button ? button.textContent : 'Submit Application';
    const setStatus = (type, msg) => { if(!status) return; status.className = (status.className.split(' ')[0] || 'form-status') + ` show ${type}`; status.textContent = msg; };
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if(!form.checkValidity()){ form.reportValidity(); return; }
      if(button){ button.disabled = true; button.textContent = 'Submitting...'; }
      setStatus('loading','Submitting your application securely. Please wait...');
      try{
        const response = await fetch(form.action, {method:'POST', body:new FormData(form), headers:{'Accept':'application/json'}});
        if(!response.ok) throw new Error('Submission failed');
        setStatus('success','Application submitted successfully. Redirecting...');
        window.location.href = 'application-thank-you.html';
      }catch(err){
        if(button){ button.disabled = false; button.textContent = original; }
        setStatus('error','We could not submit the form right now. Please try again, or contact TWS on WhatsApp if the issue continues.');
      }
    });
  }
})();
