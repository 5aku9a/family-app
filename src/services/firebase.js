import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBubmIt-P6iUdWEIyF2ULJH1VR42_2yowAY",
  authDomain: "familyapp-d67ad.firebaseapp.com",
  projectId: "familyapp-d67ad",
  storageBucket: "familyapp-d67ad.firebasestorage.app",
  messagingSenderId: "1091304596534D",
  appId: "1:1091304596534:web:4d768a9a9439b2e3e1e497",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);