import { ConversationLogEntry } from 'shared/types.ts';

// Default icons for each message type (will be replaced by API response in future)
export const messageIcons = {
	user: (
		<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
			<path
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={2}
				d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
			/>
		</svg>
	),
	assistant: (
		<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
			<path
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={2}
				d='M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
			/>
		</svg>
	),
	answer: (
		<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
			<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
		</svg>
	),
	tool_use: (
		<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
			<path
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={2}
				d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
			/>
			<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
		</svg>
	),
	tool_result: (
		<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
			<path
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={2}
				d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'
			/>
		</svg>
	),
	auxiliary: (
		<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
			<path
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={2}
				d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
			/>
		</svg>
	),
};

// Message type colors and backgrounds
export const messageStyles = {
	user: {
		bg: 'bg-blue-50',
		border: 'border-blue-200',
		header: {
			bg: 'bg-blue-100',
			border: 'border-blue-200',
			text: 'text-blue-700',
			dot: 'bg-blue-500',
		},
	},
	assistant: {
		bg: 'bg-green-50',
		border: 'border-green-200',
		header: {
			bg: 'bg-green-100',
			border: 'border-green-200',
			text: 'text-green-700',
			dot: 'bg-green-500',
		},
	},
	answer: {
		bg: 'bg-green-50',
		border: 'border-green-200',
		header: {
			bg: 'bg-green-100',
			border: 'border-green-200',
			text: 'text-green-700',
			dot: 'bg-green-500',
		},
	},
	tool_use: {
		bg: 'bg-yellow-50',
		border: 'border-yellow-200',
		header: {
			bg: 'bg-yellow-100',
			border: 'border-yellow-200',
			text: 'text-yellow-700',
			dot: 'bg-yellow-500',
		},
	},
	tool_result: {
		bg: 'bg-yellow-50',
		border: 'border-yellow-200',
		header: {
			bg: 'bg-yellow-100',
			border: 'border-yellow-200',
			text: 'text-yellow-700',
			dot: 'bg-yellow-500',
		},
	},
	auxiliary: {
		bg: 'bg-purple-50',
		border: 'border-purple-200',
		header: {
			bg: 'bg-purple-100',
			border: 'border-purple-200',
			text: 'text-purple-700',
			dot: 'bg-purple-500',
		},
	},
	error: {
		bg: 'bg-red-50',
		border: 'border-red-200',
		header: {
			bg: 'bg-red-100',
			border: 'border-red-200',
			text: 'text-red-700',
			dot: 'bg-red-500',
		},
	},
} as const;

// Default expanded state by type
export const defaultExpanded = {
	user: true,
	assistant: true,
	answer: true,
	tool_use: false,
	tool_result: false,
	auxiliary: false,
	error: false,
};

// Helper to generate storage key for collapse state
export function getCollapseStateKey(conversationId: string, index: number): string {
	return `bb_collapse_state:${conversationId}:${index}`;
}

// Helper to get initial collapse state
export function getInitialCollapseState(
	conversationId: string,
	index: number,
	entryType: keyof typeof defaultExpanded,
): boolean {
	if (typeof localStorage === 'undefined') return defaultExpanded[entryType] ?? true;

	const storedState = localStorage.getItem(getCollapseStateKey(conversationId, index));
	return storedState !== null ? storedState === 'true' : defaultExpanded[entryType] ?? true;
}

// Helper to save collapse state
export function saveCollapseState(
	conversationId: string,
	index: number,
	isExpanded: boolean,
): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(getCollapseStateKey(conversationId, index), String(isExpanded));
}

// Helper to generate content summary
export function getContentSummary(content: string, maxLength: number = 100): string {
	// Strip markdown syntax
	const strippedContent = content
		.replace(/[#*_`~]/g, '') // Remove common markdown characters
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace links with text
		.replace(/\n+/g, ' ') // Replace newlines with spaces
		.trim();

	if (strippedContent.length <= maxLength) return strippedContent;

	// Find word boundary
	const truncated = strippedContent.slice(0, maxLength);
	const lastSpace = truncated.lastIndexOf(' ');
	return lastSpace > 0 ? truncated.slice(0, lastSpace) + '...' : truncated + '...';
}

// Helper to get structured summary (placeholder for API response)
export function getStructuredSummary(logEntry: ConversationLogEntry): string | null {
	// This will be replaced by API response in future
	return null;
}
