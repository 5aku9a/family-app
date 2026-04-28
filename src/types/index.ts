
export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  familyId?: string; 
  createdAt: Date;
}


export interface Family {
  id: string;
  name: string;
  members: string[]; 
  createdAt: Date;
  createdBy: string; 
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
}


export interface Transaction {
  id: string;
  familyId: string;
  userId: string; 
  amount: number;
  type: 'income' | 'expense';
  categoryId: string;
  description?: string;
  date: Date;
  createdAt: Date;
}


export interface Task {
  id: string;
  familyId: string;
  title: string;
  description?: string;
  assignedTo?: string; // ID пользователя, которому назначена
  createdBy: string; // ID создателя задачи
  isCompleted: boolean;
  dueDate?: Date;
  createdAt: Date;
  completedAt?: Date;
}


export interface Subscription {
  id: string;
  familyId: string;
  userId: string; // Кто добавил
  name: string;
  amount: number;
  currency: string;
  billingCycle: 'weekly' | 'monthly' | 'yearly';
  nextPaymentDate: Date;
  category?: string;
  isActive: boolean;
  createdAt: Date;
}


export interface FamilyBalance {
  familyId: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  lastUpdated: Date;
}