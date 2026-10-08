(function () {
    "use strict";
    var theme = document.getElementById("theme-toggle");
    var top = document.getElementById("top-link");
    var source = document.querySelector(".toc .inner");
    var root = document.documentElement;
    var tools = document.createElement("div");
    tools.className = "reading-tools";
    tools.inert = root.classList.contains("fluid-portal-active");
    tools.innerHTML = '<button class="tools-toggle" aria-label="阅读工具" aria-expanded="false" aria-controls="tools-actions"><svg class="tools-open-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.5"/><circle cx="15" cy="17" r="2.5"/></svg><svg class="tools-close-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button><div id="tools-actions" class="tools-actions" hidden></div>';
    document.body.appendChild(tools);
    var toggle = tools.querySelector("button");
    var actions = tools.querySelector(".tools-actions");
    var animateMenu, resetMenu;
    function expand(on) {
        if (!on && actions.contains(document.activeElement)) toggle.focus({ preventScroll: true });
        actions.inert = !on;
        actions.classList.toggle("is-open", on);
        root.classList.toggle("reading-tools-open", on);
        toggle.setAttribute("aria-expanded", String(on));
        if (animateMenu) animateMenu(on);
    }
    function add(control, label, slot) {
        if (!control) return;
        var wrap = document.createElement("div");
        wrap.className = "tool-slot tool-slot-" + slot;
        control.setAttribute("aria-label", label);
        control.title = label;
        wrap.appendChild(control);
        actions.appendChild(wrap);
        control.addEventListener("click", function () { expand(false); });
    }
    add(theme, "主题", "theme");
    add(top, "顶部", "top");
    if (top) top.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14M12 20V8m-6 6 6-6 6 6"/></svg>';
    toggle.addEventListener("click", function () { expand(toggle.getAttribute("aria-expanded") !== "true"); });
    document.addEventListener("click", function (e) {
        if (!tools.contains(e.target)) expand(false);
    });
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") { expand(false); toggle.focus(); }
    });
    window.addEventListener("fluid-portal-change", function () { expand(false); if (resetMenu) resetMenu(); });

    if (source && source.querySelector("a[href^='#']")) {
        var button = document.createElement("button");
        button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>';
        button.setAttribute("aria-haspopup", "dialog");
        button.setAttribute("aria-controls", "reading-outline");
        add(button, "目录", "toc");
        var panel = document.createElement("nav");
        panel.id = "reading-outline";
        panel.className = "reading-outline";
        panel.setAttribute("aria-label", "文章目录");
        panel.tabIndex = -1;
        panel.innerHTML = '<button class="outline-handle" aria-label="拖动收起目录" type="button"><span></span></button><div class="outline-header"><h2>文章目录</h2><button class="outline-close" aria-label="关闭目录">×</button></div><div class="outline-body"></div>';
        panel.querySelector(".outline-body").appendChild(source.cloneNode(true));
        var dialog = document.createElement("dialog");
        dialog.className = "outline-dialog";
        dialog.setAttribute("aria-label", "文章目录");
        document.body.appendChild(dialog);
        var wide = window.matchMedia("(min-width: 1200px) and (min-height: 480px) and (hover: hover) and (pointer: fine)");
        var links = Array.from(panel.querySelectorAll("a"));
        // The original IDs belong to the article's native outline.
        panel.querySelectorAll("[id]").forEach(function (n) { n.removeAttribute("id"); });
        var entries = links.map(function (link) {
            var id = link.hash.slice(1);
            try { id = decodeURIComponent(id); } catch (e) {}
            return { link: link, heading: document.getElementById(id) };
        });
        var rail = document.createElement("div");
        rail.className = "outline-desktop";
        var railList = document.createElement("nav");
        railList.className = "outline-rail-list";
        railList.setAttribute("aria-label", "章节快速导航");
        var preview = document.createElement("div");
        preview.className = "outline-preview";
        preview.setAttribute("aria-hidden", "true");
        preview.innerHTML = '<strong></strong><p></p>';
        document.body.appendChild(preview);
        var openTimer, closeTimer;
        function focusTicks(index) {
            rail.classList.toggle("is-interacting", index !== undefined);
            entries.forEach(function (item, i) {
                var distance = index === undefined ? Infinity : Math.abs(i - index);
                item.tick.style.setProperty("--tick-scale", distance === 0 ? "2.6" : distance === 1 ? "1.7" : distance === 2 ? "1.25" : "1");
                item.tick.style.setProperty("--tick-opacity", distance === 0 ? "1" : distance === 1 ? ".86" : distance === 2 ? ".72" : ".58");
                item.tick.classList.toggle("is-peaked", distance === 0);
            });
        }
        function hidePreview() {
            clearTimeout(openTimer); clearTimeout(closeTimer);
            preview.classList.remove("is-visible");
            focusTicks(undefined);
        }
        function showPreview(entry, index) {
            clearTimeout(openTimer); clearTimeout(closeTimer);
            focusTicks(index);
            preview.querySelector("strong").textContent = entry.link.textContent.trim();
            preview.querySelector("p").textContent = entry.summary;
            var row = entry.tick.getBoundingClientRect();
            preview.style.left = Math.max(16, row.left - 336) + "px";
            preview.classList.add("is-visible");
            preview.style.top = Math.max(16, Math.min(window.innerHeight - preview.offsetHeight - 16, row.top - 12)) + "px";
        }
        entries.forEach(function (entry, index) {
            var texts = [], next = entry.heading && entry.heading.nextElementSibling;
            while (next && !/^H[1-6]$/.test(next.tagName)) {
                if (next.tagName === "P") texts.push(next.textContent.trim());
                if (texts.join(" ").length >= 220) break;
                next = next.nextElementSibling;
            }
            var summary = texts.join(" ").replace(/\s+/g, " ");
            entry.summary = summary.length > 220 ? summary.slice(0, 217) + "…" : summary;
            var tick = document.createElement("a");
            tick.className = "outline-tick";
            tick.href = entry.link.href;
            tick.setAttribute("aria-label", entry.link.textContent.trim());
            tick.appendChild(document.createElement("span"));
            tick.addEventListener("pointerenter", function () {
                clearTimeout(openTimer); clearTimeout(closeTimer);
                focusTicks(index);
                // Move the peak immediately. Only the first card waits; sliding
                // between chapters must not collapse the rail or blink the card.
                if (preview.classList.contains("is-visible")) showPreview(entry, index);
                else openTimer = setTimeout(function () { showPreview(entry, index); }, 120);
            });
            tick.addEventListener("focus", function () { showPreview(entry, index); });
            tick.addEventListener("blur", hidePreview);
            tick.addEventListener("click", hidePreview);
            railList.appendChild(tick);
            entry.tick = tick;
        });
        rail.appendChild(railList);
        document.body.appendChild(rail);
        rail.addEventListener("pointerleave", function () {
            clearTimeout(openTimer);
            focusTicks(undefined);
            closeTimer = setTimeout(hidePreview, 80);
        });
        railList.addEventListener("scroll", hidePreview, { passive: true });
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") hidePreview();
        });
        var active;
        function track() {
            var current = entries[0];
            entries.forEach(function (entry) {
                if (entry.heading && entry.heading.getBoundingClientRect().top <= 100) current = entry;
            });
            if (current === active) return;
            active = current;
            entries.forEach(function (entry) {
                if (entry === active) entry.link.setAttribute("aria-current", "location");
                else entry.link.removeAttribute("aria-current");
                entry.tick.classList.toggle("is-current", entry === active);
                if (entry === active) entry.tick.setAttribute("aria-current", "location");
                else entry.tick.removeAttribute("aria-current");
            });
            if (wide.matches && active) {
                var railBox = railList.getBoundingClientRect();
                var tickBox = active.tick.getBoundingClientRect();
                if (tickBox.top < railBox.top) railList.scrollTop += tickBox.top - railBox.top;
                else if (tickBox.bottom > railBox.bottom) railList.scrollTop += tickBox.bottom - railBox.bottom;
            }
            if (dialog.open) reveal();
        }
        function reveal() {
            if (!active) return;
            var body = panel.querySelector(".outline-body");
            var box = body.getBoundingClientRect();
            var row = active.link.getBoundingClientRect();
            if (row.top < box.top) body.scrollTop += row.top - box.top;
            else if (row.bottom > box.bottom) body.scrollTop += row.bottom - box.bottom;
        }
        var handle = panel.querySelector(".outline-handle");
        var pull = null, sheetAnimation = null, sheetDragged = false;
        function resetSheet() {
            if (sheetAnimation) sheetAnimation.cancel();
            sheetAnimation = null;
            var pointer = pull && pull.id;
            pull = null;
            if (pointer !== null && handle.hasPointerCapture(pointer)) handle.releasePointerCapture(pointer);
            dialog.style.transform = "";
            dialog.classList.remove("is-dragging");
        }
        function settleSheet(from, dismiss) {
            resetSheet();
            if (!dialog.animate) { if (dismiss) close(); return; }
            var end = dismiss ? dialog.getBoundingClientRect().height + 24 : 0;
            var animation = dialog.animate([
                { transform: "translateY(" + from + "px)" },
                { transform: "translateY(" + end + "px)" }
            ], { duration: dismiss ? 180 : 260, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" });
            sheetAnimation = animation;
            animation.onfinish = function () {
                if (sheetAnimation !== animation) return;
                if (dismiss) close();
                else resetSheet();
            };
        }
        handle.addEventListener("pointerdown", function (e) {
            if (!dialog.open || wide.matches || e.button !== 0 || e.isPrimary === false || pull) return;
            var from = dialog.getBoundingClientRect().top;
            resetSheet();
            // A new gesture takes over the visible position of the settling sheet.
            var offset = from - dialog.getBoundingClientRect().top;
            sheetDragged = false;
            pull = { id: e.pointerId, start: e.clientY - (offset < 0 ? offset / .18 : offset), last: e.clientY, time: e.timeStamp, velocity: 0, offset: offset };
            handle.setPointerCapture(e.pointerId);
            dialog.classList.add("is-dragging");
            dialog.style.transform = "translateY(" + offset + "px)";
        });
        handle.addEventListener("pointermove", function (e) {
            if (!pull || pull.id !== e.pointerId) return;
            var elapsed = e.timeStamp - pull.time;
            if (elapsed > 0) pull.velocity = (e.clientY - pull.last) / elapsed;
            pull.last = e.clientY; pull.time = e.timeStamp;
            var distance = e.clientY - pull.start;
            if (Math.abs(distance) > 6) sheetDragged = true;
            pull.offset = distance < 0 ? distance * .18 : distance;
            dialog.style.transform = "translateY(" + pull.offset + "px)";
        });
        handle.addEventListener("pointerup", function (e) {
            if (!pull || pull.id !== e.pointerId) return;
            var dismiss = pull.offset > Math.min(120, dialog.getBoundingClientRect().height * .25)
                || (pull.offset > 24 && e.timeStamp - pull.time < 80 && pull.velocity > .6);
            settleSheet(pull.offset, dismiss);
        });
        handle.addEventListener("pointercancel", resetSheet);
        handle.addEventListener("lostpointercapture", function () { if (pull) resetSheet(); });
        handle.addEventListener("click", function (e) {
            if (sheetDragged && e.detail !== 0) { sheetDragged = false; return; }
            close();
        });
        function close() {
            resetSheet();
            if (dialog.open) dialog.close();
        }
        dialog.addEventListener("close", function () {
            resetSheet();
            root.classList.remove("outline-open");
            toggle.focus({ preventScroll: true });
        });
        dialog.addEventListener("click", function (e) { if (e.target === dialog) close(); });
        panel.querySelector(".outline-close").addEventListener("click", close);
        panel.addEventListener("click", function (e) { if (e.target.closest("a")) close(); });
        button.addEventListener("click", function () {
            track();
            hidePreview();
            dialog.showModal(); root.classList.add("outline-open"); reveal();
            if (!wide.matches) settleSheet(24, false);
        });
        function layout() {
            close();
            root.classList.toggle("outline-wide", wide.matches);
            rail.hidden = !wide.matches;
            dialog.appendChild(panel);
            panel.inert = false;
            hidePreview();
        }
        wide.addEventListener("change", layout);
        window.addEventListener("resize", resetSheet);
        window.addEventListener("pagehide", close);
        document.addEventListener("visibilitychange", function () { if (document.hidden) close(); });
        var frame = 0;
        window.addEventListener("scroll", function () {
            if (!frame) frame = requestAnimationFrame(function () { frame = 0; track(); });
        }, { passive: true });
        layout();
        track();
        root.classList.add("outline-ready");
    }
    // Stack every tool above the main button with the same spacing.
    var slots = Array.from(actions.children);
    slots.forEach(function (slot, i) {
        slot.style.setProperty("--tool-x", "0px");
        slot.style.setProperty("--tool-y", (60 * (i + 1)) + "px");
    });
    var ink = window.FluidInk;
    if (ink && window.requestAnimationFrame && slots.length) {
        var svg = document.createElementNS(ink.SVG_NS, "svg");
        var height = slots.length * 60;
        svg.setAttribute("class", "tools-ink");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        svg.setAttribute("viewBox", "-12 " + (-height - 12) + " 68 " + (height + 68));
        svg.style.height = height + 68 + "px";
        svg.innerHTML = '<defs><filter id="tools-ink-goo" x="-12" y="' + (-height - 12) + '" width="68" height="' + (height + 68) + '" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="3"/><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 22 -10"/></filter></defs><g filter="url(#tools-ink-goo)"><circle cx="22" cy="22" r="22"/></g>';
        var group = svg.querySelector("g");
        var blots = slots.map(function () {
            var path = document.createElementNS(ink.SVG_NS, "path");
            group.appendChild(path);
            return path;
        });
        tools.insertBefore(svg, toggle);
        var progress = 0, destination = 0, menuRaf = 0, previous = null, melts = [];
        function clearMenu() {
            if (menuRaf) window.cancelAnimationFrame(menuRaf);
            menuRaf = 0; previous = null;
            melts.forEach(function (melt) { melt.remove(); });
            melts = [];
            blots.forEach(function (path) { path.setAttribute("d", ""); });
            slots.forEach(function (slot) {
                slot.style.transform = "";
                slot.firstElementChild.style.opacity = "";
            });
            tools.classList.remove("tools-animating");
        }
        function paintMenu() {
            slots.forEach(function (slot, i) {
                var t = ink.clamp01((progress * (340 + (slots.length - 1) * 40) - i * 40) / 340);
                var travel = ink.smooth(Math.min(1, t / .64));
                var y = 22 - (i + 1) * 60 * travel;
                slot.style.transform = "translateY(" + ((i + 1) * 60 * (1 - travel)).toFixed(2) + "px)";
                slot.firstElementChild.style.opacity = t >= .64 ? "1" : "0";
                melts[i].set(ink.clamp01((t - .64) / .36));
                blots[i].setAttribute("d", t >= .64 || t === 0 ? "" : ink.path(ink.blob(
                    22, y, 22 / (1 + .22 * Math.sin(travel * Math.PI)),
                    22 * (1 + .22 * Math.sin(travel * Math.PI)), 0, i, 1.5, 1, 16)));
            });
        }
        function menuFrame(now) {
            if (!tools.isConnected || document.hidden) { resetMenu(); return; }
            var elapsed = previous === null ? 0 : Math.max(0, now - previous);
            previous = now;
            var step = elapsed / (340 + (slots.length - 1) * 40);
            progress = destination ? Math.min(1, progress + step) : Math.max(0, progress - step);
            paintMenu();
            if (progress === destination) { clearMenu(); return; }
            menuRaf = window.requestAnimationFrame(menuFrame);
        }
        animateMenu = function (on) {
            destination = on ? 1 : 0;
            if (progress === destination && !menuRaf) return;
            if (!menuRaf) {
                tools.classList.add("tools-animating");
                melts = slots.map(function (slot) { return ink.melt(slot.firstElementChild, { solid: true }); });
                previous = null;
                paintMenu();
                menuRaf = window.requestAnimationFrame(menuFrame);
            }
        };
        resetMenu = function () { clearMenu(); progress = destination = 0; expand(false); };
        actions.addEventListener("focusin", function () {
            if (destination) { progress = 1; clearMenu(); }
        });
        window.addEventListener("resize", resetMenu);
        window.addEventListener("pagehide", resetMenu);
        window.addEventListener("pageshow", resetMenu);
        document.addEventListener("visibilitychange", function () { if (document.hidden) resetMenu(); });
        tools.classList.add("tools-fluid");
    }
    actions.inert = true;
    actions.hidden = false;
    root.classList.add("reading-tools-ready");
})();
