# Kiln

Scaffold an Angular workspace that holds **multiple applications** and a **shared library**. Applications live in `apps/`, shared code lives in `libs/`, and the toolchain is the Angular CLI.

```
acme/
├── angular.json
├── eslint.config.js              recommended Angular rules
├── tsconfig.json                 "@acme/shared" → libs/shared
├── apps/
│   ├── web/eslint.config.js      prefix: app
│   └── admin/eslint.config.js    prefix: app
└── libs/
    └── shared/eslint.config.js   prefix: lib
```

Applications import the library by its package name:

```ts
import { Banner, WorkspaceLabel } from "@acme/shared";
```

`public-api.ts` is the only door into the library. Path mapping points at that TypeScript entry, not at `dist/`. Each app includes `libs/**/*.ts` and excludes those packages from Vite prebundling, so `ng serve` compiles library TypeScript, templates, and component styles with the running app. A library edit rebuilds the app. `npm run build:shared` is only for packaging the library when you want to publish it.

Each application gets its own Tailwind CSS 4.3 configuration at `apps/<name>/src/tailwind.css`. `source(none)` plus `@source` keep another app's utilities out of the build. One `.postcssrc.json` at the workspace root loads `@tailwindcss/postcss`.

Each application also gets Angular Material 22.2.4. `apps/<name>/src/material-theme.scss` is that app's Material 3 theme. The root component imports `MatButton`.

Each application gets `apps/<name>/eslint.config.js`, and each library gets `libs/<name>/eslint.config.js`. `ng lint <name>` loads that file, not the workspace root. It extends the root config, which carries the recommended Angular ESLint 22.6 rules (TypeScript recommended and stylistic, `tsRecommended`, template recommended, and template accessibility). The project file is where the selector prefix is set, and where you add rules that should apply only to that project:

```js
// apps/web — the application prefix
'@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }]

// libs/shared — the library prefix
'@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'lib', style: 'kebab-case' }]
```

Change `prefix` in one project's file without touching the others. `npm run app -- portal` writes `apps/portal/eslint.config.js`. `npm run lib -- ui` writes `libs/ui/eslint.config.js` with the library prefix.

## Create a workspace

```bash
kiln acme --apps web,admin --lib shared
cd acme
npm install
npm start
```

`npm start` serves the first app at http://localhost:4200 and compiles library TypeScript and styles with that app. A second app is `npm run start:admin` (port 4201).

`npm run serve` lists the applications and serves the one you choose (or serves the only app immediately). `npm run build -- web:production` builds an app with a configuration read from `angular.json`. With no argument, `npm run build` prompts for the app and configuration. `npm run build:all` builds every application. `npm run lint` prompts for a project to lint (or `npm run lint -- web` lints one directly). `npm run lint:all` lints every library and application.

## Add another app or library

From inside the workspace. These scripts ship with the repo, so they work after `kiln` itself is gone:

```bash
npm run app -- portal
npm run lib -- ui
```

`portal` lands in `apps/portal` and is registered in `angular.json`. `ui` lands in `libs/ui`, is published inside the workspace as `@acme/ui`, and is added to `tsconfig.json` paths. New libraries are not wired into application templates. Export them from their `public-api.ts` and import that package name.

`ng generate component widget --project=web` keeps working. This package does not replace the Angular CLI. It only creates the multi-project layout the CLI supports but does not scaffold in one step.

## Options

```text
kiln <name> [options]
kiln app <name>
kiln lib <name>

--apps web,admin       Application names. Default: web
--lib shared           Shared library. Default: shared
--scope acme           Import scope. Default: workspace name
--style css|scss       Default: css
--app-prefix app       Component prefix for apps. Default: app
--lib-prefix lib       Component prefix for libraries. Default: lib
--no-routing           Skip the router
--no-zoneless          Keep zone.js (zoneless is the Angular 22 default)
--directory <path>     Output folder. Default: ./<name>
--skip-git             Do not git init
--dry-run              Print files, write nothing
```

Generated projects target Angular 22: standalone components, Vitest, zoneless change detection unless `--no-zoneless` is set, Tailwind CSS 4.3, Angular Material 22.2.4, and angular-eslint 22.6.
