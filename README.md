# Gotham-Enterprise

Enterprise-grade dashboard and verification platform for media authenticity, built on **Next.js**, **Tailwind CSS**, **Clerk** authentication, and **MongoDB** database.

---

## Table of Contents
- [About](#about)  
- [Key Features](#key-features)  
- [Tech Stack](#tech-stack)  
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Database (MongoDB)](#database-mongodb)  
- [Authentication (Clerk)](#authentication-clerk)  
- [Getting Started](#getting-started)  
  - [Prerequisites](#prerequisites)  
  - [Installation](#installation)  
  - [Environment Variables](#environment-variables)  
  - [Running Locally](#running-locally)  
  - [Building & Deployment](#building--deployment)

---

## About

**Gotham-Enterprise** is the enterprise front-end dashboard for the Gotham media-verification ecosystem, designed for scalable teams, high-volume media analysis, and real-time authenticity checks.

It provides:

- A modern **Next.js App Router** architecture  
- **MongoDB** database for persistent data storage  
- Image & URL-based verification flows  
- Mobile-first, vertically stacked sections for clean UX  
- Detailed media history and analytics  
- Real-time verification results  
- Role-based access via **Clerk authentication**  
- User credit system for scan management
- A sleek, minimal **dark UI** using Tailwind

---

## Key Features

- Upload **multiple images** or submit **remote URLs** for verification  
- **Persistent scan history** stored in MongoDB
- **Real-time dashboard** showing credit balance and recent scans
- **Credit system** - Each scan costs 1 credit
- Camera capture **disabled** by default for workflow consistency  
- Vertical mobile layout: **Upload → Results → Quick Stats**  
- Enterprise-grade **Verification History**, including:
  - Image thumbnails  
  - Metadata  
  - Verdict indicators  
  - Confidence progress bars  
  - Filtering + search  
  - Delete functionality
- Semi-transparent, outlined cards & tables for a premium feel  
- Full authentication integration with Clerk  
- **MongoDB integration** for user and scan persistence
- Ready for team dashboards and permission-based environments  

---

## Tech Stack

| Category | Technologies |
|---------|--------------|
| Framework | **Next.js (App Router)** |
| Language | **TypeScript** |
| Styling | **Tailwind CSS** |
| UI Library | **shadcn/ui**, **lucide-react** |
| Auth | **Clerk** |
| Database | **MongoDB** with **Mongoose ODM** |
| Deployment | **Vercel** (recommended) or any Next.js-compatible host |

---

## Quick Start

**Get running in 3 steps:**

1. **Create `.env.local`:**
```env
MONGODB_URI=
gotham-enterprise
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_key
CLERK_SECRET_KEY=your_secret
```

2. **Install and run:**
```bash
npm install
npm run dev
```

3. **Visit http://localhost:3000**

See `SETUP_INSTRUCTIONS.md` or `QUICKSTART.md` for detailed setup.

---

## API Reference

- FakeCatcher backend URL: `https://facedetectionsystem.onrender.com`
- Full endpoint docs: `api.md`

---

## Database (MongoDB)

This project uses **MongoDB** for data persistence:

### Collections:
- **users** - Clerk-synced user data with credit tracking
- **verificationresults** - Scan results and verification history

### Features:
- ✅ Automatic user sync from Clerk
- ✅ Credit system (5 initial credits per user)
- ✅ Plan management (trial, starter, growth, enterprise)
- ✅ Full scan history with timestamps
- ✅ Indexed queries for performance

### Setup:
1. Create MongoDB project (free at https://mongodb.com/cloud/atlas)
2. Get connection string
3. Add to `.env.local` as `MONGODB_URI`

See `MONGODB_SETUP.md` for complete database guide.

---

## Authentication (Clerk)

Gotham-Enterprise uses **Clerk** for:  
- Sign-in / Sign-up  
- Session management  
- User profile access  
- Route protection  


### Clerk Integration Overview

- `ClerkProvider` is wrapped around the entire application in `layout.tsx`.
- Middleware is configured to protect authenticated routes such as:
  - `/dashboard`
  - `/history`
  - `/verify`
- Components use:
  - `useUser()` to access user data.
  - `useAuth()` to access tokens/session.
  - Clerk UI components like `<SignIn />`, `<SignUp />`, `<UserButton />`.

### Required Clerk Environment Variables

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_key
CLERK_SECRET_KEY=your_key


---

## Getting Started

### Prerequisites
- Node.js 16+  
- npm, yarn, or pnpm  
- Clerk account (for authentication keys)

---

## Installation

```bash
git clone https://github.com/deeptrackgotham/Gotham-Enterprise.git
cd Gotham-Enterprise
npm install 
```
---

### Environment Variables

Create a `.env.local` file in the root directory and include:

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_key
CLERK_SECRET_KEY=your_key


Ensure these match the values generated in your Clerk dashboard and backend API configuration.

---

### Running Locally

Start the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev

```
