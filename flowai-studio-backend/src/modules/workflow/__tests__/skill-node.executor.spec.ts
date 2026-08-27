import { SkillNodeExecutor } from '../services/node-executors/skill-node.executor';

describe('SkillNodeExecutor tenant isolation', () => {
  const skillService = {
    executeSkill: jest.fn(),
  };
  const executor = new SkillNodeExecutor(skillService as any);

  beforeEach(() => jest.clearAllMocks());

  it('passes the workflow userId to SkillService', async () => {
    skillService.executeSkill.mockResolvedValue({ value: 42 });

    await expect(
      executor.execute(
        {
          data: {
            skillId: 'skill_1',
            parameters: { query: '{{input}}' },
          },
        },
        { input: 'hello', _userId: 'user_1' },
      ),
    ).resolves.toEqual({ result: { value: 42 } });

    expect(skillService.executeSkill).toHaveBeenCalledWith('skill_1', { query: 'hello' }, 'user_1');
  });

  it('refuses to execute a skill without workflow user context', async () => {
    await expect(executor.execute({ data: { skillId: 'skill_1', parameters: {} } }, {})).rejects.toThrow(
      'SKILL_EXECUTION_USER_REQUIRED',
    );
    expect(skillService.executeSkill).not.toHaveBeenCalled();
  });
});
