// 301 every request on the legacy *.workers.dev address to the live site,
// keeping the path and query string so old deep links still resolve.
const TARGET = "https://ctgrank.pages.dev";

export default {
  fetch(request) {
    const url = new URL(request.url);
    return Response.redirect(TARGET + url.pathname + url.search + url.hash, 301);
  },
};
