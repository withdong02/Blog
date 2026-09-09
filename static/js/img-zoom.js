/**
 * In-place click-to-zoom for article images (medium-zoom style).
 *
 * - Click a zoomable image: it smoothly scales up, centered on screen,
 *   with a dimming scrim behind it. Click the image / the scrim / press Esc
 *   (or scroll / resize) to zoom back out.
 * - Only images inside `.md-content` that are at least 200px wide and are
 *   not already wrapped in a link are zoomable, so icons/avatars and linked
 *   images keep their default behavior.
 * - Zoom is capped at the image's natural resolution (no blurry upscale).
 */
(function () {
    "use strict";

    var overlay = null;
    var zoomedImg = null;
    var closeTimer = 0;
    var CLOSE_MS = 420; // transition 350ms + margin

    // ---- helpers -------------------------------------------------------

    function ensureOverlay() {
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "img-zoom-overlay";
            overlay.addEventListener("click", close);
            var host = document.querySelector("main") || document.body;
            host.appendChild(overlay);
        }
        return overlay;
    }

    function zoomable(img) {
        if (img.closest("a")) return false; // linked images: keep normal navigation
        var r = img.getBoundingClientRect();
        return r.width >= 200; // skip small icons / avatars
    }

    // ---- zoom in / out ------------------------------------------------

    function open(img) {
        if (zoomedImg || !img.complete || !img.naturalWidth) return;

        var r = img.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return;

        var vw = document.documentElement.clientWidth;
        var vh = document.documentElement.clientHeight;
        var s = Math.min((vw - 56) / r.width, (vh - 56) / r.height);
        s = Math.min(s, img.naturalWidth / r.width, img.naturalHeight / r.height);
        if (!(s > 1.02)) return; // already at max useful size

        // Center on the image's current center, expressed in pre-scale units.
        var cx = r.left + r.width / 2;
        var cy = r.top + r.height / 2;
        var tx = (vw / 2 - cx) / s;
        var ty = (vh / 2 - cy) / s;

        var ov = ensureOverlay();
        ov.classList.add("on");
        void ov.offsetWidth; // flush so the scrim fades in

        img.classList.add("img-zoomed");
        img.style.transformOrigin = "50% 50%";
        void img.offsetWidth; // flush so the transform transition runs
        img.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + s + ")";

        zoomedImg = img;
    }

    function close() {
        if (!zoomedImg) return;
        var img = zoomedImg;
        zoomedImg = null;

        img.style.transform = ""; // animate back to the original spot

        if (overlay) overlay.classList.remove("on");

        window.clearTimeout(closeTimer);
        closeTimer = window.setTimeout(function () {
            img.classList.remove("img-zoomed");
            img.style.removeProperty("transform");
            img.style.removeProperty("transform-origin");
        }, CLOSE_MS);
    }

    // ---- global listeners (registered once) ----------------------------

    document.addEventListener("click", function (e) {
        var img = e.target && e.target.closest ? e.target.closest(".md-content img") : null;
        if (!img) return;
        if (zoomedImg === img) {
            close();
            return;
        }
        if (zoomable(img)) open(img);
    });

    window.addEventListener("keydown", function (e) {
        if (zoomedImg && e.key === "Escape") close();
    });

    // Scrolling or resizing while zoomed would detach the scaled image from
    // its scrim, so back out instead.
    window.addEventListener("scroll", function () { if (zoomedImg) close(); }, true);
    window.addEventListener("wheel", function () { if (zoomedImg) close(); }, { passive: true });
    window.addEventListener("resize", function () { if (zoomedImg) close(); });
})();
