// Основные типы данных для приложения "Семейный быт и бюджет"

// Пользователь
export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  familyId?: string; // ID семьи, к которой принадлежит пользователь
  createdAt: Date;
}

// Семья
export interface Family {
  id: string;
  name: string;
  members: string[]; // Массив ID пользователей
  createdAt: Date;
  createdBy: string; // ID создателя семьи
}

// Категория расходов/доходов
export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
}

// Транзакция (доход или расход)
export interface Transaction {
  id: string;
  familyId: string;
  userId: string; // Кто добавил
  amount: number;
  type: 'income' | 'expense';
  categoryId: string;
  description?: string;
  date: Date;
  createdAt: Date;
}

// Задача
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

// Подписка
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

// Баланс семьи
export interface FamilyBalance {
  familyId: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  lastUpdated: Date;
}