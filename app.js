// --- 1. CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyCs1vAhtBiasg9_dejn6VhdqX9iURos_Q0",
    authDomain: "technician-scheduler-89e41.firebaseapp.com",
    databaseURL: "https://technician-scheduler-89e41-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "technician-scheduler-89e41",
    storageBucket: "technician-scheduler-89e41.firebasestorage.app",
    messagingSenderId: "584555187754",
    appId: "1:584555187754:web:3a1e4359b63f9fe13cfd53"
};

// Initialisation
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// Variables globales
let currentAssignments = [];
let currentUnavailabilities = [];
let assignmentsRef = null;
let unavailabilitiesRef = null;
let showHistory = false; 

// --- 2. FONCTIONS UI (DESIGN MODERNE) ---

function createModernHeader() {
    if (document.getElementById('modern-header')) return;
    
    const scheduleScreen = document.getElementById('schedule-screen');
    const header = document.createElement('div');
    header.id = 'modern-header';
    
    // Récupération email pour affichage propre
    const user = firebase.auth().currentUser;
    const email = user ? user.email : "";
    
    header.innerHTML = `
        <div>
            <h1 class="header-title">Mon Planning</h1>
            <div class="header-user">${email}</div>
        </div>
        <button onclick="logout()" class="btn-logout">Déconnexion</button>
    `;

    scheduleScreen.insertBefore(header, scheduleScreen.firstChild);
}

function initTabs() {
    if (document.getElementById('tab-container')) return;

    const container = document.querySelector('#schedule-screen .container');
    const list = document.getElementById('intervention-list');

    const tabDiv = document.createElement('div');
    tabDiv.id = 'tab-container';
    tabDiv.className = 'tab-container';

    const btnFuture = document.createElement('button');
    btnFuture.id = 'tab-future';
    btnFuture.className = 'tab-btn active';
    btnFuture.innerText = "À venir";
    btnFuture.onclick = () => switchTab(false);

    const btnHistory = document.createElement('button');
    btnHistory.id = 'tab-history';
    btnHistory.className = 'tab-btn';
    btnHistory.innerText = "Historique";
    btnHistory.onclick = () => switchTab(true);

    tabDiv.appendChild(btnFuture);
    tabDiv.appendChild(btnHistory);

    container.insertBefore(tabDiv, list);
}

function switchTab(isHistory) {
    showHistory = isHistory;
    document.getElementById('tab-future').className = isHistory ? 'tab-btn' : 'tab-btn active';
    document.getElementById('tab-history').className = isHistory ? 'tab-btn active' : 'tab-btn';
    updateUI();
}

// --- 3. GÉNÉRATION DES CARTES (SANS ICÔNES) ---

function createInterventionCard(inter) {
    const card = document.createElement('div');
    card.className = 'card';
    
    // Formatage des dates
    const startDate = new Date(inter.startDate);
    const endDate = new Date(inter.endDate || inter.startDate);
    
    // Format court et lisible : "12 mars"
    const dateOptions = { day: 'numeric', month: 'short' };
    const startStr = startDate.toLocaleDateString('fr-FR', dateOptions);
    const endStr = endDate.toLocaleDateString('fr-FR', dateOptions);
    const dateDisplay = (startStr === endStr) ? startStr : `${startStr} - ${endStr}`;

    // Couleur de la barre latérale selon le type (optionnel)
    let borderColor = '#3b82f6'; // Bleu par défaut
    if (inter.type === 'MAINTENANCE') borderColor = '#f59e0b'; // Orange
    if (inter.type === 'INSTALLATION') borderColor = '#10b981'; // Vert
    
    card.style.setProperty('--card-border-color', borderColor);
    // On applique la couleur via le style inline pour le pseudo-element (astuce JS)
    const style = document.createElement('style');
    style.innerHTML = `.card[data-id="${inter.startDate}"]::before { background-color: ${borderColor} !important; }`;
    card.setAttribute('data-id', inter.startDate);
    card.appendChild(style);

    card.innerHTML += `
        <div class="card-header">
            <span class="date-badge">${dateDisplay}</span>
            <span class="status-badge" style="color:${borderColor}; background-color:${borderColor}15;">${inter.type}</span>
        </div>
        
        <h3 class="client-name">${inter.clientName}</h3>
        
        <div class="card-details">
            <div class="detail-item">
                <span class="detail-label">Ville</span>
                <span class="detail-value">${inter.clientCity}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Machine</span>
                <span class="detail-value">${inter.machineName}</span>
            </div>
        </div>
    `;
    return card;
}

