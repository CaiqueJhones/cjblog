'use strict';

// Mobile nav
(function () {
  const btn   = document.getElementById('navHamburger');
  const links = document.getElementById('navLinks');
  if (!btn || !links) return;

  const setOpen = open => {
    links.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('nav-open', open);
  };

  btn.addEventListener('click', () => {
    setOpen(!links.classList.contains('open'));
  });

  links.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => setOpen(false))
  );

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      setOpen(false);
    }
  });
})();

// Scroll reveal
(function () {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) {
        target.classList.add('visible');
        io.unobserve(target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
})();

// Back to top
(function () {
  const btn = document.getElementById('backToTop');
  if (!btn) return;

  const toggle = () => btn.classList.toggle('visible', window.scrollY > 480);
  toggle();
  document.addEventListener('scroll', toggle, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

// Lupa nas imagens do post: clique amplia para a maior resolução
(function () {
  const imgs = document.querySelectorAll('.post__content img');
  if (!imgs.length) return;

  const overlay = document.createElement('div');
  overlay.className = 'img-lightbox';
  overlay.innerHTML =
    '<button type="button" class="img-lightbox__close" aria-label="Fechar imagem ampliada">&times;</button>' +
    '<img class="img-lightbox__img" alt="" />';
  document.body.appendChild(overlay);

  const lbImg    = overlay.querySelector('.img-lightbox__img');
  const closeBtn = overlay.querySelector('.img-lightbox__close');

  const open = (img) => {
    lbImg.src = img.dataset.full || img.currentSrc || img.src;
    lbImg.alt = img.alt || '';
    overlay.classList.add('open');
    document.documentElement.classList.add('lightbox-open');
  };
  const close = () => {
    overlay.classList.remove('open');
    document.documentElement.classList.remove('lightbox-open');
    lbImg.removeAttribute('src');
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target === closeBtn || e.target === lbImg) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) close();
  });

  const badgeSvg =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="11" cy="11" r="7"></circle>' +
    '<line x1="11" y1="8" x2="11" y2="14"></line>' +
    '<line x1="8" y1="11" x2="14" y2="11"></line>' +
    '<line x1="21" y1="21" x2="16.65" y2="16.65"></line>' +
    '</svg>';

  imgs.forEach((img) => {
    const wrap = document.createElement('span');
    wrap.className = 'img-zoom';
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('aria-label', 'Ampliar imagem' + (img.alt ? ': ' + img.alt : ''));

    img.parentNode.insertBefore(wrap, img);
    wrap.appendChild(img);

    const badge = document.createElement('span');
    badge.className = 'img-zoom__badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.innerHTML = badgeSvg;
    wrap.appendChild(badge);

    wrap.addEventListener('click', () => open(img));
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open(img);
      }
    });
  });
})();

// Active nav on scroll
(function () {
  const sections = document.querySelectorAll('section[id]');
  if (!sections.length) return;
  const links = document.querySelectorAll('.nav__links a');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) {
        links.forEach(l => l.classList.remove('active'));
        const a = document.querySelector(`.nav__links a[href="#${target.id}"]`);
        if (a) a.classList.add('active');
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach(s => io.observe(s));
})();
