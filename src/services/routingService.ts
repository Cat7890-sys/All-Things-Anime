import type { AppRouteView, LegalPageSlug, NavDestinationId } from '../types';

const VALID_NAV_DESTINATIONS: readonly NavDestinationId[] = [
  'home',
  'discover',
  'communities',
  'messages',
  'notifications',
  'profile',
  'my-anime',
  'anime-tracker',
  'collections',
  'personalisation',
  'calendar',
  'news',
  'journey',
];

const LEGAL_SLUGS: readonly LegalPageSlug[] = [
  'privacy-policy',
  'terms',
  'cookie-policy',
  'refund-policy',
  'community-guidelines',
];

export function stripBasePath(pathname: string, baseUrl: string = '/'): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  let rel = pathname || '/';
  if (normalizedBase && normalizedBase !== '/' && rel.startsWith(normalizedBase)) {
    rel = rel.slice(normalizedBase.length) || '/';
  }
  if (!rel.startsWith('/')) {
    rel = `/${rel}`;
  }
  return rel.replace(/\/+$/, '') || '/';
}

export function resolveRouteFromLocation(
  pathname: string,
  hash: string = '',
  baseUrl: string = '/'
): AppRouteView {
  const hashPath =
    hash && hash.startsWith('#/') ? hash.slice(1).replace(/\/+$/, '') || '/' : '';
  const path = hashPath || stripBasePath(pathname, baseUrl);
  const lower = path.toLowerCase();

  if (lower === '/admin/login') {
    return { kind: 'admin-login' };
  }
  if (lower === '/admin' || lower.startsWith('/admin/')) {
    return { kind: 'admin-dashboard' };
  }

  for (const slug of LEGAL_SLUGS) {
    if (lower === `/${slug}`) {
      return { kind: 'legal', slug };
    }
  }

  const candidateDest = lower.replace(/^\//, '') as NavDestinationId;
  if (
    candidateDest &&
    candidateDest !== 'home' &&
    (VALID_NAV_DESTINATIONS as readonly string[]).includes(candidateDest)
  ) {
    return { kind: 'destination', destination: candidateDest };
  }

  return { kind: 'destination', destination: 'home' };
}

export function buildAppHref(route: AppRouteView, baseUrl: string = '/'): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  switch (route.kind) {
    case 'admin-login':
      return `${normalizedBase}admin/login`;
    case 'admin-dashboard':
      return `${normalizedBase}admin`;
    case 'legal':
      return `${normalizedBase}${route.slug}`;
    case 'destination':
      return route.destination === 'home'
        ? normalizedBase
        : `${normalizedBase}${route.destination}`;
  }
}
