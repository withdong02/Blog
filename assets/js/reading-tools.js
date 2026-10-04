(function () {
    "use strict";
    var theme = document.getElementById("theme-toggle");
    var top = document.getElementById("top-link");
    var source = document.querySelector(".toc .inner");
    var root = document.documentElement;
    var tools = document.createElement("div");
    tools.className = "reading-tools";
    tools.innerHTML = '<button class="tools-toggle" aria-label="阅读工具" aria-expanded="false" aria-controls="tools-actions"><svg class="tools-open-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.5"/><circle cx="15" cy="17" r="2.5"/></svg><svg class="tools-close-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button><div id="tools-actions" class="tools-actions" hidden></div>';
    document.body.appendChild(tools);
    var toggle = tools.querySelector("button");
    var actions = tools.querySelector(".tools-actions");
    function expand(on) {
        if (!on && actions.contains(document.activeElement)) toggle.focus({ preventScroll: true });
        actions.hidden = !on;
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
    toggle.addEventListener("click", function () { expand(actions.hidden); });
    document.addEventListener("click", function (e) {
        if (!tools.contains(e.target)) expand(false);
    });
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !actions.hidden) { expand(false); toggle.focus(); }
    });

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
        var wide = window.matchMedia("(min-width: 1360px) and (min-height: 480px) and (hover: hover) and (pointer: fine)");
        var links = Array.from(panel.querySelectorAll("a"));
        // The original IDs belong to the article's native outline.
        panel.querySelectorAll("[id]").forEach(function (n) { n.removeAttribute("id"); });
        var entries = links.map(function (link) {
            var id = link.hash.slice(1);
            try { id = decodeURIComponent(id); } catch (e) {}
            return { link: link, heading: document.getElementById(id) };
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
            });
            if (wide.matches) reveal();
        }
        function reveal() {
            if (!active) return;
            var body = panel.querySelector(".outline-body");
            var box = body.getBoundingClientRect();
            var row = active.link.getBoundingClientRect();
            if (row.top < box.top) body.scrollTop += row.top - box.top;
            else if (row.bottom > box.bottom) body.scrollTop += row.bottom - box.bottom;
        }
        function close() { if (dialog.open) dialog.close(); }
        dialog.addEventListener("close", function () {
            root.classList.remove("outline-open");
            toggle.focus({ preventScroll: true });
        });
        dialog.addEventListener("click", function (e) { if (e.target === dialog) close(); });
        panel.querySelector(".outline-close").addEventListener("click", close);
        panel.addEventListener("click", function (e) { if (e.target.closest("a")) close(); });
        button.addEventListener("click", function () {
            track();
            if (wide.matches) { reveal(); (active ? active.link : panel).focus({ preventScroll: true }); }
            else { dialog.showModal(); root.classList.add("outline-open"); reveal(); }
        });
        function layout() {
            close();
            root.classList.toggle("outline-wide", wide.matches);
            (wide.matches ? document.body : dialog).appendChild(panel);
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
    root.classList.add("reading-tools-ready");
})();
