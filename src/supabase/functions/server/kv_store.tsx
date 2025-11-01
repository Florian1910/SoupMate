/* AUTOGENERIERTE DATEI - NICHT BEARBEITEN */

import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

// Supabase-Client erstellen
const client = () => createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
);

// Setzt ein Schlüssel-Wert-Paar in der KV-Datenbank
export const set = async (key: string, value: any): Promise<void> => {
    const supabase = client();
    const { error } = await supabase.from("kv_store_b187574e").upsert({
        key,
        value
    });
    if (error) {
        throw new Error(error.message);
    }
};

// Holt ein Schlüssel-Wert-Paar aus der KV-Datenbank
export const get = async (key: string): Promise<any> => {
    const supabase = client();
    const { data, error } = await supabase.from("kv_store_b187574e").select("value").eq("key", key).maybeSingle();
    if (error) {
        throw new Error(error.message);
    }
    return data?.value;
};

// Löscht ein Schlüssel-Wert-Paar aus der KV-Datenbank
export const del = async (key: string): Promise<void> => {
    const supabase = client();
    const { error } = await supabase.from("kv_store_b187574e").delete().eq("key", key);
    if (error) {
        throw new Error(error.message);
    }
};

// Setzt mehrere Schlüssel-Wert-Paare in der KV-Datenbank
export const mset = async (keys: string[], values: any[]): Promise<void> => {
    const supabase = client();
    const { error } = await supabase.from("kv_store_b187574e").upsert(keys.map((k, i) => ({ key: k, value: values[i] })));
    if (error) {
        throw new Error(error.message);
    }
};

// Holt mehrere Schlüssel-Wert-Paare aus der KV-Datenbank
export const mget = async (keys: string[]): Promise<any[]> => {
    const supabase = client();
    const { data, error } = await supabase.from("kv_store_b187574e").select("value").in("key", keys);
    if (error) {
        throw new Error(error.message);
    }
    return data?.map((d) => d.value) ?? [];
};

// Löscht mehrere Schlüssel-Wert-Paare aus der KV-Datenbank
export const mdel = async (keys: string[]): Promise<void> => {
    const supabase = client();
    const { error } = await supabase.from("kv_store_b187574e").delete().in("key", keys);
    if (error) {
        throw new Error(error.message);
    }
};

// Sucht nach Schlüssel-Wert-Paaren mit einem Präfix
export const getByPrefix = async (prefix: string): Promise<any[]> => {
    const supabase = client();
    const { data, error } = await supabase.from("kv_store_b187574e").select("key, value").like("key", prefix + "%");
    if (error) {
        throw new Error(error.message);
    }
    return data?.map((d) => d.value) ?? [];
};
