export interface Transaction {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  amount: number; // positive for expense, negative for income
  merchant: string;
  category: string;
  source: 'CSV Upload' | 'Mock Bank Sync' | 'Receipt Scan' | 'Manual';
  rawText?: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  category: string; // Category name or 'All'
  limit: number;
  updatedAt: string;
}

export interface UserProfile {
  userId: string;
  customContext: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

export interface ReceiptScanResult {
  merchant: string;
  amount: number;
  date: string;
  category: string;
  confidence: number;
  lines: string[];
}
