(function () {
    "use strict";
    var atlas = document.querySelector(".echo-atlas");
    if (!atlas) return;
    var landscape = atlas.querySelector(".echo-atlas-landscape");
    var cards = Array.from(atlas.querySelectorAll(".post-entry"));
    if (!cards.length) return;
    var route = atlas.querySelector(".echo-atlas-route");
    var trail = atlas.querySelector(".echo-atlas-trail");
    var guide = atlas.querySelector(".echo-atlas-guide");
    var ruler = document.createElementNS("http://www.w3.org/2000/svg", "path");
    var stops = [], selected = -1, motion = null, frame = 0;
    var fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    var narrow = window.matchMedia("(max-width: 799px)");
    var followsPath = window.CSS && window.CSS.supports("offset-path", 'path("M 0 0 L 1 1")');

    function cancel() {
        if (motion) { motion.cancel(); motion = null; }
    }
    function place(index, animate) {
        if (!stops.length) return;
        var stop = stops[Math.max(0, index)];
        var from = window.getComputedStyle(guide).offsetDistance;
        cancel();
        if (followsPath) {
            guide.style.offsetDistance = stop.distance + "px";
            if (animate && guide.animate) {
                var flight = guide.animate([{ offsetDistance: from }, { offsetDistance: stop.distance + "px" }], {
                    duration: 950, easing: "cubic-bezier(.4, 0, .2, 1)"
                });
                motion = flight;
                flight.finished.then(function () { if (motion === flight) motion = null; }, function () {});
            }
        } else {
            guide.style.transform = "translate(" + stop.x + "px," + stop.y + "px) translate(-50%, -50%)";
        }
    }
    function measure() {
        frame = 0;
        cancel();
        var box = landscape.getBoundingClientRect();
        if (!box.width) { guide.hidden = true; return; }
        var x = narrow.matches ? 22 : box.width / 2;
        var y = 0, path = "M " + x + " " + y;
        stops = cards.map(function (card, index) {
            var rect = card.getBoundingClientRect();
            var nx = narrow.matches ? index % 2 ? 26 : 18 : index % 2 ? rect.left - box.left - 32 : rect.right - box.left + 32;
            var ny = rect.top - box.top + 42;
            var middle = (y + ny) / 2;
            path += " C " + x + " " + middle + " " + nx + " " + middle + " " + nx + " " + ny;
            ruler.setAttribute("d", path);
            x = nx; y = ny;
            return { x: nx, y: ny, distance: ruler.getTotalLength() };
        });
        route.setAttribute("viewBox", "0 0 " + box.width + " " + box.height);
        trail.setAttribute("d", path);
        if (followsPath) guide.style.offsetPath = 'path("' + path + '")';
        guide.hidden = document.documentElement.classList.contains("fluid-portal-active");
        place(selected, false);
    }
    function schedule() {
        if (!frame && !document.hidden) frame = window.requestAnimationFrame(measure);
    }
    function choose(index) {
        if (document.hidden || document.documentElement.classList.contains("fluid-portal-active")) return;
        if (index !== selected) {
            if (selected >= 0) cards[selected].classList.remove("echo-atlas-current");
            selected = index;
            cards[index].classList.add("echo-atlas-current");
            place(index, true);
        }
    }
    cards.forEach(function (card, index) {
        card.addEventListener("pointerenter", function () { if (fine.matches) choose(index); });
        card.addEventListener("focusin", function () { choose(index); });
    });
    window.addEventListener("resize", schedule);
    window.addEventListener("pageshow", schedule);
    window.addEventListener("fluid-portal-change", function () {
        suspend();
        guide.hidden = document.documentElement.classList.contains("fluid-portal-active");
        if (!guide.hidden) schedule();
    });
    function suspend() {
        cancel();
        window.cancelAnimationFrame(frame); frame = 0;
    }
    window.addEventListener("pagehide", suspend);
    document.addEventListener("visibilitychange", function () { if (document.hidden) suspend(); else schedule(); });
    if (window.ResizeObserver) new window.ResizeObserver(schedule).observe(landscape);
    measure();
})();
