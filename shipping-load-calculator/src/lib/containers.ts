// src/lib/containers.ts
export const CONTAINERS = {
  "20ft": { volume: 33, weight: 21700, length: 5.898, width: 2.352, height: 2.393 }, // m, m, m, m^3, kg
  "40ft": { volume: 67, weight: 26730, length: 12.032, width: 2.352, height: 2.393 },// m, m, m, m^3, kg
  "40ft HC": { volume: 76, weight: 26730, length: 12.032, width: 2.352, height: 2.698 }, // Added for potential use
  // "Open-Top 20ft": { volume: 32.6, weight: 21700, length: 5.898, width: 2.352, height: 2.348 },
};
// Note: Dimensions are in meters, volume in m³, weight in kg.
// Item dimensions from Zod/client are in cm, so conversion is needed.
