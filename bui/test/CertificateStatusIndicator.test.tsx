import { render } from '@testing-library/preact';
import { CertificateStatusIndicator } from '../src/components/CertificateStatusIndicator.tsx';
import { describe, it } from '@std/testing/bdd';
import { expect } from 'chai';
import { formatDateSafe } from 'bui/utils/intl.ts';

describe('CertificateStatusIndicator', () => {
	const mockValidCert = {
		status: 'valid' as const,
		validFrom: '2024-01-01T00:00:00Z',
		validTo: '2025-01-01T00:00:00Z',
		issuer: 'Test CA',
		subject: 'localhost',
		isSelfSigned: false,
	};

	const mockExpiredCert = {
		status: 'expired' as const,
		validFrom: '2023-01-01T00:00:00Z',
		validTo: '2024-01-01T00:00:00Z',
		issuer: 'Test CA',
		subject: 'localhost',
		isSelfSigned: false,
	};

	it('renders valid certificate status correctly', () => {
		const { container } = render(
			<CertificateStatusIndicator certInfo={mockValidCert} />,
		);

		// Check for valid status indicator
		const statusDot = container.querySelector('.bg-green-500');
		expect(statusDot).to.exist;

		// Check for certificate details
		expect(container.textContent).to.include('Certificate valid');
		expect(container.textContent).to.include('Test CA');
	});

	it('renders expired certificate status correctly', () => {
		const { container } = render(
			<CertificateStatusIndicator certInfo={mockExpiredCert} />,
		);

		// Check for expired status indicator
		const statusDot = container.querySelector('.bg-red-500');
		expect(statusDot).to.exist;

		// Check for certificate details
		expect(container.textContent).to.include('Certificate has expired');
		expect(container.textContent).to.include('Test CA');
	});

	it('applies custom className correctly', () => {
		const customClass = 'test-custom-class';
		const { container } = render(
			<CertificateStatusIndicator
				certInfo={mockValidCert}
				className={customClass}
			/>,
		);

		const rootElement = container.firstChild as HTMLElement;
		expect(rootElement.className).to.include(customClass);
	});

	it('displays formatted dates correctly', () => {
		const { container } = render(
			<CertificateStatusIndicator certInfo={mockValidCert} />,
		);

		const validFrom = formatDateSafe(new Date(mockValidCert.validFrom), {
			timeZone: 'UTC',
			dateStyle: 'short',
		});
		const validTo = formatDateSafe(new Date(mockValidCert.validTo), {
			timeZone: 'UTC',
			dateStyle: 'short',
		});

		expect(container.textContent).to.include(validFrom);
		expect(container.textContent).to.include(validTo);
	});
});
