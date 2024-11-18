import { expect } from 'expect';
import { render } from '@testing-library/preact';
import { CacheStatusIndicator } from '../src/components/CacheStatusIndicator.tsx';

describe('CacheStatusIndicator', () => {
	it('renders with cache icon', () => {
		const { container } = render(<CacheStatusIndicator status="active" />);
		const icon = container.querySelector('svg');
		expect(icon).toBeTruthy();
		expect(icon?.classList.contains('text-gray-400')).toBe(true);
	});

	it('renders with active status', () => {
		const { container } = render(<CacheStatusIndicator status="active" />);
		const dot = container.querySelector('div[aria-hidden="true"]');
		expect(dot?.classList.contains('bg-green-500')).toBe(true);
	});

	it('renders with expiring status', () => {
		const { container } = render(<CacheStatusIndicator status="expiring" />);
		const dot = container.querySelector('div[aria-hidden="true"]');
		expect(dot?.classList.contains('bg-yellow-500')).toBe(true);
	});

	it('renders with inactive status', () => {
		const { container } = render(<CacheStatusIndicator status="inactive" />);
		const dot = container.querySelector('div[aria-hidden="true"]');
		expect(dot?.classList.contains('bg-gray-400')).toBe(true);
	});

	it('includes correct title text for each status', () => {
		const { rerender, container } = render(<CacheStatusIndicator status="active" />);
		const wrapper = container.firstChild as HTMLElement;
		expect(wrapper.title).toBe('Anthropic API prompt cache status: Active (reduced token costs)');

		rerender(<CacheStatusIndicator status="expiring" />);
		expect(wrapper.title).toBe('Anthropic API prompt cache status: Expiring Soon');

		rerender(<CacheStatusIndicator status="inactive" />);
		expect(wrapper.title).toBe('Anthropic API prompt cache status: Inactive');
	});

	it('applies custom className', () => {
		const { container } = render(<CacheStatusIndicator status="active" className="custom-class" />);
		const wrapper = container.firstChild as HTMLElement;
		expect(wrapper.classList.contains('custom-class')).toBe(true);
	});
});