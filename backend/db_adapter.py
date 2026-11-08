"""Keep local SQLite support while using transactional Postgres in production."""
import os
import re
import sqlite3
from pathlib import Path


class Row(dict):
    def __getitem__(self, key):
        return tuple(self.values())[key] if isinstance(key, int) else super().__getitem__(key)


def row_factory(cursor):
    names = [column.name for column in cursor.description] if cursor.description else []
    return lambda values: Row(zip(names, values))


class PostgresCursor:
    def __init__(self, cursor):
        self.cursor = cursor
        self.lastrowid = None

    def execute(self, statement, parameters=()):
        sql = statement.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
        sql = re.sub(r"ADD COLUMN(?! IF NOT EXISTS)", "ADD COLUMN IF NOT EXISTS", sql)
        sql = sql.replace("?", "%s")
        inserted = bool(re.match(r"\s*INSERT\s+INTO\s", sql, re.I)) and "RETURNING" not in sql.upper()
        if inserted:
            sql = sql.rstrip().rstrip(";") + " RETURNING id"
        try:
            self.cursor.execute(sql, parameters)
        except Exception as error:
            import psycopg
            if isinstance(error, psycopg.IntegrityError):
                raise sqlite3.IntegrityError("Data conflicts with an existing record") from error
            raise
        if inserted:
            row = self.cursor.fetchone()
            self.lastrowid = row[0] if row else None
        return self

    @property
    def rowcount(self):
        return self.cursor.rowcount

    def fetchone(self):
        return self.cursor.fetchone()

    def fetchall(self):
        return self.cursor.fetchall()

    def __iter__(self):
        return iter(self.cursor)


class PostgresConnection:
    def __init__(self, url):
        import psycopg
        self.connection = psycopg.connect(url, row_factory=row_factory, connect_timeout=15)

    def cursor(self):
        return PostgresCursor(self.connection.cursor())

    def execute(self, statement, parameters=()):
        return self.cursor().execute(statement, parameters)

    def commit(self):
        self.connection.commit()

    def rollback(self):
        self.connection.rollback()

    def close(self):
        self.connection.close()


def connect():
    url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
    if url:
        return PostgresConnection(url)
    if os.getenv("VERCEL"):
        raise RuntimeError("DATABASE_URL must be configured on Vercel")
    path = os.getenv("DATABASE_PATH", str(Path(__file__).with_name("profiler.db")))
    connection = sqlite3.connect(path, timeout=15)
    connection.row_factory = sqlite3.Row
    return connection


def ensure_column(connection, table, name, column_type):
    # All identifiers are fixed by application code, never supplied by a request.
    if isinstance(connection, PostgresConnection):
        connection.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {name} {column_type}")
    elif name not in [row["name"] for row in connection.execute(f"PRAGMA table_info({table})")]:
        connection.execute(f"ALTER TABLE {table} ADD COLUMN {name} {column_type}")
