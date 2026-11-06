import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { addApplication, addLibrary, scaffoldWorkspace } from "./core.mjs";

const coreSource = readFileSync(new URL("./core.mjs", import.meta.url), "utf8");

const HELP = `kiln — Angular apps and a shared library

Usage
  kiln <name> [options]
  kiln app <name>
  kiln lib <name>

Options
  --apps <web,admin>     Application names. Default: web
  --lib <shared>         Shared library name. Default: shared
  --scope <name>         Import scope. Default: the workspace name
  --style <css|scss>     Stylesheet language. Default: css
  --app-prefix <app>     Selector prefix for applications. Default: app
  --lib-prefix <lib>     Selector prefix for libraries. Default: lib
  --no-routing           Do not add a router
  --no-zoneless          Keep zone.js
  --directory <path>     Output directory. Default: ./<name>
  --skip-git             Do not run git init
  --dry-run              Print the file tree and write nothing
  --help                 Show this help

Inside an existing workspace
  npm run app -- portal
  npm run lib -- ui

Each application gets apps/<name>/eslint.config.js, and each library gets
libs/<name>/eslint.config.js. That file sets the component and directive
prefix for that project and can hold extra rules. Recommended Angular,
TypeScript, template, and accessibility rules live in the workspace
eslint.config.js, which every project extends.

The generated repo uses apps/ and libs/, one angular.json, and a TypeScript
path for @scope/library. Every project is an Angular CLI project.
`;

export function execute(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      apps: { type: "string" },
      lib: { type: "string" },
      scope: { type: "string" },
      style: { type: "string" },
      "app-prefix": { type: "string" },
      "lib-prefix": { type: "string" },
      routing: { type: "boolean" },
      zoneless: { type: "boolean" },
      directory: { type: "string" },
      "skip-git": { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    allowPositionals: true,
    strict: true,
  });

  if (values.help) return { code: 0, output: `${HELP}\n` };

  const [first, second] = positionals;
  if (first === "app" || first === "lib") {
    if (!second) throw new Error(`Usage: kiln ${first} <name>`);
    return runInsideWorkspace(first, second, values["dry-run"]);
  }
  if (!first) throw new Error("Usage: kiln <name> [options]");

  const planned = scaffoldWorkspace(
      {
        name: first,
        apps: values.apps ? values.apps.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
        library: values.lib,
        scope: values.scope,
        style: values.style,
        appPrefix: values["app-prefix"],
        libPrefix: values["lib-prefix"],
        routing: values.routing,
        zoneless: values.zoneless,
      },
      { coreSource },
  );

  const directory = resolve(values.directory ?? first);
  const lines = treeLines(planned.files);
  if (values["dry-run"]) {
    lines.push("", `Dry run. Would write ${Object.keys(planned.files).length} files to ${directory}.`);
    return { code: 0, output: `${lines.join("\n")}\n` };
  }
  if (existsSync(directory) && readdirSync(directory).length > 0) {
    throw new Error(`Directory already exists and is not empty: ${directory}`);
  }
  writeFiles(directory, planned.files);
  if (!values["skip-git"]) {
    spawnSync("git", ["init"], { cwd: directory, stdio: "ignore" });
  }
  lines.push("", `Wrote ${Object.keys(planned.files).length} files to ${directory}.`, "", planned.command);
  return { code: 0, output: `${lines.join("\n")}\n` };
}

function runInsideWorkspace(kind, name, dryRun) {
  const root = findRoot(process.cwd());
  const existing = {
    "angular.json": readFileSync(join(root, "angular.json"), "utf8"),
    "package.json": readFileSync(join(root, "package.json"), "utf8"),
    "tsconfig.json": readFileSync(join(root, "tsconfig.json"), "utf8"),
  };
  const planned = kind === "app" ? addApplication(existing, name) : addLibrary(existing, name);
  const lines = [...Object.keys(planned.files).sort(), ""];
  if (dryRun) {
    lines.push("Dry run. Wrote nothing.");
    return { code: 0, output: `${lines.join("\n")}\n` };
  }
  writeFiles(root, planned.files);
  lines.push(`Added ${kind} ${name}.`);
  return { code: 0, output: `${lines.join("\n")}\n` };
}

function writeFiles(root, files) {
  for (const [filePath, contents] of Object.entries(files)) {
    const absolute = join(root, filePath);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, contents);
  }
}

function findRoot(start) {
  let current = resolve(start);
  for (;;) {
    if (existsSync(join(current, "angular.json")) && existsSync(join(current, "package.json"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new Error("No workspace found. Run this from a kiln project.");
    }
    current = parent;
  }
}

function treeLines(files) {
  return Object.keys(files).sort();
}

export function runCli(argv) {
  try {
    const result = execute(argv);
    process.stdout.write(result.output);
    process.exitCode = result.code;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
