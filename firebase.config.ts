// Firebase configuration for NexusPC
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBHZY_TCT3HC9yQYuebcz1y_QaB4F2e6kI",
  authDomain: "nexuspc-a9df6.firebaseapp.com",
  projectId: "nexuspc-a9df6",
  storageBucket: "nexuspc-a9df6.firebasestorage.app",
  messagingSenderId: "433386174352",
  appId: "1:433386174352:web:01c36d3570331e87842515",
  measurementId: "G-K6M1DS7E6K",
  databaseURL: "https://nexuspc-a9df6-default-rtdb.europe-west1.firebasedatabase.app"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const database = getDatabase(app);

export default app;
