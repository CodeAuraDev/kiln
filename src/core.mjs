// @ts-nocheck
/**
 * Pure scaffolder for an Angular CLI workspace.
 * Applications live in apps/, shared code lives in libs/.
 * Safe to import from a browser. Node I/O stays in cli.mjs.
 */

export const PACKAGE_NAME = "kiln";
export const PACKAGE_VERSION = "1.0.0";

/** Versions pinned to the Angular CLI 22.2.4 schematic catalog. */
export const VERSIONS = {
  angular: "^22.2.0",
  angularExact: "22.2.0",
  cli: "^22.2.4",
  build: "^22.2.4",
  ngPackagr: "^22.2.0",
  typescript: "~6.0.2",
  rxjs: "~7.8.0",
  tslib: "^2.3.0",
  tslibExact: "2.3.0",
  prettier: "^3.8.1",
  vitest: "^5.0.0",
  jsdom: "^30.0.0",
  zone: "~0.16.0",
  /* 4.3 is the first release whose `source()` import option can limit detection per stylesheet. */
  tailwind: "^4.3.3",
  tailwindPostcss: "^4.3.3",
  postcss: "^8.5.31",
  /* Same range `ng add @angular/material` writes. */
  material: "~22.2.4",
  eslint: "^10.13.0",
  eslintJs: "^10.0.1",
  angularEslint: "^22.6.0",
  typescriptEslint: "^8.72.0",
};

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const RESERVED = new Set([
  "apps",
  "libs",
  "dist",
  "node_modules",
  "src",
  "scripts",
  "public",
  "e2e",
  "assets",
  "angular",
  "test",
]);

export class ScaffoldError extends Error {
  constructor(message) {
    super(message);
    this.name = "ScaffoldError";
  }
}

export function classify(name) {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function assertKebab(value, label) {
  if (typeof value !== "string" || !KEBAB.test(value)) {
    throw new ScaffoldError(
      `${label} must be kebab-case (letters, numbers, dashes) and start with a letter.`,
    );
  }
  if (RESERVED.has(value)) {
    throw new ScaffoldError(`${label} "${value}" is reserved.`);
  }
}

function unique(items, label) {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item)) throw new ScaffoldError(`Duplicate ${label} "${item}".`);
    seen.add(item);
  }
}

/**
 * @param {Record<string, unknown>} input
 */
export function normalize(input) {
  const source = input && typeof input === "object" ? input : {};
  const name = String(source.name ?? "").trim();
  assertKebab(name, "Workspace name");

  const scopeRaw = String(source.scope ?? name).trim().replace(/^@/, "");
  assertKebab(scopeRaw, "Scope");

  const apps = (Array.isArray(source.apps) ? source.apps : ["web"]).map((item) =>
    String(item).trim(),
  );
  if (apps.length === 0) throw new ScaffoldError("Add at least one application.");
  apps.forEach((app) => assertKebab(app, "Application name"));
  unique(apps, "application");

  const library = String(source.library ?? "shared").trim();
  assertKebab(library, "Library name");
  if (apps.includes(library)) {
    throw new ScaffoldError(`"${library}" cannot be both an application and a library.`);
  }

  const style = source.style ?? "css";
  if (style !== "css" && style !== "scss") {
    throw new ScaffoldError('Style must be "css" or "scss".');
  }

  const appPrefix = String(source.appPrefix ?? "app").trim();
  const libPrefix = String(source.libPrefix ?? "lib").trim();
  assertKebab(appPrefix, "App prefix");
  assertKebab(libPrefix, "Library prefix");

  return {
    name,
    scope: scopeRaw,
    apps,
    library,
    libs: [library],
    style,
    routing: source.routing !== false,
    zoneless: source.zoneless !== false,
    appPrefix,
    libPrefix,
  };
}

export function commandLine(input) {
  const options = normalize(input);
  const parts = [
    "kiln",
    options.name,
    `--apps ${options.apps.join(",")}`,
    `--lib ${options.library}`,
    `--scope ${options.scope}`,
    `--style ${options.style}`,
  ];
  if (options.appPrefix !== "app") parts.push(`--app-prefix ${options.appPrefix}`);
  if (options.libPrefix !== "lib") parts.push(`--lib-prefix ${options.libPrefix}`);
  if (!options.routing) parts.push("--no-routing");
  if (!options.zoneless) parts.push("--no-zoneless");
  return parts.join(" ");
}

