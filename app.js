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

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentAssignments = [];
let currentUnavailabilities = [];
let assignmentsRef = null;
let unavailabilitiesRef = null;
let showHistory = false; 

// --- 2. FONCTIONS UI ---

function createModernHeader() {
    if (document.getElementById('modern-header')) return;
    
    const scheduleScreen = document.getElementById('schedule-screen');
    const header = document.createElement('div');
    header.id = 'modern-header';
    
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

// --- 3. GÉNÉRATION DES CARTES ---

function createInterventionCard(inter) {
    const card = document.createElement('div');
    card.className = 'card';
    
    const startDate = new Date(inter.startDate);
    const endDate = new Date(inter.endDate || inter.startDate);
    const dateOptions = { day: 'numeric', month: 'short' };
    const startStr = startDate.toLocaleDateString('fr-FR', dateOptions);
    const endStr = endDate.toLocaleDateString('fr-FR', dateOptions);
    const dateDisplay = (startStr === endStr) ? startStr : `${startStr} - ${endStr}`;

    let borderColor = '#3b82f6';
    
    const style = document.createElement('style');
    style.innerHTML = `.card[data-id="${inter.startDate}"]::before { background-color: ${borderColor} !important; }`;
    card.setAttribute('data-id', inter.startDate);
    card.appendChild(style);

    card.innerHTML += `
        <div class="card-header">
            <span class="date-badge">${dateDisplay}</span>
            <span class="status-badge" style="color:${borderColor}; background-color:${borderColor}15;">${inter.type}</span>
        </div>
        
        <h3 class="card-title-large" style="color:${borderColor}">${inter.clientName}</h3>

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
    const dateOptions = { day: 'numeric', month: 'short' };
    const startStr = startDate.toLocaleDateString('fr-FR', dateOptions);
    const endStr = endDate.toLocaleDateString('fr-FR', dateOptions);
    const dateDisplay = (startStr === endStr) ? startStr : `${startStr} - ${endStr}`;

    let color = '#ea434cff';
    let label = unavail.reason;
    
    if (unavail.reason === 'Arrêt de travail') {
        color = '#ff871dff';
    } else if (unavail.reason === 'Formation') {
        color = '#ea71b6ff'; // Violet
    }

    // Barre latérale colorée
    const style = document.createElement('style');
    style.innerHTML = `.card[data-id="${unavail.startDate}-u"]::before { background-color: ${color} !important; }`;
    card.setAttribute('data-id', unavail.startDate + '-u');
    card.appendChild(style);

    // Structure identique aux Interventions
    card.innerHTML += `
        <div class="card-header">
            <span class="date-badge">${dateDisplay}</span>
        </div>
        
        <h3 class="card-title-large" style="color:${color}">${label}</h3>
    `;
    return card;
}

// --- 4. LOGIQUE MÉTIER ---

function login() {
    const email = document.getElementById('email').value.trim();
    const pass = document.getElementById('password').value.trim();
    if (!email || !pass) return alert("Veuillez remplir les champs");
    
    auth.signInWithEmailAndPassword(email, pass).catch(e => {
        const el = document.getElementById('error-msg');
        if (e.code === 'auth/invalid-email') el.innerText = "Format d'email invalide.";
        else if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') el.innerText = "Email ou mot de passe incorrect.";
        else if (e.message.includes("INVALID_LOGIN_CREDENTIALS")) el.innerText = "Identifiants invalides.";
        else el.innerText = "Erreur : " + e.message;
        el.style.display = 'block';
    });
}

function logout() {
    if (assignmentsRef) assignmentsRef.off();
    if (unavailabilitiesRef) unavailabilitiesRef.off();
    auth.signOut();
    window.location.reload();
}

auth.onAuthStateChanged((user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('schedule-screen').style.display = 'block';
        createModernHeader();
        initTabs();
        loadRealtimeSchedule(); 
        
        setTimeout(() => {
            const viewport = document.querySelector('meta[name="viewport"]');
            if (viewport) viewport.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
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
