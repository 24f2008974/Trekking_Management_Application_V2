import os
import sqlite3
from pathlib import Path

from werkzeug.security import generate_password_hash


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

_default_database = DATA_DIR / "trek.db"

DATABASE_PATH = Path(
    os.getenv(
        "TMA_DATABASE_PATH",
        str(_default_database)
    )
).expanduser().resolve()


def get_db_connection():
    """
    Return a SQLite connection with row access
    and foreign-key checks enabled.
    """

    DATABASE_PATH.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    connection = sqlite3.connect(
        DATABASE_PATH,
        timeout=10
    )

    connection.row_factory = sqlite3.Row

    connection.execute(
        "PRAGMA foreign_keys = ON"
    )

    connection.execute(
        "PRAGMA busy_timeout = 10000"
    )

    return connection


def init_db():
    """
    Create complete application database schema
    programmatically.
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
        -- STAFF PROFILES
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

            difficulty TEXT NOT NULL
                CHECK (
                    difficulty IN (
                        'Easy',
                        'Moderate',
                        'Hard'
                    )
                ),

            duration INTEGER NOT NULL
                CHECK (
                    duration > 0
                ),

            total_slots INTEGER NOT NULL
                CHECK (
                    total_slots > 0
                ),

            available_slots INTEGER NOT NULL
                CHECK (
                    available_slots >= 0
                    AND available_slots <= total_slots
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

            UNIQUE(
                staff_id,
                trek_id
            )
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
        -- IN-APP NOTIFICATIONS
        ------------------------------------------------------------

        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            user_id INTEGER NOT NULL,

            title TEXT NOT NULL,

            message TEXT NOT NULL,

            notification_type TEXT NOT NULL DEFAULT 'General',

            is_read INTEGER NOT NULL DEFAULT 0
                CHECK (
                    is_read IN (0, 1)
                ),

            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (user_id)
                REFERENCES users(id)
                ON DELETE CASCADE
        );


        ------------------------------------------------------------
        -- ASYNC EXPORT JOBS
        ------------------------------------------------------------

        CREATE TABLE IF NOT EXISTS export_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            user_id INTEGER NOT NULL,

            celery_task_id TEXT,

            status TEXT NOT NULL DEFAULT 'Pending'
                CHECK (
                    status IN (
                        'Pending',
                        'Processing',
                        'Completed',
                        'Failed'
                    )
                ),

            file_name TEXT,

            error_message TEXT,

            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

            completed_at TEXT,

            FOREIGN KEY (user_id)
                REFERENCES users(id)
                ON DELETE CASCADE
        );


        ------------------------------------------------------------
        -- INDEXES
        ------------------------------------------------------------

        CREATE INDEX IF NOT EXISTS idx_users_email
            ON users(email);


        CREATE INDEX IF NOT EXISTS idx_users_role
            ON users(role);


        CREATE INDEX IF NOT EXISTS idx_treks_status
            ON treks(status);


        CREATE INDEX IF NOT EXISTS idx_treks_location
            ON treks(location);


        CREATE INDEX IF NOT EXISTS idx_bookings_user
            ON bookings(user_id);


        CREATE INDEX IF NOT EXISTS idx_bookings_trek
            ON bookings(trek_id);


        CREATE INDEX IF NOT EXISTS idx_bookings_status
            ON bookings(status);


        CREATE INDEX IF NOT EXISTS idx_notifications_user
            ON notifications(
                user_id,
                is_read
            );


        CREATE INDEX IF NOT EXISTS idx_export_jobs_user
            ON export_jobs(
                user_id,
                status
            );


        CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_booking
            ON bookings(
                user_id,
                trek_id
            )
            WHERE status = 'Booked';

        """
    )

    create_default_admin(
        connection
    )

    connection.commit()

    connection.close()


def create_default_admin(
    connection
):
    """
    Create predefined Admin account
    when no Admin exists.
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


    admin_email = os.getenv(
        "TMA_ADMIN_EMAIL",
        "admin@trekking.com"
    ).strip().lower()


    admin_password = os.getenv(
        "TMA_ADMIN_PASSWORD",
        "admin123"
    )


    hashed_password = generate_password_hash(
        admin_password
    )


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

        VALUES (
            ?,
            ?,
            ?,
            ?,
            'Admin',
            1,
            0
        )
        """,
        (
            "System Administrator",
            admin_email,
            hashed_password,
            ""
        )
    )