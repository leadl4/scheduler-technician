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

// Initialisation de Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// Variables globales
let currentAssignments = [];
let currentUnavailabilities = [];
let assignmentsRef = null;
let unavailabilitiesRef = null;

// État de l'affichage : false = À venir, true = Historique
let showHistory = false; 

// --- FONCTION POUR CRÉER LE HEADER MODERNE ---

function createModernHeader() {
    // Vérifier si le header existe déjà
    if (document.getElementById('modern-header')) return;
    
    const scheduleScreen = document.getElementById('schedule-screen');
    
    // Créer le header moderne
    const header = document.createElement('div');
    header.id = 'modern-header';
    header.style.cssText = `
        background: linear-gradient(135deg, #00665b 0%, #80b3ad 100%);
        padding: 20px 30px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        margin-bottom: 30px;
        border-radius: 0 0 20px 20px;
    `;

    // Partie gauche : Titre et info utilisateur
    const leftSection = document.createElement('div');
    leftSection.style.cssText = `
        display: flex;
        align-items: center;
        gap: 20px;
    `;

    // Titre et sous-titre
    const titleContainer = document.createElement('div');
    titleContainer.innerHTML = `
        <h1 style="
            margin: 0;
            color: white;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.5px;
        ">Mon Planning</h1>
        <p id="user-email-display" style="
            margin: 5px 0 0 0;
            color: rgba(255, 255, 255, 0.9);
            font-size: 14px;
            font-weight: 400;
        "></p>
    `;

    leftSection.appendChild(titleContainer);

    // Partie droite : Bouton déconnexion
    const logoutBtn = document.createElement('button');
    logoutBtn.onclick = logout;
    logoutBtn.style.cssText = `
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        padding: 12px 24px;
        border-radius: 12px;
        cursor: pointer;
        font-weight: 600;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.3s ease;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    `;
    logoutBtn.innerHTML = `
        <span>Déconnexion</span>
    `;

    // Effet hover
    logoutBtn.onmouseenter = function() {
        this.style.background = 'rgba(255, 255, 255, 0.3)';
        this.style.transform = 'translateY(-2px)';
        this.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.2)';
    };
    logoutBtn.onmouseleave = function() {
        this.style.background = 'rgba(255, 255, 255, 0.2)';
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
    };

    // Assembler le header
    header.appendChild(leftSection);
    header.appendChild(logoutBtn);

    // Insérer au début du schedule-screen
    scheduleScreen.insertBefore(header, scheduleScreen.firstChild);

    // Afficher l'email de l'utilisateur
    const user = firebase.auth().currentUser;
    if (user) {
        document.getElementById('user-email-display').innerText = user.email;
    }

    // Masquer l'ancien bouton logout
    const oldLogoutBtn = document.getElementById('btn-logout');
    if (oldLogoutBtn) {
        oldLogoutBtn.style.display = 'none';
    }
}




// --- 2. GESTION DE L'AUTHENTIFICATION ---

function login() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    
    if (!email || !pass) {
        alert("Veuillez entrer un email et un mot de passe.");
        return;
    }

    auth.signInWithEmailAndPassword(email, pass)
        .catch((error) => {
            const errorLabel = document.getElementById('error-msg');
            errorLabel.innerText = "Erreur: " + error.message;
            errorLabel.style.display = 'block';
        });
}

function logout() {
    if (assignmentsRef) assignmentsRef.off();
    if (unavailabilitiesRef) unavailabilitiesRef.off();
    
    currentAssignments = [];
    currentUnavailabilities = [];
    showHistory = false;
    
    // Supprimer les onglets
    const tabContainer = document.getElementById('tab-container');
    if (tabContainer) tabContainer.remove();
    
    // Supprimer le header moderne
    const modernHeader = document.getElementById('modern-header');
    if (modernHeader) modernHeader.remove();

    auth.signOut();
}

auth.onAuthStateChanged((user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('schedule-screen').style.display = 'block';
        
        // Créer le header moderne
        createModernHeader();
        
        // Initialiser les onglets
        initTabs();
        
        loadRealtimeSchedule(); 
    } else {
        document.getElementById('login-screen').style.display = 'block';
        document.getElementById('schedule-screen').style.display = 'none';
        
        // Supprimer le header moderne lors de la déconnexion
        const modernHeader = document.getElementById('modern-header');
        if (modernHeader) modernHeader.remove();
    }
});

