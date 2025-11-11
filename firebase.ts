// Import the functions you need from the SDKs you need
// FIX: Using named import for firebase/app to resolve potential module resolution issues.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCwPA7uK3OgJpu_ki6G655YUaS-D-c4s6g",
  authDomain: "ponto-digital-central.firebaseapp.com",
  projectId: "ponto-digital-central",
  storageBucket: "ponto-digital-central.appspot.com",
  messagingSenderId: "491819680523",
  appId: "1:491819680523:web:fd86744aa13a942f3c180e",
  measurementId: "G-JFLDN5RPK8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);