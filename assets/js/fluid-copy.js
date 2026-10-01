/* Project: clipboard ink — scenario E of docs/design/fluid-ink.md.
 *
 * The little "copy" button on a code block turns into a blob of ink and
 * resolves into its new word: "copy" -> "copied!" -> "copy". The melting itself
 * is the shared primitive (window.FluidInk.melt); this file decides only when
 * to run it and for how long.
 *
 * It changes nothing about how PaperMod copies text. The button is entirely the
 * theme's — the theme creates it, listens for the click, writes the clipboard
 * and writes the new word. We react to that last write and nothing else: one
 * MutationObserver per button. No replacement button, no delegated click, no
 * touching what the theme put there.
 *
 * The one thing that must be true: the first frame the browser paints after the
 * word changed already shows ink rather than the new word. An observer callback
 * runs as a microtask — after the DOM write, before that paint — so setting the
 * molten state right here is exactly what keeps "copied!" from flashing legibly
 * for a frame before melting. Doing this on the next frame is too late.
 *
 * A second thing, learned from the theme's stylesheet rather than from its
 * script: the button is display:none until the pointer is over its code block,
 * and "copied!" reverts on a 2000ms timer whether or not the pointer is still
 * there. So the second change usually arrives while the button is hidden, and
 * melting a hidden element would build a zero-sized filter region. Those are
 * skipped.
 *
 * Without JavaScript, or without the right conditions, nothing is added and
 * copied text never fails to be confirmed.
 */
(function () {
    "use strict";

    var Ink = window.FluidInk;
    if (!Ink || !window.MutationObserver) return;

    var wide = window.matchMedia("(min-width: 900px)");
    var fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    var still = window.matchMedia("(prefers-reduced-motion: reduce)");

    /* How long the ink takes to resolve into the word. Shorter and it reads as
       a flicker rather than as ink; much longer and it delays the reader, who
       was only waiting to be told the copy worked. */
    var MELT_MS = 400;
    /* Start molten, but not entirely: at exactly 0 the word is a featureless
       disc with nothing left to recognise it by. This still reads as "no word
       yet", and keeps a trace of the button's shape underneath. */
    var START = 0.12;

    /* button -> { obs, melt, raf, t0, text }. A Map, not a WeakMap: everything
       in it has to be reachable so that losing the gate can clean all of it
       up, not just the ones that happen to be on screen. */
    var inks = new Map();
    var bodyWatcher = null;
    var enabled = false;

    function allowed() {
        return wide.matches && fine.matches && !still.matches;
    }

    function visible(el) {
        /* See the header: this is the ordinary case for the second change, not
           an edge case. */
        var r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    }

    function settle(state) {
        if (state.raf) {
            window.cancelAnimationFrame(state.raf);
            state.raf = 0;
        }
        if (state.melt) {
            state.melt.remove();
            state.melt = null;
        }
        state.t0 = 0;
    }

    /* Called inside the observer callback, therefore before the paint that
       would otherwise show the new word. */
    function restart(btn, state) {
        settle(state);
        var melting = Ink.melt(btn);
        state.melt = melting;
        melting.set(START);

        function frame(now) {
            if (!state.t0) state.t0 = now;
            var t = (now - state.t0) / MELT_MS;
            if (t >= 1) {
                /* set(1) is what drops the filter; remove() then takes away
                   the <filter> node itself. No layer is left behind. */
                melting.set(1);
                melting.remove();
                state.melt = null;
                state.raf = 0;
                state.t0 = 0;
                return;
            }
            melting.set(START + (1 - START) * Ink.ease(t));
            state.raf = window.requestAnimationFrame(frame);
        }
        state.raf = window.requestAnimationFrame(frame);
    }

    function changed(btn) {
        var state = inks.get(btn);
        if (!state) return;
        var text = btn.textContent;
        /* Clicking twice in a row writes "copied!" over "copied!". Same word,
           nothing for the reader to see, so no ink. */
        if (text === state.text) return;
        state.text = text;
        if (!visible(btn)) return;
        restart(btn, state);
    }

    function attach(btn) {
        if (inks.has(btn)) return;
        var state = { obs: null, melt: null, raf: 0, t0: 0, text: btn.textContent || "" };
        var obs = new window.MutationObserver(function () {
            if (enabled) changed(btn);
        });
        obs.observe(btn, { childList: true, characterData: true, subtree: true });
        state.obs = obs;
        inks.set(btn, state);
    }

    function enable() {
        if (enabled) return;
        enabled = true;
        /* Buttons made after this script ran — anything the renderer inserts
           later — are noticed once here and then given their own observer. */
        bodyWatcher = new window.MutationObserver(function (records) {
            for (var i = 0; i < records.length; i++) {
                var added = records[i].addedNodes;
                for (var j = 0; j < added.length; j++) {
                    var node = added[j];
                    if (!node || node.nodeType !== 1) continue;
                    if (node.classList && node.classList.contains("copy-code")) attach(node);
                    if (node.querySelectorAll) {
                        var found = node.querySelectorAll(".copy-code");
                        for (var q = 0; q < found.length; q++) attach(found[q]);
                    }
                }
            }
        });
        bodyWatcher.observe(document.body, { childList: true, subtree: true });
        var all = document.querySelectorAll(".copy-code");
        for (var n = 0; n < all.length; n++) attach(all[n]);
    }

    function disable() {
        if (!enabled) return;
        enabled = false;
        if (bodyWatcher) {
            bodyWatcher.disconnect();
            bodyWatcher = null;
        }
        inks.forEach(function (state) {
            if (state.obs) state.obs.disconnect();
            settle(state);
        });
        inks.clear();
    }

    function sync() {
        if (allowed()) enable();
        else disable();
    }

    [wide, fine, still].forEach(function (mql) {
        if (mql.addEventListener) mql.addEventListener("change", sync);
        else if (mql.addListener) mql.addListener(sync);
    });

    sync();
})();
