import sys

# Add your project directory to the Python path
path = '/home/ERO64/chantier_planning_tool/backend'
if path not in sys.path:
    sys.path.append(path)

# Import your Flask app
from app import app as application 