import { render, fireEvent, screen } from '@testing-library/preact';
import { ToolBar } from '../src/components/ToolBar.tsx';
import { useRef } from 'preact/hooks';

// Mock the chat input ref
const createMockChatInputRef = () => {
  const textarea = document.createElement('textarea');
  return {
    current: {
      textarea,
      adjustHeight: vi.fn(),
    },
  };
};

describe('ToolBar', () => {
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

    // Conversation methods
    createConversation: vi.fn(),
    getConversations: vi.fn(),
    getConversation: vi.fn(),
    deleteConversation: vi.fn(),
    formatLogEntry: vi.fn(),
  };
  const defaultProps = {
    onSendMessage: vi.fn(),
    disabled: false,
    startDir: '.',
    apiClient: mockApiClient,
  };

  it('renders help button and dialog', () => {
    const chatInputRef = createMockChatInputRef();
    const { getByTitle, getByText } = render(
      <ToolBar {...defaultProps} chatInputRef={chatInputRef} />
    );

    // Check help button is rendered
    const helpButton = getByTitle('Show help');
    expect(helpButton).toBeInTheDocument();

    // Click help button to show dialog
    fireEvent.click(helpButton);

    // Check dialog is rendered
    expect(getByText('Help')).toBeInTheDocument();
  });

  it('shows help dialog on ? key press when input not focused', () => {
    const chatInputRef = createMockChatInputRef();
    const { queryByRole, getByText } = render(
      <ToolBar {...defaultProps} chatInputRef={chatInputRef} />
    );

    // Initially, dialog should not be visible
    expect(queryByRole('dialog')).not.toBeInTheDocument();

    // Press ? key
    fireEvent.keyDown(document, { key: '?' });

    // Dialog should now be visible
    expect(getByText('Help')).toBeInTheDocument();
  });

  it('ignores ? key press when chat input is focused', () => {
    const chatInputRef = createMockChatInputRef();
    const { queryByRole } = render(
      <ToolBar {...defaultProps} chatInputRef={chatInputRef} />
    );

    // Focus the chat input
    chatInputRef.current.textarea.focus();

    // Press ? key
    fireEvent.keyDown(document, { key: '?' });

    // Dialog should not be visible
    expect(queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes help dialog with escape key', () => {
    const chatInputRef = createMockChatInputRef();
    const { queryByRole, getByTitle } = render(
      <ToolBar {...defaultProps} chatInputRef={chatInputRef} />
    );

    // Open dialog by clicking help button
    fireEvent.click(getByTitle('Show help'));
    expect(queryByRole('dialog')).toBeInTheDocument();

    // Press escape key
    fireEvent.keyDown(document, { key: 'Escape' });

    // Dialog should be closed
    expect(queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('disables help button when toolbar is disabled', () => {
    const chatInputRef = createMockChatInputRef();
    const { getByTitle } = render(
      <ToolBar {...defaultProps} disabled={true} chatInputRef={chatInputRef} />
    );

    const helpButton = getByTitle('Show help');
    expect(helpButton).toBeDisabled();
  });

  // Test other toolbar buttons still work with help integration
  it('shows status dialog when clicking status button', () => {
    const chatInputRef = createMockChatInputRef();
    const { getByTitle } = render(
      <ToolBar 
        {...defaultProps}
        onSendMessage={vi.fn()}
        chatInputRef={chatInputRef}
      />
    );

    // Test status button
    const statusButton = getByTitle('View API status');
    expect(statusButton).toBeInTheDocument();
    fireEvent.click(statusButton);

    // Check dialog appears
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('API Status')).toBeInTheDocument();
  });

  it('disables status button when toolbar is disabled', () => {
    const chatInputRef = createMockChatInputRef();
    const { getByTitle } = render(
      <ToolBar 
        {...defaultProps}
        disabled={true}
        chatInputRef={chatInputRef}
      />
    );

    const statusButton = getByTitle('View API status');
    expect(statusButton).toBeDisabled();
  });

  it('maintains existing toolbar functionality', () => {
    const onSendMessage = vi.fn();
    const chatInputRef = createMockChatInputRef();
    const { getByTitle } = render(
      <ToolBar 
        {...defaultProps}
        onSendMessage={onSendMessage}
        chatInputRef={chatInputRef}
      />
    );

    // Test metrics button
    fireEvent.click(getByTitle('Show conversation metrics'));
    expect(onSendMessage).toHaveBeenCalledWith('Provide conversation metrics');

    // Test summary button
    fireEvent.click(getByTitle('Summarize and truncate conversation'));
    expect(onSendMessage).toHaveBeenCalledWith(
      "Create a 'long' conversation summary keeping max of 20,000 tokens"
    );
  });
});