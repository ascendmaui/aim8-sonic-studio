import React, { useEffect, useState, Suspense } from 'react';
import './index.css';
import { AuthProvider } from './components/AuthContext';
import { useNetworkStatus } from './hooks';
import LoadingScreen from './components/LoadingScreen';
import NotFound from './components/NotFound';
import ApiKeySetup from './components/ApiKeySetup';
import { hasRequiredKeys, onKeysChange } from './services/byok';

const VoiceStudio = React.lazy(() => import('./components/VoiceStudio'));
const InteractiveBackground = React.lazy(() => import('./components/InteractiveBackground'));

/** Non-intrusive offline indicator bar */
function OfflineBar({ isOnline }: { isOnline: boolean }) {
  if (isOnline) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-slate-950 text-center py-2 px-4 text-xs font-bold tracking-wide shadow-lg">
      ⚠️ You&apos;re offline — generation needs an internet connection
    </div>
  );
}

function AppContent() {
  const { isOnline } = useNetworkStatus();
  const [keysReady, setKeysReady] = useState(hasRequiredKeys());

  useEffect(() => onKeysChange(() => setKeysReady(hasRequiredKeys())), []);

  if (window.location.pathname !== '/') {
    return <NotFound />;
  }

  // BYOK only: until the user enters their own keys, show the key prompt and nothing else.
  if (!keysReady) {
    return <ApiKeySetup onSaved={() => setKeysReady(hasRequiredKeys())} />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <div className="h-[100dvh] bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-purple-900 to-slate-900 text-white selection:bg-cyan-500/30 relative overflow-hidden flex shadow-[inset_0_0_120px_rgba(34,211,238,0.15)]">
        <OfflineBar isOnline={isOnline} />
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/15 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '3s' }} />
        </div>
        <InteractiveBackground />
        <main className="relative z-10 flex-1 w-full h-full overflow-hidden">
          <VoiceStudio />
        </main>
      </div>
    </Suspense>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
