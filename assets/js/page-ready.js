/* Critical first-viewport readiness, with a hard escape from slow resources. */
(function () {
    "use strict";
    var root = document.documentElement;
    var done = false, raf = 0, locked = [];
    var resolveReady;
    var gate = window.EchoReady = {
        done: false,
        prepare: null,
        cancelPrepare: null,
        ready: new Promise(function (resolve) { resolveReady = resolve; })
    };
    root.classList.add("echo-loading");
    var timeout = window.setTimeout(function () { finish(true); }, 3500);

    function finish(cancel) {
        if (done) return;
        done = gate.done = true;
        if (cancel && gate.cancelPrepare) gate.cancelPrepare();
        window.clearTimeout(timeout);
        if (raf) window.cancelAnimationFrame(raf);
        raf = 0;
        root.classList.remove("echo-loading");
        var portal = root.classList.contains("fluid-portal-active");
        locked.forEach(function (item) { item.node.inert = (portal && item.node.id !== "fluid-portal") || item.inert; });
        locked = [];
        var loader = document.getElementById("echo-loader");
        if (loader) loader.hidden = true;
        resolveReady();
    }
    function painted() {
        return new Promise(function (resolve) {
            if (!window.requestAnimationFrame || done || document.hidden) { resolve(); return; }
            raf = window.requestAnimationFrame(function () {
                raf = window.requestAnimationFrame(function () { raf = 0; resolve(); });
            });
        });
    }
    document.addEventListener("DOMContentLoaded", function () {
        if (done) return;
        Array.prototype.forEach.call(document.querySelectorAll(".header, #main, .footer, .reading-tools, .fluid-portal"), function (node) {
            locked.push({ node: node, inert: node.inert });
            node.inert = true;
        });
        var resources = [document.fonts ? document.fonts.ready : Promise.resolve()];
        Array.prototype.forEach.call(document.querySelectorAll("img"), function (image) {
            var box = image.getBoundingClientRect();
            if (box.bottom <= 0 || box.top >= window.innerHeight || !box.width) return;
            if (image.decode) resources.push(image.decode().catch(function () {}));
        });
        Promise.all(resources).then(painted).then(function () {
            if (!done && gate.prepare) return gate.prepare();
        }).then(function () { finish(); }, function () { finish(true); });
    });
    window.addEventListener("pagereveal", function (event) { if (event.viewTransition) finish(true); });
    window.addEventListener("pagehide", function () { finish(true); });
    window.addEventListener("pageshow", function (event) { if (event.persisted) finish(true); });
    document.addEventListener("visibilitychange", function () { if (document.hidden) finish(true); });
})();
