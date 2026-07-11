# Shopify Operating Guide

Use Shopify as the commerce layer for products, catalog, storefront, checkout, orders, and approved rewards-store integrations.

Shopify is not the general backend for Chief AI, Bip, Think Tank, or L99. Keep commerce boundaries explicit.

## Best Role

Use Shopify for:

- product and collection management;
- storefront themes and content;
- inventory and availability;
- checkout and order workflows;
- discount and promotion configuration;
- approved app-to-store commerce integrations.

## Required Start

Before proposing or changing store behavior:

1. identify the exact store and environment;
2. inspect current theme, products, apps, policies, and integration path;
3. distinguish draft, preview, and live storefront state;
4. identify payment, inventory, fulfillment, tax, privacy, and customer-data impact;
5. define rollback before changing production theme or checkout behavior.

## Mode Handling

### `/garyvee`

Clarify the product, customer, offer, trust proof, and distribution path. Improve conversion by making value and next steps clear, not by manufacturing pressure.

### `lindymode`

Prefer standard Shopify primitives, portable catalog data, documented theme changes, simple integrations, and minimal app dependency.

### `redteam`

Attack pricing mistakes, inventory drift, broken checkout, exposed admin controls, secret leakage, fraudulent discounts, customer-data exposure, inaccessible flows, policy mismatch, and app-permission risk.

### `l99`

Track product provenance, catalog continuity, reward liability, inventory state, fulfillment state, integration events, rollback, and long-term app/vendor dependence.

### `ooda`

- **Observe:** live configuration, customer path, catalog, apps, and failures.
- **Orient:** revenue, trust, risk, operations, and project boundaries.
- **Decide:** one scoped commerce change and success measure.
- **Act:** apply only after approval, verify preview/live behavior, and document rollback.

## Approval Gates

Require explicit founder approval before:

- changing live prices or discounts;
- publishing a theme;
- changing checkout, payment, tax, shipping, or fulfillment behavior;
- installing or removing apps with store or customer-data access;
- importing or deleting products, customers, or orders;
- changing domains;
- connecting Bip rewards to real money, inventory, or redemption liability;
- sending campaigns or customer messages.

## Security and Privacy

- Keep Shopify admin credentials, private app tokens, webhook secrets, supplier credentials, and payment secrets server-side.
- Never commit secrets to a public repository.
- Do not expose hidden admin interfaces in a static storefront.
- Verify webhook signatures and idempotency for server-side integrations.
- Minimize customer data copied into other systems.
- Document who owns product, order, fulfillment, and reward state.

## Bip Rewards Boundary

When Shopify supports Se’kret Bip rewards:

- Bip owns earned points, eligibility, safety rules, and user identity mapping;
- Shopify owns purchasable merchandise, stock, checkout, and order state;
- redemption must be auditable and idempotent;
- do not expose teen identity or private activity to the public storefront;
- define refunds, cancellations, out-of-stock behavior, fraud handling, and reward restoration before launch.

## Required Change Report

- store and environment;
- exact objects changed;
- preview or live status;
- price, inventory, customer, and order impact;
- apps or permissions affected;
- tests performed;
- rollback steps;
- unresolved operational risk.

A product page loading successfully is not proof that pricing, inventory, checkout, fulfillment, and accounting agree. Commerce enjoys saving its surprises for after money moves.
