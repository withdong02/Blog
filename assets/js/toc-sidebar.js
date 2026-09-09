/* Project: minimal right-edge section rail.
 * One tick per article heading; the current section is solid and a marker
 * glides to it while scrolling, ticks fade with their distance from it, and
 * clicking a tick jumps to that section (PaperMod's global smooth-scroll
 * handles the jump). Hover, touch, or keyboard focus brings the full rail back.
 * The tick gap is fitted to the viewport so long outlines stay on screen, and a
 * thin top bar reports overall reading progress.
 * Without JS the rail stays hidden and PaperMod's inline <details class="toc">
 * remains the fallback entry. No dependencies; safe to load with defer.
 */
(function () {
    "use strict";

    var post = document.querySelector("article.post-single .post-content");
    var rail = document.getElementById("toc-rail");
    if (!post || !rail) return;

    var ticks = rail.querySelectorAll(".toc-tick");
    if (!ticks.length) return;

    /* article headings must carry ids matching the tick hrefs */
    var headings = Array.prototype.filter.call(
        post.querySelectorAll("h2, h3, h4, h5, h6"),
        function (h) { return h.id; }
    );
    if (!headings.length) return;

    /* Hugo's fragment ids arrive percent-encoded in the href while the DOM ids
       are literal, so decode them once up front */
    var tickIds = [];
    for (var t = 0; t < ticks.length; t++) {
        var href = ticks[t].getAttribute("href") || "";
        try { tickIds.push(decodeURIComponent(href.slice(1))); }
        catch (e) { tickIds.push(href.slice(1)); }
    }

    var root = document.documentElement;
    root.classList.add("toc-enhanced"); /* hides the inline <details> TOC */
    root.classList.add("toc-rail-ready");

    /* thin top reading-progress bar */
    var bar = document.createElement("div");
    bar.className = "toc-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);

    /* marker that glides between ticks */
    var marker = document.createElement("span");
    marker.className = "toc-rail-marker";
    marker.setAttribute("aria-hidden", "true");
    rail.appendChild(marker);

    /* fit the tick gap to the viewport so long outlines stay on screen */
    function fitGap() {
        var n = ticks.length;
        if (n < 2) return;
        var gap = (Math.min(window.innerHeight * 0.62, 460) - n * 2) / (n - 1);
        rail.style.setProperty("--toc-tick-gap", Math.max(3, Math.min(14, Math.round(gap))) + "px");
    }

    /* current section: the last heading that has scrolled past HEADROOM */
    var HEADROOM = 120;

    function currentId() {
        var limit = window.pageYOffset + HEADROOM;
        var active = null;
        for (var i = 0; i < headings.length; i++) {
            if (headings[i].getBoundingClientRect().top + window.pageYOffset > limit) break;
            active = headings[i].id;
        }
        return active;
    }

    var lastId = null;
    function updateActive(force) {
        var id = currentId();
        if (!force && id === lastId) return;
        lastId = id;

        var activeIndex = -1;
        for (var i = 0; i < ticks.length; i++) {
            if (id && tickIds[i] === id) activeIndex = i;
            ticks[i].classList.toggle("toc-active", i === activeIndex);
            /* distance drives the fade-out of far ticks */
            ticks[i].style.setProperty("--tick-dist", activeIndex < 0 ? 0 : Math.abs(i - activeIndex));
        }

        if (activeIndex < 0) {
            marker.style.opacity = "0";
        } else {
            marker.style.transform = "translateY(" + ticks[activeIndex].offsetTop + "px)";
            marker.style.opacity = "1";
        }
    }

    /* progress + active, throttled to one frame */
    var ticking = false;
    function update(force) {
        var max = root.scrollHeight - window.innerHeight;
        var p = max > 0 ? Math.min(1, Math.max(0, window.pageYOffset / max)) : 0;
        bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
        updateActive(force);
    }
    function onScroll() {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () {
            update();
            ticking = false;
        });
    }

    var resizeTimer;
    window.addEventListener("resize", function () {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(function () {
            fitGap();
            update(true); /* gap changed → re-place the marker */
        }, 150);
    }, { passive: true });

    /* touch has no hover: touching the rail reveals it, then DSH's linger keeps
       it visible for a moment after the finger lifts */
    var revealTimer;
    function scheduleRailHide() {
        window.clearTimeout(revealTimer);
        revealTimer = window.setTimeout(function () {
            rail.classList.remove("toc-rail-reveal");
        }, 2000);
    }
    rail.addEventListener("pointerdown", function () {
        rail.classList.add("toc-rail-reveal");
        window.clearTimeout(revealTimer);
    }, { passive: true });
    window.addEventListener("pointerup", scheduleRailHide, { passive: true });
    window.addEventListener("pointercancel", scheduleRailHide, { passive: true });

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("load", function () {
        fitGap();
        update(true);
    });

    fitGap();
    update(true);
})();
