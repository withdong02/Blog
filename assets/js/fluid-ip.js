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
       circle, which is what separates a fluid echo from a bubble.

       `symmetric` restricts the ripple to even harmonics, making the outline
       centrally symmetric: no arrangement of bumps can mark a front or a back,
       and turning the deformation axis a half turn leaves the surface exactly
       as it was. The echoes keep the odd harmonics — that quiver is part of
       the confirmed baseline — because their axis never flips mid-flight. */
    function blobPath(cx, cy, radius, phase, stretch, angle, symmetric) {
        if (radius < 0.1) return "";
        var cos = Math.cos(angle);
        var sin = Math.sin(angle);
        var points = [];
        var i;
        for (i = 0; i < 8; i++) {
            var a = i * Math.PI / 4;
            var ripple = symmetric
                ? 1 + 0.13 * Math.sin(2 * a + phase) + 0.08 * Math.cos(4 * a - phase * 0.7)
                : 1 + 0.13 * Math.sin(3 * a + phase) + 0.08 * Math.cos(5 * a - phase * 0.7);
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
        if (dragSkipClick && Date.now() - dragSkipClick < 200) return;
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

    /* === Scene C: pull the blob out with the pointer ===

       Three things decide how this feels, and all of them were wrong:

       1. The filter surface. A filter's region is part of its cached surface,
          so re-sizing it every frame — which is what following the blob with
          `expandGoo` did — re-rasterises the whole body on every frame and
          reads as stutter. The region is therefore pinned, once, to a
          rectangle that already covers wherever the blob can reach.

       2. The deformation axis. A shape stretched along θ is the same shape
          as one stretched along θ+π, so the deformation is kept as a vector
          in double-angle space: its length is the amount of stretch, its
          angle twice the axis. Smoothing that vector — instead of steering
          an axis angle — is what keeps a reversal of the hand from reading
          as the blob turning around: the vector shrinks through zero and
          grows back along the same line, so the blob rounds out and
          stretches again and never rotates a lobe a quarter turn. The
          surface ripple is centrally symmetric (even harmonics only), so no
          pattern on it marks a head or a tail either.

       3. The amount of stretch. It follows the hand's speed, not the spring's
          velocity: the spring overshoots after the pointer stops, so a stretch
          driven by it swung back and forth.

       The spring and every smoothed quantity are integrated against the
       measured frame time, so a 120Hz display does not respond twice as fast
       as a 60Hz one. */
    var svgEl = orb.querySelector("svg");
    var bumpEl = document.createElementNS(SVG_NS, "path");
    bumpEl.setAttribute("d", "");
    echoLayer.appendChild(bumpEl);

    var BCX = 256, BCY = 250, BR = 230, BUMP_R = 55;
    var bx = BCX, by = BCY, bvx = 0, bvy = 0;
    var bumpStretch = 1, bumpAngle = 0, bumpPhase = 0, pointerSpeed = 0;
    /* The deformation as a vector in double-angle space: a shape stretched
       along θ is identical to one stretched along θ+π, so its axis lives on
       a half-turn circle. The vector's length is the amount of stretch, its
       angle twice the axis — which is why reversing the hand asks for the
       same vector again, only smaller while the speed passes through zero,
       and the blob never has to turn to face the new direction. */
    var deformX = 0, deformY = 0;
    var pullVX = 0, pullVY = 0;
    var bumpRaf = 0, bumpPrev = 0;
    var dragStart = null, dragActive = false, dragSVG = null;
    var dragWindow = [0, 0], dragMove = 0, dragTime = 0, frameMove = 0;
    /* Frame clock of the last frame that measured movement. Everything that
       ages with time — the idle decay below, the relaxation after release —
       reads this, never a timestamp the pointer events carried: rAF and
       performance.now() share an origin in a browser, but mixing the two in
       the same subtraction is one false constant away from decaying from the
       first frame of every pull. */
    var lastMoveAt = 0;
    var dragSkipClick = 0;
    var breakRaf = 0, breakCleanup = null;

    /* Spring, and the rate behind the deformation: the smoothed velocity sets
       the target of the double-angle vector (its direction doubled, its
       magnitude the amount of stretch), and the vector approaches that target
       as one quantity — axis and amount cannot disagree. After the release
       the stored speed decays with a ~750ms time constant, which is what
       makes a released pull look like jelly rather than a snap-back. The dead
       zone is in user units per frame — a couple of pixels of hand movement;
       below it, and after release, the orientation is kept and only the
       amount relaxes, so a slow hand cannot spin the blob.

       STRETCH_PER_SPEED is the whole feel of the drag. At a normal hand speed
       (roughly 1000 CSS px/s) the blob sits around 1.5:1 along the axis of
       travel, and a fast flick reaches the cap. */
    var PULL_K = 0.12, PULL_DAMP = 0.78;
    var DEFORM_RATE = 0.3;
    var STRETCH_MAX = 0.7, STRETCH_PER_SPEED = 0.022, SPEED_DECAY = 750;
    var AXIS_DEAD_ZONE = 2;
    /* Two empty measuring windows, then the reading decays: a held hand that
       has stopped moving produces no events at all, and a velocity that only
       ever updated on those events would hold the deformation forever. The
       half-life is shorter than the released-pull decay (SPEED_DECAY) because
       a stopped hand is not a released jelly — it is just still. */
    var IDLE_WINDOW = 150, IDLE_DECAY = 200;
    /* Room for the blur, the ripple and the stretch past the edge of the box
       the blob is clamped to. */
    var BLUR_PAD = 40;

    /* Bounds, in user units, of what can be on screen: the SVG's own box.
       Anything the pull draws is kept inside it, and the filter region is
       derived from it, so neither can be clipped by the other. Filled in when
       a pull starts; the values below are only a fallback for a degenerate
       measurement. */
    var viewBox = { left: -60, top: -140, right: 740, bottom: 540 };
    var gooPinned = false, gooPinnedBox = null;
    var gooFilter = svgEl.querySelector("#fluid-ip-goo");
    var gooOrig = gooFilter ? {
        x: gooFilter.getAttribute("x"),
        y: gooFilter.getAttribute("y"),
        width: gooFilter.getAttribute("width"),
        height: gooFilter.getAttribute("height")
    } : null;

    function toSVG(sx, sy) {
        var ctm = svgEl.getScreenCTM();
        if (!ctm) return null;
        var det = ctm.a * ctm.d - ctm.b * ctm.c;
        if (!det) return null;
        var x = sx - ctm.e, y = sy - ctm.f;
        return [(ctm.d * x - ctm.c * y) / det, (ctm.a * y - ctm.b * x) / det];
    }

    /* The four corners in user space: an axis-aligned box is enough because
       the pull clamps to the same box. */
    function measureView() {
        var corners = [toSVG(0, 0), toSVG(window.innerWidth, 0),
            toSVG(0, window.innerHeight), toSVG(window.innerWidth, window.innerHeight)];
        if (corners.indexOf(null) !== -1) return;
        viewBox.left = Math.min(corners[0][0], corners[2][0], corners[1][0], corners[3][0]);
        viewBox.top = Math.min(corners[0][1], corners[1][1], corners[2][1], corners[3][1]);
        viewBox.right = Math.max(corners[0][0], corners[2][0], corners[1][0], corners[3][0]);
        viewBox.bottom = Math.max(corners[0][1], corners[1][1], corners[2][1], corners[3][1]);
    }

    function svgScale() {
        var ctm = svgEl.getScreenCTM();
        return ctm ? Math.sqrt(ctm.a * ctm.a + ctm.b * ctm.b) : 1;
    }

    /* Frame time in 60Hz ticks, and one exponential approach step for it, so
       every rate below means the same thing on any refresh rate. */
    function frameTicks(now) {
        var dt = bumpPrev ? now - bumpPrev : 16.7;
        bumpPrev = now;
        return delta(dt);
    }

    function delta(dt) {
        return Math.min(2.5, Math.max(0.2, dt / 16.7));
    }

    /* Exponential approach that is frame-rate independent: `rate` is the
       fraction covered in one 60Hz frame. */
    function approach(current, target, rate, k) {
        return current + (target - current) * (1 - Math.pow(1 - rate, k));
    }

    /* Pin the goo region over the whole viewport, in user units, once per
       pull. The blob is clamped to the same box, so the two can never
       disagree; a fixed rectangle could, and did — its left edge sat 500 units
       from the body, so pulling left clipped the blob before the pointer had
       crossed a quarter of the screen. */
    function pinGoo() {
        if (gooPinned) return;
        gooPinned = true;
        if (!gooFilter) return;
        measureView();
        var pad = BLUR_PAD;
        var box = {
            x: viewBox.left - pad, y: viewBox.top - pad,
            width: viewBox.right - viewBox.left + pad * 2,
            height: viewBox.bottom - viewBox.top + pad * 2
        };
        gooPinnedBox = box;
        gooFilter.setAttribute("x", box.x);
        gooFilter.setAttribute("y", box.y);
        gooFilter.setAttribute("width", box.width);
        gooFilter.setAttribute("height", box.height);
    }

    /* Whether the pinned region is still spoken for. The region is not the
       pull's property alone: a break keeps it for the flight home, and it just
       outlasted a pull that began while that break was finishing — handing it
       back the moment the break's own cleanup ran clipped the second drag to
       the small region around the body, so the blob vanished beyond that box
       and reappeared inside it (2026-09-30). */
    function gooNeeded() {
        return !!(dragStart || dragSVG || dragActive)
            || Math.sqrt(Math.pow(bx - BCX, 2) + Math.pow(by - BCY, 2)) > BR * 0.75;
    }

    function restoreGoo() {
        if (!gooPinned || gooNeeded()) return;
        gooPinned = false;
        gooPinnedBox = null;
        if (!gooFilter || !gooOrig) return;
        gooFilter.setAttribute("x", gooOrig.x);
        gooFilter.setAttribute("y", gooOrig.y);
        gooFilter.setAttribute("width", gooOrig.width);
        gooFilter.setAttribute("height", gooOrig.height);
    }

    function bumpStep(now) {
        var k = frameTicks(now);
        if (playing) {
            /* The click scene takes the whole figure over: drop this pull
               entirely, deformation included, or the next one starts from a
               blob that was left mid-stretch. Landing it on the body first is
               also what lets the region go back. */
            bumpEl.setAttribute("d", "");
            bx = BCX; by = BCY; bvx = 0; bvy = 0;
            bumpStretch = 1; bumpAngle = 0; bumpPhase = 0; pointerSpeed = 0;
            deformX = 0; deformY = 0;
            bumpRaf = 0;
            restoreGoo();
            return;
        }

        var target = dragActive && dragSVG ? dragSVG : [BCX, BCY];
        var dx = target[0] - bx, dy = target[1] - by;
        /* Semi-implicit Euler with k sub-steps: a 120Hz frame integrates the
           same spring twice as finely instead of pushing it twice as hard,
           which is what a naive `* k` on both terms would do. */
        var sub = Math.round(k);
        var rest = k - sub;
        if (sub < 1) { sub = 1; rest = k - 1; }
        for (var s = 0; s < sub; s++) {
            var h = s === sub - 1 ? 1 + rest : 1;
            bvx = (bvx + dx * PULL_K * h) * PULL_DAMP;
            bvy = (bvy + dy * PULL_K * h) * PULL_DAMP;
            bx += bvx * h;
            by += bvy * h;
        }
        /* The blob is ink on the screen, so it stops at the screen: it is also
           the box the filter region covers, which is what keeps it drawn. The
           radius is subtracted so the whole shape stays in, not just its
           centre. */
        var inset = BUMP_R * (1 + STRETCH_MAX);
        if (gooPinned) {
            bx = Math.min(Math.max(bx, viewBox.left + inset), viewBox.right - inset);
            by = Math.min(Math.max(by, viewBox.top + inset), viewBox.bottom - inset);
        }

        var dist = Math.hypot(bx - BCX, by - BCY);

        /* Movement this window, accumulated in the pointer handler. Everything
           below reads it: the direction a single pointermove reports is mostly
           hand tremor, and a stretch lobe driven by that noise swings. */
        var move = frameMove;
        frameMove = 0;
        if (move > 0) lastMoveAt = now;

        /* The deformation target is the smoothed velocity mapped into
           double-angle space: direction doubled, magnitude the amount of
           stretch. A hand that reverses therefore asks for the same vector
           again — a half turn of the axis is the same shape — only smaller
           while the speed passes through zero: the blob rounds out and
           stretches back along the same line. Steering an axis angle instead
           rotated the lobe a quarter turn on every reversal, which read as
           the blob having a head and a tail. Below the dead zone, and after
           the release, the orientation is kept and only the amount relaxes. */
        /* A hand that stops dead stops sending pointermove, and the smoothed
           velocity is only ever settled by those events — so it froze at its
           last value and the blob held its stretch along the travel direction
           for as long as the button stayed down (2026-09-30: a fast drag
           followed by a dead stop kept the deformation indefinitely). Decay
           the reading once no movement has been measured for a couple of
           windows; a hand that is still moving refreshes it every window. */
        if (dragActive && now - lastMoveAt > IDLE_WINDOW) {
            var idle = Math.pow(0.5, k * 16.7 / IDLE_DECAY);
            pullVX *= idle;
            pullVY *= idle;
        }
        var speedNow = Math.sqrt(pullVX * pullVX + pullVY * pullVY);
        pointerSpeed = dragActive
            ? speedNow
            : pointerSpeed * Math.pow(0.5, (now - (lastMoveAt || now)) / SPEED_DECAY);
        var amount = Math.min(STRETCH_MAX, pointerSpeed * STRETCH_PER_SPEED);
        var targetX = 0, targetY = 0;
        if (dragActive && speedNow > AXIS_DEAD_ZONE) {
            var axisTwice = 2 * Math.atan2(pullVY, pullVX);
            targetX = amount * Math.cos(axisTwice);
            targetY = amount * Math.sin(axisTwice);
        } else {
            var held = Math.sqrt(deformX * deformX + deformY * deformY);
            if (held > 1e-6) {
                targetX = deformX / held * amount;
                targetY = deformY / held * amount;
            }
        }
        deformX = approach(deformX, targetX, DEFORM_RATE, k);
        deformY = approach(deformY, targetY, DEFORM_RATE, k);
        var deform = Math.sqrt(deformX * deformX + deformY * deformY);
        bumpStretch = 1 + deform;
        if (deform > 1e-4) bumpAngle = Math.atan2(deformY, deformX) / 2;

        /* The surface ripple turns with the hand, and stops with it. While the
           pointer is held it is the pull that animates; after the release the
           stretch relaxing is the only motion left, and a ripple that kept
           advancing read as the blob spinning in place. */
        bumpPhase += Math.min(0.35, move / 260) * k;

        if (dist < BR * 0.75 && !dragActive) {
            /* The blob is back inside the body: erase it, but keep stepping
               until it has also stopped moving and the deformation has fully
               relaxed — otherwise the loop stops with the stretch stuck where
               it was, and the next pull would start pre-deformed. */
            bumpEl.setAttribute("d", "");
            restoreGoo();
            if (Math.abs(bvx) < 0.08 && Math.abs(bvy) < 0.08 && Math.abs(bumpStretch - 1) < 0.005) {
                /* The spring's last fraction of a unit is not worth a frame;
                   land on the target exactly so the next pull starts from the
                   body rather than from a residual offset. */
                bx = BCX; by = BCY; bvx = 0; bvy = 0;
                bumpStretch = 1;
                deformX = 0; deformY = 0;
                bumpRaf = 0;
                return;
            }
        } else {
            /* Symmetric ripple: the pulled blob is a shapeless ball whose
               surface deforms with the drag — centrally symmetric, so nothing
               about it reads as a front or a back. */
            bumpEl.setAttribute("d", blobPath(bx, by, BUMP_R, bumpPhase,
                bumpStretch, bumpAngle, true));
        }
        bumpRaf = window.requestAnimationFrame(bumpStep);
    }

    function ensureBump() {
        if (!bumpRaf) {
            bumpPrev = 0;
            bumpRaf = window.requestAnimationFrame(bumpStep);
        }
    }

    function stopPull() {
        dragSVG = null;
        dragStart = null; dragActive = false;
        dragWindow[0] = 0; dragWindow[1] = 0;
        dragMove = 0; frameMove = 0;
        pullVX = 0; pullVY = 0;
        if (bumpRaf) window.cancelAnimationFrame(bumpRaf);
        bumpRaf = 0;
        bumpEl.setAttribute("d", "");
        bx = BCX; by = BCY; bvx = 0; bvy = 0;
        bumpStretch = 1; bumpAngle = 0; bumpPhase = 0; pointerSpeed = 0;
        deformX = 0; deformY = 0;
        lastMoveAt = 0;
        if (breakCleanup) breakCleanup();
        restoreGoo();
    }

    /* Close the measuring window and fold its displacement into the smoothed
       velocity. Called on the window's own schedule and once more when the
       hand lets go, so a flick shorter than a window is still measured. */
    function flushPull() {
        if (dragWindow[0] === 0 && dragWindow[1] === 0) {
            /* Nothing moved in the whole window; restart it so a pause cannot
               be averaged into the next movement and read back as a slow hand. */
            dragMove = 0;
            dragTime = performance.now();
            return;
        }
        /* A window shorter than this is too noisy to read a direction from,
           except for the last one, where a flick would otherwise register as
           no movement at all. */
        var ticks = (performance.now() - dragTime) / 16.7;
        if (ticks < 0.25) return;
        var kk = Math.min(2.5, Math.max(0.2, ticks));
        var blend = 1 - Math.pow(0.65, kk);
        pullVX += (dragWindow[0] / ticks - pullVX) * blend;
        pullVY += (dragWindow[1] / ticks - pullVY) * blend;
        frameMove = dragMove;
        dragWindow[0] = 0; dragWindow[1] = 0;
        dragMove = 0;
        dragTime = performance.now();
    }

    window.addEventListener("pointermove", function (e) {
        if (!interactive() || !dragStart) return;
        var sx = e.clientX, sy = e.clientY;
        if (!dragActive) {
            var ddx = sx - dragStart[0], ddy = sy - dragStart[1];
            if (Math.sqrt(ddx * ddx + ddy * ddy) <= 6) return;
            dragActive = true;
            dragTime = performance.now();
            dragWindow[0] = 0; dragWindow[1] = 0;
            dragMove = 0; frameMove = 0;
            pullVX = 0; pullVY = 0;
            pinGoo();
        }
        var p = toSVG(sx, sy);
        if (!p) return;
        /* Accumulate first, then close the window: a move that arrives after a
           pause belongs to its own window, not to the pause. Per event,
           pointermove reports a fraction of a frame's movement; per frame, one
           sample of a hand that is barely moving is mostly tremor. A ~75ms
           window is the point where both stop mattering. */
        if (dragSVG) {
            dragWindow[0] += p[0] - dragSVG[0];
            dragWindow[1] += p[1] - dragSVG[1];
            dragMove += Math.sqrt(Math.pow(p[0] - dragSVG[0], 2) + Math.pow(p[1] - dragSVG[1], 2));
        }
        if ((performance.now() - dragTime) / 16.7 >= 4.5) flushPull();
        dragSVG = p;
        ensureBump();
    });

    orb.addEventListener("pointerdown", function (e) {
        if (!interactive() || playing || e.button !== 0) return;
        if (document.documentElement.classList.contains("fluid-portal-active")) return;
        dragStart = [e.clientX, e.clientY];
        dragActive = false;
    });

    /* One way out of a pull, for the button coming up and for the browser
       taking the pointer away mid-gesture (pointercancel) alike: without the
       second one a cancelled drag left `dragStart` set and the blob following
       the pointer with no button down. */
    function endPull() {
        if (!dragStart) return;
        var wasDrag = dragActive;
        dragStart = null;
        dragActive = false;

        if (!wasDrag) { dragSVG = null; return; }
        dragSkipClick = Date.now();
        /* Measure the last, unfinished window: a flick can be shorter than one
           window and would otherwise register as no movement at all. */
        flushPull();

        var dx = bx - BCX, dy = by - BCY;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var threshold = 140 / svgScale();

        dragSVG = null;

        if (dist - BR > threshold) {
            doBreakOff(bx, by);
        } else {
            /* The blob springs back and the deformation relaxes in the same
               loop, which ends itself once both have settled. A frame from
               before the release may already be queued, so ask the chain
               instead of the browser: the old `if (bumpRaf)` guard cancelled
               nothing and left that stale frame to run against reset state. */
            ensureBump();
        }
    }

    window.addEventListener("pointerup", endPull);
    window.addEventListener("pointercancel", endPull);

    function doBreakOff(px, py) {
        /* One break at a time. A second one would not merely overlap: both
           closures share the `breakCleanup` slot, so whichever finished last
           would clean up the other's nodes and leave its own behind for good.
           A pull during a running break therefore springs back like any short
           pull, which is what the click scene does too. */
        if (breakCleanup) return;
        bumpEl.setAttribute("d", "");
        bx = BCX; by = BCY; bvx = 0; bvy = 0;
        if (bumpRaf) { window.cancelAnimationFrame(bumpRaf); bumpRaf = 0; }
        /* The pinned region already covers the release point and the return
           path, so it simply stays until the break is cleaned up. */
        pinGoo();

        var idx = scene % SPECS.length;
        var spec = SPECS[idx];
        var formDef = spec.forms[scene % spec.forms.length];
        scene++;

        var echoP = document.createElementNS(SVG_NS, "path");
        echoLayer.appendChild(echoP);
        var formNode = document.createElementNS(SVG_NS, formDef.type);
        formNode.setAttribute("class",
            "fluid-ip-form" + (formDef.type === "text" ? " fluid-ip-form-text" : ""));
        if (formDef.type === "text") formNode.textContent = formDef.value;
        else formNode.setAttribute("d", formDef.value);
        formNode.setAttribute("fill-rule", formDef.rule || "nonzero");
        formNode.setAttribute("opacity", "0");
        formLayer.appendChild(formNode);

        var els = [echoP, formNode];
        breakCleanup = function () {
            if (breakRaf) window.cancelAnimationFrame(breakRaf);
            breakRaf = 0;
            els.forEach(function (n) { n.remove(); });
            restoreGoo();
            breakCleanup = null;
        };

        var start = null;
        function breakFrame(now) {
            if (start === null) start = now;
            /* 3600ms in four beats — form in 0.72s, hold 1.37s, melt back
               0.79s, fly home 0.72s — slowed from the first cut (2500ms) at
               the user's request: the transitions are the point of the move,
               not something to get past. */
            var t = Math.min(1, (now - start) / 3600);
            if (t >= 1 || !orb.isConnected) { breakCleanup(); return; }

            /* Melting back into ink is part of showing the form, not part of
               flying home: the symbol is back to a whole blob before it starts
               to move, and the journey is made by ink alone. */
            var formIn = Math.min(1, t / 0.20);
            var formOut = t > 0.58 ? (t - 0.58) / 0.22 : 0;
            var formMix = ease(formIn) * (1 - ease(Math.min(1, formOut)));
            var flyT = t > 0.80 ? (t - 0.80) / 0.20 : 0;

            var cx = px + (BCX - px) * ease(flyT);
            var cy = py + (BCY - py) * ease(flyT);
            /* The ink melts fully into the form: while the pattern or the
               text is on show there is no blob under it. The forms layer is
               hollow in the middle — glyph counters, the gaps of the star —
               and any residual disc shows through as a black dot covering
               the centre (2026-09-30: a 0.8-radius blob used to sit there
               for the whole hold). The radius therefore follows (1 - formMix),
               the same coupling as the click animation: the ink condenses
               out again through the melt-back and reaches full size at the
               exact moment the form disappears — that whole blob is what
               travels home, and nothing reforms mid-flight. */
            var size = spec.radius * (1 - formMix)
                * (1 - ease(flyT) * 0.45);

            echoP.setAttribute("d", blobPath(cx, cy,
                size, now / 1200, 1, 0));
            formNode.setAttribute("opacity", formMix.toFixed(3));
            formNode.setAttribute("transform",
                "translate(" + cx.toFixed(1) + " " + cy.toFixed(1) +
                ") scale(" + (0.5 + 0.5 * formMix).toFixed(3) + ")");

            breakRaf = window.requestAnimationFrame(breakFrame);
        }
        breakRaf = window.requestAnimationFrame(breakFrame);
    }

    [wide, fine, reduced].forEach(function (mq) {
        if (mq.addEventListener) mq.addEventListener("change", function () {
            if (!interactive()) stopPull();
        });
        else if (mq.addListener) mq.addListener(function () {
            if (!interactive()) stopPull();
        });
    });
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) stopPull();
    });

    /* Read-only view of the pull, for docs/design/fluid-ip-check.mjs: the
       deformation axis and the filter region are the two things that cannot be
       judged from the build output. */
    window.FluidIpPull = {
        state: function () {
            return {
                x: bx, y: by,
                stretch: bumpStretch,
                angle: bumpAngle,
                pulled: !!(dragActive && dragSVG),
                /* A break hands the pull off to the echo animation and resets
                   the blob, which reads exactly like a frozen pull unless the
                   check can tell them apart. */
                breaking: !!breakCleanup,
                /* The box the blob is clamped to and the region the filter is
                   pinned to are the same rectangle: that is what keeps the ink
                   drawn all the way to the screen edge. */
                bounds: gooPinnedBox,
                view: viewBox,
                goo: gooFilter ? {
                    x: gooFilter.getAttribute("x"),
                    y: gooFilter.getAttribute("y"),
                    width: gooFilter.getAttribute("width"),
                    height: gooFilter.getAttribute("height")
                } : null
            };
        }
    };
})();
