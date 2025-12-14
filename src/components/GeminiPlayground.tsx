import { useState } from "react";
import { geminiComplete } from "../services/gemini";

export default function GeminiPlayground() {
    const [prompt, setPrompt] = useState("Sag mir einen Fun Fact über Suppe.");
    const [answer, setAnswer] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function run() {
        setLoading(true); setError(null);
        try { setAnswer(await geminiComplete(prompt)); }
        catch (e:any) { setError(e?.message ?? "Unbekannter Fehler"); }
        finally { setLoading(false); }
    }

    return (
        <div style={{ border: "1px solid #333", padding: 12, borderRadius: 8, marginTop: 16 }}>
            <h3>Gemini Test</h3>
            <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} rows={4} style={{width:"100%"}} />
            <div style={{ marginTop: 8 }}>
                <button onClick={run} disabled={loading}>{loading ? "Frage…" : "Abschicken"}</button>
            </div>
            {error && <p style={{ color: "crimson" }}>{error}</p>}
            {answer && <div style={{ whiteSpace:"pre-wrap", marginTop:8 }}><strong>Antwort:</strong> {answer}</div>}
        </div>
    );
}
