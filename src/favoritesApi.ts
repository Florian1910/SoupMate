// src/favoritesApi.ts
import { API_CONFIG } from "./config";

export async function addFavorite(recipeId: string, accessToken: string) {
  const res = await fetch(
    `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.favorites}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ recipeId }),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error ?? "Failed to add favorite");
  }
}
