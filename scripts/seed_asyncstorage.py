"""Write a seed.json ({key: string value}) into a pulled React Native AsyncStorage DB (RKStorage).

    python seed_asyncstorage.py RKStorage seed.json            # replace all keys
    python seed_asyncstorage.py RKStorage seed.json --merge    # keep existing keys, upsert seed keys

Values must already be strings (JSON.stringify objects in the generator). Then push the file
back with `rk_push` from android.sh. Works for @react-native-async-storage/async-storage v1/v2
on Android unless the app enabled `AsyncStorage_useNextStorage` (check android/build.gradle).
"""
import json
import sqlite3
import sys

db_path, seed_path = sys.argv[1], sys.argv[2]
merge = "--merge" in sys.argv[3:]
seed = json.load(open(seed_path, encoding="utf-8"))
bad = [k for k, v in seed.items() if not isinstance(v, str)]
if bad:
    sys.exit(f"values must be strings (JSON.stringify them): {bad}")

con = sqlite3.connect(db_path)
con.execute("PRAGMA journal_mode=DELETE")
con.execute("CREATE TABLE IF NOT EXISTS catalystLocalStorage (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
if not merge:
    con.execute("DELETE FROM catalystLocalStorage")
con.executemany("INSERT OR REPLACE INTO catalystLocalStorage (key, value) VALUES (?, ?)", seed.items())
con.commit()
print("rows:", con.execute("SELECT count(*) FROM catalystLocalStorage").fetchone()[0])
con.close()
