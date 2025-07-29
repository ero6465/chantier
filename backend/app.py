from flask import Flask, request, jsonify, abort, send_from_directory
from flask_cors import CORS
# from flask_sqlalchemy import SQLAlchemy # Removed
import os
from datetime import datetime
from pymongo import MongoClient # Added
from pymongo.server_api import ServerApi # Added ServerApi import
from bson import ObjectId
from pymongo.collection import ReturnDocument # Added ReturnDocument import
from bson.errors import InvalidId # Added for error handling
import json
import webbrowser
import threading
import time
import sys

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

# Configure MongoDB connection (Chantier data)
MONGO_URI = "mongodb+srv://blenderit5:Ero646545@cluster0.he8t5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
DB_NAME = "chantier_planning" # Choose a database name
COLLECTION_NAME = "chantiers" # Choose a collection name

# Global variables for MongoDB connection
# Chantier cluster
client = None
db = None
chantiers_collection = None

# ---------------- Workers collection (employees) ----------------
WORKERS_COLLECTION_NAME = "workers"
workers_collection = None

# Presence cluster
presence_client = None
presence_db = None
presence_collection = None

def connect_to_mongodb():
    global client, db, chantiers_collection
    try:
        client = MongoClient(MONGO_URI, server_api=ServerApi('1'))
        db = client[DB_NAME] # Access the database
        chantiers_collection = db[COLLECTION_NAME]  # chantiers collection
        # Workers collection (create if missing)
        global workers_collection
        workers_collection = db[WORKERS_COLLECTION_NAME]
        # Test connection
        client.admin.command('ping')
        print("Successfully connected to MongoDB!")
        return True
    except Exception as e:
        print(f"Could not connect to MongoDB: {e}")
        client = None
        db = None
        chantiers_collection = None
        return False

# Presence cluster URI and DB/collection names (same style as primary)
PRESENCE_URI = "mongodb+srv://blenderit5:Blenderit5@presence.fgcrfrn.mongodb.net/?retryWrites=true&w=majority&appName=Presence"
PRESENCE_DB_NAME = "presence"
PRESENCE_COLLECTION_NAME = "worker_presence"

def connect_to_presence():
    global presence_client, presence_db, presence_collection
    try:
        presence_client = MongoClient(PRESENCE_URI, server_api=ServerApi('1'))
        presence_db = presence_client[PRESENCE_DB_NAME]
        presence_collection = presence_db[PRESENCE_COLLECTION_NAME]
        presence_client.admin.command('ping')
        print("Connected to Presence MongoDB cluster!")
        return True
    except Exception as e:
        print(f"Could not connect to Presence cluster: {e}")
        presence_client = None
        presence_db = None
        presence_collection = None
        return False

# Initialize main MongoDB connection (required)
if not connect_to_mongodb():
    print("Failed to connect to primary MongoDB. Exiting...")
    sys.exit(1)
# Presence connection is optional – server will still start
if not connect_to_presence():
    print("WARNING: Presence cluster unavailable. Continuing with primary DB only.")

# Function to check MongoDB connection
def check_mongodb_connection():
    global client, db, chantiers_collection, presence_client, presence_db, presence_collection
    while True:
        try:
            if client is None:
                print("Attempting to reconnect to MongoDB...")
                connect_to_mongodb()
            else:
                client.admin.command('ping')
            # Presence
            if presence_client is None:
                print("Attempting to reconnect to Presence cluster...")
                connect_to_presence()
            else:
                presence_client.admin.command('ping')
        except Exception as e:
            print(f"MongoDB connection error: {e}")
            client = None
            db = None
            chantiers_collection = None
            presence_client = None
            presence_db = None
            presence_collection = None
        time.sleep(60)  # Check every minute

# Start MongoDB connection checker in a separate thread
mongodb_checker = threading.Thread(target=check_mongodb_connection, daemon=True)
mongodb_checker.start()

# ---------------- Workers API endpoints -----------------

@app.route('/api/workers', methods=['GET'])
def list_workers():
    """Return all workers"""
    if workers_collection is None:
        return jsonify({"error": "Database unavailable"}), 500
    docs = list(workers_collection.find({}))
    for d in docs:
        d['id'] = str(d.pop('_id'))
    return jsonify(docs), 200


