import {
  acquireWithTrJobOrWait,
  IDbBackend,
  IExecQueriesResult,
  initJobsState,
  IQuery,
  IQueryResult,
  IQueryValue,
  ITransactionOpts,
  releaseTrJobIfPossible,
} from "@kikko-land/kikko";
import AwaitLock from "await-lock";
import * as SQLite from "wa-sqlite";
import SQLiteAsyncModule from "wa-sqlite/dist/wa-sqlite-async.mjs";

import { IDBAtomicVFS } from "./IDBAtomicVFS";
import { IDBBatchAtomicVFS } from "./IDBBatchAtomicVFS";
import { IDCachedWritesVFS } from "./IDBCachedWritesVFS";

export const waSqliteWebBackend =
  ({
    wasmUrl,
    pageSize,
    cacheSize,
    vfs: _vfs,
  }: {
    wasmUrl: string;
    pageSize?: number;
    cacheSize?: number;
    vfs?: "atomic" | "batch-atomic" | "minimal";
  }): IDbBackend =>
  ({ dbName }) => {
    let sqlite3: SQLiteAPI | undefined;
    let db: number | undefined;

    const vfs = _vfs ? _vfs : "minimal";

    const jobsState = initJobsState();

    const allQueriesLock = new AwaitLock();

    return {
      async initialize() {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const module = await SQLiteAsyncModule({ locateFile: () => wasmUrl });

        sqlite3 = SQLite.Factory(module);

        const klass =
          vfs === "atomic"
            ? IDBAtomicVFS
            : vfs === "minimal"
            ? IDCachedWritesVFS
            : IDBBatchAtomicVFS;

        sqlite3.vfs_register(
          new klass(`idb-${vfs}-relaxed`, {
            purge: "manual",
            durability: "relaxed",
          })
        );

        db = await sqlite3.open_v2(
          "wa-sqlite-" + dbName,
          undefined,
          `idb-${vfs}-relaxed`
        );

        await sqlite3.exec(
          db,
          `PRAGMA cache_size=${cacheSize === undefined ? 5000 : cacheSize};`
        );
        await sqlite3.exec(
          db,
          `PRAGMA page_size=${pageSize === undefined ? 32 * 1024 : pageSize};`
        );
        await sqlite3.exec(db, `PRAGMA journal_mode=MEMORY;`);
        await sqlite3.exec(db, `PRAGMA temp_store=MEMORY;`);
      },
      async execQueries(queries: IQuery[], transactionOpts?: ITransactionOpts) {
        if (!sqlite3 || db === undefined) {
          throw new Error("DB is not initialized");
        }
        const startBlockAt = performance.now();
        const job = await acquireWithTrJobOrWait(jobsState, transactionOpts);
        await allQueriesLock.acquireAsync();
        const endBlockAt = performance.now();
        const blockTime = endBlockAt - startBlockAt;

        const totalStartedAt = performance.now();

        try {
          const result: IExecQueriesResult["result"] = [];

          for (const q of queries) {
            const rows: IQueryResult = [];

            const startTime = performance.now();

            const str = sqlite3.str_new(db, q.text);
            const prepare = await sqlite3.prepare_v2(
              db,
              sqlite3.str_value(str)
            );

            if (!prepare) {
              throw new Error(`Failed to prepare ${q.text} query`);
            }

            sqlite3.bind_collection(
              prepare.stmt,
              q.values as SQLiteCompatibleType[]
            );

            const columns = sqlite3.column_names(prepare.stmt);

            while ((await sqlite3.step(prepare.stmt)) === SQLite.SQLITE_ROW) {
              if (columns.length > 0) {
                rows.push(
                  Object.fromEntries(
                    sqlite3
                      .row(prepare.stmt)
                      .map((val, i) => [columns[i], val as IQueryValue])
                  )
                );
              }
            }
            sqlite3.str_finish(str);
            await sqlite3.finalize(prepare.stmt);

            const endTime = performance.now();

            result.push({
              rows,
              performance: {
                execTime: endTime - startTime,
              },
            });
          }

          const totalFinishedAt = performance.now();

          return Promise.resolve({
            result,
            performance: {
              totalTime: totalFinishedAt - totalStartedAt,
              blockTime,
            },
          });
        } catch (e) {
          if (transactionOpts?.rollbackOnFail) {
            try {
              await sqlite3.exec(db, "ROLLBACK");
            } catch (rollbackError) {
              console.error(`Failed to rollback`, e, rollbackError);
            }
          }

          throw e;
        } finally {
          allQueriesLock.release();
          releaseTrJobIfPossible(jobsState, job, transactionOpts);
        }
      },
      async stop() {
        if (sqlite3 && db !== undefined) {
          await sqlite3.close(db);
        }

        sqlite3 = undefined;
        db = undefined;
      },
    };
  };
