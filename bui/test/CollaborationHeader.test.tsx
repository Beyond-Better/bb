import { expect } from 'expect';
import { render, fireEvent } from '@testing-library/preact';
import { CollaborationHeader } from '../src/components/CollaborationHeader.tsx';

describe('CollaborationHeader', () => {
	const defaultProps = {
		startDir: '/test/dir',
		onStartDirChange: () => {},
		onClearCollaboration: () => {},
		status: {
			isReady: true,
			isConnecting: false,
		},
		collaborationCount: 5,
		totalTokens: 1000,
		cacheStatus: 'active' as const,
	};

	it('renders all components correctly', () => {
		const { getByText, getByAltText, getByLabelText } = render(
			<CollaborationHeader {...defaultProps} />
		);

		// Logo and title
		expect(getByAltText('BB Logo')).toBeTruthy();
		expect(getByText('Beyond Better')).toBeTruthy();

		// Project directory input
		expect(getByLabelText('Project Directory:')).toBeTruthy();

		// Stats
		expect(getByText('Conversations:')).toBeTruthy();
		expect(getByText('5')).toBeTruthy();
		expect(getByText('Total Tokens:')).toBeTruthy();
		expect(getByText('1,000')).toBeTruthy();

		// Connection status
		expect(getByText('Connected')).toBeTruthy();
	});

	it('handles directory input changes', () => {
		const onStartDirChange = jest.fn();
		const onClearCollaboration = jest.fn();
		const { getByLabelText } = render(
			<CollaborationHeader
				{...defaultProps}
				onStartDirChange={onStartDirChange}
				onClearCollaboration={onClearCollaboration}
			/>
		);

		const input = getByLabelText('Project Directory:') as HTMLInputElement;
		fireEvent.change(input, { target: { value: '/new/dir' } });

		expect(onStartDirChange).toHaveBeenCalledWith('/new/dir');
		expect(onClearCollaboration).toHaveBeenCalled();
	});

	it('shows different connection states', () => {
		const { rerender, getByText } = render(
			<CollaborationHeader
				{...defaultProps}
				status={{ isReady: false, isConnecting: true }}
			/>
		);
		expect(getByText('Connecting')).toBeTruthy();

		rerender(
			<CollaborationHeader
				{...defaultProps}
				status={{ isReady: false, isConnecting: false }}
			/>
		);
		expect(getByText('Disconnected')).toBeTruthy();
	});

	it('renders cache status indicator with correct status', () => {
		const { container, rerender } = render(
			<CollaborationHeader {...defaultProps} cacheStatus="active" />
		);
		let indicator = container.querySelector('.bg-green-500');
		expect(indicator).toBeTruthy();

		rerender(<CollaborationHeader {...defaultProps} cacheStatus="expiring" />);
		indicator = container.querySelector('.bg-yellow-500');
		expect(indicator).toBeTruthy();

		rerender(<CollaborationHeader {...defaultProps} cacheStatus="inactive" />);
		indicator = container.querySelector('.bg-gray-400');
		expect(indicator).toBeTruthy();
	});

	it('renders optional metadata when provided', () => {
		const { getByText } = render(
			<CollaborationHeader
				{...defaultProps}
				projectType="local"
				createdAt="2024-03-20T12:00:00Z"
			/>
		);

		expect(getByText('Type:')).toBeTruthy();
		expect(getByText('local')).toBeTruthy();
		expect(getByText('Created:')).toBeTruthy();
	});
});