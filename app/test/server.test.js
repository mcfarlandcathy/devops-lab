
const test = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("../src/server");

async function withServer(database, callback) {
  const server = createServer(database);

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await callback(baseUrl);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

test("GET /health returns healthy status", async () => {
  const database = {
    query: async () => ({ rows: [{ "?column?": 1 }] }),
  };

  await withServer(database, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, "ok");
    assert.equal(body.database, "connected");
  });
});

test("GET /tasks returns task list", async () => {
  const tasks = [{ id: 1, title: "Learn Docker", completed: false }];
  const database = {
    query: async () => ({ rows: tasks }),
  };

  await withServer(database, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/tasks`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), tasks);
  });
});

test("POST /tasks creates a task", async () => {
  const database = {
    query: async (_sql, values) => ({
      rows: [{ id: 2, title: values[0], completed: false }],
    }),
  };

  await withServer(database, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "  Learn CI  " }),
    });

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      id: 2,
      title: "Learn CI",
      completed: false,
    });
  });
});

test("POST /tasks rejects invalid JSON", async () => {
  const database = { query: async () => ({ rows: [] }) };

  await withServer(database, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid",
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Invalid JSON" });
  });
});

test("unknown route returns 404", async () => {
  const database = { query: async () => ({ rows: [] }) };

  await withServer(database, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/unknown`);

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Not found" });
  });
});

test("GET /version returns service version", async () => {
  const database = { query: async () => ({ rows: [] }) };

  await withServer(database, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/version`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      service: "task-api",
      version: "dev",
    });
  });
});