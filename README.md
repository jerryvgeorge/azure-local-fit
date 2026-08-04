# Signal — Azure Local Fit Assessment

An internal tool for evaluating whether a client is a good fit for Azure Local
(vs. staying on public Azure). Ask a set of weighted questions, get a live
"signal" score, save the result, and browse past assessments across your team.

## How the scoring works

Each question has a **weight** (how much it matters) and each answer has a
**lean** from -2 (favors public Azure) to +2 (favors Azure Local). The
weighted sum is normalized to a **-100 to +100 signal score**:

| Signal          | Verdict                                   |
|-----------------|--------------------------------------------|
| +50 to +100     | Strong fit for Azure Local                 |
| +20 to +49      | Good fit for Azure Local                   |
| -19 to +19      | Hybrid — needs a deeper look               |
| -49 to -20      | Public Azure is likely the better fit      |
| -100 to -50     | Not recommended — stick with public Azure  |

The question set (in `app/questions.js`) is based on Microsoft's actual
guidance on when Azure Local fits: connectivity reliability, data sovereignty,
latency sensitivity, number of distributed sites, state of existing
infrastructure (e.g. aging VMware), on-site IT capability, budget model
(CapEx vs. OpEx), and need for cloud elasticity. Edit that file directly to
add, remove, or reweight questions — no code changes needed elsewhere.

## Architecture

- **Frontend** (`/app`): plain HTML/CSS/JS, no build step. Deploys as an
  Azure Static Web App.
- **Backend** (`/api`): Azure Functions (Node.js, v4 programming model).
  Two routes: `POST /api/assessments` and `GET /api/assessments`.
- **Storage**: a single Azure Table (`assessments`) — cheap, no schema
  migrations, plenty for this workload.

Static Web Apps natively links to a Functions app and proxies `/api/*`
requests to it, so the frontend and backend can be deployed together with
one CLI command once set up.

## Deploy it

You'll need the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli)
logged in (`az login`) and the [Static Web Apps CLI](https://azure.github.io/static-web-apps-cli/)
(`npm install -g @azure/static-web-apps-cli`) for local testing (optional).

### 1. Create a resource group (skip if you already have one)

```bash
az group create --name rg-azure-local-fit --location westeurope
```

### 2. Create a Storage account for the assessments table

```bash
az storage account create \
  --name azurelocalfitstore \
  --resource-group rg-azure-local-fit \
  --location westeurope \
  --sku Standard_LRS

# Grab the connection string — you'll need it in step 4
az storage account show-connection-string \
  --name azurelocalfitstore \
  --resource-group rg-azure-local-fit \
  --query connectionString -o tsv
```

Storage account names must be globally unique, lowercase, no dashes —
adjust `azurelocalfitstore` if it's taken.

### 3. Create the Static Web App (this also provisions the linked Functions app)

```bash
az staticwebapp create \
  --name azure-local-fit \
  --resource-group rg-azure-local-fit \
  --location westeurope \
  --sku Free
```

The `Free` tier is enough for an internal tool with a handful of users.

### 4. Set the storage connection string as an app setting

```bash
az staticwebapp appsettings set \
  --name azure-local-fit \
  --setting-names AZURE_STORAGE_CONNECTION_STRING="<paste connection string from step 2>"
```

### 5. Deploy the app

The simplest path is connecting the Static Web App to a GitHub repo (Azure
sets up a GitHub Actions workflow automatically):

```bash
az staticwebapp create \
  --name azure-local-fit \
  --resource-group rg-azure-local-fit \
  --source https://github.com/<your-org>/<your-repo> \
  --location westeurope \
  --branch main \
  --app-location "/app" \
  --api-location "/api" \
  --login-with-github
```

If you'd rather deploy directly without GitHub, use the SWA CLI:

```bash
swa deploy ./app --api-location ./api --deployment-token <token from Azure portal>
```

(Find the deployment token under **Static Web App → Overview → Manage
deployment token** in the Azure Portal.)

### 6. Open it

```bash
az staticwebapp show --name azure-local-fit --resource-group rg-azure-local-fit --query "defaultHostname" -o tsv
```

Visit the hostname it prints — that's your team's assessment tool.

## Restricting access to your team

Right now the API routes are set to `anonymous` for simplicity. Since
multiple people on your team will use this, the cleanest next step is
**Azure AD (Entra ID) auth via Static Web Apps' built-in authentication** —
since you're already on Microsoft 365, this needs no extra identity
provider. In `staticwebapp.config.json`, change the `/api/*` route's
`allowedRoles` from `["anonymous"]` to `["authenticated"]`, and add a
`/.auth/login/aad` redirect on the frontend. Happy to wire that up next if
you want it.

## Local development

```bash
# Terminal 1 — API
cd api
npm install
cp local.settings.json.example local.settings.json
# edit local.settings.json with a real storage connection string
func start

# Terminal 2 — frontend + API proxy together
swa start ./app --api-location ./api
```

Then open the URL the SWA CLI prints (usually `http://localhost:4280`).

## File structure

```
azure-local-fit/
├── app/                       # Static Web App frontend
│   ├── index.html
│   ├── styles.css
│   ├── questions.js           # Edit this to change the question set/scoring
│   ├── app.js
│   └── staticwebapp.config.json
└── api/                       # Azure Functions backend
    ├── src/index.js           # POST + GET /api/assessments
    ├── package.json
    ├── host.json
    └── local.settings.json.example
```
