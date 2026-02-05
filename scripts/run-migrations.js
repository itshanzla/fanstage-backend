const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

require("dotenv").config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const ssl = connectionString.includes("sslmode=require")
  ? { rejectUnauthorized: false }
  : undefined;

const pool = new Pool({ connectionString, ssl });

async function run() {
  const dbDir = path.join(__dirname, "..", "db");
  const files = fs
    .readdirSync(dbDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No migration files found in db/");
    return;
  }

  for (const file of files) {
    const filePath = path.join(dbDir, file);
    const sql = fs.readFileSync(filePath, "utf8");
    if (!sql.trim()) {
      continue;
    }

    console.log(`Running ${file}...`);
    await pool.query(sql);
  }

  console.log("Migrations completed.");
}

run()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
