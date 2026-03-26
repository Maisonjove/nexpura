# Nexpura

A modern jewellery retail management platform built with Next.js 16, featuring inventory management, repairs, bespoke orders, customer management, and more.

## Tech Stack

- **Framework:** Next.js 16.2.1 with App Router
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth with 2FA support
- **Styling:** Tailwind CSS
- **State Management:** React Server Components + Client hooks
- **Payments:** Stripe integration
- **AI Features:** OpenAI/Anthropic for invoice parsing, AI chat, and more
- **PDF Generation:** @react-pdf/renderer
- **Monitoring:** Sentry

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase project (or local instance)

### Environment Setup

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in the required environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
   - `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for admin operations)
   - `STRIPE_SECRET_KEY` - Stripe API key
   - `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` - For AI features

### Installation

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Available Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm test         # Run unit tests
pnpm test:watch   # Run tests in watch mode
pnpm test:e2e     # Run Playwright E2E tests
pnpm analyze      # Analyze bundle size
```

## Project Structure

```
src/
├── app/                  # Next.js App Router pages
│   ├── (admin)/          # Admin routes (platform-wide)
│   ├── (app)/            # Main app routes (tenant-scoped)
│   ├── (public)/         # Public routes (landing, auth)
│   └── api/              # API routes
├── components/           # Shared React components
├── lib/                  # Utility functions and services
│   ├── ai/               # AI integrations
│   ├── pdf/              # PDF templates
│   ├── supabase/         # Supabase client setup
│   └── ...
└── ...
```

## Features

- **Multi-tenant architecture** - Supports multiple jewellery stores
- **Inventory management** - Track finished pieces, stones, and materials
- **Repairs & Bespoke** - Full workflow for repairs and custom orders
- **Customer management** - Customer profiles, preferences, and history
- **Invoicing & payments** - Invoices, quotes, and payment tracking
- **AI-powered features** - Invoice scanning, chat assistant, website builder
- **Reports & analytics** - Sales, inventory, and financial reports
- **Team management** - Role-based access control

## Deployment

The application is deployed on Vercel with automatic deployments from the main branch.

### Production Checklist

- [ ] All environment variables set in Vercel
- [ ] Supabase production project configured
- [ ] Stripe webhooks configured
- [ ] Sentry DSN configured
- [ ] Custom domain configured

## License

Proprietary - All rights reserved.
