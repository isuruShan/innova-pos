# FastFood POS System

A full-stack Point-of-Sale system for fast food restaurants with role-based views for Cashiers, Kitchen Staff, and Managers.

## Tech Stack

- **Frontend:** React 18 + Vite + TailwindCSS + Recharts
- **Backend:** Node.js + Express + Mongoose
- **Database:** MongoDB

## Prerequisites

- Node.js 18+
- MongoDB running locally on port 27017 (or update `MONGO_URI` in `server/.env`)

## Setup & Run

### 1. Seed the database (first time only)

```bash
cd server
npm run seed
```

This creates default users and sample menu/inventory items.

### 2. Start the backend

```bash
cd server
npm run dev
```

Server starts on http://localhost:5000

### 3. Start the frontend

```bash
cd client
npm run dev
```

App opens on http://localhost:5173

---

## Default Login Credentials

| Role    | Email               | Password     |
|---------|---------------------|--------------|
| Manager | manager@pos.com     | manager123   |
| Cashier | cashier@pos.com     | cashier123   |
| Kitchen | kitchen@pos.com     | kitchen123   |

---

## Features by Role

### Cashier
- Browse menu items by category (Burgers, Sides, Drinks, Combos, Desserts)
- Add items to cart with quantity controls
- Enter table number per order
- Place orders (sent to kitchen automatically)
- View Day-End Report with CSV export

### Kitchen Staff
- Full-screen kitchen display showing active orders
- Orders grouped by status: Pending → Preparing → Ready → Completed
- FIFO order (oldest orders first)
- Elapsed time indicator (turns red after 15 minutes)
- Auto-refreshes every 10 seconds

### Manager
- Sales Dashboard with 7-day revenue bar chart and category pie chart
- KPI cards: Today's Revenue, Orders, Best Seller, Avg Order Value
- Menu Management: add/edit/delete items, toggle availability
- Inventory Management: track stock levels with inline qty editing, low-stock alerts

## Project Structure

```
POS/
├── client/          # React + Vite frontend
│   └── src/
│       ├── pages/
│       │   ├── cashier/     # NewOrder, DayEndReport
│       │   ├── kitchen/     # KitchenDisplay
│       │   └── manager/     # Dashboard, MenuManagement, InventoryManagement
│       ├── components/      # Navbar, SlideOver, StatCard, Badge
│       ├── context/         # AuthContext
│       └── api/             # Axios instance
└── server/          # Node + Express backend
    └── src/
        ├── models/          # User, MenuItem, Order, Inventory
        ├── routes/          # auth, menu, orders, inventory, reports
        └── middleware/      # JWT auth + role guard
```
# innova-pos
