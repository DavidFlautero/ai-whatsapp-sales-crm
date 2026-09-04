# AI Conversational Commerce Platform

Production-oriented WhatsApp sales automation platform that connects conversational AI with real business data: customers, catalog, inventory and orders.

## Overview

The system is designed for businesses that need more than a generic chatbot. Incoming WhatsApp conversations are processed through application logic that can consult operational data, assist with product discovery, preserve conversation context and support order workflows.

The language model is **not** treated as the source of truth for stock, pricing or customer data. Those decisions are delegated to application and persistence layers.

## Core capabilities

- WhatsApp-based conversational sales workflows
- Integration with real product catalog and inventory data
- Customer and conversation management
- Product discovery and variant-aware sales flows
- Order/cart-oriented business logic
- LLM API integration for natural-language interaction
- Webhook-driven event processing
- Administrative and CRM-oriented workflows
- TypeScript monorepo architecture
- Supabase-backed data infrastructure

## High-level architecture

```text
Customer on WhatsApp
        ↓
WhatsApp Business / Webhook
        ↓
API & Conversation Layer
        ↓
AI Interpretation
        ↓
Business Logic
   ├── Customers / CRM
   ├── Catalog
   ├── Inventory
   └── Orders
        ↓
Response to WhatsApp
```

## Engineering principles

- Business data remains authoritative
- AI is used for interpretation and conversational assistance, not uncontrolled decision making
- Operational logic is separated from prompts/model behavior
- Webhooks and API boundaries isolate external services
- The system is structured to support observability, validation and future multi-tenant evolution

## Technology

- TypeScript
- Node.js
- Supabase
- WhatsApp Business integrations
- LLM APIs
- pnpm workspace tooling

## Development

```bash
pnpm install
pnpm dev:api
```

Run type validation with:

```bash
pnpm typecheck
```

A diagnostic script is also available:

```bash
pnpm doctor
```

## Status

Active applied-AI / conversational-commerce engineering project.

## Author

David Fernando Flautero Peña — Full-Stack Software Developer & Applied AI Engineering
