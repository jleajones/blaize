import { ClientError, NetworkError, handleResponseError } from './errors';

describe('ClientError', () => {
  it('should create error with message only', () => {
    const error = new ClientError('Something went wrong');

    expect(error.name).toBe('ClientError');
    expect(error.message).toBe('Something went wrong');
    expect(error.status).toBeUndefined();
    expect(error.response).toBeUndefined();
  });

  it('should create error with status code', () => {
    const error = new ClientError('Not found', 404);

    expect(error.name).toBe('ClientError');
    expect(error.message).toBe('Not found');
    expect(error.status).toBe(404);
  });

  it('should create error with response data', () => {
    const responseData = { error: 'Invalid input', details: ['Field required'] };
    const error = new ClientError('Validation failed', 400, responseData);

    expect(error.name).toBe('ClientError');
    expect(error.message).toBe('Validation failed');
    expect(error.status).toBe(400);
    expect(error.response).toEqual(responseData);
  });

  it('should be instanceof Error', () => {
    const error = new ClientError('Test');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ClientError);
  });
});

describe('NetworkError', () => {
  it('should create error with message only', () => {
    const error = new NetworkError('Network timeout');

    expect(error.name).toBe('NetworkError');
    expect(error.message).toBe('Network timeout');
    expect(error.cause).toBeUndefined();
  });

  it('should create error with cause', () => {
    const cause = new Error('Connection refused');
    const error = new NetworkError('Failed to connect', cause);

    expect(error.name).toBe('NetworkError');
    expect(error.message).toBe('Failed to connect');
    expect(error.cause).toBe(cause);
  });

  it('should be instanceof Error', () => {
    const error = new NetworkError('Test');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(NetworkError);
  });
});

describe('handleResponseError', () => {
  it('should throw ClientError for 4xx status codes', () => {
    const mockResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response;

    expect(() => handleResponseError(mockResponse)).toThrow(ClientError);
    expect(() => handleResponseError(mockResponse)).toThrow('HTTP 404: Not Found');
  });

  it('should throw ClientError for 5xx status codes', () => {
    const mockResponse = {
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response;

    expect(() => handleResponseError(mockResponse)).toThrow(ClientError);
    expect(() => handleResponseError(mockResponse)).toThrow('HTTP 500: Internal Server Error');
  });

  it('should include status code in thrown error', () => {
    const mockResponse = {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
    } as Response;

    try {
      handleResponseError(mockResponse);
    } catch (error) {
      expect(error).toBeInstanceOf(ClientError);
      expect((error as ClientError).status).toBe(400);
    }
  });
});
