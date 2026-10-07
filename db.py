import sqlite3
from pathlib import Path
from werkzeug.security import generate_password_hash


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATABASE_PATH = DATA_DIR / "trek.db"


def get_db_connection():
    """
    Create and return a SQLite database connection.
    """
    DATA_DIR.mkdir(exist_ok=True)

    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")

    return connection


def init_db():
    """
    Create all required database tables programmatically.
    """

    connection = get_db_connection()

    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            phone TEXT,
            role TEXT NOT NULL CHECK (
                role IN ('Admin', 'Staff', 'Trekker')
            ),
            is_active INTEGER NOT NULL DEFAULT 1,
            is_blacklisted INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );


        CREATE TABLE IF NOT EXISTS treks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            location TEXT NOT NULL,
            difficulty TEXT NOT NULL,
            duration INTEGER NOT NULL,
            total_slots INTEGER NOT NULL,
            available_slots INTEGER NOT NULL,
            description TEXT,
            start_date TEXT,
            end_date TEXT,
            status TEXT NOT NULL DEFAULT 'Pending'
                CHECK (
                    status IN (
                        'Pending',
                        'Approved',
                        'Open',
                        'Closed',
                        'Completed'
                    )
                ),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );


        CREATE TABLE IF NOT EXISTS staff_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            staff_id INTEGER NOT NULL,
            trek_id INTEGER NOT NULL,
            assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (staff_id)
                REFERENCES users(id)
                ON DELETE CASCADE,

            FOREIGN KEY (trek_id)
                REFERENCES treks(id)
                ON DELETE CASCADE,

            UNIQUE(staff_id, trek_id)
        );


        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            trek_id INTEGER NOT NULL,
            booking_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            status TEXT NOT NULL DEFAULT 'Booked'
                CHECK (
                    status IN (
                        'Booked',
                        'Cancelled',
                        'Completed'
                    )
                ),
            payment_status TEXT NOT NULL DEFAULT 'Pending'
                CHECK (
                    payment_status IN (
                        'Pending',
                        'Paid'
                    )
                ),

            FOREIGN KEY (user_id)
                REFERENCES users(id)
                ON DELETE CASCADE,

            FOREIGN KEY (trek_id)
                REFERENCES treks(id)
                ON DELETE CASCADE,

            UNIQUE(user_id, trek_id)
        );
        """
    )

    create_default_admin(connection)

    connection.commit()
    connection.close()


def create_default_admin(connection):
    """
    Create exactly one default administrator if none exists.
    """

    existing_admin = connection.execute(
        """
        SELECT id
        FROM users
        WHERE role = 'Admin'
        LIMIT 1
        """
    ).fetchone()

    if existing_admin:
        return

    admin_password = generate_password_hash("admin123")

    connection.execute(
        """
        INSERT INTO users
        (
            name,
            email,
            password,
            phone,
            role
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            "System Administrator",
            "admin@trekking.com",
            admin_password,
            "",
            "Admin"
        )
        CREATE TABLE IF NOT EXISTS staff_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            experience TEXT,
            specialization TEXT,
            emergency_contact TEXT,
            address TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (user_id)
                REFERENCES users(id)
                ON DELETE CASCADE
        );
    )