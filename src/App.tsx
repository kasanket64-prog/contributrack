import { lazy, Suspense, useEffect, useState } from 'react';
import type { Page } from './lib/types';
import { supabase } from './lib/supabase';
import { NAVIGATE_EVENT, parseRoute, pushRoute, type RouteMatch, type RouteParams } from './lib/router';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

const Landing = lazy(() => import('./pages/Landing'));
const Auth = lazy(() => import('./pages/Auth'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Members = lazy(() => import('./pages/Members'));
const Sessions = lazy(() => import('./pages/Sessions'));
const Documents = lazy(() => import('./pages/Documents'));
const Settings = lazy(() => import('./pages/Settings'));
const IoTDevice = lazy(() => import('./pages/IoTDevice'));
const VerifyCredential = lazy(() => import('./pages/VerifyCredential'));
const JoinWorkspace = lazy(() => import('./pages/JoinWorkspace'));

function RouteSkeleton() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[#030712] text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
        <p className="text-xs font-medium text-gray-400">Loading workspace frame…</p>
      </div>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState<RouteMatch>(() =>
    parseRoute(window.location.pathname, window.location.hash),
  );
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.email) setUserEmail(data.session.user.email);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.email) {
        setUserEmail(session.user.email);
      } else if (event === 'SIGNED_OUT') {
        setUserEmail(undefined);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const syncRoute = () => {
      setRoute(parseRoute(window.location.pathname, window.location.hash));
    };
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener(NAVIGATE_EVENT, syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener(NAVIGATE_EVENT, syncRoute);
    };
  }, []);

  const navigate = (page: Page, params?: RouteParams) => {
    const matched = pushRoute(page, params);
    setRoute(matched);
  };

  const handleLogin = (email: string) => {
    setUserEmail(email);
  };

  if (route.page === 'landing') {
    return (
      <ErrorBoundary onResetToDashboard={() => navigate('dashboard')}>
        <Suspense fallback={<RouteSkeleton />}>
          <Landing navigate={(p) => navigate(p)} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (route.page === 'verify') {
    return (
      <ErrorBoundary onResetToDashboard={() => navigate('dashboard')}>
        <Suspense fallback={<RouteSkeleton />}>
          <VerifyCredential credentialId={route.credentialId} navigate={navigate} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (route.page === 'join') {
    return (
      <ErrorBoundary onResetToDashboard={() => navigate('dashboard')}>
        <Suspense fallback={<RouteSkeleton />}>
          <JoinWorkspace inviteCode={route.inviteCode} navigate={navigate} onJoined={handleLogin} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (route.page === 'login' || !userEmail) {
    return (
      <ErrorBoundary onResetToDashboard={() => navigate('landing')}>
        <Suspense fallback={<RouteSkeleton />}>
          <Auth navigate={(p) => navigate(p)} onLogin={handleLogin} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  const renderPage = () => {
    switch (route.page) {
      case 'dashboard':
        return <Dashboard navigate={navigate} />;
      case 'members':
        return <Members navigate={navigate} />;
      case 'sessions':
        return (
          <Sessions
            initialSessionId={route.sessionId}
            onSelectSessionId={(sid) => pushRoute('sessions', sid ? { sessionId: sid } : undefined)}
            navigate={navigate}
          />
        );
      case 'documents':
        return <Documents />;
      case 'settings':
        return <Settings />;
      case 'iot':
        return <IoTDevice />;
      default:
        return <Dashboard navigate={navigate} />;
    }
  };

  return (
    <Layout currentPage={route.page} navigate={navigate} userEmail={userEmail}>
      <ErrorBoundary key={route.page} onResetToDashboard={() => navigate('dashboard')}>
        <Suspense fallback={<RouteSkeleton />}>{renderPage()}</Suspense>
      </ErrorBoundary>
    </Layout>
  );
}
