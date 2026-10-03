/* Project: reading-progress ink — scenario D of DESIGN.md.
 *
 * A small clone of the navigation mark rides the tip of the reading progress
 * bar: the bar is the line of ink it drags behind it, and the mark hangs from
 * it like a basket on a rope. The line accelerating is what throws it aside;
 * when the line stops it goes on swinging from side to side, each swing
 * smaller, until it hangs straight down and the frame chain stops — nothing
 * runs while the page is still.
 *
 * Why it owns the bar while it is attached: the bar has a CSS transition, so
 * the line glides towards a new value while this script would jump the mark to
 * it, and the mark would run ahead of the line. One clock writes both.
 * toc-sidebar.js keeps the number and lends the pen (window.TocRail).
 *
 * Without JavaScript, or without the right conditions, nothing is added: the
 * bar stays exactly as it was and the signoff figure stays put.
 */
(function () {
    "use strict";

    var Ink = window.FluidInk;
    var rail = window.TocRail;
    /* No primitives, no rail, no progress bar: nothing to attach to. */
    if (!Ink || !rail || !rail.bar) return;

    var wide = window.matchMedia("(min-width: 900px)");
    var fine = window.matchMedia("(hover: hover) and (pointer: fine)");

    /* Feel. The mark hangs from the line like a basket on a rope, so it is a
       pendulum on a moving pivot rather than something that merely tips: while
       the line accelerates it lags behind, when the line stops it keeps going
       and swings from side to side, and each swing is smaller than the last
       until it hangs straight down again.

       SWING_T is the time of one whole swing. SWING_ZETA is how much of the
       swing survives it: below 1 means it really swings rather than creeping
       back, and 0.2 keeps about a quarter of the size each time. L_SWING is an
       effective rope length in CSS px — a longer rope is thrown less far by the
       same acceleration, so it is the knob for "how far does a flick send it".

       It is deliberately far shorter than the mark is tall. The pivot crawls:
       a whole screen of reading advances the bar by only a few per cent, so the
       tip covers tens of pixels where the reader's hand covered hundreds. A
       rope measured honestly would leave the basket barely quivering. These
       three numbers are the whole feel of the ride. */
    var SWING_T = 1.1;          /* seconds */
    var SWING_ZETA = 0.2;       /* damping ratio */
    var L_SWING = 80;           /* px of rope */
    var SWING_MAX = 0.45;       /* rad, about 26 degrees either way */
    var W0 = 2 * Math.PI / SWING_T;
    var V_SMOOTH = 0.35;        /* per 16.7ms, on the tip's velocity */
    var A_SMOOTH = 0.5;         /* per 16.7ms, on the tip's acceleration */
    var POS_RATE = 0.22;        /* per 16.7ms, towards the progress target */
    var GROW_MS = 420;
    var SIZE = 28;
    /* Below this the swing is over: a quarter of a degree, seen from the
       corner of an eye, is nothing — so the frame chain is allowed to stop. */
    var REST_ANGLE = 0.005, REST_SPIN = 0.03;

    var source = document.querySelector(".logo .fluid-mark");
    if (!source) return;

    var blob = null;
    var body = null;
    var eyes = null;
    var signoff = document.querySelector(".fluid-signoff");
    var observer = null;
    var raf = 0;
    var lastFrame = 0;
    var width = 0;
    var gateY = 120;

    var pos = 0;            /* drawn progress */
    var target = 0;         /* progress the page is really at */
    var theta = 0;          /* swing angle, radians from straight down */
    var omega = 0;          /* how fast it is swinging */
    var lastTip = 0;        /* previous x of the pivot, for its velocity */
    var tipV = 0;           /* smoothed velocity of the pivot, px/s */
    var lastV = 0;          /* previous smoothed velocity, for its acceleration */
    var tipA = 0;           /* smoothed acceleration of the pivot, px/s² */
    var grow = 0;           /* 0 tucked inside the line, 1 riding it */
    var past = false;       /* scrolled past the navigation */
    var atEnd = false;      /* the signoff is on screen */
    var risen = false;      /* the signoff figure has come up once */
    var attached = false;

    function eligible() {
        return wide.matches && fine.matches;
    }

    function measure() {
        width = document.documentElement.clientWidth;
        var nav = document.querySelector("header.nav") || document.querySelector("header");
        /* The mark belongs to the article, not to the chrome above it: it shows
           up once the header is behind the reader. */
        gateY = nav ? nav.getBoundingClientRect().height + 24 : 120;
    }

    function growTarget() {
        return past && !atEnd ? 1 : 0;
    }

    function ensure() {
        if (!attached || raf) return;
        lastFrame = 0;
        raf = window.requestAnimationFrame(frame);
    }

    function frame(now) {
        raf = 0;
        if (!attached) return;
        /* Normalised to a 60Hz frame: 120Hz gets the same feel, and a tab that
           was hidden for a second does not jump. */
        var k = lastFrame ? Math.min(4, (now - lastFrame) / 16.7) : 1;
        var dt = k * 16.7 / 1000;
        lastFrame = now;

        pos += (target - pos) * (1 - Math.pow(1 - POS_RATE, k));

        /* The pivot is the tip of the line, and it is the pivot's acceleration
           that throws the basket — not its speed: a line gliding at a steady
           pace leaves it hanging straight down, exactly as a real one does.
           Both readings are smoothed because scroll arrives in steps and the
           difference between two single frames is mostly noise. */
        var tip = pos * width;
        var rawV = dt > 0 ? (tip - lastTip) / dt : 0;
        lastTip = tip;
        tipV += (rawV - tipV) * (1 - Math.pow(1 - V_SMOOTH, k));
        var rawA = dt > 0 ? (tipV - lastV) / dt : 0;
        lastV = tipV;
        tipA += (rawA - tipA) * (1 - Math.pow(1 - A_SMOOTH, k));

        swing(dt);

        var wanted = growTarget();
        var step = k * 16.7 / GROW_MS;
        if (grow < wanted) grow = Math.min(wanted, grow + step);
        else if (grow > wanted) grow = Math.max(wanted, grow - step);

        /* Ours to write while we hold it: the line is the ink the mark drags,
           so it is painted from the same frame, before the mark is placed. */
        rail.bar.style.transform = "scaleX(" + pos.toFixed(4) + ")";
        draw();

        /* It stops swinging before it stops being watched: once the swing is
           under the threshold it is put exactly upright, so what is left on
           screen is a basket hanging still, not one a hair off vertical. */
        var resting = Math.abs(theta) < REST_ANGLE && Math.abs(omega) < REST_SPIN;
        if (resting) { theta = 0; omega = 0; draw(); }

        var busy = Math.abs(target - pos) > 0.0004
            || Math.abs(tipV) > 2
            || Math.abs(tipA) > L_SWING * REST_ANGLE * W0 * W0 / 2
            || !resting
            || grow !== wanted;
        if (busy) raf = window.requestAnimationFrame(frame);
        else if (grow === 0) {
            /* Tucked away: stop paying for it until the reader scrolls again. */
            blob.style.display = "none";
        }
    }

    /* A damped pendulum on a moving pivot: the pivot's acceleration throws it
       aside, gravity hauls it back through the bottom, and drag takes a bite
       out of every swing. Sub-stepped, so a long frame cannot let it fly apart
       — the integration is only stable while a step stays well under a swing. */
    function swing(dt) {
        var steps = Math.max(1, Math.ceil(dt / 0.008));
        var h = dt / steps;
        for (var i = 0; i < steps; i++) {
            var a = -W0 * W0 * Math.sin(theta)
                - 2 * SWING_ZETA * W0 * omega
                + (tipA / L_SWING) * Math.cos(theta);
            omega += a * h;
            theta += omega * h;
            /* Hitting the limit is a stop, not a bounce: without clearing the
               speed it would grind against the ceiling. */
            if (theta > SWING_MAX) { theta = SWING_MAX; if (omega > 0) omega = 0; }
            else if (theta < -SWING_MAX) { theta = -SWING_MAX; if (omega < 0) omega = 0; }
        }
    }

    function draw() {
        var g = Ink.ease(grow);
        if (g <= 0.001) {
            blob.style.display = "none";
            return;
        }
        if (blob.style.display === "none") blob.style.display = "";

        var tip = pos * width;
        var x = Math.max(0, Math.min(width - SIZE, tip - SIZE / 2));
        /* Rotated about the point where it meets the line (see the CSS), so the
           whole body swings beneath it rather than spinning about its middle. */
        blob.style.transform = "translate(" + x.toFixed(1) + "px,"
            + ((1 - g) * -3).toFixed(1) + "px) rotate(" + (theta * 57.29578).toFixed(2)
            + "deg) scale(" + (0.3 + 0.7 * g).toFixed(3) + ")";

        /* Fastest at the bottom of the swing, where it is stretched along the
           rope and narrowed across it; the eyes look the way it is leaning. */
        var n = Ink.clamp01(Math.abs(omega) / (SWING_MAX * W0));
        if (body) {
            body.style.transform = "scale(" + (1 - 0.05 * n).toFixed(3) + ","
                + (1 + 0.10 * n).toFixed(3) + ")";
        }
        if (eyes) {
            eyes.style.transform = "translate(" + (-theta / SWING_MAX * 2.2).toFixed(2)
                + "px," + (-n * 0.8).toFixed(2) + "px)";
        }
    }

    function onProgress(p) {
        target = p;
        past = window.pageYOffset > gateY;
        ensure();
    }

    function attach() {
        if (attached) return;
        blob = source.cloneNode(true);
        blob.classList.add("fluid-read-blob");
        blob.setAttribute("aria-hidden", "true");
        blob.setAttribute("focusable", "false");
        blob.style.display = "none";
        document.body.appendChild(blob);
        body = blob.querySelector(".fluid-mark-body");
        eyes = blob.querySelector(".fluid-mark-eyes");

        measure();
        rail.drive(true);
        rail.onProgress(onProgress);
        attached = true;

        if (window.IntersectionObserver) {
            observer = new window.IntersectionObserver(function (entries) {
                for (var i = 0; i < entries.length; i++) {
                    atEnd = entries[i].isIntersecting;
                    if (atEnd && !risen && signoff) {
                        risen = true;
                        signoff.classList.add("fluid-signoff-risen");
                    }
                }
                ensure();
            }, { threshold: 0.35 });
            if (signoff) observer.observe(signoff);
        }

        window.addEventListener("resize", onResize, { passive: true });
        window.addEventListener("pagehide", stop);
        ensure();
    }

    function detach() {
        if (!attached) return;
        stop();
        attached = false;
        window.removeEventListener("resize", onResize);
        window.removeEventListener("pagehide", stop);
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        rail.drive(false);
        if (blob) blob.remove();
        blob = body = eyes = null;
    }

    function stop() {
        if (raf) {
            window.cancelAnimationFrame(raf);
            raf = 0;
        }
    }

    function onResize() {
        measure();
        ensure();
    }

    function watch(query, onChange) {
        if (query.addEventListener) query.addEventListener("change", onChange);
        else if (query.addListener) query.addListener(onChange);
    }

    watch(wide, reevaluate);
    watch(fine, reevaluate);

    function reevaluate() {
        if (eligible()) attach();
        else detach();
    }

    reevaluate();
})();
