/* Documentation controls: offline search, guide drawer, page outline and
   copy buttons. Every page remains readable without JavaScript. */
(() => {
  "use strict";

  const script = document.currentScript;
  const root = script ? new URL("../../", script.src) : new URL("/", location.href);
  let indexRequest;
  let searchRevision = 0;

  function initSearch() {
    const search = document.querySelector(".doc-search");
    const input = search?.querySelector("input");
    if (!search || !input) return;

    async function update() {
      const revision = ++searchRevision;
      const query = input.value.trim().toLocaleLowerCase();
      const results = search.querySelector(".search-results");
      const status = search.querySelector(".search-status");
      results.replaceChildren();

      if (query.length < 2) {
        status.textContent = "Enter at least two characters.";
        return;
      }
      status.textContent = "Searching…";

      try {
        indexRequest ||= fetch(new URL("assets/search-index.json", root))
          .then((response) => {
            if (!response.ok) throw new Error("Search index unavailable");
            return response.json();
          })
          .catch((error) => {
            indexRequest = null;
            throw error;
          });

        const entries = await indexRequest;
        if (revision !== searchRevision) return;
        const words = query.split(/\s+/);
        const matches = entries
          .filter((entry) => words.every((word) =>
            `${entry.title} ${entry.text}`.toLocaleLowerCase().includes(word)
          ))
          .slice(0, 12);

        for (const entry of matches) {
          const item = document.createElement("li");
          const link = document.createElement("a");
          link.href = new URL(entry.url, root).href;
          link.textContent = entry.title;
          link.addEventListener("click", () => { search.open = false; });
          const excerpt = document.createElement("small");
          excerpt.textContent = entry.text.slice(0, 145) + (entry.text.length > 145 ? "…" : "");
          link.append(excerpt);
          item.append(link);
          results.append(item);
        }
        status.textContent = matches.length
          ? `${matches.length} matching sections`
          : "No matching guide. Try a shorter topic or browse all guides.";
      } catch (error) {
        if (revision !== searchRevision) return;
        status.textContent = "Search is unavailable. You can still browse all guides below.";
      }
    }

    input.addEventListener("input", update);
    search.addEventListener("toggle", () => { if (search.open) input.focus(); });
    search.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        search.open = false;
        search.querySelector("summary").focus();
      }
    });
  }

  function initDocs(scope) {
    const drawer = scope.querySelector?.(".wiki-drawer") || document.querySelector(".wiki-drawer");
    if (drawer && !drawer.dataset.bound) {
      drawer.dataset.bound = "1";
      const wide = window.matchMedia("(min-width: 801px)");
      drawer.open = wide.matches;
      wide.addEventListener("change", (event) => { drawer.open = event.matches; });
    }

    const article = scope.querySelector?.("article.prose") || document.querySelector("article.prose");
    const navigation = scope.querySelector?.(".wiki-nav") || document.querySelector(".wiki-nav");
    if (article && navigation && !navigation.querySelector(".page-outline")) {
      const outline = document.createElement("div");
      outline.className = "page-outline";
      const label = document.createElement("h2");
      label.textContent = "On this page";
      outline.append(label);
      article.querySelectorAll("h2").forEach((heading, index) => {
        heading.id ||= `section-${index + 1}`;
        const link = document.createElement("a");
        link.href = `#${heading.id}`;
        link.textContent = heading.textContent;
        outline.append(link);
      });
      if (outline.children.length > 1) navigation.append(outline);
    }

    if (navigator.clipboard?.writeText) {
      scope.querySelectorAll(".prose pre").forEach((pre) => {
        if (pre.dataset.copy) return;
        pre.dataset.copy = "1";
        const code = pre.querySelector("code");
        if (!code) return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "copy-code";
        button.textContent = "Copy";
        button.addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(code.textContent);
            button.textContent = "Copied";
          } catch (error) {
            button.textContent = "Select text to copy";
          }
          window.setTimeout(() => { button.textContent = "Copy"; }, 2500);
        });
        pre.append(button);
      });
    }
  }

  initSearch();

  if (window.VV) window.VV.register(initDocs);
  else (window.VVPageInits = window.VVPageInits || []).push(initDocs);
})();
