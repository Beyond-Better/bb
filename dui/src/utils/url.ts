import { ApiConfig, BuiConfig } from '../types/api';
import { ProxyInfo } from './proxy';

interface UrlConfig {
  apiConfig: ApiConfig;
  buiConfig: BuiConfig;
  proxyInfo?: ProxyInfo;
  debugMode: boolean;
}

export function generateWebviewBuiUrl({ apiConfig, buiConfig, proxyInfo, debugMode }: UrlConfig): string {
  console.debug('generateWebviewBuiUrl called with:', {
    apiConfig,
    buiConfig,
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
    // In TLS mode or without proxy info, use direct connection
    //baseUrl = debugMode ? 'https://localhost:8080' : 'https://chat.beyondbetter.dev';
	baseUrl = `${buiConfig.tls.useTls ? 'https' : 'http'}://${buiConfig.hostname}:${buiConfig.port}`
    console.debug('Using TLS mode with baseUrl', baseUrl);
    const url = `${baseUrl}/${queryString ? `#${queryString}` : ''}`;
    console.debug('Generated direct HTTPS URL:', url);
    return url;
  } else if (proxyInfo) {
    console.debug(`Using proxy on port ${proxyInfo.port}`);
    // When using proxy, connect through localhost:proxyPort
    const url = `http://localhost:${proxyInfo.port}/`;
    console.debug('Generated proxy URL:', url);
    return url;
  } else {
    // Fallback to direct HTTPS connection if no proxy available
    //baseUrl = debugMode ? 'https://localhost:8080' : 'https://chat.beyondbetter.dev';
	baseUrl = `${buiConfig.tls.useTls ? 'https' : 'http'}://${buiConfig.hostname}:${buiConfig.port}`
    console.debug('No proxy info available, falling back to direct HTTPS', baseUrl);
    return `${baseUrl}/${queryString ? `#${queryString}` : ''}`;
  }
}




/**
 * Generates the BUI URL with platform parameter for Tauri environment
 * Same as generateWebviewBuiUrl but adds a platform=tauri parameter
 * This allows JavaScript to detect when it's running inside Tauri
 */
export function generateWebviewBuiUrlWithPlatform(standardUrl: string): string {
  // Start with the standard URL
  //const standardUrl = generateWebviewBuiUrl(config);
  
  // Extract hash fragment if it exists
  const [baseUrl, hashFragment] = standardUrl.split('#');
  
  // Create new hash params including platform
  const hashParams = hashFragment 
    ? `${hashFragment}&platform=tauri` 
    : 'platform=tauri';
    
  return `${baseUrl}#${hashParams}`;
}