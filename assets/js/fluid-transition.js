/* The character is the homepage's door. Move the same SVG between the
   full-screen entrance and its resting place in the article-list intro. */
(function () {
    "use strict";

    var homePath = document.currentScript.getAttribute("data-home-path");
    if (window.location.pathname !== homePath) return;

    var root = document.documentElement;
    var fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!window.location.hash) root.classList.add("fluid-portal-active");

    document.addEventListener("DOMContentLoaded", function () {
        var portal = document.getElementById("fluid-portal");
        var orb = document.getElementById("fluid-ip-orb");
        var main = document.getElementById("main");
        if (!portal || !orb || !main) {
            root.classList.remove("fluid-portal-active");
            return;
        }

        var home = orb.parentNode;
        var dock = document.createElement("span");
        dock.className = "fluid-ip-dock";
        dock.setAttribute("aria-hidden", "true");
        dock.hidden = true;
        home.insertBefore(dock, orb);
        document.body.appendChild(portal);
        var header = document.querySelector(".header");
        var footer = document.querySelector(".footer");
        var closed = false;
        var entering = false;
        var endScene = null;
        var wide = window.matchMedia("(min-width: 600px)");

        function setInert(value) {
            if (header) header.inert = value;
            main.inert = value;
            if (footer) footer.inert = value;
            ["theme-toggle", "top-link"].forEach(function (id) {
                var control = document.getElementById(id);
                if (control) control.inert = value;
            });
        }

        function showPortal() {
            if (entering || !closed && orb.parentNode === portal) return;
            closed = false;
            root.classList.add("fluid-portal-active");
            dock.hidden = false;
            portal.appendChild(orb);
            setInert(true);
            window.scrollTo(0, 0);
            window.dispatchEvent(new Event("fluid-portal-change"));
        }

        function showArticles() {
            closed = true;
            root.classList.remove("fluid-portal-active");
            dock.hidden = true;
            home.insertBefore(orb, dock.nextSibling);
            orb.style.translate = "";
            setInert(false);
            window.dispatchEvent(new Event("fluid-portal-change"));
        }

        if (root.classList.contains("fluid-portal-active")) showPortal();
        else showArticles();

        var eyes = orb.querySelectorAll(".fluid-ip-eye");
        function look(x, y) {
            for (var i = 0; i < eyes.length; i++) {
                eyes[i].style.transform = "translate(" + x + "px," + y + "px)";
            }
        }
        var lookRaf = 0;
        window.addEventListener("pointermove", function (event) {
            if (!fine.matches || entering) return;
            var cx = event.clientX, cy = event.clientY;
            if (lookRaf) return;
            lookRaf = requestAnimationFrame(function () {
                lookRaf = 0;
                var rect = orb.getBoundingClientRect();
                if (rect.bottom < 0 || rect.top > window.innerHeight) return;
                var x = Math.max(-10, Math.min(10, (cx - rect.left - rect.width * 0.39) / 22));
                var y = Math.max(-8, Math.min(8, (cy - rect.top - rect.height * 0.56) / 25));
                look(x.toFixed(1), y.toFixed(1));
            });
        });
        window.addEventListener("mouseout", function (event) {
            if (!event.relatedTarget) look(0, 0);
        });

        /* These are the real page elements, not screenshots or duplicate links.
           One clock drives the whole scene: render(t) for t in [0, 1], and the
           recall is the same film run backwards. Blots are paths inside the
           character's own SVG, so they bud from the body through its goo
           filter; each lands as a band of ink shaped like its target, and the
           target condenses out of that ink through a threshold filter. */
        var SVG_NS = "http://www.w3.org/2000/svg";
        var ENTER = 2200;
        var RECALL = 1800;
        /* One blot per entry. An entry that matches several elements lands as
           one blot that splits in flight. */
        var TARGETS = [
            ".fluid-ip-home-info > .entry-header",
            ".fluid-ip-home-info > .entry-content",
            ".fluid-ip-home-info .social-icons",
            ".logo > a",
            "#theme-toggle, #top-link"
        ];
        // Reading content only fades in: no card movement.
        var QUIET = "#menu, .main > :not(.home-info), .footer";
        // Painted body: centre and radius in SVG units; blot radius likewise.
        var BODY = [256, 250];
        var BODY_R = 250;
        var BLOT_R = 46;
        var POINTS = 16;

        function rgb(value) {
            var n = String(value || "").match(/[\d.]+/g) || [];
            return [+n[0] || 0, +n[1] || 0, +n[2] || 0, n.length > 3 ? +n[3] : 1];
        }

        function mix(a, b, k) {
            return a + (b - a) * k;
        }

        function attr(node, name, value) {
            if (node.getAttribute(name) !== value) node.setAttribute(name, value);
        }

        function buildScene() {
            var Ink = window.FluidInk;
            var ease = Ink.ease;
            var smooth = Ink.smooth;
            var svg = orb.querySelector("svg");
            var blotLayer = orb.querySelector(".fluid-ip-blots");
            var formLayer = orb.querySelector(".fluid-ip-forms");
            var goo = svg.querySelector("#fluid-ip-goo");

            orb.style.transform = "";
            var from = orb.getBoundingClientRect();
            var to = dock.getBoundingClientRect();
            var m0 = svg.getScreenCTM();
            var det0 = m0.a * m0.d - m0.b * m0.c;
            var unit = Math.sqrt(Math.abs(det0));
            var c0 = [from.left + from.width / 2, from.top + from.height / 2];
            var travel = [to.left + to.width / 2 - c0[0], to.top + to.height / 2 - c0[1]];
            var travelLen = Math.sqrt(travel[0] * travel[0] + travel[1] * travel[1]) || 1;
            var travelDir = [travel[0] / travelLen, travel[1] / travelLen];
            var ratio = to.width / from.width;

            function toScreen0(u) {
                return [m0.a * u[0] + m0.c * u[1] + m0.e, m0.b * u[0] + m0.d * u[1] + m0.f];
            }
            function toUser0(q) {
                var x = q[0] - m0.e;
                var y = q[1] - m0.f;
                return [(m0.d * x - m0.c * y) / det0, (m0.a * y - m0.b * x) / det0];
            }
            // A path from a to b that bows upward by `bend` pixels.
            function bow(a, b) {
                var dx = b[0] - a[0];
                var dy = b[1] - a[1];
                var len = Math.sqrt(dx * dx + dy * dy) || 1;
                var nx = dy / len;
                var ny = -dx / len;
                return ny > 0 ? [-nx, -ny, len] : [nx, ny, len];
            }
            var bodyBow = bow([0, 0], travel);
            var bodyBend = Math.min(60, travelLen * 0.12);

            /* The body at time t: squash and rebound before leaving, then an
               eased arc to the dock, stretched along the way by its speed. */
            function bodyAt(t) {
                var x = Ink.clamp01((t - 0.12) / 0.63);
                var p = ease(x);
                var speed = x > 0 && x < 1 ? (x < 0.5 ? 4 * x * x : Math.pow(2 - 2 * x, 2)) : 0;
                var lift = bodyBend * Math.sin(Math.PI * p);
                var s = 1 + (ratio - 1) * p;
                var squash = t < 0.14 ? 0.045 * Math.pow(Math.sin(Math.PI * t / 0.14), 2) : 0;
                var e = 1 + 0.06 * speed;
                var cos = travelDir[0];
                var sin = travelDir[1];
                var k = (e - 1 / e) * cos * sin;
                var sx = s * (1 + squash / 2);
                var sy = s * (1 - squash);
                // CSS matrix(a, b, c, d): squash after stretch along travel.
                var A = [
                    sx * (e * cos * cos + sin * sin / e), sy * k,
                    sx * k, sy * (e * sin * sin + cos * cos / e)
                ];
                var c = [c0[0] + travel[0] * p + bodyBow[0] * lift, c0[1] + travel[1] * p + bodyBow[1] * lift];
                var det = A[0] * A[3] - A[1] * A[2];
                return {
                    A: A,
                    c: c,
                    scale: unit * s,
                    toScreen: function (u) {
                        var q = toScreen0(u);
                        var x = q[0] - c0[0];
                        var y = q[1] - c0[1];
                        return [c[0] + A[0] * x + A[2] * y, c[1] + A[1] * x + A[3] * y];
                    },
                    toUser: function (q) {
                        var x = q[0] - c[0];
                        var y = q[1] - c[1];
                        return toUser0([c0[0] + (A[3] * x - A[2] * y) / det, c0[1] + (A[0] * y - A[1] * x) / det]);
                    }
                };
            }

            var primary = rgb(window.getComputedStyle(orb).color);
            var bodyCentre = toScreen0(BODY);
            var blots = [];
            TARGETS.forEach(function (selector) {
                var nodes = [];
                Array.prototype.forEach.call(document.querySelectorAll(selector), function (el) {
                    var box = el.getBoundingClientRect();
                    if (!box.width || !box.height || box.top >= window.innerHeight || box.bottom <= 0) return;
                    var style = window.getComputedStyle(el);
                    var fill = rgb(style.backgroundColor);
                    // A filled control melts into its own disc; text into the
                    // band its glyphs actually cover.
                    var solid = fill[3] > 0;
                    var r = solid ? box : Ink.inkRect(el);
                    var melt = Ink.melt(el, { solid: solid });
                    nodes.push({
                        el: el,
                        solid: solid,
                        color: solid ? fill : rgb(style.color),
                        x: r.left + r.width / 2,
                        y: r.top + r.height / 2,
                        rx: r.width / 2 + melt.grow,
                        ry: solid ? r.height / 2 : r.height * 0.4 + melt.grow * 0.6,
                        melt: melt
                    });
                });
                if (!nodes.length) return;
                var i = blots.length;
                var T = [0, 0];
                nodes.forEach(function (n) {
                    T[0] += n.x / nodes.length;
                    T[1] += n.y / nodes.length;
                });
                var dx = T[0] - bodyCentre[0];
                var dy = T[1] - bodyCentre[1];
                var len = Math.sqrt(dx * dx + dy * dy) || 1;
                var dir = [dx / len, dy / len];
                var e = {
                    nodes: nodes,
                    dir: dir,
                    T: T,
                    b: 0.03 + 0.03 * i,
                    phase: i * 1.7,
                    u0: [BODY[0] + dir[0] * BODY_R * 0.55, BODY[1] + dir[1] * BODY_R * 0.55],
                    u1: [BODY[0] + dir[0] * (BODY_R + BLOT_R * 1.25), BODY[1] + dir[1] * (BODY_R + BLOT_R * 1.25)],
                    R1: Math.max(10, Math.min(20, Math.min.apply(null, nodes.map(function (n) { return n.ry; }))))
                };
                e.r = e.b + 0.11;
                e.l = e.r + 0.38;
                e.s = e.l + 0.10;
                var release = bodyAt(e.r);
                e.P = release.toScreen(e.u1);
                // The released ink retains the body's velocity. Starting a
                // fresh ease-in here would visibly stop it at the neck.
                var before = bodyAt(e.r - 0.0001).toScreen(e.u1);
                var after = bodyAt(e.r + 0.0001).toScreen(e.u1);
                e.V = [(after[0] - before[0]) / 0.0002, (after[1] - before[1]) / 0.0002];
                e.R0 = BLOT_R * release.scale;
                var arc = bow(e.P, T);
                var mid = [(e.P[0] + T[0]) / 2, (e.P[1] + T[1]) / 2];
                var bend = Math.min(110, arc[2] * 0.22);
                e.K = [mid[0] + arc[0] * bend, mid[1] + arc[1] * bend];
                e.angle = Math.atan2(dir[1], dir[0]);
                e.paths = nodes.map(function () {
                    return document.createElementNS(SVG_NS, "path");
                });
                blots.push(e);
            });
            /* Blots leaving in similar directions share one goo group, so they
               fuse and part like ink instead of overlapping with a crease.
               Distant groups stay apart to keep each filter region small. */
            var clusters = [];
            blots.slice().sort(function (a, b) { return a.angle - b.angle; }).forEach(function (e, i, sorted) {
                if (!i || e.angle - sorted[i - 1].angle > 1.05) {
                    var filter = goo.cloneNode(true);
                    filter.setAttribute("id", "fluid-blot-goo-" + clusters.length);
                    goo.parentNode.appendChild(filter);
                    var group = document.createElementNS(SVG_NS, "g");
                    group.setAttribute("filter", "url(#fluid-blot-goo-" + clusters.length + ")");
                    svg.insertBefore(group, formLayer);
                    clusters.push({ filter: filter, group: group, box: null });
                }
                e.cluster = clusters[clusters.length - 1];
            });
            var quiet = document.querySelectorAll(QUIET);
            var portalFill = rgb(window.getComputedStyle(portal).backgroundColor);
            var lastLook = "";

            function drawBlot(e, t, body) {
                var shapes = [];
                var inBody = false;
                var tint = 0;
                var alpha = 1;
                var x;
                if (t > e.b && t < e.r) {
                    // Bud: grows inside the body edge, then pinches off.
                    x = (t - e.b) / (e.r - e.b);
                    var k = ease(x);
                    var p = body.toScreen([mix(e.u0[0], e.u1[0], k), mix(e.u0[1], e.u1[1], k)]);
                    var R = BLOT_R * smooth(x / 0.55) * body.scale;
                    e.nodes.forEach(function () {
                        shapes.push([p[0], p[1], R, R, 0, R, 1]);
                    });
                    inBody = true;
                } else if (t >= e.r && t < e.l) {
                    // Flight along a bowed curve, stretched by its speed.
                    x = (t - e.r) / (e.l - e.r);
                    var u = ease(x);
                    var v = 1 - u;
                    var carry = (e.l - e.r) * x * Math.pow(1 - x, 3);
                    var q = [
                        v * v * e.P[0] + 2 * v * u * e.K[0] + u * u * e.T[0] + e.V[0] * carry,
                        v * v * e.P[1] + 2 * v * u * e.K[1] + u * u * e.T[1] + e.V[1] * carry
                    ];
                    var tx = 2 * v * (e.K[0] - e.P[0]) + 2 * u * (e.T[0] - e.K[0]);
                    var ty = 2 * v * (e.K[1] - e.P[1]) + 2 * u * (e.T[1] - e.K[1]);
                    var rate = x < 0.5 ? 12 * x * x : 3 * Math.pow(2 - 2 * x, 2);
                    var carryRate = (e.l - e.r) * Math.pow(1 - x, 2) * (1 - 4 * x);
                    tx = tx * rate + e.V[0] * carryRate;
                    ty = ty * rate + e.V[1] * carryRate;
                    var speed = Math.sqrt(tx * tx + ty * ty) / ((e.l - e.r) * ENTER / 1000);
                    var stretch = 1 + Math.min(0.4, speed * 0.0003);
                    var size = mix(e.R0, e.R1, smooth(x));
                    var angle = Math.atan2(ty, tx);
                    var split = smooth((x - 0.55) / 0.45);
                    e.nodes.forEach(function (n) {
                        shapes.push([q[0] + (n.x - e.T[0]) * split, q[1] + (n.y - e.T[1]) * split,
                            size * stretch, size / stretch, angle, size, 1]);
                    });
                    // Fused with the body until clear of its reach, so the
                    // neck pinches off instead of snapping.
                    var uq = body.toUser(q);
                    inBody = Math.sqrt(Math.pow(uq[0] - BODY[0], 2) + Math.pow(uq[1] - BODY[1], 2)) < BODY_R + BLOT_R + 40;
                    tint = smooth((x - 0.2) / 0.8);
                } else if (t >= e.l && t < e.s + 0.05) {
                    // Landing: spreads into the target's band, then lets go.
                    x = Math.min(1, (t - e.l) / (e.s - e.l));
                    // Zero velocity at both ends, like the incoming flight:
                    // an ease-out starts at full speed and snaps the band open.
                    var o = smooth(x);
                    e.nodes.forEach(function (n) {
                        shapes.push([n.x, n.y, mix(e.R1, n.rx, o), mix(e.R1, n.ry, o), 0,
                            mix(e.R1, 1.5, o), mix(1, n.solid ? 1 : 0.45, o)]);
                    });
                    tint = 1;
                    alpha = 1 - smooth((t - e.s) / 0.05);
                }

                var box = inBody ? null : e.cluster.box;
                function map(point) {
                    var u = body.toUser(point);
                    if (box) {
                        box[0] = Math.min(box[0], u[0]);
                        box[1] = Math.min(box[1], u[1]);
                        box[2] = Math.max(box[2], u[0]);
                        box[3] = Math.max(box[3], u[1]);
                    }
                    return u;
                }
                var colour = "rgb(" + [0, 1, 2].map(function (c) {
                    return Math.round(mix(primary[c], e.nodes[0].color[c], tint));
                }).join(",") + ")";
                var layer = inBody ? blotLayer : e.cluster.group;
                e.paths.forEach(function (path, j) {
                    var s = shapes[j];
                    attr(path, "d", s ? Ink.path(Ink.blob(s[0], s[1], s[2], s[3], s[4],
                        t * ENTER / 1150 + e.phase, s[5], s[6], POINTS), map) : "");
                    if (e.fill !== colour) path.style.fill = colour;
                    // Through the goo threshold, lower opacity erodes the band
                    // from its edges into the identical melted element below.
                    attr(path, "fill-opacity", alpha.toFixed(3));
                    if (path.parentNode !== layer) layer.appendChild(path);
                });
                e.fill = colour;

                // The element appears under the opaque band, then condenses.
                var shown = smooth((t - e.s + 0.03) / 0.03);
                var m = ease((t - e.s - 0.01) / 0.21);
                var opacity = shown.toFixed(3);
                /* Each of these filters re-runs a dilate / blur / threshold
                   chain over its element whenever anything in it changes, and
                   every target condenses inside the same stretch of the scene.
                   Scheduling those rewrites more coarsely does help the main
                   thread (measured: about -15% over the whole entrance), but
                   all six windows overlap almost completely, so the best it can
                   do is roughly a third fewer re-renders spread evenly — and it
                   puts visible steps into the reveal. Not worth it: the reveal
                   stays continuous and leans on the compositor hint instead. */
                e.nodes.forEach(function (n) {
                    if (n.el.style.opacity !== opacity) n.el.style.opacity = opacity;
                    n.melt.set(m);
                });
            }

            function render(t) {
                var body = bodyAt(t);
                var A = body.A;
                var transform = "translate(11.25%, -6%) translate(" +
                    (body.c[0] - c0[0]).toFixed(2) + "px," + (body.c[1] - c0[1]).toFixed(2) + "px) matrix(" +
                    A.map(function (n) { return n.toFixed(4); }).join(",") + ",0,0)";
                if (orb.style.transform !== transform) orb.style.transform = transform;
                portal.style.backgroundColor = "rgba(" + portalFill.slice(0, 3).join(",") + "," +
                    (portalFill[3] * (1 - smooth((t - 0.10) / 0.42))).toFixed(3) + ")";
                var fade = smooth((t - 0.45) / 0.45).toFixed(3);
                Array.prototype.forEach.call(quiet, function (node) {
                    if (node.style.opacity !== fade) node.style.opacity = fade;
                });
                clusters.forEach(function (c) {
                    c.box = [Infinity, Infinity, -Infinity, -Infinity];
                });
                blots.forEach(function (e) {
                    drawBlot(e, t, body);
                });
                // Keep each filter region tight around its blots: cost follows area.
                clusters.forEach(function (c) {
                    var b = c.box[0] < Infinity ? c.box : [0, 0, 0, 0];
                    // Round outward on a small grid: preserve blur padding
                    // without reallocating the filter surface for every pixel.
                    var left = Math.floor((b[0] - 40) / 16) * 16;
                    var top = Math.floor((b[1] - 40) / 16) * 16;
                    var right = Math.ceil((b[2] + 40) / 16) * 16;
                    var bottom = Math.ceil((b[3] + 40) / 16) * 16;
                    attr(c.filter, "x", String(left));
                    attr(c.filter, "y", String(top));
                    attr(c.filter, "width", String(right - left));
                    attr(c.filter, "height", String(bottom - top));
                });
                // Eyes glance at each bud as it leaves, then towards the dock.
                var gaze = [0, 0];
                if (t > 0.01 && t < 0.72) {
                    gaze = [travelDir[0] * 0.6, travelDir[1] * 0.6];
                    blots.forEach(function (e) {
                        if (t >= e.b - 0.02 && t < e.r + 0.06) gaze = e.dir;
                    });
                }
                var key = (gaze[0] * 10).toFixed(1) + "," + (gaze[1] * 8).toFixed(1);
                if (key !== lastLook) {
                    lastLook = key;
                    look((gaze[0] * 10).toFixed(1), (gaze[1] * 8).toFixed(1));
                }
            }

            function clear() {
                orb.style.transform = "";
                portal.style.backgroundColor = "";
                Array.prototype.forEach.call(quiet, function (node) {
                    node.style.opacity = "";
                });
                clusters.forEach(function (c) {
                    c.group.remove();
                    c.filter.remove();
                });
                blots.forEach(function (e) {
                    e.paths.forEach(function (path) { path.remove(); });
                    e.nodes.forEach(function (n) {
                        n.melt.remove();
                        n.el.style.opacity = "";
                    });
                });
                look(0, 0);
            }

            return { render: render, clear: clear };
        }

        function composePage(reverse) {
            if (entering) return;
            if (reverse) showPortal();
            entering = true;
            var raf = 0;
            var done = false;
            var scene = null;

            function complete(commit) {
                if (done) return;
                done = true;
                entering = false;
                if (raf) window.cancelAnimationFrame(raf);
                raf = 0;
                if (scene) scene.clear();
                root.classList.remove("fluid-composing");
                if (reverse) showPortal();
                else showArticles();
                endScene = null;
                if (commit) {
                    window.history.pushState({ fluidPortal: !reverse }, "", reverse ? homePath : "#articles");
                    (reverse ? orb : main).focus({ preventScroll: true });
                }
            }
            endScene = complete;
            if (!wide.matches || !fine.matches || !window.FluidInk || !window.requestAnimationFrame) {
                complete(true);
                return;
            }

            root.classList.add("fluid-composing");
            scene = buildScene();
            var duration = reverse ? RECALL : ENTER;
            var start = null;
            function frame(now) {
                if (start === null) start = now;
                var k = Math.min(1, (now - start) / duration);
                scene.render(reverse ? 1 - k : k);
                if (k < 1) raf = window.requestAnimationFrame(frame);
                else {
                    raf = 0;
                    complete(true);
                }
            }
            scene.render(reverse ? 1 : 0);
            raf = window.requestAnimationFrame(frame);
        }


        orb.addEventListener("click", function () {
            if (root.classList.contains("fluid-portal-active")) composePage(false);
        });
        var homeLink = document.querySelector(".logo > a");
        if (homeLink) homeLink.addEventListener("click", function (event) {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            if (!root.classList.contains("fluid-portal-active")) composePage(true);
        });
        function settle() {
            if (endScene) endScene(true);
        }
        window.addEventListener("resize", settle);
        document.addEventListener("visibilitychange", function () {
            if (document.hidden) settle();
        });

        function syncLocation() {
            if (endScene) endScene(false);
            if (window.location.hash) showArticles();
            else showPortal();
        }
        window.addEventListener("popstate", syncLocation);
        window.addEventListener("hashchange", syncLocation);
    });
})();
