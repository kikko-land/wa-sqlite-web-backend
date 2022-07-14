import typescript from "rollup-plugin-typescript2";
import { nodeResolve } from "@rollup/plugin-node-resolve";

function getConfig(entry, filename) {
  return {
    input: entry,
    output: {
      dir: "dist",
    },
    external: [
      "wa-sqlite",
      "wa-sqlite/src/VFS.js",
      "wa-sqlite/dist/wa-sqlite-async.mjs",
    ],
    plugins: [nodeResolve(), typescript({})],
  };
}

export default [getConfig("src/index.ts", "index.js")];
