# Packaging (2GP) — DocEngine

## Namespace (required for managed package)

1. In a **Developer Edition** or Partner Dev Hub org, create a namespace (e.g. `docengine`).
2. Link the namespace to your Dev Hub.
3. Set it in `sfdx-project.json`:

```json
"namespace": "docengine"
```

Until a namespace is registered, keep `"namespace": ""` and use **unmanaged** deploys (`sf project deploy start`) for internal orgs.

## Create the 2GP package (once)

```bash
# Authenticate Dev Hub
sf org login web --set-default-dev-hub --alias DevHub

# Create managed package (after namespace is set)
sf package create \
  --name DocEngine \
  --package-type Managed \
  --path apps/salesforce/force-app \
  --description "DocEngine document templates and fill"
```

This writes a `packageAliases` entry into `sfdx-project.json`.

## Build & promote a version

```bash
npm run build:sf

sf package version create \
  --package DocEngine \
  --installation-key-bypass \
  --wait 30 \
  --code-coverage

sf package version promote --package "DocEngine@0.1.0-1" --no-prompt
```

Install in a subscriber / scratch org:

```bash
sf package install --package "DocEngine@0.1.0-1" --wait 20 --publish-wait 20
sf org assign permset --name DocEngine_Admin
```

## Post-install / PDF connector

PDF callouts live in the optional **DocEngine_PDF** package (`apps/salesforce/force-app-pdf/`), not in core `apps/salesforce/force-app`.

```bash
sf project deploy start --source-dir apps/salesforce/force-app-pdf
sf org assign permset --name DocEngine_PDF_User
```

Configure Named Credential `DocEngine_Pdf` to your pdf-service HTTPS URL.

See [PDF_PACKAGE.md](./PDF_PACKAGE.md) and [PDF.md](./PDF.md).

## What is packaged vs not

| In `apps/salesforce/force-app` (DocEngine) | In `apps/salesforce/force-app-pdf` (DocEngine_PDF) |
|---|---|
| Objects, Apex, LWCs, Static Resources | `DocEnginePdfCallout` (Callable) |
| `DocEnginePdfController` facade + `isAvailable` | Named Credential `DocEngine_Pdf` |
| Permission sets, tabs, DocEngine app | Remote Site Setting |
| Post-install Apex class | `DocEngine_PDF_User` perm set |

## Scratch org for development

```bash
sf org create scratch --definition-file config/project-scratch-def.json --alias DocEngineScratch --duration-days 7 --set-default
sf project deploy start --source-dir apps/salesforce/force-app
sf project deploy start --source-dir unpackaged/post-install
sf org assign permset --name DocEngine_Admin
```
