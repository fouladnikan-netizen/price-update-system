export class CollectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CollectError";
  }
}
