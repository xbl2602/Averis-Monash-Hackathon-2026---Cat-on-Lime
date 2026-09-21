export class DevModeRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DevModeRequestError";
  }
}