function createUnavailabilityCard(unavail) {
    const card = document.createElement('div');
    card.className = 'card unavailability-card';
    
    const startDate = new Date(unavail.startDate);
    const endDate = new Date(unavail.endDate);
    const startStr = startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const endStr = endDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

    // Couleur douce selon le motif
    let color = '#ef4444'; // Rouge défaut
    let label = unavail.reason;
    
    if (unavail.reason === 'RTT' || unavail.reason === 'Congés') {
        color = '#10b981'; // Vert émeraude
        label = "Congés / RTT";
    } else if (unavail.reason === 'Formation') {
        color = '#8b5cf6'; // Violet
    }

    // On force la couleur de la barre latérale
    const style = document.createElement('style');
    style.innerHTML = `.card[data-id="${unavail.startDate}-u"]::before { background-color: ${color} !important; }`;
    card.setAttribute('data-id', unavail.startDate + '-u');
    card.appendChild(style);

    card.innerHTML += `
        <div class="unavail-info">
            <span class="unavail-title" style="color:${color}">${label}</span>
            <span class="unavail-date">Du ${startStr} au ${endStr}</span>
        </div>
        <!-- Pas d'emoji géant, juste une pastille discrète -->
        <div style="background:${color}20; color:${color}; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:600;">
            ABSENT
        </div>
    `;
    return card;
}

// --- 4. LOGIQUE MÉTIER ---

function login() {
    // Ajout du .trim() pour supprimer les espaces accidentels
    const email = document.getElementById('email').value.trim();
    const pass = document.getElementById('password').value.trim();
    if (!email || !pass) return alert("Veuillez remplir les champs");
    
    auth.signInWithEmailAndPassword(email, pass).catch(e => {
        const el = document.getElementById('error-msg');
        // Traduction simple des erreurs courantes
        if (e.code === 'auth/invalid-email') {
            el.innerText = "Format d'email invalide.";
        } else if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
            el.innerText = "Email ou mot de passe incorrect.";
        } else if (e.message.includes("INVALID_LOGIN_CREDENTIALS")) {
            el.innerText = "Identifiants invalides (Vérifiez le mot de passe).";
        } else {
            el.innerText = "Erreur : " + e.message;
        }
        el.style.display = 'block';
    });
}

function logout() {
    if (assignmentsRef) assignmentsRef.off();
    if (unavailabilitiesRef) unavailabilitiesRef.off();
    auth.signOut();
    window.location.reload(); // Simple refresh pour nettoyer
}

auth.onAuthStateChanged((user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('schedule-screen').style.display = 'block';
        createModernHeader();
        initTabs();
        loadRealtimeSchedule(); 
        
        // --- TRICK ZOOM RESET ---
        // Petite astuce pour forcer le reset du zoom si jamais il a eu lieu
        setTimeout(() => {
            const viewport = document.querySelector('meta[name="viewport"]');
            if (viewport) {
                viewport.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
            }
        }, 300);
    } else {
        document.getElementById('login-screen').style.display = 'block';
        document.getElementById('schedule-screen').style.display = 'none';
    }
});

function loadRealtimeSchedule() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    
    document.getElementById('loading-text').style.display = 'block';
    
    const myEmail = user.email;

    assignmentsRef = db.ref('assignments').orderByChild('technicianEmail').equalTo(myEmail);
    assignmentsRef.on('value', (snap) => {
        currentAssignments = [];
        snap.forEach(c => {
            const v = c.val();
            if(v) currentAssignments.push({ type: 'intervention', startDate: new Date(v.startDate), endDate: new Date(v.endDate || v.startDate), data: v });
        });
        updateUI();
    });

    unavailabilitiesRef = db.ref('unavailabilities').orderByChild('technicianEmail').equalTo(myEmail);
    unavailabilitiesRef.on('value', (snap) => {
        currentUnavailabilities = [];
        snap.forEach(c => {
            const v = c.val();
            if(v) currentUnavailabilities.push({ type: 'unavailability', startDate: new Date(v.startDate), endDate: new Date(v.endDate), data: v });
        });
        updateUI();
    });
}

function updateUI() {
    const container = document.getElementById('intervention-list');
    document.getElementById('loading-text').style.display = 'none';
    container.innerHTML = "";

    const allItems = [...currentAssignments, ...currentUnavailabilities];
    if (allItems.length === 0) {
        container.innerHTML = "<div class='empty-message'>Aucun élément trouvé.</div>";
        return;
    }

    const today = new Date();
    today.setHours(0,0,0,0);

    let itemsDisplay = [];
    if (showHistory) {
        itemsDisplay = allItems.filter(i => i.endDate < today).sort((a,b) => b.startDate - a.startDate);
    } else {
        itemsDisplay = allItems.filter(i => i.endDate >= today).sort((a,b) => a.startDate - b.startDate);
    }

    if (itemsDisplay.length === 0) {
        container.innerHTML = `<div class='empty-message'>${showHistory ? "Aucun historique." : "Rien de prévu pour le moment."}</div>`;
        return;
    }

    itemsDisplay.forEach(item => {
        if (item.type === 'intervention') {
            container.appendChild(createInterventionCard(item.data));
        } else {
            container.appendChild(createUnavailabilityCard(item.data));
        }
    });
}
