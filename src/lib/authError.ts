/** The sign-in service could not answer. This is NOT the same as being signed out. */
export class AuthUnreachableError extends Error {
  constructor() {
    super("The sign-in service could not be reached");
    this.name = "AuthUnreachableError";
  }
}
