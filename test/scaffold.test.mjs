import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { addApplication, addLibrary, scaffoldWorkspace } from "../src/core.mjs";

const coreSource = readFileSync(new URL("../src/core.mjs", import.meta.url), "utf8");
const bin = new URL("../bin/kiln.mjs", import.meta.url);

function scaffold(extra = {}) {
  return scaffoldWorkspace(
      {
        name: "acme",
        apps: ["web", "admin"],
        library: "shared",
        ...extra,
      },
      { coreSource },
  );
}

describe("scaffoldWorkspace", () => {
  it("builds an apps/libs workspace", () => {
    const { files, command } = scaffold();
    const angular = JSON.parse(files["angular.json"]);
    const pkg = JSON.parse(files["package.json"]);
    const tsconfig = JSON.parse(files["tsconfig.json"]);

    assert.match(command, /^kiln acme --apps web,admin /);

    assert.equal(angular.newProjectRoot, "apps");
    assert.equal(angular.projects.web.projectType, "application");
    assert.equal(angular.projects.web.root, "apps/web");
    assert.equal(angular.projects.admin.root, "apps/admin");
    assert.equal(angular.projects.shared.projectType, "library");
    assert.equal(angular.projects.shared.root, "libs/shared");
    assert.equal(angular.projects.shared.architect.build.builder, "@angular/build:ng-packagr");
    assert.equal(angular.projects.web.architect.build.builder, "@angular/build:application");
    assert.equal(angular.projects.web.architect.build.options.polyfills, undefined);

    assert.deepEqual(tsconfig.compilerOptions.paths["@acme/shared"], [
      "./libs/shared/src/public-api.ts",
    ]);
    assert.equal(pkg.kiln.layout, "apps-libs");

    const app = files["apps/web/src/app/app.ts"];
    const admin = files["apps/admin/src/app/app.ts"];
    assert.match(app, /from '@acme\/shared'/);
    assert.match(admin, /from '@acme\/shared'/);
    assert.match(files["libs/shared/src/public-api.ts"], /export \* from '\.\/lib\/banner'/);
    assert.match(files["libs/shared/package.json"], /"name": "@acme\/shared"/);
    assert.equal(pkg.scripts.start, "ng serve web");
    assert.equal(pkg.scripts["start:admin"], "ng serve admin --port 4201");
    assert.equal(pkg.scripts.build, "node scripts/build.mjs");
    assert.equal(pkg.scripts["build:all"], "ng build web && ng build admin");
    assert.equal(pkg.scripts.lint, "node scripts/lint.mjs");
    assert.equal(pkg.scripts["lint:all"], "ng lint shared && ng lint web && ng lint admin");
    assert.equal(pkg.scripts.serve, "node scripts/serve.mjs");
    assert.equal(pkg.scripts.test, "ng test");
    assert.doesNotMatch(pkg.scripts.start, /ng build shared/);
    assert.ok(files["scripts/build.mjs"]);
    assert.ok(files["scripts/lint.mjs"]);
    assert.ok(files["scripts/serve.mjs"]);
    assert.deepEqual(angular.projects.web.architect.serve.configurations.development.prebundle, {
      exclude: ["@acme/shared"],
    });
    assert.match(files["apps/web/tsconfig.app.json"], /"\.\.\/\.\.\/libs\/\*\*\/\*\.ts"/);
    assert.match(files["apps/admin/tsconfig.app.json"], /libs\/\*\*\/\*\.spec\.ts/);
    assert.equal(pkg.devDependencies.tailwindcss, "^4.3.3");
    assert.equal(pkg.devDependencies["@tailwindcss/postcss"], "^4.3.3");
    assert.equal(pkg.devDependencies.postcss, "^8.5.31");
    assert.equal(pkg.dependencies["@angular/material"], "~22.2.4");
    assert.equal(pkg.dependencies["@angular/cdk"], "~22.2.4");
    assert.equal(pkg.devDependencies.eslint, "^10.13.0");
    assert.equal(pkg.devDependencies["angular-eslint"], "^22.6.0");
    assert.equal(pkg.devDependencies["typescript-eslint"], "^8.72.0");
    assert.deepEqual(JSON.parse(files[".postcssrc.json"]), {
      plugins: { "@tailwindcss/postcss": {} },
    });
    assert.deepEqual(angular.projects.web.architect.build.options.styles, [
      "apps/web/src/tailwind.css",
      "apps/web/src/material-theme.scss",
      "apps/web/src/styles.css",
    ]);
    const webTailwind = files["apps/web/src/tailwind.css"];
    const adminTailwind = files["apps/admin/src/tailwind.css"];
    assert.match(webTailwind, /@import "tailwindcss" source\(none\)/);
    assert.match(webTailwind, /@source "\."/);
    assert.match(webTailwind, /@source "\.\.\/\.\.\/\.\.\/libs"/);
    assert.match(webTailwind, /@theme/);
    assert.match(webTailwind, /for the web application/);
    assert.match(adminTailwind, /for the admin application/);
    assert.notEqual(webTailwind, adminTailwind);
    const theme = files["apps/web/src/material-theme.scss"];
    assert.match(theme, /@include mat\.theme/);
    assert.match(theme, /mat\.\$azure-palette/);
    assert.match(theme, /mat\.\$blue-palette/);
    assert.match(files["apps/web/src/index.html"], /family=Roboto/);
    assert.match(files["apps/web/src/index.html"], /Material\+Symbols\+Outlined/);
    assert.match(files["apps/web/src/app/app.ts"], /MatButton/);
    assert.match(files["apps/web/src/app/app.html"], /matButton="filled"/);
    assert.match(files["apps/admin/src/material-theme.scss"], /mat\.theme/);
    assert.match(files["eslint.config.js"], /tsRecommended/);
    assert.match(files["eslint.config.js"], /templateRecommended/);
    assert.match(files["eslint.config.js"], /templateAccessibility/);
    assert.doesNotMatch(files["eslint.config.js"], /component-selector/);
    const webLint = files["apps/web/eslint.config.js"];
    const adminLint = files["apps/admin/eslint.config.js"];
    const sharedLint = files["libs/shared/eslint.config.js"];
    assert.match(webLint, /the web application only/);
    assert.match(webLint, /prefix: 'app'/);
    assert.match(webLint, /component-selector/);
    assert.match(webLint, /directive-selector/);
    assert.match(adminLint, /the admin application only/);
    assert.match(sharedLint, /the shared library only/);
    assert.match(sharedLint, /prefix: 'lib'/);
    assert.match(files["libs/shared/src/lib/banner.ts"], /styleUrl: '\.\/banner\.css'/);
  });

  it("honors scss, zone.js, a custom prefix, and no routing", () => {
    const { files } = scaffold({
      name: "shop",
      apps: ["web"],
      style: "scss",
      routing: false,
      zoneless: false,
      appPrefix: "shop",
      libPrefix: "cmp",
    });
    const angular = JSON.parse(files["angular.json"]);
    const pkg = JSON.parse(files["package.json"]);
    const app = files["apps/web/src/app/app.ts"];
    assert.deepEqual(angular.projects.web.architect.build.options.styles, [
      "apps/web/src/tailwind.css",
      "apps/web/src/material-theme.scss",
      "apps/web/src/styles.scss",
    ]);
    assert.deepEqual(angular.projects.web.architect.build.options.polyfills, ["zone.js"]);
    assert.equal(pkg.dependencies["zone.js"] !== undefined, true);
    assert.equal(files["apps/web/src/app/app.routes.ts"], undefined);
    assert.doesNotMatch(app, /RouterOutlet/);
    assert.match(app, /from '@shop\/shared'/);
    assert.match(files["apps/web/src/material-theme.scss"], /--mat-sys-surface/);
    assert.match(app, /MatButton/);
    assert.match(files["apps/web/eslint.config.js"], /prefix: 'shop'/);
    assert.match(files["libs/shared/eslint.config.js"], /prefix: 'cmp'/);
    assert.match(app, /selector: 'shop-root'/);
    assert.match(files["libs/shared/src/lib/banner.ts"], /styleUrl: '\.\/banner\.scss'/);
  });

  it("rejects bad names and duplicates", () => {
    assert.throws(() => scaffold({ name: "Acme" }), /kebab-case/);
    assert.throws(() => scaffold({ apps: ["web", "web"] }), /Duplicate/);
    assert.throws(() => scaffold({ apps: ["shared"], library: "shared" }), /both an application/);
    assert.throws(() => scaffold({ apps: ["apps"] }), /reserved/);
  });

  it("adds an app and a library onto an existing workspace", () => {
    const { files } = scaffold();
    const existing = {
      "angular.json": files["angular.json"],
      "package.json": files["package.json"],
      "tsconfig.json": files["tsconfig.json"],
    };
    const withApp = addApplication(existing, "portal");
    const angular = JSON.parse(withApp.files["angular.json"]);
    const pkg = JSON.parse(withApp.files["package.json"]);
    const tsconfig = JSON.parse(withApp.files["tsconfig.json"]);
    assert.equal(angular.projects.portal.root, "apps/portal");
    assert.match(withApp.files["apps/portal/src/app/app.ts"], /from '@acme\/shared'/);
    assert.equal(pkg.scripts.build, "node scripts/build.mjs");
    assert.equal(pkg.scripts["start:portal"], "ng serve portal --port 4202");
    assert.equal(pkg.kiln.apps.at(-1), "portal");
    assert.match(withApp.files["apps/portal/src/tailwind.css"], /for the portal application/);
    assert.match(withApp.files["apps/portal/src/tailwind.css"], /source\(none\)/);
    assert.match(withApp.files["apps/portal/src/material-theme.scss"], /mat\.\$azure-palette/);
    assert.match(withApp.files["apps/portal/eslint.config.js"], /the portal application only/);
    assert.match(withApp.files["apps/portal/eslint.config.js"], /prefix: 'app'/);
    assert.equal(angular.projects.portal.architect.lint.options.eslintConfig, "apps/portal/eslint.config.js");
    assert.equal(pkg.scripts.lint, "node scripts/lint.mjs");
    assert.equal(pkg.devDependencies["angular-eslint"], "^22.6.0");
    assert.equal(pkg.dependencies["@angular/material"], "~22.2.4");
    assert.ok(tsconfig.references.some((item) => item.path === "./apps/portal/tsconfig.app.json"));
    assert.equal(angular.projects.web.root, "apps/web");
    assert.deepEqual(angular.projects.portal.architect.serve.configurations.development.prebundle, {
      exclude: ["@acme/shared"],
    });

    const withLib = addLibrary(
        {
          "angular.json": withApp.files["angular.json"],
          "package.json": withApp.files["package.json"],
          "tsconfig.json": withApp.files["tsconfig.json"],
        },
        "ui",
    );
    const libTs = JSON.parse(withLib.files["tsconfig.json"]);
    const libPkg = JSON.parse(withLib.files["package.json"]);
    assert.deepEqual(libTs.compilerOptions.paths["@acme/ui"], ["./libs/ui/src/public-api.ts"]);
    assert.equal(libPkg.scripts.start, "ng serve web");
    assert.equal(libPkg.scripts["watch:ui"], "ng build ui --watch --configuration development");
    assert.equal(libPkg.scripts["build:ui"], undefined);
    assert.doesNotMatch(libPkg.scripts.start, /ng build ui/);
    const libAngular = JSON.parse(withLib.files["angular.json"]);
    assert.deepEqual(libAngular.projects.web.architect.serve.configurations.development.prebundle, {
      exclude: ["@acme/shared", "@acme/ui"],
    });
    assert.deepEqual(
        libAngular.projects.portal.architect.serve.configurations.development.prebundle,
        { exclude: ["@acme/shared", "@acme/ui"] },
    );
    assert.match(withLib.files["libs/ui/src/public-api.ts"], /export \* from '\.\/lib\/ui'/);
    assert.match(withLib.files["libs/ui/eslint.config.js"], /the ui library only/);
    assert.match(withLib.files["libs/ui/eslint.config.js"], /prefix: 'lib'/);
    assert.equal(
        JSON.parse(withLib.files["angular.json"]).projects.ui.architect.lint.options.eslintConfig,
        "libs/ui/eslint.config.js",
    );
    assert.equal(libPkg.scripts.lint, "node scripts/lint.mjs");
    assert.equal(libPkg.scripts["lint:ui"], undefined);
    assert.throws(() => addApplication(existing, "web"), /already exists/);
  });
});

