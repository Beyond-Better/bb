import { JSX } from 'preact';
import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { useFocusTrap } from '../../hooks/useFocusTrap.ts';
import { useFadeTransition, useTransition } from '../../hooks/useTransition.ts';
import { CertificateStatusIndicator } from '../CertificateStatusIndicator.tsx';
import type { ApiStatus } from '../../utils/apiClient.utils.ts';

interface StatusDialogProps {
	visible: boolean;
	onClose: () => void;
	apiClient: {
		getStatus: () => Promise<ApiStatus | null>;
		getStatusHtml: () => Promise<string | null>;
	};
}

// Create signals outside component to persist state between renders
const statusHtml = signal<string>('');
const apiStatus = signal<ApiStatus | null>(null);
const error = signal<string | null>(null);

export function StatusDialog({ visible, onClose, apiClient }: StatusDialogProps) {
	const focusTrapRef = useFocusTrap({
		enabled: visible,
		onEscape: onClose,
	});

	// Prevent body scroll when dialog is open
	useEffect(() => {
		if (visible) {
			document.body.style.overflow = 'hidden';
			// Fetch status when dialog opens
			fetchStatus();
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

	const fetchStatus = async () => {
		try {
			const [htmlContent, status] = await Promise.all([
				apiClient.getStatusHtml(),
				apiClient.getStatus(),
			]);

			if (htmlContent) {
				statusHtml.value = htmlContent;
			}
			if (status) {
				apiStatus.value = status;
			}
			error.value = null;
		} catch (err) {
			error.value = err instanceof Error ? err.message : 'Failed to fetch status';
			console.error('Error fetching status:', err);
		}
	};

	if (!dialogTransition.mounted) return null;

	return (
		<div
			className='fixed inset-0 flex items-center justify-center z-50'
			style={{
				...overlayTransition.style,
				backgroundColor: `rgba(0, 0, 0, ${visible ? '0.5' : '0'})`,
			}}
			role='dialog'
			aria-modal='true'
			aria-label='API Status'
			onClick={onClose}
		>
			<div
				ref={focusTrapRef}
				className='bg-white rounded-lg p-6 max-w-2xl w-full shadow-xl transform max-h-[90vh] overflow-y-auto'
				style={{
					transform: `scale(${visible ? '1' : '0.95'})`,
				}}
				onClick={(e) => e.stopPropagation()}
			>
				<div className='flex justify-between items-center mb-4 sticky top-0 bg-white pt-1 pb-3 border-b border-gray-200'>
					<h2 className='text-xl font-semibold' id='dialog-title'>API Status</h2>
					<button
						onClick={onClose}
						className='text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full p-1'
						aria-label='Close status dialog'
					>
						<svg
							className='w-6 h-6'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'
							aria-hidden='true'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M6 18L18 6M6 6l12 12'
							/>
						</svg>
					</button>
				</div>

				<div className='space-y-6'>
					{error.value && (
						<div
							className='bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative'
							role='alert'
						>
							<strong className='font-bold'>Error:</strong>
							<span className='block sm:inline'>{error.value}</span>
						</div>
					)}

					{apiStatus.value && (
						<div className='space-y-4'>
							<div className='bg-gray-50 p-4 rounded-lg'>
								<h3 className='text-lg font-medium text-gray-900 mb-3'>TLS Configuration</h3>
								{apiStatus.value.tls.enabled
									? (
										<>
											<CertificateStatusIndicator
												certInfo={{
													status: apiStatus.value.tls.expiryStatus || 'valid',
													validFrom: apiStatus.value.tls.validFrom || '',
													validTo: apiStatus.value.tls.validUntil || '',
													issuer: apiStatus.value.tls.issuer || '',
													subject: apiStatus.value.tls.subject || '',
													isSelfSigned: apiStatus.value.tls.certType === 'self-signed',
												}}
											/>
											<div className='mt-3 text-sm text-gray-600'>
												<p>Certificate Type: {apiStatus.value.tls.certType}</p>
												<p>Certificate Source: {apiStatus.value.tls.certSource}</p>
												{apiStatus.value.tls.certPath && (
													<p>Certificate Path: {apiStatus.value.tls.certPath}</p>
												)}
											</div>
										</>
									)
									: <p className='text-yellow-600'>TLS is not enabled</p>}
							</div>

							<div className='bg-gray-50 p-4 rounded-lg'>
								<h3 className='text-lg font-medium text-gray-900 mb-3'>System Information</h3>
								<dl className='grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm'>
									<dt className='font-medium text-gray-700'>Platform:</dt>
									<dd className='text-gray-600'>{apiStatus.value.platformDisplay}</dd>

									<dt className='font-medium text-gray-700'>Config Type:</dt>
									<dd className='text-gray-600'>{apiStatus.value.configType}</dd>

									{apiStatus.value.projectName && (
										<>
											<dt className='font-medium text-gray-700'>Project:</dt>
											<dd className='text-gray-600'>{apiStatus.value.projectName}</dd>
										</>
									)}

									{apiStatus.value.trustStoreLocation && (
										<>
											<dt className='font-medium text-gray-700'>Trust Store:</dt>
											<dd className='text-gray-600'>{apiStatus.value.trustStoreLocation}</dd>
										</>
									)}
								</dl>
							</div>
						</div>
					)}

					{statusHtml.value && (
						<div
							className='prose max-w-none mt-6'
							dangerouslySetInnerHTML={{ __html: statusHtml.value }}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
