// Track & Tide — Firebase configuration
// ⚠️ This file is NOT committed to Git (see .gitignore).
//    Copy firebase-config.example.js → firebase-config.js and fill in your values.

try {
  firebase.initializeApp({
    apiKey: "AIzaSyADhp9j4huAl0rZQn9RSem8x3O7g2dyI1A",
    authDomain: "trackandtide-00.firebaseapp.com",
    projectId: "trackandtide-00",
    storageBucket: "trackandtide-00.firebasestorage.app",
    appId: "1:157938380271:web:8b36389f334e3adefdda1a"
  });
} catch (e) {
  console.warn("Firebase init failed:", e.message);
}
