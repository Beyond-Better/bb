import { JSX } from 'preact';
import { useMemo } from 'preact/hooks';
import { getExternalClickHandler, getExternalHref, isDuiEnvironment } from 'shared/externalLinkHelper.ts';

/**
 * Props for the ExternalLink component
 */
export interface ExternalLinkProps extends JSX.HTMLAttributes<HTMLAnchorElement> {
	/**
	 * The URL to link to
	 */
	href: string;

	/**
	 * Whether to show a toast notification when the link is clicked in DUI environment
	 * @default true
	 */
	showToast?: boolean;

	/**
	 * Whether to use Click handler approach instead of href modification
	 * Using onClick handler is more reliable in DUI but changes the UX slightly
	 * @default true
	 */
	useClickHandler?: boolean;

	/**
	 * Whether to automatically add target and rel attributes for browser environment
	 * @default true
	 */
	secureAttributes?: boolean;

	/**
	 * Optional message to show in toast notification
	 */
	toastMessage?: string;

	/**
	 * The download attribute for the link
	 */
	download?: boolean | string;

	/**
	 * Children elements or text
	 */
	children: JSX.Element | JSX.Element[] | string | string[] | null;
}

/**
 * A consistent component for external links that handles different environments (BUI/DUI)
 *
 * In DUI environment:
 * - Can use custom bblink:// protocol or click handler to open links in system browser
 * - Shows optional toast notification
 *
 * In regular browser:
 * - Adds security attributes (target="_blank", rel="noopener noreferrer")
 * - Uses standard link behavior
 *
 * @example
 * // Basic usage
 * <ExternalLink href="https://github.com/Beyond-Better/bb">GitHub</ExternalLink>
 *
 * // With custom styling
 * <ExternalLink
 *   href="https://github.com/Beyond-Better/bb/releases"
 *   className="text-purple-600 hover:text-purple-800"
 * >
 *   View releases
 * </ExternalLink>
 *
 * // Disable click handler (use href modification only)
 * <ExternalLink href="https://example.com" useClickHandler={false}>
 *   Example Link
 * </ExternalLink>
 */
export function ExternalLink({
	href,
	showToast = true,
	useClickHandler = false,
	secureAttributes = true,
	toastMessage,
	children,
	...props
}: ExternalLinkProps): JSX.Element {
	// Check for server-side rendering (SSR) first
	// 	const isDui = useMemo(() => {
	// 		// In SSR context, location might not exist
	// 		if (typeof window === 'undefined' || typeof globalThis.location === 'undefined') {
	// 			return false;
	// 		}
	// 		return isDuiEnvironment(href);
	// 	}, []);
	const isDui = isDuiEnvironment(href);

	const secureProps = useMemo(() => {
		if (secureAttributes && !isDui) {
			return {
				target: '_blank',
				rel: 'noopener noreferrer',
			};
		}
		return {};
	}, [secureAttributes, isDui]);

	const externalHref = useMemo(() => {
		if (!useClickHandler) {
			return getExternalHref(href);
		}
		return '#';
	}, [href, useClickHandler]);

	const clickHandler = useMemo(() => {
		if (useClickHandler) {
			const handler = getExternalClickHandler(href);
			return (e: MouseEvent) => {
				handler(e as any);
				if (toastMessage && showToast) {
					// Custom toast message if provided
				}
			};
		}
		return undefined;
	}, [href, useClickHandler, showToast, toastMessage]);

	return (
		<a
			href={externalHref}
			onClick={clickHandler}
			{...secureProps}
			{...props}
		>
			{children}
		</a>
	);
}
