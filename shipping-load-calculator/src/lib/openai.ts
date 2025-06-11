// src/lib/openai.ts
import OpenAI from 'openai';
import { ItemsArraySchema, Item, ItemSchema, CalculationPlanSchema, CalculationPlan } from './zodSchemas';

const apiKey = process.env.OPENAI_API_KEY;
let openaiInstance: OpenAI | null = null;

if (apiKey && apiKey !== "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" && apiKey !== "sk-dummy-key-for-type-checking") {
  openaiInstance = new OpenAI({ apiKey });
} else {
  console.warn("OpenAI API key is missing or is a placeholder. AI functionalities will use mock data or be disabled.");
}

const ITEM_EXTRACTION_SYSTEM_PROMPT = `You are a data extraction assistant for shipping manifests. Given the text content of a document listing shipped items, parse and output a JSON array of objects. Each object must have keys: "item_name", "length", "width", "height", "weight", "quantity". Optional keys with defaults: "stackable" (boolean, default: true), "tiltable" (boolean, default: false). Ensure all numerical values (length, width, height, weight, quantity) are numbers, not strings. If a numerical value is not found or clearly not applicable for an item, use a sensible default like 0 or 1 for quantity if appropriate, but strive to find actual values. Output ONLY the JSON array, even if it's empty. If the entire document seems unrelated to a list of items, output an empty JSON array.`;

export async function extractItems(rawText: string): Promise<Item[]> {
  if (!openaiInstance) {
    console.warn("extractItems: OpenAI client not initialized. Using mock data.");
    if (!rawText.trim()) return [];
    try {
      return ItemsArraySchema.parse([
        { item_name: "Mock Extracted Item 1", length: 10, width: 10, height: 10, weight: 5, quantity: 2, stackable: true, tiltable: false },
        { item_name: "Mock Extracted Item 2", length: 20, width: 15, height: 5, weight: 3, quantity: 1, stackable: false, tiltable: true },
      ]);
    } catch (e) { console.error("Mock data parsing error (extractItems):", e); return []; }
  }
  if (!rawText.trim()) { console.log("extractItems: Empty raw text."); return []; }
  console.log("extractItems: Calling OpenAI with raw text (first 100 chars):", rawText.substring(0, 100));
  try {
    const response = await openaiInstance.chat.completions.create({ model: "gpt-4o-mini", messages: [ { role: "system", content: ITEM_EXTRACTION_SYSTEM_PROMPT }, { role: "user", content: rawText }, ], temperature: 0.1, response_format: { type: "json_object" }, });
    const jsonString = response.choices[0]?.message?.content;
    if (!jsonString) throw new Error("OpenAI returned empty response for item extraction.");
    let parsedJson = JSON.parse(jsonString);
    let itemsArray = Array.isArray(parsedJson) ? parsedJson : (parsedJson && typeof parsedJson === 'object' && Array.isArray(parsedJson.items)) ? parsedJson.items : null;
    if (itemsArray === null) { // Check if it's an object with other potential keys for items
        const potentialKeys = ['extracted_items', 'data', 'results', 'list'];
        const foundKey = potentialKeys.find(key => Array.isArray((parsedJson as any)[key]));
        if (foundKey) itemsArray = (parsedJson as any)[foundKey];
        else throw new Error("OpenAI response is not valid item array structure (no known wrapper key).");
    }
    const validationResult = ItemsArraySchema.safeParse(itemsArray);
    if (!validationResult.success) {
      console.error("extractItems: Zod validation failed.", validationResult.error.flatten().fieldErrors);
      const validItems: Item[] = [];
      if (Array.isArray(itemsArray)) {
        itemsArray.forEach(item => { const singleItemCheck = ItemSchema.safeParse(item); if (singleItemCheck.success) validItems.push(singleItemCheck.data); else console.warn("extractItems: Discarding invalid item:", item, "Error:", singleItemCheck.error.flatten().fieldErrors); });
      }
      if (validItems.length > 0) { console.warn(`extractItems: Returning ${validItems.length} valid items out of ${itemsArray.length}.`); return validItems; }
      throw new Error(`Invalid data structure from OpenAI: ${validationResult.error.message}`);
    }
    return validationResult.data;
  } catch (error) { console.error("Error in extractItems:", error); if (error instanceof OpenAI.APIError) throw new Error(`OpenAI API Error (${error.status}): ${error.message}`); throw error; }
}

