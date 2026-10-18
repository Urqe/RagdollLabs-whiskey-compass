/*
 * RagDollLabs Whiskey Compass — compare-region country context
 * -------------------------------------------------------
 * Native <select> menus cannot reliably render a region name plus a separately
 * styled country line, especially on iOS/Safari. app.js therefore builds a
 * fully functional native control first and emits `whiskeycompass:compare-controls`.
 * This file subscribes to that hook and progressively enhances the controls.
 *
 * The hidden native `.cr` select remains the single comparison value consumed
 * by renderCompare(). If this enhancement fails to load, Compare still works.
 */

(function enhanceCompareRegionSelectors() {
  function regions() { return WhiskeyCompass.getData().regions; }

  function closeMenu(control, returnFocus = false) {
    const trigger = control.querySelector(".compare-select-trigger");
    const menu = control.querySelector(".compare-select-menu");
    if (!trigger || !menu) return;
    menu.classList.add("hidden");
    trigger.setAttribute("aria-expanded", "false");
    if (returnFocus) trigger.focus();
  }

  function closeOtherMenus(except = null) {
    document.querySelectorAll(".compare-select").forEach(control => {
      if (control !== except) closeMenu(control, false);
    });
  }

  function renderSelectedValue(target, regionId) {
    const data = regions();
    target.replaceChildren();
    const name = document.createElement("span");
    name.className = "compare-select-name";
    if (!regionId || !data[regionId]) {
      name.textContent = "— None —";
      target.appendChild(name);
      return;
    }
    const region = data[regionId];
    name.textContent = region.name;
    const country = document.createElement("span");
    country.className = "compare-select-country";
    country.textContent = region.country;
    target.append(name, country);
  }

  function openMenu(control) {
    const trigger = control.querySelector(".compare-select-trigger");
    const menu = control.querySelector(".compare-select-menu");
    if (!trigger || !menu) return;
    closeOtherMenus(control);
    menu.classList.remove("hidden");
    trigger.setAttribute("aria-expanded", "true");
    const selected = menu.querySelector('[aria-selected="true"]');
    const first = menu.querySelector(".compare-select-option");
    (selected || first)?.focus();
  }

  function updateControl(control, regionId) {
    const select = control.querySelector("select.cr");
    const value = control.querySelector(".compare-select-value");
    if (!select || !value) return;
    select.value = regionId;
    renderSelectedValue(value, regionId);
    control.querySelectorAll(".compare-select-option").forEach(option => {
      option.setAttribute("aria-selected", String(option.dataset.value === regionId));
    });
  }

  function chooseOption(control, option) {
    const select = control.querySelector("select.cr");
    if (!select) return;
    updateControl(control, option.dataset.value || "");
    closeMenu(control, true);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function moveOptionFocus(option, direction) {
    const options = [...option.closest(".compare-select-menu").querySelectorAll(".compare-select-option")];
    const index = options.indexOf(option);
    if (index < 0) return;
    options[(index + direction + options.length) % options.length].focus();
  }

  function makeOption(regionId, selected) {
    const data = regions();
    const option = document.createElement("button");
    option.type = "button";
    option.className = "compare-select-option";
    option.setAttribute("role", "option");
    option.dataset.value = regionId;
    option.setAttribute("aria-selected", String(selected));

    const name = document.createElement("span");
    name.className = "compare-select-name";
    if (!regionId || !data[regionId]) {
      name.textContent = "— None —";
      option.appendChild(name);
      return option;
    }

    const region = data[regionId];
    name.textContent = region.name;
    const country = document.createElement("span");
    country.className = "compare-select-country";
    country.textContent = region.country;
    option.append(name, country);
    return option;
  }

  function enhanceWrapper(wrapper) {
    if (wrapper.dataset.countryEnhanced === "true") return;
    const select = wrapper.querySelector("select.cr");
    const label = wrapper.querySelector("label");
    if (!select || !label) return;

    const control = document.createElement("div");
    control.className = "compare-select";
    const listId = `${select.id}List`;
    const buttonId = `${select.id}Button`;
    label.id = `${select.id}Label`;
    label.htmlFor = buttonId;

    select.hidden = true;
    select.setAttribute("aria-hidden", "true");
    select.tabIndex = -1;

    const trigger = document.createElement("button");
    trigger.id = buttonId;
    trigger.type = "button";
    trigger.className = "compare-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-labelledby", `${label.id} ${buttonId}`);
    trigger.setAttribute("aria-controls", listId);

    const value = document.createElement("span");
    value.className = "compare-select-value";
    renderSelectedValue(value, select.value);
    const chevron = document.createElement("span");
    chevron.className = "compare-select-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = "⌄";
    trigger.append(value, chevron);

    const menu = document.createElement("div");
    menu.id = listId;
    menu.className = "compare-select-menu hidden";
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-labelledby", label.id);

    [...select.options].forEach(nativeOption => {
      const option = makeOption(nativeOption.value, nativeOption.value === select.value);
      option.addEventListener("click", () => chooseOption(control, option));
      option.addEventListener("keydown", event => {
        if (event.key === "ArrowDown") { event.preventDefault(); moveOptionFocus(option, 1); }
        if (event.key === "ArrowUp") { event.preventDefault(); moveOptionFocus(option, -1); }
        if (event.key === "Home") { event.preventDefault(); menu.querySelector(".compare-select-option")?.focus(); }
        if (event.key === "End") { event.preventDefault(); [...menu.querySelectorAll(".compare-select-option")].at(-1)?.focus(); }
        if (["Enter", " "].includes(event.key)) { event.preventDefault(); chooseOption(control, option); }
        if (event.key === "Escape") { event.preventDefault(); closeMenu(control, true); }
      });
      menu.appendChild(option);
    });

    trigger.addEventListener("click", () => {
      if (trigger.getAttribute("aria-expanded") === "true") closeMenu(control, false);
      else openMenu(control);
    });
    trigger.addEventListener("keydown", event => {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openMenu(control);
      }
    });

    wrapper.appendChild(control);
    control.append(select, trigger, menu);
    wrapper.dataset.countryEnhanced = "true";
  }

  document.addEventListener("whiskeycompass:compare-controls", () => {
    document.querySelectorAll("#compareRegionControls .compare-region-field").forEach(enhanceWrapper);
  });

  document.addEventListener("click", event => {
    if (event.target.closest(".compare-select")) return;
    // Outside-click: close open menus and return focus to the trigger that was
    // open, so keyboard users are not dropped onto <body>. Clicking another
    // trigger is handled by its own listener and skips the focus jump.
    const open = [...document.querySelectorAll(".compare-select")].find(control => control.querySelector(".compare-select-menu")?.classList.contains("hidden") === false);
    if (open) closeMenu(open, true);
  });
})();