@app.route('/api/workers', methods=['POST'])
def create_worker():
    data = request.json or {}
    name = data.get("name")
    if not name:
        return jsonify({"error": "Missing name"}), 400

    # Prevent creating duplicate workers by name
    if workers_collection.find_one({"name": name}):
        return jsonify({"error": f"Worker with name '{name}' already exists."}), 409 # 409 Conflict

    worker_doc = {
        "name": name,
        "monthlyPay": data.get("monthlyPay"),
        "note": data.get("note", ""),
        "presence": {}
    }
    
    result = workers_collection.insert_one(worker_doc)
    created_document = workers_collection.find_one({"_id": result.inserted_id})
    if created_document:
        created_document["_id"] = str(created_document["_id"])
        return jsonify(created_document), 201
    else:
        return jsonify({"error": "Failed to retrieve created worker"}), 500


@app.route('/api/workers/<string:worker_id>', methods=['PUT', 'PATCH'])
def update_worker(worker_id):
    if workers_collection is None:
        return jsonify({"error": "Database unavailable"}), 500
    
    data = request.json or {}
    update_fields = {}
    if 'name' in data:
        update_fields['name'] = data['name']
    if 'monthlyPay' in data:
        update_fields['monthlyPay'] = data['monthlyPay']
    if 'note' in data:
        update_fields['note'] = data['note']

    if not update_fields:
        return jsonify({"error": "No fields to update"}), 400

    try:
        obj_id = ObjectId(worker_id)
    except InvalidId:
        return jsonify({"error": "Invalid worker ID format"}), 400

    # Atomically find and update the worker
    updated_worker = workers_collection.find_one_and_update(
        {'_id': obj_id},
        {'$set': update_fields},
        return_document=ReturnDocument.AFTER
    )

    # Find the worker *before* updating to get the old name if needed
    old_worker = workers_collection.find_one({'_id': obj_id})
    if not old_worker:
        return jsonify({"error": "Worker not found"}), 404

    # Perform the update
    updated_worker = workers_collection.find_one_and_update(
        {'_id': obj_id},
        {'$set': update_fields},
        return_document=ReturnDocument.AFTER
    )

    if updated_worker:
        # If name was changed, update all corresponding presence records
        new_name = updated_worker.get('name')
        old_name = old_worker.get('name')
        if new_name and old_name and new_name != old_name:
            presence_collection.update_many(
                {'worker': old_name},
                {'$set': {'worker': new_name}}
            )

        updated_worker['_id'] = str(updated_worker['_id'])
        return jsonify(updated_worker), 200
    else:
        return jsonify({"error": "Worker not found"}), 404
    return jsonify({"message": "updated"}), 200


@app.route('/api/workers/<string:worker_id>', methods=['DELETE'])
def delete_worker(worker_id):
    if workers_collection is None:
        return jsonify({"error": "Database unavailable"}), 500
    try:
        obj_id = ObjectId(worker_id)
    except InvalidId:
        # Attempt delete by clientId
        res = workers_collection.delete_one({'clientId': worker_id})
        if res.deleted_count == 0:
            return jsonify({"error": "Worker not found"}), 404
        if presence_collection is not None and worker_name:
            presence_collection.delete_one({'worker': worker_name})
        return jsonify({"message": "deleted"}), 200
    # fetch worker name before deleting
    worker_doc = workers_collection.find_one({'_id': obj_id})
    worker_name = worker_doc['name'] if worker_doc else None
    res = workers_collection.delete_one({'_id': obj_id})
    if res.deleted_count == 0:
        return jsonify({"error": "Worker not found"}), 404
    # Also delete presence doc by worker name
    if presence_collection is not None and worker_name:
        presence_collection.delete_one({'worker': worker_name})
    return jsonify({"message": "deleted"}), 200


@app.route('/api/workers/all', methods=['DELETE'])
def delete_all_workers():
    if workers_collection is None:
        return jsonify({"error": "Database unavailable"}), 500
    result = workers_collection.delete_many({})
    return jsonify({"message": f"deleted {result.deleted_count} workers"}), 200


