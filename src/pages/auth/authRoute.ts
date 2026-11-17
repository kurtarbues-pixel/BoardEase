export type AuthRoute = 'landing' | 'login' | 'register' | 'forgot-password';

export function resolveAuthRoute(pathname: string, search = ''): AuthRoute {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  if (path === '/login') return 'login';
  if (path === '/register') return 'register';
  if (path === '/forgot-password') return 'forgot-password';
  if (path === '/') {
    return new URLSearchParams(search).get('password_reset') === '1' ? 'login' : 'landing';
  }

  // Unknown paths should fail closed to the existing Sign In page.
  return 'login';
}

export function authRoutePath(route: AuthRoute): string {
  switch (route) {
    case 'login': return '/login';
    case 'register': return '/register';
    case 'forgot-password': return '/forgot-password';
    default: return '/';
  }
}