// --- 3. GESTION DES ONGLETS (UI) ---

function initTabs() {
    const scheduleScreen = document.getElementById('schedule-screen');
    const listContainer = document.getElementById('intervention-list');
    
    // Vérifier si les onglets existent déjà
    if (document.getElementById('tab-container')) return;

    // Créer le conteneur des onglets
    const tabContainer = document.createElement('div');
    tabContainer.id = 'tab-container';
    tabContainer.style.display = 'flex';
    tabContainer.style.justifyContent = 'center';
    tabContainer.style.gap = '10px';
    tabContainer.style.marginBottom = '20px';

    // Bouton À VENIR
    const btnFuture = document.createElement('button');
    btnFuture.id = 'tab-future';
    btnFuture.innerText = "📅 À venir / En cours";
    btnFuture.onclick = () => switchTab(false);
    styleTabButton(btnFuture, true); // Actif par défaut

    // Bouton HISTORIQUE
    const btnHistory = document.createElement('button');
    btnHistory.id = 'tab-history';
    btnHistory.innerText = "🕐 Historique";
    btnHistory.onclick = () => switchTab(true);
    styleTabButton(btnHistory, false); // Inactif par défaut

    // Ajouter les boutons
    tabContainer.appendChild(btnFuture);
    tabContainer.appendChild(btnHistory);

    // Insérer AVANT la liste des interventions
    scheduleScreen.insertBefore(tabContainer, listContainer);
}

function styleTabButton(btn, isActive) {
    // Styles de base
    btn.style.padding = "10px 20px";
    btn.style.border = "none";
    btn.style.borderRadius = "20px";
    btn.style.cursor = "pointer";
    btn.style.fontWeight = "bold";
    btn.style.fontSize = "14px";
    btn.style.transition = "all 0.3s ease";

    if (isActive) {
        btn.style.backgroundColor = "#405286ff"; // Bleu (couleur principale)
        btn.style.color = "white";
        btn.style.boxShadow = "0 2px 5px rgba(52, 152, 219, 0.4)";
    } else {
        btn.style.backgroundColor = "#e0e0e0"; // Gris clair
        btn.style.color = "#7f8c8d";
        btn.style.boxShadow = "none";
    }
}

function switchTab(isHistory) {
    showHistory = isHistory;
    
    // Mettre à jour le style des boutons
    styleTabButton(document.getElementById('tab-future'), !isHistory);
    styleTabButton(document.getElementById('tab-history'), isHistory);
    
    // Rafraîchir la liste
    updateUI();
}

// --- 4. LOGIQUE MÉTIER & TEMPS RÉEL ---

function loadRealtimeSchedule() {
    const loading = document.getElementById('loading-text');
    const user = firebase.auth().currentUser;
    if (!user) return;
    
    const myEmail = user.email;
    loading.style.display = "block";
    loading.innerText = "Synchronisation...";

    // Écouteur Assignments
    assignmentsRef = db.ref('assignments')
                       .orderByChild('technicianEmail')
                       .equalTo(myEmail);

    assignmentsRef.on('value', (snapshot) => {
        currentAssignments = [];
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const inter = child.val();
                if (inter) {
                    currentAssignments.push({
                        type: 'intervention',
                        startDate: new Date(inter.startDate),
                        endDate: new Date(inter.endDate),
                        data: inter
                    });
                }
            });
        }
        updateUI();
    }, handleError);

    // Écouteur Indisponibilités
    unavailabilitiesRef = db.ref('unavailabilities')
                            .orderByChild('technicianEmail')
                            .equalTo(myEmail);

    unavailabilitiesRef.on('value', (snapshot) => {
        currentUnavailabilities = [];
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const unavailability = child.val();
                if (unavailability) {
                    currentUnavailabilities.push({
                        type: 'unavailability',
                        startDate: new Date(unavailability.startDate),
                        endDate: new Date(unavailability.endDate),
                        data: unavailability
                    });
                }
            });
        }
        updateUI();
    }, handleError);
}

