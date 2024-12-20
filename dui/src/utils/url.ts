import { ApiConfig } from '../types/api';
import { ProxyInfo } from './proxy';

interface UrlConfig {
  apiConfig: ApiConfig;
  proxyInfo?: ProxyInfo;
  debugMode: boolean;
}

/**
 * Generates the BUI URL with appropriate proxy handling and parameters
 */
export function generateWebviewBuiUrl({ apiConfig, proxyInfo, debugMode }: UrlConfig): string {
  console.debug('generateWebviewBuiUrl called with:', {
    apiConfig,
    proxyInfo,
    debugMode
  });
  const params = new URLSearchParams();
  
  // Only add API parameters if not using proxy
  if (apiConfig.tls.useTls) {
    console.debug('TLS enabled, using direct connection');
    // When using TLS, connect directly to API
    if (apiConfig.hostname && apiConfig.hostname !== 'localhost') {
      params.append('apiHostname', apiConfig.hostname);
    }
    
    if (apiConfig.port && apiConfig.port !== 3162) {
      params.append('apiPort', apiConfig.port.toString());
    }
    
    params.append('apiUseTls', 'true');
  }
  
  const queryString = params.toString();
  
  // Determine the base URL
  let baseUrl: string;
  console.debug('Constructing final URL...');
  if (apiConfig.tls.useTls) {
    console.debug('Using TLS mode with baseUrl');
    // In TLS mode or without proxy info, use direct connection
    baseUrl = debugMode ? 'localhost:8080' : 'chat.beyondbetter.dev';
    const url = `https://${baseUrl}/${queryString ? `#${queryString}` : ''}`;
    console.debug('Generated direct HTTPS URL:', url);
    return url;
  } else if (proxyInfo) {
    console.debug(`Using proxy on port ${proxyInfo.port}`);
    // When using proxy, connect through localhost:proxyPort
    const url = `http://localhost:${proxyInfo.port}/`;
    console.debug('Generated proxy URL:', url);
    return url;
  } else {
    console.debug('No proxy info available, falling back to direct HTTPS');
    // Fallback to direct HTTPS connection if no proxy available
    baseUrl = debugMode ? 'localhost:8080' : 'chat.beyondbetter.dev';
    return `https://${baseUrl}/${queryString ? `#${queryString}` : ''}`;
  }
}