let pending;
export function loadFirebaseClient() {
  if (!pending) pending = Promise.all([
    import(/* webpackIgnore: true */ 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
    import(/* webpackIgnore: true */ 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')
  ]).then(([appSdk, authSdk]) => {
    const app = appSdk.getApps()[0] || appSdk.initializeApp({
      apiKey: 'AIzaSyDt0Mr-l4533VuMHSQcCLY3HaBNyrDiDCY',
      authDomain: 'hay-lugar-1346d.firebaseapp.com', projectId: 'hay-lugar-1346d',
      storageBucket: 'hay-lugar-1346d.firebasestorage.app',
      messagingSenderId: '917217925247', appId: '1:917217925247:web:e0a2ff569a19b6239f074a'
    });
    const auth = authSdk.getAuth(app);
    auth.languageCode = 'es';
    const provider = new authSdk.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return { auth, provider, onAuthStateChanged: authSdk.onAuthStateChanged, signOut: authSdk.signOut, signInWithPopup: authSdk.signInWithPopup };
  }).catch(error => { pending = undefined; throw error; });
  return pending;
}
