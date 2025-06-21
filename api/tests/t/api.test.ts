import { assertEquals, delay } from 'api/tests/deps.ts';
import { superoak } from 'superoak';
import { withTestProject } from 'api/tests/testSetup.ts';

// [TODO] superoak uses superdeno which fails compat with Deno v2 (uses `window` global)
// Either wait till superdeno fixes compat
// Or switch to Oak Testing: https://deno.land/x/oak@v17.1.3/testing.ts

/*
Deno.test({
	name: 'API root endpoint returns correct message',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
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
		await withTestProject(async (testProjectId, testProjectRoot) => {
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
 */

// The following tests are commented out as they require additional setup and dependencies
// They should be updated and uncommented once the necessary configurations are in place

/*
Deno.test("Start collaboration endpoint", async () => {
  await withTestProject(async (testProjectId, testProjectRoot) => {
    const { app } = await import('../../src/main.ts');
    const request = await superoak(app);
    const response = await request
      .post("/api/v1/collaboration")
      .send({
        prompt: "Test prompt",
        startDir: testProjectRoot
      })
      .expect(200)
      .expect("Content-Type", /json/);

    assertObjectMatch(response.body, {
      collaborationId: String,
      response: Object
    });
    const collaborationId = response.body.collaborationId;

    // Continue collaboration test
    const continueResponse = await request
      .post(`/api/v1/collaboration/${collaborationId}`)
      .send({
        prompt: "Continue test prompt",
        startDir: testProjectRoot
      })
      .expect(200)
      .expect("Content-Type", /json/);

    assertObjectMatch(continueResponse.body, {
      collaborationId: String,
      response: Object
    });
  });
});

Deno.test("File operations in collaboration", async () => {
  await withTestProject(async (testProjectId, testProjectRoot) => {
    const { app } = await import('../../src/main.ts');
    const request = await superoak(app);

    // Add file to collaboration
    const addFileResponse = await request
      .post("/api/v1/files")
      .field("file", "test content")
      .field("filename", "test.txt")
      .expect(200)
      .expect("Content-Type", /json/);

    assertObjectMatch(addFileResponse.body, {
      message: "File added to collaboration",
      collaborationId: String,
      filePath: String
    });

    // List files in collaboration
    const listFilesResponse = await request
      .get("/api/v1/files")
      .expect(200)
      .expect("Content-Type", /json/);

    assertObjectMatch(listFilesResponse.body, { files: Array });
  });
});
*/
