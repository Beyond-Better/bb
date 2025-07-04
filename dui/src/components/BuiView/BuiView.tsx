// DEPRECATED
import { useEffect, useState } from 'preact/hooks';
import { getWindow } from '@tauri-apps/api/window';
import { ApiStatus } from '../../types/ApiStatus';

interface BuiViewProps {
  serverStatus: ApiStatus;
}

export function BuiView({ serverStatus }: BuiViewProps) {
  const [error, setError] = useState<string | null>(null);
  const buiUrl = 'https://chat.beyondbetter.app';

  useEffect(() => {
    if (serverStatus === ApiStatus.Ready) {
      const init = async () => {
        try {
          // Get the main window
          const mainWindow = await getWindow('main');
          
          // Create a webview in the main window
          await mainWindow.createWebview({
            url: buiUrl,
            parent: mainWindow,
            visible: true
          });
        } catch (err) {
          console.error('Error creating webview:', err);
          setError(err instanceof Error ? err.message : 'Failed to create webview');
        }
      };

      init();
    }
  }, [serverStatus]);

  if (serverStatus !== ApiStatus.Ready) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center p-4">
          <h3 className="text-lg font-semibold mb-2">API Server Not Ready</h3>
          <p className="text-gray-600">Please start the BB API server to use the BUI interface.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center p-4">
          <h3 className="text-lg font-semibold mb-2 text-red-600">Error Loading BUI</h3>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-4rem)]" id="bui-container">
      {/* The webview will be attached to this container */}
    </div>
  );
}