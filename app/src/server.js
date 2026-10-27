
const http = require("node:http");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT) || 3000;

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "taskdb",
  user: process.env.DB_USER || "taskuser",
  password: process.env.DB_PASSWORD,
});

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(data));
}

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      await pool.query("SELECT 1");
      return sendJson(res, 200, {
        status: "ok",
        service: "task-api",
        database: "connected",
      });
    }

    if (req.method === "GET" && url.pathname === "/tasks") {
      const result = await pool.query(
        "SELECT id, title, completed FROM tasks ORDER BY id"
      );
      return sendJson(res, 200, result.rows);
    }

    if (req.method === "POST" && url.pathname === "/tasks") {
      let body = "";

      for await (const chunk of req) {
        body += chunk;
        if (body.length > 100_000) {
          return sendJson(res, 413, { error: "Request body too large" });
        }
      }

      let data;
      try {
        data = JSON.parse(body);
      } catch {
        return sendJson(res, 400, { error: "Invalid JSON" });
      }

      if (typeof data.title !== "string" || !data.title.trim()) {
        return sendJson(res, 400, { error: "Field 'title' is required" });
      }

      const result = await pool.query(
        "INSERT INTO tasks (title) VALUES ($1) RETURNING id, title, completed",
        [data.title.trim()]
      );

      return sendJson(res, 201, result.rows[0]);
    }

    return sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    console.error("Request failed:", error.message);
    return sendJson(res, 500, { error: "Internal server error" });
  }
});

async function start() {
  await initializeDatabase();

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Task API listening on port ${PORT}`);
  });
}

start().catch((error) => {
  console.error("Failed to start application:", error.message);
  process.exit(1);
});

async function shutdown() {
  server.close();
  await pool.end();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

