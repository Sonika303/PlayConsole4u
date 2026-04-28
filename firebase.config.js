import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyC_fNfUQUcdhicNNx-e0weEGURbz-mzS8g",
  authDomain: "playconsole4u.firebaseapp.com",
  databaseURL: "https://playconsole4u-default-rtdb.firebaseio.com",
  projectId: "playconsole4u",
  storageBucket: "playconsole4u.firebasestorage.app",
  messagingSenderId: "383598421108",
  appId: "1:383598421108:web:12767cf3738cef9d8a9d21",
  measurementId: "G-FFXMD1550D"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getDatabase(app);

export { app, analytics, auth, db };