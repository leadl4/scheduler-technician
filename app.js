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



auth.onAuthStateChanged((user) => {
    const loginScreen = document.getElementById('login-screen');
    const scheduleScreen = document.getElementById('schedule-screen');
    const userEmailDisplay = document.getElementById('user-email-display');

    if (user) {
        loginScreen.classList.add('hidden');
        scheduleScreen.classList.remove('hidden');
        userEmailDisplay.innerText = user.email;
        
        loadRealtimeSchedule(); 
    } else {
        loginScreen.classList.remove('hidden');
        scheduleScreen.classList.add('hidden');
        
        document.getElementById('intervention-list').innerHTML = "";
    }
});



function login() {
    const email = document.getElementById('email').value.trim();
    const pass = document.getElementById('password').value.trim();
    const errorMsg = document.getElementById('error-msg');

    if (!email || !pass) {
        errorMsg.innerText = "Veuillez remplir tous les champs.";
        errorMsg.style.display = 'block';
        return;
    }
    
    auth.signInWithEmailAndPassword(email, pass).catch(e => {
        let message = "Erreur de connexion.";
        if (e.code === 'auth/invalid-email') message = "Format d'email invalide.";
        else if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') message = "Email ou mot de passe incorrect.";
        
        errorMsg.innerText = message;
        errorMsg.style.display = 'block';
    });
}



function logout() {
    if (assignmentsRef) assignmentsRef.off();
    if (unavailabilitiesRef) unavailabilitiesRef.off();
    auth.signOut();
}



function switchTab(isHistory) {
    showHistory = isHistory;
    
    const btnFuture = document.getElementById('tab-future');
    const btnHistory = document.getElementById('tab-history');

    if (isHistory) {
        btnFuture.classList.remove('active');
        btnHistory.classList.add('active');
    } else {
        btnFuture.classList.add('active');
        btnHistory.classList.remove('active');
    }
    
    updateUI();
}



function loadRealtimeSchedule() {
    const user = auth.currentUser;
    if (!user) return;
    
    document.getElementById('loading-text').classList.remove('hidden');
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
    const loadingText = document.getElementById('loading-text');
    
    loadingText.classList.add('hidden');
    container.innerHTML = "";

    const allItems = [...currentAssignments, ...currentUnavailabilities];
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



function formatDateRange(start, end) {
    const dateOptions = { day: 'numeric', month: 'short' };
    const startStr = start.toLocaleDateString('fr-FR', dateOptions);
    const endStr = end.toLocaleDateString('fr-FR', dateOptions);
    return (startStr === endStr) ? startStr : `${startStr} - ${endStr}`;
}



function createInterventionCard(inter) {
    const card = document.createElement('div');
    
    let typeClass = 'type-default';
    const typeStr = inter.type || "";

    if (typeStr === 'Installation') {
        typeClass = 'type-installation';
    } else if (typeStr === 'Intervention payante') {
        typeClass = 'type-paid';
    } else if (typeStr === 'Intervention sous garantie') {
        typeClass = 'type-warranty';
    }

    card.className = `card ${typeClass}`;
    
    const dateDisplay = formatDateRange(new Date(inter.startDate), new Date(inter.endDate || inter.startDate));

    card.innerHTML = `
        <div class="card-header">
            <span class="date-badge">${dateDisplay}</span>
            <span class="status-badge">${inter.type}</span>
        </div>
        
        <h3 class="card-title">${inter.clientName}</h3>

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
    const reason = unavail.reason || "";
    
    let colorClass = 'type-holiday';
    
    if (reason === 'Congés payés' || reason === 'RTT') {
        colorClass = 'type-vacation';
    } else if (reason === 'Arrêt de travail') {
        colorClass = 'type-sick';
    } else if (reason === 'Formation') {
        colorClass = 'type-training';
    } else if (reason === 'Férié') {
        colorClass = 'type-holiday';
    }
    
    card.className = `card ${colorClass}`;
    
    const dateDisplay = formatDateRange(new Date(unavail.startDate), new Date(unavail.endDate));

    card.innerHTML = `
        <div class="card-header">
            <span class="date-badge">${dateDisplay}</span>
        </div>
        <h3 class="card-title">${reason}</h3>
    `;
    return card;
}