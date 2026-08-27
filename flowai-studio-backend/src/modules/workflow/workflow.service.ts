/**
 * 工作流管理服务：CRUD 与缓存管理。
 *
 * 节点/连线/变量在数据库中按 JSON 字符串存储，
 * 接口层统一反序列化；写操作自动失效 L1/L2 缓存。
 */
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import { CacheTTL, CachePrefix } from '../../common/decorators/cache.decorator';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { Permission, PERMISSIONS } from '../../common/constants/permissions';
import { WorkflowAccessService } from './services/workflow-access.service';

/**
 * Workflow Service — 工作流管理服务
 *
 * Phase 2.4 缓存增强:
 * - 工作流列表/详情: L1 + L2 缓存
 * - 工作流创建/更新/删除时自动失效缓存
 *
 * 竞品对标:
 * - Dify: Redis 缓存工作流配置，5min TTL
 * - n8n: 内存缓存 + Redis
 * - 本设计: L1/L2 双层缓存 + 写时失效
 */
/** 工作流管理服务：CRUD + 节点/连线 JSON 序列化 + 缓存管理 */
@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
    private workflowAccess: WorkflowAccessService,
  ) {}

  /** 把数据库中的 JSON 字符串字段解析回对象，便于接口返回 */
  private serializeWorkflow<T extends { nodes: string; edges: string; variables?: string | null }>(
    workflow: T,
  ) {
    return {
      ...workflow,
      nodes: this.parseJsonField(workflow.nodes, []),
      edges: this.parseJsonField(workflow.edges, []),
      variables: workflow.variables
        ? this.parseJsonField(workflow.variables, {})
        : null,
    };
  }

  /** 安全解析 JSON 字符串：解析失败返回兜底值 */
  private parseJsonField<T>(value: string, fallback: T): T {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  /** 创建工作流：校验应用归属并把节点/连线序列化存储 */
  async create(userId: string, createWorkflowDto: CreateWorkflowDto) {
    const { applicationId, ...data } = createWorkflowDto;

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!app) {
      throw new NotFoundException('Application not found');
    }

    await this.workflowAccess.assertPermission(userId, app, PERMISSIONS.WORKFLOW_CREATE);

    const workflow = await this.prisma.workflow.create({
      data: {
        ...data,
        applicationId,
        nodes: JSON.stringify(data.nodes || []),
        edges: JSON.stringify(data.edges || []),
        variables: data.variables ? JSON.stringify(data.variables) : undefined,
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

    // 失效工作流列表缓存
    await this.cacheService.deleteByPrefix(`${CachePrefix.WORKFLOW}:list:${applicationId}`);

    return this.serializeWorkflow(workflow);
  }

  /**
   * 查询应用下的工作流列表 — L1 + L2 缓存
   *
   * Phase 2.4 缓存策略:
   * - 缓存键: wf:list:{appId}
   * - L2 TTL: 300s (5 分钟)
   * - 创建/更新/删除时自动失效
   */
  /** 查询应用下的工作流列表（带缓存） */
  async findByApp(userId: string, appId: string) {
    const app = await this.prisma.application.findUnique({
      where: { id: appId },
    });

    if (!app) {
      throw new NotFoundException('Application not found');
    }

    await this.workflowAccess.assertPermission(userId, app, PERMISSIONS.WORKFLOW_READ);

    return this.cacheService.getOrSet(
      `${CachePrefix.WORKFLOW}:list:${appId}`,
      () => this.prisma.workflow.findMany({
        where: { applicationId: appId },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      CacheTTL.WORKFLOW_LIST,
    );
  }

  /**
   * 查询工作流详情 — L1 + L2 缓存
   *
   * Phase 2.4 缓存策略:
   * - 缓存键: wf:detail:{id}
   * - L2 TTL: 600s (10 分钟)
   * - 更新/删除时自动失效
   */
  /** 查询工作流详情（带缓存），并按调用场景校验所需权限。 */
  async findOne(
    userId: string,
    id: string,
    requiredPermission: Permission = PERMISSIONS.WORKFLOW_READ,
  ) {
    const workflow = await this.cacheService.getOrSet(
      `${CachePrefix.WORKFLOW}:detail:${id}`,
      () => this.prisma.workflow.findUnique({
        where: { id },
        include: {
          application: {
            select: { userId: true, id: true },
          },
        },
      }),
      CacheTTL.WORKFLOW_CONFIG,
    );

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    await this.workflowAccess.assertPermission(
      userId,
      workflow.application,
      requiredPermission,
    );

    const workflowData = (({ application: _application, ...rest }) => rest)(workflow);
    return this.serializeWorkflow(workflowData);
  }

  /** 更新工作流：节点/连线变更后失效相关缓存 */
  async update(userId: string, id: string, updateWorkflowDto: UpdateWorkflowDto) {
    const existingWorkflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: {
        application: {
          select: { userId: true, id: true },
        },
      },
    });

    if (!existingWorkflow) {
      throw new NotFoundException('Workflow not found');
    }

    await this.workflowAccess.assertPermission(
      userId,
      existingWorkflow.application,
      PERMISSIONS.WORKFLOW_UPDATE,
    );

    const workflow = await this.prisma.workflow.update({
      where: { id },
      data: {
        ...updateWorkflowDto,
        nodes: updateWorkflowDto.nodes ? JSON.stringify(updateWorkflowDto.nodes) : undefined,
        edges: updateWorkflowDto.edges ? JSON.stringify(updateWorkflowDto.edges) : undefined,
        variables: updateWorkflowDto.variables ? JSON.stringify(updateWorkflowDto.variables) : undefined,
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

    // 失效工作流详情 + 列表缓存
    await this.invalidateWorkflowCache(id, existingWorkflow.application.id);

    return this.serializeWorkflow(workflow);
  }

  /** 删除工作流：删除后失效相关缓存 */
  async remove(userId: string, id: string) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: {
        application: {
          select: { userId: true, id: true },
        },
      },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    await this.workflowAccess.assertPermission(
      userId,
      workflow.application,
      PERMISSIONS.WORKFLOW_DELETE,
    );

    await this.prisma.workflow.delete({
      where: { id },
    });

    // 失效工作流详情 + 列表缓存
    await this.invalidateWorkflowCache(id, workflow.application.id);

    return { success: true };
  }

  // ============================================================
  // 缓存辅助方法 (Phase 2.4)
  // ============================================================

  /**
   * 失效工作流相关缓存
   */
  /** 失效工作流详情与所属应用列表的缓存 */
  private async invalidateWorkflowCache(workflowId: string, applicationId: string): Promise<void> {
    await Promise.allSettled([
      this.cacheService.delete(`${CachePrefix.WORKFLOW}:detail:${workflowId}`),
      this.cacheService.deleteByPrefix(`${CachePrefix.WORKFLOW}:list:${applicationId}`),
    ]);
  }
}
