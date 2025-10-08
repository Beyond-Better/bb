import { expect } from './deps.ts';
import { render, screen, fireEvent } from '@testing-library/preact';
import { ExternalLink } from '../src/components/ExternalLink.tsx';
import * as externalLinkHelper from 'shared/externalLinkHelper.ts';
import * as environmentHelper from 'shared/environmentHelper.ts';

// Mock the externalLinkHelper functions
const mockIsDuiEnvironment = vi.spyOn(environmentHelper, 'isDuiEnvironment');
const mockGetExternalHref = vi.spyOn(externalLinkHelper, 'getExternalHref');
const mockGetExternalClickHandler = vi.spyOn(externalLinkHelper, 'getExternalClickHandler');

// Mock the global open function
const mockOpen = vi.fn();
globalThis.open = mockOpen;

describe('ExternalLink Component', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks();
    mockIsDuiEnvironment.mockReturnValue(false);
    mockGetExternalHref.mockImplementation((url) => url);
    mockGetExternalClickHandler.mockImplementation(() => vi.fn());
  });

  it('renders an anchor tag with the provided href', () => {
    render(<ExternalLink href="https://example.com">Example Link</ExternalLink>);
    
    const link = screen.getByText('Example Link');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('https://example.com');
  });

  it('adds secure attributes in browser environment', () => {
    mockIsDuiEnvironment.mockReturnValue(false);
    
    render(<ExternalLink href="https://example.com">Example Link</ExternalLink>);
    
    const link = screen.getByText('Example Link');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('does not add secure attributes in DUI environment', () => {
    mockIsDuiEnvironment.mockReturnValue(true);
    
    render(<ExternalLink href="https://example.com">Example Link</ExternalLink>);
    
    const link = screen.getByText('Example Link');
    expect(link.getAttribute('target')).toBeNull();
    expect(link.getAttribute('rel')).toBeNull();
  });

  it('uses getExternalHref when useClickHandler is false', () => {
    mockIsDuiEnvironment.mockReturnValue(true);
    mockGetExternalHref.mockReturnValue('bblink://https://example.com');
    
    render(
      <ExternalLink href="https://example.com" useClickHandler={false}>
        Example Link
      </ExternalLink>
    );
    
    const link = screen.getByText('Example Link');
    expect(link.getAttribute('href')).toBe('bblink://https://example.com');
    expect(mockGetExternalHref).toHaveBeenCalledWith('https://example.com');
  });

  it('uses click handler when useClickHandler is true', () => {
    mockIsDuiEnvironment.mockReturnValue(true);
    const mockClickHandlerFn = vi.fn().mockImplementation((e) => e.preventDefault());
    mockGetExternalClickHandler.mockReturnValue(mockClickHandlerFn);
    
    render(<ExternalLink href="https://example.com">Example Link</ExternalLink>);
    
    const link = screen.getByText('Example Link');
    expect(link.getAttribute('href')).toBe('#');
    
    fireEvent.click(link);
    expect(mockClickHandlerFn).toHaveBeenCalled();
  });

  it('passes additional props to the anchor element', () => {
    render(
      <ExternalLink 
        href="https://example.com" 
        className="test-class" 
        data-testid="test-link"
        aria-label="Test link"
      >
        Example Link
      </ExternalLink>
    );
    
    const link = screen.getByText('Example Link');
    expect(link.className).toBe('test-class');
    expect(link.getAttribute('data-testid')).toBe('test-link');
    expect(link.getAttribute('aria-label')).toBe('Test link');
  });
});