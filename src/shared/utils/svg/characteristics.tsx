/**
 * Model characteristic SVGs
 *
 * These replace the emoticon placeholders for speed, cost, and intelligence indicators
 * with proper SVG icons that work well in both light and dark themes.
 */

import { JSX } from 'preact';
import type { SvgRenderOptions } from 'shared/svgImages.ts';

/**
 * Common SVG props for characteristic icons
 */
export interface CharacteristicIconProps {
	className?: string;
	'aria-label'?: string;
	style?: JSX.CSSProperties;
	useCurrentColor?: boolean;
}

/**
 * Speed Characteristic Icons - JSX Components
 */
export function FastSpeedIcon(props: CharacteristicIconProps = {}): JSX.Element {
	const { className, 'aria-label': ariaLabel, style, useCurrentColor = false } = props;
	const fillColor = useCurrentColor ? 'currentColor' : '#FBBF24';
	const strokeColor = useCurrentColor ? 'currentColor' : '#F59E0B';

	return (
		<svg
			width='16'
			height='16'
			viewBox='0 0 16 16'
			fill='none'
			xmlns='http://www.w3.org/2000/svg'
			className={className}
			aria-label={ariaLabel || 'Fast Speed'}
			style={{
				width: '1em',
				height: '1em',
				display: 'inline-block',
				verticalAlign: '-0.125em',
				...style,
			}}
		>
			<path
				d='M8 1L10.5 6L16 6.5L11.5 9L12 15L8 12L4 15L4.5 9L0 6.5L5.5 6L8 1Z'
				fill={fillColor}
				stroke={strokeColor}
				strokeWidth='0.5'
			/>
		</svg>
	);
}

export function MediumSpeedIcon(props: CharacteristicIconProps = {}): JSX.Element {
	const { className, 'aria-label': ariaLabel, style, useCurrentColor = false } = props;
	const fillColor = useCurrentColor ? 'currentColor' : '#10B981';
	const strokeColor = useCurrentColor ? 'currentColor' : '#059669';

	return (
		<svg
			width='16'
			height='16'
			viewBox='0 0 16 16'
			fill='none'
			xmlns='http://www.w3.org/2000/svg'
			className={className}
			aria-label={ariaLabel || 'Medium Speed'}
			style={{
				width: '1em',
				height: '1em',
				display: 'inline-block',
				verticalAlign: '-0.125em',
				...style,
			}}
		>
			<path
				d='M3 3L8 1L13 3L15 8L13 13L8 15L3 13L1 8L3 3Z'
				fill={fillColor}
				stroke={strokeColor}
				strokeWidth='0.5'
			/>
			<path d='M6 8L8 6L10 8L8 10L6 8Z' fill='#FFFFFF' />
		</svg>
	);
}

export function SlowSpeedIcon(props: CharacteristicIconProps = {}): JSX.Element {
	const { className, 'aria-label': ariaLabel, style, useCurrentColor = false } = props;
	const fillColor = useCurrentColor ? 'currentColor' : '#EF4444';
	const strokeColor = useCurrentColor ? 'currentColor' : '#DC2626';

	return (
		<svg
			width='16'
			height='16'
			viewBox='0 0 16 16'
			fill='none'
			xmlns='http://www.w3.org/2000/svg'
			className={className}
			aria-label={ariaLabel || 'Slow Speed'}
			style={{
				width: '1em',
				height: '1em',
				display: 'inline-block',
				verticalAlign: '-0.125em',
				...style,
			}}
		>
			<circle cx='8' cy='8' r='7' fill={fillColor} stroke={strokeColor} strokeWidth='0.5' />
			<path d='M5 8H11' stroke='#FFFFFF' strokeWidth='2' strokeLinecap='round' />
		</svg>
	);
}

/**
 * Cost Characteristic Icons - JSX Components
 */
export function LowCostIcon(props: CharacteristicIconProps = {}): JSX.Element {
	const { className, 'aria-label': ariaLabel, style, useCurrentColor = false } = props;
	const fillColor = useCurrentColor ? 'currentColor' : '#10B981';
	const strokeColor = useCurrentColor ? 'currentColor' : '#059669';

	return (
		<svg
			width='16'
			height='16'
			viewBox='0 0 16 16'
			fill='none'
			xmlns='http://www.w3.org/2000/svg'
			className={className}
			aria-label={ariaLabel || 'Low Cost'}
			style={{
				width: '1em',
				height: '1em',
				display: 'inline-block',
				verticalAlign: '-0.125em',
				...style,
			}}
		>
			<circle cx='8' cy='8' r='7' fill={fillColor} stroke={strokeColor} strokeWidth='0.5' />
			<path d='M6 8L8 6L10 8L8 10L6 8Z' fill='#FFFFFF' />
		</svg>
	);
}

