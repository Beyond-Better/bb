import { JSX } from 'preact';
import { useAppState } from '../../hooks/useAppState.ts';
import { Toast } from '../Toast.tsx';
import { VersionDisplay } from '../Version/VersionDisplay.tsx';

interface ConnectionStatusProps {
  isCollapsed: boolean;
  className?: string;
}

export function ConnectionStatus({ isCollapsed, className = '' }: ConnectionStatusProps): JSX.Element {
  const appState = useAppState();

  return (
    <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-start pl-5'} ${className}`}>
      {/* Connection status indicator */}
      <div
        className={`w-2 h-2 rounded-full ${
          appState.value.status.isReady ? 'bg-green-500' : 'bg-red-500 animate-pulse'
        }`}
        title={appState.value.status.isReady ? 'Connected to BB server' : 'Not connected to BB server'}
      />

      {/* Show version info when not collapsed */}
      {!isCollapsed && (
        <>
          <span className='ml-2 text-sm text-gray-500'>
            Server {appState.value.status.isReady ? 'Connected' : 'Not connected'}
          </span>
          
          {/* Only show version when connected */}
          {appState.value.status.isReady && appState.value.apiClient && (
            <div className="ml-4">
              <VersionDisplay
                apiClient={appState.value.apiClient}
                className="text-sm"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}