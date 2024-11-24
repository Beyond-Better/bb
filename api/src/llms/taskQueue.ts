import type { Task } from 'api/types.ts';
import type { ErrorHandler } from './errorHandler.ts';
import { logger } from 'shared/logger.ts';

export class TaskQueue {
	private queue: Task[];
	private running: boolean;
	private errorHandler: ErrorHandler;

	constructor(errorHandler: ErrorHandler) {
		this.queue = [];
		this.running = false;
		this.errorHandler = errorHandler;
	}

	addTask(task: Task): void {
		this.queue.push(task);
		if (!this.running) {
			this.processQueue();
		}
	}

	private async processQueue(): Promise<void> {
		this.running = true;
		while (this.queue.length > 0) {
			const task = this.queue.shift()!;
			try {
				await this.executeTask(task);
			} catch (error) {
				await this.errorHandler.handleError((error as Error), task, 0);
			}
		}
		this.running = false;
	}

	private async executeTask(task: Task): Promise<void> {
		logger.info(`Executing task: ${task.title}`);
		// Implement task execution logic here
		// This could involve calling the appropriate method to handle the task
		// based on its type and requirements
	}
}
