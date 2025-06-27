import type { RefObject } from 'preact';

interface ChatInputRef {
	textarea: HTMLTextAreaElement;
	adjustHeight: () => void;
}

/**
 * Focuses the chat input textarea with retry logic to handle disabled state during conversation transitions.
 *
 * @param chatInputRef - Reference to the ChatInput component
 * @param maxAttempts - Maximum number of retry attempts (default: 20)
 * @param retryDelay - Delay between retry attempts in milliseconds (default: 100)
 * @returns Promise that resolves when focus is successful or max attempts reached
 */
export async function focusChatInput(
	chatInputRef: RefObject<ChatInputRef>,
	maxAttempts: number = 20,
	retryDelay: number = 100,
): Promise<void> {
	return new Promise((resolve) => {
		const attemptFocus = (attempts = 0) => {
			if (attempts >= maxAttempts) {
				resolve();
				return;
			}

			if (chatInputRef.current?.textarea && !chatInputRef.current.textarea.disabled) {
				try {
					chatInputRef.current.textarea.focus();
					resolve();
				} catch (error) {
					console.error('focusChatInput: Error focusing textarea:', error);
					resolve();
				}
			} else {
				// Textarea not ready or still disabled, try again
				setTimeout(() => attemptFocus(attempts + 1), retryDelay);
			}
		};

		// Start attempting to focus after a short delay
		setTimeout(() => attemptFocus(), retryDelay);
	});
}

/**
 * Focuses the chat input textarea synchronously (fire-and-forget).
 * Useful when you don't need to wait for the focus operation to complete.
 *
 * @param chatInputRef - Reference to the ChatInput component
 * @param maxAttempts - Maximum number of retry attempts (default: 20)
 * @param retryDelay - Delay between retry attempts in milliseconds (default: 100)
 */
export function focusChatInputSync(
	chatInputRef: RefObject<ChatInputRef>,
	maxAttempts: number = 20,
	retryDelay: number = 100,
): void {
	focusChatInput(chatInputRef, maxAttempts, retryDelay).catch(console.error);
}
