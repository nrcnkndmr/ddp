import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// TODO: Replace the following config with your Firebase project's config
const firebaseConfig = {
  apiKey: "AIzaSyBUVe1GiYCN1apQhm2Ye_nYREzHmzGWyjc",
  authDomain: "deleteddailypictures.firebaseapp.com",
  projectId: "deleteddailypictures",
  storageBucket: "deleteddailypictures.firebasestorage.app",
  messagingSenderId: "236219279138",
  appId: "1:236219279138:web:b17915d86eb4b5f192a77b",
  measurementId: "G-EXN9FM9ENX"
};
let app;
const existingApps = getApps();
if (existingApps.length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = existingApps[0];
}

const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };
