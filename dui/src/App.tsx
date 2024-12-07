import { ServerControl } from "./components/ServerControl/ServerControl";
import { Header } from "./components/Header/Header";
import { Settings } from "./components/Settings/Settings";
import { VersionProvider } from "./providers/VersionProvider";
import { VersionUpgradePrompt } from "./components/VersionUpgradePrompt/VersionUpgradePrompt";
import { useState, useEffect } from "preact/hooks";
import { ApiStatus } from "./types/ApiStatus";
import "./App.css";

function App() {
  const [serverStatus, setServerStatus] = useState(ApiStatus.Ready);
  const [isConnected, setIsConnected] = useState(true);
  const [currentRoute, setCurrentRoute] = useState('/');

  useEffect(() => {
    // Handle browser back/forward buttons
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState(null, '', path);
    setCurrentRoute(path);
  };

  const handleStatusChange = (status: any) => {
    if (status.error) {
      setServerStatus(ApiStatus.Error);
    } else if (status.api_responds) {
      setServerStatus(ApiStatus.Ready);
    } else if (status.process_responds) {
      setServerStatus(ApiStatus.Processing);
    } else {
      setServerStatus(ApiStatus.Error);
    }
  };

  const handleConnectionChange = (isConnected: boolean) => {
    setIsConnected(isConnected);
  };

  return (
    <VersionProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header 
          serverStatus={serverStatus}
          isConnected={isConnected}
          onNavigate={navigate}
        />
        <main className="container mx-auto px-4 py-8">
          <VersionUpgradePrompt />
          {currentRoute === '/' && (
            <ServerControl 
              onStatusChange={handleStatusChange}
              onConnectionChange={handleConnectionChange}
            />
          )}
          {currentRoute === '/settings' && (
            <Settings />
          )}
        </main>
      </div>
    </VersionProvider>
  );
}

export default App;