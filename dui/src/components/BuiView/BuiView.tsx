import { useEffect, useState } from 'preact/hooks';
import { ApiStatus } from '../../types/ApiStatus';

interface BuiViewProps {
  serverStatus: ApiStatus;
}

export function BuiView({ serverStatus }: BuiViewProps) {
  // Replace with actual cloud BUI URL
  const buiUrl = 'https://chat.bbai.tips';
  
  return (
    <div className="w-full h-full">
      {serverStatus === ApiStatus.Ready ? (
        <webview 
          src={buiUrl}
          className="w-full h-[calc(100vh-4rem)]"
          // Allow communication with local API
          webpreferences="contextIsolation=false"
        />
      ) : (
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="text-center p-4">
            <h3 className="text-lg font-semibold mb-2">API Server Not Ready</h3>
            <p className="text-gray-600">Please start the BB API server to use the BUI interface.</p>
          </div>
        </div>
      )}
    </div>
  );
}