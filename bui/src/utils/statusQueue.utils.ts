import { ApiStatus } from 'shared/types.ts';

interface StatusMessage {
	status: ApiStatus;
	timestamp: number;
	statementCount: number;
	sequence: number;
	metadata?: {
		toolName?: string;
		error?: string;
	};
}

export class StatusQueue {
	private queue: StatusMessage[] = [];
	private currentStatus: StatusMessage | null = null;
	private lastUpdateTime: number = 0;
	private minDisplayTime: number = 500; // Minimum display time in ms
	private updateCallback: (status: StatusMessage) => void;

	constructor(updateCallback: (status: StatusMessage) => void) {
		this.updateCallback = updateCallback;
	}

	addMessage(message: StatusMessage) {
		console.log('StatusQueue: Adding message:', message);
		// Ignore messages from previous statements
		if (this.currentStatus && message.statementCount < this.currentStatus.statementCount) {
			return;
		}

		// Add to queue sorted by sequence number
		this.queue.push(message);
		this.queue.sort((a, b) => {
			if (a.statementCount !== b.statementCount) {
				return a.statementCount - b.statementCount;
			}
			return a.sequence - b.sequence;
		});

		this.processQueue();
	}

	private processQueue() {
		//console.log('StatusQueue: Processing queue, length:', this.queue.length);
		const now = Date.now();
		const timeSinceLastUpdate = now - this.lastUpdateTime;

		// If we haven't waited long enough since the last update, schedule a check
		if (this.currentStatus && timeSinceLastUpdate < this.minDisplayTime) {
			setTimeout(() => this.processQueue(), this.minDisplayTime - timeSinceLastUpdate);
			return;
		}

		// If queue is empty, nothing to do
		if (this.queue.length === 0) return;

		// Get the last message in the current batch (messages for the same statement)
		const currentMessage = this.queue[0];
		const currentStatementCount = currentMessage.statementCount;
		let lastMessageInBatch = currentMessage;
		let batchSize = 1;

		// Look ahead to find all messages in the same batch
		for (let i = 1; i < this.queue.length; i++) {
			if (this.queue[i].statementCount === currentStatementCount) {
				lastMessageInBatch = this.queue[i];
				batchSize++;
			} else {
				break;
			}
		}

		// If we have multiple messages in the batch and the last one is recent
		if (batchSize > 1 && lastMessageInBatch.timestamp + (this.minDisplayTime / 2) > now) {
			// Wait a short time to see if more messages arrive
			setTimeout(() => this.processQueue(), this.minDisplayTime / 2);
			return;
		}

		// Process the last message in the batch
		this.currentStatus = lastMessageInBatch;
		this.lastUpdateTime = now;
		// Remove all messages up to and including the one we're processing
		this.queue.splice(0, batchSize);
		console.log('StatusQueue: Updating status:', lastMessageInBatch);
		this.updateCallback(lastMessageInBatch);

		// If there are more messages, schedule the next check
		if (this.queue.length > 0) {
			setTimeout(() => this.processQueue(), this.minDisplayTime);
		}
	}

	reset() {
		this.queue = [];
		this.currentStatus = null;
		this.lastUpdateTime = 0;
	}
}
