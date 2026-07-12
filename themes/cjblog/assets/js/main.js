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
