import { describe, expect, it } from "vitest";
import { AppError, normalizeError } from "@/lib/errors";

describe("normalizeError", () => {
  it("keeps the code and message serialized by the Rust backend", () => {
    const error = normalizeError({
      code: "DATABASE_ERROR",
      message: "Operazione sul database locale non riuscita.",
    });
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe("DATABASE_ERROR");
    expect(error.message).toBe("Operazione sul database locale non riuscita.");
  });

  it("maps unknown codes to UNKNOWN_ERROR", () => {
    expect(normalizeError({ code: "SOMETHING_NEW", message: "x" }).code).toBe(
      "UNKNOWN_ERROR",
    );
  });

  it("never returns an empty message", () => {
    expect(normalizeError({}).message.length).toBeGreaterThan(0);
    expect(normalizeError(null).message.length).toBeGreaterThan(0);
  });

  it("returns AppError instances unchanged", () => {
    const original = new AppError("VALIDATION_ERROR", "Dato non valido");
    expect(normalizeError(original)).toBe(original);
  });
});
