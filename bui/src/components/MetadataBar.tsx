import { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { ChatStatus } from '../types/chat.types.ts';
import { ApiStatus } from 'shared/types.ts';

interface ProjectStatus {
	cacheStatus: 'active' | 'expiring' | 'inactive';
	apiStatus: ApiStatus;
	isReady: boolean;
}
import { useChatState } from '../hooks/useChatState.ts';
import { useAppState } from '../hooks/useAppState.ts';

interface MetadataBarProps {
	currentPath: string;
	children?: ComponentChildren;
	projectId?: string;
	chatState?: Signal<ChatState>;
}

interface MetadataAction {
	label: string;
	icon: string;
	onClick: () => void;
}

// Initialize actions signal outside component
const actions = signal<MetadataAction[]>([]);

export default function MetadataBar({ currentPath, children, projectId, chatState }: MetadataBarProps) {
	// Set actions based on current path
	useEffect(() => {
		const pathActions: MetadataAction[] = [];

		// Add path-specific actions
		switch (currentPath) {
			case '/chat':
				pathActions.push({
					label: 'New Conversation',
					icon:
						'M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653Z',
					onClick: () => {
						// TODO: Implement clear conversation
						console.log('Clear conversation clicked');
					},
				});
				break;
			case '/projects':
				pathActions.push({
					label: 'New Project',
					icon: 'M12 4.5v15m7.5-7.5h-15',
					onClick: () => {
						// TODO: Implement new project
						console.log('New project clicked');
					},
				});
				break;
				// Add more cases for other routes
		}

		actions.value = pathActions;
	}, [currentPath]);

	return (
		<div className='h-16 bg-white border-b border-gray-200 flex items-center px-4 justify-between'>
			{/* Left side - Contextual content */}
			<div className='flex items-center space-x-4'>
				{children}
			</div>

			{/* Right side - Actions */}
			<div className='flex items-center space-x-2'>
				{actions.value.map((action) => (
					<button
						key={action.label}
						onClick={action.onClick}
						className='inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
					>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							fill='none'
							viewBox='0 0 24 24'
							stroke-width='1.5'
							stroke='currentColor'
							className='w-4 h-4 mr-2'
						>
							<path
								stroke-linecap='round'
								stroke-linejoin='round'
								d={action.icon}
							/>
						</svg>
						{action.label}
					</button>
				))}
			</div>
		</div>
	);
}
