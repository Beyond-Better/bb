import { JSX } from 'preact';

type CertificateStatus = 'valid' | 'expiring' | 'expired' | 'invalid' | 'self-signed';

interface CertificateInfo {
	status: CertificateStatus;
	validFrom: string;
	validTo: string;
	issuer: string;
	subject: string;
	isSelfSigned: boolean;
}

interface CertificateStatusIndicatorProps {
	certInfo: CertificateInfo;
	className?: string;
}

export function CertificateStatusIndicator({ certInfo, className = '' }: CertificateStatusIndicatorProps): JSX.Element {
	const getStatusColor = (status: CertificateStatus): string => {
		switch (status) {
			case 'valid':
				return 'bg-green-500';
			case 'expiring':
				return 'bg-yellow-500';
			case 'expired':
			case 'invalid':
				return 'bg-red-500';
			case 'self-signed':
				return 'bg-orange-500';
		}
	};

	const getStatusText = (info: CertificateInfo): string => {
		const validToDate = new Date(info.validTo);
		const daysUntilExpiry = Math.ceil((validToDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

		switch (info.status) {
			case 'valid':
				return `Certificate valid (expires in ${daysUntilExpiry} days)`;
			case 'expiring':
				return `Certificate expiring soon (${daysUntilExpiry} days remaining)`;
			case 'expired':
				return 'Certificate has expired';
			case 'invalid':
				return 'Certificate is invalid';
			case 'self-signed':
				return 'Self-signed certificate';
		}
	};

	return (
		<div className={`relative inline-flex items-start gap-3 ${className}`}>
			{/* Certificate Icon */}
			<svg
				className='w-4 h-4 text-gray-400 mt-0.5'
				fill='none'
				stroke='currentColor'
				viewBox='0 0 24 24'
				aria-hidden='true'
			>
				<path
					strokeLinecap='round'
					strokeLinejoin='round'
					strokeWidth={2}
					d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
				/>
			</svg>

			{/* Certificate Information */}
			<div className='flex flex-col gap-1'>
				{/* Status Line */}
				<div className='flex items-center gap-2'>
					<div
						className={`w-2.5 h-2.5 rounded-full ${getStatusColor(certInfo.status)}`}
						aria-hidden='true'
					/>
					<span className='text-sm font-medium text-gray-200'>
						{getStatusText(certInfo)}
					</span>
				</div>

				{/* Certificate Details */}
				<div className='text-xs text-gray-400 flex flex-col gap-0.5 ml-4'>
					<div className='grid grid-cols-[auto,1fr] gap-x-2'>
						<span className='font-medium'>Valid from:</span>
						<span>{new Date(certInfo.validFrom).toLocaleDateString()}</span>
					</div>
					<div className='grid grid-cols-[auto,1fr] gap-x-2'>
						<span className='font-medium'>Valid to:</span>
						<span>{new Date(certInfo.validTo).toLocaleDateString()}</span>
					</div>
					<div className='grid grid-cols-[auto,1fr] gap-x-2'>
						<span className='font-medium'>Issuer:</span>
						<span className='truncate'>{certInfo.issuer}</span>
					</div>
				</div>
			</div>
		</div>
	);
}
