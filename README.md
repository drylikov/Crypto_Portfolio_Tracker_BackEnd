# Crypto  Tracker — Backend

A production-ready **NestJS backend** for a crypto portfolio tracking application.

The system provides full portfolio analytics, transaction processing, asset management, real-time price integration, and **AI-powered portfolio insights** using OpenAI.

This project is designed as a **real-world fintech-style backend**, focusing on clean architecture, scalability, and practical business logic.

---

## ✨ Key Features

### 🔐 Authentication & Authorization
- JWT-based authentication
- Role-based access control (USER / ADMIN)
- Guards and decorators (`JwtAuthGuard`, `RolesGuard`)
- Secure password hashing

---

### 💼 Portfolio Engine
- Asset balances per user
- Average buy price (average cost)
- Cost basis calculation
- Allocation percentage per asset
- Portfolio summary endpoint
- Realized & unrealized PnL (USD and %)
- Portfolio refresh with live prices

---

### 💸 Transactions
- BUY / SELL / DEPOSIT / WITHDRAW
- Automatic price resolution for crypto assets
- Manual price support for fiat transactions
- Balance validation (no overselling)
- Immutable transaction history
- Accurate PnL calculation

---

### 🪙 Assets Management
- Asset CRUD (admin-only)
- Soft delete (`isActive`, `deletedAt`)
- CoinGecko integration via `coingeckoId`
- Bulk import of top crypto assets
- Asset normalization and validation

---

### 📈 Prices & Market Data
- CoinGecko API integration
- Caching to avoid rate limits
- Graceful fallback when prices are unavailable
- Separate handling of:
  - missing CoinGecko IDs
  - temporary API outages

---

### 🤖 AI Portfolio Insights (OpenAI)
- AI-generated portfolio analysis
- Uses real portfolio data (not mock data)
- Structured response:
  - Overview
  - Highlights
  - Risks
  - Fees
  - Data quality
  - Suggested next steps
- Designed for future expansion (chat, alerts, recommendations)

---

## 🧠 AI Use Case (Why it matters)

The AI module analyzes the user's portfolio and generates **human-readable insights**, such as:
- Portfolio health overview
- Risk concentration warnings
- Performance summary
- Diversification suggestions

This feature demonstrates **practical AI integration**, not just a generic chatbot.

---

## 🏗️ Architecture Overview

```text
src/
├── ai/ # AI insights (OpenAI)
├── auth/ # Authentication & authorization
├── assets/ # Crypto assets management
├── portfolio/ # Portfolio analytics & summary
├── prices/ # Market prices & caching
├── transactions/ # Transaction engine
├── users/ # User management
├── prisma.service.ts
├── app.module.ts
└── main.ts
```

### Key Design Principles
- Modular NestJS architecture
- Clear separation of concerns
- Services contain business logic
- Controllers stay thin
- Scalable and testable structure

---

## 🛠 Tech Stack

- **Node.js**
- **NestJS**
- **TypeScript**
- **Prisma ORM**
- **PostgreSQL**
- **JWT**
- **CoinGecko API**
- **OpenAI API**
- **Docker (for DB)**

---

## ⚙️ Setup & Installation

1️⃣ Install dependencies
```bash
npm install
```

2️⃣ Environment variables
```bash
Create .env based on .env.example:

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/portfolio_db?schema=public"

JWT_SECRET="change_me"

COINGECKO_DEMO_API_KEY="optional"

OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4o-mini"
```

3️⃣ Start PostgreSQL (Docker)
```bash
docker compose up -d
```

4️⃣ Prisma setup
```bash
npx prisma generate
npx prisma migrate dev
```

5️⃣ Run the server
```bash
npm run start:dev
```
Backend will be available at: `http://localhost:3000`

---

## 🔌 API Highlights
Portfolio
 - GET /portfolio
 - GET /portfolio/summary
 - GET /portfolio?refresh=1

Transactions
 - POST /transactions
 - GET /transactions

Assets (User)
 - GET /assets
 - GET /assets/prices
 - GET /assets/search

Assets (Admin)
 - POST /assets
 - POST /assets/import/top
 - PATCH /assets/:id
 - DELETE /assets/:id

User
  - GET /users/me
  - PUT /users
  - PUT /users/me/password
  - DELETE /users/me

AI
 - POST /ai/portfolio-insights

AUTH
  - /auth/register
  - /auth/login

---

## 🚀 Why this project stands out
- Real financial domain logic (not CRUD-only)
- Correct PnL calculations
- Proper handling of edge cases (prices unavailable, missing data)
- AI integration with real business value
- Clean, readable, scalable backend architecture

---

## 📸 Screenshots

### 🔐 Authentication (Login)
Secure authentication screen with JWT-based login:
- Email & password authentication
- Token-based session handling
- Protected routes after login

![Authentication Login](./screenshots/login.png)

---

### 📊 Portfolio Dashboard
Overview of the user’s crypto portfolio, including:
- Total value
- Realized & unrealized PnL
- Asset allocation
- Performance charts

![Portfolio Dashboard](./screenshots/dashboard.png)

---

### 📈 Asset Performance & Allocation
Visual representation of portfolio performance and diversification:
- Unrealized PnL per asset (USD / %)
- Portfolio allocation donut chart

![Performance Chart USD](./screenshots/performance-chart-usd.png)
![Performance Chart %](./screenshots/performance-chart-percent.png)
![Allocation Chart](./screenshots/allocation-chart.png)

---

### 💸 Transactions
Complete transaction history and management:
- BUY / SELL / DEPOSIT / WITHDRAW operations
- Decimal precision support
- Automatic price resolution for crypto assets
- Manual price input for fiat transactions
- Immutable transaction history

![Transactions](./screenshots/transactions.png)

---

### 🤖 AI Portfolio Insights
AI-generated portfolio analysis based on real user data:
- Portfolio overview
- Risk analysis
- Concentration warnings
- Suggested next steps

![AI Insights](./screenshots/ai-insights.png)

---





























