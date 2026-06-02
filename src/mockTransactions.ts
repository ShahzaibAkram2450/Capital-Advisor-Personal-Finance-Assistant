import { Transaction } from "./types";

export const mockTransactions: Omit<Transaction, "userId">[] = [
  // --- JUNE 2026 (Current Month) ---
  {
    id: "tx-jun-01",
    date: "2026-06-01",
    amount: 1450.00,
    merchant: "Apartment Management Group",
    category: "Rent & Housing",
    source: "Mock Bank Sync",
    createdAt: "2026-06-01T08:00:00Z"
  },
  {
    id: "tx-jun-02",
    date: "2026-06-02",
    amount: -2850.00,
    merchant: "Initech Systems Corp",
    category: "Income",
    source: "Mock Bank Sync",
    createdAt: "2026-06-02T09:00:00Z"
  },
  {
    id: "tx-jun-03",
    date: "2026-06-02",
    amount: 14.99,
    merchant: "Spotify Premium",
    category: "Subscriptions & Bills",
    source: "Mock Bank Sync",
    createdAt: "2026-06-02T10:15:00Z"
  },
  {
    id: "tx-jun-04",
    date: "2026-06-02",
    amount: 432.50,
    merchant: "MOMENTUM*RETAIL GROUP NY", // Unfamiliar charge
    category: "Miscellaneous",
    source: "Mock Bank Sync",
    createdAt: "2026-06-02T14:30:00Z"
  },
  {
    id: "tx-jun-05",
    date: "2026-06-02",
    amount: 72.18,
    merchant: "Trader Joe's",
    category: "Groceries",
    source: "Mock Bank Sync",
    createdAt: "2026-06-02T17:45:00Z"
  },

  // --- MAY 2026 ---
  {
    id: "tx-may-01",
    date: "2026-05-01",
    amount: 1450.00,
    merchant: "Apartment Management Group",
    category: "Rent & Housing",
    source: "Mock Bank Sync",
    createdAt: "2026-05-01T08:00:00Z"
  },
  {
    id: "tx-may-02",
    date: "2026-05-02",
    amount: -2850.00,
    merchant: "Initech Systems Corp",
    category: "Income",
    source: "Mock Bank Sync",
    createdAt: "2026-05-02T09:00:00Z"
  },
  {
    id: "tx-may-03",
    date: "2026-05-02",
    amount: 14.99,
    merchant: "Spotify Premium",
    category: "Subscriptions & Bills",
    source: "Mock Bank Sync",
    createdAt: "2026-05-02T10:15:00Z"
  },
  {
    id: "tx-may-04",
    date: "2026-05-04",
    amount: 15.99,
    merchant: "Netflix Inc.",
    category: "Subscriptions & Bills",
    source: "Mock Bank Sync",
    createdAt: "2026-05-04T12:00:00Z"
  },
  {
    id: "tx-may-05",
    date: "2026-05-08",
    amount: 45.00,
    merchant: "Equinox Gym Fitness",
    category: "Health & Fitness",
    source: "Mock Bank Sync",
    createdAt: "2026-05-08T07:15:00Z"
  },
  {
    id: "tx-may-06",
    date: "2026-05-10",
    amount: 88.45,
    merchant: "Whole Foods Market",
    category: "Groceries",
    source: "Mock Bank Sync",
    createdAt: "2026-05-10T11:30:00Z"
  },
  {
    id: "tx-may-07",
    date: "2026-05-12",
    amount: 12.50,
    merchant: "TST* BLUE BOTTLE COF",
    category: "Dining & Cafes",
    source: "Mock Bank Sync",
    createdAt: "2026-05-12T08:30:00Z"
  },
  {
    id: "tx-may-08",
    date: "2026-05-15",
    amount: 22.80,
    merchant: "Uber* Trip Convenience",
    category: "Transport & Travel",
    source: "Mock Bank Sync",
    createdAt: "2026-05-15T18:00:00Z"
  },
  // Double charge duplicate simulation
  {
    id: "tx-may-09",
    date: "2026-05-15",
    amount: 22.80,
    merchant: "Uber* Trip Convenience",
    category: "Transport & Travel",
    source: "Mock Bank Sync",
    createdAt: "2026-05-15T18:01:00Z"
  },
  {
    id: "tx-may-10",
    date: "2026-05-20",
    amount: 112.50,
    merchant: "Target Stores Retail",
    category: "Shopping & Retail",
    source: "Mock Bank Sync",
    createdAt: "2026-05-20T14:15:00Z"
  },
  {
    id: "tx-may-11",
    date: "2026-05-24",
    amount: 64.92,
    merchant: "Trader Joe's",
    category: "Groceries",
    source: "CSV Upload",
    createdAt: "2026-05-24T10:00:00Z"
  },
  {
    id: "tx-may-12",
    date: "2026-05-28",
    amount: 35.00,
    merchant: "City Transit Subway",
    category: "Transport & Travel",
    source: "CSV Upload",
    createdAt: "2026-05-28T09:00:00Z"
  },

  // --- APRIL 2026 ---
  {
    id: "tx-apr-01",
    date: "2026-04-01",
    amount: 1450.00,
    merchant: "Apartment Management Group",
    category: "Rent & Housing",
    source: "Mock Bank Sync",
    createdAt: "2026-04-01T08:00:00Z"
  },
  {
    id: "tx-apr-02",
    date: "2026-04-02",
    amount: -2850.00,
    merchant: "Initech Systems Corp",
    category: "Income",
    source: "Mock Bank Sync",
    createdAt: "2026-04-02T09:00:00Z"
  },
  {
    id: "tx-apr-03",
    date: "2026-04-02",
    amount: 14.99,
    merchant: "Spotify Premium",
    category: "Subscriptions & Bills",
    source: "Mock Bank Sync",
    createdAt: "2026-04-02T10:15:00Z"
  },
  {
    id: "tx-apr-04",
    date: "2026-04-04",
    amount: 15.99,
    merchant: "Netflix Inc.",
    category: "Subscriptions & Bills",
    source: "Mock Bank Sync",
    createdAt: "2026-04-04T12:00:00Z"
  },
  {
    id: "tx-apr-05",
    date: "2026-04-08",
    amount: 45.00,
    merchant: "Equinox Gym Fitness",
    category: "Health & Fitness",
    source: "Mock Bank Sync",
    createdAt: "2026-04-08T07:15:00Z"
  },
  {
    id: "tx-apr-06",
    date: "2026-04-10",
    amount: 95.12,
    merchant: "Whole Foods Market",
    category: "Groceries",
    source: "Mock Bank Sync",
    createdAt: "2026-04-10T11:30:00Z"
  },
  {
    id: "tx-apr-07",
    date: "2026-04-12",
    amount: 11.50,
    merchant: "TST* BLUE BOTTLE COF",
    category: "Dining & Cafes",
    source: "Mock Bank Sync",
    createdAt: "2026-04-12T08:30:00Z"
  },
  {
    id: "tx-apr-08",
    date: "2026-04-15",
    amount: 18.50,
    merchant: "Uber* Trip Convenience",
    category: "Transport & Travel",
    source: "Mock Bank Sync",
    createdAt: "2026-04-15T18:00:00Z"
  },
  {
    id: "tx-apr-09",
    date: "2026-04-18",
    amount: 240.00,
    merchant: "Apple Store Online",
    category: "Shopping & Retail",
    source: "Mock Bank Sync",
    createdAt: "2026-04-18T15:20:00Z"
  },
  {
    id: "tx-apr-10",
    date: "2026-04-24",
    amount: 58.70,
    merchant: "Trader Joe's",
    category: "Groceries",
    source: "Mock Bank Sync",
    createdAt: "2026-04-24T10:00:00Z"
  },

  // --- MARCH 2026 ---
  {
    id: "tx-mar-01",
    date: "2026-03-01",
    amount: 1450.00,
    merchant: "Apartment Management Group",
    category: "Rent & Housing",
    source: "Mock Bank Sync",
    createdAt: "2026-03-01T08:00:00Z"
  },
  {
    id: "tx-mar-02",
    date: "2026-03-02",
    amount: -2850.00,
    merchant: "Initech Systems Corp",
    category: "Income",
    source: "Mock Bank Sync",
    createdAt: "2026-03-02T09:00:00Z"
  },
  {
    id: "tx-mar-03",
    date: "2026-03-02",
    amount: 14.99,
    merchant: "Spotify Premium",
    category: "Subscriptions & Bills",
    source: "Mock Bank Sync",
    createdAt: "2026-03-02T10:15:00Z"
  },
  {
    id: "tx-mar-04",
    date: "2026-03-04",
    amount: 15.99,
    merchant: "Netflix Inc.",
    category: "Subscriptions & Bills",
    source: "Mock Bank Sync",
    createdAt: "2026-03-04T12:00:00Z"
  },
  {
    id: "tx-mar-05",
    date: "2026-03-08",
    amount: 45.00,
    merchant: "Equinox Gym Fitness",
    category: "Health & Fitness",
    source: "Mock Bank Sync",
    createdAt: "2026-03-08T07:15:00Z"
  },
  {
    id: "tx-mar-06",
    date: "2026-03-10",
    amount: 79.90,
    merchant: "Whole Foods Market",
    category: "Groceries",
    source: "Mock Bank Sync",
    createdAt: "2026-03-10T11:30:00Z"
  },
  {
    id: "tx-mar-07",
    date: "2026-03-15",
    amount: 32.40,
    merchant: "Uber* Trip Convenience",
    category: "Transport & Travel",
    source: "Mock Bank Sync",
    createdAt: "2026-03-15T18:00:00Z"
  }
];
