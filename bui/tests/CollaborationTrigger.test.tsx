import { fireEvent, render } from '@testing-library/preact';
import { CollaborationTrigger } from '../components/CollaborationSelector/CollaborationTrigger.tsx';
import { describe, expect, it } from '../test_deps.ts';

describe('CollaborationTrigger', () => {
	const mockCollaboration = {
		id: 'conv-123',
		title: 'Test Conversation',
		updatedAt: new Date().toISOString(),
		createdAt: new Date().toISOString(),
	};

	it('renders default state with no collaboration', () => {
		const { getByText } = render(
			<CollaborationTrigger
				collaboration={undefined}
				isOpen={false}
				onClick={() => {}}
			/>,
		);

		expect(getByText('Select Conversation')).toBeTruthy();
	});

	it('renders collaboration title and ID when provided', () => {
		const { getByText } = render(
			<CollaborationTrigger
				collaboration={mockCollaboration}
				isOpen={false}
				onClick={() => {}}
			/>,
		);

		expect(getByText('Test Conversation')).toBeTruthy();
		expect(getByText('conv-123')).toBeTruthy();
	});

	it('handles untitled collaborations', () => {
		const untitledCollaboration = {
			...mockCollaboration,
			title: undefined,
		};

		const { getByText } = render(
			<CollaborationTrigger
				collaboration={untitledCollaboration}
				isOpen={false}
				onClick={() => {}}
			/>,
		);

		expect(getByText('Untitled')).toBeTruthy();
		expect(getByText('conv-123')).toBeTruthy();
	});

	it('applies correct styles when open', () => {
		const { container } = render(
			<CollaborationTrigger
				collaboration={mockCollaboration}
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
			<CollaborationTrigger
				collaboration={mockCollaboration}
				isOpen={false}
				onClick={handleClick}
			/>,
		);

		const button = container.querySelector('button');
		fireEvent.click(button!);
		expect(clicked).toBe(true);
	});
});
