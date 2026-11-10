import { useEffect, useState } from 'react';
import { UserPortal } from './panels/UserPortal';
import { ProviderPortal } from './panels/ProviderPortal';
import { AdminPortal } from './panels/AdminPortal';

type PortalRoute = 'user' | 'provider' | 'admin';

function resolveRoute(): PortalRoute {
  const hash = window.location.hash.toLowerCase();
  const path = window.location.pathname.toLowerCase();
  if (hash.startsWith('#/admin') || path.startsWith('/admin')) return 'admin';
  if (hash.startsWith('#/provider') || path.startsWith('/provider')) return 'provider';
  return 'user';
}

export default function App() {
  const [route, setRoute] = useState<PortalRoute>(resolveRoute);

  useEffect(() => {
    const onHashOrPop = () => setRoute(resolveRoute());
    window.addEventListener('hashchange', onHashOrPop);
    window.addEventListener('popstate', onHashOrPop);
    return () => {
      window.removeEventListener('hashchange', onHashOrPop);
      window.removeEventListener('popstate', onHashOrPop);
    };
  }, []);

  if (route === 'admin') return <AdminPortal />;
  if (route === 'provider') return <ProviderPortal />;
  return <UserPortal />;
}
