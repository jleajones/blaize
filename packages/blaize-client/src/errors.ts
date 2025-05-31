export class ClientError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'ClientError';
  }
}

export class NetworkError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'NetworkError';
  }
}

export function handleResponseError(response: Response): never {
  // TODO: Implement error handling based on status codes
  throw new ClientError(`HTTP ${response.status}: ${response.statusText}`, response.status);
}