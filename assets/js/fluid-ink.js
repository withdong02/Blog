/* Shared ink primitives for the fluid character — see DESIGN.md.
 *
 * Geometry only, no timers: every scene owns one finite rAF timeline and calls
 * these helpers per frame. Colours are never decided here; callers pass the
 * element's own computed colour or rely on theme variables in CSS.
 */
(function () {
    "use strict";

    var SVG_NS = "http://www.w3.org/2000/svg";

    function clamp01(x) {
        return x < 0 ? 0 : x > 1 ? 1 : x;
    }

    function ease(x) {
        x = clamp01(x);
        return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(2 - 2 * x, 3) / 2;
    }

    function smooth(x) {
        x = clamp01(x);
        return x * x * (3 - 2 * x);
    }

    /* Outline of one ink blob as n points. rx/ry are half-extents along
       `angle`; square 1 is an ellipse, lower values flatten it towards a
       rounded band. The ripple is measured in screen directions, so changing
       `angle` on a round blob never makes its outline jump. amp is the ripple
       amplitude in the caller's units (the blob radius gives a lively echo,
       a pixel or two a calm band). */
    function blob(cx, cy, rx, ry, angle, phase, amp, square, n) {
        var cos = Math.cos(angle);
        var sin = Math.sin(angle);
        var points = [];
        for (var i = 0; i < n; i++) {
            var a = i * 2 * Math.PI / n;
            var c = Math.cos(a);
            var s = Math.sin(a);
            var bx = rx * (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), square);
            var by = ry * (s < 0 ? -1 : 1) * Math.pow(Math.abs(s), square);
            var len = Math.sqrt(bx * bx + by * by) || 1;
            var g = a + angle;
            var ripple = amp * (0.13 * Math.sin(3 * g + phase) + 0.08 * Math.cos(5 * g - phase * 0.7));
            bx += bx / len * ripple;
            by += by / len * ripple;
            points.push([cx + bx * cos - by * sin, cy + bx * sin + by * cos]);
        }
        return points;
    }

    /* Closed curve through the midpoints, every point an off-curve control
       point, so the outline never shows a corner. map converts each point
       (e.g. screen pixels into an SVG's user units). */
    function path(points, map) {
        if (!points.length) return "";
        var p = map ? points.map(map) : points;
        function mid(from, to) {
            return ((from[0] + to[0]) / 2).toFixed(1) + " " + ((from[1] + to[1]) / 2).toFixed(1);
        }
        var d = "M " + mid(p[p.length - 1], p[0]);
        for (var i = 0; i < p.length; i++) {
            d += " Q " + p[i][0].toFixed(1) + " " + p[i][1].toFixed(1) + " " + mid(p[i], p[(i + 1) % p.length]);
        }
        return d + " Z";
    }

    /* Union of what is actually inked inside an element: its text runs and
       its icons, not the padding of its box. Falls back to the box. */
    function inkRect(el) {
        var box = null;
        function add(r) {
            if (r.width < 1 || r.height < 1) return;
            if (!box) box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
            else {
                box.left = Math.min(box.left, r.left);
                box.top = Math.min(box.top, r.top);
                box.right = Math.max(box.right, r.right);
                box.bottom = Math.max(box.bottom, r.bottom);
            }
        }
        var range = document.createRange();
        var walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
        for (var node = walker.nextNode(); node; node = walker.nextNode()) {
            if (node.nodeType === 3) {
                if (!node.nodeValue.trim() || node.parentNode.closest("svg")) continue;
                range.selectNodeContents(node);
                Array.prototype.forEach.call(range.getClientRects(), add);
            } else if (/^(svg|img)$/i.test(node.tagName)) {
                add(node.getBoundingClientRect());
            }
        }
        if (!box) {
            var r = el.getBoundingClientRect();
            box = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        }
        box.width = box.right - box.left;
        box.height = box.bottom - box.top;
        return box;
    }

    /* Element <-> ink. A temporary threshold filter on the real element:
       m = 0 melts it into one blob of its own colour, m = 1 is the untouched
       element (the filter is dropped entirely). Text is dilated first, in
       proportion to its size, so glyphs and punctuation gaps pool into one
       band instead of a dotted row; solid shapes keep their true edge. */
    var defs = null;
    var serial = 0;

    function melt(el, options) {
        var solid = options && options.solid;
        var size = parseFloat(window.getComputedStyle(el).fontSize) || 16;
        var grow = solid ? 0 : size * 0.3;
        var sigma = solid ? 6 : size * 0.25;
        var cut = solid ? 10 : 3;
        if (!defs || !defs.isConnected) {
            defs = document.createElementNS(SVG_NS, "svg");
            defs.setAttribute("class", "fluid-ink-defs");
            defs.setAttribute("aria-hidden", "true");
            defs.setAttribute("width", "0");
            defs.setAttribute("height", "0");
            defs.style.position = "absolute";
            document.body.appendChild(defs);
        }
        var box = el.getBoundingClientRect();
        var pad = Math.ceil(grow + sigma * 3);
        var id = "fluid-melt-" + (++serial);
        var filter = document.createElementNS(SVG_NS, "filter");
        filter.setAttribute("id", id);
        filter.setAttribute("filterUnits", "userSpaceOnUse");
        filter.setAttribute("x", -pad);
        filter.setAttribute("y", -pad);
        filter.setAttribute("width", Math.ceil(box.width) + 2 * pad);
        filter.setAttribute("height", Math.ceil(box.height) + 2 * pad);
        filter.setAttribute("color-interpolation-filters", "sRGB");
        var dilate = document.createElementNS(SVG_NS, "feMorphology");
        dilate.setAttribute("operator", "dilate");
        var blur = document.createElementNS(SVG_NS, "feGaussianBlur");
        var matrix = document.createElementNS(SVG_NS, "feColorMatrix");
        matrix.setAttribute("type", "matrix");
        if (grow) filter.appendChild(dilate);
        filter.appendChild(blur);
        filter.appendChild(matrix);
        defs.appendChild(filter);
        var last = null;
        return {
            set: function (m) {
                m = clamp01(m);
                var key = m.toFixed(3);
                if (key === last) return;
                last = key;
                if (m >= 1) {
                    el.style.filter = "";
                    return;
                }
                var k = 1 - m;
                var q = Math.min(1, k * 6);
                dilate.setAttribute("radius", (grow * Math.pow(k, 0.5)).toFixed(2));
                blur.setAttribute("stdDeviation", (sigma * k).toFixed(2));
                matrix.setAttribute("values", "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 " +
                    (1 + 21 * q).toFixed(2) + " " + (-cut * q).toFixed(2));
                var url = "url(#" + id + ")";
                if (el.style.filter !== url) el.style.filter = url;
            },
            // How far the melted band reaches past the glyphs, for callers
            // that draw a matching band of ink.
            grow: grow,
            remove: function () {
                el.style.filter = "";
                filter.remove();
                if (defs && !defs.firstChild) {
                    defs.remove();
                    defs = null;
                }
            }
        };
    }

    window.FluidInk = {
        SVG_NS: SVG_NS,
        clamp01: clamp01,
        ease: ease,
        smooth: smooth,
        blob: blob,
        path: path,
        inkRect: inkRect,
        melt: melt
    };
})();
