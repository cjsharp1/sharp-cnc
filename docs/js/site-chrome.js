/**
 * Shared SharpCNC docs site header — one menu chrome for every Pages shell.
 *
 * Mount (empty; filled by this script before theme.js binds the toggle):
 *   <header class="site-header" data-site-chrome data-page="…" data-base=""></header>
 *   <script src="…/js/site-chrome.js"></script>
 *
 * data-page: home | guide | visual | visual-calibration | visual-prepare | visual-first-run
 * data-base: "" from docs/, "../" from docs/setup-visual/
 */
(function () {
  const GITHUB = "https://github.com/cjsharp1/sharp-cnc";

  function joinBase(base, rel) {
    const b = base || "";
    return b + rel.replace(/^\.\//, "");
  }

  function isCurrent(page, id) {
    if (id === "home") return page === "home";
    if (id === "guide") return page === "guide";
    if (id === "visual") {
      return (
        page === "visual" ||
        page === "visual-calibration" ||
        page === "visual-prepare" ||
        page === "visual-first-run"
      );
    }
    return false;
  }

  function buildHeader(mount) {
    const page = (mount.getAttribute("data-page") || "home").trim();
    const base = mount.getAttribute("data-base");
    const root = base == null ? "" : base;

    const homeHref = joinBase(root, "index.html");
    const guideHref = joinBase(root, "guide.html");
    const visualHref = joinBase(root, "setup-visual/index.html");
    const gettingStartedHref = joinBase(root, "index.html#getting-started");
    const downloadHref = joinBase(root, "index.html#download");

    const brand = document.createElement("a");
    brand.className = "site-brand";
    brand.href = homeHref;
    if (page === "home") brand.setAttribute("aria-current", "page");
    brand.innerHTML =
      '<span class="site-brand__mark">SharpCNC</span>' +
      '<span class="site-brand__tag">Docs</span>';

    const nav = document.createElement("nav");
    nav.className = "site-nav";
    nav.setAttribute("aria-label", "Primary");

    const links = [
      { id: "home", label: "Home", href: homeHref },
      { id: "visual", label: "Visual setup", href: visualHref },
      { id: "guide", label: "User guide", href: guideHref },
      {
        id: "getting-started",
        label: "Getting started",
        href: gettingStartedHref,
        defer: true,
      },
      {
        id: "download",
        label: "Download",
        href: downloadHref,
        defer: true,
      },
      {
        id: "github",
        label: "GitHub",
        href: GITHUB,
        external: true,
      },
    ];

    for (const item of links) {
      const a = document.createElement("a");
      a.href = item.href;
      a.textContent = item.label;
      if (item.defer) a.className = "site-nav__defer";
      if (item.external) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
      if (isCurrent(page, item.id)) a.setAttribute("aria-current", "page");
      nav.appendChild(a);
    }

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "theme-toggle";
    toggle.id = "theme-toggle";
    toggle.textContent = "Light";

    mount.replaceChildren(brand, nav, toggle);
  }

  function mountAll() {
    document
      .querySelectorAll("header.site-header[data-site-chrome]")
      .forEach(buildHeader);
  }

  // Run immediately when placed right after the header mount so theme.js
  // (DOMContentLoaded) finds #theme-toggle.
  mountAll();
})();
