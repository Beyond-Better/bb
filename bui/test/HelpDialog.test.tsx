import { render, fireEvent } from '@testing-library/preact';
import { HelpDialog } from '../src/components/Help/HelpDialog.tsx';

describe('HelpDialog', () => {
  it('renders nothing when not visible', () => {
    const { container } = render(
      <HelpDialog visible={false} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders content when visible', () => {
    const { getByRole, getByText } = render(
      <HelpDialog visible={true} onClose={() => {}} />
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
      <HelpDialog visible={true} onClose={onClose} />
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