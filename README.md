# LibraryHub — Online Library Management System

A full-stack, automated library management platform built with React, Vite, and Supabase PostgreSQL. Designed for colleges and public libraries to manage book inventories, student/faculty borrowings, returns, overdue records, and fine tracking with real-time accuracy and Row-Level Security (RLS).

---

## 🌟 Key Features

### 👤 Member Portal
- **Browse & Search Catalog**: Filter books by category (Fiction, Computer Science, Science, Philosophy, etc.) and search by title, author, or ISBN.
- **Self-Service Borrowing**: Borrow available books instantly with automated stock deduction.
- **My Books Dashboard**: Track currently borrowed books, due dates, countdowns, and active fines.
- **Easy Returns**: Return books anytime with instant copy replenishment and fine reconciliation.
- **Borrowing History**: View past completed returns with checkout and return timestamps.

### 🛡️ Admin Management Dashboard
- **Circulation & Borrowings**: Centralized record of all active and returned loans across all library members.
- **Overdue Records & Fine Tracking**: Real-time identification of overdue loans, overdue duration, and automated fine calculation (₹5/day), with direct return processing.
- **Inventory & Book Management**: Add new books, edit existing catalog metadata, restock copies, or remove outdated volumes.
- **Member Directory**: View all registered library patrons, active loans count, and toggle/promote member roles.
- **Analytics & Stats**: Live metrics for total books, active borrowings, overdue counts, collected fines, and popular titles.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, React Router v7, Vite 8
- **Backend / Database**: Supabase (PostgreSQL 17)
- **Authentication**: Supabase Auth (Email & Password)
- **Security**: PostgreSQL Row-Level Security (RLS) policies and `SECURITY DEFINER` stored procedures
- **Styling**: Vanilla Modern CSS (Responsive, accessible, dark/light balanced theme)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/hanisharadhyag/Online-library-Management.git
   cd Online-library-Management
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Add your Supabase project credentials in `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Database Setup**:
   Execute the SQL statements from [`supabase-schema.sql`](./supabase-schema.sql) in your Supabase project's SQL Editor to set up:
   - `books`, `borrowings`, and `profiles` tables
   - Foreign key constraints & indexes
   - Stored procedures (`borrow_book`, `return_book`, `refresh_overdue_borrowings`, `is_admin`, `promote_user_to_admin`)
   - Row-Level Security (RLS) policies

5. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 👥 Demo Credentials

For quick evaluation and hackathon presentations:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@demo.com` | `password123` |
| **Member (Overdue Demo)** | `overdue@demo.com` | `password123` |

---

## 📂 Project Structure

```
├── public/                 # Static assets
├── src/
│   ├── assets/             # Images and design assets
│   ├── components/         # Reusable UI components (Navbar, Footer, Modal, etc.)
│   ├── context/            # Authentication context and hooks
│   ├── lib/                # Supabase client configuration
│   ├── pages/              # Application views
│   │   ├── admin/          # Admin portal pages (Dashboard, Inventory, Overdue, etc.)
│   │   ├── Books.jsx       # Public & member book catalog
│   │   ├── Dashboard.jsx   # Member overview dashboard
│   │   ├── Login.jsx       # Authentication login page
│   │   ├── MyBooks.jsx     # Active borrowings & return flow
│   │   └── Register.jsx    # User registration
│   ├── App.jsx             # Router definition and route guards
│   ├── index.css           # Global design system & theme
│   └── main.jsx            # Application entry point
├── supabase-schema.sql     # Database schema, functions & RLS policies
├── package.json
└── vite.config.js
```

---

## 📄 License
This project is open source and available under the [MIT License](LICENSE).
