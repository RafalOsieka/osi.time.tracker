/** Thrown by transports when the upstream tracker returns a non-success HTTP status. */
export class UpstreamHttpError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number) {
    super(`Upstream HTTP ${statusCode}`);
    this.name = 'UpstreamHttpError';
    this.statusCode = statusCode;
  }
}
