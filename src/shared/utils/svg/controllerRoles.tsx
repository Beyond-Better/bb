/**
 * Model Role SVG Icons
 *
 * SVG icons representing different model roles in the BB system:
 * - Orchestrator: Coordinates multi-agent workflows and delegates tasks
 * - Agent: Executes specific tasks delegated by the orchestrator
 * - Chat: Handles administrative tasks like titles, summaries, and meta-operations
 */

import { JSX } from 'preact';
import type { SvgRenderOptions } from 'shared/svgImages.tsx';

/**
 * Common SVG props for model role icons
 */
export interface ControllerRoleIconProps {
	className?: string;
	'aria-label'?: string;
	style?: JSX.CSSProperties;
	useCurrentColor?: boolean;
}

/**
 * Orchestrator Model Icon JSX Component
 *
 * Represents coordination, delegation, and workflow orchestration.
 * Uses a conductor/hub metaphor with connecting lines.
 */
export function OrchestratorIcon(props: ControllerRoleIconProps = {}): JSX.Element {
	const { className, 'aria-label': ariaLabel, style, useCurrentColor = true } = props;
	const strokeColor = useCurrentColor ? 'currentColor' : '#8B5CF6';

	return (
		<svg
			xmlns='http://www.w3.org/2000/svg'
			viewBox='0 0 24 24'
			fill='none'
			stroke={strokeColor}
			strokeWidth={2}
			strokeLinecap='round'
			strokeLinejoin='round'
			className={className}
			aria-label={ariaLabel || 'Orchestrator Model'}
			style={{
				width: '1em',
				height: '1em',
				display: 'inline-block',
				verticalAlign: 'middle',
				...style,
			}}
		>
			<circle cx='12' cy='12' r='3' />
			<path d='m8 16 1.5-1.5' />
			<path d='M15 8l1.5 1.5' />
			<path d='m16 8-1.5 1.5' />
			<path d='M8 8l1.5 1.5' />
			<path d='m8 8-1.5-1.5' />
			<path d='M16 16l1.5 1.5' />
			<path d='m16 16-1.5-1.5' />
			<path d='M8 16l-1.5 1.5' />
			<circle cx='4' cy='4' r='2' />
			<circle cx='20' cy='4' r='2' />
			<circle cx='20' cy='20' r='2' />
			<circle cx='4' cy='20' r='2' />
		</svg>
	);
}

/**
 * Agent Model Icon JSX Component
 *
 * Represents focused task execution and tool usage.
 * Uses a gear/cog metaphor to show mechanical precision.
 */
export function AgentIcon(props: ControllerRoleIconProps = {}): JSX.Element {
	const { className, 'aria-label': ariaLabel, style, useCurrentColor = true } = props;
	const strokeColor = useCurrentColor ? 'currentColor' : '#10B981';

	return (
		<svg
			xmlns='http://www.w3.org/2000/svg'
			viewBox='0 0 24 24'
			fill='none'
			stroke={strokeColor}
			strokeWidth={2}
			strokeLinecap='round'
			strokeLinejoin='round'
			className={className}
			aria-label={ariaLabel || 'Agent Model'}
			style={{
				width: '1em',
				height: '1em',
				display: 'inline-block',
				verticalAlign: 'middle',
				...style,
			}}
		>
			<circle cx='12' cy='12' r='3' />
			<path d='M12 1v6m0 6v6' />
			<path d='m15.5 3.5-1.5 1.5' />
			<path d='m10 14-1.5 1.5' />
			<path d='m8.5 3.5 1.5 1.5' />
			<path d='m14 14 1.5 1.5' />
			<path d='m3.5 8.5 1.5 1.5' />
			<path d='m14 10 1.5-1.5' />
			<path d='m3.5 15.5 1.5-1.5' />
			<path d='m10 14-1.5-1.5' />
			<path d='m20.5 8.5-1.5 1.5' />
			<path d='m14 10-1.5-1.5' />
			<path d='m20.5 15.5-1.5-1.5' />
			<path d='m10 10 1.5-1.5' />
		</svg>
	);
}

/**
 * Chat Model Icon JSX Component
 *
 * Represents administrative tasks, documentation, and meta-operations.
 * Uses a clipboard/document metaphor with checkmarks.
 */
export function ChatIcon(props: ControllerRoleIconProps = {}): JSX.Element {
	const { className, 'aria-label': ariaLabel, style, useCurrentColor = true } = props;
	const strokeColor = useCurrentColor ? 'currentColor' : '#F59E0B';

	return (
		<svg
			xmlns='http://www.w3.org/2000/svg'
			viewBox='0 0 24 24'
			fill='none'
			stroke={strokeColor}
			strokeWidth={2}
			strokeLinecap='round'
			strokeLinejoin='round'
			className={className}
			aria-label={ariaLabel || 'Admin Model'}
			style={{
				width: '1em',
				height: '1em',
				display: 'inline-block',
				verticalAlign: 'middle',
				...style,
			}}
		>
			<rect width='8' height='4' x='8' y='2' rx='1' ry='1' />
			<path d='M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2' />
			<path d='m9 14 2 2 4-4' />
		</svg>
	);
}

/**
 * Get model role icon as JSX component
 *
 * @param role - Model role ('orchestrator', 'agent', 'chat')
 * @param props - Icon props
 * @returns JSX Element
 */
export function getControllerRoleIcon(
	role: string,
	props: ControllerRoleIconProps = {},
): JSX.Element {
	switch (role.toLowerCase()) {
		case 'orchestrator':
			return <OrchestratorIcon {...props} />;

		case 'agent':
			return <AgentIcon {...props} />;

		case 'chat':
			return <ChatIcon {...props} />;

		default:
			// Fallback to orchestrator icon for unknown roles
			return <OrchestratorIcon {...props} />;
	}
}

/**
 * Get all available model roles
 *
 * @returns Array of model role names
 */
export function getAvailableModelRoles(): string[] {
	return ['orchestrator', 'agent', 'chat'];
}
