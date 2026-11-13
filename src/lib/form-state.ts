/**
 * The result shape every server-action form renders. Kept apart from `./forms` (the server-side
 * readers and Zod field types) so a form's client code doesn't load the validation library just
 * to start idle.
 */

export type FieldErrors = Partial<Record<string, string>>;

export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: FieldErrors;
  /** Increments on every successful submit, so a client can react once (close a dialog). */
  savedAt?: number;
};

export const IDLE: FormState = { status: "idle" };
