import { Timestamp, addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';

export interface Transaction {
  id?: string;
  familyId: string;
  userId: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  date: Timestamp;
  comment?: string;
}

const COL = 'budget';

export const addTransaction = async (t: Omit<Transaction, 'id'>) => {
  await addDoc(collection(db, COL), t);
};

export const getFamilyTransactions = async (familyId: string) => {
  const q = query(
    collection(db, COL), 
    where('familyId', '==', familyId),
    orderBy('date', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
};

export const updateTransaction = async (id: string, data: Partial<Transaction>) => {
  await updateDoc(doc(db, COL, id), data);
};

export const deleteTransaction = async (id: string) => {
  await deleteDoc(doc(db, COL, id));
};