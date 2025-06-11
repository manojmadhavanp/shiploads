// src/lib/fastFit.ts
import { CONTAINERS } from "./containers";
import { Item } from "./zodSchemas"; // Use the Zod Item schema

// Define the return type for fastFit more explicitly
export type FastFitResult =
  | { matched: true; plan: Array<{ type: string; count: number }>; justification: string; source: "algorithm" }
  | { matched: false; source: "algorithm" }; // No plan if not matched by fastFit

export function fastFit(items: Item[]): FastFitResult {
  let totalItemVolumeM3 = 0; // Corrected: Variable name to reflect meters
  let totalItemWeightKg = 0;

  if (items.length === 0) {
    return { matched: false, source: "algorithm" }; // No items, no match
  }

  for (const it of items) {
    // Item dimensions are in CM from Zod schema. Convert to Meters for volume calculation.
    const lengthM = it.length / 100;
    const widthM = it.width / 100;
    const heightM = it.height / 100;
    totalItemVolumeM3 += lengthM * widthM * heightM * it.quantity;
    totalItemWeightKg += it.weight * it.quantity;
  }

  // totalItemVolumeM3 is already in m³ due to conversion above.

  const plans = Object.entries(CONTAINERS).map(([type, caps]) => {
    // caps.volume is in m³, caps.weight is in kg
    const byVol = Math.ceil(totalItemVolumeM3 / caps.volume);
    const byWt = Math.ceil(totalItemWeightKg / caps.weight);
    return { type, count: Math.max(byVol, byWt) };
  });

  plans.sort((a, b) => {
    if (a.count !== b.count) {
        return a.count - b.count;
    }
    // Optional: If counts are equal, prefer smaller containers by predefined preference.
    const containerPreference = ["20ft", "40ft", "40ft HC"]; // Ensure these match keys in CONTAINERS
    return containerPreference.indexOf(a.type) - containerPreference.indexOf(b.type);
  });

  const best = plans[0];

  // Heuristic matches if it suggests exactly one container of any type.
  if (best && best.count === 1) {
    return {
      matched: true,
      plan: [{ type: best.type, count: best.count }],
      justification: `All items fit in one ${best.type} container (V: ${totalItemVolumeM3.toFixed(2)} m³ / W: ${totalItemWeightKg.toFixed(0)} kg). Calculated by fastFit heuristic.`,
      source: "algorithm",
    };
  }
  // If best.count is 0 (e.g. no items, though handled above) or > 1, fastFit doesn't match for a single container solution.
  return { matched: false, source: "algorithm" };
}
