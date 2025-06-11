// src/lib/zodSchemas.ts
import { z } from 'zod';

// ItemSchema and ItemsArraySchema (as defined before)
export const ItemSchema = z.object({
  item_name: z.string().min(1, "Item name cannot be empty"),
  length: z.number().positive("Length must be a positive number"),
  width: z.number().positive("Width must be a positive number"),
  height: z.number().positive("Height must be a positive number"),
  weight: z.number().positive("Weight must be a positive number"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
  stackable: z.boolean().default(true),
  tiltable: z.boolean().default(false),
});
export const ItemsArraySchema = z.array(ItemSchema);
export type Item = z.infer<typeof ItemSchema>;


// New Schemas for Container Calculation Plan
export const CalculatedItemInContainerSchema = z.object({
  item_name: z.string(),
  quantity: z.number().int().positive(),
});

export const ContainerPlanEntrySchema = z.object({
  type: z.string(), // e.g., "20ft", "40ft", "Open-Top", "High-Cube"
  count: z.number().int().positive(),
  items: z.array(CalculatedItemInContainerSchema),
  justification: z.string().optional(), // LLM might not always provide this
});

export const CalculationPlanSchema = z.array(ContainerPlanEntrySchema);

export type CalculatedItemInContainer = z.infer<typeof CalculatedItemInContainerSchema>;
export type ContainerPlanEntry = z.infer<typeof ContainerPlanEntrySchema>;
export type CalculationPlan = z.infer<typeof CalculationPlanSchema>;