@app.route('/api/worker/rename', methods=['POST'])
def rename_worker():
    if workers_collection is None:
        return jsonify({"error": "Database unavailable"}), 500
    data = request.json or {}
    old = data.get('oldName')
    new = data.get('newName')
    if not old or not new:
        return jsonify({"error": "Missing oldName or newName"}), 400
    workers_collection.update_many({'name': old}, {'$set': {'name': new, 'worker': new}})
    # sync presence collection
    if presence_collection is not None:
        presence_collection.update_many({'worker': old}, {'$set': {'worker': new}})
    return jsonify({"message": "renamed"}), 200

# ---------------- Presence API endpoints -----------------

# GET presence for a worker or all workers. Supports optional date filtering.
@app.route('/api/presence', methods=['GET'])
def get_presence():
    """Return presence documents. If a single worker is requested, just that doc; otherwise all."""
    if presence_collection is None:
        return jsonify({"error": "Presence DB unavailable"}), 500

    worker = request.args.get('worker')
    if worker:
        doc = presence_collection.find_one({"worker": worker})
        if not doc:
            return jsonify([]), 200
        doc['id'] = str(doc.pop('_id'))
        return jsonify([doc]), 200
    else:
        docs = list(presence_collection.find({}))
        for d in docs:
            d['id'] = str(d.pop('_id'))
        return jsonify(docs), 200

# POST /api/presence
# Body: {"worker": "Alice", "date": "2025-07-28", "present": true, "supHours": 2, "monthlyPay": 3000}
@app.route('/api/presence', methods=['POST'])
def upsert_presence():
    """Upsert presence for a specific worker & date inside the nested presence object."""
    if presence_collection is None:
        return jsonify({"error": "Presence DB unavailable"}), 500

    data = request.json or {}
    if not {'worker', 'date'}.issubset(data):
        return jsonify({"error": "Missing required fields (worker, date)"}), 400

    worker = data['worker']
    date_str = data['date']
    present = data.get('present', True)
    sup_hours = data.get('supHours', 0)

    update = {
        f"presence.{date_str}": {
            "present": bool(present),
            "supHours": sup_hours
        }
    }
    # Also optionally update monthlyPay & note if provided
    if 'monthlyPay' in data:
        update['monthlyPay'] = data['monthlyPay']
    if 'note' in data:
        update['note'] = data['note']

    presence_collection.update_one(
        {"worker": worker},
        {"$set": update, "$setOnInsert": {"worker": worker}},
        upsert=True
    )
    return jsonify({"message": "saved"}), 200

# DELETE /api/presence/day?worker=<id>&date=<YYYY-MM-DD>
@app.route('/api/presence/day', methods=['DELETE'])
def clear_day():
    if presence_collection is None:
        return jsonify({"error": "Presence DB unavailable"}), 500

    worker = request.args.get('worker')
    date_str = request.args.get('date')
    if not worker or not date_str:
        return jsonify({"error": "Missing worker or date parameters"}), 400

    presence_collection.update_one({"worker": worker}, {"$unset": {f"presence.{date_str}": ""}})
    return jsonify({"message": "day cleared"}), 200

# Rename worker field across presence documents
@app.route('/api/presence/renameWorker', methods=['POST', 'PATCH'])
def rename_presence_worker():
    if presence_collection is None:
        return jsonify({"error": "Presence DB unavailable"}), 500
    data = request.json or {}
    old = data.get('oldName')
    new = data.get('newName')
    if not old or not new:
        return jsonify({"error": "Missing oldName or newName"}), 400
    presence_collection.update_many({'worker': old}, {'$set': {'worker': new}})
    return jsonify({"message": "renamed"}), 200

# DELETE /api/presence/all – wipe entire collection (use with caution)
@app.route('/api/presence/all', methods=['DELETE'])
def delete_all_presence():
    if presence_collection is None:
        return jsonify({"error": "Presence DB unavailable"}), 500

    result = presence_collection.delete_many({})
    return jsonify({"message": f"deleted {result.deleted_count} documents"}), 200

# ---------------------------------------------------------

# Removed SQLAlchemy config and db object init
# app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///local_database.db'
# app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# db = SQLAlchemy(app)

# Removed SQLAlchemy Chantier model definition
# class Chantier(db.Model): ...

