import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  const status = jest.fn();
  const json = jest.fn();
  const response = { status, json };
  const request = { method: 'GET', url: '/api/test' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  let loggerSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    status.mockReturnValue(response);
    loggerSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => loggerSpy.mockRestore());

  it('does not expose an unexpected exception message', () => {
    new AllExceptionsFilter().catch(new Error('database password leaked'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    }));
  });

  it('keeps a deliberate HTTP exception message', () => {
    new AllExceptionsFilter().catch(new BadRequestException('invalid input'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'BAD_REQUEST',
      message: 'invalid input',
    }));
  });
});
