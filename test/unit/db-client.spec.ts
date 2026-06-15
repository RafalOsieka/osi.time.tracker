import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl } from "../../server/db/client";

describe("resolveDatabaseUrl", () => {
  it("throws a clear error when DATABASE_URL is unset", () => {
    expect(() => resolveDatabaseUrl({})).toThrowError(/DATABASE_URL is not set/);
  });

  it("throws a clear error when DATABASE_URL is empty or blank", () => {
    expect(() => resolveDatabaseUrl({ DATABASE_URL: "" })).toThrowError(
      /DATABASE_URL is not set/,
    );
    expect(() => resolveDatabaseUrl({ DATABASE_URL: "   " })).toThrowError(
      /DATABASE_URL is not set/,
    );
  });

  it("returns the trimmed connection string when set", () => {
    expect(
      resolveDatabaseUrl({ DATABASE_URL: "  postgres://localhost/db  " }),
    ).toBe("postgres://localhost/db");
  });
});
