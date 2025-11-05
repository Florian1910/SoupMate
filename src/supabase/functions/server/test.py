import psycopg2

try:
    conn = psycopg2.connect(
        host="brssalvqnbxgaiwmycpf.supabase.co",
        port="5432",
        dbname="postgres",
        user="postgres",
        password="sb_secret_dLj1CnOQ8sYmtlZV7ZKEvA_umH3GvFj"
    )
    print("Verbindung erfolgreich!")
    conn.close()
except Exception as e:
    print(f"Fehler bei der Verbindung: {e}")
