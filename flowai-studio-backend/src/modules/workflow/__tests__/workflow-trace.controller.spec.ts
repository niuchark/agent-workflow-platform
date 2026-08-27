import { WorkflowTraceController } from '../controllers/workflow-trace.controller';

describe('WorkflowTraceController tenant isolation', () => {
  const tracingService = {
    getTrace: jest.fn(),
    getWorkflowTraces: jest.fn(),
    getSlowTraces: jest.fn(),
    getTraceStats: jest.fn(),
  };
  const controller = new WorkflowTraceController(tracingService as any);

  beforeEach(() => jest.clearAllMocks());

  it('passes the JWT userId to every trace query', async () => {
    await controller.getTrace('user_1', 'trace_1');
    await controller.getWorkflowTraces('user_1', 'wf_1', '25');
    await controller.getSlowTraces('user_1', 'wf_1', '5');
    await controller.getTraceStats('user_1', 'wf_1');

    expect(tracingService.getTrace).toHaveBeenCalledWith('user_1', 'trace_1');
    expect(tracingService.getWorkflowTraces).toHaveBeenCalledWith('user_1', 'wf_1', 25);
    expect(tracingService.getSlowTraces).toHaveBeenCalledWith('user_1', 'wf_1', 5);
    expect(tracingService.getTraceStats).toHaveBeenCalledWith('user_1', 'wf_1');
  });
});
