/**
 * 해시 라우터. docs/decisions.md 2절: 해시 라우팅으로 새로고침 없이 이동.
 * 패턴은 등록 순서대로 검사하며, 첫 매치를 사용한다.
 */
const routes = [];

function registerRoute(pattern, render) {
  routes.push({ pattern, render });
}

function navigate(hash) {
  if (location.hash === hash) {
    handleRouteChange();
  } else {
    location.hash = hash;
  }
}

function handleRouteChange() {
  const hash = location.hash.replace(/^#/, '') || '/';
  for (const route of routes) {
    const match = hash.match(route.pattern);
    if (match) {
      route.render(match.groups || {});
      return;
    }
  }
  // 어떤 패턴에도 안 걸리면(잘못된 해시 등) 첫 번째로 등록된 라우트(홈)로 되돌린다.
  if (routes.length > 0) routes[0].render({});
}

window.addEventListener('hashchange', handleRouteChange);
