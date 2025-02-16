import { useEffect, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { useFocusTrap } from '../../hooks/useFocusTrap.ts';
import { useFadeTransition, useTransition } from '../../hooks/useTransition.ts';

interface ConfirmDialogProps {
	visible: boolean;
	title: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	onConfirm: () => void;
	onCancel: () => void;
	isDangerous?: boolean;
}

export function ConfirmDialog({
	visible,
	title,
	message,
	confirmLabel = 'Confirm',
	cancelLabel = 'Cancel',
	onConfirm,
	onCancel,
	isDangerous = false,
}: ConfirmDialogProps) {
	const portalRef = useRef<HTMLElement | null>(null);

	// Initialize portal container
	useEffect(() => {
		if (typeof document === 'undefined') return;

		let container = document.getElementById('dialog-portal');
		if (!container) {
			container = document.createElement('div');
			container.id = 'dialog-portal';
			document.body.appendChild(container);
		}
		portalRef.current = container;

		return () => {
			// Only remove the container if it's empty and we created it
			if (container && container.childNodes.length === 0) {
				container.remove();
			}
		};
	}, []);

	const focusTrapRef = useFocusTrap({
		enabled: visible,
		onEscape: onCancel,
	});

	// Prevent body scroll when dialog is open
	useEffect(() => {
		if (typeof document === 'undefined') return;

		if (visible) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
		return () => {
			document.body.style.overflow = '';
		};
	}, [visible]);

	const dialogTransition = useTransition(visible, {
		duration: 200,
		delay: 50,
	});

	const overlayTransition = useFadeTransition(visible, {
		duration: 200,
	});

	if (!dialogTransition.mounted || !portalRef.current) return null;

	return createPortal(
		<div
			className="fixed inset-0 flex items-center justify-center z-50"
			style={{
				...overlayTransition.style,
				backgroundColor: `rgba(0, 0, 0, ${visible ? '0.5' : '0'})`,
			}}
			role="dialog"
			aria-modal="true"
			aria-labelledby="dialog-title"
			onClick={onCancel}
		>
			<div
				ref={focusTrapRef}
				className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full shadow-xl transform"
				style={{
					transform: `scale(${visible ? '1' : '0.95'})`,
				}}
				onClick={(e) => e.stopPropagation()}
			>
				<h2
					id="dialog-title"
					className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4"
				>
					{title}
				</h2>

				<p className="text-gray-600 dark:text-gray-300 mb-6">
					{message}
				</p>

				<div className="flex justify-end gap-3">
					<button
						onClick={onCancel}
						className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
					>
						{cancelLabel}
					</button>
					<button
						onClick={onConfirm}
						className={`px-4 py-2 text-white rounded-md transition-colors focus:outline-none focus:ring-2 ${
							isDangerous
								? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
								: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
						}`}
					>
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>,
		portalRef.current
	);
}