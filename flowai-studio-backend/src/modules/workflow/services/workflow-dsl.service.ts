import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/services/prisma.service';
import { CacheService } from '../../../common/services/cache.service';
import { CachePrefix } from '../../../common/decorators/cache.decorator';
import { ImportWorkflowDslDto, DslFormat } from '../dto/workflow-dsl.dto';
import * as yaml from 'js-yaml';

/**
 * Workflow DSL Service — 工作流导入导出服务
 *
 * Phase 6.1: DSL 导入导出
 *
 * 功能:
 * - 导出: Workflow → YAML/JSON DSL（标准化格式，跨环境迁移）
 * - 导入: YAML/JSON DSL → Workflow（版本校验 + 节点类型校验 + ID 重映射）
 * - 校验: DSL 版本兼容性 + 必填字段 + 节点类型白名单
 *
 * DSL 格式规范:
 * ```yaml
 * version: "1.0"
 * kind: Workflow
 * metadata:
 *   name: 工作流名称
 *   description: 描述
 * spec:
 *   nodes: [...]
 *   edges: [...]
 *   variables: {...}
 * ```
 *
 * 竞品对标:
 * - Dify: YAML DSL (v0.6+)，支持 workflow/app 类型
 * - n8n: JSON 导出/导入，节点类型版本校验
 * - Coze: JSON 格式，支持模板市场一键导入
 */
@Injectable()
export class WorkflowDslService {
  private readonly logger = new Logger(WorkflowDslService.name);

  /** DSL 当前版本 */
  private readonly DSL_VERSION = '1.0';

  /** 支持的 DSL 版本列表（向后兼容） */
  private readonly SUPPORTED_VERSIONS = ['1.0'];

  /** 支持的节点类型白名单 */
  private readonly SUPPORTED_NODE_TYPES = [
    'start', 'llm', 'rag', 'skill', 'agent',
    'condition', 'user-input', 'output',
  ];

  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  // ============================================================
  // 导出
  // ============================================================

  /**
   * 导出工作流为 DSL 格式
   */
  async exportDsl(userId: string, workflowId: string, format: DslFormat): Promise<string> {
    // 1. 查询工作流（含权限校验）
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        application: { select: { userId: true, id: true, name: true } },
      },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    if (workflow.application.userId !== userId) {
      // 检查团队成员权限
      const teamApp = await this.prisma.teamApplication.findFirst({
        where: {
          applicationId: workflow.application.id,
          team: { members: { some: { userId } } },
        },
      });
      if (!teamApp) {
        throw new NotFoundException('Workflow not found');
      }
    }

    // 2. 解析 JSON 字段
    const nodes = this.parseJson(workflow.nodes, []);
    const edges = this.parseJson(workflow.edges, []);
    const variables = workflow.variables ? this.parseJson(workflow.variables, {}) : undefined;

    // 3. 构建 DSL 对象（去除内部 ID，标准化格式）
    const dsl = this.buildDslDocument(workflow.name, workflow.description || undefined, nodes, edges, variables);

