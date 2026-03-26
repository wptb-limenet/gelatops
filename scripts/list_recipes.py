#!/usr/bin/env python3
"""
list_recipes.py — List all recipes and their IDs from the gelatops PostgreSQL database.

Usage:
    python3 list_recipes.py

Dependencies:
    pip install psycopg2-binary

Credentials — set one of the following before running:

  Option A: Full connection string
    export DATABASE_URL=postgres://user:password@host:5432/dbname

  Option B: Individual variables
    export DB_HOST=your-db-host
    export DB_PORT=5432
    export DB_USER=your-db-user
    export DB_PASSWORD=your-db-password
    export DB_NAME=your-db-name

Note: If your recipes table or column names differ, update TABLE and COLUMNS below.
"""

import os
import sys

# --- Adjust these if your schema differs ---
TABLE = "recipes"
ID_COLUMN = "id"
NAME_COLUMN = "name"
# -------------------------------------------

try:
    import psycopg2
except ImportError:
    print("Error: psycopg2 is not installed.")
    print("Run: pip install psycopg2-binary")
    sys.exit(1)


def get_connection():
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        return psycopg2.connect(database_url)

    host = os.environ.get("DB_HOST")
    port = os.environ.get("DB_PORT", "5432")
    user = os.environ.get("DB_USER")
    password = os.environ.get("DB_PASSWORD")
    dbname = os.environ.get("DB_NAME")

    if not all([host, user, password, dbname]):
        print("Error: No database credentials found.")
        print()
        print("Set either:")
        print("  export DATABASE_URL=postgres://user:password@host:5432/dbname")
        print("Or all of:")
        print("  export DB_HOST=...")
        print("  export DB_USER=...")
        print("  export DB_PASSWORD=...")
        print("  export DB_NAME=...")
        sys.exit(1)

    return psycopg2.connect(host=host, port=port, user=user, password=password, dbname=dbname)


def main():
    try:
        conn = get_connection()
    except psycopg2.OperationalError as e:
        print(f"Error: Could not connect to the database.\n{e}")
        sys.exit(1)

    try:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {ID_COLUMN}, {NAME_COLUMN} FROM {TABLE} ORDER BY {NAME_COLUMN};"
            )
            rows = cur.fetchall()
    except psycopg2.Error as e:
        print(f"Error: Query failed.\n{e}")
        conn.close()
        sys.exit(1)

    conn.close()

    if not rows:
        print("No recipes found.")
        return

    # Calculate column widths
    id_width = max(len(str(row[0])) for row in rows)
    id_width = max(id_width, 2)  # minimum width for "ID" header
    name_width = max(len(str(row[1])) for row in rows)
    name_width = max(name_width, 4)  # minimum width for "Name" header

    header = f"{'ID':<{id_width}}  {'Name':<{name_width}}"
    divider = f"{'-' * id_width}  {'-' * name_width}"

    print(header)
    print(divider)
    for row_id, row_name in rows:
        print(f"{str(row_id):<{id_width}}  {row_name}")

    print()
    print(f"{len(rows)} recipe{'s' if len(rows) != 1 else ''} found.")


if __name__ == "__main__":
    main()
