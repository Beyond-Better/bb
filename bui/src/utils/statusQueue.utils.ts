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

		// Process all messages that are ready
		while (this.queue.length > 0) {
			const nextMessage = this.queue[0];

			// If this is a very quick status change and not the final message, skip it
			if (
				this.queue.length > 1 &&
				nextMessage.statementCount === this.queue[1].statementCount &&
				nextMessage.timestamp + this.minDisplayTime > now
			) {
				this.queue.shift(); // Remove the quick status
				continue;
			}

			// Update the status
			this.currentStatus = nextMessage;
			this.lastUpdateTime = now;
			this.queue.shift();
			console.log('StatusQueue: Updating status:', nextMessage);
			this.updateCallback(nextMessage);
			break;
		}

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
