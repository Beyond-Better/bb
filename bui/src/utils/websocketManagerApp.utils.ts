import { WebSocketManagerBaseImpl } from './websocketManagerBase.utils.ts';
import type { VersionInfo } from 'shared/types/version.ts';

interface AppWebSocketConfig {
    url: string;
    onMessage?: (message: any) => void;
    onError?: (error: Error) => void;
    onClose?: () => void;
    onOpen?: () => void;
}

interface AppWebSocketMessage {
    type: 'greeting';
}

interface AppWebSocketResponse {
    type: 'hello' | 'error';
    data: {
        versionInfo?: VersionInfo;
        error?: string;
    };
}

export class WebSocketManagerApp extends WebSocketManagerBaseImpl {
    constructor(config: AppWebSocketConfig) {
        super(config);
    }

    protected getWebSocketUrl(): string {
        return `${this.wsUrl}/app`;
    }

    protected override onSocketOpen(): void {
        this.sendGreeting();
    }

    private sendGreeting(): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.log('WebSocketManagerApp: Cannot send greeting - socket not ready');
            return;
        }

        const message: AppWebSocketMessage = {
            type: 'greeting'
        };

        console.log('WebSocketManagerApp: Sending greeting');
        this.socket.send(JSON.stringify(message));
    }

    protected handleMessage(event: MessageEvent): void {
        try {
            const msg = JSON.parse(event.data) as AppWebSocketResponse;
            console.log('WebSocketManagerApp: Received message:', msg.type);

            switch (msg.type) {
                case 'hello':
                    this._status.isConnecting = false;
                    this._status.isReady = true;
                    this.emit('readyChange', true);
                    this.emit('statusChange', true);
                    this.emit('clearError');

                    if (msg.data.versionInfo) {
                        this.emit('versionInfo', msg.data.versionInfo);
                    }

                    this.startHealthCheck();
                    break;

                case 'error':
                    console.error('WebSocketManagerApp: Error message:', msg.data);
                    if (msg.data.error) {
                        this.handleError(new Error(msg.data.error));
                    }
                    break;

                default:
                    console.warn('WebSocketManagerApp: Unknown message type:', msg.type);
            }
        } catch (error) {
            console.error('WebSocketManagerApp: Error processing message:', error);
            this.handleError(error as Error);
        }
    }
}

export function createWebSocketManagerApp(config: AppWebSocketConfig): WebSocketManagerApp {
    return new WebSocketManagerApp(config);
}