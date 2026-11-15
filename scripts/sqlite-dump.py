"""Dump the existing SQLite GameVault database to JSON so it can be
re-inserted into PostgreSQL (NeonDB-compatible) by seed-postgres.mjs."""
import json, sqlite3, datetime, pathlib

DB = "/home/z/my-project/db/custom.db"
OUT = "/home/z/my-project/scripts/sqlite-dump.json"

def conv(v):
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.isoformat()
    return v

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
tables = ["Game", "Genre", "Platform", "GameGenre", "GamePlatform", "LibraryEntry", "PlaySession"]
dump = {}
for t in tables:
    rows = [dict(r) for r in conn.execute(f"SELECT * FROM {t}")]
    dump[t] = [{k: conv(v) for k, v in row.items()} for row in rows]
    print(f"{t}: {len(dump[t])} rows")
pathlib.Path(OUT).write_text(json.dumps(dump, indent=1, default=str))
print("dumped →", OUT)
