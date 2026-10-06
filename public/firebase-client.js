import { getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
const app = getApps()[0] || initializeApp({ apiKey: 'AIzaSyDt0Mr-l4533VuMHSQcCLY3HaBNyrDiDCY', authDomain: 'hay-lugar-1346d.firebaseapp.com', projectId: 'hay-lugar-1346d', storageBucket: 'hay-lugar-1346d.firebasestorage.app', messagingSenderId: '917217925247', appId: '1:917217925247:web:e0a2ff569a19b6239f074a' });
export const auth = getAuth(app);
export { onAuthStateChanged, signOut };