export function importPath(scope, library) {
  return `@${scope}/${library}`;
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function composeScripts(apps, libs) {
  const appSteps = apps.map((name) => `ng build ${name}`).join(" && ");
  const scripts = {
    ng: "ng",
    // Apps compile library source through the path map, so serve does not
    // build libraries first and does not need a separate library watch.
    start: `ng serve ${apps[0]}`,
    build: appSteps,
    test: "ng test",
    lint: [...libs, ...apps].map((name) => `ng lint ${name}`).join(" && "),
    app: "node scripts/workspace.mjs app",
    lib: "node scripts/workspace.mjs lib",
  };
  apps.forEach((name, index) => {
    const port = 4200 + index;
    const portFlag = port === 4200 ? "" : ` --port ${port}`;
    scripts[`start:${name}`] = `ng serve ${name}${portFlag}`;
    scripts[`lint:${name}`] = `ng lint ${name}`;
  });
  libs.forEach((name) => {
    scripts[`build:${name}`] = `ng build ${name}`;
    scripts[`watch:${name}`] = `ng build ${name} --watch --configuration development`;
    scripts[`lint:${name}`] = `ng lint ${name}`;
  });
  return scripts;
}

function kilnBlock(options) {
  return {
    layout: "apps-libs",
    scope: options.scope,
    style: options.style,
    appPrefix: options.appPrefix,
    libPrefix: options.libPrefix,
    routing: options.routing,
    zoneless: options.zoneless,
    apps: [...options.apps],
    libs: [...options.libs],
  };
}

function ensureMaterial(pkg) {
  pkg.dependencies ??= {};
  pkg.dependencies["@angular/cdk"] ??= VERSIONS.material;
  pkg.dependencies["@angular/material"] ??= VERSIONS.material;
}

function ensureTailwind(pkg) {
  pkg.devDependencies ??= {};
  pkg.devDependencies["@tailwindcss/postcss"] ??= VERSIONS.tailwindPostcss;
  pkg.devDependencies.postcss ??= VERSIONS.postcss;
  pkg.devDependencies.tailwindcss ??= VERSIONS.tailwind;
}

function ensureEslint(pkg) {
  pkg.devDependencies ??= {};
  pkg.devDependencies["@eslint/js"] ??= VERSIONS.eslintJs;
  pkg.devDependencies["angular-eslint"] ??= VERSIONS.angularEslint;
  pkg.devDependencies.eslint ??= VERSIONS.eslint;
  pkg.devDependencies["typescript-eslint"] ??= VERSIONS.typescriptEslint;
}

function postcssConfig() {
  return json({
    plugins: {
      "@tailwindcss/postcss": {},
    },
  });
}

function tailwindCss(name) {
  return `/* Tailwind CSS 4.3 for the ${name} application.
   This file is the configuration. Other apps do not read it.
   source(none) stops a workspace-root scan, which would mix every app's classes in.
   @source "." is this app's src. @source "../../../libs" is the shared libraries.
*/
@import "tailwindcss" source(none);
@source ".";
@source "../../../libs";

@theme {
  --font-sans: ui-sans-serif, system-ui, sans-serif;
  --color-ink: #1c1917;
  --color-paper: #f6f1e8;
  --color-kiln: #e24a2a;
}
`;
}

function materialTheme() {
  return `// Include theming for Angular Material with \`mat.theme()\`.
// This Sass mixin defines the CSS variables that style Angular Material
// components to the Material 3 spec.
// https://material.angular.dev/guide/theming
@use '@angular/material' as mat;

html {
  height: 100%;
  @include mat.theme((
    color: (
      primary: mat.$azure-palette,
      tertiary: mat.$blue-palette,
    ),
    typography: Roboto,
    density: 0,
  ));
}

body {
  color-scheme: light;
  background-color: var(--mat-sys-surface);
  color: var(--mat-sys-on-surface);
  font: var(--mat-sys-body-medium);
  margin: 0;
  height: 100%;
}
`;
}

function rootEslintConfig() {
  return `// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';  
import angular from 'angular-eslint';

// Recommended rules for every project. Selector prefixes are not set here:
// each application and library owns those in its own eslint.config.js.
export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/.angular/**', '**/node_modules/**', '**/coverage/**'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
  },
);
`;
}

function projectEslintConfig(kind, name, prefix) {
  return `// @ts-check
// ESLint for the ${name} ${kind} only.
// Recommended Angular, TypeScript, template, and accessibility rules come from
// the workspace root. Change the prefix, or add rules, in this file.
import tseslint from 'typescript-eslint';

import rootConfig from '../../eslint.config.js';

export default tseslint.config(...rootConfig, {
  files: ['**/*.ts'],
  rules: {
    '@angular-eslint/directive-selector': [
      'error',
      { type: 'attribute', prefix: '${prefix}', style: 'camelCase' },
    ],
    '@angular-eslint/component-selector': [
      'error',
      { type: 'element', prefix: '${prefix}', style: 'kebab-case' },
    ],
  },
}, {
  files: ['**/*.html'],
  rules: {},
});
`;
}

function packageJson(options) {
  const dependencies = {
    "@angular/common": VERSIONS.angular,
    "@angular/compiler": VERSIONS.angular,
    "@angular/core": VERSIONS.angular,
    "@angular/cdk": VERSIONS.material,
    "@angular/forms": VERSIONS.angular,
    "@angular/material": VERSIONS.material,
    "@angular/platform-browser": VERSIONS.angular,
    "@angular/router": VERSIONS.angular,
    rxjs: VERSIONS.rxjs,
    tslib: VERSIONS.tslib,
  };
  if (!options.zoneless) dependencies["zone.js"] = VERSIONS.zone;

  return {
    name: options.name,
    version: "0.0.0",
    private: true,
    scripts: composeScripts(options.apps, options.libs),
    kiln: kilnBlock(options),
    dependencies,
    devDependencies: {
      "@angular/build": VERSIONS.build,
      "@angular/cli": VERSIONS.cli,
      "@angular/compiler-cli": VERSIONS.angular,
      "@eslint/js": VERSIONS.eslintJs,
      "@tailwindcss/postcss": VERSIONS.tailwindPostcss,
      "angular-eslint": VERSIONS.angularEslint,
      eslint: VERSIONS.eslint,
      jsdom: VERSIONS.jsdom,
      "ng-packagr": VERSIONS.ngPackagr,
      postcss: VERSIONS.postcss,
      prettier: VERSIONS.prettier,
      tailwindcss: VERSIONS.tailwind,
      "typescript-eslint": VERSIONS.typescriptEslint,
      typescript: VERSIONS.typescript,
      vitest: VERSIONS.vitest,
    },
  };
}

function librarySpecifiers(options) {
  return options.libs.map((lib) => importPath(options.scope, lib));
}

function applicationProject(name, options) {
  const root = `apps/${name}`;
  const sourceRoot = `${root}/src`;
  const buildOptions = {
    browser: `${sourceRoot}/main.ts`,
    tsConfig: `${root}/tsconfig.app.json`,
    assets: [{ glob: "**/*", input: `${root}/public` }],
    styles: [
      `${sourceRoot}/tailwind.css`,
      `${sourceRoot}/material-theme.scss`,
      `${sourceRoot}/styles.${options.style}`,
    ],
  };
  if (!options.zoneless) buildOptions.polyfills = ["zone.js"];
  if (options.style !== "css") buildOptions.inlineStyleLanguage = options.style;

  const schematics = {};
  if (options.style !== "css") {
    schematics["@schematics/angular:component"] = { style: options.style };
  }

  const project = {
    projectType: "application",
    root,
    sourceRoot,
    prefix: options.appPrefix,
    architect: {
      build: {
        builder: "@angular/build:application",
        defaultConfiguration: "production",
        options: buildOptions,
        configurations: {
          production: {
            budgets: [
              { type: "initial", maximumWarning: "500kB", maximumError: "1MB" },
              { type: "anyComponentStyle", maximumWarning: "4kB", maximumError: "8kB" },
            ],
            outputHashing: "all",
          },
          development: {
            optimization: false,
            extractLicenses: false,
            sourceMap: true,
          },
        },
      },
      serve: {
        builder: "@angular/build:dev-server",
        defaultConfiguration: "development",
        options: {},
        configurations: {
          production: { buildTarget: `${name}:build:production` },
          development: {
            buildTarget: `${name}:build:development`,
            // Bundle workspace libraries into this app. Vite otherwise prebundles
            // them once and ignores later TypeScript and style edits in libs/.
            prebundle: { exclude: librarySpecifiers(options) },
          },
        },
      },
      test: {
        builder: "@angular/build:unit-test",
        options: {},
      },
      lint: {
        builder: "@angular-eslint/builder:lint",
        options: {
          eslintConfig: `${root}/eslint.config.js`,
          lintFilePatterns: [`${root}/**/*.ts`, `${root}/**/*.html`],
        },
      },
    },
  };
  if (Object.keys(schematics).length > 0) project.schematics = schematics;
  return project;
}

function libraryProject(name, options) {
  const root = `libs/${name}`;
  return {
    projectType: "library",
    root,
    sourceRoot: `${root}/src`,
    prefix: options.libPrefix,
    architect: {
      build: {
        builder: "@angular/build:ng-packagr",
        defaultConfiguration: "production",
        options: {
          project: `${root}/ng-package.json`,
        },
        configurations: {
          production: { tsConfig: `${root}/tsconfig.lib.prod.json` },
          development: { tsConfig: `${root}/tsconfig.lib.json` },
        },
      },
      test: {
        builder: "@angular/build:unit-test",
        options: {
          tsConfig: `${root}/tsconfig.spec.json`,
        },
      },
      lint: {
        builder: "@angular-eslint/builder:lint",
        options: {
          eslintConfig: `${root}/eslint.config.js`,
          lintFilePatterns: [`${root}/**/*.ts`, `${root}/**/*.html`],
        },
      },
    },
  };
}

function angularJson(options) {
  const projects = {};
  for (const app of options.apps) projects[app] = applicationProject(app, options);
  for (const lib of options.libs) projects[lib] = libraryProject(lib, options);
  return {
    $schema: "./node_modules/@angular/cli/lib/config/schema.json",
    version: 1,
    cli: { packageManager: "npm" },
    newProjectRoot: "apps",
    projects,
  };
}

function tsconfig(options) {
  const paths = {};
  for (const lib of options.libs) {
    // Source only. The application builder compiles this entry, and the
    // files it pulls in, as part of the app. Edits in libs/ rebuild with
    // ng serve. dist/ is for publishing the library, not for app development.
    paths[importPath(options.scope, lib)] = [`./libs/${lib}/src/public-api.ts`];
  }
  const references = [];
  for (const app of options.apps) {
    references.push({ path: `./apps/${app}/tsconfig.app.json` });
    references.push({ path: `./apps/${app}/tsconfig.spec.json` });
  }
  for (const lib of options.libs) {
    references.push({ path: `./libs/${lib}/tsconfig.lib.json` });
    references.push({ path: `./libs/${lib}/tsconfig.spec.json` });
  }
  return {
    compileOnSave: false,
    compilerOptions: {
      strict: true,
      noImplicitOverride: true,
      noPropertyAccessFromIndexSignature: true,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: true,
      skipLibCheck: true,
      isolatedModules: true,
      experimentalDecorators: true,
      importHelpers: true,
      target: "ES2022",
      module: "preserve",
      paths,
    },
    angularCompilerOptions: {
      enableI18nLegacyMessageIdFormat: false,
      strictInjectionParameters: true,
      strictInputAccessModifiers: true,
      strictInputTypes: true,
      strictOutputEventTypes: true,
      strictTemplates: true,
    },
    files: [],
    references,
  };
}

function appFiles(name, options) {
  const root = `apps/${name}`;
  const styleExt = options.style;
  const specifier = importPath(options.scope, options.library);
  const selector = `${options.appPrefix}-root`;
  const banner = `${options.libPrefix}-banner`;
  const title = classify(name);
  const routingImports = options.routing ? "\nimport { RouterOutlet } from '@angular/router';" : "";
  const componentImports = options.routing ? `RouterOutlet, Banner, MatButton` : "Banner, MatButton";
  const outlet = options.routing ? "\n  <router-outlet />" : "";

  const files = {
    [`${root}/eslint.config.js`]: projectEslintConfig("application", name, options.appPrefix),
    [`${root}/public/favicon.svg`]: faviconSvg(name),
    [`${root}/src/index.html`]: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <base href="/" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/svg+xml" href="favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500&display=swap" rel="stylesheet" />
    <link href="https://fonts.googleapis.com/icon?family=Material+Symbols+Outlined" rel="stylesheet" />
  </head>
  <body>
    <${selector}></${selector}>
  </body>
</html>
`,
    [`${root}/src/main.ts`]: `import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
`,
    [`${root}/src/styles.${styleExt}`]: `/* Application styles. Surface, type, and margin come from material-theme.scss. */
`,
    [`${root}/src/material-theme.scss`]: materialTheme(),
    [`${root}/src/tailwind.css`]: tailwindCss(name),
    [`${root}/src/app/app.ts`]: `import { Component, signal } from '@angular/core';${routingImports}
import { MatButton } from '@angular/material/button';
import { Banner } from '${specifier}';

@Component({
  selector: '${selector}',
  imports: [${componentImports}],
  templateUrl: './app.html',
  styleUrl: './app.${styleExt}',
})
export class App {
  protected readonly title = signal('${name}');
}
`,
    [`${root}/src/app/app.html`]: `<main class="mx-auto max-w-xl px-5 py-12">
  <h1 class="mb-3 text-3xl font-semibold tracking-tight">Hello, {{ title() }}</h1>
  <${banner} [title]="title()" />${outlet}
  <p class="mt-6">
    <button matButton="filled" type="button">{{ title() }}</button>
  </p>
</main>
`,
    [`${root}/src/app/app.${styleExt}`]: `:host {
  display: block;
}
`,
    [`${root}/src/app/app.config.ts`]: appConfig(options),
    [`${root}/src/app/app.spec.ts`]: appSpec(name, options),
    [`${root}/tsconfig.app.json`]: `{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "types": []
  },
  "include": ["src/**/*.ts", "../../libs/**/*.ts"],
  "exclude": ["src/**/*.spec.ts", "../../libs/**/*.spec.ts"]
}
`,
    [`${root}/tsconfig.spec.json`]: `{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.d.ts", "src/**/*.spec.ts", "../../libs/**/*.ts"],
  "exclude": ["../../libs/**/*.spec.ts"]
}
`,
  };

  if (options.routing) {
    files[`${root}/src/app/app.routes.ts`] = `import { Routes } from '@angular/router';

export const routes: Routes = [];
`;
  }
  return files;
}

function appConfig(options) {
  const zoneImport = options.zoneless ? "" : ", provideZoneChangeDetection";
  const routerImport = options.routing
    ? `import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
`
    : "";
  const providers = ["    provideBrowserGlobalErrorListeners(),"];
  if (!options.zoneless) {
    providers.push("    provideZoneChangeDetection({ eventCoalescing: true }),");
  }
  if (options.routing) providers.push("    provideRouter(routes),");
  return `import { ApplicationConfig, provideBrowserGlobalErrorListeners${zoneImport} } from '@angular/core';
${routerImport}
export const appConfig: ApplicationConfig = {
  providers: [
${providers.join("\n")}
  ],
};
`;
}

function appSpec(name, options) {
  const body = options.zoneless ? "await fixture.whenStable();" : "fixture.detectChanges();";
  const asyncMark = options.zoneless ? "async " : "";
  return `import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render title', ${asyncMark}() => {
    const fixture = TestBed.createComponent(App);
    ${body}
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Hello, ${name}');
  });
});
`;
}

function libraryFiles(name, options) {
  const root = `libs/${name}`;
  const specifier = importPath(options.scope, name);
  const selector = `${options.libPrefix}-banner`;
  const primary = name === options.library;
  return {
    [`${root}/eslint.config.js`]: projectEslintConfig("library", name, options.libPrefix),
    [`${root}/ng-package.json`]: json({
      $schema: "../../node_modules/ng-packagr/ng-package.schema.json",
      dest: `../../dist/${name}`,
      lib: { entryFile: "src/public-api.ts" },
    }),
    [`${root}/package.json`]: json({
      name: specifier,
      version: "0.0.1",
      peerDependencies: {
        "@angular/common": `^${VERSIONS.angularExact}`,
        "@angular/core": `^${VERSIONS.angularExact}`,
      },
      dependencies: { tslib: `^${VERSIONS.tslibExact}` },
      sideEffects: false,
    }),
    [`${root}/tsconfig.lib.json`]: `{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "../../out-tsc/lib",
    "declaration": true,
    "declarationMap": true,
    "types": []
  },
  "include": ["src/**/*.ts"],
  "exclude": ["**/*.spec.ts"]
}
`,
    [`${root}/tsconfig.lib.prod.json`]: `{
  "extends": "./tsconfig.lib.json",
  "compilerOptions": {
    "declarationMap": false
  },
  "angularCompilerOptions": {
    "compilationMode": "partial"
  }
}
`,
    [`${root}/tsconfig.spec.json`]: `{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "../../out-tsc/spec",
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.d.ts", "src/**/*.spec.ts"]
}
`,
    [`${root}/src/public-api.ts`]: primary ? publicApiPrimary() : publicApiPlain(name),
    ...librarySources(name, options, primary, selector),
  };
}

function publicApiPrimary() {
  return `/*
 * Public API of the shared library.
 * Applications import from this file only.
 */

export * from './lib/banner';
export * from './lib/workspace-label';
export * from './lib/format-app-title';
`;
}

function publicApiPlain(name) {
  return `/*
 * Public API of ${name}.
 */

export * from './lib/${name}';
`;
}

function librarySources(name, options, primary, selector) {
  const root = `libs/${name}/src/lib`;
  if (!primary) {
    const className = classify(name);
    return {
      [`${root}/${name}.ts`]: `import { Component } from '@angular/core';

@Component({
  selector: '${options.libPrefix}-${name}',
  template: \`<p>${name} works!</p>\`,
})
export class ${className} {}
`,
      [`${root}/${name}.spec.ts`]: `import { TestBed } from '@angular/core/testing';
import { ${className} } from './${name}';

describe('${className}', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [${className}],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(${className});
    expect(fixture.componentInstance).toBeTruthy();
  });
});
`,
    };
  }

  return {
    [`${root}/banner.ts`]: `import { Component, inject, input } from '@angular/core';
import { formatAppTitle } from './format-app-title';
import { WorkspaceLabel } from './workspace-label';

@Component({
  selector: '${selector}',
  imports: [],
  templateUrl: './banner.html',
  styleUrl: './banner.${options.style}',
})
export class Banner {
  readonly title = input.required<string>();
  private readonly workspace = inject(WorkspaceLabel);

  protected label(): string {
    return formatAppTitle(this.workspace.org(), this.title());
  }
}
`,
    [`${root}/banner.html`]: `<p class="m-0 text-sm font-semibold leading-snug text-kiln">{{ label() }}</p>
`,
    [`${root}/banner.${options.style}`]: `:host {
  display: block;
}
`,
    [`${root}/banner.spec.ts`]: `import { TestBed } from '@angular/core/testing';
import { Banner } from './banner';

describe('Banner', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Banner],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(Banner);
    fixture.componentRef.setInput('title', 'web');
    expect(fixture.componentInstance).toBeTruthy();
  });
});
`,
    [`${root}/workspace-label.ts`]: `import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WorkspaceLabel {
  readonly org = signal('${options.scope}');
}
`,
    [`${root}/format-app-title.ts`]: `export function formatAppTitle(org: string, app: string): string {
  return org + ' / ' + app;
}
`,
    [`${root}/format-app-title.spec.ts`]: `import { formatAppTitle } from './format-app-title';

describe('formatAppTitle', () => {
  it('joins the workspace and the app', () => {
    expect(formatAppTitle('${options.scope}', 'web')).toBe('${options.scope} / web');
  });
});
`,
  };
}

function faviconSvg(label) {
  const letter = label.charAt(0).toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#14110e"/>
  <path d="M8 22h16v2H8zM9 22V14a7 7 0 0 1 14 0v8" fill="none" stroke="#e24a2a" stroke-width="2"/>
  <text x="16" y="20" text-anchor="middle" font-family="system-ui" font-size="9" fill="#f6f1e8">${letter}</text>
</svg>
`;
}

function readme(options) {
  const specifier = importPath(options.scope, options.library);
  const apps = options.apps.map((name) => `- \`apps/${name}\` — application. \`npm run start:${name}\``).join("\n");
  const first = options.apps[0];
  return `# ${options.name}

Angular workspace for more than one application, plus a library they share. Applications live in \`apps/\`, shared code lives in \`libs/\`, and every project is an Angular CLI project in one \`angular.json\`.

\`\`\`
${options.name}/
├── angular.json          all projects, one CLI config
├── eslint.config.js      recommended Angular rules, shared
├── tsconfig.json         path mapping for ${specifier}
├── apps/
${options.apps.map((name) => `│   └── ${name}/             eslint.config.js sets the ${options.appPrefix} prefix`).join("\n")}
└── libs/
    └── ${options.library}/       eslint.config.js sets the ${options.libPrefix} prefix, imported as ${specifier}
\`\`\`

## Applications

${apps}

## Shared library

\`${specifier}\` is an Angular library. Its public surface is \`libs/${options.library}/src/public-api.ts\`. Applications import that package name:

\`\`\`ts
import { Banner, WorkspaceLabel } from '${specifier}';
\`\`\`

\`tsconfig.json\` maps the package straight at the library source, not at \`dist/\`:

\`\`\`json
{
  "${specifier}": ["./libs/${options.library}/src/public-api.ts"]
}
\`\`\`

\`ng serve\` compiles that entry with the application. Each app \`tsconfig.app.json\` includes \`libs/**/*.ts\`, and the dev server excludes \`@${options.scope}/*\` from Vite prebundling, so library TypeScript, templates, and component styles rebuild with the running app. There is no separate library build while you are working. \`npm run build:${options.library}\` is only for packaging the library into \`dist/${options.library}\` when you want to publish it.

Component styles live next to the component (\`banner.${options.style}\` uses \`styleUrl\`). The application builder compiles those styles with the component, so a style edit reloads too. Tailwind utilities used in library templates are already in each app's scan via \`@source "../../../libs"\`.

Do not deep-import from \`libs/${options.library}/src/lib\`. Add exports to \`public-api.ts\` instead. That file is the boundary between the library and every app.

## Tailwind CSS

Tailwind CSS 4.3 is installed once for the workspace (\`.postcssrc.json\` loads \`@tailwindcss/postcss\`). Each application is configured by its own \`apps/<name>/src/tailwind.css\`:

\`\`\`css
@import "tailwindcss" source(none);
@source ".";
@source "../../../libs";

@theme {
  --color-kiln: #e24a2a;
}
\`\`\`

\`source(none)\` turns off the default scan, which starts at the workspace root and would otherwise emit every other app's classes. \`@source "."\` is this app. \`@source "../../../libs"\` picks up utilities used in shared libraries, including ones added later with \`npm run lib\`. \`@theme\` in that file applies only to that app.

## Angular Material

Each application includes Angular Material 22.2.4. \`apps/<name>/src/material-theme.scss\` is that app's Material 3 theme (\`mat.theme\` with the azure and blue palettes, Roboto, density 0). \`index.html\` loads Roboto and the Material Symbols font. The root component imports \`MatButton\`.

## ESLint

\`angular-eslint\` 22.6 supplies the recommended Angular rules. The workspace \`eslint.config.js\` turns on TypeScript recommended and stylistic rules, \`@angular-eslint\` \`tsRecommended\`, and the template recommended and accessibility rules. It does not set a selector prefix.

Each application has \`apps/<name>/eslint.config.js\`, and each library has \`libs/<name>/eslint.config.js\`. \`ng lint <name>\` loads that file. It extends the workspace config and sets the prefix for that project only:

\`\`\`js
// apps/<name>/eslint.config.js
'@angular-eslint/component-selector': ['error', { type: 'element', prefix: '${options.appPrefix}', style: 'kebab-case' }]
'@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: '${options.appPrefix}', style: 'camelCase' }]

// libs/<name>/eslint.config.js
'@angular-eslint/component-selector': ['error', { type: 'element', prefix: '${options.libPrefix}', style: 'kebab-case' }]
'@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: '${options.libPrefix}', style: 'camelCase' }]
\`\`\`

Edit one project's file to give it a different prefix or extra rules. The others keep their own copy. \`npm run lint\` runs \`ng lint\` for every library and application.

## Scripts

| Command | What it does |
| --- | --- |
| \`npm install\` | Installs one dependency tree for the whole workspace. |
| \`npm start\` | Serves \`${first}\` on port 4200. Library TypeScript and styles compile with the app. |
| \`npm run start:${first}\` | Same serve target, named explicitly. |
| \`npm run build\` | Builds every application. Libraries compile from source with each app. |
| \`npm run build:${options.library}\` | Packages the library into \`dist/${options.library}\` for publishing. Not required to serve or build apps. |
| \`npm run watch:${options.library}\` | Optional packaged rebuild. Not used by \`npm start\`. |
| \`npm test\` | Runs Vitest through \`ng test\`. Library source is compiled with the tests. |
| \`npm run lint\` | Lints every library and application with its own ESLint config. |
| \`npm run lint:${first}\` | Lints \`${first}\` only. |
| \`npm run lint:${options.library}\` | Lints the \`${options.library}\` library only. |
| \`npm run app -- portal\` | Adds \`apps/portal\` and \`apps/portal/eslint.config.js\`. |
| \`npm run lib -- ui\` | Adds \`libs/ui\`, \`libs/ui/eslint.config.js\`, and the \`@${options.scope}/ui\` path. |

Generated projects are standalone, zoneless: ${options.zoneless ? "yes" : "no"}, routing: ${options.routing ? "on" : "off"}, styles: ${options.style}. Angular CLI ${VERSIONS.cli}.

\`ng generate component widget --project=${first}\` still works. New applications created with \`ng generate application\` land in \`apps/\` because \`newProjectRoot\` is \`apps\`. Prefer \`npm run app\` and \`npm run lib\` so the project is registered with the same prefixes, tests, and path mapping as the rest of the workspace.

## Publish the library later

\`\`\`bash
npm run build:${options.library}
cd dist/${options.library}
npm publish
\`\`\`
`;
}

