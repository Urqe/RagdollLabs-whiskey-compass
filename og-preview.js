// Refreshes og:title/og:description to the open profile. Scope is narrow: link
// previews in Slack, LinkedIn, Facebook, iMessage etc. read the static tags in
// index.html without running JavaScript, so this only affects tools that
// execute the page (e.g. browser extensions or JS-rendering crawlers).
document.addEventListener("whiskeycompass:profile-selected", event => {
  const { profile } = event.detail;
  if (!profile) return;
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogDesc = document.querySelector('meta[property="og:description"]');
  const title = `${profile.style.name} · ${profile.region.name} — Whiskey Compass`;
  if (ogTitle) ogTitle.setAttribute("content", title);
  if (ogDesc) ogDesc.setAttribute("content", profile.regional.expect || "");
});
