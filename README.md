# SX Launchpad Ecosystem

Welcome to the SX Launchpad Ecosystem. This repository contains the complete architecture for a decentralized Launchpad and Trading Platform, divided into three core layers: Smart Contracts, Frontend Web3 Application, and Backend API Gateway & Indexer.

---

## 🏗 System Architecture

The project is structured into three main directories:

1. **`smartContract/`**: Solidity contracts (Core, Portal, Marketplace, Social, Governance) powered by Hardhat. Includes formal verification specifications (Certora).
2. **`frontend/`**: Next.js App Router application with Tailwind CSS, Framer Motion, and Wagmi/Web3Modal for seamless Web3 interaction.
3. **`backend/`**: Express + TypeScript server using Prisma ORM (PostgreSQL). Includes the API Gateway, AI Security middlewares, and a standalone Event Indexer.

---

## 🚀 1. Smart Contracts Setup

The smart contract layer contains the logic for the SX Unified Account (SXUA), Launchpad vesting, Secondary Marketplace, Referrals, and 3-of-3 Multisig Governance with Device Proof-of-Possession (DPoP).

### Prerequisites
- Node.js (v18+)
- Hardhat

### Installation & Compilation
```bash
cd smartContract
npm install
npx hardhat compile
npx hardhat run scripts/deploy.ts --network hoodi

```

### Formal Verification
Security specifications are written in CVL (Certora Verification Language) and stored in `smartContract/certora/spec/`. 
Mock verification logs can be found at `smartContract/certora/verification.log`.

---

## 🌐 2. Frontend Application Setup

The frontend provides a premium, responsive glassmorphism UI for users to deposit stables, purchase launchpad allocations, trade on the secondary market, and manage their referrals. It also contains dedicated Admin dashboards for Governance, Verification, and Jailbreak monitoring.

### Prerequisites
- Node.js (v18+)

### Installation
```bash
cd frontend
npm install
```

### Running Locally
```bash
npm run dev
```
The application will be available at `http://localhost:3000`. 
**Note:** Ensure you have a Web3 Wallet (like MetaMask) installed in your browser to interact with the application.

---

## ⚙️ 3. Backend System Setup

The backend serves as the API Gateway for off-chain data, manages the PostgreSQL database, enforces AI Security (rate limiting, prompt injection filtering, lockouts), and runs an autonomous Event Indexer to track on-chain activity.

### Prerequisites
- Node.js (v18+)
- PostgreSQL Database

### Installation
```bash
cd backend
npm install
```
### test
npx dotenv-cli -e ../.env -- ts-node scratch_test_security.ts

## jail break
npm run demo:security

npx dotenv-cli -e ../.env -- ts-node demo_security.ts

### Database Configuration
1. Create a `.env` file in the `backend/` directory.
2. Add your PostgreSQL connection string:
   ```env
   DATABASE_URL="postgresql://USERNAME:PASSWORD@localhost:5432/sxlaunchpad?schema=public"
   ```
3. Push the Prisma schema to your database to create the necessary tables:
   ```bash
   npx prisma db push
   ```

### Running the Services
The backend is designed as a monolithic repository that can run separate services.

**Start the API Gateway:**
Handles REST API requests and AI Security filtering.
```bash
npx ts-node src/index.ts
```

**Start the Event Indexer:**
Runs the autonomous blockchain polling service to index events, handle reorgs, and update the database.
```bash
npx ts-node src/run-indexer.ts
```
###
// Using ethers
ethers.keccak256(ethers.toUtf8Bytes("sanjeev_laptop"))
alex_laptop =0x8ad250e13217f2c3ef834760077cc55b38b02806650bc04c335ed807f9631fb5
ram_laptop = 0x19d68ee0f1a9131f8be99faded9e36e79766c247c60d084f520ea8a79b2c5054
---

## 🛡 AI Security Mechanisms

The backend includes a dedicated AI Security module (`backend/src/security/middlewares.ts`):
- **Input Filtering:** Scans incoming payloads for known jailbreak prompts (e.g., "Ignore previous instructions", "DAN").
- **Lockout System:** Tracks violations by IP/Wallet. Triggers a 10-minute automated lockout after 5 violations.
- **Rate Limiting:** Enforces strict 100 requests/minute and 1000 requests/day limits globally.
- **DPoP Validation:** Secures Admin/Governance routes by requiring device-bound hardware hashes.

---
   
## 📝 Workflow Summary

1. **Deploy Contracts:** Compile and deploy the contracts from `smartContract/` to your target network.
2. **Configure Environment:** Update the `frontend` and `backend` configuration files with the newly deployed contract addresses and your RPC endpoints.
3. **Initialize Database:** Run `npx prisma db push` in the backend.
4. **Boot Services:** Start the Backend API, the Backend Indexer, and the Frontend development server.
5. **Access Application:** Open `http://localhost:3000` to interact with the SX Launchpad ecosystem.
