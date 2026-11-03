import { z } from "zod";

export const VoiceTillCommandSchema = z.object({
  action: z.enum(["admission", "add_item", "extend_play", "lookup", "settle"]),
  targetTicketOrPhone: z.string().optional(),
  guardianName: z.string().optional(),
  children: z.number().int().min(1).optional(),
  playMinutes: z.number().int().optional(),
  socks: z.number().int().min(0).optional(),
  items: z
    .array(
      z.object({
        name: z.string(),
        qty: z.number().int().min(1),
        outlet: z.enum(["cafe", "restaurant"]).optional(),
        notes: z.string().optional(),
      }),
    )
    .optional(),
  rawTranscript: z.string(),
  confidence: z.number().min(0).max(1),
});

export type VoiceTillCommand = z.infer<typeof VoiceTillCommandSchema>;
