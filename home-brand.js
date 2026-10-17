/*
 * RagDollLabs Whiskey Compass — home / brand navigation
 * ------------------------------------------------
 * Branding is a real navigation affordance. Links retain an href fallback, while
 * this enhancement returns to the already-loaded landing page without a reload.
 * Keyboard activation moves focus to the landing heading for orientation; pointer
 * clicks intentionally do not, avoiding a large focus outline around the title.
 */

function returnToWhiskeyCompassHome(event) {
  const keyboardActivation = event?.detail === 0;
  event?.preventDefault?.();
  WhiskeyCompass.clearProfileUrl();
  document.getElementById("appShell")?.classList.add("hidden");
  const welcome = document.getElementById("welcomeView");
  welcome?.classList.remove("hidden");

  const dialog = document.getElementById("glossaryDialog");
  if (dialog?.open) dialog.close();

  if (keyboardActivation) {
    const heading = document.getElementById("welcomeTitle");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  }
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

document.addEventListener("whiskeycompass:ready", () => {
  document.querySelectorAll("[data-home-return]").forEach(link => {
    link.addEventListener("click", returnToWhiskeyCompassHome);
  });
});
