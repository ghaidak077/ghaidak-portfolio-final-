/**
 * effects.js — Ghaidak Alosh Portfolio
 * Enhanced visual effects: hero word-blur animation + gradient CTA.
 *
 * ARCHITECTURE:
 * ─────────────────────────────────────────────────────────────
 * Loaded as a NON-DEFERRED <script> in <head>. The script registers
 * a DOMContentLoaded listener (or runs immediately if the DOM is
 * already ready) so word-split and WebGL init execute as early as
 * possible — before the first visible paint — preventing FOUC on
 * the hero heading.
 *
 * The mwIn animation is defined in main.css. This script only
 * splits the text nodes and sets CSS custom property --i for stagger.
 *
 * Performance:
 *  - Word split: O(n) on text nodes only — ~3 DOM mutations total
 *  - will-change: set by CSS on .mw, cleared after animation completes
 *  - @property gradient: GPU-accelerated, zero layout cost
 * ─────────────────────────────────────────────────────────────
 */

(function () {
    'use strict';

    // ── Guard: respect prefers-reduced-motion ──────────────────
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // ── Guard: @property support check (Chrome 85+, Firefox 128+) ──
    // If not supported, gradient button fallback is the existing glass hover.
    // Word split still works fine without @property.
    var supportsAtProperty = (function () {
        try {
            CSS.registerProperty({
                name: '--test-eff',
                syntax: '<number>',
                initialValue: '0',
                inherits: false
            });
            return true;
        } catch (e) {
            // Already registered or not supported — both are fine
            return typeof CSSPropertyRule !== 'undefined' ||
                   (e && e.name === 'InvalidModificationError');
        }
    })();

    // Register --btn-border-angle for the animated conic-gradient button border.
    // CSS @property in main.css covers static declaration; JS registration
    // is the fallback path for browsers that parse CSS @property lazily.
    if (supportsAtProperty) {
        try {
            CSS.registerProperty({
                name: '--btn-border-angle',
                syntax: '<angle>',
                initialValue: '-75deg',
                inherits: false
            });
        } catch (e) { /* already registered via CSS @property — fine */ }
    }

    // ════════════════════════════════════════════════════════════
    // EFFECT 1: HERO WORD BLUR SPLIT
    //
    // Walks the child nodes of .mega-type:
    //  - Text nodes → split by word, wrap each in <span class="mw">
    //  - .accent-text span → treated as ONE word unit (gets .mw added)
    //  - <br> elements → left untouched
    //
    // Each .mw gets style="--i: N" for CSS animation-delay stagger.
    // CSS: animation-delay: calc(0.3s + var(--i, 0) * 0.075s)
    // ════════════════════════════════════════════════════════════
    function splitHeroWords() {
        var h1 = document.querySelector('.mega-type');
        if (!h1) return;

        var wordIndex = 0;

        /**
         * Splits a single text node into word-wrapped spans.
         * Preserves whitespace nodes as text (not wrapped) to
         * maintain natural letter-spacing between words.
         */
        function wrapTextNode(textNode) {
            var text = textNode.textContent;
            if (!text.trim()) return; // skip whitespace-only nodes

            // Split on whitespace, preserving spaces as separate tokens
            var parts = text.split(/(\s+)/);
            var fragment = document.createDocumentFragment();

            for (var i = 0; i < parts.length; i++) {
                var part = parts[i];
                if (!part) continue;

                if (/^\s+$/.test(part)) {
                    // Pure whitespace — keep as text node (preserves word gaps)
                    fragment.appendChild(document.createTextNode(part));
                } else {
                    // Word — wrap in animated span
                    var span = document.createElement('span');
                    span.className = 'mw';
                    span.style.setProperty('--i', wordIndex);
                    span.textContent = part;
                    fragment.appendChild(span);
                    wordIndex++;
                }
            }

            // Replace the original text node with the fragment
            textNode.parentNode.replaceChild(fragment, textNode);
        }

        // Snapshot child nodes BEFORE mutation (live NodeList would shift)
        var children = Array.prototype.slice.call(h1.childNodes);

        for (var c = 0; c < children.length; c++) {
            var node = children[c];

            if (node.nodeType === Node.TEXT_NODE) {
                // Raw text — split into words
                wrapTextNode(node);

            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.tagName === 'BR') {
                    // Line break — untouched
                    continue;
                } else if (node.classList.contains('accent-text')) {
                    // Accent span: animate as ONE unit, not word-by-word inside
                    // (keeps the accent color context intact)
                    node.classList.add('mw');
                    node.style.setProperty('--i', wordIndex);
                    wordIndex++;
                }
            }
        }

        // ── Cleanup will-change after all words have animated ──
        // Max animation duration: 0.3s base + (wordIndex * 0.075s) + 0.65s duration
        var totalMs = (300 + wordIndex * 75 + 650) + 100; // +100ms buffer
        setTimeout(function () {
            var words = h1.querySelectorAll('.mw');
            for (var i = 0; i < words.length; i++) {
                words[i].classList.add('mw-done');
            }
        }, totalMs);
    }

    // ════════════════════════════════════════════════════════════
    // EFFECT 2: DARKVEIL HERO BACKGROUND (WebGL CPPN Shader)
    //
    // Vanilla JS port of the ReactBits DarkVeil component by davidhdev.
    // Uses a full-screen triangle (OGL pattern) instead of a quad.
    // Pauses via IntersectionObserver when hero is off-screen and via
    // Page Visibility API when the tab is hidden — zero GPU waste.
    //
    // Performance budget:
    //  - Resolution scale: 0.65 × DPR (capped at 1.5)  ≈ half-res render
    //  - mediump float precision: sufficient for visual CPPN output
    //  - powerPreference: 'low-power' — hints integrated GPU on laptops
    //  - requestIdleCallback: deferred until browser is idle (after paint)
    //  - IntersectionObserver + visibilitychange: RAF paused off-screen
    //  - Desktop only (>1024px): mobile uses existing CSS vfx
    // ════════════════════════════════════════════════════════════
    function initDarkVeil() {
        var canvas = document.getElementById('hero-veil');
        var heroEl = document.getElementById('hero');
        if (!canvas || !heroEl) return;

        var gl = canvas.getContext('webgl', {
            antialias:            false,
            alpha:                true,   // transparent canvas — dark bg shows through
            premultipliedAlpha:   false,
            powerPreference:      'low-power',
            preserveDrawingBuffer:false
        });
        if (!gl) return; // WebGL not supported — CSS vfx shows instead

        // ── Vertex shader: full-screen triangle (OGL Triangle pattern) ──
        var VS = 'attribute vec2 position;void main(){gl_Position=vec4(position,0.0,1.0);}';

        // ── Fragment shader: CPPN (Compositional Pattern Producing Network)
        //    Source: DarkVeil by davidhdev / reactbits.dev
        //    hueShift=0, noiseIntensity=0, scanlines=0 (cleanest look)
        //    warpAmount passed via uWarp uniform (subtle=0.15)
        var FS = [
            '#ifdef GL_ES',
            'precision mediump float;', // mediump: sufficient + compatible
            '#endif',
            'uniform vec2 uResolution;',
            'uniform float uTime;',
            'uniform float uWarp;',
            'vec4 buf[8];',
            'vec4 sigmoid(vec4 x){return 1./(1.+exp(-x));}',
            'vec4 cppn_fn(vec2 coordinate,float in0,float in1,float in2){',
            '    buf[6]=vec4(coordinate.x,coordinate.y,0.3948333106474662+in0,0.36+in1);',
            '    buf[7]=vec4(0.14+in2,sqrt(coordinate.x*coordinate.x+coordinate.y*coordinate.y),0.,0.);',
            '    buf[0]=mat4(vec4(6.5404263,-3.6126034,0.7590882,-1.13613),vec4(2.4582713,3.1660357,1.2219609,0.06276096),vec4(-5.478085,-6.159632,1.8701609,-4.7742867),vec4(6.039214,-5.542865,-0.90925294,3.251348))*buf[6]+mat4(vec4(0.8473259,-5.722911,3.975766,1.6522468),vec4(-0.24321538,0.5839259,-1.7661959,-5.350116),vec4(0.,0.,0.,0.),vec4(0.,0.,0.,0.))*buf[7]+vec4(0.21808943,1.1243913,-1.7969975,5.0294676);',
            '    buf[1]=mat4(vec4(-3.3522482,-6.0612736,0.55641043,-4.4719114),vec4(0.8631464,1.7432913,5.643898,1.6106541),vec4(2.4941394,-3.5012043,1.7184316,6.357333),vec4(3.310376,8.209261,1.1355612,-1.165539))*buf[6]+mat4(vec4(5.24046,-13.034365,0.009859298,15.870829),vec4(2.987511,3.129433,-0.89023495,-1.6822904),vec4(0.,0.,0.,0.),vec4(0.,0.,0.,0.))*buf[7]+vec4(-5.9457836,-6.573602,-0.8812491,1.5436668);',
            '    buf[0]=sigmoid(buf[0]);buf[1]=sigmoid(buf[1]);',
            '    buf[2]=mat4(vec4(-15.219568,8.095543,-2.429353,-1.9381982),vec4(-5.951362,4.3115187,2.6393783,1.274315),vec4(-7.3145227,6.7297835,5.2473326,5.9411426),vec4(5.0796127,8.979051,-1.7278991,-1.158976))*buf[6]+mat4(vec4(-11.967154,-11.608155,6.1486754,11.237008),vec4(2.124141,-6.263192,-1.7050359,-0.7021966),vec4(0.,0.,0.,0.),vec4(0.,0.,0.,0.))*buf[7]+vec4(-4.17164,-3.2281182,-4.576417,-3.6401186);',
            '    buf[3]=mat4(vec4(3.1832156,-13.738922,1.879223,3.233465),vec4(0.64300746,12.768129,1.9141049,0.50990224),vec4(-0.049295485,4.4807224,1.4733979,1.801449),vec4(5.0039253,13.000481,3.3991797,-4.5561905))*buf[6]+mat4(vec4(-0.1285731,7.720628,-3.1425676,4.742367),vec4(0.6393625,3.714393,-0.8108378,-0.39174938),vec4(0.,0.,0.,0.),vec4(0.,0.,0.,0.))*buf[7]+vec4(-1.1811101,-21.621881,0.7851888,1.2329718);',
            '    buf[2]=sigmoid(buf[2]);buf[3]=sigmoid(buf[3]);',
            '    buf[4]=mat4(vec4(5.214916,-7.183024,2.7228765,2.6592617),vec4(-5.601878,-25.3591,4.067988,0.4602802),vec4(-10.57759,24.286327,21.102104,37.546658),vec4(4.3024497,-1.9625226,2.3458803,-1.372816))*buf[0]+mat4(vec4(-17.6526,-10.507558,2.2587414,12.462782),vec4(6.265566,-502.75443,-12.642513,0.9112289),vec4(-10.983244,20.741234,-9.701768,-0.7635988),vec4(5.383626,1.4819539,-4.1911616,-4.8444734))*buf[1]+mat4(vec4(12.785233,-16.345072,-0.39901125,1.7955981),vec4(-30.48365,-1.8345358,1.4542528,-1.1118771),vec4(19.872723,-7.337935,-42.941723,-98.52709),vec4(8.337645,-2.7312303,-2.2927687,-36.142323))*buf[2]+mat4(vec4(-16.298317,3.5471997,-0.44300047,-9.444417),vec4(57.5077,-35.609753,16.163465,-4.1534753),vec4(-0.07470326,-3.8656476,-7.0901804,3.1523974),vec4(-12.559385,-7.077619,1.490437,-0.8211543))*buf[3]+vec4(-7.67914,15.927437,1.3207729,-1.6686112);',
            '    buf[5]=mat4(vec4(-1.4109162,-0.372762,-3.770383,-21.367174),vec4(-6.2103205,-9.35908,0.92529047,8.82561),vec4(11.460242,-22.348068,13.625772,-18.693201),vec4(-0.3429052,-3.9905605,-2.4626114,-0.45033523))*buf[0]+mat4(vec4(7.3481627,-4.3661838,-6.3037653,-3.868115),vec4(1.5462853,6.5488915,1.9701879,-0.58291394),vec4(6.5858274,-2.2180402,3.7127688,-1.3730392),vec4(-5.7973905,10.134961,-2.3395722,-5.965605))*buf[1]+mat4(vec4(-2.5132585,-6.6685553,-1.4029363,-0.16285264),vec4(-0.37908727,0.53738135,4.389061,-1.3024765),vec4(-0.70647055,2.0111287,-5.1659346,-3.728635),vec4(-13.562562,10.487719,-0.9173751,-2.6487076))*buf[2]+mat4(vec4(-8.645013,6.5546675,-6.3944063,-5.5933375),vec4(-0.57783127,-1.077275,36.91025,5.736769),vec4(14.283112,3.7146652,7.1452246,-4.5958776),vec4(2.7192075,3.6021907,-4.366337,-2.3653464))*buf[3]+vec4(-5.9000807,-4.329569,1.2427121,8.59503);',
            '    buf[4]=sigmoid(buf[4]);buf[5]=sigmoid(buf[5]);',
            '    buf[6]=mat4(vec4(-1.61102,0.7970257,1.4675229,0.20917463),vec4(-28.793737,-7.1390953,1.5025433,4.656581),vec4(-10.94861,39.66238,0.74318546,-10.095605),vec4(-0.7229728,-1.5483948,0.7301322,2.1687684))*buf[0]+mat4(vec4(3.2547753,21.489103,-1.0194173,-3.3100595),vec4(-3.7316632,-3.3792162,-7.223193,-0.23685838),vec4(13.1804495,0.7916005,5.338587,5.687114),vec4(-4.167605,-17.798311,-6.815736,-1.6451967))*buf[1]+mat4(vec4(0.604885,-7.800309,-7.213122,-2.741014),vec4(-3.522382,-0.12359311,-0.5258442,0.43852118),vec4(9.6752825,-22.853785,2.062431,0.099892326),vec4(-4.3196306,-17.730087,2.5184598,5.30267))*buf[2]+mat4(vec4(-6.545563,-15.790176,-6.0438633,-5.415399),vec4(-43.591583,28.551912,-16.00161,18.84728),vec4(4.212382,8.394307,3.0958717,8.657522),vec4(-5.0237565,-4.450633,-4.4768,-5.5010443))*buf[3]+mat4(vec4(1.6985557,-67.05806,6.897715,1.9004834),vec4(1.8680354,2.3915145,2.5231109,4.081538),vec4(11.158006,1.7294737,2.0738268,7.386411),vec4(-4.256034,-306.24686,8.258898,-17.132736))*buf[4]+mat4(vec4(1.6889864,-4.5852966,3.8534803,-6.3482175),vec4(1.3543309,-1.2640043,9.932754,2.9079645),vec4(-5.2770967,0.07150358,-0.13962056,3.3269649),vec4(28.34703,-4.918278,6.1044083,4.085355))*buf[5]+vec4(6.6818056,12.522166,-3.7075126,-4.104386);',
            '    buf[7]=mat4(vec4(-8.265602,-4.7027016,5.098234,0.7509808),vec4(8.6507845,-17.15949,16.51939,-8.884479),vec4(-4.036479,-2.3946867,-2.6055532,-1.9866527),vec4(-2.2167742,-1.8135649,-5.9759874,4.8846445))*buf[0]+mat4(vec4(6.7790847,3.5076547,-2.8191125,-2.7028968),vec4(-5.743024,-0.27844876,1.4958696,-5.0517144),vec4(13.122226,15.735168,-2.9397483,-4.101023),vec4(-14.375265,-5.030483,-6.2599335,2.9848232))*buf[1]+mat4(vec4(4.0950394,-0.94011575,-5.674733,4.755022),vec4(4.3809423,4.8310084,1.7425908,-3.437416),vec4(2.117492,0.16342592,-104.56341,16.949184),vec4(-5.22543,-2.994248,3.8350096,-1.9364246))*buf[2]+mat4(vec4(-5.900337,1.7946124,-13.604192,-3.8060522),vec4(6.6583457,31.911177,25.164474,91.81147),vec4(11.840538,4.1503043,-0.7314397,6.768467),vec4(-6.3967767,4.034772,6.1714606,-0.32874924))*buf[3]+mat4(vec4(3.4992442,-196.91893,-8.923708,2.8142626),vec4(3.4806502,-3.1846354,5.1725626,5.1804223),vec4(-2.4009497,15.585794,1.2863957,2.0252278),vec4(-71.25271,-62.441242,-8.138444,0.50670296))*buf[4]+mat4(vec4(-12.291733,-11.176166,-7.3474145,4.390294),vec4(10.805477,5.6337385,-0.9385842,-4.7348723),vec4(-12.869276,-7.039391,5.3029537,7.5436664),vec4(1.4593618,8.91898,3.5101583,5.840625))*buf[5]+vec4(2.2415268,-6.705987,-0.98861027,-2.117676);',
            '    buf[6]=sigmoid(buf[6]);buf[7]=sigmoid(buf[7]);',
            '    buf[0]=mat4(vec4(1.6794263,1.3817469,2.9625452,0.),vec4(-1.8834411,-1.4806935,-3.5924516,0.),vec4(-1.3279216,-1.0918057,-2.3124623,0.),vec4(0.2662234,0.23235129,0.44178495,0.))*buf[0]+mat4(vec4(-0.6299101,-0.5945583,-0.9125601,0.),vec4(0.17828953,0.18300213,0.18182953,0.),vec4(-2.96544,-2.5819945,-4.9001055,0.),vec4(1.4195864,1.1868085,2.5176322,0.))*buf[1]+mat4(vec4(-1.2584374,-1.0552157,-2.1688404,0.),vec4(-0.7200217,-0.52666044,-1.438251,0.),vec4(0.15345335,0.15196142,0.272854,0.),vec4(0.945728,0.8861938,1.2766753,0.))*buf[2]+mat4(vec4(-2.4218085,-1.968602,-4.35166,0.),vec4(-22.683098,-18.0544,-41.954372,0.),vec4(0.63792,0.5470648,1.1078634,0.),vec4(-1.5489894,-1.3075932,-2.6444845,0.))*buf[3]+mat4(vec4(-0.49252132,-0.39877754,-0.91366625,0.),vec4(0.95609266,0.7923952,1.640221,0.),vec4(0.30616966,0.15693925,0.8639857,0.),vec4(1.1825981,0.94504964,2.176963,0.))*buf[4]+mat4(vec4(0.35446745,0.3293795,0.59547555,0.),vec4(-0.58784515,-0.48177817,-1.0614829,0.),vec4(2.5271258,1.9991658,4.6846647,0.),vec4(0.13042648,0.08864098,0.30187556,0.))*buf[5]+mat4(vec4(-1.7718065,-1.4033192,-3.3355875,0.),vec4(3.1664357,2.638297,5.378702,0.),vec4(-3.1724713,-2.6107926,-5.549295,0.),vec4(-2.851368,-2.249092,-5.3013067,0.))*buf[6]+mat4(vec4(1.5203838,1.2212278,2.8404984,0.),vec4(1.5210563,1.2651345,2.683903,0.),vec4(2.9789467,2.4364579,5.2347264,0.),vec4(2.2270417,1.8825914,3.8028636,0.))*buf[7]+vec4(-1.5468478,-3.6171484,0.24762098,0.);',
            '    buf[0]=sigmoid(buf[0]);',
            '    return vec4(buf[0].x,buf[0].y,buf[0].z,1.);',
            '}',
            'void mainImage(out vec4 fragColor,in vec2 fragCoord){',
            '    vec2 uv=fragCoord/uResolution.xy*2.-1.;',
            '    uv.y*=-1.;',
            '    uv+=uWarp*vec2(sin(uv.y*6.283+uTime*0.5),cos(uv.x*6.283+uTime*0.5))*0.05;',
            '    fragColor=cppn_fn(uv,0.1*sin(0.3*uTime),0.1*sin(0.69*uTime),0.1*sin(0.44*uTime));',
            '}',
            'void main(){',
            '    vec4 col;',
            '    mainImage(col,gl_FragCoord.xy);',
            '    gl_FragColor=vec4(col.rgb,col.a);',
            '}'
        ].join('\n');

        // ── Compile shader helper ────────────────────────────────
        function makeShader(type, src) {
            var s = gl.createShader(type);
            gl.shaderSource(s, src);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                gl.deleteShader(s);
                return null;
            }
            return s;
        }

        var vs = makeShader(gl.VERTEX_SHADER, VS);
        var fs = makeShader(gl.FRAGMENT_SHADER, FS);
        if (!vs || !fs) return; // shader compile failed — silent degradation

        var prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
        gl.useProgram(prog);

        // ── Full-screen triangle geometry (OGL Triangle pattern) ──
        // Three vertices cover the full NDC [-1,1] space with one triangle
        var geoBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, geoBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
        var posLoc = gl.getAttribLocation(prog, 'position');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        // ── Uniforms ─────────────────────────────────────────────
        var uTime       = gl.getUniformLocation(prog, 'uTime');
        var uResolution = gl.getUniformLocation(prog, 'uResolution');
        var uWarp       = gl.getUniformLocation(prog, 'uWarp');
        gl.uniform1f(uWarp, 0.15); // subtle warp — organic without nausea
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // ── Resize handler ───────────────────────────────────────
        // Scale: 0.30 mobile, 0.50 desktop — background shader, no need for high res
        var SCALE = window.matchMedia('(max-width:1024px)').matches ? 0.30 : 0.50;
        function resize() {
            var w   = heroEl.offsetWidth  || window.innerWidth;
            var h   = heroEl.offsetHeight || window.innerHeight;
            var dpr = Math.min(window.devicePixelRatio || 1, 1.5) * SCALE;
            canvas.width  = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.uniform2f(uResolution, canvas.width, canvas.height);
        }
        window.addEventListener('resize', resize, { passive: true });
        resize();

        // ── Animation state ──────────────────────────────────────
        var startTime   = performance.now();
        var rafId       = 0;
        var running     = false;
        var heroVisible = true;
        var lastFrame   = 0;
        var FRAME_MS    = 1000 / 30; // throttle to 30fps — imperceptible on a slow background

        function loop(now) {
            if (!running) return;
            rafId = requestAnimationFrame(loop);
            if (now - lastFrame < FRAME_MS) return; // skip frame
            lastFrame = now;
            gl.uniform1f(uTime, ((now - startTime) * 0.001) * 1.4); // speed 2.0→1.4: smoother, less GPU churn
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }

        function start() {
            if (running || document.hidden) return;
            running = true;
            lastFrame = 0;
            rafId = requestAnimationFrame(loop);
        }
        function stop() {
            running = false;
            cancelAnimationFrame(rafId);
        }

        // ── Page Visibility API: pause when tab is hidden ────────
        document.addEventListener('visibilitychange', function () {
            document.hidden ? stop() : (heroVisible && start());
        });

        // ── IntersectionObserver: pause when hero is off-screen ──
        // Saves GPU when user has scrolled to portfolio/about sections
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                heroVisible = entry.isIntersecting;
                heroVisible ? start() : stop();
            });
        }, { threshold: 0.01 });
        io.observe(heroEl);

        // ── Kick off immediately (hero is visible on first load) ─
        start();

        // Fade canvas in after first GPU frame renders
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                canvas.classList.add('veil-ready');
            });
        });
    }

    // Run immediately — synchronous DOM parse time
    // At this point <body> hasn't been parsed yet if script is in <head>,
    // so we need DOMContentLoaded for safety.
    function init() {
        splitHeroWords();
        // DarkVeil WebGL: deferred to requestIdleCallback so hero text
        // animation (pure CSS) gets priority on first paint.
        // Fallback: setTimeout 800ms for browsers without rIC.
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(initDarkVeil, { timeout: 2500 });
        } else {
            setTimeout(initDarkVeil, 800);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        // Script loaded late (defer/async) — DOM already ready
        init();
    }

})();

// ── Neon Motion Lines — CTA section background ──────────────────
(function () {
    'use strict';
    const initNeonTubes = () => {
        const section = document.getElementById('contact');
        const isMobile = window.innerWidth < 768;
        if (!section || isMobile) return;

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
                        const mDist   = Math.abs(x - mouseX) / W;
                        const attract = Math.max(0, 1 - mDist * 2.5);
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
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                running = false; if (raf) cancelAnimationFrame(raf);
            } else {
                const rect = section.getBoundingClientRect();
                if (rect.top < window.innerHeight && rect.bottom > 0) { running = true; loop(); }
            }
        });

        resize();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNeonTubes, { once: true });
    } else {
        initNeonTubes();
    }
})();
