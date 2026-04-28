import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export type NotificationType = 'new_message' | 'large_expense' | 'large_income' | 'new_event' | 'new_task' | 'achievement';

export const sendFamilyNotification = async (
  familyId: string,
  type: NotificationType,
  title: string,
  message: string,
  senderId?: string,
  senderName?: string
) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      familyId,
      type,
      title,
      message,
      senderId,
      senderName,
      timestamp: serverTimestamp(),
      read: false,
    });
  } catch (error) {
    console.error('Ошибка отправки уведомления:', error);
  }
};