export class ResponseSentError extends Error {
  constructor(message: string = '❌ Response has already been sent') {
    super(message);
    this.name = 'ResponseSentError';
  }
}

export class ResponseSentHeaderError extends ResponseSentError {
  constructor(message: string = 'Cannot set header after response has been sent') {
    super(message);
  }
}

export class ResponseSentContentError extends ResponseSentError {
  constructor(message: string = 'Cannot set content type after response has been sent') {
    super(message);
  }
}

export class ParseUrlError extends ResponseSentError {
  constructor(message: string = 'Invalide URL') {
    super(message);
  }
}