    // 4. 序列化为目标格式
    if (format === 'yaml') {
      return yaml.dump(dsl, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
        sortKeys: false,
      });
    }

    return JSON.stringify(dsl, null, 2);
  }

  // ============================================================
  // 导入
  // ============================================================

  /**
   * 从 DSL 导入工作流
   */
  async importDsl(userId: string, dto: ImportWorkflowDslDto) {
    // 1. 解析 DSL 内容
    const dsl = this.parseDslContent(dto.dsl, dto.format);

    // 2. 版本校验
    this.validateVersion(dsl.version);

    // 3. Kind 校验
    if (dsl.kind !== 'Workflow') {
      throw new BadRequestException(`Invalid DSL kind: expected "Workflow", got "${dsl.kind}"`);
    }

    // 4. 节点类型校验
    this.validateNodeTypes(dsl.spec?.nodes || []);

    // 5. 校验目标应用
    const app = await this.prisma.application.findUnique({
      where: { id: dto.applicationId },
    });

    if (!app) {
      throw new NotFoundException('Target application not found');
    }

    if (app.userId !== userId) {
      throw new BadRequestException('You do not have permission to import to this application');
    }

    // 6. 重映射节点 ID（避免 ID 冲突）
    const { nodes, edges, idMap } = this.remapIds(dsl.spec?.nodes || [], dsl.spec?.edges || []);

    // 7. 创建工作流
    const workflowName = dto.nameOverride || dsl.metadata?.name || 'Imported Workflow';
    const workflowDesc = dsl.metadata?.description || undefined;
    const variables = dsl.spec?.variables || undefined;

    const workflow = await this.prisma.workflow.create({
      data: {
        name: workflowName,
        description: workflowDesc,
        applicationId: dto.applicationId,
        nodes: JSON.stringify(nodes),
        edges: JSON.stringify(edges),
        variables: variables ? JSON.stringify(variables) : undefined,
      },
      select: {
        id: true,
        name: true,
        description: true,
        nodes: true,
        edges: true,
        variables: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 8. 失效缓存
    await this.cacheService.deleteByPrefix(`${CachePrefix.WORKFLOW}:list:${dto.applicationId}`);

    this.logger.log(`Imported workflow "${workflowName}" (id: ${workflow.id}) from DSL v${dsl.version}`);

    return {
      ...workflow,
      nodes: this.parseJson(workflow.nodes, []),
      edges: this.parseJson(workflow.edges, []),
      variables: workflow.variables ? this.parseJson(workflow.variables, null) : null,
      idMapping: idMap, // 返回 ID 映射供前端更新引用
    };
  }

  /**
   * 校验 DSL 内容（不实际导入，仅返回校验结果）
   */
  async validateDsl(dslContent: string, format: DslFormat) {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const dsl = this.parseDslContent(dslContent, format);

      // 版本校验
      if (!dsl.version) {
        errors.push('Missing DSL version');
      } else if (!this.SUPPORTED_VERSIONS.includes(dsl.version)) {
        errors.push(`Unsupported DSL version: ${dsl.version}. Supported: ${this.SUPPORTED_VERSIONS.join(', ')}`);
      }

      // Kind 校验
      if (dsl.kind !== 'Workflow') {
        errors.push(`Invalid kind: expected "Workflow", got "${dsl.kind || 'undefined'}"`);
      }

      // 节点校验
      const nodes = dsl.spec?.nodes || [];
      if (nodes.length === 0) {
        warnings.push('Workflow has no nodes');
      }

      // 节点类型校验
      for (const node of nodes) {
        if (!node.type) {
          errors.push(`Node "${node.id || 'unknown'}" missing type`);
        } else if (!this.SUPPORTED_NODE_TYPES.includes(node.type)) {
          warnings.push(`Unknown node type: "${node.type}". It may not work correctly after import.`);
        }
      }

      // 边校验
      const edges = dsl.spec?.edges || [];
      const nodeIds = new Set(nodes.map((n: any) => n.id));
      for (const edge of edges) {
        if (!nodeIds.has(edge.source)) {
          errors.push(`Edge references unknown source node: "${edge.source}"`);
        }
        if (!nodeIds.has(edge.target)) {
          errors.push(`Edge references unknown target node: "${edge.target}"`);
        }
      }

      // 必填字段校验
      if (!dsl.metadata?.name) {
        warnings.push('Workflow name is missing, will use default name');
      }

    } catch (err: any) {
      errors.push(`Failed to parse DSL: ${err.message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ============================================================
  // 私有方法
  // ============================================================

  /**
   * 构建 DSL 文档对象
   */
  private buildDslDocument(
    name: string,
    description: string | undefined,
    nodes: any[],
    edges: any[],
    variables?: any,
  ): any {
    // 清洗节点数据：去除内部字段，保留配置
    const cleanNodes = nodes.map((node: any) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: this.sanitizeNodeData(node.data || {}),
    }));

    // 清洗边数据
    const cleanEdges = edges.map((edge: any) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
    }));

    const dsl: any = {
      version: this.DSL_VERSION,
      kind: 'Workflow',
      metadata: {
        name,
        ...(description && { description }),
        exportedAt: new Date().toISOString(),
        engine: 'FlowAI Studio',
      },
      spec: {
        nodes: cleanNodes,
        edges: cleanEdges,
      },
    };

    if (variables && Object.keys(variables).length > 0) {
      dsl.spec.variables = variables;
    }

    return dsl;
  }

  /**
   * 清洗节点 data 字段 — 去除运行时状态，保留配置
   */
  private sanitizeNodeData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data };

    // 移除运行时状态字段
    delete sanitized._executionResult;
    delete sanitized._status;
    delete sanitized._error;
    delete sanitized._duration;
    delete sanitized._startTime;
    delete sanitized._endTime;

    return sanitized;
  }

  /**
   * 解析 DSL 内容
   */
  private parseDslContent(content: string, format: DslFormat): any {
    try {
      if (format === 'yaml') {
        return yaml.load(content) as any;
      }
      return JSON.parse(content);
    } catch (err: any) {
      throw new BadRequestException(`Failed to parse ${format.toUpperCase()} content: ${err.message}`);
    }
  }

  /**
   * 校验 DSL 版本兼容性
   */
  private validateVersion(version: string): void {
    if (!this.SUPPORTED_VERSIONS.includes(version)) {
      throw new BadRequestException(
        `Unsupported DSL version: ${version}. ` +
        `This engine supports versions: ${this.SUPPORTED_VERSIONS.join(', ')}. ` +
        `Please upgrade your FlowAI Studio or use a compatible DSL version.`,
      );
    }
  }

  /**
   * 校验节点类型
   */
  private validateNodeTypes(nodes: any[]): void {
    const unknownTypes = new Set<string>();

    for (const node of nodes) {
      if (node.type && !this.SUPPORTED_NODE_TYPES.includes(node.type)) {
        unknownTypes.add(node.type);
      }
    }

    if (unknownTypes.size > 0) {
      throw new BadRequestException(
        `Unknown node types: ${[...unknownTypes].join(', ')}. ` +
        `Supported types: ${this.SUPPORTED_NODE_TYPES.join(', ')}`,
      );
    }
  }

  /**
   * 重映射节点和边 ID — 避免导入时 ID 冲突
   */
  private remapIds(nodes: any[], edges: any[]): { nodes: any[]; edges: any[]; idMap: Record<string, string> } {
    const idMap: Record<string, string> = {};

    // 为每个节点生成新 ID
    const newNodes = nodes.map((node: any) => {
      const oldId = node.id;
      const newId = this.generateNodeId(node.type);
      idMap[oldId] = newId;

      return {
        ...node,
        id: newId,
        position: node.position || { x: 0, y: 0 },
      };
    });

    // 更新边中的引用
    const newEdges = edges.map((edge: any) => ({
      ...edge,
      id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source: idMap[edge.source] || edge.source,
      target: idMap[edge.target] || edge.target,
    }));

    return { nodes: newNodes, edges: newEdges, idMap };
  }

  /**
   * 生成节点 ID
   */
  private generateNodeId(type?: string): string {
    const prefix = type ? `${type}_` : 'node_';
    return `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * 安全解析 JSON
   */
  private parseJson<T>(value: string, fallback: T): T {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
}
