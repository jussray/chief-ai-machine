# Zapier SDK tooling

This package gives Chief AI a server-side Zapier SDK development boundary. It must not be imported into browser code or used to expose provider credentials in a client bundle.

## Local setup

Requirements: Node.js 20+ and a Zapier account with at least one connected app.

```bash
cd tools/zapier
npm install
npx skills add zapier/sdk -y
npm run login
npm run connections
npm run start
```

`npm run start` performs a read-only authentication check with `getProfile()`. It does not run an app action.

## Explore connected apps

```bash
npm run apps
npm run connections
npx zapier-sdk list-actions github
npx zapier-sdk list-actions hubspot
npx zapier-sdk list-actions gmail
```

Generate TypeScript types only for integrations selected for a reviewed workflow:

```bash
npx zapier-sdk add github hubspot gmail --types-output ./src/generated
```

## Production credentials

Browser login is for local development. For server-side execution, create approved client credentials locally:

```bash
npx zapier-sdk create-client-credentials "chief-ai-server-tooling"
```

Store the returned values in the server or deployment secret manager as:

- `ZAPIER_CREDENTIALS_CLIENT_ID`
- `ZAPIER_CREDENTIALS_CLIENT_SECRET`

The bootstrap also supports an approved `ZAPIER_CREDENTIALS` direct token, but client credentials are preferred for server-side use.

Never commit credentials, generated connection output, private prompts, user data, or app payloads. Live writes, publication, outreach, deployment, and credential lifecycle changes remain separate approval gates.

Official quickstart: https://docs.zapier.com/sdk/quickstart
