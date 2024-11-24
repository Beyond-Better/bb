import { LLMProviderMessageMeta, LLMProviderMessageResponse } from 'api/types/llms.ts';
import {
	ApiStatus,
	ConversationContinue,
	ConversationDeleted,
	ConversationId,
	ConversationLogEntryType,
	ConversationMetrics,
	ConversationNew,
	ConversationResponse,
	ConversationStart,
} from 'shared/types.ts';
import { logger } from 'shared/logger.ts';

export type EventMap = {
	projectEditor: {
		conversationNew: ConversationNew;
		conversationDeleted: ConversationDeleted;
		speakWith: { conversationId: ConversationId; startDir: string; prompt: string };
		conversationReady: ConversationStart;
		conversationContinue: ConversationContinue;
		conversationAnswer: ConversationResponse;
		conversationCancelled: { conversationId: ConversationId; message: string };
		progressStatus: {
			type: 'progress_status';
			status: ApiStatus;
			timestamp: string;
			statementCount: number;
			sequence: number;
			metadata?: {
				toolName?: string;
				error?: string;
			};
		};
		promptCacheTimer: {
			type: 'prompt_cache_timer';
			startTimestamp: number;
			duration: number;
		};
		conversationError: {
			conversationId: ConversationId;
			conversationTitle: string;
			conversationStats: ConversationMetrics;
			error: string;
			code?:
				| 'INVALID_CONVERSATION_ID'
				| 'EMPTY_PROMPT'
				| 'LARGE_PROMPT'
				| 'INVALID_START_DIR'
				| 'CONVERSATION_IN_USE';
		};
	};
	cli: {
		conversationNew: ConversationNew;
		conversationWaitForReady: { conversationId: ConversationId };
		conversationWaitForAnswer: { conversationId: ConversationId };
		conversationReady: ConversationStart;
		conversationContinue: ConversationContinue;
		conversationAnswer: ConversationResponse;
		websocketReconnected: { conversationId: ConversationId };
		progressStatus: {
			type: 'progress_status';
			status: ApiStatus;
			timestamp: string;
			statementCount: number;
			sequence: number;
			metadata?: {
				toolName?: string;
				error?: string;
			};
		};
		promptCacheTimer: {
			type: 'prompt_cache_timer';
			startTimestamp: number;
			duration: number;
		};
		conversationError: {
			conversationId: ConversationId;
			error: string;
			code?:
				| 'INVALID_CONVERSATION_ID'
				| 'EMPTY_PROMPT'
				| 'LARGE_PROMPT'
				| 'INVALID_START_DIR'
				| 'CONVERSATION_IN_USE';
		};
	};
	logs: Record<string, unknown>;
	files: Record<string, unknown>;
};

export type EventPayload<T extends keyof EventMap, E extends EventName<T>> = E extends `${T}:${infer K}`
	? K extends keyof EventMap[T] ? EventMap[T][K] : never
	: never;

export type EventPayloadMap = {
	[T in keyof EventMap]: {
		[E in EventName<T>]: EventPayload<T, E>;
	};
};

export type EventName<T extends keyof EventMap> = T extends string ? `${T}:${string & keyof EventMap[T]}` : never;

export class TypedEvent<T> extends Event {
	constructor(public readonly detail: T, type: string) {
		super(type);
	}
}

class EventManager extends EventTarget {
	private static instance: EventManager;
	private listenerMap: Map<string, WeakMap<Function, EventListener>> = new Map();
	private listenerCounts: Map<string, number> = new Map();

	private constructor() {
		super();
	}

	static getInstance(): EventManager {
		if (!EventManager.instance) {
			EventManager.instance = new EventManager();
		}
		return EventManager.instance;
	}

	private getListenerKey(event: string, conversationId?: ConversationId): string {
		return `${event}:${conversationId || 'global'}`;
	}

	on<T extends keyof EventMap, E extends EventName<T>>(
		event: E,
		callback: (payload: EventPayload<T, E>) => void | Promise<void>,
		conversationId?: ConversationId,
	): void {
		const listenerKey = this.getListenerKey(event, conversationId);
		if (!this.listenerMap.has(listenerKey)) {
			this.listenerMap.set(listenerKey, new WeakMap());
			this.listenerCounts.set(listenerKey, 0);
		}
		const listenerWeakMap = this.listenerMap.get(listenerKey)!;

		const wrappedListener = ((e: TypedEvent<EventPayload<T, E>>) => {
			//logger.info(
			//	`EventManager: Handling event ${event} for conversation ${conversationId}`,
			//	e.detail.conversationId,
			//);
			if (
				!conversationId ||
				(e.detail && typeof e.detail === 'object' && 'conversationId' in e.detail &&
					e.detail.conversationId === conversationId)
			) {
				const result = callback(e.detail);
				if (result instanceof Promise) {
					result.catch((error) => logger.error(`EventManager: Error in event handler for ${event}:`, error));
				}
			}
		}) as EventListener;

		listenerWeakMap.set(callback, wrappedListener);
		this.addEventListener(event, wrappedListener);
		this.listenerCounts.set(listenerKey, (this.listenerCounts.get(listenerKey) || 0) + 1);
	}

	off<T extends keyof EventMap, E extends EventName<T>>(
		event: E,
		callback: (payload: EventPayload<T, E>) => void | Promise<void>,
		conversationId?: ConversationId,
	): void {
		//logger.info(
		//	`EventManager: Attempting to remove listener for event: ${event}, conversationId: ${conversationId}`,
		//);

		const listenerKey = this.getListenerKey(event, conversationId);
		const listenerWeakMap = this.listenerMap.get(listenerKey);
		if (listenerWeakMap) {
			const wrappedListener = listenerWeakMap.get(callback);
			if (wrappedListener) {
				this.removeEventListener(event, wrappedListener);
				listenerWeakMap.delete(callback);
				const currentCount = this.listenerCounts.get(listenerKey) || 0;
				this.listenerCounts.set(listenerKey, Math.max(0, currentCount - 1));
			}
		}
	}

	once<T extends keyof EventMap, E extends EventName<T>>(
		event: E,
		conversationId?: ConversationId,
	): Promise<EventPayload<T, E>> {
		return new Promise((resolve) => {
			const handler = (payload: EventPayload<T, E>) => {
				this.off(event, handler, conversationId);
				resolve(payload);
			};
			this.on(event, handler, conversationId);
		});
	}

	emit<T extends keyof EventMap, E extends EventName<T>>(
		event: E,
		payload: EventPayloadMap[T][E],
	): boolean {
		//logger.info(`EventManager: Emitting event ${event}`, payload);
		//logger.info(`EventManager: Number of listeners for ${event}:`, this.listenerCount(event));
		return this.dispatchEvent(new TypedEvent(payload, event));
	}

	private listenerCount(event: string): number {
		const listenerKey = this.getListenerKey(event);
		return this.listenerCounts.get(listenerKey) || 0;
	}
}

export default EventManager;

export const eventManager = EventManager.getInstance();
