/* Native links remain native; only the snapshots carry the paper and Echo. */
(function () {
    "use strict";
    var root = document.documentElement;
    var script = document.currentScript;
    var postsPath = script.getAttribute("data-posts-path") || "/posts/";
    var named = [];
    var revision = 0;
    var poolId = 0;

    function decorate() {
        var mark = document.querySelector(".logo .fluid-mark");
        if (!mark) return;
        document.querySelectorAll(".post-entry").forEach(function (card) {
            if (card.querySelector(".echo-card-mark")) return;
            var link = card.querySelector(".entry-link");
            if (!link || !new URL(link.href).pathname.startsWith(postsPath)) return;
            var clone = mark.cloneNode(true);
            clone.classList.add("echo-card-mark");
            clone.setAttribute("aria-hidden", "true");
            clone.setAttribute("focusable", "false");
            var body = clone.querySelector(".fluid-mark-body");
            if (body) {
                var id = "echo-card-pool-" + (++poolId);
                // The body keeps its silhouette as it passes below the SVG's waterline.
                clone.insertAdjacentHTML("afterbegin", '<defs><filter id="' + id +
                    '" filterUnits="userSpaceOnUse" x="-40" y="-40" width="630" height="1120" color-interpolation-filters="sRGB">' +
                    '<feGaussianBlur stdDeviation="12"/><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 16 -7"/>' +
                    '</filter></defs><g class="echo-card-goo" filter="url(#' + id + ')">' +
                    '<ellipse cx="250" cy="500" rx="155" ry="23"/></g>');
                clone.querySelector(".echo-card-goo").appendChild(body);
            }
            card.appendChild(clone);
        });
    }

    function clear() {
        revision++;
        named.forEach(function (el) {
            el.style.removeProperty("view-transition-name");
            el.classList.remove("echo-paper-active");
        });
        named = [];
        root.classList.remove("echo-article-opening", "echo-article-returning");
    }

    function visible(el) {
        if (!el) return false;
        var r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
    }

    function cardFor(url) {
        return Array.from(document.querySelectorAll(".post-entry")).find(function (card) {
            var link = card.querySelector(".entry-link");
            return link && new URL(link.href).href === url.origin + url.pathname + url.search;
        });
    }

    function participate(vt, other, outgoing) {
        clear();
        decorate();
        var url;
        try { url = new URL(other); } catch (_) { vt.skipTransition(); return; }
        if (url.origin !== window.location.origin) { vt.skipTransition(); return; }
        var article = document.querySelector(".post-single.echo-article");
        var card = article ? null : cardFor(url);
        var sheet = article ? article.querySelector(".post-header") : card;
        var title = sheet && sheet.querySelector(article ? ".post-title" : ".entry-header h2");
        if (!visible(title) || (card && url.hash) ||
            (article && window.location.hash)) {
            vt.skipTransition(); return;
        }
        // An article-to-article navigation has no corresponding list card.
        if (article && url.pathname.startsWith(postsPath) && url.pathname !== postsPath) {
            vt.skipTransition(); return;
        }
        var opening = outgoing ? !!card : !!article;
        root.classList.add(opening ? "echo-article-opening" : "echo-article-returning");
        sheet.classList.add("echo-paper-active");
        [sheet, title, sheet.querySelector(article ? ".echo-article-mark" : ".echo-card-mark")].forEach(function (el, index) {
            if (!el) return;
            el.style.viewTransitionName = ["echo-paper", "echo-title", "echo-reader"][index];
            named.push(el);
        });
        // Outbound ready rejects when the old document is hidden; always observe it.
        var owner = revision;
        vt.ready.then(function () {
            if (!outgoing && owner === revision) {
                named.forEach(function (el) { el.style.removeProperty("view-transition-name"); });
            }
        }, function () {});
        function finish() { if (owner === revision) clear(); }
        vt.finished.then(finish, finish);
    }

    document.addEventListener("DOMContentLoaded", decorate);
    window.addEventListener("pageshow", function () {
        // A cold page can finish loading after its first rendered frame.
        if (!named.length) clear();
        decorate();
    });
    window.addEventListener("pagehide", clear);
    document.addEventListener("visibilitychange", function () { if (document.hidden) clear(); });
    if (!("onpageswap" in window) || !("onpagereveal" in window) || !window.navigation) return;
    window.addEventListener("pageswap", function (event) {
        if (event.viewTransition) participate(event.viewTransition, event.activation && event.activation.entry.url, true);
    });
    window.addEventListener("pagereveal", function (event) {
        if (event.viewTransition) {
            var activation = window.navigation.activation;
            participate(event.viewTransition, activation && activation.from && activation.from.url, false);
        }
    });
})();
