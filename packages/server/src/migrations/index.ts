import init from "./001_init";

/** Ordered migrations; append new ones, never edit applied ones. */
export const MIGRATIONS: [id: string, sql: string][] = [["001_init", init]];