# Helper function to convert MongoDB ObjectId to string
def serialize_chantier(chantier):
    """Serialize a chantier document into a JSON-serializable format."""
    serialized = {
        "id": str(chantier.get('_id')),
        "title": chantier.get("title", ""),
        "description": chantier.get("description", ""),
        "startDate": chantier.get("startDate", None),
        "endDate": chantier.get("endDate", None),
        "status": chantier.get("status", "ongoing"),
        "estimatedDuration": chantier.get("estimatedDuration"),
        "urgency": chantier.get("urgency"),
        "address": chantier.get("address", ""),
        "contactPhone": chantier.get("contactPhone", ""),
        "contactEmail": chantier.get("contactEmail", ""),
        "assignees": chantier.get("assignees", []), 
        "devis": chantier.get("devis", ""),
        "parentChantierId": chantier.get("parentChantierId"),
        "createdAt": chantier.get("createdAt"),
        "updatedAt": chantier.get("updatedAt")
    }
    # Safely parse images and pdfs
    try:
        serialized["images"] = json.loads(chantier.get("images", "[]"))
    except (json.JSONDecodeError, TypeError):
        serialized["images"] = [] # Default to empty list on error
    try:
        serialized["pdfs"] = json.loads(chantier.get("pdfs", "[]"))
    except (json.JSONDecodeError, TypeError):
        serialized["pdfs"] = [] # Default to empty list on error
        
    # Ensure dates are strings or None
    if isinstance(serialized["startDate"], datetime):
        serialized["startDate"] = serialized["startDate"].isoformat()
    if isinstance(serialized["endDate"], datetime):
        serialized["endDate"] = serialized["endDate"].isoformat()
        
    return serialized

# Serve the main HTML file
@app.route('/')
def serve_frontend():
    return send_from_directory('../frontend', 'index.html')

@app.route('/worker-management')
def serve_worker_management():
    return send_from_directory('../frontend', 'worker-management.html')

# Serve static files
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('../frontend', path)

@app.route('/api/chantiers', methods=['GET'])
def get_chantiers():
    """Get all chantiers, optimized with projection for faster loading."""
    if chantiers_collection is None:
        return jsonify({"error": "Database connection not available"}), 500
    
    try:
        # Define projection to fetch only necessary fields for initial display
        projection = {
            "_id": 1,
            "title": 1,
            "startDate": 1,
            "endDate": 1,
            "status": 1,
            "parentChantierId": 1,
            # Add other fields if absolutely essential for initial list/calendar view
            # e.g., "images" if a thumbnail is shown immediately, "assignees" if shown in list
            "images": 1, # Needed for list/grid thumbnail
            "assignees": 1, # Needed for list/grid display
            "urgency": 1, # Needed for status badge class
            "address": 1, # Needed for list/grid display
            "description": 1 # Needed for list display
        }
        
        # Fetch chantiers with projection
        all_chantiers = list(chantiers_collection.find({}, projection))
        
        serialized_chantiers = []
        for chantier in all_chantiers:
            try:
                # Serialization should still work due to .get() usage
                serialized_chantiers.append(serialize_chantier(chantier))
            except Exception as e:
                app.logger.error(f"Error serializing chantier {chantier.get('_id')}: {e}")
                # Optionally skip this chantier
        
        return jsonify(serialized_chantiers)
    except Exception as e:
        app.logger.error(f"Error fetching all chantiers: {e}")
        return jsonify({"error": f"Database operation failed: {str(e)}"}), 500

