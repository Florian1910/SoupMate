# old

import os, psycopg2
from dotenv import load_dotenv
load_dotenv()
with psycopg2.connect(os.environ["SUPABASE_DB_URL"]) as conn:
    with conn.cursor() as cur:
        cur.execute("select current_user, current_database();")
        print(cur.fetchone())
print("OK ✅")
