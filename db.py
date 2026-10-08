import sqlite3
from pathlib import Path

from werkzeug.security import generate_password_hash


# ---------------------------------------------------------
# DATABASE PATH
# ---------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATABASE_PATH = DATA_DIR / "trek.db"


# ---------------------------------------------------------
# DATABASE CONNECTION
# ---------------------------------------------------------

def get_db_connection():
    """
    Create and return SQLite database connection.
    """

    DATA_DIR.mkdir(exist_ok=True)

    connection = sqlite3.connect(DATABASE_PATH)

    # Allows rows to be accessed like:
    # user["name"] instead of user[1]
    connection.row_factory = sqlite3.Row

    # Enable foreign key support in SQLite
    connection.execute("PRAGMA foreign_keys = ON")

    return connection


# ---------------------------------------------------------
# DATABASE INITIALIZATION
# ---------------------------------------------------------

def init_db():
    """
    Create all database tables programmatically.
    """

    connection = get_db_connection()

    connection.executescript(
        """

        ------------------------------------------------------------
        -- USERS
        ------------------------------------------------------------

        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            name TEXT NOT NULL,

            email TEXT NOT NULL UNIQUE,

            password TEXT NOT NULL,

            phone TEXT,

            role TEXT NOT NULL
                CHECK (
                    role IN (
                        'Admin',
                        'Staff',
                        'Trekker'
                    )
                ),

            is_active INTEGER NOT NULL DEFAULT 1
                CHECK (
                    is_active IN (0, 1)
                ),

            is_blacklisted INTEGER NOT NULL DEFAULT 0
                CHECK (
                    is_blacklisted IN (0, 1)
                ),

            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );


        ------------------------------------------------------------
        -- STAFF PROFILE
        ------------------------------------------------------------

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


        ------------------------------------------------------------
        -- TREKS
        ------------------------------------------------------------

        CREATE TABLE IF NOT EXISTS treks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            name TEXT NOT NULL,

            location TEXT NOT NULL,

            difficulty TEXT NOT NULL,

            duration INTEGER NOT NULL
                CHECK (
                    duration > 0
                ),

            total_slots INTEGER NOT NULL
                CHECK (
                    total_slots >= 0
                ),

            available_slots INTEGER NOT NULL
                CHECK (
                    available_slots >= 0
                ),

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
                        'Ongoing',
                        'Completed'
                    )
                ),

            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );


        ------------------------------------------------------------
        -- STAFF ASSIGNMENTS
        ------------------------------------------------------------

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


        ------------------------------------------------------------
        -- BOOKINGS
        ------------------------------------------------------------

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
                ON DELETE CASCADE
        );


        ------------------------------------------------------------
        -- INDEXES
        ------------------------------------------------------------

        CREATE INDEX IF NOT EXISTS idx_users_email
        ON users(email);


        CREATE INDEX IF NOT EXISTS idx_treks_status
        ON treks(status);


        CREATE INDEX IF NOT EXISTS idx_bookings_user
        ON bookings(user_id);


        CREATE INDEX IF NOT EXISTS idx_bookings_trek
        ON bookings(trek_id);


        CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_booking
        ON bookings(user_id, trek_id)
        WHERE status = 'Booked';

        """
    )

    create_default_admin(connection)

    connection.commit()
    connection.close()


# ---------------------------------------------------------
# DEFAULT ADMIN
# ---------------------------------------------------------

def create_default_admin(connection):
    """
    Create one default administrator if no Admin exists.
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

    hashed_password = generate_password_hash("admin123")

    connection.execute(
        """
        INSERT INTO users
        (
            name,
            email,
            password,
            phone,
            role,
            is_active,
            is_blacklisted
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "System Administrator",
            "admin@trekking.com",
            hashed_password,
            "",
            "Admin",
            1,
            0
        )
    )