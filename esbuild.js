const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

function copyWebviewAssets() {
  const webviewSrc = path.join(__dirname, "src", "webviews");
  const webviewDist = path.join(__dirname, "dist", "webviews");
  
  if (fs.existsSync(webviewSrc)) {
    fs.cpSync(webviewSrc, webviewDist, { recursive: true });
    console.log("Copied webview assets to dist/webviews");
  }
}

function copyResources() {
  const src = path.join(__dirname, "src", "resources");
  const dest = path.join(__dirname, "dist", "resources");

  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
    console.log("Copied resources to dist/resources");
  }
}

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    outfile: "dist/extension.js",
    external: [
      "vscode",
      "odbc",  // Native module - must be external
      "@intersystems/intersystems-iris-native"  // Native module
    ],
    logLevel: "warning",
    plugins: [
      esbuildProblemMatcherPlugin,
    ],
  });
  
  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
  
  copyWebviewAssets();
  copyResources();
}

const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",
  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`[ERROR] ${text}`);
        if (location === null) {return;}
        console.error(
          `    ${location.file}:${location.line}:${location.column}:`
        );
      });
      console.log("[watch] build finished");
    });
  },
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});