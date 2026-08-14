/**
 * Starfield particle background — inspired by deepseek.com hero canvas.
 *
 * - 90px grid of dots; mouse pushes them apart (140px radius), spring pulls them back.
 * - Adjacent grid dots closer than 20px are connected by faint lines.
 * - Theme aware: follows PaperMod's [data-theme] attribute (light / dark).
 * - Skips touch / coarse-pointer devices and respects prefers-reduced-motion.
 */
(function () {
    "use strict";

    var canvas = document.getElementById("starfield-canvas");
    if (!canvas) return;

    // Skip touch devices (matches deepseek.com behavior)
    if (window.matchMedia("(hover: none), (pointer: coarse)").matches) return;

    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ---- theme colors -------------------------------------------------
    // Light theme matches deepseek.com exactly: line rgba(60,100,160,0.1) / 0.5px,
    // dots rgba(60,100,160,0.2). Dark theme keeps the same subtle density in a
    // lighter blue so it stays visible on the dark background.
    function themeColors() {
        var dark = document.documentElement.getAttribute("data-theme") === "dark";
        return dark
            ? { line: "rgba(140, 170, 215, 0.12)", dot: "rgba(160, 190, 230, 0.35)", glow: "rgba(190, 215, 245, 0.8)" }
            : { line: "rgba(60, 100, 160, 0.1)", dot: "rgba(60, 100, 160, 0.2)", glow: "rgba(60, 100, 160, 0.8)" };
    }

    // ---- state --------------------------------------------------------
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var mouse = { x: -9999, y: -9999 }; // off-screen until first mousemove
    var width = 0, height = 0;
    var points = [];
    var cols = 0, rows = 0;
    var rafId = 0;
    var running = true;
    var lastFrame = 0;
    var FRAME_MS = 1000 / 30; // 30 fps cap
    var SPACING = 90;         // grid spacing
    var RADIUS = 140;         // mouse influence radius
    var THRESHOLD = 20;       // line-drawing distance

    function buildGrid() {
        width = canvas.clientWidth;
        height = canvas.clientHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        cols = Math.ceil(width / SPACING) + 1;
        rows = Math.ceil(height / SPACING) + 1;
        var offX = (width - (cols - 1) * SPACING) / 2;
        var offY = (height - (rows - 1) * SPACING) / 2;

        points = [];
        for (var r = 0; r < rows; r++) {
            for (var c = 0; c < cols; c++) {
                var rx = offX + SPACING * c;
                var ry = offY + SPACING * r;
                points.push({ restX: rx, restY: ry, x: rx, y: ry, vx: 0, vy: 0 });
            }
        }
    }

    function drawStatic() {
        var colors = themeColors();
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = colors.dot;
        ctx.globalAlpha = 0.2;
        for (var i = 0; i < points.length; i++) {
            var p = points[i];
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function frame(now) {
        if (!running) return;
        if (now - lastFrame < FRAME_MS) {
            rafId = requestAnimationFrame(frame);
            return;
        }
        lastFrame = now - ((now - lastFrame) % FRAME_MS);

        // Rebuild grid on resize (debounced implicitly by frame cap)
        if (canvas.clientWidth !== width || canvas.clientHeight !== height) {
            buildGrid();
        }

        var colors = themeColors();
        ctx.clearRect(0, 0, width, height);

        var i, p, dx, dy, dist, f, nx, ny;
        var mx = mouse.x, my = mouse.y;
        var maxSpeed = 0;

        // ---- physics: mouse repulsion + spring + damping ----
        for (i = 0; i < points.length; i++) {
            p = points[i];
            dx = p.x - mx;
            dy = p.y - my;
            dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < RADIUS && dist > 0.1) {
                f = (1 - dist / RADIUS) * 30 * 0.1;
                nx = dx / dist;
                ny = dy / dist;
                p.vx += nx * f;
                p.vy += ny * f;
            }
            // spring back to rest position
            p.vx += 0.05 * (p.restX - p.x);
            p.vy += 0.05 * (p.restY - p.y);
            // damping
            p.vx *= 0.85;
            p.vy *= 0.85;
            p.x += p.vx;
            p.y += p.vy;
            var speed = Math.abs(p.vx) + Math.abs(p.vy);
            if (speed > maxSpeed) maxSpeed = speed;
        }

        // ---- grid lines (horizontal) ----
        ctx.strokeStyle = colors.line;
        ctx.lineWidth = 0.5;
        for (var r = 0; r < rows; r++) {
            for (var c = 0; c < cols - 1; c++) {
                var a = points[r * cols + c];
                var b = points[r * cols + c + 1];
                var lx = b.x - a.x, ly = b.y - a.y;
                var ld = Math.sqrt(lx * lx + ly * ly);
                if (ld < THRESHOLD) continue; // too close together — skip
                nx = lx / ld;
                ny = ly / ld;
                ctx.beginPath();
                ctx.moveTo(a.x + 10 * nx, a.y + 10 * ny);
                ctx.lineTo(b.x - 10 * nx, b.y - 10 * ny);
                ctx.stroke();
            }
        }

        // ---- grid lines (vertical) ----
        for (var c = 0; c < cols; c++) {
            for (var r = 0; r < rows - 1; r++) {
                var a2 = points[r * cols + c];
                var b2 = points[(r + 1) * cols + c];
                var lx2 = b2.x - a2.x, ly2 = b2.y - a2.y;
                var ld2 = Math.sqrt(lx2 * lx2 + ly2 * ly2);
                if (ld2 < THRESHOLD) continue; // too close together — skip
                nx = lx2 / ld2;
                ny = ly2 / ld2;
                ctx.beginPath();
                ctx.moveTo(a2.x + 10 * nx, a2.y + 10 * ny);
                ctx.lineTo(b2.x - 10 * nx, b2.y - 10 * ny);
                ctx.stroke();
            }
        }

        // ---- dots, brighten near mouse ----
        for (i = 0; i < points.length; i++) {
            p = points[i];
            dx = p.x - mx;
            dy = p.y - my;
            dist = Math.sqrt(dx * dx + dy * dy);
            var glow = Math.max(0, 1 - dist / RADIUS);
            var radius = 1.8 + 2 * glow;
            ctx.globalAlpha = 0.2 + 0.4 * glow;
            ctx.fillStyle = colors.dot;
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Pause when everything is calm (matches deepseek.com optimization)
        if (maxSpeed < 0.01) {
            running = false;
        } else {
            rafId = requestAnimationFrame(frame);
        }
    }

    function wake() {
        if (!running) {
            running = true;
            lastFrame = 0;
            rafId = requestAnimationFrame(frame);
        }
    }

    function onMouseMove(e) {
        var rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
        wake();
    }

    function onMouseLeave() {
        mouse.x = -9999;
        mouse.y = -9999;
        wake();
    }

    function onThemeChange() {
        // Colors are read per-frame; just force a repaint if paused.
        wake();
    }

    // ---- init ----
    buildGrid();

    if (reduceMotion) {
        drawStatic();
        // Still respond to theme changes when static
        var themeObserver = new MutationObserver(function () {
            drawStatic();
        });
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    } else {
        rafId = requestAnimationFrame(frame);
    }

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("resize", wake);
})();
