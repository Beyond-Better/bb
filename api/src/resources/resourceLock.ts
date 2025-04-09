import { createError } from '../utils/error.utils.ts';
import type { ConversationId } from 'shared/types.ts';

export class ResourceLock {
	private locks: Map<string, string>; // resourcePath -> interactionId

	constructor() {
		this.locks = new Map();
	}

	async acquireLock(resourcePath: string, interactionId: ConversationId, timeout: number = 5000): Promise<boolean> {
		const startTime = Date.now();
		while (Date.now() - startTime < timeout) {
			if (!this.locks.has(resourcePath)) {
				this.locks.set(resourcePath, interactionId);
				return true;
			}
			// Wait for a short time before trying again
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		return false;
	}

	releaseLock(resourcePath: string, interactionId: ConversationId): void {
		const lockHolder = this.locks.get(resourcePath);
		if (lockHolder === interactionId) {
			this.locks.delete(resourcePath);
		} else if (lockHolder) {
			throw createError(
				'UnauthorizedLockRelease',
				`Interaction ${interactionId} cannot release lock held by ${lockHolder}`,
			);
		}
	}

	isLocked(resourcePath: string): boolean {
		return this.locks.has(resourcePath);
	}

	getLockHolder(resourcePath: string): ConversationId | undefined {
		return this.locks.get(resourcePath);
	}

	clearAllLocks(): void {
		this.locks.clear();
	}
}
