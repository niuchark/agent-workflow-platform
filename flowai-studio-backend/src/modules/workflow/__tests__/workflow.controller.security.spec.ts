import { EventEmitter } from 'events';
import { WorkflowController } from '../workflow.controller';
import { PERMISSIONS } from '../../../common/constants/permissions';

describe('WorkflowController execution isolation', () => {
  let controller: WorkflowController;
  let workflowService: any;
  let executor: any;
  let rateLimiter: any;
  let circuitBreaker: any;

  beforeEach(() => {
    workflowService = {
      findOne: jest.fn().mockResolvedValue({ id: 'wf_1' }),
    };
    executor = {
      executeWorkflow: jest.fn().mockResolvedValue({ result: 'ok' }),
      cancelExecution: jest.fn().mockReturnValue(true),
      getRunningExecutions: jest.fn().mockReturnValue(['exec_1']),
    };
    rateLimiter = {
      checkRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 19 }),
      acquireConcurrent: jest.fn().mockResolvedValue({ allowed: true }),
      releaseConcurrent: jest.fn().mockResolvedValue(undefined),
    };
    circuitBreaker = {
      isAllowed: jest.fn().mockResolvedValue(true),
      recordSuccess: jest.fn().mockResolvedValue(undefined),
      recordFailure: jest.fn().mockResolvedValue(undefined),
    };

    controller = new WorkflowController(workflowService, executor, rateLimiter, circuitBreaker);
  });

  it('checks ownership before acquiring quota and executing', async () => {
    const dto = { inputs: {} };

    await controller.run('user_1', 'wf_1', dto);

    expect(workflowService.findOne).toHaveBeenCalledWith('user_1', 'wf_1', PERMISSIONS.WORKFLOW_EXECUTE);
    expect(workflowService.findOne.mock.invocationCallOrder[0]).toBeLessThan(
      rateLimiter.checkRateLimit.mock.invocationCallOrder[0],
    );
    expect(rateLimiter.checkRateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      rateLimiter.acquireConcurrent.mock.invocationCallOrder[0],
    );
    expect(rateLimiter.checkRateLimit).toHaveBeenCalledWith(
      'rate_limit:workflow:run:user_1',
      expect.objectContaining({ windowSeconds: 60, maxRequests: 20 }),
    );
    expect(executor.executeWorkflow).toHaveBeenCalledWith('wf_1', {
      inputs: {},
      userId: 'user_1',
    });
  });

  it('does not acquire quota when ownership validation fails', async () => {
    workflowService.findOne.mockRejectedValue(new Error('Forbidden'));

    await expect(controller.run('user_2', 'wf_1', { inputs: {} })).rejects.toThrow('Forbidden');
    expect(rateLimiter.checkRateLimit).not.toHaveBeenCalled();
    expect(rateLimiter.acquireConcurrent).not.toHaveBeenCalled();
    expect(executor.executeWorkflow).not.toHaveBeenCalled();
  });

  it('rejects non-stream execution at the per-user window limit without acquiring concurrency', async () => {
    rateLimiter.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 12 });

    await expect(controller.run('user_1', 'wf_1', { inputs: {} })).rejects.toMatchObject({
      status: 429,
      response: expect.objectContaining({ retryAfter: 12 }),
    });

    expect(rateLimiter.acquireConcurrent).not.toHaveBeenCalled();
    expect(executor.executeWorkflow).not.toHaveBeenCalled();
  });

  it('rejects stream execution at the same window limit before opening SSE', async () => {
    rateLimiter.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 8 });
    const response = new EventEmitter() as any;
    response.setHeader = jest.fn();
    response.status = jest.fn().mockReturnValue(response);
    response.json = jest.fn().mockReturnValue(response);

    await controller.streamRun('user_1', 'wf_1', { inputs: {} }, response);

    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ retryAfter: 8 }));
    expect(response.setHeader).not.toHaveBeenCalled();
    expect(rateLimiter.acquireConcurrent).not.toHaveBeenCalled();
    expect(executor.executeWorkflow).not.toHaveBeenCalled();
  });

  it('scopes cancel and running operations to user and workflow', () => {
    expect(controller.cancelExecution('user_1', 'wf_1', 'exec_1')).toEqual({
      success: true,
      message: 'Execution cancellation requested',
    });
    expect(executor.cancelExecution).toHaveBeenCalledWith('exec_1', 'user_1', 'wf_1');

    expect(controller.getRunningExecutions('user_1', 'wf_1')).toEqual({
      executions: ['exec_1'],
    });
    expect(executor.getRunningExecutions).toHaveBeenCalledWith('user_1', 'wf_1');
  });

  it('releases SSE concurrency exactly once when response close follows completion', async () => {
    const response = new EventEmitter() as any;
    response.setHeader = jest.fn();
    response.write = jest.fn();
    response.end = jest.fn(() => response.emit('close'));
    response.status = jest.fn().mockReturnValue(response);
    response.json = jest.fn().mockReturnValue(response);

    await controller.streamRun('user_1', 'wf_1', { inputs: {} }, response);

    expect(workflowService.findOne).toHaveBeenCalledWith('user_1', 'wf_1', PERMISSIONS.WORKFLOW_EXECUTE);
    expect(rateLimiter.releaseConcurrent).toHaveBeenCalledTimes(1);
    expect(executor.cancelExecution).toHaveBeenCalledWith(expect.stringMatching(/^wf_1_/), 'user_1', 'wf_1');
  });
});
