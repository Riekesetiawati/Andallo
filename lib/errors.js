export class DomainError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
