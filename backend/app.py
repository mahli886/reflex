from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
from datetime import datetime

app = Flask(__name__)
CORS(app)

DATABASE = "reflex.db"


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            role TEXT NOT NULL
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS deliveries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            address TEXT NOT NULL,
            item_description TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'OPEN',
            rider_id INTEGER,
            confirmation_code TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS status_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            delivery_id INTEGER NOT NULL,
            status TEXT NOT NULL,
            changed_by INTEGER,
            timestamp TEXT NOT NULL
        )
    """)

    # Add demo riders
    existing = conn.execute(
        "SELECT COUNT(*) as count FROM users WHERE role = 'RIDER'"
    ).fetchone()["count"]

    if existing == 0:
        conn.execute(
            "INSERT INTO users (name, role) VALUES (?, ?)",
            ("John Rider", "RIDER")
        )

        conn.execute(
            "INSERT INTO users (name, role) VALUES (?, ?)",
            ("Peter Rider", "RIDER")
        )

    conn.commit()
    conn.close()


@app.route("/")
def home():
    return jsonify({
        "message": "Reflex API is running"
    })


@app.route("/api/deliveries", methods=["GET"])
def get_deliveries():
    conn = get_db()

    deliveries = conn.execute("""
        SELECT
            deliveries.*,
            users.name AS rider_name
        FROM deliveries
        LEFT JOIN users ON deliveries.rider_id = users.id
        ORDER BY deliveries.id DESC
    """).fetchall()

    conn.close()

    return jsonify([dict(row) for row in deliveries])


@app.route("/api/deliveries", methods=["POST"])
def create_delivery():
    data = request.get_json()

    required = [
        "customer_name",
        "customer_phone",
        "address",
        "item_description"
    ]

    for field in required:
        if not data.get(field):
            return jsonify({
                "error": f"{field} is required"
            }), 400

    now = datetime.now().isoformat()
    confirmation_code = f"REFLEX-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    conn = get_db()

    cursor = conn.execute("""
        INSERT INTO deliveries (
            customer_name,
            customer_phone,
            address,
            item_description,
            status,
            confirmation_code,
            created_at,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data["customer_name"],
        data["customer_phone"],
        data["address"],
        data["item_description"],
        "OPEN",
        confirmation_code,
        now,
        now
    ))

    delivery_id = cursor.lastrowid

    conn.execute("""
        INSERT INTO status_history (
            delivery_id,
            status,
            timestamp
        )
        VALUES (?, ?, ?)
    """, (
        delivery_id,
        "OPEN",
        now
    ))

    conn.commit()
    conn.close()

    return jsonify({
        "message": "Delivery created",
        "delivery_id": delivery_id,
        "confirmation_code": confirmation_code
    }), 201


@app.route("/api/riders", methods=["GET"])
def get_riders():
    conn = get_db()

    riders = conn.execute("""
        SELECT id, name
        FROM users
        WHERE role = 'RIDER'
    """).fetchall()

    conn.close()

    return jsonify([dict(row) for row in riders])


@app.route("/api/deliveries/<int:delivery_id>/assign", methods=["PUT"])
def assign_delivery(delivery_id):
    data = request.get_json()
    rider_id = data.get("rider_id")

    if not rider_id:
        return jsonify({"error": "rider_id is required"}), 400

    conn = get_db()

    delivery = conn.execute(
        "SELECT * FROM deliveries WHERE id = ?",
        (delivery_id,)
    ).fetchone()

    if not delivery:
        conn.close()
        return jsonify({"error": "Delivery not found"}), 404

    if delivery["status"] != "OPEN":
        conn.close()
        return jsonify({
            "error": "Delivery has already been assigned"
        }), 409

    rider = conn.execute(
        "SELECT * FROM users WHERE id = ? AND role = 'RIDER'",
        (rider_id,)
    ).fetchone()

    if not rider:
        conn.close()
        return jsonify({"error": "Rider not found"}), 404

    now = datetime.now().isoformat()

    conn.execute("""
        UPDATE deliveries
        SET rider_id = ?,
            status = 'ASSIGNED',
            updated_at = ?
        WHERE id = ?
    """, (
        rider_id,
        now,
        delivery_id
    ))

    conn.execute("""
        INSERT INTO status_history (
            delivery_id,
            status,
            changed_by,
            timestamp
        )
        VALUES (?, ?, ?, ?)
    """, (
        delivery_id,
        "ASSIGNED",
        rider_id,
        now
    ))

    conn.commit()
    conn.close()

    return jsonify({
        "message": "Delivery assigned successfully"
    })