export function MediumCostIcon(props: CharacteristicIconProps = {}): JSX.Element {
	const { className, 'aria-label': ariaLabel, style, useCurrentColor = false } = props;
	const fillColor = useCurrentColor ? 'currentColor' : '#FBBF24';
	const strokeColor = useCurrentColor ? 'currentColor' : '#F59E0B';

	return (
		<svg
			width='16'
			height='16'
			viewBox='0 0 16 16'
			fill='none'
			xmlns='http://www.w3.org/2000/svg'
			className={className}
			aria-label={ariaLabel || 'Medium Cost'}
			style={{
				width: '1em',
				height: '1em',
				display: 'inline-block',
				verticalAlign: '-0.125em',
				...style,
			}}
		>
			<circle cx='8' cy='8' r='7' fill={fillColor} stroke={strokeColor} strokeWidth='0.5' />
			<text
				x='8'
				y='11'
				textAnchor='middle'
				fontFamily='system-ui,sans-serif'
				fontSize='8'
				fontWeight='bold'
				fill='#FFFFFF'
			>
				$
			</text>
		</svg>
	);
}

export function HighCostIcon(props: CharacteristicIconProps = {}): JSX.Element {
	const { className, 'aria-label': ariaLabel, style, useCurrentColor = false } = props;
	const fillColor = useCurrentColor ? 'currentColor' : '#F97316';
	const strokeColor = useCurrentColor ? 'currentColor' : '#EA580C';

	return (
		<svg
			width='16'
			height='16'
			viewBox='0 0 16 16'
			fill='none'
			xmlns='http://www.w3.org/2000/svg'
			className={className}
			aria-label={ariaLabel || 'High Cost'}
			style={{
				width: '1em',
				height: '1em',
				display: 'inline-block',
				verticalAlign: '-0.125em',
				...style,
			}}
		>
			<circle cx='8' cy='8' r='7' fill={fillColor} stroke={strokeColor} strokeWidth='0.5' />
			<text
				x='8'
				y='11'
				textAnchor='middle'
				fontFamily='system-ui,sans-serif'
				fontSize='6'
				fontWeight='bold'
				fill='#FFFFFF'
			>
				$$
			</text>
		</svg>
	);
}

export function VeryHighCostIcon(props: CharacteristicIconProps = {}): JSX.Element {
	const { className, 'aria-label': ariaLabel, style, useCurrentColor = false } = props;
	const fillColor = useCurrentColor ? 'currentColor' : '#DC2626';
	const strokeColor = useCurrentColor ? 'currentColor' : '#B91C1C';

	return (
		<svg
			width='16'
			height='16'
			viewBox='0 0 16 16'
			fill='none'
			xmlns='http://www.w3.org/2000/svg'
			className={className}
			aria-label={ariaLabel || 'Very High Cost'}
			style={{
				width: '1em',
				height: '1em',
				display: 'inline-block',
				verticalAlign: '-0.125em',
				...style,
			}}
		>
			<circle cx='8' cy='8' r='7' fill={fillColor} stroke={strokeColor} strokeWidth='0.5' />
			<text
				x='8'
				y='11'
				textAnchor='middle'
				fontFamily='system-ui,sans-serif'
				fontSize='5'
				fontWeight='bold'
				fill='#FFFFFF'
			>
				$$$
			</text>
		</svg>
	);
}

/**
 * Intelligence Characteristic Icons - JSX Components
 */
export function MediumIntelligenceIcon(props: CharacteristicIconProps = {}): JSX.Element {
	const { className, 'aria-label': ariaLabel, style, useCurrentColor = false } = props;
	const fillColor = useCurrentColor ? 'currentColor' : '#8B5CF6';

	return (
		<svg
			width='16'
			height='16'
			viewBox='0 0 16 16'
			fill='none'
			xmlns='http://www.w3.org/2000/svg'
			className={className}
			aria-label={ariaLabel || 'Medium Intelligence'}
			style={{
				width: '1em',
				height: '1em',
				display: 'inline-block',
				verticalAlign: '-0.125em',
				...style,
			}}
		>
			<path
				d='M8 2C10.209 2 12 3.791 12 6C12 7.657 11.179 9.109 9.879 9.879C9.439 10.121 9.207 10.607 9.207 11.121V12H6.793V11.121C6.793 10.607 6.561 10.121 6.121 9.879C4.821 9.109 4 7.657 4 6C4 3.791 5.791 2 8 2Z'
				fill={fillColor}
			/>
			<rect x='6' y='13' width='4' height='1' fill={fillColor} />
		</svg>
	);
}