function updateUI() {
    const container = document.getElementById('intervention-list');
    const loading = document.getElementById('loading-text');
    loading.style.display = "none";
    
    container.innerHTML = "";

    // 1. Fusionner tout
    const allItems = [...currentAssignments, ...currentUnavailabilities];

    if (allItems.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#666; margin-top:20px;'>Aucun élément trouvé.</p>";
        return;
    }

    // 2. Filtrer selon l'onglet actif (Passé vs Futur)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Début de journée

    let itemsDisplay = [];

    if (showHistory) {
        // MODE HISTORIQUE : Uniquement ce qui est fini (date < aujourd'hui)
        itemsDisplay = allItems.filter(item => item.endDate < today);
        // Tri : Du plus récent au plus vieux
        itemsDisplay.sort((a, b) => b.startDate - a.startDate);
    } else {
        // MODE À VENIR : Ce qui finit aujourd'hui ou plus tard
        itemsDisplay = allItems.filter(item => item.endDate >= today);
        // Tri : Du plus proche au plus lointain
        itemsDisplay.sort((a, b) => a.startDate - b.startDate);
    }

    // 3. Affichage
    if (itemsDisplay.length > 0) {
        itemsDisplay.forEach(item => {
            if (item.type === 'intervention') {
                container.appendChild(createInterventionCard(item.data));
            } else {
                container.appendChild(createUnavailabilityCard(item.data));
            }
        });
    } else {
        const message = showHistory ? "Aucun historique disponible." : "Rien de prévu prochainement.";
        container.innerHTML = `<p style='text-align:center; color:#95a5a6; margin-top:30px; font-style:italic;'>${message}</p>`;
    }
}

function handleError(error) {
    const loading = document.getElementById('loading-text');
    loading.style.display = "block";
    loading.style.color = "red";
    console.error(error);
    if (error.message.includes("Index not defined")) {
        loading.innerText = "Erreur Config : Index manquant pour 'technicianEmail'.";
    } else {
        loading.innerText = "Erreur : " + error.message;
    }
}

// --- 5. CRÉATION DES CARTES VISUELLES ---

function createInterventionCard(inter) {
    const card = document.createElement('div');
    card.className = 'card';
    const startDate = new Date(inter.startDate);
    const endDate = new Date(inter.endDate || inter.startDate);
    const startStr = startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const endStr = endDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

    card.innerHTML = `
        <div class="info" style="font-size: 16px; font-weight: 600; color: #2c3e50; margin-bottom: 12px;">
            📅 Du <strong>${startStr}</strong> au <strong>${endStr}</strong>
        </div>
        <h3>🏢 ${inter.clientName}</h3>
        <div class="info">📍 ${inter.clientCity}</div>
        <div class="info">🔧 ${inter.machineName}</div>
        <div style="margin-top:10px;">
            <span class="badge" style="background:#e3f2fd; color:#1565c0;">${inter.type}</span>
        </div>
    `;
    return card;
}

function createUnavailabilityCard(unavailability) {
    const card = document.createElement('div');
    card.className = 'card unavailability-card';
    const startDate = new Date(unavailability.startDate);
    const endDate = new Date(unavailability.endDate);
    const startStr = startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const endStr = endDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    
    let emoji = '🚫';
    let color = '#e74c3c';
    let reasonText = unavailability.reason;
    
    if (unavailability.reason === 'RTT') {
        emoji = '🏖️';
        color = '#e74c3c';
        reasonText = 'RTT';
    } else if (unavailability.reason === 'Congés') {
        emoji = '🏖️';
        color = '#e74c3c';
        reasonText = 'CP';
    } else if (unavailability.reason === 'Arrêt de travail') {
        emoji = '🚫';
        color = '#e67e22';
        reasonText = 'Arrêt de travail';
    } else if (unavailability.reason === 'Formation') {
        emoji = '📚';
        color = '#e24e80ff';
        reasonText = 'Formation';
    }

    card.style.borderLeft = `5px solid ${color}`;
    card.style.background = `linear-gradient(to right, ${color}08, transparent)`;
    
    card.innerHTML = `
        <div class="info" style="font-size: 16px; font-weight: 600; color: #2c3e50; margin-bottom: 12px;">
            📅 Du <strong>${startStr}</strong> au <strong>${endStr}</strong>
        </div>
        <h3 style="color: ${color};">${emoji} ${reasonText}</h3>
    `;
    return card;
}