@app.route('/api/chantiers', methods=['POST'])
def create_chantier():
    data = request.json
    if not data or 'title' not in data or 'startDate' not in data or 'endDate' not in data:
        return jsonify({"error": "Missing required fields (title, startDate, endDate)"}), 400

    # Basic validation/sanitization (expand as needed)
    title = data.get('title', '').strip()
    if not title:
        return jsonify({"error": "Title cannot be empty"}), 400

    # Prepare data for MongoDB
    chantier_data = {
        "title": title,
        "description": data.get('description', '').strip(),
        "startDate": data.get('startDate'),
        "endDate": data.get('endDate'),
        "status": data.get('status', 'ongoing'),
        "estimatedDuration": data.get('estimatedDuration'),
        "urgency": data.get('urgency'),
        "address": data.get('address', '').strip(),
        "contactPhone": data.get('contactPhone', '').strip(),
        "contactEmail": data.get('contactEmail', '').strip(), # Add email
        "assignees": data.get('assignees', []), # Expecting an array
        "devis": data.get('devis', '').strip(),
        "images": data.get('images', '[]'), # Store as JSON string
        "pdfs": data.get('pdfs', '[]'), # Store as JSON string
        "parentChantierId": data.get('parentChantierId'),
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }

    try:
        result = chantiers_collection.insert_one(chantier_data)
        # Retrieve the inserted document to return it with its ID
        new_chantier = chantiers_collection.find_one({"_id": result.inserted_id})
        return jsonify(serialize_chantier(new_chantier)), 201
    except Exception as e:
        app.logger.error(f"Error creating chantier: {e}")
        return jsonify({"error": "Database operation failed"}), 500

@app.route('/api/chantiers/<string:chantier_id>', methods=['GET'])
def get_chantier(chantier_id):
    """Get a single chantier by ID"""
    if chantiers_collection is None:
        return jsonify({"error": "Database connection not available"}), 500
    
    try:
        # Validate ObjectId format
        try:
            object_id = ObjectId(chantier_id)
        except InvalidId:
            return jsonify({"error": "Invalid chantier ID format"}), 400
            
        # Find the chantier
        chantier = chantiers_collection.find_one({"_id": object_id})
        
        if not chantier:
            return jsonify({"error": f"Chantier with ID {chantier_id} not found"}), 404
            
        return jsonify(serialize_chantier(chantier))
    except Exception as e:
        app.logger.error(f"Error fetching chantier {chantier_id}: {e}")
        return jsonify({"error": f"Database operation failed: {str(e)}"}), 500

@app.route('/api/chantiers/<string:chantier_id>', methods=['PUT'])
def update_chantier(chantier_id):
    """Update a chantier by ID"""
    if chantiers_collection is None:
        return jsonify({"error": "Database connection not available"}), 500

    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400

    # Validate ObjectId format
    try:
        object_id = ObjectId(chantier_id)
    except InvalidId:
        return jsonify({"error": "Invalid chantier ID format"}), 400

    # Prepare update data, excluding _id and ensuring updatedAt is set
    update_data = {k: v for k, v in data.items() if k != '_id'}
    update_data['updatedAt'] = datetime.utcnow()

    # Explicitly handle fields, including email
    update_payload = {
        "title": data.get('title', '').strip(),
        "description": data.get('description', '').strip(),
        "startDate": data.get('startDate'),
        "endDate": data.get('endDate'),
        "status": data.get('status'),
        "estimatedDuration": data.get('estimatedDuration'),
        "urgency": data.get('urgency'),
        "address": data.get('address', '').strip(),
        "contactPhone": data.get('contactPhone', '').strip(),
        "contactEmail": data.get('contactEmail', '').strip(), # Add email
        "assignees": data.get('assignees', []), # Expecting an array
        "devis": data.get('devis', '').strip(),
        "images": data.get('images', '[]'), # Store as JSON string
        "pdfs": data.get('pdfs', '[]'), # Store as JSON string
        "parentChantierId": data.get('parentChantierId'),
        "updatedAt": datetime.utcnow()
    }

    # Remove fields that were not provided in the request to avoid overwriting with None
    update_payload = {k: v for k, v in update_payload.items() if k in data}
    update_payload['updatedAt'] = datetime.utcnow() # Ensure updatedAt is always set

    try:
        # Check if the chantier exists first
        existing = chantiers_collection.find_one({"_id": object_id})
        if not existing:
            return jsonify({"error": f"Chantier with ID {chantier_id} not found"}), 404
            
        result = chantiers_collection.update_one(
            {"_id": object_id},
            {"$set": update_payload}
        )

        if result.matched_count == 0:
            return jsonify({"error": "Chantier not found"}), 404

        # Fetch the updated document to return
        updated_chantier = chantiers_collection.find_one({"_id": object_id})
        return jsonify(serialize_chantier(updated_chantier))
    except Exception as e:
        app.logger.error(f"Error updating chantier {chantier_id}: {e}")
        return jsonify({"error": f"Database operation failed: {str(e)}"}), 500

