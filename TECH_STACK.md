# GWT Audit Buddy - Tech Stack

## Overview
This is a full-stack web application for performing automated audits with accessibility testing, compliance reporting, and agency management features.

---

## Frontend Stack

### Core Framework
- **React** (v18.3.1) - UI library
- **TypeScript** (v5.8.3) - Type-safe JavaScript
- **Vite** (v5.4.19) - Build tool & dev server
- **React Router DOM** (v6.30.1) - Client-side routing

### Styling & UI Components
- **Tailwind CSS** (v3.4.17) - Utility-first CSS framework
- **shadcn/ui** - High-quality, accessible component library built on Radix UI
- **Radix UI** - Unstyled, accessible component primitives
  - Dialog, Dropdown, Accordion, Select, Tabs, Toast, Navigation Menu, Popover, etc.
- **Framer Motion** (v12.38.0) - Animation library
- **Lucide React** (v0.462.0) - Icon library
- **Tailwind Merge** (v2.6.0) - Utility class merging
- **tailwindcss-animate** (v1.0.7) - Animation utilities

### State Management & Data Fetching
- **TanStack React Query** (v5.83.0) - Server state management
- **React Hook Form** (v7.61.1) - Form state management
- **@hookform/resolvers** (v3.10.0) - Form validation integration

### Data Validation
- **Zod** (v3.25.76) - TypeScript-first schema validation

### Utilities
- **date-fns** (v3.6.0) - Modern date utility library
- **clsx** (v2.1.1) - Conditional className utility
- **class-variance-authority** (v0.7.1) - CSS-in-JS variant management
- **input-otp** (v1.4.2) - OTP input component
- **react-dropzone** (v15.0.0) - File drag-and-drop
- **react-resizable-panels** (v2.1.9) - Resizable panel layout
- **react-day-picker** (v8.10.1) - Calendar component
- **embla-carousel-react** (v8.6.0) - Carousel component
- **cmdk** (v1.1.1) - Command menu component
- **vaul** (v0.9.9) - Drawer component
- **Sonner** (v1.7.4) - Toast notifications
- **next-themes** (v0.3.0) - Theme provider

### PDF & Export
- **jsPDF** (v2.5.2) - PDF generation
- **html2canvas** (v1.4.1) - HTML to canvas conversion
- **ExcelJS** (v4.4.0) - Excel file generation (used in backend)

### Browser Automation (Frontend support)
- **Playwright Extra** (v4.3.6) - Playwright with plugins
- **Puppeteer Extra Plugin Stealth** (v2.11.2) - Stealth mode for browser automation

### Charts & Visualization
- **Recharts** (v2.15.4) - React charting library

### Development & Build
- **@vitejs/plugin-react-swc** (v3.11.0) - SWC compiler for Vite
- **lovable-tagger** (v1.1.13) - Component tagging tool

### Testing
- **Vitest** (v3.2.4) - Unit test framework
- **@playwright/test** (v1.57.0) - E2E testing framework
- **@testing-library/react** (v16.0.0) - React testing utilities
- **@testing-library/jest-dom** (v6.6.0) - Jest DOM matchers
- **jsdom** (v20.0.3) - DOM implementation for testing

### Code Quality
- **ESLint** (v9.32.0) - JavaScript linter
- **@eslint/js** (v9.32.0) - ESLint recommended config
- **typescript-eslint** (v8.38.0) - TypeScript ESLint integration
- **eslint-plugin-react-hooks** (v5.2.0) - React hooks linting
- **eslint-plugin-react-refresh** (v0.4.20) - React refresh linting

### CSS Processing
- **PostCSS** (v8.5.6) - CSS transformation tool
- **Autoprefixer** (v10.4.21) - Vendor prefix automation
- **@tailwindcss/typography** (v0.5.16) - Typography styles

### Type Definitions
- **@types/react** (v18.3.23)
- **@types/react-dom** (v18.3.7)
- **@types/node** (v22.16.5)

---

## Backend Stack

### Core Framework
- **Express.js** (v5.2.1) - Web framework
- **Node.js** - JavaScript runtime

### Database
- **MongoDB** - NoSQL database
- **Mongoose** (v9.4.1) - MongoDB ODM with schema validation

### Browser Automation & Testing
- **Playwright** (v1.58.2) - Browser automation framework
- **@axe-core/playwright** (v4.11.1) - Accessibility testing with Playwright

### Security
- **Helmet** (v7.1.0) - HTTP headers security middleware
- **bcrypt** (v5.1.1) - Password hashing
- **express-rate-limit** (v7.1.5) - Rate limiting middleware
- **dotenv** (v17.4.1) - Environment variable management
- **cookie-parser** (v1.4.6) - Cookie parsing middleware

