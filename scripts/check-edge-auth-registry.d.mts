export type FindingSeverity = "error" | "warning";

export interface RegistryFinding {
  severity: FindingSeverity;
  code: string;
  message: string;
  function?: string;
}

export interface FunctionConfig {
  verify_jwt?: boolean;
}

export interface RegistrySnapshot {
  registry: {
    schema_version?: number;
    enforcement?: string;
    functions?: Record<string, unknown>;
  };
  sourceFunctions: string[];
  configFunctions: Map<string, FunctionConfig>;
  sourceByName: Map<string, string>;
}

export function parseFunctionConfig(source: string): Map<string, FunctionConfig>;
export function detectServiceRoleClient(source: string): boolean;
export function validateRegistrySnapshot(snapshot: RegistrySnapshot): RegistryFinding[];
export function loadRepositorySnapshot(projectRoot: string): RegistrySnapshot;
