import { ServerControl } from "./components/ServerControl/ServerControl";
import { Header } from "./components/Header/Header";
import { VersionProvider } from "./providers/VersionProvider";
import { VersionUpgradePrompt } from "./components/VersionUpgradePrompt/VersionUpgradePrompt";
import { useState } from "preact/hooks";
import { ApiStatus } from "./types/ApiStatus";
import "./App.css";

function App() {
  const [serverStatus, setServerStatus] = useState(ApiStatus.Ready);
  const [isConnected, setIsConnected] = useState(true);

  const handleStatusChange = (status: any) => {
    // Map API status to our enum
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
        />
        <main className="container mx-auto px-4 py-8">
          <VersionUpgradePrompt />
          <ServerControl 
            onStatusChange={handleStatusChange}
            onConnectionChange={handleConnectionChange}
          />
        </main>
      </div>
    </VersionProvider>
  );
}

export default App;