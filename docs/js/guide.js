/**
 * Load Markdown chapters into the Pages guide viewer.
 *
 * Chapter paths are relative to this page (guide.html), so fetches work whether
 * GitHub Pages publishes the repo root (`…/docs/guide.html` → `…/docs/user-guide/…`)
 * or the `/docs` folder (`…/guide.html` → `…/user-guide/…`).
 * Root and docs/ `.nojekyll` keep Jekyll from omitting raw `.md` files.
 */
(function () {
  const CHAPTERS = [
    {
      group: "Visual setup",
      items: [
        {
          id: "visual-hub",
          title: "Visual hub",
          path: "setup-visual/README.md",
        },
      ],
    },
    {
      group: "User guide",
      items: [
        {
          id: "guide-home",
          title: "Overview",
          path: "user-guide/README.md",
        },
        {
          id: "01",
          title: "1. Install & run",
          path: "user-guide/01-install-and-run.md",
        },
        {
          id: "02",
          title: "2. Connect",
          path: "user-guide/02-connect.md",
        },
        {
          id: "03",
          title: "3. Understanding the UI",
          path: "user-guide/03-understanding-the-ui.md",
        },
        {
          id: "04",
          title: "4. Jogging & zeros",
          path: "user-guide/04-jogging-and-zeros.md",
        },
        {
          id: "05",
          title: "5. Calibration",
          path: "user-guide/05-calibration.md",
        },
        {
          id: "06",
          title: "6. Material & tool",
          path: "user-guide/06-material-and-tool.md",
        },
        {
          id: "07",
          title: "7. Prepare & Z probe",
          path: "user-guide/07-prepare-and-z-probe.md",
        },
        {
          id: "08",
          title: "8. Jobs, SVG & run",
          path: "user-guide/08-jobs-and-svg.md",
        },
        {
          id: "09",
          title: "9. External jobs",
          path: "user-guide/09-external-jobs.md",
        },
        {
          id: "10",
          title: "10. Debug bridge",
          path: "user-guide/10-debug-bridge.md",
        },
        {
          id: "11",
          title: "11. Safety",
          path: "user-guide/11-safety.md",
        },
        {
          id: "12",
          title: "12. Hardware soak",
          path: "user-guide/12-hardware-soak.md",
        },
      ],
    },
    {
      group: "Hardware & extras",
      items: [
        {
          id: "demon-shield-soak",
          title: "Demon Shield soak playbook",
          path: "demon-shield-soak-playbook.md",
        },
        {
          id: "demon-shield",
          title: "Demon Shield controls",
          path: "demon-shield-controls.md",
        },
        {
          id: "google-drive",
          title: "Google Drive setup",
          path: "google-drive-setup.md",
        },
        {
          id: "release",
          title: "Release checklist",
          path: "RELEASE.md",
        },
        {
          id: "testing-handoff",
          title: "Testing handoff (first cut)",
          path: "TESTING-HANDOFF.md",
        },
        {
          id: "release-notes-draft",
          title: "v0.1.0 release notes draft",
          path: "RELEASE-NOTES-v0.1.0-DRAFT.md",
        },
      ],
    },
  ];

  const EXTERNAL = [
    {
      title: "First-run visual guide",
      href: "setup-visual/first-run.html",
    },
    {
      title: "Calibration visual guide",
      href: "setup-visual/calibration.html",
    },
    {
      title: "Demon Shield vendor page",
      href: "https://www.designsbyphil.com/demon-shield-1.html",
    },
    {
      title: "Repo on GitHub",
      href: "https://github.com/cjsharp1/sharp-cnc",
    },
  ];

  /** Prefer hash routing (`guide.html#01`) — survives clean-URL redirects that drop `?doc=`. */
  function activeDocId() {
    const hash = (window.location.hash || "").replace(/^#/, "").trim();
    if (hash) return decodeURIComponent(hash);
    const q = new URLSearchParams(window.location.search).get("doc");
    if (q) return q;
    return "guide-home";
  }

  function chapterUrl(id) {
    return `guide.html#${encodeURIComponent(id)}`;
  }

  function findChapter(id) {
    for (const group of CHAPTERS) {
      const hit = group.items.find((item) => item.id === id);
      if (hit) return hit;
    }
    return CHAPTERS[0].items[0];
  }

  function rewriteRelativeUrls(html, mdPath) {
    const baseDir = mdPath.includes("/")
      ? mdPath.slice(0, mdPath.lastIndexOf("/") + 1)
      : "";

    const container = document.createElement("div");
    container.innerHTML = html;

    container.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href");
      if (!href || /^(https?:|mailto:|#)/i.test(href)) return;

      if (href.endsWith(".md")) {
        const resolved = resolvePath(baseDir, href);
        const chapter = findByPath(resolved);
        if (chapter) {
          a.setAttribute("href", chapterUrl(chapter.id));
        } else {
          a.setAttribute("href", resolved);
        }
        return;
      }

      // Assets / other relative files next to the markdown
      a.setAttribute("href", resolvePath(baseDir, href));
    });

    container.querySelectorAll("img[src]").forEach((img) => {
      const src = img.getAttribute("src");
      if (!src || /^(https?:|data:)/i.test(src)) return;
      img.setAttribute("src", resolvePath(baseDir, src));
    });

    return container.innerHTML;
  }

  function resolvePath(baseDir, rel) {
    if (rel.startsWith("/")) return rel.replace(/^\//, "");
    const stack = baseDir.split("/").filter(Boolean);
    for (const part of rel.split("/")) {
      if (part === "..") stack.pop();
      else if (part && part !== ".") stack.push(part);
    }
    return stack.join("/");
  }

  function findByPath(path) {
    const normalized = path.replace(/^\.\//, "");
    for (const group of CHAPTERS) {
      const hit = group.items.find((item) => item.path === normalized);
      if (hit) return hit;
    }
    return null;
  }

  function renderToc(activeId) {
    const toc = document.getElementById("guide-toc");
    if (!toc) return;
    toc.innerHTML = "";

    for (const group of CHAPTERS) {
      const label = document.createElement("li");
      label.className = "toc-group";
      label.textContent = group.group;
      toc.appendChild(label);

      for (const item of group.items) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = chapterUrl(item.id);
        a.textContent = item.title;
        if (item.id === activeId) a.setAttribute("aria-current", "page");
        li.appendChild(a);
        toc.appendChild(li);
      }
    }

    const extLabel = document.createElement("li");
    extLabel.className = "toc-group";
    extLabel.textContent = "External";
    toc.appendChild(extLabel);

    for (const link of EXTERNAL) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = link.href;
      a.textContent = link.title;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      li.appendChild(a);
      toc.appendChild(li);
    }
  }

  async function loadChapter(chapter) {
    const article = document.getElementById("guide-article");
    const status = document.getElementById("guide-status");
    if (!article) return;

    article.innerHTML = `<p class="guide-status">Loading ${chapter.title}…</p>`;
    if (status) status.textContent = chapter.path;

    try {
      // Resolve against the current document URL (not the site origin) so the
      // same relative paths work for Pages source `/` and `/docs`.
      const url = new URL(chapter.path, window.location.href);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const md = await res.text();
      if (typeof marked === "undefined") {
        throw new Error("Markdown renderer failed to load");
      }
      marked.setOptions({ gfm: true, breaks: false });
      const html = rewriteRelativeUrls(marked.parse(md), chapter.path);
      article.innerHTML = `<div class="md-body">${html}</div>`;
      document.title = `${chapter.title} · SharpCNC docs`;
    } catch (err) {
      article.innerHTML = `<p class="guide-status">Could not load <code>${chapter.path}</code>. ${String(err.message || err)}</p>`;
    }
  }

  function showActive() {
    const chapter = findChapter(activeDocId());
    renderToc(chapter.id);
    loadChapter(chapter);
  }

  document.addEventListener("DOMContentLoaded", showActive);
  window.addEventListener("hashchange", showActive);
})();
