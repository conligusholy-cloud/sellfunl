import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBn01LfyvCMJZuscIk0QNusaiRyX0Pu3Tg",
  authDomain: "sellfunl.firebaseapp.com",
  projectId: "sellfunl",
  storageBucket: "sellfunl.firebasestorage.app",
  messagingSenderId: "741723740801",
  appId: "1:741723740801:web:f98776fcc6396bfe264b80"
};

export const app     = initializeApp(firebaseConfig);
export const db      = getFirestore(app);
export const auth    = getAuth(app);
export const storage = getStorage(app);