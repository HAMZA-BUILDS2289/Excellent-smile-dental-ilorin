(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Runs once: navigation bar behaviour + scroll parallax
  function setupNav() {
    const nav = $('.nav');
    const burger = $('.burger');
    const menu = $('.menu');
    const onScroll = () => {
      if (nav) nav.classList.toggle('solid', scrollY > 30);
      const bg = $('.page-hero .bg');
      if (bg && !reduced && scrollY < 900) bg.style.transform = `translate3d(0,${scrollY * 0.25}px,0)`;
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    if (burger && menu) {
      burger.addEventListener('click', () => {
        const open = menu.classList.toggle('open');
        burger.classList.toggle('open', open);
        burger.setAttribute('aria-expanded', open);
      });
      menu.addEventListener('click', (e) => {
        if (e.target.closest('a')) { menu.classList.remove('open'); burger.classList.remove('open'); }
      });
    }
  }

  // Runs for every page (or every time a page is swapped in)
  function init(root = document) {
    const WA = document.body.dataset.wa || '';

    // Reveal on scroll
    const rv = $$('.rv', root);
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      rv.forEach((el) => io.observe(el));
    } else rv.forEach((el) => el.classList.add('in'));

    // 3D tilt on cards (mouse devices only)
    if (matchMedia('(hover:hover) and (pointer:fine)').matches && !reduced) {
      $$('.tilt', root).forEach((c) => {
        c.addEventListener('pointermove', (e) => {
          const r = c.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          c.style.transform = `perspective(900px) rotateY(${x * 7}deg) rotateX(${-y * 7}deg) translateY(-6px)`;
        });
        c.addEventListener('pointerleave', () => { c.style.transform = ''; });
      });
    }

    // Count-up numbers
    $$('[data-count]', root).forEach((el) => {
      const end = parseFloat(el.dataset.count);
      const dec = el.dataset.count.includes('.') ? 1 : 0;
      const io = new IntersectionObserver(([en]) => {
        if (!en.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const step = (n) => {
          const k = Math.min(1, (n - t0) / 1400);
          el.textContent = (end * (1 - Math.pow(1 - k, 3))).toFixed(dec);
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
      io.observe(el);
    });

    // Gallery filters + lightbox
    const items = $$('.g-item', root);
    if (items.length) {
      $$('.filters button', root).forEach((b) => b.addEventListener('click', () => {
        $$('.filters button', root).forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        const f = b.dataset.f;
        items.forEach((i) => i.classList.toggle('hide', f !== 'all' && i.dataset.cat !== f));
      }));
      const lb = $('.lightbox', root);
      const lbImg = $('img', lb);
      const lbCap = $('p', lb);
      let idx = 0;
      const vis = () => items.filter((i) => !i.classList.contains('hide'));
      const show = (n) => {
        const list = vis();
        idx = (n + list.length) % list.length;
        const it = list[idx];
        lbImg.classList.remove('zoom');
        lbImg.src = it.dataset.full;
        lbImg.alt = it.dataset.alt;
        lbCap.textContent = it.dataset.alt;
      };
      const close = () => { lb.classList.remove('open'); document.body.style.overflow = ''; };
      items.forEach((it) => it.addEventListener('click', () => { idx = vis().indexOf(it); show(idx); lb.classList.add('open'); document.body.style.overflow = 'hidden'; }));
      $('.lb-close', lb).onclick = close;
      $('.lb-prev', lb).onclick = () => show(idx - 1);
      $('.lb-next', lb).onclick = () => show(idx + 1);
      lbImg.onclick = () => lbImg.classList.toggle('zoom');
      lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
      if (window.__lbKey) removeEventListener('keydown', window.__lbKey);
      window.__lbKey = (e) => {
        if (!lb.classList.contains('open')) return;
        if (e.key === 'Escape') close();
        if (e.key === 'ArrowLeft') show(idx - 1);
        if (e.key === 'ArrowRight') show(idx + 1);
      };
      addEventListener('keydown', window.__lbKey);
      let sx = 0;
      lb.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
      lb.addEventListener('touchend', (e) => { const d = e.changedTouches[0].clientX - sx; if (Math.abs(d) > 50) show(idx + (d < 0 ? 1 : -1)); });
    }

    // Appointment form
    const form = $('#appt', root);
    if (form) {
      const note = $('#appt-note', form.parentNode) || $('#appt-note');
      const btn = $('button[type=submit]', form);
      const dateInput = $('[name=date]', form);
      if (dateInput) dateInput.min = new Date().toISOString().slice(0, 10);

      const rules = {
        name: (v) => (v.trim().length >= 2 ? '' : 'Please enter your full name.'),
        phone: (v) => (/^[+\d][\d\s-]{6,17}$/.test(v.trim()) ? '' : 'Please enter a valid phone number.'),
        email: (v) => (!v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Please enter a valid email address.'),
        date: (v) => (v ? '' : 'Please choose a preferred date.'),
        time: (v) => (v ? '' : 'Please choose a preferred time.'),
        service: (v) => (v ? '' : 'Please choose a service.'),
        reason: (v) => (v.trim().length >= 3 ? '' : 'Please tell us briefly why you are visiting.'),
      };
      const check = (el) => {
        const r = rules[el.name];
        if (!r) return true;
        const msg = r(el.value);
        el.classList.toggle('bad', !!msg);
        const e = el.closest('.f').querySelector('.err');
        if (e) e.textContent = msg;
        return !msg;
      };
      $$('input,select,textarea', form).forEach((el) => el.addEventListener('blur', () => check(el)));

      const waText = (d) =>
        `Hello Excellent Smile Dental Services, I would like to request an appointment.\n\nName: ${d.name}\nPhone: ${d.phone}\nService: ${d.service}\nPreferred date: ${d.date}\nPreferred time: ${d.time}\nPatient type: ${d.patientType}\nReason: ${d.reason}${d.info ? '\nNotes: ' + d.info : ''}`;

      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        note.className = 'notice';
        note.textContent = '';
        const valid = $$('input,select,textarea', form).map(check).every(Boolean);
        if (!valid) {
          const first = $('.bad', form);
          if (first) first.focus();
          return;
        }
        const data = Object.fromEntries(new FormData(form).entries());
        if (data.company) return; // honeypot
        const waLink = `https://wa.me/${WA}?text=${encodeURIComponent(waText(data))}`;
        if (document.body.dataset.api === 'none') {
          note.className = 'notice ok';
          note.innerHTML = `<strong>Almost done, ${escapeHtml(data.name.split(' ')[0])}!</strong> Tap the button below to send your appointment request to the clinic on WhatsApp. Your appointment is only confirmed once the clinic replies to agree a date and time.<br><br><a class="btn btn-wa" href="${waLink}" target="_blank" rel="noopener">Send request on WhatsApp</a>`;
          note.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        btn.disabled = true;
        btn.textContent = 'Sending…';
        try {
          const res = await fetch('/api/appointment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
          const out = await res.json().catch(() => ({}));
          if (!res.ok || !out.ok) throw new Error(out.error || 'failed');
          form.reset();
          note.className = 'notice ok';
          note.innerHTML = `<strong>Thank you, ${escapeHtml(data.name.split(' ')[0])}. Your appointment request has been received and is pending.</strong><br>Reference: <b>${escapeHtml(out.ref)}</b>. The clinic will contact you to confirm your date and time. Your appointment is only confirmed once the clinic has contacted you.<br><br><a class="btn btn-wa btn-sm" href="${waLink}" target="_blank" rel="noopener">Also send this request on WhatsApp</a>`;
        } catch (e) {
          note.className = 'notice warn';
          note.innerHTML = `We could not send your request online just now. Please send it to the clinic on WhatsApp instead.<br><br><a class="btn btn-wa btn-sm" href="${waLink}" target="_blank" rel="noopener">Send request on WhatsApp</a>`;
        } finally {
          btn.disabled = false;
          btn.textContent = 'Request Appointment';
          note.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  }

  window.EDC = { init, setupNav };
  setupNav();
  if (!window.EDC_MANUAL) init();
})();
