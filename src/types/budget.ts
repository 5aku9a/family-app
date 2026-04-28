import { Timestamp } from 'firebase/firestore';

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id?: string;
  userId: string;
  userName?: string;
  familyId?: string;
  type: TransactionType;
  amount: number;
  category: string;
  date: any; 
  comment?: string;
  createdAt: any;
  isRecurring?: boolean;
  subscriptionId?: string;
  billingPeriod?: 'monthly' | 'yearly'; 
  nextBillingDate?: Timestamp;
  serviceName?: string;    
  serviceColor?: string;     
  iconName?: string;    
}

export const CATEGORIES_CONFIG: Record<string, { icon: any; color: string }> = {
  'Еда': { icon: 'fast-food', color: '#FF9F43' },
  'Развлечения': { icon: 'film', color: '#C8D6E5' },
  'Здоровье': { icon: 'medical', color: '#EE5253' },
  'Транспорт': { icon: 'car-sport', color: '#FDCB6E' },
  'Бензин': { icon: 'color-fill', color: '#6C5CE7' },
  'Аренда': { icon: 'key', color: '#A29BFE' },
  'Коммуналка': { icon: 'water', color: '#0984E3' },
  'Спорт': { icon: 'fitness', color: '#00B894' },
  'Одежда': { icon: 'shirt', color: '#E17055' },
  'Связь': { icon: 'phone-portrait', color: '#00CEC9' },
  'Подарки': { icon: 'gift', color: '#E84393' },
  'Другое': { icon: 'ellipsis-horizontal', color: '#B2BEC3' },

  'Зарплата': { icon: 'cash', color: '#00B894' },
  'Премия': { icon: 'trophy', color: '#FDCB6E' },
  'Подарок': { icon: 'gift', color: '#E84393' },
  'Инвестиции': { icon: 'trending-up', color: '#0984E3' },
  'Возврат': { icon: 'return-up-back', color: '#55EFC4' },
  'Фриланс': { icon: 'laptop', color: '#6C5CE7' },
};
export interface OcrResult {
  amount: number;
  category: string;
  comment: string;
  date: Date;
  rawText?: string;
}