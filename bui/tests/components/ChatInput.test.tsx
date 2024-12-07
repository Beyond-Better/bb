import { assertEquals, assertExists, assertSpyCalls, stub } from '../deps.ts';
import { describe, it } from '@std/testing/bdd';
import { ChatInput } from '../../src/components/ChatInput.tsx';
import { ApiStatus } from 'shared/types.ts';
import { fireEvent, render } from '@testing-library/preact';

describe('ChatInput', () => {
	const mockApiClient = {
		suggestFiles: stub().resolves({
			suggestions: [
				{ path: 'docs/README.md', isDirectory: false },
				{ path: 'docs/API.md', isDirectory: false },
			],
			hasMore: false,
		}),
	};

	const defaultProps = {
		apiClient: mockApiClient,
		projectId: 'default',
		value: '',
		onChange: () => {},
		onSend: () => {},
		status: {
			isReady: true,
			isLoading: false,
			apiStatus: ApiStatus.IDLE,
		},
	};

	describe('File Suggestions', () => {
		it('should show suggestions when Tab is pressed without a path separator', async () => {
			const onChange = stub();
			mockApiClient.suggestFiles.resolves({
				suggestions: [
					{ path: 'docs/README.md', isDirectory: false },
					{ path: 'docs/API.md', isDirectory: false },
				],
				hasMore: false,
			});

			const { getByRole } = render(
				<ChatInput
					{...defaultProps}
					value='docs'
					onChange={onChange}
				/>,
			);

			const textarea = getByRole('textbox');
			await fireEvent.keyDown(textarea, { key: 'Tab' });

			// Verify suggestions were requested
			assertSpyCalls(mockApiClient.suggestFiles, 1);
			assertEquals(
				mockApiClient.suggestFiles.calls[0].args,
				['docs', '/test/project'],
			);

			// Verify suggestions are displayed
			const suggestionsList = getByRole('listbox');
			assertEquals(suggestionsList.children.length, 2, 'Should show two suggestions');
		});

		it('should show suggestions when slash is typed', async () => {
			const onChange = stub();
			mockApiClient.suggestFiles.resolves({
				suggestions: [
					{ path: 'src/', isDirectory: true },
					{ path: 'docs/', isDirectory: true },
				],
				hasMore: false,
			});

			const { getByRole } = render(
				<ChatInput
					{...defaultProps}
					value='/'
					onChange={onChange}
				/>,
			);

			const textarea = getByRole('textbox');
			await fireEvent.input(textarea, { target: { value: '/' } });

			// Verify suggestions were requested
			assertSpyCalls(mockApiClient.suggestFiles, 1);
			assertEquals(
				mockApiClient.suggestFiles.calls[0].args,
				['/', '/test/project'],
			);

			// Verify suggestions are displayed
			const suggestionsList = getByRole('listbox');
			assertEquals(suggestionsList.children.length, 2);
		});

		it('should auto-select single suggestion when tab triggered', async () => {
			const onChange = stub();
			mockApiClient.suggestFiles.resolves({
				suggestions: [
					{ path: 'docs/README.md', isDirectory: false },
				],
				hasMore: false,
			});

			const { getByRole, queryByRole } = render(
				<ChatInput
					{...defaultProps}
					value='docs/READ'
					onChange={onChange}
				/>,
			);

			const textarea = getByRole('textbox');
			await fireEvent.keyDown(textarea, { key: 'Tab' });

			// Verify suggestion was auto-selected
			assertSpyCalls(onChange, 1);
			assertEquals(
				onChange.calls[0].args[0],
				'`docs/README.md`',
			);

			// Verify suggestions are hidden after selection
			assertEquals(queryByRole('listbox'), null, 'Suggestions should be hidden');
		});

		it('should handle keyboard navigation of suggestions', async () => {
			const onChange = stub();
			mockApiClient.suggestFiles.resolves({
				suggestions: [
					{ path: 'docs/README.md', isDirectory: false },
					{ path: 'docs/API.md', isDirectory: false },
				],
				hasMore: false,
			});

			const { getByRole } = render(
				<ChatInput
					{...defaultProps}
					value='docs/'
					onChange={onChange}
				/>,
			);

			const textarea = getByRole('textbox');

			// Show suggestions
			await fireEvent.keyDown(textarea, { key: 'Tab' });

			// Navigate down
			await fireEvent.keyDown(textarea, { key: 'ArrowDown' });

			// Select with Enter
			await fireEvent.keyDown(textarea, { key: 'Enter' });

			// Verify correct suggestion was selected
			assertSpyCalls(onChange, 1);
			assertEquals(
				onChange.calls[0].args[0],
				'`docs/README.md`',
			);
		});

		it('should handle escape to close suggestions', async () => {
			mockApiClient.suggestFiles.resolves({
				suggestions: [
					{ path: 'docs/README.md', isDirectory: false },
					{ path: 'docs/API.md', isDirectory: false },
				],
				hasMore: false,
			});

			const { getByRole, queryByRole } = render(
				<ChatInput {...defaultProps} value='docs/' />,
			);

			const textarea = getByRole('textbox');

			// Show suggestions
			await fireEvent.keyDown(textarea, { key: 'Tab' });

			// Verify suggestions are shown
			assertExists(queryByRole('listbox'), 'Suggestions should be visible');

			// Press Escape
			await fireEvent.keyDown(textarea, { key: 'Escape' });

			// Verify suggestions are hidden
			assertEquals(queryByRole('listbox'), null);
		});
	});
});
