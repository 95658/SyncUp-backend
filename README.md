# ⚡ SyncUp — Enterprise Multi-Tenant Workspace API (Backend)

![NestJS](https://img.shields.io/badge/NestJS-10.0-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.1-blue?style=for-the-badge&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5.0-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-4.6-black?style=for-the-badge&logo=socket.io&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-Bull_Queue-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Swagger](https://img.shields.io/badge/Swagger-API_Docs-85EA2D?style=for-the-badge&logo=swagger&logoColor=black)

**SyncUp Backend** is a scalable, modular microservice architecture engineered with **NestJS** and **TypeScript**. It powers the core domain logic of the SyncUp workspace platform, providing multi-tenant isolation, real-time event streaming, sprint lifecycles, and enterprise role-based access control.

---

## 🏛️ Core Architecture & Features

- 🏢 **Multi-Tenancy Engine:** Complete tenant separation with organization-scoped data isolation and dynamic context interception.
- 🔐 **Security & RBAC:** Passport JWT authentication, Bcrypt password hashing, refresh tokens, and granular role guards (`Super Admin`, `Org Admin`, `Project Manager`, `Member`).
- ⚡ **Real-Time WebSockets:** Low-latency bi-directional messaging and live event broadcasting powered by Socket.io gateways.
- 📋 **Agile Sprint & Project Services:** Sprint state machines (Planning, Active, Completed), drag-and-drop task ordering, story points estimation, and audit trails.
- 📨 **Asynchronous Job Queues:** Background workers and email dispatches handled by **Bull Queue** backed by **Redis**.
- 🗄️ **ORM & Database Modeling:** Type-safe database queries and migrations powered by **Prisma**.
- ☁️ **Media & File Storage:** S3-compatible cloud storage with pre-signed upload URLs.
- 📖 **Interactive API Documentation:** Full OpenAPI (Swagger) documentation generated at `/api/docs`.

---

## 🛠️ Tech Stack

| Domain | Technology |
| :--- | :--- |
| **Framework** | NestJS 10 (Node.js) |
| **Language** | TypeScript 5.1 |
| **Database ORM** | Prisma 5.0 |
| **Real-Time Engine** | Socket.io / WebSockets |
| **Queue & Cache** | Bull Queue + Redis (ioredis) |
| **Auth & Security** | Passport JWT, Throttler Rate Limiter, Class Validator |
| **Storage** | AWS S3 SDK Presigner |
| **Mailing** | Nodemailer + Handlebars |
| **Documentation** | Swagger / OpenAPI |

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+ recommended)
- PostgreSQL (or your configured database engine)
- Redis Server (for background job queues)

### 2. Installation
```bash
git clone https://github.com/95658/SyncUp-backend.git
cd SyncUp-backend
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your database URL, JWT secrets, and Redis connection settings.

### 4. Database Setup & Migrations
```bash
# Generate Prisma Client
npm run prisma:generate

# Run Database Migrations
npm run prisma:migrate

# (Optional) Seed Initial Data
npm run prisma:seed
```

### 5. Running the Application
```bash
# Development Mode (with hot-reload)
npm run start:dev

# Production Mode
npm run build
npm run start:prod
```

API will be running at [http://localhost:4000](http://localhost:4000).  
Swagger API Docs: [http://localhost:4000/api/docs](http://localhost:4000/api/docs).

---

## 🧪 Testing

```bash
# Unit tests
npm run test

# End-to-end tests
npm run test:e2e

# Test coverage
npm run test:cov
```

---

## 📬 Postman Collection
A pre-configured Postman Collection (`SyncUp_API.postman_collection.json`) and Environment file (`SyncUp_Local.postman_environment.json`) are included in the repository root for seamless API testing and endpoint exploration.
