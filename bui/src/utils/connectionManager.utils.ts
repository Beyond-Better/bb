/**
 * Connection manager utility to handle protocol detection, validation, and fallback.
 * This centralizes the logic for protocol handling across both API and WebSocket connections.
 */

import { getApiHostname, getApiPort, getApiUseTls } from './url.utils.ts';

interface ConnectionDetails {
  hostname: string;
  port: string;
  useTls: boolean;
}

interface ConnectionStatus {
  success: boolean;
  useTls: boolean;
  error?: Error;
}

// Local storage key for protocol preference
const PROTOCOL_PREFERENCE_KEY = 'bb_preferred_protocol';

/**
 * Get connection details from URL parameters or localStorage
 */
export function getConnectionDetails(): ConnectionDetails {
  const hostname = getApiHostname();
  const port = getApiPort();
  const useTls = getApiUseTls();
  
  return { hostname, port, useTls };
}

/**
 * Get API URL with the specified protocol
 */
export function getApiUrl(hostname: string, port: string, useTls: boolean): string {
  return `${useTls ? 'https' : 'http'}://${hostname}:${port}`;
}

/**
 * Get WebSocket URL with the specified protocol
 */
export function getWsUrl(hostname: string, port: string, useTls: boolean): string {
  return `${useTls ? 'wss' : 'ws'}://${hostname}:${port}/api/v1/ws`;
}

/**
 * Test if the specified API endpoint is reachable with the given protocol
 */
export async function testApiConnection(hostname: string, port: string, useTls: boolean): Promise<ConnectionStatus> {
  const url = getApiUrl(hostname, port, useTls);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`${url}/api/v1/status`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    return {
      success: response.ok,
      useTls,
      error: response.ok ? undefined : new Error(`HTTP error: ${response.status}`)
    };
  } catch (error) {
    console.error(`Connection test failed for ${url}:`, error);
    return {
      success: false,
      useTls,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

/**
 * Get the preferred protocol from localStorage
 */
export function getPreferredProtocol(): boolean | null {
  try {
    const preference = localStorage.getItem(PROTOCOL_PREFERENCE_KEY);
    return preference !== null ? preference === 'true' : null;
  } catch (e) {
    return null;
  }
}

/**
 * Save the preferred protocol to localStorage
 */
export function savePreferredProtocol(useTls: boolean): void {
  try {
    localStorage.setItem(PROTOCOL_PREFERENCE_KEY, String(useTls));
  } catch (e) {
    console.warn('Failed to save protocol preference to localStorage:', e);
  }
}

/**
 * Get a working API URL, falling back to alternate protocol if needed
 */
export async function getWorkingApiUrl(): Promise<{
  apiUrl: string;
  wsUrl: string;
  useTls: boolean;
  fallbackUsed: boolean;
}> {
  const { hostname, port, useTls: initialUseTls } = getConnectionDetails();
  const preferredProtocol = getPreferredProtocol();
  
  // Use explicit preference from localStorage if available, otherwise use URL parameter
  const primaryUseTls = preferredProtocol !== null ? preferredProtocol : initialUseTls;
  
  console.info('ConnectionManager: Testing connection with', {
    initialProtocol: initialUseTls ? 'HTTPS/WSS' : 'HTTP/WS',
    preferredProtocol: preferredProtocol !== null ?
      (preferredProtocol ? 'HTTPS/WSS' : 'HTTP/WS') : 'None',
    primaryProtocol: primaryUseTls ? 'HTTPS/WSS' : 'HTTP/WS'
  });
  
  // First try the primary protocol
  const primaryStatus = await testApiConnection(hostname, port, primaryUseTls);
  
  if (primaryStatus.success) {
    console.info('ConnectionManager: Primary protocol connection successful');
    savePreferredProtocol(primaryUseTls);
    return {
      apiUrl: getApiUrl(hostname, port, primaryUseTls),
      wsUrl: getWsUrl(hostname, port, primaryUseTls),
      useTls: primaryUseTls,
      fallbackUsed: false
    };
  }
  
  // If primary protocol fails, try the alternative
  console.warn(
    'ConnectionManager: Primary protocol connection failed, trying alternate protocol',
    primaryStatus.error
  );
  
  const alternateUseTls = !primaryUseTls;
  const alternateStatus = await testApiConnection(hostname, port, alternateUseTls);
  
  if (alternateStatus.success) {
    console.info('ConnectionManager: Alternate protocol connection successful');
    savePreferredProtocol(alternateUseTls);
    return {
      apiUrl: getApiUrl(hostname, port, alternateUseTls),
      wsUrl: getWsUrl(hostname, port, alternateUseTls),
      useTls: alternateUseTls,
      fallbackUsed: true
    };
  }
  
  // If both protocols fail, return the original protocol with a warning
  console.error(
    'ConnectionManager: Both protocols failed, defaulting to primary protocol',
    { primaryError: primaryStatus.error, alternateError: alternateStatus.error }
  );
  
  return {
    apiUrl: getApiUrl(hostname, port, primaryUseTls),
    wsUrl: getWsUrl(hostname, port, primaryUseTls),
    useTls: primaryUseTls,
    fallbackUsed: false
  };
}