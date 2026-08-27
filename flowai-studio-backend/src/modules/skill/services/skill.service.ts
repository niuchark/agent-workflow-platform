/**
 * 技能服务：内置/自定义工具的 CRUD 与执行。
 */
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Skill } from '@prisma/client';
import { PrismaService } from '../../../common/services/prisma.service';
import { BaseUrlSecurityService } from '../../model-credential/base-url-security.service';
import { CreateSkillDto } from '../dto/create-skill.dto';
import { UpdateSkillDto } from '../dto/update-skill.dto';
import { executeBuiltinSkill } from '../utils/builtin-skills';
import axios from 'axios';

/** 技能服务 */
@Injectable()
export class SkillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly baseUrlSecurity: BaseUrlSecurityService,
  ) {}

  // 创建工具
  /** 创建技能：内置技能直接保存，自定义技能校验配置 */
  async createSkill(userId: string, createSkillDto: CreateSkillDto) {
    await this.validateCustomConfig(createSkillDto.type, createSkillDto.config);
    // 检查工具名称是否已存在
    const existingSkill = await this.prisma.skill.findFirst({
      where: { name: createSkillDto.name, userId },
    });

    if (existingSkill) {
      throw new BadRequestException('Skill with this name already exists');
    }

    return this.prisma.skill.create({
      data: {
        name: createSkillDto.name,
        description: createSkillDto.description,
        type: createSkillDto.type,
        builtinType: createSkillDto.builtinType,
        isActive: createSkillDto.isActive,
        userId,
        config: createSkillDto.config ? JSON.stringify(createSkillDto.config) : undefined,
        inputSchema: createSkillDto.inputSchema ? JSON.stringify(createSkillDto.inputSchema) : undefined,
        outputSchema: createSkillDto.outputSchema ? JSON.stringify(createSkillDto.outputSchema) : undefined,
      },
    });
  }

  // 获取用户的所有工具
  /** 获取用户的所有技能 */
  async findSkills(userId: string) {
    return this.prisma.skill.findMany({
      where: { userId },
    });
  }

  // 获取工具详情
  /** 获取技能详情（校验归属权） */
  async findSkillById(userId: string, id: string) {
    const skill = await this.prisma.skill.findFirst({
      where: { id, userId },
    });

    if (!skill) {
      throw new NotFoundException('Skill not found');
    }

    return skill;
  }

  // 更新工具
  /** 更新技能（校验归属权） */
  async updateSkill(userId: string, id: string, updateSkillDto: UpdateSkillDto) {
    const skill = await this.findSkillById(userId, id);
    const effectiveType = updateSkillDto.type || skill.type;
    const effectiveConfig = updateSkillDto.config ?? this.parseConfig(skill.config);
    await this.validateCustomConfig(effectiveType, effectiveConfig);

    return this.prisma.skill.update({
      where: { id },
      data: {
        name: updateSkillDto.name,
        description: updateSkillDto.description,
        type: updateSkillDto.type,
        builtinType: updateSkillDto.builtinType,
        isActive: updateSkillDto.isActive,
        config: updateSkillDto.config ? JSON.stringify(updateSkillDto.config) : undefined,
        inputSchema: updateSkillDto.inputSchema ? JSON.stringify(updateSkillDto.inputSchema) : undefined,
        outputSchema: updateSkillDto.outputSchema ? JSON.stringify(updateSkillDto.outputSchema) : undefined,
      },
    });
  }

  // 删除工具
  /** 删除技能（校验归属权） */
  async deleteSkill(userId: string, id: string) {
    await this.findSkillById(userId, id);

    return this.prisma.skill.delete({ where: { id } });
  }

  // 执行工具
  // userId 必填：控制器与工作流内部调用都必须绑定当前用户。
  /** 执行技能：内置走内置执行器，自定义走 HTTP 调用 */
  async executeSkill(
    skillId: string,
    params: Record<string, unknown>,
    userId: string,
    signal?: AbortSignal,
  ) {
    const skill = await this.prisma.skill.findFirst({
      where: { id: skillId, userId },
    });

    if (!skill) {
      throw new NotFoundException('Skill not found');
    }

    if (!skill.isActive) {
      throw new BadRequestException('Skill is not active');
    }

    if (skill.type === 'builtin') {
      return executeBuiltinSkill(
        skill.builtinType!,
        params,
        (url) => this.baseUrlSecurity.assertRequestUrlAllowed(url),
      );
    } else {
      return this.executeCustomSkill(skill, params, signal);
    }
  }

  // 执行自定义工具
  /** 执行自定义技能：按配置的 URL/方法/请求头发送 HTTP 请求 */
  private async executeCustomSkill(
    skill: Skill,
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ) {
    const config = this.parseConfig(skill.config);
    const { url, method = 'POST', headers = {} } = config;

    if (!url) {
      return {
        success: true,
        data: params,
        message: 'Custom skill executed (Echo mode, no URL configured)',
      };
    }

    const safeUrl = await this.baseUrlSecurity.assertRequestUrlAllowed(String(url));
    try {
      const response = await axios({
        url: safeUrl,
        method: typeof method === 'string' ? method : 'POST',
        headers: typeof headers === 'object' && headers !== null ? headers : {},
        data: params,
        timeout: 15000, // 15 秒超时
        signal,
        maxRedirects: 0,
        maxContentLength: 2 * 1024 * 1024,
        maxBodyLength: 2 * 1024 * 1024,
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      throw new BadGatewayException(
        `Custom skill execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // 获取内置工具列表
  /** 获取内置技能列表 */
  async getBuiltinSkills() {
    return [
      {
        type: 'time',
        name: '时间工具',
        description: '获取当前时间和日期',
        inputSchema: {},
        outputSchema: {
          datetime: 'string',
          timestamp: 'number',
          date: 'string',
          time: 'string',
        },
      },
      {
        type: 'http',
        name: 'HTTP请求',
        description: '发送HTTP请求',
        inputSchema: {
          url: 'string',
          method: 'string',
          headers: 'object',
          body: 'object',
        },
        outputSchema: {
          status: 'number',
          data: 'any',
          headers: 'object',
        },
      },
      {
        type: 'json',
        name: 'JSON处理',
        description: '解析或生成JSON',
        inputSchema: {
          action: 'string',
          data: 'any',
        },
        outputSchema: {
          result: 'any',
        },
      },
      {
        type: 'regex',
        name: '正则表达式',
        description: '使用正则表达式匹配文本',
        inputSchema: {
          text: 'string',
          pattern: 'string',
          flags: 'string',
        },
        outputSchema: {
          matches: 'array',
          groups: 'object',
        },
      },
      {
        type: 'calculator',
        name: '计算器',
        description: '计算数学表达式，支持加减乘除、取余、乘方',
        inputSchema: {
          expression: 'string',
        },
        outputSchema: {
          expression: 'string',
          result: 'number',
        },
      },
    ];
  }

  /** 自定义 HTTP 技能在保存与执行时都做出站地址校验 */
  private async validateCustomConfig(
    type: string,
    config?: Record<string, unknown>,
  ): Promise<void> {
    if (type !== 'custom' || !config?.url) return;
    if (typeof config.url !== 'string') {
      throw new BadRequestException('Custom skill URL must be a string');
    }
    await this.baseUrlSecurity.assertRequestUrlAllowed(config.url);
  }

  /** 数据库中的 JSON 配置解析失败时按无配置处理，不让损坏记录拖垮进程 */
  private parseConfig(value: string | null): Record<string, unknown> {
    if (!value) return {};
    try {
      const parsed: unknown = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
}
