export type AppErrorCode =
  | "BACKEND_UNAVAILABLE"
  | "VALIDATION_ERROR"
  | "DATABASE_ERROR"
  | "NETWORK_ERROR"
  | "NOT_IMPLEMENTED"
  | "BUSY"
  | "NOT_FOUND"
  | "RIOT_KEY"
  | "RATE_LIMITED"
  | "UNKNOWN_ERROR";

interface ErrorPayload {
  code?: string;
  message?: string;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly cause?: unknown;

  constructor(code: AppErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.cause = cause;
  }
}

function isErrorPayload(value: unknown): value is ErrorPayload {
  return typeof value === "object" && value !== null;
}

function toKnownCode(code: string | undefined): AppErrorCode {
  switch (code) {
    case "BACKEND_UNAVAILABLE":
    case "VALIDATION_ERROR":
    case "DATABASE_ERROR":
    case "NETWORK_ERROR":
    case "NOT_IMPLEMENTED":
    case "BUSY":
    case "NOT_FOUND":
    case "RIOT_KEY":
    case "RATE_LIMITED":
    case "UNKNOWN_ERROR":
      return code;
    default:
      return "UNKNOWN_ERROR";
  }
}

/**
 * Converts backend, network and unknown failures into a single error shape.
 * Backend errors are serialized as `{ code, message }` by the Rust layer.
 */
export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (isErrorPayload(error)) {
    const message =
      typeof error.message === "string" && error.message.trim().length > 0
        ? error.message
        : "Si è verificato un errore inatteso.";
    return new AppError(toKnownCode(error.code), message, error);
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return new AppError("UNKNOWN_ERROR", error, error);
  }

  if (error instanceof Error) {
    return new AppError("UNKNOWN_ERROR", error.message, error);
  }

  return new AppError(
    "UNKNOWN_ERROR",
    "Si è verificato un errore inatteso. Riprova.",
    error,
  );
}

export function getErrorMessage(error: unknown): string {
  return normalizeError(error).message;
}
