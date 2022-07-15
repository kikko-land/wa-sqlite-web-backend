import { insert, select, update } from "@trong-orm/query-builder";
import {
  DbProvider,
  EnsureDbLoaded,
  makeId,
  migrationsPlugin,
  reactiveQueriesPlugin,
  useDbStrict,
} from "@trong-orm/react";
import { runQuery, sql } from "@trong-orm/react";
import { chunk } from "lodash-es";
import React, { useCallback } from "react";
import ReactDOM from "react-dom/client";
import sqlWasmUrl from "wa-sqlite/dist/wa-sqlite-async.wasm?url";

import { waSqliteWebBackend } from "../src";
import { generateRootTree } from "./generateTree";

const { allRems, rootId: rootRemId } = generateRootTree({
  depth: 1,
  childrenInRow: () => 50000,
});

const App = () => {
  const db = useDbStrict();
  const runInserts = useCallback(async () => {
    for (const chunkedRems of chunk(allRems, 10_000)) {
      await runQuery(
        db,
        insert(
          chunkedRems.map((r) => ({ _id: r._id, doc: JSON.stringify(r) }))
        ).into("jsonRems")
      );
    }
  }, [db]);

  const runUpdates = useCallback(async () => {
    await runQuery(
      db,
      update("jsonRems").set({
        doc: sql`json_set(doc, '$.a', ${makeId()})`,
      })
    );
  }, [db]);

  const runSelects = useCallback(async () => {
    (
      await runQuery<{ _id: string; doc: string }>(
        db,
        select()
          .withRecursive({
            table: "descendantRems",
            columns: ["_id", "doc"],
            select: select("jsonRems._id", "jsonRems.doc")
              .from("jsonRems")
              .where({ _id: rootRemId })
              .unionAll(
                select("jsonRems._id", "jsonRems.doc")
                  .from(
                    "descendantRems",
                    sql`json_each("descendantRems"."doc", '$.childrenIds')`
                  )
                  .join("jsonRems", {
                    "jsonRems._id": sql`json_each.value`,
                  })
              ),
          })
          .from("descendantRems")
      )
    ).map(({ doc }) => JSON.parse(doc));
  }, [db]);

  return (
    <div>
      <button onClick={runInserts}>Run inserts</button>
      <button onClick={runUpdates}>Run updated</button>
      <button onClick={runSelects}>Run selects</button>
    </div>
  );
};

const config = {
  dbName: "helloWorld",
  dbBackend: waSqliteWebBackend({
    wasmUrl: sqlWasmUrl,
    pageSize: 64 * 1024,
    cacheSize: -10000,
    vfs: "minimal",
  }),
  plugins: [
    migrationsPlugin({
      migrations: [
        {
          up: async (db) => {
            await runQuery(
              db,
              sql`
                CREATE TABLE IF NOT EXISTS jsonRems (
                  _id TEXT NOT NULL PRIMARY KEY,
                  doc TEXT
                );
                  `
            );

            await runQuery(db, sql`CREATE INDEX jsonRems_id ON jsonRems(_id);`);
          },
          id: 1000,
          name: "createRemJson",
        },
      ],
    }),
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
