/**
 * 开始节点执行器：把节点配置的静态变量注入上下文输出。
 */
import { Injectable } from '@nestjs/common';
import { INodeExecutor } from '../../types';

/** 开始节点执行器 */
@Injectable()
export class StartNodeExecutor implements INodeExecutor {
  /** 输出节点中声明的所有初始变量 */
  async execute(node: any, _context: Record<string, any>): Promise<Record<string, any>> {
    const nodeData = node.data as any;
    const output: Record<string, any> = {};
    if (nodeData.variables && Array.isArray(nodeData.variables)) {
      for (const variable of nodeData.variables) {
        output[variable.key] = variable.value;
      }
    }
    return output;
  }
}
