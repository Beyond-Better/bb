import { ApiConfig } from '../types/api';

/**
 * Generates the BUI URL with only non-default values included in the parameters
 */
export function generateBuiUrl(apiConfig: ApiConfig, debugMode: boolean = false): string {
  const params = new URLSearchParams();
  
  // Only add parameters that differ from defaults
  if (apiConfig.hostname && apiConfig.hostname !== 'localhost') {
    params.append('apiHostname', apiConfig.hostname);
  }
  
  if (apiConfig.port && apiConfig.port !== 3162) {
    params.append('apiPort', apiConfig.port.toString());
  }
  
  if (apiConfig.tls.useTls) {
    params.append('apiUseTls', 'true');
  }
  
  const queryString = params.toString();
  // In debug mode, use localhost
  const buiHostname = debugMode ? 'localhost:8080' : 'chat.beyondbetter.dev';
  return `https://${buiHostname}/${queryString ? `#${queryString}` : ''}`;
}