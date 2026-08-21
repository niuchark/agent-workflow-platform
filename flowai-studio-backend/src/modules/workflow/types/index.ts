/**
 * 节点执行器接口：所有节点执行器遵循的统一契约。
 */
/** 节点执行器：接收节点配置与运行上下文，返回该节点的输出 */
export interface INodeExecutor {
  execute(node: any, context: Record<string, any>): Promise<Record<string, any>>;
}
