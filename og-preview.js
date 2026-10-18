// Deep-link previews: refresh the og:title/og:description to the open profile.
document.addEventListener("whiskeycompass:profile-selected", event => {
  const { profile } = event.detail;
  if (!profile) return;
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogDesc = document.querySelector('meta[property="og:description"]');
  const title = `${profile.style.name} · ${profile.region.name} — Whiskey Compass`;
  if (ogTitle) ogTitle.setAttribute("content", title);
  if (ogDesc) ogDesc.setAttribute("content", profile.regional.expect || "");
});
