import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// TODO: Replace the following config with your Firebase project's config
const firebaseConfig = {
  apiKey: "AIzaSyBJ25TDe33hilTfM20_eRdey-mn3cFQc0o",
  authDomain: "dailydeletedpicture.firebaseapp.com",
  projectId: "dailydeletedpicture",
  storageBucket: "dailydeletedpicture.firebasestorage.app",
  messagingSenderId: "231056323724",
  appId: "1:231056323724:web:544096e8824fc19a8ab7a9"
};

let app;
if (!getApps().length) app = initializeApp(firebaseConfig);
else app = getApps()[0];

const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };
