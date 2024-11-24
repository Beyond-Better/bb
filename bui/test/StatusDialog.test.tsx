import { render, fireEvent } from '@testing-library/preact';
import { StatusDialog } from '../src/components/Status/StatusDialog.tsx';
import { describe, it, beforeEach } from 'std/testing/bdd.ts';
import { expect } from 'chai';

describe('StatusDialog', () => {
    const mockApiStatus = {
        status: 'ok',
        message: 'API is running',
        platform: 'darwin',
        platformDisplay: 'macOS',
        tls: {
            enabled: true,
            certType: 'self-signed' as const,
            certPath: '/path/to/cert',
            certSource: 'project' as const,
            validFrom: '2024-01-01T00:00:00Z',
            validUntil: '2025-01-01T00:00:00Z',
            issuer: 'Test CA',
            subject: 'localhost',
            expiryStatus: 'valid' as const,
        },
        configType: 'project' as const,
        projectName: 'test-project',
    };

    const mockApiClient = {
        getStatus: () => Promise.resolve(mockApiStatus),
        getStatusHtml: () => Promise.resolve('<div>Status HTML</div>'),
    };

    it('renders nothing when not visible', () => {
        const { container } = render(
            <StatusDialog 
                visible={false} 
                onClose={() => {}} 
                apiClient={mockApiClient}
            />
        );
        expect(container.firstChild).to.be.null;
    });

    it('renders content when visible', async () => {
        const { getByRole, getByText, findByText } = render(
            <StatusDialog 
                visible={true} 
                onClose={() => {}} 
                apiClient={mockApiClient}
            />
        );

        // Check dialog role and title
        expect(getByRole('dialog')).to.exist;
        expect(getByText('API Status')).to.exist;

        // Wait for async content
        const tlsSection = await findByText('TLS Configuration');
        expect(tlsSection).to.exist;

        // Check system information
        const sysInfo = await findByText('System Information');
        expect(sysInfo).to.exist;

        // Check certificate details
        expect(getByText('Certificate Type: self-signed')).to.exist;
        expect(getByText('Certificate Source: project')).to.exist;
    });

    it('handles API errors gracefully', async () => {
        const errorApiClient = {
            getStatus: () => Promise.reject(new Error('API Error')),
            getStatusHtml: () => Promise.reject(new Error('API Error')),
        };

        const { findByRole } = render(
            <StatusDialog 
                visible={true} 
                onClose={() => {}} 
                apiClient={errorApiClient}
            />
        );

        const alert = await findByRole('alert');
        expect(alert).to.exist;
        expect(alert.textContent).to.include('Error');
    });

    it('calls onClose when clicking overlay', () => {
        const onClose = vi.fn();
        const { getByRole } = render(
            <StatusDialog 
                visible={true} 
                onClose={onClose} 
                apiClient={mockApiClient}
            />
        );

        const dialog = getByRole('dialog');
        fireEvent.click(dialog);
        expect(onClose).to.have.been.called;
    });

    it('calls onClose when clicking close button', () => {
        const onClose = vi.fn();
        const { getByLabelText } = render(
            <StatusDialog 
                visible={true} 
                onClose={onClose} 
                apiClient={mockApiClient}
            />
        );

        const closeButton = getByLabelText('Close status dialog');
        fireEvent.click(closeButton);
        expect(onClose).to.have.been.called;
    });

    it('prevents event bubbling when clicking dialog content', () => {
        const onClose = vi.fn();
        const { getByText } = render(
            <StatusDialog 
                visible={true} 
                onClose={onClose} 
                apiClient={mockApiClient}
            />
        );

        const dialogContent = getByText('API Status').closest('div');
        fireEvent.click(dialogContent!);
        expect(onClose).not.to.have.been.called;
    });

    it('displays TLS disabled state correctly', async () => {
        const tlsDisabledClient = {
            getStatus: () => Promise.resolve({
                ...mockApiStatus,
                tls: { enabled: false },
            }),
            getStatusHtml: () => Promise.resolve(''),
        };

        const { findByText } = render(
            <StatusDialog 
                visible={true} 
                onClose={() => {}} 
                apiClient={tlsDisabledClient}
            />
        );

        const tlsStatus = await findByText('TLS is not enabled');
        expect(tlsStatus).to.exist;
    });
});