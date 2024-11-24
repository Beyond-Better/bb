import { useEffect, useState } from 'preact/hooks';
import type { CertificateInfo } from '../components/CertificateStatusIndicator.tsx';

interface ApiCertificateResponse {
	validFrom: string;
	validTo: string;
	issuer: string;
	subject: string;
	isSelfSigned: boolean;
}

export function useCertificateStatus() {
	const [certInfo, setCertInfo] = useState<CertificateInfo | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchCertStatus = async () => {
			try {
				const response = await fetch('/api/status');
				if (!response.ok) {
					throw new Error('Failed to fetch certificate status');
				}

				const data = await response.json();
				if (!data.certificate) {
					return;
				}

				const cert: ApiCertificateResponse = data.certificate;
				const now = new Date();
				const validTo = new Date(cert.validTo);
				const daysUntilExpiry = Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

				let status: CertificateInfo['status'];
				if (validTo < now) {
					status = 'expired';
				} else if (daysUntilExpiry <= 30) {
					status = 'expiring';
				} else if (cert.isSelfSigned) {
					status = 'self-signed';
				} else {
					status = 'valid';
				}

				setCertInfo({
					status,
					validFrom: cert.validFrom,
					validTo: cert.validTo,
					issuer: cert.issuer,
					subject: cert.subject,
					isSelfSigned: cert.isSelfSigned,
				});
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Unknown error');
				console.error('Error fetching certificate status:', err);
			}
		};

		// Initial fetch
		fetchCertStatus();

		// Refresh every 12 hours
		const interval = setInterval(fetchCertStatus, 12 * 60 * 60 * 1000);

		return () => clearInterval(interval);
	}, []);

	return { certInfo, error };
}
