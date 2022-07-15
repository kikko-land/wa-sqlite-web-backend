import { insert, select, update } from "@trong-orm/query-builder";
import {
  DbProvider,
  EnsureDbLoaded,
  makeId,
  migrationsPlugin,
  reactiveQueriesPlugin,
  runInTransaction,
  useDbStrict,
} from "@trong-orm/react";
import { IMigration, runQuery, sql } from "@trong-orm/react";
import React, { useCallback } from "react";
import ReactDOM from "react-dom/client";
import sqlWasmUrl from "wa-sqlite/dist/wa-sqlite-async.wasm?url";

import { waSqliteWebBackend } from "../src";

const App = () => {
  const db = useDbStrict();
  const runInserts = useCallback(async () => {
    const ids = [...Array(1000)].map(() => makeId());

    await runQuery(
      db,
      insert(ids.map((id) => ({ id, val: Math.random() }))).into("notes")
    );

    await runInTransaction(db, async (db) => {
      for (const id of ids) {
        await runQuery(
          db,
          update("notes").set({ val: Math.random() }).where({ id })
        );

        console.log(await runQuery(db, select().from("notes").limit(10)));
      }
    });

    console.log(await runQuery(db, select().from("notes")));
  }, [db]);

  return (
    <div>
      <button onClick={runInserts}>Run inserts</button>
    </div>
  );
};

const createNotesTableMigration: IMigration = {
  up: async (db) => {
    await runQuery(
      db,
      sql`
      CREATE TABLE notes (
        id varchar(20) PRIMARY KEY,
        val REAL NOT NULL
      );
    `
    );
  },
  id: 18,
  name: "createNotesTable",
};

const config = {
  dbName: "helloWorld",
  dbBackend: waSqliteWebBackend({
    wasmUrl: sqlWasmUrl,
    pageSize: 2 * 1024,
    cacheSize: 0,
    vfs: "minimal",
  }),
  plugins: [
    migrationsPlugin({ migrations: [createNotesTableMigration] }),
    reactiveQueriesPlugin(),
  ],
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <DbProvider config={config}>
    <EnsureDbLoaded fallback={<div>Loading db...</div>}>
      <App />
    </EnsureDbLoaded>
  </DbProvider>
);
