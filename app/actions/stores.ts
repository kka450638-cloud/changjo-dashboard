"use server";

import { createClient } from "@/lib/supabase/server";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "ChangjoDashboard/1.0";

export type AddStoreInput = {
  name: string;
  address: string;
  revenue: string;
  category: string;
};

export type AddStoreResult =
  | { success: true }
  | { success: false; error: "geocode_failed" | "insert_failed"; message?: string };

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    q: address,
    format: "json",
    limit: "1",
  });
  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const lat = parseFloat(data[0].lat);
  const lng = parseFloat(data[0].lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

export async function addStore(input: AddStoreInput): Promise<AddStoreResult> {
  const { name, address, revenue, category } = input;
  const coords = await geocodeAddress(address);
  if (!coords) {
    return { success: false, error: "geocode_failed", message: "정확한 주소를 입력해주세요" };
  }
  const supabase = createClient();
  const revenueNum = revenue === "" ? null : parseFloat(revenue);
  const { error } = await supabase.from("stores").insert({
    name: name.trim(),
    address: address.trim(),
    revenue: revenueNum,
    category: category.trim() || null,
    lat: coords.lat,
    lng: coords.lng,
  });
  if (error) {
    return { success: false, error: "insert_failed", message: error.message };
  }
  return { success: true };
}
