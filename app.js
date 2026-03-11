/**
 * app.js — Ghaidak Alosh Portfolio v5
 *
 * CHANGES FROM v4:
 * - Brief modal removed; inline quick form (#quickForm) handles contact
 * - Results / partner marquee sections removed — no related JS
 * - initNeonTubes removed (contact section redesigned)
 * - Magnetic buttons updated to target nav CTA only
 * - Quick form: Basin POST, pill validation, 2-field required check
 */

(function () {
    'use strict';

    const MQ_MOBILE  = window.matchMedia('(max-width:1024px)');
    const REDUCED_MO = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    let isMobile = MQ_MOBILE.matches;
    MQ_MOBILE.addEventListener('change', e => { isMobile = e.matches; });

    const $  = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

    // ─── WA link sync ─────────────────────────────────────────
    (function () {
        const WA_HREF = 'https://wa.link/649ato';
        document.querySelectorAll('a[href*="wa.me"], a[href*="wa.link"], a[href*="whatsapp"]').forEach(a => {
            a.setAttribute('href', WA_HREF);
        });
    })();

    // ═══════════════════════════════════════════════════════════
    // SCROLL PROGRESS + NAV + SCROLL-NAV BUTTON
    // ═══════════════════════════════════════════════════════════
    const progressBar  = $('#scrollProgress');
    const navEl        = $('.hud-nav');
    const scrollNavBtn = $('#scrollNav');
    let navScrolled = false, rafPending = false;
    let scrollNavState = 'down';

    const onScroll = () => {
        if (rafPending) return;
        rafPending = true;
        window.requestAnimationFrame(() => {
            const s   = window.scrollY;
            const max = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            if (progressBar) {
                progressBar.style.width = max > 0 ? `${Math.min((s / max) * 100, 100)}%` : '0%';
            }
            const past = s > 60;
            if (past !== navScrolled) {
                navScrolled = past;
                navEl?.classList.toggle('scrolled', past);
            }
            if (scrollNavBtn) {
                const newState = (max > 0 && s > max * 0.5) ? 'up' : 'down';
                if (newState !== scrollNavState) {
                    scrollNavState = newState;
                    scrollNavBtn.dataset.state = newState;
                    scrollNavBtn.setAttribute('aria-label',
                        newState === 'up' ? 'Scroll to top' : 'Scroll to contact');
                }
            }
            rafPending = false;
        });
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // ═══════════════════════════════════════════════════════════
    // CERT MODAL
    // ═══════════════════════════════════════════════════════════
    let lenisRef = null;
    const certModal = $('#certModal');
    const openCertModal = (e) => {
        e.preventDefault();
        if (!certModal) return;
        certModal.classList.add('active');
        certModal.removeAttribute('aria-hidden');
        certModal.removeAttribute('inert');
        lenisRef?.stop();
        document.body.style.overflow = 'hidden';
    };
    const closeCertModal = () => {
        certModal?.classList.remove('active');
        certModal?.setAttribute('aria-hidden', 'true');
        certModal?.setAttribute('inert', '');
        lenisRef?.start();
        document.body.style.overflow = '';
    };
    $$('.open-cert-modal').forEach(btn => btn.addEventListener('click', openCertModal));
    $$('.close-cert-modal').forEach(btn => btn.addEventListener('click', closeCertModal));
    certModal?.addEventListener('click', e => { if (e.target === certModal) closeCertModal(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && certModal?.classList.contains('active')) closeCertModal();
    });

    // ═══════════════════════════════════════════════════════════
    // QUICK FORM — inline contact at bottom of page
    // Required: name + contact. Service/budget = recommended but not blocking.
    // ═══════════════════════════════════════════════════════════
    const quickForm = $('#quickForm');
    if (quickForm) {
        const BASIN_URL = 'https://usebasin.com/f/16d3bed22a44';
        let isSubmitting = false;

        const setQFState = (btn, html, state) => {
            // state: '' | 'sending' | 'success' | 'error' | 'offline'
            btn.innerHTML = html;
            btn.dataset.qfState = state;
            btn.disabled = (state === 'sending' || state === 'success');
        };

        quickForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            if (isSubmitting) return;

            const nameEl    = this.querySelector('[name="name"]');
            const contactEl = this.querySelector('[name="contact"]');
            let valid = true;

            [nameEl, contactEl].forEach(el => {
                el.classList.remove('qf-error');
                if (!el.value.trim()) {
                    el.classList.add('qf-error');
                    valid = false;
                }
            });

            if (!valid) {
                const first = this.querySelector('.qf-error');
                if (first) {
                    first.focus();
                    first.style.animation = 'none';
                    requestAnimationFrame(() => { first.style.animation = ''; });
                }
                return;
            }

            isSubmitting = true;
            const btn = this.querySelector('.qf-submit');
            const originalHTML = btn.innerHTML;

            const resetBtn = (delay) => setTimeout(() => {
                btn.innerHTML = originalHTML;
                delete btn.dataset.qfState;
                btn.disabled = false;
                isSubmitting = false;
            }, delay);

            setQFState(btn, '<span>Sending…</span>', 'sending');

            const raw = new FormData(this);
            const payload = { source_url: window.location.href, timestamp: new Date().toISOString() };
            raw.forEach((val, key) => {
                if (key === 'service[]') {
                    if (!payload.service) payload.service = [];
                    payload.service.push(val);
                } else {
                    payload[key] = val;
                }
            });
            if (Array.isArray(payload.service)) {
                payload.service = payload.service.join(', ');
            }

            try {
                const response = await fetch(BASIN_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(payload),
                });

                if (response.ok) {
                    setQFState(btn, '<span>✓ Brief received — I\'ll be in touch within 24h</span>', 'success');
                    this.reset();
                    resetBtn(5000);
                } else {
                    setQFState(btn, '<span>Failed — please try again</span>', 'error');
                    resetBtn(3000);
                }
            } catch {
                setQFState(btn, '<span>Connection error — try WhatsApp or email</span>', 'offline');
                resetBtn(3500);
            }
        });

        // Clear error on input
        $$('.qf-input', quickForm).forEach(el => {
            el.addEventListener('input', () => el.classList.remove('qf-error'));
        });
    }

    // ═══════════════════════════════════════════════════════════
    // REVEAL SETUP — mark non-hero .reveal-up as hidden
    // ═══════════════════════════════════════════════════════════
    const heroSection     = $('#hero');
    const allRevealEls    = $$('.reveal-up');
    const heroRevealEls   = heroSection ? $$('.reveal-up', heroSection) : [];
    const scrollRevealEls = allRevealEls.filter(el => !heroRevealEls.includes(el));
    scrollRevealEls.forEach(el => el.classList.add('reveal-ready'));

    // ═══════════════════════════════════════════════════════════
    // WINDOW LOAD — GSAP, Lenis, Portfolio, Reveals
    // ═══════════════════════════════════════════════════════════
    window.addEventListener('load', () => {

        if (window.gsap && window.ScrollTrigger) {
            gsap.registerPlugin(ScrollTrigger);
        }

        // ── Portfolio IntersectionObserver ────────────────────
        const portItems = $$('.port-item');
        const portBgs   = $$('.port-bg');

        if (portItems.length > 0) {
            let progressNav = document.createElement('nav');
            progressNav.className = 'port-progress-nav';
            progressNav.id = 'portProgressNav';
            progressNav.setAttribute('aria-label', 'Portfolio navigation');
            portItems.forEach((item, i) => {
                const btn = document.createElement('button');
                btn.className = 'port-pdot' + (i === 0 ? ' is-active' : '');
                btn.setAttribute('aria-label', `View project ${i + 1}`);
                btn.addEventListener('click', () => {
                    if (lenisRef) lenisRef.scrollTo(item, { offset: 0, duration: 1.2 });
                    else item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                });
                progressNav.appendChild(btn);
            });
            const portShowcase = document.querySelector('.portfolio-showcase');
            portShowcase?.appendChild(progressNav);
            const pNavIO = new IntersectionObserver(([entry]) => {
                progressNav.classList.toggle('visible', entry.isIntersecting);
            }, { threshold: 0.05 });
            if (portShowcase) pNavIO.observe(portShowcase);

            // Strip any hardcoded is-active from HTML before observers take over
            portItems.forEach(item => item.classList.remove('is-active'));
            portBgs.forEach(bg => bg.classList.remove('is-active'));

            const activateIndex = (idx) => {
                portItems.forEach((item, i) => item.classList.toggle('is-active', i === idx));
                portBgs.forEach((bg,   i) => bg.classList.toggle('is-active', i === idx));
                progressNav.querySelectorAll('.port-pdot').forEach((dot, i) => {
                    dot.classList.toggle('is-active', i === idx);
                });
            };

            // Same logic for both mobile and desktop:
            // pick the port-item whose center is closest to viewport mid
            let activeIdx = -1;
            const pickActive = () => {
                const mid = window.innerHeight / 2;
                const SNAP_ZONE = window.innerHeight * 0.28; // tight zone — first item only
                let best = -1, bestDist = Infinity;
                portItems.forEach((item, i) => {
                    const rect = item.getBoundingClientRect();
                    if (rect.bottom < 0 || rect.top > window.innerHeight) return;
                    const dist = Math.abs((rect.top + rect.height / 2) - mid);
                    // First item: only activate when centered; rest: activate as soon as closest
                    if (i === 0) {
                        if (dist < SNAP_ZONE && dist < bestDist) { bestDist = dist; best = i; }
                    } else {
                        if (dist < bestDist) { bestDist = dist; best = i; }
                    }
                });
                if (best !== activeIdx) {
                    activeIdx = best;
                    if (best === -1) {
                        portItems.forEach(item => item.classList.remove('is-active'));
                        portBgs.forEach(bg => bg.classList.remove('is-active'));
                    } else {
                        activateIndex(best);
                    }
                }
            };
            window.addEventListener('scroll', pickActive, { passive: true });
            window.addEventListener('resize', pickActive, { passive: true });
            requestAnimationFrame(() => requestAnimationFrame(pickActive));
        }

        // ── Lenis smooth scroll: desktop only ────────────────
        if (!isMobile && typeof Lenis !== 'undefined') {
            try {
                lenisRef = new Lenis({
                    duration:    0.8,
                    easing:      t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
                    smoothTouch: false,
                });
                if (window.gsap && window.ScrollTrigger) {
                    lenisRef.on('scroll', ScrollTrigger.update);
                    gsap.ticker.add(time => { lenisRef.raf(time * 1000); });
                    gsap.ticker.lagSmoothing(0, 0);
                } else {
                    const raf = time => { lenisRef.raf(time); requestAnimationFrame(raf); };
                    requestAnimationFrame(raf);
                }

                scrollNavBtn?.addEventListener('click', () => {
                    const state = scrollNavBtn.dataset.state;
                    const tgt   = state === 'up' ? 0 : document.querySelector('#contact');
                    if (tgt === 0 || tgt) lenisRef.scrollTo(tgt, { offset: state === 'up' ? 0 : -80, duration: 1.5 });
                });

                $$('a[href^="#"]').forEach(a => {
                    a.addEventListener('click', function (e) {
                        const id = this.getAttribute('href');
                        if (id === '#') return;
                        const tgt = document.querySelector(id);
                        if (tgt) { e.preventDefault(); lenisRef.scrollTo(tgt, { offset: -80, duration: 1.5 }); }
                    });
                });
            } catch (err) { console.warn('[Lenis] init failed, falling back to native scroll:', err); lenisRef = null; }
        }

        // ── Fallback scroll ───────────────────────────────────
        if (!lenisRef) {
            scrollNavBtn?.addEventListener('click', () => {
                const state = scrollNavBtn.dataset.state;
                if (state === 'up') window.scrollTo({ top: 0, behavior: 'smooth' });
                else document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            $$('a[href^="#"]').forEach(a => {
                a.addEventListener('click', function (e) {
                    const id = this.getAttribute('href');
                    if (id === '#') return;
                    const tgt = document.querySelector(id);
                    if (tgt) { e.preventDefault(); tgt.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
                });
            });
        }

        // ── Reveal animations ─────────────────────────────────
        if (REDUCED_MO) {
            scrollRevealEls.forEach(el => {
                el.classList.remove('reveal-ready');
                el.style.opacity   = '1';
                el.style.transform = 'none';
            });
            return;
        }

        if (isMobile || !window.gsap || !window.ScrollTrigger) {
            const revealObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    const el = entry.target;
                    el.style.transition = 'opacity .8s cubic-bezier(.22,1,.36,1), transform .8s cubic-bezier(.22,1,.36,1), filter .8s cubic-bezier(.22,1,.36,1)';
                    el.style.filter     = 'blur(0)';
                    el.classList.remove('reveal-ready');
                    el.style.opacity    = '1';
                    el.style.transform  = 'translateY(0)';
                    setTimeout(() => {
                        el.style.willChange = 'auto';
                        el.style.transform  = '';
                        el.style.filter     = '';
                        el.style.transition = '';
                    }, 900);
                    revealObserver.unobserve(el);
                });
            }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
            scrollRevealEls.forEach(el => revealObserver.observe(el));
            return;
        }

        ScrollTrigger.batch(scrollRevealEls, {
            onEnter: batch => {
                gsap.fromTo(batch,
                    { y: 48, opacity: 0, filter: 'blur(6px)' },
                    {
                        y: 0, opacity: 1, filter: 'blur(0px)',
                        duration: 1.15, ease: 'power3.out', stagger: 0.08,
                        onComplete() {
                            batch.forEach(el => {
                                el.classList.remove('reveal-ready');
                                el.style.filter     = '';
                                el.style.willChange = 'auto';
                                el.style.transform  = '';
                            });
                        },
                    }
                );
            },
            start: 'top 88%',
            once:  true,
        });

        // Portfolio 3D parallax — desktop only
        $$('.port-item').forEach(item => {
            const wrap = item.querySelector('.port-text-wrap');
            if (!wrap) return;
            gsap.fromTo(wrap,
                { z: -40, rotateX: 4 },
                { z: 0,   rotateX: 0, ease: 'none',
                  scrollTrigger: { trigger: item, start: 'top bottom', end: 'center center', scrub: 1.2 } }
            );
            gsap.to(wrap, {
                z: -20, rotateX: -3, ease: 'none',
                scrollTrigger: { trigger: item, start: 'center center', end: 'bottom top', scrub: 1.2 },
            });
            const bg = document.getElementById(item.dataset.target);
            if (bg) {
                gsap.fromTo(bg,
                    { yPercent: -2 },
                    { yPercent: 2, ease: 'none',
                      scrollTrigger: { trigger: item, start: 'top bottom', end: 'bottom top', scrub: 1.5 } }
                );
            }
        });

        ScrollTrigger.refresh();


    }); // end window.load

    // ═══════════════════════════════════════════════════════════
    // STEP 5: CUSTOM CURSOR — desktop only
    // ═══════════════════════════════════════════════════════════
    const initCursor = () => {
        if (isMobile || REDUCED_MO) return;
        const cursor      = $('#cursor');
        const cursorLabel = $('#cursorLabel');
        if (!window.gsap || !cursor) return;

        document.body.style.cursor = 'none';
        gsap.set(cursor, { xPercent: -50, yPercent: -50 });

        const xTo = gsap.quickTo(cursor, 'x', { duration: 0.38, ease: 'power3.out' });
        const yTo = gsap.quickTo(cursor, 'y', { duration: 0.38, ease: 'power3.out' });

        window.addEventListener('mousemove', e => {
            xTo(e.clientX); yTo(e.clientY);
            cursor.classList.remove('cursor--hidden');
        }, { passive: true });
        window.addEventListener('mouseleave', () => cursor.classList.add('cursor--hidden'),    { passive: true });
        window.addEventListener('mouseenter', () => cursor.classList.remove('cursor--hidden'), { passive: true });

        const setState = (type, label = '') => {
            cursor.classList.remove('cursor--hover', 'cursor--text', 'cursor--invert');
            if (type) cursor.classList.add(`cursor--${type}`);
            cursorLabel.textContent = label;
        };

        const getCursorState = (el) => {
            if (!el) return null;
            let node = el;
            while (node && node !== document.body) {
                if (node.dataset?.cursor)          return { type: 'hover',  label: node.dataset.cursor };
                if (node.matches?.('input, textarea, select'))
                                                    return { type: 'text',   label: '' };
                if (node.matches?.('.nav-cta, .qf-submit'))
                                                    return { type: 'hover',  label: 'START →' };
                if (node.matches?.('.port-item'))   return { type: 'hover',  label: 'VIEW →' };
                if (node.matches?.('.img-container, .img-inner'))
                                                    return { type: 'hover',  label: 'LOOK' };
                if (node.matches?.('a[target="_blank"]'))
                                                    return { type: 'hover',  label: 'OPEN →' };
                if (node.matches?.('.nav-link, .social-link, .hero-cta-link, .how-down'))
                                                    return { type: 'hover',  label: 'GO →' };
                if (node.matches?.('.channel-btn'))
                                                    return { type: 'hover',  label: 'REACH →' };
                if (node.matches?.('.pill-opt'))
                                                    return { type: 'hover',  label: 'SELECT' };
                if (node.matches?.('a, button, [role="button"]'))
                                                    return { type: 'hover',  label: 'CLICK' };
                node = node.parentElement;
            }
            return null;
        };

        let currentState = null;
        document.body.addEventListener('mouseover', e => {
            document.body.style.cursor = 'none';
            const state = getCursorState(e.target);
            if (!state) { if (currentState) { setState(''); currentState = null; } return; }
            if (state.type !== currentState?.type || state.label !== currentState?.label) {
                setState(state.type, state.label);
                currentState = state;
            }
        }, { passive: true });
        document.body.addEventListener('mouseout', e => {
            const rel = e.relatedTarget;
            if (!rel || rel === document.body || rel === document.documentElement) {
                setState(''); currentState = null;
            }
        }, { passive: true });

        $$('input, textarea, select').forEach(el => {
            el.addEventListener('mouseenter', () => { el.style.cursor = 'text'; },  { passive: true });
            el.addEventListener('mouseleave', () => { el.style.cursor = 'none'; }, { passive: true });
        });
    };

    // ═══════════════════════════════════════════════════════════
    // MAGNETIC BUTTON — nav CTA only
    // ═══════════════════════════════════════════════════════════
    const initMagneticButtons = () => {
        if (isMobile || REDUCED_MO || !window.gsap) return;

        const targets = $$('.nav-cta');
        targets.forEach(btn => {
            let rect = null;
            btn.addEventListener('mouseenter', () => {
                rect = btn.getBoundingClientRect();
                btn.style.willChange = 'transform';
            }, { passive: true });
            btn.addEventListener('mousemove', (e) => {
                if (!rect) return;
                const dx = (e.clientX - (rect.left + rect.width  / 2)) * 0.35;
                const dy = (e.clientY - (rect.top  + rect.height / 2)) * 0.35;
                gsap.to(btn, { x: dx, y: dy, duration: .45, ease: 'power2.out', overwrite: 'auto' });
            }, { passive: true });
            btn.addEventListener('mouseleave', () => {
                rect = null;
                gsap.to(btn, {
                    x: 0, y: 0, duration: .7, ease: 'elastic.out(1,.45)',
                    onComplete: () => { btn.style.willChange = 'auto'; }
                });
            }, { passive: true });
        });

        // will-change on hover for qf-submit
        $$('.qf-submit').forEach(btn => {
            btn.addEventListener('mouseenter', () => { btn.style.willChange = 'transform'; }, { passive: true });
            btn.addEventListener('mouseleave', () => { btn.style.willChange = 'auto'; },      { passive: true });
        });
    };

    // ═══════════════════════════════════════════════════════════
    // SPOTLIGHT CARDS — mouse-position radial on hover
    // ═══════════════════════════════════════════════════════════
    const initSpotlightCards = () => {
        if (REDUCED_MO) return;

        const trackMouse = (el) => (e) => {
            const rect = el.getBoundingClientRect();
            el.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
            el.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
        };

        ['.editorial-review', '.how-step'].forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                el.addEventListener('mousemove', trackMouse(el), { passive: true });
            });
        });

        // cap-card: inject overlay span (both pseudo-elements are taken by accent lines)
        document.querySelectorAll('.cap-card').forEach(el => {
            const overlay = document.createElement('span');
            overlay.className = 'cap-spotlight-overlay';
            overlay.setAttribute('aria-hidden', 'true');
            el.insertBefore(overlay, el.firstChild);
            el.addEventListener('mousemove', (e) => {
                const rect = el.getBoundingClientRect();
                el.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                el.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
                overlay.style.opacity = '1';
            }, { passive: true });
            el.addEventListener('mouseleave', () => {
                overlay.style.opacity = '0';
            }, { passive: true });
        });
    };

    // ─── Init desktop enhancements at idle time ───────────────
    const runDesktopInit = () => {
        initCursor();
        initMagneticButtons();
        initSpotlightCards();
    };

    if ('requestIdleCallback' in window) {
        window.addEventListener('load', () => requestIdleCallback(runDesktopInit, { timeout: 2500 }));
    } else {
        window.addEventListener('load', () => setTimeout(runDesktopInit, 250));
    }

})();
