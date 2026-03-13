import { build } from "esbuild";

await build({
  entryPoints: ["src/cli.ts"],
  bundle: true,
  outfile: "dist/cli.js",
  platform: "node",
  target: "node18",
  format: "cjs",
  // node-pty is a native module — must stay external
  external: ["node-pty"],
  banner: {
    js: "#!/usr/bin/env node",
  },
  // Inline @clauderoulette/shared so the published package has no workspace deps
  alias: {
    "@clauderoulette/shared": "../../packages/shared/src/index.ts",
  },
});

console.log("Built dist/cli.js");
