import { render, fireEvent, screen } from '@testing-library/preact';
import { HelpDialog } from '../src/components/Help/HelpDialog.tsx';

describe('HelpDialog', () => {
  const mockApiClient = {
    // Status-related methods
    getStatus: () => Promise.resolve({
      status: 'ok',
      message: 'API is running',
      platform: 'darwin',
      platformDisplay: 'macOS',
      tls: {
        enabled: true,
        certType: 'self-signed',
        certPath: '/path/to/cert',
        certSource: 'project',
        validFrom: '2024-01-01T00:00:00Z',
        validUntil: '2025-01-01T00:00:00Z',
        issuer: 'Test CA',
        subject: 'localhost',
        expiryStatus: 'valid',
      },
      configType: 'project',
      projectName: 'test-project',
    }),
    getStatusHtml: () => Promise.resolve('<div>Status HTML</div>'),
    
    // Core API methods
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),

    // Collaboration methods
    createCollaboration: vi.fn(),
    listCollaborations: vi.fn(),
    getCollaboration: vi.fn(),
    deleteInteraction: vi.fn(),
    formatLogEntry: vi.fn(),
  };
  it('renders nothing when not visible', () => {
    const { container } = render(
      <HelpDialog visible={false} onClose={() => {}} apiClient={mockApiClient} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders content when visible', () => {
    const { getByRole, getByText } = render(
      <HelpDialog visible={true} onClose={() => {}} apiClient={mockApiClient} />
    );

    // Check dialog role and title
    expect(getByRole('dialog')).toBeInTheDocument();
    expect(getByText('Help')).toBeInTheDocument();

    // Check all sections are present
    expect(getByText('Keyboard Shortcuts')).toBeInTheDocument();
    expect(getByText('Navigation & Messages')).toBeInTheDocument();
    expect(getByText('Conversations')).toBeInTheDocument();
    expect(getByText('Project Management')).toBeInTheDocument();
    expect(getByText('Status & Information')).toBeInTheDocument();
    expect(getByText('Terms & Definitions')).toBeInTheDocument();
  });

  it('calls onClose when clicking overlay', () => {
    const onClose = vi.fn();
    const { getByRole } = render(
      <HelpDialog visible={true} onClose={onClose} apiClient={mockApiClient} />
    );

    const dialog = getByRole('dialog');
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking close button', () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(
      <HelpDialog visible={true} onClose={onClose} />
    );

    const closeButton = getByLabelText('Close help dialog');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows API security section with status button', async () => {
    const { getByText } = render(
      <HelpDialog visible={true} onClose={() => {}} />
    );

    // Check API security section exists
    expect(getByText('API Security')).toBeInTheDocument();
    expect(getByText(/BB uses TLS \(HTTPS\) to secure communication/)).toBeInTheDocument();

    // Check status button exists
    const statusButton = getByText('View Security Status');
    expect(statusButton).toBeInTheDocument();

    // Click the button and verify status dialog appears
    fireEvent.click(statusButton);
    expect(await screen.findByText('API Status')).toBeInTheDocument();
  });

  it('opens status dialog when clicking security status button', () => {
    const { getByText } = render(
      <HelpDialog visible={true} onClose={() => {}} />
    );

    // Click status button
    const statusButton = getByText('View Security Status');
    fireEvent.click(statusButton);

    // Check status dialog appears
    expect(screen.getByText('API Status')).toBeInTheDocument();
  });

  it('prevents event bubbling when clicking dialog content', () => {
    const onClose = vi.fn();
    const { getByText } = render(
      <HelpDialog visible={true} onClose={onClose} />
    );

    const dialogContent = getByText('Help').closest('div');
    fireEvent.click(dialogContent!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('handles escape key press', () => {
    const onClose = vi.fn();
    render(<HelpDialog visible={true} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});