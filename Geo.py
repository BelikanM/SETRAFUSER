# -*- coding: utf-8 -*-
"""
Geo.py
Serveur Flask + SocketIO pour suivre les utilisateurs en temps réel
et afficher leurs positions sur une carte Folium.
"""

from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
from pymongo import MongoClient
import folium
from threading import Thread
import time
import os

# =========================
# Config MongoDB
# =========================
MONGO_URI = "mongodb+srv://SETRAF:Dieu19961991%3F%3F%21%3F%3F%21@cluster0.5tjz9v0.mongodb.net/myDatabase?retryWrites=true&w=majority"
client = MongoClient(MONGO_URI)
db = client.get_database()
users_collection = db["users"]  # Collection utilisateurs

# =========================
# Flask & SocketIO
# =========================
app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

# =========================
# Carte Folium (base)
# =========================
MAP_FILE = "templates/map.html"

def create_map():
    """Créer une carte de base centrée sur l'Afrique"""
    m = folium.Map(location=[0, 0], zoom_start=2)
    m.save(MAP_FILE)

# =========================
# Routes Flask
# =========================
@app.route('/')
def index():
    """Affiche la carte avec les utilisateurs"""
    return render_template('map.html')

@app.route('/update-position', methods=['POST'])
def update_position():
    """API pour mettre à jour la position d'un utilisateur"""
    data = request.json
    user_id = data.get('user_id')
    lat = data.get('lat')
    lng = data.get('lng')
    accuracy = data.get('accuracy', 0)

    if not user_id or lat is None or lng is None:
        return jsonify({"status": "error", "message": "Paramètres manquants"}), 400

    users_collection.update_one(
        {"_id": user_id},
        {"$set": {"lastLocation": {"lat": lat, "lng": lng, "accuracy": accuracy},
                  "isOnline": True,
                  "lastSeen": time.time()}},
        upsert=True
    )

    # Émettre la mise à jour à tous les clients connectés
    socketio.emit('location-update', {
        "user_id": user_id,
        "lat": lat,
        "lng": lng,
        "accuracy": accuracy
    })
    return jsonify({"status": "success"})


@app.route('/get-users', methods=['GET'])
def get_users():
    """Retourne tous les utilisateurs avec leurs positions"""
    users = list(users_collection.find({}, {"_id": 1, "lastLocation": 1, "isOnline": 1}))
    for u in users:
        if "_id" in u:
            u["user_id"] = str(u["_id"])
            del u["_id"]
    return jsonify(users)

# =========================
# SocketIO Events
# =========================
@socketio.on('connect')
def handle_connect():
    print(f"Client connecté: {request.sid}")
    emit('message', {'msg': 'Connexion établie'})

@socketio.on('disconnect')
def handle_disconnect():
    print(f"Client déconnecté: {request.sid}")

# =========================
# Mise à jour automatique de la carte
# =========================
def update_map_loop():
    while True:
        users = list(users_collection.find({}, {"_id": 1, "lastLocation": 1}))
        if users:
            m = folium.Map(location=[0, 0], zoom_start=2)
            for u in users:
                loc = u.get("lastLocation")
                if loc and "lat" in loc and "lng" in loc:
                    folium.Marker(
                        location=[loc["lat"], loc["lng"]],
                        popup=f"User: {u['_id']}",
                        icon=folium.Icon(color="green" if u.get("isOnline") else "red")
                    ).add_to(m)
            m.save(MAP_FILE)
        time.sleep(5)  # actualiser toutes les 5 secondes

# =========================
# Main
# =========================
if __name__ == '__main__':
    os.makedirs("templates", exist_ok=True)
    create_map()
    # Lancer le thread pour mise à jour de la carte
    t = Thread(target=update_map_loop)
    t.daemon = True
    t.start()
    # Démarrer Flask + SocketIO
    socketio.run(app, host='0.0.0.0', port=5050)
