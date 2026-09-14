import type { Application } from "express";

export declare function createIrrigationExplanation(args: {
  plan: unknown;
  weather: unknown;
  fieldInputs: unknown;
}): Promise<unknown>;

export declare function registerIrrigationAiRoutes(app: Application): void;
