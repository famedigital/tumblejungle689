import { z } from "zod";

export const BankOcrResultSchema = z.object({
  detectedBank: z.enum(["mBoB", "BNB", "BDBL", "Druk PNB", "T-Bank", "Other"]),
  journalRef: z.string().min(4),
  amountNu: z.number().positive(),
  timestamp: z.string().optional(),
  confidence: z.number().min(0).max(1),
  rawExtractedText: z.string(),
});

export type BankOcrResult = z.infer<typeof BankOcrResultSchema>;

export type DetectedBank = BankOcrResult["detectedBank"];
