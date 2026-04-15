import { initializeApp } from "firebase/app";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    onAuthStateChanged,
    signOut
} from "firebase/auth";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import firebaseConfig from "./firebase-config.js";

// Celestial Core Import
import { 
    initStarfield, 
    initStardate, 
    initParallax, 
    initCursorGlow, 
    initSilkRise,
    setWarping 
} from "./celestial-core.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

document.addEventListener('DOMContentLoaded', () => {
    initStardate();
    initStarfield();
    initSilkRise();
    initParallax();
    initCursorGlow();
    initAuth();
});

/**
 * View Management (Main Page: Login & Entry)
 */
const views = ['login-view', 'entry-view'];

function showView(targetId) {
    const loginView = document.getElementById('login-view');
    const entryView = document.getElementById('entry-view');
    const appHeader = document.getElementById('app-header');

    // Handle Starfield State
    setWarping(targetId === 'login-view');

    // Hide all views
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.opacity = '0';
            el.classList.add('pointer-events-none');
        }
    });

    // Toggle Header
    if (targetId === 'login-view') {
        appHeader.classList.add('opacity-0', 'pointer-events-none');
    } else {
        appHeader.classList.remove('opacity-0', 'pointer-events-none');
    }

    // Delay for fade out
    setTimeout(() => {
        views.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        const target = document.getElementById(targetId);
        if (target) {
            target.classList.remove('hidden');
            target.classList.add('flex');
            
            // Allow layout to settle, then make fully interactive
            setTimeout(() => {
                target.style.opacity = '1';
                target.style.pointerEvents = 'auto';
                target.classList.remove('pointer-events-none');
            }, 50);
        }
    }, 1000);
}

/**
 * Handle Firebase Authentication and View Management
 */
function initAuth() {
    const loginBtn = document.getElementById('google-login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const sealBtn = document.getElementById('seal-btn');
    
    // Login
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            try {
                await signInWithPopup(auth, provider);
            } catch (error) {
                console.error("Auth Error:", error);
                if (error.code === 'auth/invalid-api-key') {
                    alert("Firebase is not configured. Please check firebase-config.js");
                }
            }
        });
    }

    // Logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => signOut(auth));
    }

    // Seal Entry
    if (sealBtn) {
        sealBtn.addEventListener('click', async () => {
            const textarea = document.getElementById('log-content');
            const content = textarea.value.trim();
            
            const originalText = sealBtn.innerHTML;
            
            if (!auth.currentUser) {
                alert("Connection lost. Please log in again to seal your entry.");
                signOut(auth);
                return;
            }

            if (!content) {
                alert("Please whisper something into the void before sealing.");
                return;
            }

            try {
                sealBtn.disabled = true;
                sealBtn.innerHTML = '<span>Sealing...</span>';
                
                console.log("Sealing process started...");

                const stardateEl = document.getElementById('header-stardate');
                const stardateVal = stardateEl ? stardateEl.textContent.replace('stardate ', '').trim() : 'Unknown';
                
                const logData = {
                    uid: auth.currentUser.uid,
                    content: content,
                    stardate: stardateVal,
                    timestamp: serverTimestamp(),
                    clientDate: new Date().toISOString()
                };

                const docRef = await addDoc(collection(db, "logs"), logData);
                console.log("Document successfully sealed with ID:", docRef.id);

                textarea.value = '';
                showToast();
            } catch (error) {
                console.error("Critical Firestore Error:", error);
                alert(`The void rejected your entry: ${error.message || 'Check connection or Firestore setup'}`);
            } finally {
                sealBtn.innerHTML = originalText;
                sealBtn.disabled = false;
            }
        });
    }

    // Monitor Auth State
    onAuthStateChanged(auth, (user) => {
        // Dismiss the loading overlay
        const loader = document.getElementById('auth-loader');
        if (loader) {
            loader.style.opacity = '0';
            loader.style.transition = 'opacity 0.4s ease';
            setTimeout(() => loader.remove(), 400);
        }

        if (user) {
            // User already logged in — skip the 1s delay, go straight to entry
            const loginView = document.getElementById('login-view');
            const entryView = document.getElementById('entry-view');
            const appHeader = document.getElementById('app-header');

            setWarping(false);

            if (loginView) loginView.classList.add('hidden');
            if (appHeader) appHeader.classList.remove('opacity-0', 'pointer-events-none');

            if (entryView) {
                entryView.classList.remove('hidden');
                entryView.classList.add('flex');
                setTimeout(() => {
                    entryView.style.opacity = '1';
                    entryView.style.pointerEvents = 'auto';
                    entryView.classList.remove('pointer-events-none');
                }, 50);
            }

            // Update Entry ID
            const entryId = document.getElementById('entry-id');
            if (entryId) entryId.textContent = `Sanctuary Entry No. ${Math.floor(Math.random() * 1000) + 100}`;
        } else {
            showView('login-view');
        }
    });
}

/**
 * Show Celestial Toast Notification
 */
function showToast() {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.classList.remove('opacity-0', 'translate-y-4', 'pointer-events-none');
    toast.classList.add('opacity-1', 'translate-y-0');

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-4', 'pointer-events-none');
        toast.classList.remove('opacity-1', 'translate-y-0');
    }, 4000);
}
