// Progressive enhancements for the catalog, system diagram and translation UI.
// The site remains readable without JavaScript.

(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const isLocalPreview = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

  function visibleCount(scope) {
    return scope.querySelectorAll(".proj:not(.hidden)").length;
  }

  function initCatalog(scope) {
    const filterBar = scope.querySelector(".filters");
    if (!filterBar || filterBar.dataset.bound) return;
    filterBar.dataset.bound = "1";

    const buttons = Array.from(filterBar.querySelectorAll(".filter-btn"));
    const search = scope.querySelector("#proj-search") || document.getElementById("proj-search");
    const groups = Array.from(scope.querySelectorAll(".group"));
    const emptyNote = scope.querySelector(".empty-note");
    const countNote = scope.querySelector("[data-catalog-count]");
    let activeTag = "all";

    function apply(animate) {
      const query = search ? search.value.trim().toLowerCase() : "";
      const reveal = [];
      let visible = 0;

      groups.forEach((group) => {
        let groupVisible = 0;
        group.querySelectorAll(".proj").forEach((card) => {
          const tags = card.dataset.tags || "";
          const text = card.textContent.toLowerCase();
          const show =
            (activeTag === "all" || tags.split(" ").includes(activeTag)) &&
            (!query || text.includes(query));
          const wasHidden = card.classList.contains("hidden");
          card.classList.toggle("hidden", !show);
          if (show) {
            groupVisible++;
            if (wasHidden) reveal.push(card);
          }
        });
        group.classList.toggle("hidden", groupVisible === 0);
        visible += groupVisible;
      });

      if (emptyNote) emptyNote.classList.toggle("show", visible === 0);
      if (countNote) countNote.textContent = `${visible} shown`;

      if (animate && !reduceMotion.matches) {
        reveal.slice(0, 18).forEach((card) => {
          card.animate(
            [
              { opacity: 0, transform: "translateY(8px)" },
              { opacity: 1, transform: "translateY(0)" },
            ],
            { duration: 260, easing: "cubic-bezier(.19,1,.22,1)" }
          );
        });
      }
    }

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        buttons.forEach((other) => other.setAttribute("aria-pressed", other === button ? "true" : "false"));
        activeTag = button.dataset.filter;
        apply(true);
      });
    });

    if (search) search.addEventListener("input", () => apply(true));
    apply(false);
  }

  function initDiagram(scope) {
    const diagram = scope.querySelector(".diagram");
    if (!diagram) return;

    diagram.querySelectorAll(".dg-node").forEach((node) => {
      if (node.dataset.bound) return;
      node.dataset.bound = "1";
      const id = node.dataset.node;
      if (!id) return;
      const edges = Array.from(diagram.querySelectorAll(".dg-edge")).filter((edge) =>
        (edge.dataset.n || "").split(" ").includes(id)
      );
      const light = () => edges.forEach((edge) => edge.classList.add("hot"));
      const clear = () => edges.forEach((edge) => edge.classList.remove("hot"));
      node.addEventListener("mouseenter", light);
      node.addEventListener("mouseleave", clear);
      node.addEventListener("focusin", light);
      node.addEventListener("focusout", clear);
    });
  }

  /* ----- Optional in-place Google Translate -----
     No third-party script loads until the visitor explicitly opts in. */

  const EURO_LANGS = {
    sq: "shqip", hy: "հայերեն", az: "azərbaycan", be: "беларуская",
    bs: "bosanski", bg: "български", ca: "català", hr: "hrvatski",
    cs: "čeština", da: "dansk", nl: "Nederlands", en: "English",
    et: "eesti", fi: "suomi", fr: "Français", gl: "galego",
    ka: "ქართული", de: "Deutsch", el: "Ελληνικά", hu: "magyar",
    is: "íslenska", ga: "Gaeilge", it: "Italiano", lv: "latviešu",
    lt: "lietuvių", lb: "Lëtzebuergesch", mk: "македонски", mt: "Malti",
    no: "norsk", pl: "polski", pt: "Português", ro: "română",
    ru: "Русский", sr: "српски", sk: "slovenčina", sl: "slovenščina",
    es: "Español", sv: "svenska", tr: "Türkçe", uk: "Українська", cy: "Cymraeg",
  };
  const QUICK_LANGS = [
    ["nl", "Nederlands"],
    ["de", "Deutsch"],
    ["fr", "Français"],
    ["ru", "Русский"],
  ];

  let translateWidget = null;
  let translateLoading = false;
  let translationRestored = false;
  let quickBar = null;

  function activeLang() {
    const match = /(?:^|;\s*)googtrans=\/en\/([a-zA-Z-]+)/.exec(document.cookie);
    return match ? match[1].toLowerCase() : "";
  }

  function origFlagSet(on) {
    try {
      if (on) {
        localStorage.setItem("googtrans-original", "1");
        localStorage.removeItem("googtrans-consent");
      } else {
        localStorage.removeItem("googtrans-original");
        localStorage.setItem("googtrans-consent", "1");
      }
    } catch (error) { /* storage can be unavailable */ }
  }

  function hasTranslationConsent() {
    try {
      return localStorage.getItem("googtrans-consent") === "1" &&
        !localStorage.getItem("googtrans-original");
    } catch (error) { return false; }
  }

  function applyViaCombo(code) {
    let tries = 0;
    (function poke() {
      if (activeLang() !== code) return;
      const combo = translateWidget && document.querySelector("select.goog-te-combo");
      if (combo && code) {
        combo.value = code;
        combo.dispatchEvent(new Event("change"));
        markActive(code);
      } else if (++tries < 40) {
        window.setTimeout(poke, 50);
      }
    })();
  }

  function ensureTranslateElement() {
    if (translateWidget || translateLoading) return;
    translateLoading = true;
    window.googleTranslateElementInit = function () {
      if (translateWidget) return;
      const mount = document.createElement("div");
      mount.id = "google_translate_element";
      document.body.appendChild(mount);
      translateWidget = new google.translate.TranslateElement(
        {
          pageLanguage: "en",
          layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
          autoDisplay: false,
        },
        "google_translate_element"
      );
      const saved = activeLang();
      if (saved) applyViaCombo(saved);
    };
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.onerror = function () {
      translateLoading = false;
      script.remove();
    };
    document.head.appendChild(script);
  }

  function setLang(code) {
    if (code && !Object.hasOwn(EURO_LANGS, code)) return;
    if (!code) {
      document.cookie = "googtrans=;path=/;max-age=0";
      origFlagSet(true);
      location.reload();
      return;
    }
    origFlagSet(false);
    document.cookie = `googtrans=/en/${code};path=/;samesite=lax`;
    ensureTranslateElement();
    applyViaCombo(code);
  }

  function markActive(code) {
    document.querySelectorAll(".lang-top .lang-btn").forEach((button) => {
      const on = button.dataset.lang === code;
      button.classList.toggle("active", on);
      button.setAttribute("aria-pressed", String(on));
    });
    const select = document.querySelector(".foot-inner select.lang-select");
    if (select) select.value = code;
  }

  function syncQuickBar() {
    if (isLocalPreview) return;
    const docsPage = document.body.classList.contains("docs-page");
    if (!docsPage) {
      if (quickBar) { quickBar.remove(); quickBar = null; }
      return;
    }
    if (quickBar && document.contains(quickBar)) return;

    const bar = document.createElement("div");
    bar.className = "lang-top container";
    bar.setAttribute("aria-label", "In-place Google Translate");
    bar.innerHTML =
      '<span class="lt-label">🌐 Google Translate:</span>' +
      QUICK_LANGS.map(
        ([code, name]) => `<button type="button" class="lang-btn" data-lang="${code}">${name}</button>`
      ).join("") +
      '<button type="button" class="lang-btn" data-lang="">Original</button>';
    bar.addEventListener("click", (event) => {
      const button = event.target.closest(".lang-btn");
      if (button) setLang(button.dataset.lang);
    });
    const header = document.querySelector("header.nav");
    if (!header) return;
    header.after(bar);
    quickBar = bar;
    markActive(hasTranslationConsent() ? activeLang() : "");
  }

  function ensureFooterPicker() {
    if (isLocalPreview) return;
    const footInner = document.querySelector(".foot-inner");
    if (!footInner || footInner.querySelector(".lang-select")) return;
    const wrap = document.createElement("div");
    wrap.className = "foot-col";
    wrap.innerHTML =
      "<h4>Google Translate</h4>" +
      "<p>Choosing a language loads Google’s translation service.</p>" +
      '<select class="lang-select" aria-label="Translate this page">' +
      '<option value="">English (original)</option>' +
      Object.entries(EURO_LANGS)
        .map(([code, name]) => `<option value="${code}">${name}</option>`)
        .join("") +
      "</select>";
    const select = wrap.querySelector("select");
    select.addEventListener("change", () => setLang(select.value));
    select.value = activeLang();
    footInner.appendChild(wrap);
  }

  function initTranslation() {
    ensureFooterPicker();
    syncQuickBar();
    markActive(hasTranslationConsent() ? activeLang() : "");

    if (!translationRestored) {
      translationRestored = true;
      const savedLanguage = activeLang();
      if (!isLocalPreview && hasTranslationConsent() && Object.hasOwn(EURO_LANGS, savedLanguage)) {
        ensureTranslateElement();
      }
    }
  }

  function initPage(scope) {
    initCatalog(scope);
    initDiagram(scope);
    initTranslation();
  }

  if (window.VV) window.VV.register(initPage);
  else (window.VVPageInits = window.VVPageInits || []).push(initPage);
})();
