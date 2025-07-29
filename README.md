# Chantier Planning Tool

Application de gestion de planning de chantiers avec synchronisation backend et export de données.

## Structure du Projet

```
├── backend/                 # Application Flask backend
│   ├── app.py              # Application principale Flask avec API MongoDB
│   ├── requirements.txt    # Dépendances Python
│   ├── passenger_wsgi.py   # Configuration WSGI pour PythonAnywhere
│   └── wait.html          # Page d'attente
├── frontend/               # Interface utilisateur web
│   ├── index.html         # Page principale
│   ├── app.js             # Logique principale de l'application
│   ├── worker-management.js # Gestion des employés et présences
│   ├── worker-management.html # Interface de gestion des employés
│   ├── styles.css         # Styles CSS
│   └── ...               # Autres fichiers frontend
├── INVOICE_DSMETAL/       # Module de facturation
└── start.bat             # Script de démarrage Windows
```

## Fonctionnalités

- Calendrier des chantiers
- Formulaire d'ajout et d'édition de chantiers  
- Gestion des employés et suivi des présences
- Synchronisation des données avec le serveur MongoDB
- Export des données en CSV
- Mode hors-ligne automatique
- Module de facturation intégré

## Installation et Démarrage

### Prérequis
- Python 3.8+
- MongoDB (local ou cloud via MongoDB Atlas)

### Démarrage Rapide

1. **Windows (recommandé)**:
   ```cmd
   start.bat
   ```

2. **Manuel**:
   ```bash
   cd backend
   pip install -r requirements.txt
   python app.py
   ```

L'application sera accessible à `http://127.0.0.1:5000`

## Configuration

### Base de Données
La configuration MongoDB se trouve dans `backend/app.py`. Modifiez les variables suivantes :
- `MONGO_URI` : URI de connexion MongoDB
- `DB_NAME` : Nom de la base de données
- `COLLECTION_NAME` : Nom de la collection pour les chantiers

### API Frontend
L'URL de l'API peut être configurée dans `frontend/config.js` :
```javascript
const API_URL = 'http://127.0.0.1:5000/api';
```

## Déploiement

Voir `frontend/README.md` pour les instructions détaillées de déploiement sur PythonAnywhere.

## Structure des Données

### Chantiers
- Informations du chantier (nom, dates, lieu)
- Assignation des employés
- Suivi des heures et présences

### Employés (Workers)  
- Informations personnelles
- Salaire mensuel
- Historique des présences
- Notes et commentaires