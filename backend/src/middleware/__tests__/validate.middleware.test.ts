import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../validate.middleware';

describe('Validate Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  const testSchema = z.object({
    params: z.object({
      id: z.string().regex(/^\d+$/, 'must be numeric'),
    }),
  });

  it('should call next() when validation passes', async () => {
    mockReq.params = { id: '123' };

    const middleware = validate(testSchema);
    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should return 400 when validation fails', async () => {
    mockReq.params = { id: 'abc' };

    const middleware = validate(testSchema);
    await middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Validation failed',
        details: expect.arrayContaining(['params.id - must be numeric']),
      })
    );
  });
});
