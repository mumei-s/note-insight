export {};

// Update actions live in their own cards. Remove the obsolete combined banner,
// whose fallback sent dashboard updates to the notification installer.
function removeLegacyGuide(){
  document.getElementById("mumei-insight-update-guide-v18")?.remove();
  document.getElementById("mumei-insight-update-guide-v18-style")?.remove();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",removeLegacyGuide,{once:true});else removeLegacyGuide();
window.addEventListener("pageshow",removeLegacyGuide);
