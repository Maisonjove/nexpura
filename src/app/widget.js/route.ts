import { NextRequest } from "next/server";

// GET /widget.js?tenant_id=xxx&theme=light&mode=catalogue
export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get("tenant_id") || "";
  const theme = request.nextUrl.searchParams.get("theme") || "light";
  const mode = request.nextUrl.searchParams.get("mode") || "catalogue";

  const js = `
(function() {
  var el = document.getElementById('nexpura-widget');
  if (!el) return;
  var script = document.currentScript;
  var tenant = script ? script.getAttribute('data-tenant') : '${tenantId}';
  var widgetMode = script ? script.getAttribute('data-mode') : '${mode}';
  var widgetTheme = script ? script.getAttribute('data-theme') : '${theme}';
  if (!tenant) return;
  var iframe = document.createElement('iframe');
  iframe.src = 'https://nexpura.com/embed/' + tenant + '?mode=' + widgetMode + '&theme=' + widgetTheme;
  iframe.style.cssText = 'width:100%;min-height:600px;border:none;border-radius:8px;display:block;';
  iframe.title = 'Nexpura Jewellery Catalogue';
  iframe.setAttribute('loading', 'lazy');
  el.appendChild(iframe);
  // Responsive height via postMessage
  window.addEventListener('message', function(e) {
    if (e.data && e.data.nexpuraHeight && e.source === iframe.contentWindow) {
      iframe.style.minHeight = e.data.nexpuraHeight + 'px';
    }
  });
})();
`;

  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
