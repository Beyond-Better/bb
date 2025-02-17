# TLS Status Integration in BUI

## Overview

Add TLS information and status page access to the BUI Help Dialog, with considerations for future API endpoint integration.

## Changes Required

### 1. ApiClient Enhancement

Location: `bui/src/utils/ApiClient.ts`

Add new methods to support different response types and future endpoints:

```typescript
class ApiClient {
  // Existing methods...

  // New methods for different response types
  async getJson<T>(endpoint: string): Promise<T> {
    const response = await this.fetch(endpoint, {
      headers: {
        'Accept': 'application/json'
      }
    });
    return response.json();
  }

  async getHtml(endpoint: string): Promise<string> {
    const response = await this.fetch(endpoint, {
      headers: {
        'Accept': 'text/html'
      }
    });
    return response.text();
  }

  // Future endpoint methods
  async getStatus(): Promise<ApiStatus> {
    return this.getJson<ApiStatus>('/api/v1/status');
  }

  // Placeholder for future endpoints
  async listProjectFiles(): Promise<string[]> {
    return this.getJson<string[]>('/api/v1/files');
  }

  async getProjectSetup(): Promise<ProjectSetup> {
    return this.getJson<ProjectSetup>('/api/v1/project/setup');
  }
}

// Add types for API responses
interface ApiStatus {
  status: string;
  message: string;
  platform: string;
  platformDisplay: string;
  trustStoreLocation?: string;
  tls: {
    enabled: boolean;
    certType?: 'custom' | 'self-signed';
    certPath?: string;
    certSource?: 'config' | 'project' | 'global';
    validFrom?: string;
    validUntil?: string;
    issuer?: string;
    subject?: string;
    expiryStatus?: 'valid' | 'expiring' | 'expired';
  };
  configType: 'project' | 'global';
  projectName?: string;
}
```

### 2. Status Dialog Component

Create new component for displaying the HTML status page:

Location: `bui/src/components/Status/StatusDialog.tsx`

```typescript
import { Dialog } from '@headlessui/react';
import { useApiClient } from '../../hooks/useApiClient';
import { useState, useEffect } from 'react';

export function StatusDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [html, setHtml] = useState('');
  const apiClient = useApiClient();

  useEffect(() => {
    if (isOpen) {
      apiClient.getHtml('/api/v1/status')
        .then(setHtml)
        .catch(console.error);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-4xl rounded bg-white p-6 shadow-xl">
          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
          <button
            onClick={onClose}
            className="mt-4 rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            Close
          </button>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
```

### 3. Update Help Dialog

Location: `bui/src/components/Help/HelpDialog.tsx`

Add TLS section and status integration:

```typescript
import { useState } from 'react';
import { useApiClient } from '../../hooks/useApiClient';
import { StatusDialog } from '../Status/StatusDialog';

export function HelpDialog({ isOpen, onClose }) {
  const [showStatus, setShowStatus] = useState(false);
  const [status, setStatus] = useState<ApiStatus | null>(null);
  const apiClient = useApiClient();

  // Fetch status when dialog opens
  useEffect(() => {
    if (isOpen) {
      apiClient.getStatus()
        .then(setStatus)
        .catch(console.error);
    }
  }, [isOpen]);

  return (
    <>
      <Dialog open={isOpen} onClose={onClose}>
        {/* Existing help content... */}
        
        <div className="mt-6">
          <h3 className="text-lg font-semibold">API Security</h3>
          
          <div className="mt-2 space-y-2">
            <p>
              BB uses TLS (HTTPS) to secure communication between the browser and API.
              This ensures your data remains private and protected.
            </p>

            {status && (
              <div className="rounded-md bg-gray-50 p-4">
                <p>
                  TLS Status: {' '}
                  <span className={status.tls.enabled ? 'text-green-600' : 'text-yellow-600'}>
                    {status.tls.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </p>
                
                {status.tls.enabled && status.tls.certType === 'self-signed' && (
                  <p className="mt-2 text-sm text-gray-600">
                    Using a self-signed certificate. You may see browser security warnings.
                    This is normal for local development.
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 flex space-x-4">
              <button
                onClick={() => setShowStatus(true)}
                className="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
              >
                View Full Status
              </button>
              
              <a
                href="/api/v1/status"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-blue-500 px-4 py-2 text-blue-500 hover:bg-blue-50"
              >
                Open in New Tab
              </a>
            </div>
          </div>
        </div>
      </Dialog>

      <StatusDialog isOpen={showStatus} onClose={() => setShowStatus(false)} />
    </>
  );
}
```

### 4. Add Status Link to Toolbar

Location: `bui/src/components/ToolBar.tsx`

Add a status button that opens the status dialog:

```typescript
import { StatusDialog } from './Status/StatusDialog';

export function ToolBar() {
  const [showStatus, setShowStatus] = useState(false);

  return (
    <div className="flex items-center space-x-4">
      {/* Existing toolbar items... */}
      
      <button
        onClick={() => setShowStatus(true)}
        className="rounded-md bg-gray-100 p-2 hover:bg-gray-200"
        title="View API Status"
      >
        <StatusIcon className="h-5 w-5" />
      </button>

      <StatusDialog isOpen={showStatus} onClose={() => setShowStatus(false)} />
    </div>
  );
}
```

## Future Considerations

1. API Client Enhancement:
   - Add TypeScript interfaces for all API responses
   - Consider implementing request caching
   - Add retry logic for failed requests
   - Add request queue for rate limiting

2. Status Integration:
   - Add WebSocket status monitoring
   - Show real-time certificate expiry warnings
   - Add certificate renewal functionality
   - Integrate with system notifications

3. Project File Integration:
   - Implement file browser component
   - Add file search functionality
   - Implement file type icons
   - Add file preview capabilities

4. Project Setup:
   - Add setup wizard component
   - Implement configuration editor
   - Add validation for settings
   - Include preset configurations

## Implementation Steps

1. Create new ApiClient methods
2. Add TypeScript interfaces
3. Create StatusDialog component
4. Update HelpDialog
5. Add toolbar integration
6. Add tests for new components
7. Update documentation

## Testing

Add the following test files:

1. `bui/test/StatusDialog.test.tsx`
2. `bui/test/ApiClient.test.ts`
3. Update `bui/test/HelpDialog.test.tsx`
4. Update `bui/test/ToolBar.test.tsx`

## Documentation

Update the following documentation:

1. Add new section in BUI documentation about status integration
2. Update API client documentation
3. Add component documentation
4. Update testing documentation

## Notes

- Consider using React Query for API data management
- Consider using React Router for status page routing
- Consider adding error boundary for status display
- Consider adding loading states for status fetching