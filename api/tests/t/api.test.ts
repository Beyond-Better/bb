import { assertEquals, delay } from 'api/tests/deps.ts';
import { superoak } from 'superoak';
import { withTestProject } from 'api/tests/testSetup.ts';

Deno.test({
	name: 'API root endpoint returns correct message',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const originalCwd = Deno.cwd();
			try {
				Deno.chdir(testProjectRoot);
				const { app } = await import('../../src/main.ts');
				const controller = new AbortController();
				const { signal: _signal } = controller;

				try {
					const request = await superoak(app);
					await request.get('/')
						.expect(200)
						.expect('Content-Type', /json/)
						.expect({ message: 'Welcome to BB API', docs: '/api-docs/openapi.json' });
				} finally {
					controller.abort();
					await delay(0); // Allow any pending microtasks to complete
				}
			} finally {
				Deno.chdir(originalCwd);
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'API status endpoint returns OK',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const originalCwd = Deno.cwd();
			try {
				Deno.chdir(testProjectRoot);
				const { app } = await import('../../src/main.ts');
				const request = await superoak(app);
				const response = await request
					.get('/api/v1/status')
					.expect(200)
					.expect('Content-Type', /json/);

				assertEquals(response.body.status, 'OK');
				assertEquals(response.body.message, 'API is running');
			} finally {
				Deno.chdir(originalCwd);
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

// The following tests are commented out as they require additional setup and dependencies
// They should be updated and uncommented once the necessary configurations are in place

/*
Deno.test("Start conversation endpoint", async () => {
  await withTestProject(async (testProjectRoot) => {
    const { app } = await import('../../src/main.ts');
    const request = await superoak(app);
    const response = await request
      .post("/api/v1/conversation")
      .send({
        prompt: "Test prompt",
        startDir: testProjectRoot
      })
      .expect(200)
      .expect("Content-Type", /json/);

    assertObjectMatch(response.body, {
      conversationId: String,
      response: Object
    });
    const conversationId = response.body.conversationId;

    // Continue conversation test
    const continueResponse = await request
      .post(`/api/v1/conversation/${conversationId}`)
      .send({
        prompt: "Continue test prompt",
        startDir: testProjectRoot
      })
      .expect(200)
      .expect("Content-Type", /json/);

    assertObjectMatch(continueResponse.body, {
      conversationId: String,
      response: Object
    });
  });
});

Deno.test("File operations in conversation", async () => {
  await withTestProject(async (testProjectRoot) => {
    const { app } = await import('../../src/main.ts');
    const request = await superoak(app);

    // Add file to conversation
    const addFileResponse = await request
      .post("/api/v1/files")
      .field("file", "test content")
      .field("filename", "test.txt")
      .expect(200)
      .expect("Content-Type", /json/);

    assertObjectMatch(addFileResponse.body, {
      message: "File added to conversation",
      conversationId: String,
      filePath: String
    });

    // List files in conversation
    const listFilesResponse = await request
      .get("/api/v1/files")
      .expect(200)
      .expect("Content-Type", /json/);

    assertObjectMatch(listFilesResponse.body, { files: Array });
  });
});
*/