export function HighIntelligenceIcon(props: CharacteristicIconProps = {}): JSX.Element {
	const { className, 'aria-label': ariaLabel, style, useCurrentColor = false } = props;
	const fillColor = useCurrentColor ? 'currentColor' : '#6366F1';

	return (
		<svg
			width='16'
			height='16'
			viewBox='0 0 16 16'
			fill='none'
			xmlns='http://www.w3.org/2000/svg'
			className={className}
			aria-label={ariaLabel || 'High Intelligence'}
			style={{
				width: '1em',
				height: '1em',
				display: 'inline-block',
				verticalAlign: '-0.125em',
				...style,
			}}
		>
			<path d='M8 1L10 6L15 6.5L11 9L12 14L8 11L4 14L5 9L1 6.5L6 6L8 1Z' fill={fillColor} />
			<circle cx='8' cy='7' r='2' fill='#FFFFFF' />
		</svg>
	);
}

export function VeryHighIntelligenceIcon(props: CharacteristicIconProps = {}): JSX.Element {
	const { className, 'aria-label': ariaLabel, style, useCurrentColor = false } = props;
	const fillColor = useCurrentColor ? 'currentColor' : '#4F46E5';

	return (
		<svg
			width='16'
			height='16'
			viewBox='0 0 16 16'
			fill='none'
			xmlns='http://www.w3.org/2000/svg'
			className={className}
			aria-label={ariaLabel || 'Very High Intelligence'}
			style={{
				width: '1em',
				height: '1em',
				display: 'inline-block',
				verticalAlign: '-0.125em',
				...style,
			}}
		>
			<path d='M8 1L10 5L15 5.5L11.5 8L12.5 13L8 10.5L3.5 13L4.5 8L1 5.5L6 5L8 1Z' fill={fillColor} />
			<path d='M8 3L9 5.5L12 6L9.5 7.5L10 11L8 9.5L6 11L6.5 7.5L4 6L7 5.5L8 3Z' fill='#FFFFFF' />
		</svg>
	);
}

/**
 * Get characteristic icon as JSX component
 *
 * @param type - Characteristic type ('speed', 'cost', 'intelligence')
 * @param value - Characteristic value
 * @param props - Icon props
 * @returns JSX Element
 */
export function getCharacteristicIcon(
	type: 'speed' | 'cost' | 'intelligence',
	value: string,
	props: CharacteristicIconProps = {},
): JSX.Element {
	switch (type) {
		case 'speed':
			switch (value) {
				case 'fast':
					return <FastSpeedIcon {...props} />;
				case 'medium':
					return <MediumSpeedIcon {...props} />;
				case 'slow':
					return <SlowSpeedIcon {...props} />;
				default:
					return <MediumSpeedIcon {...props} />;
			}

		case 'cost':
			switch (value) {
				case 'low':
					return <LowCostIcon {...props} />;
				case 'medium':
					return <MediumCostIcon {...props} />;
				case 'high':
					return <HighCostIcon {...props} />;
				case 'very-high':
					return <VeryHighCostIcon {...props} />;
				default:
					return <MediumCostIcon {...props} />;
			}

		case 'intelligence':
			switch (value) {
				case 'medium':
					return <MediumIntelligenceIcon {...props} />;
				case 'high':
					return <HighIntelligenceIcon {...props} />;
				case 'very-high':
					return <VeryHighIntelligenceIcon {...props} />;
				default:
					return <MediumIntelligenceIcon {...props} />;
			}

		default:
			// Fallback to generic icon
			return <GenericCharacteristicIcon {...props} />;
	}
}

/**
 * Generic Characteristic Fallback Icon JSX Component
 */
export function GenericCharacteristicIcon(props: CharacteristicIconProps = {}): JSX.Element {
	const { className, 'aria-label': ariaLabel, style, useCurrentColor = false } = props;
	const fillColor = useCurrentColor ? 'currentColor' : '#6B7280';
	const strokeColor = useCurrentColor ? 'currentColor' : '#4B5563';

	return (
		<svg
			width='16'
			height='16'
			viewBox='0 0 16 16'
			fill='none'
			xmlns='http://www.w3.org/2000/svg'
			className={className}
			aria-label={ariaLabel || 'Unknown'}
			style={{
				width: '1em',
				height: '1em',
				display: 'inline-block',
				verticalAlign: '-0.125em',
				...style,
			}}
		>
			<circle cx='8' cy='8' r='7' fill={fillColor} stroke={strokeColor} strokeWidth='0.5' />
			<text
				x='8'
				y='11'
				textAnchor='middle'
				fontFamily='system-ui,sans-serif'
				fontSize='10'
				fontWeight='bold'
				fill='#FFFFFF'
			>
				?
			</text>
		</svg>
	);
}
