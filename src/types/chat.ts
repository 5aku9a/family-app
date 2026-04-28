import { Timestamp } from 'firebase/firestore';

export interface ChatMessage {
  id?: string;
  familyId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  imageUrl?: string | null; 
  createdAt: Timestamp;
  readBy: string[];
  reactions?: Record<string, string[]>;
}

export interface TypingStatus {
  userId: string;
  userName: string;
  timestamp: Timestamp;
}