/* Project: home-page fluid avatar (蕫冬咚) — see docs/design/fluid-ip.md.
 * Visual baseline: docs/design/fluid-ip-demo.html (the confirmed sample).
 *
 * Behaviour only. The body outline, the eyes and the goo filter live in
 * layouts/partials/home_info.html, the two-tone fills in
 * assets/css/extended/fluid-ip.css — so the figure is still drawn when this
 * script never runs, and colours follow the theme through CSS variables even
 * while an animation is in flight.
 *
 * Echo specs are data: every loop below iterates SPECS, so adding or removing
 * an echo is a one-line change here and nothing assumes three of them.
 *
 * Interaction is gated on exactly what fluid-ip.css gates on: at least 900px
 * wide, a fine pointer that can hover, and no reduced-motion request. Failing
 * any of the three leaves the button disabled — not focusable, not clickable —
 * so the static figure never presents a control that does nothing.
 *
 * Frames run only while an animation is in flight: one rAF chain per click, no
 * idle rAF, and no second chain while one is playing. Every way out of the
 * animation — normal end, hidden tab, gate turning off, a click that is refused
 * — clears the echo paths, so nothing is left in the body's dent.
 */
(function () {
    "use strict";

    var orb = document.getElementById("fluid-ip-orb");
    if (!orb) return;

    var echoLayer = orb.querySelector(".fluid-ip-echoes");
    var formLayer = orb.querySelector(".fluid-ip-forms");
    if (!echoLayer || !formLayer) return;

    var SVG_NS = "http://www.w3.org/2000/svg";

    /* One echo: grows out of the body edge, drifts, holds, merges back. */
    var DURATION = 9000;
    /* Delay between consecutive echoes, so they leave one after another. */
    var STAGGER = 320;

    /* from: point on the body outline the echo is born from.
       to:   far point of its drift. radius: its body radius. */
    var SPECS = [
        { from: [365, 85], to: [610, -80], radius: 54,
            forms: [
                { type: "path", value: "M0 -48 Q11 -11 48 0 Q11 11 0 48 Q-11 11 -48 0 Q-11 -11 0 -48 Z" },
                { type: "text", value: "读" },
                { type: "path", value: "M-45 -35 Q-22 -42 0 -25 Q22 -42 45 -35 L45 35 Q22 28 0 45 Q-22 28 -45 35 Z M-34 -23 L-34 22 Q-17 21 -6 29 L-6 -15 Q-20 -25 -34 -23 Z M6 -15 L6 29 Q17 21 34 22 L34 -23 Q20 -25 6 -15 Z", rule: "evenodd" }
            ] },
        { from: [470, 190], to: [640, 145], radius: 46,
            forms: [
                { type: "text", value: "文" },
                { type: "text", value: "写" },
                { type: "path", value: "M-40 40 L-32 10 L20 -42 Q26 -48 32 -42 L42 -32 Q48 -26 42 -20 L-10 32 Z M-31 29 L-17 25 L-27 15 Z", rule: "evenodd" }
            ] },
        { from: [475, 345], to: [630, 440], radius: 40,
            forms: [
                { type: "text", value: "</>" },
                { type: "text", value: "想" },
                { type: "path", value: "M15 -46 C-39 -53 -63 10 -25 38 C6 62 43 34 44 10 C10 37 -24 0 15 -46 Z" }
            ] }
    ];

    var LABEL_STATIC = orb.getAttribute("aria-label") || "";
    var LABEL_ACTION = orb.getAttribute("data-label-action") || LABEL_STATIC;

    var echoes = SPECS.map(function () {
        var path = document.createElementNS(SVG_NS, "path");
        echoLayer.appendChild(path);
        return path;
    });
    var forms = [];
    var scene = 0;
    var softeners = SPECS.map(function (_, i) {
        var filter = document.createElementNS(SVG_NS, "filter");
        filter.setAttribute("id", "fluid-form-soft-" + i);
        filter.setAttribute("x", "-60%");
        filter.setAttribute("y", "-60%");
        filter.setAttribute("width", "220%");
        filter.setAttribute("height", "220%");
        var blur = document.createElementNS(SVG_NS, "feGaussianBlur");
        blur.setAttribute("stdDeviation", "0");
        filter.appendChild(blur);
        orb.querySelector("defs").appendChild(filter);
        return blur;
    });

    function prepareForms() {
        formLayer.replaceChildren();
        forms = SPECS.map(function (spec, i) {
            var form = spec.forms[scene % spec.forms.length];
            var node = document.createElementNS(SVG_NS, form.type);
            node.setAttribute("class", "fluid-ip-form" + (form.type === "text" ? " fluid-ip-form-text" : ""));
            if (form.type === "text") node.textContent = form.value;
            else node.setAttribute("d", form.value);
            node.setAttribute("fill-rule", form.rule || "nonzero");
            node.setAttribute("filter", "url(#fluid-form-soft-" + i + ")");
            node.setAttribute("opacity", "0");
            formLayer.appendChild(node);
            return node;
        });
        scene++;
    }

    var total = DURATION + (SPECS.length - 1) * STAGGER;
    var raf = 0;
    var started = null;
    var playing = false;
    var lastElapsed = 0;
    var recalledAt = null;

    var wide = window.matchMedia("(min-width: 900px)");
    var fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    function ease(x) {
        return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(2 - 2 * x, 3) / 2;
    }

    /* An 8-point closed curve drawn through midpoints, so every point of the
       ring is an off-curve control point: the outline stays soft and never
       shows a corner. Ripple and stretch make it quiver rather than stay a
       circle, which is what separates a fluid echo from a bubble. */
    function blobPath(cx, cy, radius, phase, stretch, angle) {
        if (radius < 0.1) return "";
        var cos = Math.cos(angle);
        var sin = Math.sin(angle);
        var points = [];
        var i;
        for (i = 0; i < 8; i++) {
            var a = i * Math.PI / 4;
            var ripple = 1 + 0.13 * Math.sin(3 * a + phase) + 0.08 * Math.cos(5 * a - phase * 0.7);
            var along = Math.cos(a) * radius * ripple * stretch;
            var across = Math.sin(a) * radius * ripple / stretch;
            points.push([
                cx + along * cos - across * sin,
                cy + along * sin + across * cos
            ]);
        }
        function mid(from, to) {
            return ((from[0] + to[0]) / 2).toFixed(1) + " " + ((from[1] + to[1]) / 2).toFixed(1);
        }
        var d = "M " + mid(points[7], points[0]);
        for (i = 0; i < points.length; i++) {
            var next = points[(i + 1) % points.length];
            d += " Q " + points[i][0].toFixed(1) + " " + points[i][1].toFixed(1) + " " + mid(points[i], next);
        }
        return d + " Z";
    }

    function clearEchoes() {
        for (var i = 0; i < echoes.length; i++) {
            echoes[i].setAttribute("d", "");
        }
        forms.forEach(function (form) { form.setAttribute("opacity", "0"); });
    }

    /* Back to the resting state: no pending frame, no echo geometry. Called for
       the normal end of an animation and for every interruption. */
    function stop() {
        if (raf) window.cancelAnimationFrame(raf);
        raf = 0;
        started = null;
        playing = false;
        recalledAt = null;
        clearEchoes();
    }

    function frame(now) {
        /* The figure itself can go away (a re-render, a theme swap that
           replaces the intro block). Nothing else would stop the chain. */
        if (!orb.isConnected) {
            stop();
            return;
        }
        if (started === null) started = now;
        var elapsed = now - started;
        lastElapsed = elapsed;
        var phase = elapsed / 1150;
        var complete = true;

        for (var i = 0; i < echoes.length; i++) {
            var spec = SPECS[i];
            var t = Math.max(0, Math.min(1, (elapsed - i * STAGGER) / DURATION));
            if (recalledAt !== null) {
                t = Math.max(t, Math.min(1, 0.66 + Math.max(0, elapsed - recalledAt - i * STAGGER) / DURATION));
            }
            if (t < 1) complete = false;
            /* Travel and transformation have separate beats: let the symbol
               melt completely before pulling the ink back into the body. */
            var p = t < 0.30 ? ease(t / 0.30) : t < 0.80 ? 1 : 1 - ease((t - 0.80) / 0.20);
            /* Starts and ends at zero size, so the echo is born from the body
               edge and dissolves into it instead of popping. */
            var size = spec.radius * Math.min(1, ease(Math.min(1, t / 0.22)), ease(Math.min(1, (1 - t) / 0.15)));
            /* Once detached, each echo briefly takes a form. The same slot can
               hold an SVG path or any text without changing the animation. */
            var formMix = t < 0.30 ? 0 : t < 0.45 ? ease((t - 0.30) / 0.15)
                : t < 0.66 ? 1 : t < 0.80 ? 1 - ease((t - 0.66) / 0.14) : 0;
            var stretch = 1 + 0.2 * Math.sin(Math.PI * p) + 0.07 * Math.sin(phase * 1.2);
            var echoPhase = phase + i * 1.7;
            var cx = spec.from[0] + (spec.to[0] - spec.from[0]) * p;
            var cy = spec.from[1] + (spec.to[1] - spec.from[1]) * p - 25 * Math.sin(Math.PI * p);
            echoes[i].setAttribute("d", blobPath(
                cx, cy, size * (1 - formMix), echoPhase, stretch,
                Math.atan2(spec.to[1] - spec.from[1], spec.to[0] - spec.from[0])
            ));
            forms[i].setAttribute("opacity", formMix.toFixed(3));
            softeners[i].setAttribute("stdDeviation", (9 * (1 - formMix)).toFixed(2));
            forms[i].setAttribute("transform", "translate(" + cx.toFixed(1) + " " + cy.toFixed(1) + ") scale(" + (0.50 + 0.50 * formMix).toFixed(3) + " " + (1.12 - 0.12 * formMix).toFixed(3) + ")");
        }

        if (!complete && elapsed < total) {
            raf = window.requestAnimationFrame(frame);
        } else {
            stop();
        }
    }

    function interactive() {
        return !reduced.matches && wide.matches && fine.matches;
    }

    /* Single source of truth for "can this figure be clicked": keeps the
       disabled state, the accessible name and the running animation in step
       when the viewport, the pointer or the motion preference changes. */
    function sync() {
        var on = interactive();
        var atPortal = document.documentElement.classList.contains("fluid-portal-active");
        if (!on || atPortal) stop();
        orb.disabled = !on && !atPortal;
        orb.setAttribute("aria-label", atPortal ? "进入文章列表" : on ? LABEL_ACTION : LABEL_STATIC);
    }

    orb.addEventListener("click", function () {
        if (document.documentElement.classList.contains("fluid-portal-active")) return;
        if (!interactive()) return;
        if (playing) {
            /* Only recall once all forms have settled. Their position and
               shape are identical across this skipped part of the hold. */
            if (recalledAt === null && lastElapsed >= DURATION * 0.45 + (SPECS.length - 1) * STAGGER && lastElapsed < DURATION * 0.66) {
                recalledAt = lastElapsed;
            }
            return;
        }
        prepareForms();
        playing = true;
        lastElapsed = 0;
        started = null;
        raf = window.requestAnimationFrame(frame);
    });

    document.addEventListener("visibilitychange", function () {
        if (document.hidden) stop();
    });

    [wide, fine, reduced].forEach(function (mq) {
        if (mq.addEventListener) mq.addEventListener("change", sync);
        else if (mq.addListener) mq.addListener(sync);
    });

    window.addEventListener("fluid-portal-change", sync);

    sync();
})();