function rootFiles(options) {
  return {
    "README.md": readme(options),
    "eslint.config.js": rootEslintConfig(),
    ".gitignore": `# Compiled output
/dist
/tmp
/out-tsc
/.angular/cache

# Dependencies
/node_modules

# Tests and coverage
/coverage

# Editors
.idea/
.vscode/*
!.vscode/settings.json
!.vscode/tasks.json
!.vscode/launch.json
!.vscode/extensions.json

# System
.DS_Store
Thumbs.db
`,
    ".editorconfig": `root = true

[*]
charset = utf-8
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
`,
    ".prettierrc": json({
      printWidth: 100,
      singleQuote: true,
      overrides: [{ files: "*.html", options: { parser: "angular" } }],
    }),
    ".postcssrc.json": postcssConfig(),
    "angular.json": json(angularJson(options)),
    "package.json": json(packageJson(options)),
    "tsconfig.json": json(tsconfig(options)),
    ".vscode/extensions.json": `{
  "recommendations": ["angular.ng-template", "dbaeumer.vscode-eslint"]
}
`,
    ".vscode/launch.json": `{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "ng serve",
      "type": "chrome",
      "request": "launch",
      "preLaunchTask": "npm: start",
      "url": "http://localhost:4200/"
    }
  ]
}
`,
    ".vscode/tasks.json": `{
  "version": "2.0.0",
  "tasks": [
    {
      "type": "npm",
      "script": "start",
      "isBackground": true,
      "problemMatcher": []
    }
  ]
}
`,
  };
}