@app.route('/api/chantiers/<string:chantier_id>', methods=['DELETE'])
def delete_chantier(chantier_id):
    """Delete a chantier by ID"""
    if chantiers_collection is None:
        return jsonify({"error": "Database connection not available"}), 500
    
    try:
        # Validate ObjectId format
        try:
            object_id = ObjectId(chantier_id)
        except InvalidId:
            return jsonify({"error": "Invalid chantier ID format"}), 400
            
        # Check if the chantier exists first
        existing = chantiers_collection.find_one({"_id": object_id})
        if not existing:
            return jsonify({"error": f"Chantier with ID {chantier_id} not found"}), 404
            
        result = chantiers_collection.delete_one({"_id": object_id})

        if result.deleted_count == 0:
            return jsonify({"error": "Chantier not found"}), 404
        else:
            return jsonify({'message': 'Chantier deleted successfully', 'id': chantier_id}), 200
    except Exception as e:
        app.logger.error(f"Error deleting chantier {chantier_id}: {e}")
        return jsonify({"error": f"Database operation failed: {str(e)}"}), 500

@app.route('/api/chantiers/clear', methods=['DELETE'])
def clear_chantiers():
    if chantiers_collection is None:
        return jsonify({"error": "Database connection not available"}), 500
    try:
        result = chantiers_collection.delete_many({})
        return jsonify({'message': f'Successfully cleared {result.deleted_count} chantiers'}), 200
    except Exception as e:
        print(f"Error clearing chantiers: {e}")
        return jsonify({"error": "Failed to clear chantiers"}), 500

@app.route('/api/open-invoice', methods=['GET'])
def open_invoice_tool():
    """Open the invoice tool in a new process"""
    try:
        # Get the absolute path to the invoice tool
        invoice_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'INVOICE_DSMETAL', 'index.html')
        
        # Check if the file exists
        if not os.path.exists(invoice_path):
            return jsonify({"error": "Invoice tool not found"}), 404
            
        # Open the invoice tool
        if sys.platform.startswith('win'):
            os.startfile(invoice_path)
        else:
            import subprocess
            opener = 'open' if sys.platform == 'darwin' else 'xdg-open'
            subprocess.call([opener, invoice_path])
            
        return jsonify({"message": "Invoice tool opened successfully"}), 200
    except Exception as e:
        app.logger.error(f"Error opening invoice tool: {e}")
        return jsonify({"error": f"Failed to open invoice tool: {str(e)}"}), 500

@app.route('/api/clear-media', methods=['POST'])
def clear_all_media():
    """Clear all images and PDFs from all chantiers"""
    if chantiers_collection is None:
        return jsonify({"error": "Database connection not available"}), 500
    
    try:
        # Update all documents to have empty images and pdfs arrays
        result = chantiers_collection.update_many(
            {}, 
            {"$set": {"images": "[]", "pdfs": "[]"}}
        )
        
        return jsonify({
            "message": f"Successfully cleared media from {result.modified_count} chantiers",
            "modified_count": result.modified_count
        }), 200
    except Exception as e:
        app.logger.error(f"Error clearing media: {e}")
        return jsonify({"error": f"Failed to clear media: {str(e)}"}), 500

# Removed db.create_all() block
if __name__ == '__main__':
    # Check if connection was successful before running
    if chantiers_collection is not None:
        print("Starting Chantier Planning Tool...")
        print("Starting Flask server...")
        
        # Open the browser after a short delay
        def open_browser():
            time.sleep(2)
            print("Opening web browser...")
            webbrowser.open('http://127.0.0.1:5000')
        
        # Start browser opener in a separate thread
        browser_thread = threading.Thread(target=open_browser)
        browser_thread.daemon = True
        browser_thread.start()
        
        # Run the server in the main thread
        try:
            app.run(debug=False, use_reloader=False)
        except KeyboardInterrupt:
            print("\nShutting down server...")
            sys.exit(0)
    else:
        print("Failed to connect to MongoDB. Exiting...")
        sys.exit(1) 