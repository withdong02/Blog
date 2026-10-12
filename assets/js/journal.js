/* Content is visible first. Motion never owns navigation or scrolling. */
(function () {
    "use strict";
    var home = document.querySelector(".journal-home");
    if (!home || !home.animate) return;
    var motions = new Set();
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    function stop() {
        motions.forEach(function (motion) { motion.cancel(); });
        motions.clear();
    }
    function enter() {
        stop();
        if (document.hidden || reduced.matches || document.documentElement.classList.contains("echo-article-returning")) return;
        var beats = [
            [".home-info", { opacity: .6 }, 700, 0],
            [".echo-atlas", { opacity: .7 }, 700, 70]
        ];
        beats.forEach(function (beat) {
            var element = home.querySelector(beat[0]);
            if (!element || element.getBoundingClientRect().top >= window.innerHeight) return;
            var motion = element.animate([beat[1], { opacity: 1, transform: "none" }], {
                duration: beat[2], delay: beat[3], easing: "cubic-bezier(.16, 1, .3, 1)"
            });
            motions.add(motion);
            motion.finished.then(function () { motions.delete(motion); }, function () { motions.delete(motion); });
        });
    }
    window.addEventListener("pagehide", stop);
    window.addEventListener("resize", stop);
    window.addEventListener("pageshow", function (event) { if (event.persisted) stop(); });
    document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); });
    if (reduced.addEventListener) reduced.addEventListener("change", stop);
    enter();
})();