export function workspaceCliSource() {
  return `#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { addApplication, addLibrary } from "./kiln-core.mjs";

const root = findRoot(process.cwd());
const kind = process.argv[2];
const name = process.argv[3];

if (kind !== "app" && kind !== "lib") {
  fail("Usage: node scripts/workspace.mjs <app|lib> <name>");
}
if (!name) fail(\`Usage: npm run \${kind} -- <name>\`);

const existing = {
  "angular.json": readFileSync(join(root, "angular.json"), "utf8"),
  "package.json": readFileSync(join(root, "package.json"), "utf8"),
  "tsconfig.json": readFileSync(join(root, "tsconfig.json"), "utf8"),
};

const planned = kind === "app" ? addApplication(existing, name) : addLibrary(existing, name);
for (const [filePath, contents] of Object.entries(planned.files)) {
  const absolute = join(root, filePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents);
  process.stdout.write(\`  \${filePath}\\n\`);
}
process.stdout.write(\`\\nAdded \${kind} \${name}.\\n\`);

function findRoot(start) {
  let current = resolve(start);
  for (;;) {
    if (existsSync(join(current, "angular.json")) && existsSync(join(current, "package.json"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) fail("Run this from a kiln workspace.");
    current = parent;
  }
}

function fail(message) {
  process.stderr.write(\`\${message}\\n\`);
  process.exit(1);
}
`;
}

