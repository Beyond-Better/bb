import { fireEvent, render } from '@testing-library/preact';
import { ConversationTrigger } from '../components/ConversationSelector/ConversationTrigger.tsx';
import { describe, expect, it } from '../test_deps.ts';

describe('ConversationTrigger', () => {
	const mockConversation = {
		id: 'conv-123',
		title: 'Test Conversation',
		updatedAt: new Date().toISOString(),
		createdAt: new Date().toISOString(),
	};

	it('renders default state with no conversation', () => {
		const { getByText } = render(
			<ConversationTrigger
				conversation={undefined}
				isOpen={false}
				onClick={() => {}}
			/>,
		);

		expect(getByText('Select Conversation')).toBeTruthy();
	});

	it('renders conversation title and ID when provided', () => {
		const { getByText } = render(
			<ConversationTrigger
				conversation={mockConversation}
				isOpen={false}
				onClick={() => {}}
			/>,
		);

		expect(getByText('Test Conversation')).toBeTruthy();
		expect(getByText('conv-123')).toBeTruthy();
	});

	it('handles untitled conversations', () => {
		const untitledConversation = {
			...mockConversation,
			title: undefined,
		};

		const { getByText } = render(
			<ConversationTrigger
				conversation={untitledConversation}
				isOpen={false}
				onClick={() => {}}
			/>,
		);

		expect(getByText('Untitled')).toBeTruthy();
		expect(getByText('conv-123')).toBeTruthy();
	});

	it('applies correct styles when open', () => {
		const { container } = render(
			<ConversationTrigger
				conversation={mockConversation}
				isOpen={true}
				onClick={() => {}}
			/>,
		);

		const button = container.querySelector('button');
		expect(button?.className).toContain('border-blue-500');
		expect(button?.className).toContain('ring-2');
	});

	it('calls onClick handler when clicked', () => {
		let clicked = false;
		const handleClick = () => {
			clicked = true;
		};

		const { container } = render(
			<ConversationTrigger
				conversation={mockConversation}
				isOpen={false}
				onClick={handleClick}
			/>,
		);

		const button = container.querySelector('button');
		fireEvent.click(button!);
		expect(clicked).toBe(true);
	});
});
