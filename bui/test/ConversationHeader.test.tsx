import { expect } from 'expect';
import { render, fireEvent } from '@testing-library/preact';
import { ConversationHeader } from '../src/components/ConversationHeader.tsx';

describe('ConversationHeader', () => {
	const defaultProps = {
		startDir: '/test/dir',
		onStartDirChange: () => {},
		onClearConversation: () => {},
		status: {
			isReady: true,
			isConnecting: false,
		},
		conversationCount: 5,
		totalTokens: 1000,
		cacheStatus: 'active' as const,
	};

	it('renders all components correctly', () => {
		const { getByText, getByAltText, getByLabelText } = render(
			<ConversationHeader {...defaultProps} />
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
		const onClearConversation = jest.fn();
		const { getByLabelText } = render(
			<ConversationHeader
				{...defaultProps}
				onStartDirChange={onStartDirChange}
				onClearConversation={onClearConversation}
			/>
		);

		const input = getByLabelText('Project Directory:') as HTMLInputElement;
		fireEvent.change(input, { target: { value: '/new/dir' } });

		expect(onStartDirChange).toHaveBeenCalledWith('/new/dir');
		expect(onClearConversation).toHaveBeenCalled();
	});

	it('shows different connection states', () => {
		const { rerender, getByText } = render(
			<ConversationHeader
				{...defaultProps}
				status={{ isReady: false, isConnecting: true }}
			/>
		);
		expect(getByText('Connecting')).toBeTruthy();

		rerender(
			<ConversationHeader
				{...defaultProps}
				status={{ isReady: false, isConnecting: false }}
			/>
		);
		expect(getByText('Disconnected')).toBeTruthy();
	});

	it('renders cache status indicator with correct status', () => {
		const { container, rerender } = render(
			<ConversationHeader {...defaultProps} cacheStatus="active" />
		);
		let indicator = container.querySelector('.bg-green-500');
		expect(indicator).toBeTruthy();

		rerender(<ConversationHeader {...defaultProps} cacheStatus="expiring" />);
		indicator = container.querySelector('.bg-yellow-500');
		expect(indicator).toBeTruthy();

		rerender(<ConversationHeader {...defaultProps} cacheStatus="inactive" />);
		indicator = container.querySelector('.bg-gray-400');
		expect(indicator).toBeTruthy();
	});

	it('renders optional metadata when provided', () => {
		const { getByText } = render(
			<ConversationHeader
				{...defaultProps}
				projectType="git"
				createdAt="2024-03-20T12:00:00Z"
			/>
		);

		expect(getByText('Type:')).toBeTruthy();
		expect(getByText('git')).toBeTruthy();
		expect(getByText('Created:')).toBeTruthy();
	});
});