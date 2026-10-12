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
        var rects = cards.map(function (card) { return card.getBoundingClientRect(); });
        var guideWidth = parseFloat(window.getComputedStyle(guide).width) || 28;
        var center = narrow.matches ? 16 : box.width / 2;
        var bend = narrow.matches ? 2 : 8;
        if (!narrow.matches && rects.length > 1) {
            var left = Math.max.apply(null, rects.filter(function (_, i) { return i % 2 === 0; }).map(function (rect) { return rect.right - box.left; }));
            var right = Math.min.apply(null, rects.filter(function (_, i) { return i % 2 === 1; }).map(function (rect) { return rect.left - box.left; }));
            center = (left + right) / 2;
            bend = Math.min(bend, Math.max(0, (right - left - guideWidth) / 2 - 8));
        }
        // One long wave: card titles mark stops without forcing a turn at each stop.
        function wave(y) {
            var half = Math.floor(y / 320), t = y / 320 - half;
            var side = half % 2 ? bend : -bend;
            return { x: center + side * (1 - 2 * t * t * (3 - 2 * t)), slope: -side * 12 * t * (1 - t) / 320 };
        }
        var y = 0, point = wave(y), path = "M " + point.x + " 0";
        function append(ny) {
            var next = wave(ny), third = (ny - y) / 3;
            path += " C " + (point.x + point.slope * third) + " " + (y + third) + " " + (next.x - next.slope * third) + " " + (ny - third) + " " + next.x + " " + ny;
            y = ny; point = next;
        }
        function extend(ny) {
            for (var turn = (Math.floor(y / 320) + 1) * 320; turn < ny; turn += 320) append(turn);
            if (ny > y) append(ny);
        }
        stops = rects.map(function (rect) {
            var ny = rect.top - box.top + 42;
            extend(ny);
            ruler.setAttribute("d", path);
            return { x: point.x, y: ny, distance: ruler.getTotalLength() };
        });
        extend(Math.max(y, box.height - guideWidth / 2));
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
