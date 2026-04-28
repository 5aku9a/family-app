import { Timestamp } from 'firebase/firestore';

export type ItemType = 'task' | 'event';
export type TaskStatus = 'pending' | 'completed';

export interface TaskItem {
  id?: string;
  userId: string;
  userName?: string;
  familyId?: string | null; 
  type: ItemType;
  title: string;
  description?: string | null;
  date: Timestamp;
  time?: string | null; 
  status: TaskStatus;
  assigneeId?: string | null;
  assigneeName?: string | null;
  color?: string | null;
  createdAt: Timestamp;
}