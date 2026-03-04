/**
 * app.js — Ghaidak Alosh Portfolio
 *
 * ARCHITECTURE:
 * 1. Runs on DOM parse (deferred) — hero is CSS-animated, no JS dependency
 * 2. Scroll/Nav/Modal init immediately — no load event dependency
 * 3. GSAP/Lenis/ScrollTrigger wait for window.load
 * 4. Desktop enhancements (cursor, magnetic, neon) fire at requestIdleCallback
 * 5. No hamburger menu — removed. Nav = Logo + Glass CTA on all screen sizes.
 */

(function () {
    'use strict';

    // ─── Breakpoint + motion detection ───────────────────────
    const MQ_MOBILE  = window.matchMedia('(max-width:1024px)');
    const REDUCED_MO = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    let isMobile = MQ_MOBILE.matches;
    MQ_MOBILE.addEventListener('change', e => { isMobile = e.matches; });

    // ─── DOM helpers ─────────────────────────────────────────
    const $  = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

    // ─── WhatsApp link sync ───────────────────────────────────
    (function () {
        const WA_HREF = 'https://wa.link/649ato';
        document.querySelectorAll('a[href*="wa.me"], a[href*="wa.link"], a[href*="whatsapp"]').forEach(a => {
            a.setAttribute('href', WA_HREF);
        });
    })();

    // ═══════════════════════════════════════════════════════════
    // STEP 1: HERO REVEAL SETUP
    // Mark non-hero .reveal-up as hidden; hero uses CSS @keyframes.
    // ═══════════════════════════════════════════════════════════
    const heroSection     = $('#hero');
    const allRevealEls    = $$('.reveal-up');
    const heroRevealEls   = heroSection ? $$('.reveal-up', heroSection) : [];
    const scrollRevealEls = allRevealEls.filter(el => !heroRevealEls.includes(el));
    scrollRevealEls.forEach(el => el.classList.add('reveal-ready'));

    // ═══════════════════════════════════════════════════════════
    // STEP 2: SCROLL PROGRESS + NAV + SCROLL-TOP + SCROLL-NAV
    // ═══════════════════════════════════════════════════════════
    const progressBar  = $('#scrollProgress');
    const navEl        = $('.hud-nav');
    const scrollTopBtn = $('#scrollTop');
    const scrollNavBtn = $('#scrollNav');
    let navScrolled = false, btnVisible = false, rafPending = false;
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
            const fold = s > 600;
            if (fold !== btnVisible) {
                btnVisible = fold;
                scrollTopBtn?.classList.toggle('visible', fold);
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
    // STEP 3: BRIEF MODAL
    // ═══════════════════════════════════════════════════════════
    const briefModal = $('#briefModal');
    const closeBrief = $('#closeBrief');
    const briefForm  = $('#briefForm');
    let formDirty    = false;
    let isSubmitting = false;
    let lenisRef     = null;

    briefForm?.querySelectorAll('input, textarea, select').forEach(input => {
        input.addEventListener('input', () => { formDirty = true; });
    });

    const openModal = (e) => {
        e.preventDefault();
        if (!briefModal) return;
        briefModal.classList.add('active');
        briefModal.removeAttribute('aria-hidden');
        lenisRef?.stop();
        document.body.style.overflow = 'hidden';
    };

    const closeModal = (e, force = false) => {
        if (e) e.preventDefault();
        if (formDirty && !force) {
            if (!window.confirm('You have unsaved details. Are you sure you want to close this?')) return;
        }
        briefModal?.classList.remove('active');
        briefModal?.setAttribute('aria-hidden', 'true');
        lenisRef?.start();
        document.body.style.overflow = '';
        if (force) { briefForm?.reset(); formDirty = false; }
    };

    $$('.open-brief').forEach(btn => btn.addEventListener('click', openModal));
    closeBrief?.addEventListener('click', e => closeModal(e));

    // Click outside → shake glass
    briefModal?.addEventListener('click', e => {
        if (e.target !== briefModal) return;
        const glass = $('.brief-glass');
        if (!glass) return;
        glass.style.transform = 'translateY(0) scale(1.018)';
        setTimeout(() => { glass.style.transform = ''; }, 150);
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && briefModal?.classList.contains('active')) closeModal(null);
    });

    // ─── Form submission ──────────────────────────────────────
    // ── Inline field validation helpers ─────────────────────
    function isValidEmail(val) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val.trim());
    }
    function isValidPhone(val) {
        return /^[\+\d][\d\s\-\(\)]{6,}$/.test(val.trim());
    }
    function setFieldError(input, msg) {
        input.classList.add('input-error');
        let err = input.parentNode.querySelector('.field-error');
        if (!err) {
            err = document.createElement('span');
            err.className = 'field-error';
            input.parentNode.appendChild(err);
        }
        err.textContent = msg;
    }
    function clearFieldError(input) {
        input.classList.remove('input-error');
        const err = input.parentNode.querySelector('.field-error');
        if (err) err.remove();
    }

    // Clear errors on input
    $$('.brief-input, .brief-select').forEach(el => {
        el.addEventListener('input', () => clearFieldError(el));
        el.addEventListener('change', () => clearFieldError(el));
    });

    function validateBriefForm(form) {
        let valid = true;
        const name    = form.querySelector('#brief-name');
        const contact = form.querySelector('#brief-contact');
        const service = form.querySelector('#brief-service');
        const budget  = form.querySelector('#brief-budget');

        if (!name.value.trim()) {
            setFieldError(name, 'Please enter your name.'); valid = false;
        } else clearFieldError(name);

        const cVal = contact.value.trim();
        if (!cVal) {
            setFieldError(contact, 'Email or phone number is required.'); valid = false;
        } else if (!isValidEmail(cVal) && !isValidPhone(cVal)) {
            setFieldError(contact, 'Enter a valid email (you@domain.com) or phone (+1 234 567 890).'); valid = false;
        } else clearFieldError(contact);

        if (!service.value) {
            setFieldError(service, 'Please select a service.'); valid = false;
        } else clearFieldError(service);

        if (!budget.value) {
            setFieldError(budget, 'Please select a budget range.'); valid = false;
        } else clearFieldError(budget);

        return valid;
    }

    briefForm?.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (isSubmitting) return;

        if (!validateBriefForm(this)) {
            // Shake the first errored field
            const firstErr = this.querySelector('.input-error');
            if (firstErr) {
                firstErr.focus();
                firstErr.classList.add('shake-err');
                setTimeout(() => firstErr.classList.remove('shake-err'), 500);
            }
            return;
        }

        isSubmitting = true;

        const btn          = this.querySelector('button[type="submit"]');
        const originalHTML = btn.innerHTML;

        const setState = (html, bg, color, pEvents) => {
            btn.innerHTML           = html;
            btn.style.opacity       = pEvents === 'none' ? '0.55' : '1';
            btn.style.background    = bg;
            btn.style.color         = color;
            btn.style.pointerEvents = pEvents;
        };

        setState('<span>SENDING...</span>', 'var(--accent)', '#000', 'none');

        // Basin endpoint — accepts JSON POST, returns 200 on success
        const BASIN_URL = 'https://usebasin.com/f/16d3bed22a44';
        const raw = new FormData(this);
        const payload = { source_url: window.location.href, timestamp: new Date().toISOString() };
        raw.forEach((val, key) => { payload[key] = val; });

        const reset = () => {
            btn.style.background = '';
            btn.style.color      = '';
        };

        try {
            const response = await fetch(BASIN_URL, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body:    JSON.stringify(payload),
            });

            if (response.ok) {
                setState('<span>✓ BRIEF SECURED</span>', 'linear-gradient(135deg,#22c55e,#16a34a)', '#fff', 'none');
                formDirty = false;
                setTimeout(() => {
                    closeModal(null, true);
                    setState(originalHTML, '', '', 'auto');
                    reset();
                    isSubmitting = false;
                }, 2000);
            } else {
                setState('<span>FAILED — TRY AGAIN</span>', 'linear-gradient(135deg,#dc2626,#b91c1c)', '#fff', 'auto');
                setTimeout(() => { setState(originalHTML, '', '', 'auto'); reset(); isSubmitting = false; }, 3000);
            }
        } catch {
            setState('<span>CONNECTION ERROR — TRY AGAIN</span>', 'rgba(255,255,255,0.08)', 'var(--ink)', 'auto');
            setTimeout(() => { setState(originalHTML, '', '', 'auto'); reset(); isSubmitting = false; }, 3000);
        }
    });

    // ─── Budget quick-select ──────────────────────────────────
    const budgetInput  = $('#brief-budget');
    const budgetRange  = $('#brief-budget-range');
    const budgetLabels = {
        starter:    '$500 - $1,500 (Starter Package)',
        growth:     '$1,500 - $3,500 (Growth Package)',
        premium:    '$3,500 - $7,000 (Premium Identity)',
        enterprise: '$7,000+ (Full Brand & Strategy)',
    };
    budgetRange?.addEventListener('change', () => {
        const label = budgetLabels[budgetRange.value];
        if (label && budgetInput) {
            budgetInput.value = label;
            budgetInput.dispatchEvent(new Event('input'));
            setTimeout(() => { budgetRange.selectedIndex = 0; }, 120);
        }
    });

    // ═══════════════════════════════════════════════════════════
    // STEP 4: WINDOW LOAD — GSAP, Lenis, ScrollTrigger, reveals
    // ═══════════════════════════════════════════════════════════
    window.addEventListener('load', () => {

        if (window.gsap && window.ScrollTrigger) {
            gsap.registerPlugin(ScrollTrigger);
        }

        // ── Portfolio IntersectionObserver ────────────────────
        const portItems = $$('.port-item');
        const portBgs   = $$('.port-bg');

        if (portItems.length > 0) {
            // ── Progress navigation (desktop only) ────────────
            let progressNav = null;
            progressNav = document.createElement('nav');
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
            // Show/hide when portfolio section is in view
            const pNavIO = new IntersectionObserver(([entry]) => {
                progressNav.classList.toggle('visible', entry.isIntersecting);
            }, { threshold: 0.05 });
            if (portShowcase) pNavIO.observe(portShowcase);

            const activateIndex = (idx) => {
                portItems.forEach((item, i) => item.classList.toggle('is-active', i === idx));
                portBgs.forEach((bg,   i) => bg.classList.toggle('is-active', i === idx));
                if (progressNav) {
                    progressNav.querySelectorAll('.port-pdot').forEach((dot, i) => {
                        dot.classList.toggle('is-active', i === idx);
                    });
                }
            };

            if (isMobile) {
                // MOBILE: getBoundingClientRect scroll-based switching (iOS Safari compatible).
                let activeIdx = 0;
                activateIndex(0);

                // Remove the static CSS blur-entry class — JS owns this filter directly.
                // Class-based approach can never scrub smoothly; we need per-frame style writes.
                if (portBgs[0]) {
                    portBgs[0].classList.remove('blur-entry');
                    portBgs[0].style.filter = 'blur(20px) brightness(.45)';
                }

                // Lerp helper: smoothly interpolate blur value each frame
                const MAX_BLUR = 20;
                let currentBlur = MAX_BLUR;
                let targetBlur  = MAX_BLUR;
                let blurRaf     = null;

                const lerpBlur = () => {
                    const diff = targetBlur - currentBlur;
                    if (Math.abs(diff) < 0.05) {
                        currentBlur = targetBlur;
                        blurRaf = null;
                    } else {
                        // 0.06 lerp factor → ~2.5s to fully settle → cinematic feel
                        currentBlur += diff * 0.06;
                        blurRaf = requestAnimationFrame(lerpBlur);
                    }
                    if (portBgs[0]) {
                        portBgs[0].style.filter = `blur(${currentBlur.toFixed(2)}px) brightness(.45)`;
                    }
                };

                const setBlurTarget = (val) => {
                    targetBlur = val;
                    if (!blurRaf) blurRaf = requestAnimationFrame(lerpBlur);
                };

                const pickActive = () => {
                    const mid = window.innerHeight / 2;
                    let best = 0, bestDist = Infinity;
                    portItems.forEach((item, i) => {
                        const rect = item.getBoundingClientRect();
                        const itemCenter = rect.top + rect.height / 2;
                        const dist = Math.abs(itemCenter - mid);
                        if (dist < bestDist) { bestDist = dist; best = i; }
                    });
                    if (best !== activeIdx) { activeIdx = best; activateIndex(best); }

                    // Compute blur for bg-1 directly from distance to center.
                    // Full blur (20px) when far away, sharp (0px) when centered.
                    // Bidirectional: works equally on scroll-down and scroll-back-up.
                    if (portBgs[0]) {
                        const r0    = portItems[0].getBoundingClientRect();
                        const dist0 = Math.abs((r0.top + r0.height / 2) - mid);
                        // Map: 0px dist → blur 0, (vh * 1.0) dist → blur 20px, clamped
                        const ratio = Math.min(dist0 / (window.innerHeight * 0.85), 1);
                        setBlurTarget(ratio * MAX_BLUR);
                    }
                };

                window.addEventListener('scroll', pickActive, { passive: true });
                setTimeout(pickActive, 150);

            } else {
                // DESKTOP: IntersectionObserver — blur handled by GSAP below, not via class
                const portObserver = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) activateIndex(portItems.indexOf(entry.target));
                    });
                }, { threshold: 0.5 });

                portItems.forEach(item => portObserver.observe(item));
            }
        }

        // ── Lenis smooth scroll: desktop only ────────────────
        if (!isMobile && typeof Lenis !== 'undefined') {
            try {
                lenisRef = new Lenis({
                    duration:    1.2,
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

                scrollTopBtn?.addEventListener('click', () => lenisRef.scrollTo(0, { duration: 1.4 }));

                scrollNavBtn?.addEventListener('click', () => {
                    const state = scrollNavBtn.dataset.state;
                    const tgt   = state === 'up' ? 0 : document.querySelector('#contact');
                    if (tgt === 0 || tgt) lenisRef.scrollTo(tgt, { offset: state === 'up' ? 0 : -80, duration: 1.5 });
                });

                $$('a[href^="#"]').forEach(a => {
                    a.addEventListener('click', function (e) {
                        const id = this.getAttribute('href');
                        if (id === '#' || id.includes('brief')) return;
                        const tgt = document.querySelector(id);
                        if (tgt) { e.preventDefault(); lenisRef.scrollTo(tgt, { offset: -80, duration: 1.5 }); }
                    });
                });
            } catch (err) {
                lenisRef = null;
            }
        }

        // ── Fallback scroll (no Lenis) ────────────────────────
        if (!lenisRef) {
            scrollTopBtn?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
            scrollNavBtn?.addEventListener('click', () => {
                const state = scrollNavBtn.dataset.state;
                if (state === 'up') window.scrollTo({ top: 0, behavior: 'smooth' });
                else document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            $$('a[href^="#"]').forEach(a => {
                a.addEventListener('click', function (e) {
                    const id = this.getAttribute('href');
                    if (id === '#' || id.includes('brief')) return;
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

        // Mobile: IntersectionObserver (no GSAP)
        if (isMobile || !window.gsap || !window.ScrollTrigger) {
            const revealObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    const el = entry.target;
                    el.style.transition = 'opacity .8s cubic-bezier(.22,1,.36,1), transform .8s cubic-bezier(.22,1,.36,1), filter .8s cubic-bezier(.22,1,.36,1)';
                    el.style.filter     = 'blur(0)';
                    el.classList.remove('reveal-ready');
                    el.style.opacity    = '1';
                    el.style.transform  = 'none';
                    revealObserver.unobserve(el);
                });
            }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

            scrollRevealEls.forEach(el => revealObserver.observe(el));
            return;
        }

        // Desktop: GSAP ScrollTrigger batch reveals
        ScrollTrigger.batch(scrollRevealEls, {
            onEnter: batch => {
                gsap.fromTo(batch,
                    { y: 48, opacity: 0, skewX: -1.5, filter: 'blur(6px)' },
                    {
                        y: 0, opacity: 1, skewX: 0, filter: 'blur(0px)',
                        duration: 1.15, ease: 'power3.out', stagger: 0.08,
                        onComplete() {
                            batch.forEach(el => {
                                el.classList.remove('reveal-ready');
                                el.style.filter = '';
                            });
                        },
                    }
                );
            },
            start: 'top 88%',
            once:  true,
        });

        // Portfolio 3D parallax — desktop only
        const portItemsDesk = $$('.port-item');
        portItemsDesk.forEach(item => {
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
                gsap.set(bg, { scale: 1.08 });
                gsap.fromTo(bg,
                    { yPercent: -6 },
                    { yPercent: 6, ease: 'none',
                      scrollTrigger: { trigger: item, start: 'top bottom', end: 'bottom top', scrub: 1.5 } }
                );
            }
        });

        ScrollTrigger.refresh();

        // Portfolio first bg: blur → unblur scrub
        const bg1         = document.getElementById('bg-1');
        const portSection = document.querySelector('.portfolio-showcase');
        if (bg1 && portSection && !isMobile && portItems.length > 0) {
            // Desktop: GSAP owns bg1 filter entirely. Remove CSS class to avoid conflicts.
            bg1.classList.remove('blur-entry');
            bg1.style.filter = 'blur(20px) brightness(.35)';

            const blurProxy = { v: 20 };
            gsap.to(blurProxy, {
                v: 0,
                // ease is ignored with scrub — scrub number controls the lag/smoothness.
                // scrub: 3 = 3s to catch up to scroll position → feels slow and cinematic.
                onUpdate() {
                    bg1.style.filter = `blur(${blurProxy.v.toFixed(2)}px) brightness(.35)`;
                },
                scrollTrigger: {
                    trigger: portItems[0],
                    start:   'top 85%',      // begin earlier so the full ease is visible
                    end:     'center center', // sharp when Wade Fit is perfectly centered
                    scrub:   3,              // 3s lag = slow, eased in both scroll directions
                    onRefresh(self) {
                        // If page loads mid-scroll, snap blur to correct value immediately
                        if (self.progress > 0) {
                            blurProxy.v = 20 * (1 - self.progress);
                            bg1.style.filter = `blur(${blurProxy.v.toFixed(2)}px) brightness(.35)`;
                        }
                    },
                },
            });
        }

    }); // end window.load

    // ═══════════════════════════════════════════════════════════
    // STEP 5: CUSTOM CURSOR v2 — desktop only
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
            for (let i = 0; i < 4; i++) {
                if (!node || node === document.body) break;
                if (node.dataset?.cursor)          return { type: 'hover',  label: node.dataset.cursor };
                if (node.matches?.('input[type="text"], input[type="email"], input[type="tel"], textarea'))
                                                    return { type: 'text',   label: '' };
                if (node.matches?.('.open-brief, .btn-glass-cta, .btn-gold, [data-cta]'))
                                                    return { type: 'hover',  label: 'START →' };
                if (node.matches?.('.port-item'))   return { type: 'hover',  label: 'VIEW →' };
                if (node.matches?.('.img-container, .img-inner'))
                                                    return { type: 'hover',  label: 'LOOK' };
                if (node.matches?.('a[target="_blank"]'))
                                                    return { type: 'hover',  label: 'OPEN →' };
                if (node.matches?.('.nav-link, .btn-ghost, .social-link, .mobile-link'))
                                                    return { type: 'hover',  label: 'GO →' };
                if (node.matches?.('.close-brief, .scroll-top-btn'))
                                                    return { type: 'invert', label: '' };
                if (node.matches?.('a, button, [role="button"], select'))
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
    // STEP 6: MAGNETIC BUTTONS — desktop only
    // ═══════════════════════════════════════════════════════════
    const initMagneticButtons = () => {
        if (isMobile || REDUCED_MO || !window.gsap) return;

        const targets = $$(
            '.hero-section .btn-glass-cta, .hero-section .btn-gold, .hero-section .btn-ghost,' +
            '.cta-section .btn-glass-cta, .cta-section .btn-gold, .cta-section .btn-ghost,' +
            '.cta-inner .btn-glass-cta, .cta-inner .btn-gold'
        );

        targets.forEach(btn => {
            let rect = null;
            const onEnter = () => { rect = btn.getBoundingClientRect(); btn.classList.remove('magnetic-idle'); };
            const onMove  = (e) => {
                if (!rect) return;
                const dx = (e.clientX - (rect.left + rect.width  / 2)) * 0.38;
                const dy = (e.clientY - (rect.top  + rect.height / 2)) * 0.38;
                gsap.to(btn, { x: dx, y: dy, duration: .45, ease: 'power2.out', overwrite: 'auto' });
            };
            const onLeave = () => {
                rect = null;
                gsap.to(btn, { x: 0, y: 0, duration: .7, ease: 'elastic.out(1,.45)',
                    onComplete: () => btn.classList.add('magnetic-idle') });
            };
            btn.addEventListener('mouseenter', onEnter, { passive: true });
            btn.addEventListener('mousemove',  onMove,  { passive: true });
            btn.addEventListener('mouseleave', onLeave, { passive: true });
        });
    };

    // ═══════════════════════════════════════════════════════════
    // STEP 7: NEON TUBES — CTA section canvas, desktop only
    // ═══════════════════════════════════════════════════════════
    const initNeonTubes = () => {
        const section = $('#contact');
        if (!section || REDUCED_MO || isMobile) return;

        const canvas = document.createElement('canvas');
        canvas.className = 'neon-tubes-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        section.insertBefore(canvas, section.firstChild);

        const ctx = canvas.getContext('2d');
        let W = 0, H = 0, raf = null, running = false;
        let mouseX = -999, mouseY = -999, t = 0;

        const resize = () => {
            W = canvas.width  = section.offsetWidth;
            H = canvas.height = section.offsetHeight;
        };

        const TUBES = [
            { ny:.18, speed:.28, amp:.10, freq:3.2, phase:0.00, color:'#FFC63E', w:1.2, op:.55 },
            { ny:.36, speed:.42, amp:.13, freq:2.8, phase:1.05, color:'#FF9500', w:0.9, op:.40 },
            { ny:.50, speed:.35, amp:.08, freq:4.1, phase:2.09, color:'#FFD966', w:1.5, op:.65 },
            { ny:.65, speed:.50, amp:.12, freq:3.5, phase:3.14, color:'#FFC63E', w:0.8, op:.35 },
            { ny:.78, speed:.31, amp:.09, freq:2.5, phase:4.19, color:'#FF7A00', w:1.1, op:.45 },
            { ny:.90, speed:.46, amp:.11, freq:3.8, phase:5.24, color:'#FFD966', w:0.7, op:.30 },
        ];

        const draw = () => {
            ctx.clearRect(0, 0, W, H);
            t += 0.006;
            TUBES.forEach(tube => {
                const pts = [], step = 12;
                for (let x = -step; x <= W + step; x += step) {
                    let y = H * tube.ny
                        + Math.sin(x / W * Math.PI * tube.freq + t * tube.speed + tube.phase) * H * tube.amp
                        + Math.sin(x / W * Math.PI * tube.freq * 1.7 - t * tube.speed * 0.6 + tube.phase * 0.5) * H * tube.amp * 0.3;
                    if (mouseX > 0) {
                        const mDist     = Math.abs(x - mouseX) / W;
                        const attract   = Math.max(0, 1 - mDist * 2.5);
                        y += (mouseY - H * tube.ny) * 0.12 * attract;
                    }
                    pts.push({ x, y });
                }
                const passes = [
                    { lw: tube.w + 18, alpha: tube.op * 0.06, blur: 40 },
                    { lw: tube.w + 5,  alpha: tube.op * 0.18, blur: 16 },
                    { lw: tube.w,      alpha: tube.op * 0.85, blur: 5  },
                ];
                passes.forEach(({ lw, alpha, blur }) => {
                    ctx.beginPath();
                    ctx.moveTo(pts[0].x, pts[0].y);
                    for (let i = 1; i < pts.length - 2; i++) {
                        const mx = (pts[i].x + pts[i+1].x) / 2;
                        const my = (pts[i].y + pts[i+1].y) / 2;
                        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
                    }
                    ctx.strokeStyle = tube.color; ctx.lineWidth = lw;
                    ctx.globalAlpha = alpha; ctx.shadowBlur  = blur;
                    ctx.shadowColor = tube.color; ctx.lineCap = 'round';
                    ctx.stroke();
                });
            });
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        };

        const loop = () => { if (!running) return; draw(); raf = requestAnimationFrame(loop); };

        const io = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                if (!running) { running = true; resize(); loop(); }
            } else {
                running = false; if (raf) cancelAnimationFrame(raf);
            }
        }, { threshold: 0.05 });

        io.observe(section);
        section.addEventListener('mousemove', e => {
            const rect = section.getBoundingClientRect();
            mouseX = e.clientX - rect.left; mouseY = e.clientY - rect.top;
        }, { passive: true });
        section.addEventListener('mouseleave', () => { mouseX = -999; mouseY = -999; }, { passive: true });
        window.addEventListener('resize', () => { if (running) resize(); }, { passive: true });
        resize();
    };

    // ─── Init desktop enhancements at idle time ───────────────
    const runDesktopInit = () => {
        initCursor();
        initMagneticButtons();
        initNeonTubes();
    };

    if ('requestIdleCallback' in window) {
        window.addEventListener('load', () => requestIdleCallback(runDesktopInit, { timeout: 2500 }));
    } else {
        window.addEventListener('load', () => setTimeout(runDesktopInit, 250));
    }

})();