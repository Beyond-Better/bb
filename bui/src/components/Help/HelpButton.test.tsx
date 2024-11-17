import { render, fireEvent } from '@testing-library/preact';
import { HelpButton } from './HelpButton.tsx';

describe('HelpButton', () => {
  it('renders with correct text and icon', () => {
    const { getByText, getByTitle } = render(
      <HelpButton onClick={() => {}} disabled={false} />
    );

    expect(getByText('Help')).toBeInTheDocument();
    expect(getByTitle('Show help')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    const { getByTitle } = render(
      <HelpButton onClick={onClick} disabled={false} />
    );

    fireEvent.click(getByTitle('Show help'));
    expect(onClick).toHaveBeenCalled();
  });

  it('is disabled when disabled prop is true', () => {
    const onClick = vi.fn();
    const { getByTitle } = render(
      <HelpButton onClick={onClick} disabled={true} />
    );

    const button = getByTitle('Show help');
    expect(button).toBeDisabled();
    
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('includes a divider before the button', () => {
    const { container } = render(
      <HelpButton onClick={() => {}} disabled={false} />
    );

    const divider = container.querySelector('.h-6.w-px.bg-gray-200');
    expect(divider).toBeInTheDocument();
  });

  it('has distinct styling from regular toolbar buttons', () => {
    const { getByTitle } = render(
      <HelpButton onClick={() => {}} disabled={false} />
    );

    const button = getByTitle('Show help');
    expect(button).toHaveClass('text-blue-600', 'bg-blue-50');
  });
});