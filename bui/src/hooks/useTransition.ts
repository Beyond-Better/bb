import { useEffect, useState } from 'preact/hooks';

interface TransitionOptions {
	/** Duration of the transition in milliseconds */
	duration?: number;
	/** Delay before starting the transition in milliseconds */
	delay?: number;
	/** Callback when transition starts */
	onStart?: () => void;
	/** Callback when transition ends */
	onEnd?: () => void;
}

interface TransitionState {
	/** Whether the component should be mounted */
	mounted: boolean;
	/** Whether the transition is active */
	transitioning: boolean;
	/** Current transition state */
	state: 'entering' | 'entered' | 'exiting' | 'exited';
	/** Style object for the transition */
	style: {
		transition: string;
		opacity?: number;
		transform?: string;
	};
}

/**
 * Hook to manage mount/unmount transitions
 * @param visible Whether the component should be visible
 * @param options Transition options
 */
export function useTransition(
	visible: boolean,
	{
		duration = 300,
		delay = 0,
		onStart,
		onEnd,
	}: TransitionOptions = {},
): TransitionState {
	const [mounted, setMounted] = useState(visible);
	const [transitioning, setTransitioning] = useState(false);
	const [state, setState] = useState<'entering' | 'entered' | 'exiting' | 'exited'>(
		visible ? 'entered' : 'exited',
	);

	useEffect(() => {
		let timeoutId: number;

		if (visible) {
			setMounted(true);
			onStart?.();

			timeoutId = setTimeout(() => {
				setTransitioning(true);
				setState('entering');

				timeoutId = setTimeout(() => {
					setTransitioning(false);
					setState('entered');
					onEnd?.();
				}, duration);
			}, delay);
		} else {
			setTransitioning(true);
			setState('exiting');
			onStart?.();

			timeoutId = setTimeout(() => {
				setTransitioning(false);
				setState('exited');
				setMounted(false);
				onEnd?.();
			}, duration);
		}

		return () => {
			if (timeoutId) clearTimeout(timeoutId);
		};
	}, [visible, duration, delay, onStart, onEnd]);

	const style = {
		transition: `opacity ${duration}ms ease-in-out, transform ${duration}ms ease-in-out`,
		opacity: state === 'entering' || state === 'entered' ? 1 : 0,
		transform: state === 'entering' || state === 'entered' ? 'scale(1)' : 'scale(0.95)',
	};

	return {
		mounted,
		transitioning,
		state,
		style,
	};
}

/**
 * Hook to manage simple fade transitions
 */
export function useFadeTransition(
	visible: boolean,
	options: TransitionOptions = {},
) {
	const transition = useTransition(visible, options);

	return {
		...transition,
		style: {
			...transition.style,
			transform: undefined, // Remove transform effect
		},
	};
}

/**
 * Hook to manage slide transitions
 */
export function useSlideTransition(
	visible: boolean,
	direction: 'up' | 'down' | 'left' | 'right' = 'down',
	options: TransitionOptions = {},
) {
	const transition = useTransition(visible, options);
	const transforms = {
		up: 'translateY(20px)',
		down: 'translateY(-20px)',
		left: 'translateX(20px)',
		right: 'translateX(-20px)',
	};

	return {
		...transition,
		style: {
			...transition.style,
			transform: transition.state === 'entering' || transition.state === 'entered'
				? 'translate(0)'
				: transforms[direction],
		},
	};
}
