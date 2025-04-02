import { invoke } from '@tauri-apps/api/core';

export interface ProxyInfo {
    port: number;
    target: string;
    is_running: boolean;
}

export async function getProxyInfo(): Promise<ProxyInfo> {
    // Add type assertion to ensure we get the expected shape
    type ProxyResponse = { port: number; target: string; };
    console.debug('getProxyInfo function called');
    console.debug('Preparing to invoke get_proxy_info command...');
    try {
        console.debug('Sending invoke call to get_proxy_info...');
        const response = await invoke<ProxyResponse>('get_proxy_info');
        console.debug('Invoke call completed');
        console.debug('Raw response from backend:', {
            received: response,
            type: typeof response,
            keys: response ? Object.keys(response) : 'null'
        });
        
        // Validate response shape
        if (!response || typeof response.port !== 'number' || typeof response.target !== 'string') {
            console.error('Invalid proxy info response:', {
                response,
                portType: response ? typeof response.port : 'undefined',
                targetType: response ? typeof response.target : 'undefined'
            });
            throw new Error('Invalid proxy info response format');
        }
        
        const info: ProxyInfo = {
            port: response.port,
            target: response.target
        };
        console.debug('Received proxy info from backend:', info);
        return info;
    } catch (error) {
        console.error('Failed to get proxy info:', error);
        console.debug('Error details:', {
            message: error.message,
            stack: error.stack,
            error
        });
        throw error;
    }
}

export async function setDebugMode(debug_mode: boolean): Promise<void> {
    console.debug('Setting debug mode to:', debug_mode);
    return invoke('set_debug_mode', { debug_mode });
}

export async function setProxyTarget(target: string): Promise<void> {
    console.debug('Setting proxy target to:', target);
    return invoke('set_proxy_target', { target });
}

// Helper function to determine if proxy should be used
export function shouldUseProxy(useTls: boolean): boolean {
    const useProxy = !useTls;
    console.debug(`Should use proxy? ${useProxy} (TLS: ${useTls})`);

    return !useTls; // Only use proxy when TLS is disabled
}

// Start proxy server function to match API/BUI pattern
export async function startProxyServer(): Promise<{ success: boolean; error?: string }> {
    console.debug('Starting proxy server...');
    try {
        await invoke('start_proxy_server');
        console.debug('Proxy server started successfully');
        return { success: true };
    } catch (error) {
        console.error('Failed to start proxy server:', error);
        return { 
            success: false, 
            error: (error instanceof Error) ? (error.message || 'Unknown error') : error 
        };
    }
}

// Stop proxy server function to match API/BUI pattern
export async function stopProxyServer(): Promise<{ success: boolean; error?: string }> {
    console.debug('Stopping proxy server...');
    try {
        await invoke('stop_proxy_server');
        console.debug('Proxy server stopped successfully');
        return { success: true };
    } catch (error) {
        console.error('Failed to stop proxy server:', error);
        return { 
            success: false, 
            error: (error instanceof Error) ? (error.message || 'Unknown error') : error 
        };
    }
}