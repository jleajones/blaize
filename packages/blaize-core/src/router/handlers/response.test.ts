import { processResponse } from './response';

import type { Context } from '@blaize-types/context';
import type { ProcessResponseOptions } from '@blaize-types/router';

describe('processResponse', () => {
  // Mock Context object
  let mockContext: Context;

  beforeEach(() => {
    // Reset the mock context before each test
    mockContext = {
      response: {
        sent: false,
        text: vi.fn(),
        json: vi.fn(),
        // Add other required properties from the Context type
      },
    } as unknown as Context;
  });

  it('should do nothing if response is already sent', () => {
    // Arrange
    mockContext.response.sent = true;

    // Act
    processResponse(mockContext, 'test result');

    // Assert
    expect(mockContext.response.text).not.toHaveBeenCalled();
    expect(mockContext.response.json).not.toHaveBeenCalled();
  });

  it('should use default status 204 with null result', () => {
    // Act
    processResponse(mockContext, null);

    // Assert
    expect(mockContext.response.text).toHaveBeenCalledWith('', 204);
  });

  it('should use default status 204 with undefined result', () => {
    // Act
    processResponse(mockContext, undefined);

    // Assert
    expect(mockContext.response.text).toHaveBeenCalledWith('', 204);
  });

  it('should use custom default status with null result', () => {
    // Arrange
    const options: ProcessResponseOptions = { defaultStatus: 202 };

    // Act
    processResponse(mockContext, null, options);

    // Assert
    expect(mockContext.response.text).toHaveBeenCalledWith('', 202);
  });

  it('should handle string results with text response', () => {
    // Arrange
    const testString = 'Hello World';

    // Act
    processResponse(mockContext, testString);

    // Assert
    expect(mockContext.response.text).toHaveBeenCalledWith(testString);
    expect(mockContext.response.json).not.toHaveBeenCalled();
  });

  it('should handle object results with json response', () => {
    // Arrange
    const testObject = { message: 'Hello World' };

    // Act
    processResponse(mockContext, testObject);

    // Assert
    expect(mockContext.response.json).toHaveBeenCalledWith(testObject);
    expect(mockContext.response.text).not.toHaveBeenCalled();
  });

  it('should handle array results with json response', () => {
    // Arrange
    const testArray = ['Hello', 'World'];

    // Act
    processResponse(mockContext, testArray);

    // Assert
    expect(mockContext.response.json).toHaveBeenCalledWith(testArray);
    expect(mockContext.response.text).not.toHaveBeenCalled();
  });

  it('should convert number to string for response', () => {
    // Arrange
    const testNumber = 42;

    // Act
    processResponse(mockContext, testNumber);

    // Assert
    expect(mockContext.response.text).toHaveBeenCalledWith('42');
    expect(mockContext.response.json).not.toHaveBeenCalled();
  });

  it('should convert boolean to string for response', () => {
    // Arrange
    const testBoolean = true;

    // Act
    processResponse(mockContext, testBoolean);

    // Assert
    expect(mockContext.response.text).toHaveBeenCalledWith('true');
    expect(mockContext.response.json).not.toHaveBeenCalled();
  });
});
