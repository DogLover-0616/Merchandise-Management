import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA_N6mtmZgvCxChjEcJqRGHvKCJw9pWXHE",
  authDomain: "sales-management-31979.firebaseapp.com",
  projectId: "sales-management-31979",
  storageBucket: "sales-management-31979.firebasestorage.app",
  messagingSenderId: "339482971964",
  appId: "1:339482971964:web:3f2551ba94b7a55d361839",
  measurementId: "G-M017CXHSN1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
