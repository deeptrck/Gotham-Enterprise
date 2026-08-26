import { PoolClient } from "pg";

export type TenantScope = {
  organizationId: string;
  actorUserId?: string;
};

export type PageRequest = {
  limit?: number;
  offset?: number;
};

export type PageResult<T> = {
  rows: T[];
  total: number;
};

export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "VALIDATION" | "UNAVAILABLE",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

export function boundedPage(input: PageRequest): { limit: number; offset: number } {
  return {
    limit: Math.max(1, Math.min(100, Math.trunc(input.limit ?? 20))),
    offset: Math.max(0, Math.trunc(input.offset ?? 0)),
  };
}

export function requireTenantScope(scope: TenantScope): TenantScope {
  if (!scope.organizationId?.trim()) throw new RepositoryError("Organization scope is required", "FORBIDDEN");
  return scope;
}

export type QueryExecutor = Pick<PoolClient, "query">;
