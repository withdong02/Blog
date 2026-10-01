/* Project: right-edge section rail — behaviour ported from the DSH turn
 * navigator (@deepseek-ai/dsh-client-ui-chat, TurnNavigator.js).
 *
 * Mirrored 1:1 from the source:
 *   TURN_SPACING_PX / RAIL_INSET_PX / FADE_PX constant pitch and insets
 *   itemAtPointer      the pointer's Y is mapped to the nearest index; the rail
 *                      as a whole is the target, the marks are not
 *   follow             when the active mark leaves the comfortable band the
 *                      column scrolls it back in, unless a pointer is on the rail
 *   railScrollState    edge-fade classes derived from the scroll position
 *   preview            pointer position picks the mark; the panel shows the
 *                      heading plus an excerpt of its section
 *
 * Layout is CSS's job (see toc-sidebar.css): this script only writes --toc-i,
 * --toc-count and the active/preview/fade classes.
 *
 * Without JS, or with fewer than two headings, none of this runs and the rail
 * stays display:none — the collapsed <details class="toc"> block above the
 * article is the outline.
 */
(function () {
    "use strict";

    var post = document.querySelector("article.post-single .post-content");
    var rail = document.getElementById("toc-rail");
    if (!post || !rail) return;

    var scroller = rail.querySelector(".toc-rail-scroller");
    var preview = rail.querySelector(".toc-rail-preview");
    var previewTitle = rail.querySelector(".toc-preview-title");
    var previewBody = rail.querySelector(".toc-preview-body");
    var ticks = Array.prototype.slice.call(rail.querySelectorAll(".toc-tick"));
    var rows = rail.querySelectorAll(".toc-tick-pos");

    /* DSH: `if (items.length < 2) return null` */
    if (!scroller || ticks.length < 2) return;

    /* Hugo emits fragment ids percent-encoded in the href while DOM ids are
       literal, so decode once up front. */
    var headings = ticks.map(function (tick) {
        var href = tick.getAttribute("href") || "";
        var id = href.slice(1);
        try { id = decodeURIComponent(id); } catch (e) { /* keep the raw id */ }
        return document.getElementById(id);
    });

    /* A mark with no heading would break the index arithmetic below; leave the
       rail hidden rather than show one that points nowhere. */
    for (var h = 0; h < headings.length; h++) {
        if (!headings[h]) return;
    }

    /* --- geometry, copied from TurnNavigator.js --- */
    var PITCH = 10;      /* TURN_SPACING_PX */
    var INSET = 6;       /* RAIL_INSET_PX  */
    var FADE = 24;       /* FADE_PX        */
    var HEADROOM = 120;  /* scroll offset that counts as "this heading has passed" */

    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* --- progress bar --- */
    var bar = document.createElement("div");
    bar.className = "toc-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);

    /* Position the rows and size the column, then reveal. All of it before the
       class lands so the rail never paints in a half-built state. */
    for (var r = 0; r < rows.length; r++) rows[r].style.setProperty("--toc-i", r);
    rail.style.setProperty("--toc-count", rows.length);
    document.documentElement.classList.add("toc-rail-ready");

    function markTop(index) {
        return index * PITCH + INSET;
    }

    /* --- edge fades (DSH railScrollState + syncScrollState) --- */
    var lastTop = -1;
    var lastUp = null;
    var lastDown = null;

    function syncScrollState() {
        var top = scroller.scrollTop;
        var up = top > 1;
        var down = top < scroller.scrollHeight - scroller.clientHeight - 1;
        if (top === lastTop && up === lastUp && down === lastDown) return;
        lastTop = top;
        lastUp = up;
        lastDown = down;
        scroller.classList.toggle("toc-fade-top", up);
        scroller.classList.toggle("toc-fade-bottom", down);
        if (previewIndex >= 0) placePreview(previewIndex);
    }

    /* --- active section --- */
    var activeIndex = -1;

    function currentIndex() {
        var limit = window.pageYOffset + HEADROOM;
        var active = 0;
        for (var i = 0; i < headings.length; i++) {
            if (headings[i].getBoundingClientRect().top + window.pageYOffset > limit) break;
            active = i;
        }
        /* A heading near the end of the document can never reach the headroom
           line — the page runs out of scroll first, so the section the reader is
           looking at would never light up. At the bottom, the last one is it. */
        var max = document.documentElement.scrollHeight - window.innerHeight;
        if (max > 0 && window.pageYOffset >= max - 1) active = headings.length - 1;
        return active;
    }

    /* DSH follow(): only scroll when the mark would sit inside a fade band */
    function follow(index) {
        var viewTop = scroller.scrollTop;
        var viewHeight = scroller.clientHeight;
        if (viewHeight <= 0) return;
        var top = markTop(index);
        if (top >= viewTop + FADE && top <= viewTop + viewHeight - FADE) return;
        var target = Math.max(0, top - viewHeight / 2);
        if (typeof scroller.scrollTo === "function") {
            scroller.scrollTo({ top: target, behavior: reduced ? "auto" : "smooth" });
        } else {
            scroller.scrollTop = target;
        }
        syncScrollState();
    }

    function updateActive(force) {
        var index = currentIndex();
        if (!force && index === activeIndex) return;
        activeIndex = index;
        for (var i = 0; i < ticks.length; i++) {
            var on = i === index;
            ticks[i].classList.toggle("toc-active", on);
            if (on) ticks[i].setAttribute("aria-current", "true");
            else ticks[i].removeAttribute("aria-current");
        }
        /* While the pointer works the rail, follow must not move it under the hand. */
        if (!pointerInside) follow(index);
    }

    /* --- pointer: the rail is the target (DSH itemAtPointer) --- */
    var pointerInside = false;
    var previewIndex = -1;

    function itemAtPointer(clientY) {
        var offset = clientY - rail.getBoundingClientRect().top + scroller.scrollTop - INSET;
        var index = Math.round(offset / PITCH);
        return Math.max(0, Math.min(ticks.length - 1, index));
    }

    function placePreview(index) {
        rail.style.setProperty("--toc-hover-pos", (markTop(index) - scroller.scrollTop) + "px");
    }

    /* The excerpt is the blog's stand-in for DSH's response line: the text of
       the section the heading opens. A heading whose next sibling is a deeper
       heading has no text of its own, so descend past those until the section
       is really left (the next heading at the same level or shallower).
       Computed once per mark. */
    var excerpts = {};

    function excerptFor(index) {
        if (excerpts[index] !== undefined) return excerpts[index];
        var level = parseInt(headings[index].tagName.slice(1), 10);
        var text = "";
        var node = headings[index].nextElementSibling;
        while (node) {
            if (/^H[1-6]$/.test(node.tagName)) {
                if (parseInt(node.tagName.slice(1), 10) <= level) break;
                node = node.nextElementSibling;
                continue;
            }
            text += " " + (node.textContent || "");
            if (text.length > 240) break;
            node = node.nextElementSibling;
        }
        excerpts[index] = text.replace(/\s+/g, " ").trim();
        return excerpts[index];
    }

    function showPreview(index) {
        if (index === previewIndex) return;
        previewIndex = index;
        for (var i = 0; i < ticks.length; i++) {
            ticks[i].classList.toggle("toc-preview", i === index);
            if (i === index) ticks[i].setAttribute("aria-describedby", "toc-rail-preview");
            else ticks[i].removeAttribute("aria-describedby");
        }
        if (!preview) return;
        /* aria-label is the Hugo fragment title run through plainify, so it is
           free of the anchored-heading "#" link and of inline markup. */
        previewTitle.textContent = ticks[index].getAttribute("aria-label") || "";
        previewBody.textContent = excerptFor(index);
        preview.hidden = false;
        placePreview(index);
    }

    function hidePreview() {
        if (previewIndex < 0) return;
        previewIndex = -1;
        for (var i = 0; i < ticks.length; i++) {
            ticks[i].classList.remove("toc-preview");
            ticks[i].removeAttribute("aria-describedby");
        }
        if (preview) preview.hidden = true;
    }

    function navigateAt(index) {
        /* Reuse the site-wide hash handler bound in layouts/partials/footer.html
           (smooth scroll + pushState). bubbles:false keeps it from reaching this
           rail's own click handler. */
        ticks[index].dispatchEvent(new MouseEvent("click", { bubbles: false, cancelable: true }));
    }

    rail.addEventListener("pointermove", function (event) {
        showPreview(itemAtPointer(event.clientY));
    });
    rail.addEventListener("pointerenter", function () {
        pointerInside = true;
    });
    rail.addEventListener("pointerleave", function () {
        pointerInside = false;
        hidePreview();
    });
    rail.addEventListener("click", function (event) {
        navigateAt(itemAtPointer(event.clientY));
    });

    /* Keyboard: focusing a mark previews it, exactly as DSH does. */
    ticks.forEach(function (tick, index) {
        tick.addEventListener("focus", function () { showPreview(index); });
        tick.addEventListener("blur", hidePreview);
    });

    /* --- progress ---
       The bar is also the ink line the reading mark drags behind it (scenario D
       in DESIGN.md), so it exposes a hook instead of hiding the
       number: the attachment has to write the same value on the same clock —
       with its CSS transition left on, the line would glide towards the target
       while the mark jumped straight to it, and the mark would run ahead of the
       line. `drive(true)` hands the writing over; `drive(false)` takes it back. */
    var progress = 0;
    var driver = null;
    var progressListeners = [];

    function paint(p) {
        bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
    }

    function updateProgress() {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        progress = max > 0 ? Math.min(1, Math.max(0, window.pageYOffset / max)) : 0;
        if (!driver) paint(progress);
        for (var i = 0; i < progressListeners.length; i++) progressListeners[i](progress);
    }

    window.TocRail = {
        bar: bar,
        value: function () { return progress; },
        onProgress: function (fn) {
            progressListeners.push(fn);
            fn(progress);
        },
        /* `true` hands the writing over to the caller, `false` takes it back.
           The transition is what the owner replaces: one clock, not two. */
        drive: function (on) {
            var owned = !!on;
            if (owned === !!driver) return;
            driver = owned;
            bar.classList.toggle("toc-progress-fluid", owned);
            if (!owned) paint(progress);
        }
    };

    var ticking = false;
    window.addEventListener("scroll", function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () {
            updateProgress();
            updateActive(false);
            ticking = false;
        });
    }, { passive: true });

    scroller.addEventListener("scroll", syncScrollState, { passive: true });

    if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(syncScrollState).observe(scroller);
    }

    var resizeTimer;
    window.addEventListener("resize", function () {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(function () {
            syncScrollState();
            updateActive(true);
        }, 150);
    }, { passive: true });

    window.addEventListener("load", function () {
        syncScrollState();
        updateActive(true);
    });

    syncScrollState();
    updateActive(true);
    updateProgress();
})();
