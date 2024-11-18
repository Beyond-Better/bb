import { useEffect, useRef } from 'preact/hooks';
import type { RefObject } from 'preact/compat';
import { LoadingSpinner } from './LoadingSpinner.tsx';
import { Action, InputStatusBar } from './InputStatusBar.tsx';

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
	status: {
		isConnecting: boolean;
		isLoading: boolean;
		isProcessing: boolean;
		isReady: boolean;
	};
	disabled?: boolean;
	maxLength?: number;
}

export function ChatInput({
	value,
	onChange,
	onSend,
	textareaRef: externalRef,
	status,
	disabled = false,
	maxLength = 4000,
	onCancelProcessing,
}: ChatInputProps) {
	const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
	const internalRef = useRef<ChatInputRef | null>(null);

	const adjustTextareaHeight = () => {
		if (internalTextareaRef.current) {
			internalTextareaRef.current.style.height = 'auto';
			const newHeight = Math.min(internalTextareaRef.current.scrollHeight, 200);
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
		if (e.key === 'Enter' && !e.shiftKey && !disabled && !status.isLoading && !status.isProcessing) {
			e.preventDefault();
			onSend();
		}
	};

	// Determine status message and type
	const getStatusInfo = () => {
		if (status.isProcessing) {
			return {
				message: 'Claude is working...',
				type: 'info' as const,
				visible: true,
				action: onCancelProcessing
					? {
						label: 'Stop',
						onClick: onCancelProcessing,
						variant: 'danger',
					}
					: undefined,
			};
		}
		if (!status.isReady) {
			return {
				message: 'Connecting to server...',
				type: 'warning' as const,
				visible: true,
			};
		}
		if (status.isProcessing) {
			return {
				message: 'Claude is working...',
				type: 'info' as const,
				visible: true,
			};
		}
		if (status.isLoading) {
			return {
				message: 'Sending message...',
				type: 'info' as const,
				visible: true,
			};
		}
		if (disabled) {
			return {
				message: 'Chat is currently unavailable',
				type: 'error' as const,
				visible: true,
			};
		}
		return {
			message: '',
			type: 'info' as const,
			visible: false,
		};
	};

	const statusInfo = getStatusInfo();

	return (
		<div className='bg-white px-4 py-2'>
			<InputStatusBar
				visible={statusInfo.visible}
				message={statusInfo.message}
				type={statusInfo.type}
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
                      ${status.isProcessing ? 'border-blue-200 bg-white' : ''}`}
						placeholder={status.isProcessing
							? 'Type your message... (Claude is working)'
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
						status.isProcessing
							? 'bg-gray-100 text-gray-400 cursor-not-allowed'
							: disabled
							? 'bg-gray-300 cursor-not-allowed'
							: 'bg-blue-500 text-white hover:bg-blue-600'
					}`}
					disabled={status.isLoading || disabled || status.isProcessing}
					aria-label={status.isLoading ? 'Sending message...' : 'Send message'}
				>
					{status.isLoading ? <LoadingSpinner size='small' color='text-white' /> : 'Send'}
				</button>
			</div>
		</div>
	);
}