@app.route("/api/deliveries/<int:delivery_id>/status", methods=["PUT"])
def update_status(delivery_id):
    data = request.get_json()

    new_status = data.get("status")
    rider_id = data.get("rider_id")

    allowed_statuses = {
        "ASSIGNED": ["PICKED_UP"],
        "PICKED_UP": ["DELIVERED"]
    }

    conn = get_db()

    delivery = conn.execute(
        "SELECT * FROM deliveries WHERE id = ?",
        (delivery_id,)
    ).fetchone()

    if not delivery:
        conn.close()
        return jsonify({"error": "Delivery not found"}), 404

    if delivery["rider_id"] != rider_id:
        conn.close()
        return jsonify({
            "error": "This delivery is assigned to another rider"
        }), 403

    current_status = delivery["status"]

    if new_status not in allowed_statuses.get(current_status, []):
        conn.close()
        return jsonify({
            "error": f"Cannot change status from {current_status} to {new_status}"
        }), 400

    now = datetime.now().isoformat()

    conn.execute("""
        UPDATE deliveries
        SET status = ?,
            updated_at = ?
        WHERE id = ?
    """, (
        new_status,
        now,
        delivery_id
    ))

    conn.execute("""
        INSERT INTO status_history (
            delivery_id,
            status,
            changed_by,
            timestamp
        )
        VALUES (?, ?, ?, ?)
    """, (
        delivery_id,
        new_status,
        rider_id,
        now
    ))

    conn.commit()
    conn.close()

    return jsonify({
        "message": "Status updated",
        "status": new_status
    })


@app.route("/api/deliveries/<int:delivery_id>/confirm", methods=["POST"])
def confirm_delivery(delivery_id):
    data = request.get_json()
    code = data.get("confirmation_code")

    conn = get_db()

    delivery = conn.execute(
        "SELECT * FROM deliveries WHERE id = ?",
        (delivery_id,)
    ).fetchone()

    if not delivery:
        conn.close()
        return jsonify({"error": "Delivery not found"}), 404

    if delivery["status"] != "DELIVERED":
        conn.close()
        return jsonify({
            "error": "Delivery must be marked DELIVERED first"
        }), 400

    if code != delivery["confirmation_code"]:
        conn.close()
        return jsonify({
            "error": "Invalid confirmation code"
        }), 403

    now = datetime.now().isoformat()

    conn.execute("""
        UPDATE deliveries
        SET status = 'CONFIRMED',
            updated_at = ?
        WHERE id = ?
    """, (
        now,
        delivery_id
    ))

    conn.execute("""
        INSERT INTO status_history (
            delivery_id,
            status,
            timestamp
        )
        VALUES (?, ?, ?)
    """, (
        delivery_id,
        "CONFIRMED",
        now
    ))

    conn.commit()
    conn.close()

    return jsonify({
        "message": "Delivery confirmed"
    })


@app.route("/api/deliveries/<int:delivery_id>/history", methods=["GET"])
def get_history(delivery_id):
    conn = get_db()

    history = conn.execute("""
        SELECT *
        FROM status_history
        WHERE delivery_id = ?
        ORDER BY timestamp ASC
    """, (delivery_id,)).fetchall()

    conn.close()

    return jsonify([dict(row) for row in history])


if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)