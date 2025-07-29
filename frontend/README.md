# Chantier Planning Tool

Application de gestion de planning de chantiers avec synchronisation backend et export de données.

## Fonctionnalités

- Calendrier des chantiers
- Formulaire d'ajout et d'édition de chantiers
- Synchronisation des données avec le serveur
- Export des données en CSV
- Mode hors-ligne automatique

## Instructions de déploiement pour PythonAnywhere

### 1. Créer un compte PythonAnywhere

- Visitez [PythonAnywhere](https://www.pythonanywhere.com/) et créez un compte gratuit
- Connectez-vous à votre compte

### 2. Configuration de la base de données MySQL

1. Allez dans l'onglet "Databases"
2. Créez une nouvelle base de données MySQL
3. Notez le nom d'utilisateur, le mot de passe et le nom de la base de données

### 3. Configuration du backend Flask

1. Ouvrez une console Bash depuis le dashboard
2. Créez un environnement virtuel et installez les dépendances:
```bash
mkvirtualenv --python=/usr/bin/python3.8 chantier-env
cd ~
mkdir -p chantier_planning_tool/backend
cd chantier_planning_tool/backend
```

3. Créez le fichier `requirements.txt` avec le contenu suivant:
```
Flask==2.0.1
Flask-SQLAlchemy==2.5.1
Flask-CORS==3.0.10
mysqlclient==2.0.3
```

4. Installez les dépendances:
```bash
pip install -r requirements.txt
```

5. Créez le fichier `app.py` avec le code du backend

6. Mettez à jour la configuration de la base de données dans `app.py`:
```python
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql://ERO64:motdepasse@ERO64.mysql.pythonanywhere-services.com/ERO64$chantiers'
```

7. Créez le fichier `passenger_wsgi.py` avec le contenu suivant:
```python
import sys

# Add your project directory to the Python path
path = '/home/ERO64/chantier_planning_tool/backend'
if path not in sys.path:
    sys.path.append(path)

# Import your Flask app
from app import app as application
```

8. Initialisez la base de données:
```bash
python
>>> from app import db, app
>>> with app.app_context():
...     db.create_all()
>>> exit()
```

### 4. Configuration de l'application web

1. Allez dans l'onglet "Web"
2. Cliquez sur "Add a new web app"
3. Choisissez "Manual configuration" et "Python 3.8"
4. Dans la section "Code", définissez:
   - Source code: `/home/ERO64/chantier_planning_tool/backend`
   - Working directory: `/home/ERO64/chantier_planning_tool`
   - WSGI configuration file: `/home/ERO64/chantier_planning_tool/backend/passenger_wsgi.py`
5. Dans la section "Virtualenv", entrez: `/home/ERO64/.virtualenvs/chantier-env`

### 5. Configuration des fichiers statiques

1. Toujours dans l'onglet "Web", faites défiler jusqu'à "Static files"
2. Ajoutez une nouvelle entrée:
   - URL: `/static`
   - Directory: `/home/ERO64/chantier_planning_tool/frontend`
3. Créez les répertoires et téléchargez les fichiers:
```bash
cd ~
mkdir -p chantier_planning_tool/frontend
```
4. Téléchargez les fichiers de l'interface dans le répertoire frontend

### 6. Actualisation et test

1. Cliquez sur le bouton "Reload" dans l'onglet "Web"
2. Votre application devrait être disponible à:
   - API: `https://ERO64.pythonanywhere.com/api`
   - Frontend: `https://ERO64.pythonanywhere.com/static/index.html`

## Personnalisation

### Changement de l'URL de l'API

Si vous devez changer l'URL de l'API, modifiez la variable `API_URL` dans le fichier `app.js`:

```javascript
const API_URL = 'https://ERO64.pythonanywhere.com/api';
```

### Changement des informations de la base de données

Modifiez la configuration de la base de données dans `app.py`:

```python
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql://votre_utilisateur:votre_mot_de_passe@votre_hote.mysql.pythonanywhere-services.com/votre_bd'
``` 