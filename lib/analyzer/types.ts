import { z } from "zod/v3";
import {
  ChunkCharacterSchema,
  ChunkEventSchema,
  ChunkAnalysisSchema,
  CharacterSchema,
  CharacterSummarySchema,
  BookAnalysisSchema,
  ClassificationSchema,
} from "./schemas";

export type ChunkCharacter = z.infer<typeof ChunkCharacterSchema>;
export type ChunkEvent = z.infer<typeof ChunkEventSchema>;
export type ChunkAnalysis = z.infer<typeof ChunkAnalysisSchema>;
export type Character = z.infer<typeof CharacterSchema>;
export type BookAnalysis = z.infer<typeof BookAnalysisSchema>;
export type Classification = z.infer<typeof ClassificationSchema>;
export type CharacterSummary = z.infer<typeof CharacterSummarySchema>;

export interface AnalyzerOptions {
  pdfPath: string;
  outputPath: string;
  model: string;
}
