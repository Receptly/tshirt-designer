export type Row = object;

export interface Database {
  query: <T extends Row = Row>(text: string, params?: unknown[]) => Promise<T[]>;
}

const schema = [
  `create table if not exists participants (
    id serial primary key,
    name text not null,
    name_key text not null,
    group_number integer not null check (group_number between 1 and 26),
    email text,
    created_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    unique (group_number, name_key)
  )`,
  `create table if not exists designs (
    participant_id integer primary key references participants(id) on delete cascade,
    payload jsonb not null,
    mockup bytea,
    garment_type text not null,
    shirt_color text not null,
    saved_at timestamptz not null default now()
  )`,
];

const globalForDb = globalThis as unknown as { __garmentDb?: Promise<Database> };

async function connect(): Promise<Database> {
  const url = process.env.DATABASE_URL;
  let database: Database;
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 3 });
    database = { query: async <T extends Row>(text: string, params?: unknown[]) => (await pool.query(text, params)).rows as T[] };
  } else {
    if (process.env.NODE_ENV === "production") throw new Error("DATABASE_URL is not configured");
    // Embedded Postgres for local development; data lives in .data/pglite.
    const { PGlite } = await import("@electric-sql/pglite");
    const { mkdir } = await import("node:fs/promises");
    await mkdir("./.data", { recursive: true });
    const local = new PGlite("./.data/pglite");
    database = { query: async <T extends Row>(text: string, params?: unknown[]) => (await local.query<T>(text, params)).rows };
  }
  for (const statement of schema) await database.query(statement);
  return database;
}

export function getDb() {
  if (!globalForDb.__garmentDb) {
    globalForDb.__garmentDb = connect().catch((error) => { globalForDb.__garmentDb = undefined; throw error; });
  }
  return globalForDb.__garmentDb;
}
