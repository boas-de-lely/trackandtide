// Track & Tide — Firebase configuration (example)
// Copy this file to firebase-config.js and fill in your Firebase project values.
// You can find these in the Firebase Console → Project Settings → General → Your apps → Web app.

try {
  firebase.initializeApp({
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.firebasestorage.app",
    appId: "YOUR_APP_ID"
  });
} catch (e) {
  console.warn("Firebase init failed:", e.message);
}
