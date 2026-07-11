// Type declarations for the pure API of check-migration-duplicates.mjs, so
// TS consumers (the vitest test) get types instead of an implicit any import.

export interface MigrationFile {
  name: string;
  content: string;
}

export interface VersionDuplicate {
  version: string;
  files: string[];
}

export interface ContentDuplicate {
  hash: string;
  files: string[];
}

export interface AllowlistEntry {
  files: string[];
  reason: string;
}

export interface DuplicateFindings {
  versionDuplicates: VersionDuplicate[];
  contentDuplicates: ContentDuplicate[];
  allowedContentDuplicates: Array<ContentDuplicate & { reason: string }>;
}

export const CONTENT_DUPLICATE_ALLOWLIST: AllowlistEntry[];

export function findMigrationDuplicates(
  files: MigrationFile[],
  allowlist?: AllowlistEntry[],
): DuplicateFindings;
