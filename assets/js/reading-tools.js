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
    function expand(on) {
        if (!on && actions.contains(document.activeElement)) toggle.focus({ preventScroll: true });
        actions.inert = !on;
        actions.classList.toggle("is-open", on);
        root.classList.toggle("reading-tools-open", on);
        toggle.setAttribute("aria-expanded", String(on));
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
    window.addEventListener("fluid-portal-change", function () { expand(false); });

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
        panel.innerHTML = '<div class="outline-header"><h2>文章目录</h2><button class="outline-close" aria-label="关闭目录">×</button></div><div class="outline-body"></div>';
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
        function close() {
            if (dialog.open) dialog.close();
        }
        dialog.addEventListener("close", function () {
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
    actions.inert = true;
    actions.hidden = false;
    root.classList.add("reading-tools-ready");
})();