const CONTAINER_CALCULATION_SYSTEM_PROMPT = `You are a logistics planning assistant. You are provided with a JSON array of items, each with item_name, length (cm), width (cm), height (cm), weight (kg), quantity, stackable (boolean), and tiltable (boolean).
Available container types and their **internal usable dimensions & max payload**:
- 20ft Standard Dry: L=5.9m, W=2.35m, H=2.39m (approx. 33 m³), Max Payload: ~21,700 kg
- 40ft Standard Dry: L=12.03m, W=2.35m, H=2.39m (approx. 67 m³), Max Payload: ~26,700 kg
- 40ft High Cube (HC): L=12.03m, W=2.35m, H=2.70m (approx. 76 m³), Max Payload: ~26,700 kg
- (Note: For simplicity, assume Open-Top has similar internal capacity to 20ft/40ft but affects stacking of items within it if they are fragile or if items are stacked on top of it. If 'Open-Top' is chosen, its main benefit is top-loading, not necessarily different capacity for this exercise unless items are very tall. For this task, focus on the dry containers unless item height absolutely requires Open-Top and it cannot be tilted.)

Your goal is to plan the minimal number and types of containers to efficiently and safely hold all items.
Key considerations:
1.  **Weight Limits**: DO NOT exceed the max payload for any container.
2.  **Volume Limits**: While exact 3D bin packing is complex, ensure total item volume (sum of individual item volumes) fits. Try to achieve good volumetric utilization.
3.  **Stackability**: If an item is 'stackable: false', it cannot have other items stacked on top of it, nor can it be stacked on others (assume it's fragile or its packaging doesn't allow). If 'stackable: true', it can be stacked respecting its own structural integrity (not explicitly modeled here, but don't stack excessively heavy items on much lighter ones if possible).
4.  **Tiltability**: If 'tiltable: false', the item must maintain its upright orientation (length is length, width is width, height is height). If 'tiltable: true', it can be re-oriented (e.g., length becomes height) if that helps it fit, but clearly state if an item is tilted. Dimensions provided are for its standard orientation.
5.  **Quantity**: Distribute all quantities of each item across the suggested containers.

Output ONLY a valid JSON array, where each object represents a *type* of container used and its details. Each object in the array must conform to this structure:
{
  "type": "string", // e.g., "20ft Standard Dry", "40ft High Cube"
  "count": number, // How many containers of this type are needed
  "items": [ { "item_name": "string", "quantity": number } ], // List of items (and their quantities) assigned to *one* container of this type. If count > 1, this list is for one representative container.
  "justification": "string" // Brief explanation for choosing this container type and count, and any key packing assumptions (e.g., items tilted, stacking notes).
}
Ensure all numbers (count, quantity) are actual numbers. If an item is split across multiple containers of the same type, list its quantity for one container. If across different types, list it in each.
If no items are provided or no plan can be made, output an empty JSON array.
The input items list might contain items with the same name but different properties (treat them as distinct if their other properties differ, or aggregate if all properties are identical). The provided items are already distinct entries if their IDs differed, so use item_name as provided.
Focus on a practical plan. For example, don't suggest 100 x 20ft containers if a few 40ft would do. Minimize total container count and cost (assume larger containers are generally more cost-effective if well-utilized).
`

export async function calculateContainers(items: Item[]): Promise<CalculationPlan> {
  if (!openaiInstance) {
    console.warn("calculateContainers: OpenAI client not initialized. Using mock data.");
    if (items.length === 0) return [];
    try {
      return CalculationPlanSchema.parse([
        { type: "20ft Standard Dry", count: 1, items: [{ item_name: items[0]?.item_name || "Mock Calc Item", quantity: items[0]?.quantity || 1 }], justification: "Mock justification: OpenAI client not available." }
      ]);
    } catch (e) { console.error("Mock data parsing error (calculateContainers):", e); return []; }
  }
  if (items.length === 0) { console.log("calculateContainers: Empty items array."); return []; }
  console.log("calculateContainers: Calling OpenAI with items (first 2):", JSON.stringify(items.slice(0,2)) + (items.length > 2 ? "..." : ""));
  try {
    const response = await openaiInstance.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [ { role: "system", content: CONTAINER_CALCULATION_SYSTEM_PROMPT }, { role: "user", content: JSON.stringify(items) } ],
      temperature: 0.2, response_format: { type: "json_object" },
    });
    const jsonString = response.choices[0]?.message?.content;
    if (!jsonString) throw new Error("OpenAI returned empty response for container calculation.");
    console.log("calculateContainers: Received JSON string from OpenAI:", jsonString);
    let parsedJson = JSON.parse(jsonString);
    let planArray = Array.isArray(parsedJson) ? parsedJson : (parsedJson && typeof parsedJson === 'object' && (Array.isArray(parsedJson.plan) || Array.isArray(parsedJson.containers))) ? (parsedJson.plan || parsedJson.containers) : null;
    if (planArray === null) { // Check if it's an object with other potential keys for items
        const potentialKeys = ['calculation_plan', 'container_plan', 'results', 'data'];
        const foundKey = potentialKeys.find(key => Array.isArray((parsedJson as any)[key]));
        if (foundKey) planArray = (parsedJson as any)[foundKey];
        else throw new Error("OpenAI response is not a valid container plan array structure (no known wrapper key).");
    }

    const validationResult = CalculationPlanSchema.safeParse(planArray);
    if (!validationResult.success) {
      console.error("calculateContainers: Zod validation failed.", validationResult.error.flatten().fieldErrors);
      throw new Error(`Invalid data structure from OpenAI after container calculation: ${validationResult.error.message}`);
    }
    return validationResult.data;
  } catch (error) { console.error("Error in calculateContainers:", error); if (error instanceof OpenAI.APIError) throw new Error(`OpenAI API Error (${error.status}): ${error.message}`); throw error; }
}