/**
 * @param {Record<string, unknown>} input
 * @param {{ coreSource?: string }} [extras]
 */
export function scaffoldWorkspace(input, extras = {}) {
  const options = normalize(input);
  const files = {
    ...rootFiles(options),
    "scripts/workspace.mjs": workspaceCliSource(),
  };
  for (const app of options.apps) Object.assign(files, appFiles(app, { ...options, name: app }));
  for (const lib of options.libs) {
    Object.assign(files, libraryFiles(lib, options));
  }
  if (extras.coreSource) {
    const banner =
      "// Snapshot of kiln. Powers `npm run app` and `npm run lib`\n" +
      "// inside this workspace, with no extra install.\n";
    const source = extras.coreSource.startsWith("// Snapshot")
      ? extras.coreSource
      : banner + extras.coreSource;
    files["scripts/kiln-core.mjs"] = source.endsWith("\n") ? source : `${source}\n`;
  }
  return { files, options, command: commandLine(options) };
}

function loadWorkspace(existing) {
  for (const required of ["angular.json", "package.json", "tsconfig.json"]) {
    if (typeof existing?.[required] !== "string") {
      throw new ScaffoldError(`Missing ${required}. Run this inside a workspace.`);
    }
  }
  let pkg;
  let angular;
  let tsconfigJson;
  try {
    pkg = JSON.parse(existing["package.json"]);
    angular = JSON.parse(existing["angular.json"]);
    tsconfigJson = JSON.parse(existing["tsconfig.json"]);
  } catch {
    throw new ScaffoldError("angular.json, package.json, or tsconfig.json is not valid JSON.");
  }
  if (!pkg.kiln || pkg.kiln.layout !== "apps-libs") {
    throw new ScaffoldError(
      "This directory is not a kiln workspace (package.json is missing kiln.layout).",
    );
  }
  const kiln = pkg.kiln;
  if (!Array.isArray(kiln.apps) || !Array.isArray(kiln.libs)) {
    throw new ScaffoldError("package.json kiln.apps and kiln.libs must be arrays.");
  }
  return { pkg, angular, tsconfigJson, kiln };
}