### CORS & HTTP
- **cors** (v2.8.6) - Cross-Origin Resource Sharing middleware

### Email & Notifications
- **nodemailer** (v6.9.7) - Email sending library

### PDF Generation
- **PDFKit** (v0.17.2) - PDF document creation
- **jsPDF** (v4.2.1) - PDF generation library

### Search & Filtering
- **Fuse.js** (v7.0.0) - Fuzzy search library

### File Generation
- **ExcelJS** (v4.4.0) - Excel file generation

### Process Management
- **PM2** (v5.4.3) - Process manager for Node.js

---

## Configuration & DevOps

### Package Manager
- **Bun** (lockfile: bun.lockb) - Optional fast JavaScript package manager

### Build Configuration
- **vite.config.ts** - Vite build configuration
- **vitest.config.ts** - Vitest test configuration
- **playwright.config.ts** - Playwright testing configuration
- **tsconfig.json** - TypeScript configuration
- **tailwind.config.ts** - Tailwind CSS configuration
- **postcss.config.js** - PostCSS configuration
- **eslint.config.js** - ESLint configuration
- **components.json** - shadcn/ui configuration

### Environment Management
- **.env** - Environment variables for database, email, secrets, etc.

### Process Management
- **ecosystem.config.cjs** - PM2 ecosystem configuration

---

## Architecture Overview

### Frontend Architecture
- Component-based UI with React and TypeScript
- Page-based routing with React Router
- Server state management with React Query
- Client state with React Hook Form
- Responsive design with Tailwind CSS and shadcn/ui

### Backend Architecture
- RESTful API with Express.js
- MongoDB with Mongoose for data persistence
- Automated browser testing with Playwright
- Accessibility testing with Axe Core
- Rate limiting and security middleware
- PM2 for process management and monitoring

### Key Features
- **Auditing**: Automated web accessibility and compliance audits
- **Reporting**: Generate PDF and Excel reports
- **Dashboard**: Analytics and audit results visualization
- **Authentication**: User login and session management
- **Agency Management**: Multi-tenant support for agencies
- **Accessibility Testing**: Axe Core integration for WCAG compliance
- **Rate Limiting**: Protection against suspicious requests
- **Email Notifications**: Nodemailer integration

---

## Data Flow

```
User Interface (React)
    ↓
React Query (State Management)
    ↓
Express API (REST Endpoints)
    ↓
Middleware (Auth, Rate Limit, Validation)
    ↓
Business Logic (Services)
    ↓
Mongoose Models (Database Schema)
    ↓
MongoDB (Data Persistence)
```

---

## Development Workflow

1. **Development Server**: `npm run dev` - Vite dev server on port 8080
2. **Backend**: `npm run dev` in backend folder - PM2 managed process
3. **Testing**: `npm run test` or `npm run test:watch` - Vitest
4. **E2E Testing**: Playwright tests in `playwright.config.ts`
5. **Build**: `npm run build` - Production bundle
6. **Linting**: `npm run lint` - ESLint validation

---

## Technology Selection Rationale

| Layer | Tool | Rationale |
|-------|------|-----------|
| Frontend Build | Vite | Fast build times, excellent HMR, modern tooling |
| UI Framework | React | Large ecosystem, component reusability |
| Styling | Tailwind CSS | Utility-first, responsive design, rapid prototyping |
| Components | shadcn/ui | Accessible, unstyled, customizable Radix primitives |
| State Management | React Query + Hook Form | Separate concerns: server vs client state |
| Backend | Express.js | Lightweight, mature, extensive middleware ecosystem |
| Database | MongoDB | Flexible schema, document-oriented, good for reporting |
| Testing | Vitest + Playwright | Fast unit tests, reliable E2E testing |
| Security | Helmet + bcrypt + rate-limit | Industry standard security practices |
| PDF Generation | jsPDF + html2canvas | Client & server-side PDF generation |

---

## Performance Considerations

- **Code Splitting**: Vite automatically optimizes bundle size
- **Connection Pooling**: MongoDB connection pool (10-50 connections)
- **Caching**: React Query client-side caching
- **Large File Support**: Express configured for 50MB JSON body limit
- **Timeout Management**: 10-minute request timeout for long-running audits
- **Process Management**: PM2 for process restart and monitoring

---

## Security Features

- CORS protection with cors middleware
- HTTP security headers with Helmet
- Password hashing with bcrypt
- Rate limiting to prevent abuse
- Input validation with Zod
- Environment variable management with dotenv
- Cookie parsing and validation
- HTTPS-ready configuration

