import { ApiConfig } from '../types/api';

/**
 * Generates the BUI URL with only non-default values included in the parameters
 */
export function generateBuiUrl(config: ApiConfig): string {
  const params = new URLSearchParams();
  
  // Only add parameters that differ from defaults
  if (config.apiHostname && config.apiHostname !== 'localhost') {
    params.append('apiHostname', config.apiHostname);
  }
  
  if (config.apiPort && config.apiPort !== 3162) {
    params.append('apiPort', config.apiPort.toString());
  }
  
  if (config.apiUseTls) {
    params.append('apiUseTls', 'true');
  }
  
  const queryString = params.toString();
  return `https://chat.beyondbetter.dev/${queryString ? `#${queryString}` : ''}`;
}