function assertFresh(angular, name) {
  assertKebab(name, "Project name");
  if (angular.projects?.[name]) {
    throw new ScaffoldError(`Project "${name}" already exists.`);
  }
}

function rememberReference(tsconfigJson, filePath) {
  tsconfigJson.references ??= [];
  if (!tsconfigJson.references.some((item) => item.path === filePath)) {
    tsconfigJson.references.push({ path: filePath });
  }
}

function ensureScriptStep(script, step, where) {
  if (!script || script.includes(step)) return script || step;
  return where === "prepend" ? `${step} && ${script}` : `${script} && ${step}`;
}

/**
 * @param {Record<string, string>} existing
 * @param {string} name
 */
export function addApplication(existing, name) {
  const { pkg, angular, tsconfigJson, kiln } = loadWorkspace(existing);
  assertFresh(angular, name);
  if (kiln.libs.includes(name)) throw new ScaffoldError(`"${name}" is already a library.`);

  const options = {
    name: pkg.name,
    scope: kiln.scope,
    apps: [...kiln.apps, name],
    library: kiln.libs[0],
    libs: [...kiln.libs],
    style: kiln.style,
    routing: kiln.routing !== false,
    zoneless: kiln.zoneless !== false,
    appPrefix: kiln.appPrefix,
    libPrefix: kiln.libPrefix,
  };

  angular.projects[name] = applicationProject(name, options);
  kiln.apps.push(name);
  ensureMaterial(pkg);
  ensureTailwind(pkg);
  ensureEslint(pkg);
  pkg.scripts[`start:${name}`] = `ng serve ${name} --port ${4200 + kiln.apps.length - 1}`;
  pkg.scripts[`lint:${name}`] = `ng lint ${name}`;
  pkg.scripts.build = ensureScriptStep(pkg.scripts.build, `ng build ${name}`, "append");
  pkg.scripts.lint = ensureScriptStep(pkg.scripts.lint, `ng lint ${name}`, "append");
  rememberReference(tsconfigJson, `./apps/${name}/tsconfig.app.json`);
  rememberReference(tsconfigJson, `./apps/${name}/tsconfig.spec.json`);

  return {
    files: {
      ...appFiles(name, { ...options, name }),
      ".postcssrc.json": postcssConfig(),
      "angular.json": json(angular),
      "package.json": json(pkg),
      "tsconfig.json": json(tsconfigJson),
    },
  };
}

/**
 * @param {Record<string, string>} existing
 * @param {string} name
 */
export function addLibrary(existing, name) {
  const { pkg, angular, tsconfigJson, kiln } = loadWorkspace(existing);
  assertFresh(angular, name);
  if (kiln.apps.includes(name)) throw new ScaffoldError(`"${name}" is already an application.`);

  const options = {
    name: pkg.name,
    scope: kiln.scope,
    apps: [...kiln.apps],
    library: kiln.libs[0],
    libs: [...kiln.libs, name],
    style: kiln.style,
    routing: kiln.routing !== false,
    zoneless: kiln.zoneless !== false,
    appPrefix: kiln.appPrefix,
    libPrefix: kiln.libPrefix,
  };

  angular.projects[name] = libraryProject(name, options);
  kiln.libs.push(name);
  ensureMaterial(pkg);
  ensureTailwind(pkg);
  ensureEslint(pkg);
  pkg.scripts[`build:${name}`] = `ng build ${name}`;
  pkg.scripts[`watch:${name}`] = `ng build ${name} --watch --configuration development`;
  pkg.scripts[`lint:${name}`] = `ng lint ${name}`;
  pkg.scripts.lint = ensureScriptStep(pkg.scripts.lint, `ng lint ${name}`, "prepend");
  for (const appName of kiln.apps) {
    const project = angular.projects[appName];
    if (project?.projectType === "application") {
      project.architect.serve.configurations.development.prebundle = {
        exclude: librarySpecifiers(options),
      };
    }
  }

  const specifier = importPath(kiln.scope, name);
  tsconfigJson.compilerOptions ??= {};
  tsconfigJson.compilerOptions.paths ??= {};
  tsconfigJson.compilerOptions.paths[specifier] = [`./libs/${name}/src/public-api.ts`];
  rememberReference(tsconfigJson, `./libs/${name}/tsconfig.lib.json`);
  rememberReference(tsconfigJson, `./libs/${name}/tsconfig.spec.json`);

  return {
    files: {
      ...libraryFiles(name, options),
      ".postcssrc.json": postcssConfig(),
      "angular.json": json(angular),
      "package.json": json(pkg),
      "tsconfig.json": json(tsconfigJson),
    },
  };
}