describe("cli", () => {
  it("writes a workspace and the bundled script can add an app", () => {
    const parent = mkdtempSync(join(tmpdir(), "kiln-"));
    const directory = join(parent, "acme");
    try {
      const created = spawnSync(
          process.execPath,
          [bin.pathname, "acme", "--apps", "web,admin", "--directory", directory, "--skip-git"],
          { encoding: "utf8" },
      );
      assert.equal(created.status, 0, created.stderr);
      assert.match(readFileSync(join(directory, "apps/admin/src/app/app.ts"), "utf8"), /@acme\/shared/);
      assert.match(readFileSync(join(directory, "apps/admin/eslint.config.js"), "utf8"), /prefix: 'app'/);

      const added = spawnSync(process.execPath, ["scripts/workspace.mjs", "lib", "ui"], {
        cwd: directory,
        encoding: "utf8",
      });
      assert.equal(added.status, 0, added.stderr);
      const pkg = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
      assert.ok(pkg.kiln.libs.includes("ui"));
      assert.match(readFileSync(join(directory, "libs/ui/src/lib/ui.ts"), "utf8"), /export class Ui/);
      assert.match(readFileSync(join(directory, "libs/ui/eslint.config.js"), "utf8"), /prefix: 'lib'/);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("dry-run writes nothing and help exits 0", () => {
    const dry = spawnSync(process.execPath, [bin.pathname, "acme", "--dry-run"], {
      encoding: "utf8",
    });
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /Dry run/);
    const help = spawnSync(process.execPath, [bin.pathname, "--help"], { encoding: "utf8" });
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /Angular CLI project/);
  });
});
