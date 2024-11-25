import { useEffect, useRef } from 'preact/hooks';
import type { RefObject } from 'preact/compat';
import { LoadingSpinner } from './LoadingSpinner.tsx';
import { Action, InputStatusBar } from './InputStatusBar.tsx';
import { isProcessing, Status } from '../types/chat.types.ts';
import { ApiStatus } from 'shared/types.ts';

interface ChatInputRef {
	textarea: HTMLTextAreaElement;
	adjustHeight: () => void;
}

interface ChatInputProps {
	onCancelProcessing?: () => void;
	value: string;
	onChange: (value: string) => void;
	onSend: () => void;
	textareaRef?: RefObject<ChatInputRef>;
	status: Status;
	disabled?: boolean;
	maxLength?: number;
}

const inputMaxCharLength = 5000;
const inputMaxScrollHeight = 350;

export function ChatInput({
	value,
	onChange,
	onSend,
	textareaRef: externalRef,
	status,
	disabled = false,
	maxLength = inputMaxCharLength,
	onCancelProcessing,
}: ChatInputProps) {
	const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
	const internalRef = useRef<ChatInputRef | null>(null);

	const adjustTextareaHeight = () => {
		if (internalTextareaRef.current) {
			internalTextareaRef.current.style.height = 'auto';
			const newHeight = Math.min(internalTextareaRef.current.scrollHeight, inputMaxScrollHeight);
			internalTextareaRef.current.style.height = `${newHeight}px`;
		}
	};

	useEffect(() => {
		if (internalTextareaRef.current) {
			const ref: ChatInputRef = {
				textarea: internalTextareaRef.current,
				adjustHeight: adjustTextareaHeight,
			};
			internalRef.current = ref;
			if (externalRef) {
				externalRef.current = ref;
			}
		}
	}, [internalTextareaRef.current]);

	useEffect(() => {
		adjustTextareaHeight();
	}, [value]);

	const handleInput = (e: Event) => {
		const target = e.target as HTMLTextAreaElement;
		onChange(target.value);
	};

	const handleKeyPress = (e: KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey && !disabled && !status.isLoading && !isProcessing(status)) {
			e.preventDefault();
			onSend();
		}
	};

	// Determine status message and type
	const getStatusInfo = () => {
		// Check critical states first
		if (!status.isReady) {
			return {
				message: 'Connecting to server...',
				type: 'warning' as const,
				visible: true,
				status: ApiStatus.IDLE,
			};
		}

		if (status.isLoading) {
			return {
				message: 'Sending message...',
				type: 'info' as const,
				visible: true,
				status: ApiStatus.API_BUSY,
			};
		}

		if (disabled) {
			return {
				message: 'Chat is currently unavailable',
				type: 'error' as const,
				visible: true,
				status: ApiStatus.ERROR,
			};
		}

		// Then handle specific API states
		switch (status.apiStatus) {
			case ApiStatus.LLM_PROCESSING:
				return {
					message: 'Claude is thinking...',
					type: 'info' as const,
					status: status.apiStatus,
					visible: true,
					action: onCancelProcessing
						? {
							label: 'Stop',
							onClick: onCancelProcessing,
							variant: 'danger',
						}
						: undefined,
				};

			case ApiStatus.TOOL_HANDLING:
				return {
					message: `Using tool: ${status.toolName || 'unknown'}`,
					type: 'info' as const,
					visible: true,
					status: status.apiStatus,
					action: onCancelProcessing
						? {
							label: 'Stop',
							onClick: onCancelProcessing,
							variant: 'danger',
						}
						: undefined,
				};

			case ApiStatus.API_BUSY:
				return {
					message: 'API is processing...',
					type: 'info' as const,
					visible: true,
					status: status.apiStatus,
				};

			case ApiStatus.ERROR:
				return {
					message: 'An error occurred',
					type: 'error' as const,
					visible: true,
					status: status.apiStatus,
				};

			case ApiStatus.IDLE:
				// Explicitly handle IDLE state
				return {
					message: '',
					type: 'info' as const,
					visible: false,
					status: ApiStatus.IDLE,
				};

			default:
				// Handle any future status types
				console.warn('Unknown API status:', status.apiStatus);
				return {
					message: '',
					type: 'info' as const,
					visible: false,
					status: ApiStatus.IDLE,
				};
		}
	};

	const statusInfo = getStatusInfo();

	return (
		<div className='bg-white px-4 py-2'>
			<InputStatusBar
				visible={statusInfo.visible}
				message={statusInfo.message}
				status={statusInfo.status || ApiStatus.IDLE}
				action={statusInfo.action as Action}
				className='mx-1'
			/>

			<div className='flex items-end space-x-3'>
				<div className='flex-grow relative'>
					<textarea
						ref={internalTextareaRef}
						value={value}
						onInput={handleInput}
						onKeyPress={handleKeyPress}
						className={`w-full px-3 py-2 border rounded-md resize-none overflow-y-auto 
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      transition-all duration-200 max-h-[200px]
                      ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
                      ${isProcessing(status) ? 'border-blue-200 bg-white' : ''}`}
						placeholder={isProcessing(status)
							? 'Type your message... (Statement in progress)'
							: 'Type your message... (Shift + Enter for new line)'}
						rows={1}
						maxLength={maxLength}
						disabled={disabled}
						aria-label='Message input'
					/>
					<div className='absolute bottom-2 right-2 flex items-center space-x-2'>
						<span
							className={`text-xs ${value.length > maxLength * 0.9 ? 'text-red-500' : 'text-gray-400'}`}
						>
							{value.length} / {maxLength}
						</span>
					</div>
				</div>
				<button
					onClick={onSend}
					className={`px-4 py-2 mb-1 rounded-md transition-colors 
                    focus:outline-none focus:ring-2 focus:ring-blue-500 
                    focus:ring-opacity-50 min-w-[60px] ml-2
                    ${
						isProcessing(status)
							? 'bg-gray-100 text-gray-400 cursor-not-allowed'
							: disabled
							? 'bg-gray-300 cursor-not-allowed'
							: 'bg-blue-500 text-white hover:bg-blue-600'
					}`}
					disabled={status.isLoading || disabled || isProcessing(status)}
					aria-label={status.isLoading ? 'Sending message...' : 'Send message'}
				>
					{status.isLoading ? <LoadingSpinner size='small' color='text-white' /> : 'Send'}
				</button>
			</div>
		</div>
	);
}
