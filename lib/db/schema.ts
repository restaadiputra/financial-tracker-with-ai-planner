// Stored UNENCRYPTED — see docs/finance-tracker-prd.md Section 4.3.
export interface Profile {
  id: string;
  emailHash: string;
  displayName: string;
  salt: string;
  verifier: string;
  verifierIv: string;
  createdAt: number;
}

// Unencrypted indexing fields + an encrypted payload — see PRD Section 4.4.
export interface TransactionRecord {
  id: string;
  profileId: string;
  date: number;
  iv: string;
  encryptedPayload: string;
}

// Decrypted shape of TransactionRecord.encryptedPayload — see PRD Section 5.1.
export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  category: string;
  note?: string;
  date: number;
  recurringRuleId?: string;
  receiptImageRef?: string;
  createdAt: number;
  updatedAt: number;
}

// Categories are not financial data, so they're stored unencrypted — see PRD Section 5.2.
export interface CategoryRecord {
  id: string;
  profileId: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense' | 'both';
  isDefault: boolean;
}

export const DEFAULT_CATEGORIES: Omit<CategoryRecord, 'id' | 'profileId'>[] = [
  { name: 'Food', icon: 'utensils', color: '#e08e45', type: 'expense', isDefault: true },
  { name: 'Transport', icon: 'car', color: '#5b8def', type: 'expense', isDefault: true },
  { name: 'Housing', icon: 'home', color: '#8a6fd1', type: 'expense', isDefault: true },
  { name: 'Bills/Subscriptions', icon: 'receipt', color: '#d15b8f', type: 'expense', isDefault: true },
  { name: 'Shopping', icon: 'shopping-bag', color: '#d18f3a', type: 'expense', isDefault: true },
  { name: 'Health', icon: 'heart-pulse', color: '#d1483a', type: 'expense', isDefault: true },
  { name: 'Entertainment', icon: 'clapperboard', color: '#3aa6d1', type: 'expense', isDefault: true },
  { name: 'Salary', icon: 'banknote', color: '#3aa56b', type: 'income', isDefault: true },
  { name: 'Freelance/Business', icon: 'briefcase', color: '#3a8fa5', type: 'income', isDefault: true },
  { name: 'Transfer', icon: 'arrow-left-right', color: '#7a7a7a', type: 'both', isDefault: true },
  { name: 'Other', icon: 'circle-dashed', color: '#9a9a9a', type: 'both', isDefault: true },
];
