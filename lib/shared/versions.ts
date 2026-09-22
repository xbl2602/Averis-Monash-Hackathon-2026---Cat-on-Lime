/**
 * Engine logic version number (leaf module: holds only a constant, imports nothing).
 *
 * Why this is its own file: both the results layer (pipeline/verification-store) and the
 * export layer need it, but the export function shouldn't have to drag the entire pipeline
 * (along with its heavy attachment-parsing dependencies) into its bundle just for one string.
 * Bump this by hand whenever a rule change is substantive (originally noted in a comment in
 * lib/shared/pipeline.ts).
 */
export const PIPELINE_LOGIC_VERSION = "v5-2026-09-21";
