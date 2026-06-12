import os
from flask import Flask, send_from_directory, request
from flask_socketio import SocketIO, emit
from pymongo import MongoClient
from dotenv import load_dotenv

# Load local environment variables if .env exists
load_dotenv()

app = Flask(__name__, static_folder='.')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'agency-secret!')
socketio = SocketIO(app, cors_allowed_origins="*")

# MongoDB connection from environment variable
MONGO_URI = os.environ.get('MONGODB_URI', 'mongodb://localhost:27017/')
client = MongoClient(MONGO_URI)
db = client['agency_db']
agency_state_collection = db['agency_state']

def get_current_state():
    state = agency_state_collection.find_one({"_id": "master_state"})
    if not state:
        return {}
    return state

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@socketio.on('connect')
def handle_connect():
    print('Client connected:', request.sid)
    # Send current state to the newly connected client
    state = get_current_state()
    # Remove the _id before sending to frontend
    if '_id' in state:
        del state['_id']
    emit('initialState', state)

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected:', request.sid)

@socketio.on('updateState')
def handle_update_state(new_state):
    print('State update received')
    # Save to MongoDB
    agency_state_collection.update_one(
        {"_id": "master_state"},
        {"$set": new_state},
        upsert=True
    )
    
    # Broadcast the updated state to all OTHER connected clients
    emit('stateUpdated', new_state, broadcast=True, include_self=False)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    print(f"Starting Agency Control Server on port {port}...")
    socketio.run(app, host='0.0.0.0', port=port, allow_unsafe_werkzeug=True)
