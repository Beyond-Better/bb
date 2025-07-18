import { CollaborationLogEntry } from 'shared/types.ts';

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
	orchestrator: (
		<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
			<path
				strokeLinecap='round'
				strokeLinejoin='round'
				strokeWidth={2}
				d='M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
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
		bg: 'bg-blue-50 dark:bg-blue-900/30',
		border: 'border-blue-200 dark:border-blue-800',
		thread: 'bg-blue-300 dark:bg-blue-600',
		header: {
			bg: 'bg-blue-100 dark:bg-blue-900/50',
			border: 'border-blue-200 dark:border-blue-800',
			text: 'text-blue-700 dark:text-blue-300',
			dot: 'bg-blue-500 dark:bg-blue-400',
		},
	},
	orchestrator: {
		bg: 'bg-green-50 dark:bg-green-900/30',
		border: 'border-green-200 dark:border-green-800',
		thread: 'bg-green-300 dark:bg-green-600',
		header: {
			bg: 'bg-green-100 dark:bg-green-900/50',
			border: 'border-green-200 dark:border-green-800',
			text: 'text-green-700 dark:text-green-300',
			dot: 'bg-green-500 dark:bg-green-400',
		},
	},
	assistant: {
		bg: 'bg-green-50 dark:bg-green-900/30',
		border: 'border-green-200 dark:border-green-800',
		thread: 'bg-green-300 dark:bg-green-600',
		header: {
			bg: 'bg-green-100 dark:bg-green-900/50',
			border: 'border-green-200 dark:border-green-800',
			text: 'text-green-700 dark:text-green-300',
			dot: 'bg-green-500 dark:bg-green-400',
		},
	},
	answer: {
		bg: 'bg-green-50 dark:bg-green-900/30',
		border: 'border-green-200 dark:border-green-800',
		thread: 'bg-green-300 dark:bg-green-600',
		header: {
			bg: 'bg-green-100 dark:bg-green-900/50',
			border: 'border-green-200 dark:border-green-800',
			text: 'text-green-700 dark:text-green-300',
			dot: 'bg-green-500 dark:bg-green-400',
		},
	},
	tool_use: {
		bg: 'bg-amber-50 dark:bg-amber-900/30',
		border: 'border-amber-200 dark:border-amber-800',
		thread: 'bg-amber-300 dark:bg-amber-600',
		header: {
			bg: 'bg-amber-100 dark:bg-amber-900/50',
			border: 'border-amber-200 dark:border-amber-800',
			text: 'text-amber-700 dark:text-amber-300',
			dot: 'bg-amber-500 dark:bg-amber-400',
		},
	},
	tool_result: {
		bg: 'bg-yellow-50 dark:bg-yellow-900/30',
		border: 'border-yellow-200 dark:border-yellow-800',
		thread: 'bg-yellow-300 dark:bg-yellow-600',
		header: {
			bg: 'bg-yellow-100 dark:bg-yellow-900/50',
			border: 'border-yellow-200 dark:border-yellow-800',
			text: 'text-yellow-700 dark:text-yellow-300',
			dot: 'bg-yellow-500 dark:bg-yellow-400',
		},
	},
	auxiliary: {
		bg: 'bg-purple-50 dark:bg-purple-900/30',
		border: 'border-purple-200 dark:border-purple-800',
		thread: 'bg-purple-300 dark:bg-purple-600',
		header: {
			bg: 'bg-purple-100 dark:bg-purple-900/50',
			border: 'border-purple-200 dark:border-purple-800',
			text: 'text-purple-700 dark:text-purple-300',
			dot: 'bg-purple-500 dark:bg-purple-400',
		},
	},
	error: {
		bg: 'bg-red-50 dark:bg-red-900/30',
		border: 'border-red-200 dark:border-red-800',
		thread: 'bg-red-300 dark:bg-red-600',
		header: {
			bg: 'bg-red-100 dark:bg-red-900/50',
			border: 'border-red-200 dark:border-red-800',
			text: 'text-red-700 dark:text-red-300',
			dot: 'bg-red-500 dark:bg-red-400',
		},
	},
} as const;

// Default expanded state by type
export const defaultExpanded = {
	user: true,
	orchestrator: true,
	agent_group: true,
	assistant: true,
	answer: true,
	tool_use: false,
	tool_result: false,
	auxiliary: false,
	error: false,
};

// Helper to generate storage key for collapse state
export function getCollapseStateKey(collaborationId: string, agentInteractionId: string | null, index: number): string {
	const agentId = agentInteractionId || 'parent';
	return `bb_collapse_state:${collaborationId}:${agentId}:${index}`;
}

// Helper to get initial collapse state
export function getInitialCollapseState(
	collaborationId: string,
	agentInteractionId: string | null,
	index: number,
	entryType: keyof typeof defaultExpanded,
): boolean {
	if (typeof localStorage === 'undefined') return defaultExpanded[entryType] ?? true;

	const storedState = localStorage.getItem(getCollapseStateKey(collaborationId, agentInteractionId, index));
	const wantExpanded = agentInteractionId ? false : defaultExpanded[entryType] ?? true;
	return storedState !== null ? storedState === 'true' : wantExpanded;
}

// Helper to save collapse state
export function saveCollapseState(
	collaborationId: string,
	agentInteractionId: string | null,
	index: number,
	isExpanded: boolean,
): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(getCollapseStateKey(collaborationId, agentInteractionId, index), String(isExpanded));
}

// Helper to generate content summary
export function getContentSummary(content: string, maxLength: number = 150): string {
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
export function getStructuredSummary(logEntry: CollaborationLogEntry): string | null {
	// This will be replaced by API response in future
	return null;
}
