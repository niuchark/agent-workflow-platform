/**
 * 条件节点执行器：对全部条件做 AND 求值。
 *
 * 返回 { result: boolean }，执行器据此决定走"是/否"分支。
 */
import { Injectable } from '@nestjs/common';
import { INodeExecutor } from '../../types';

/** 条件节点执行器 */
@Injectable()
export class ConditionNodeExecutor implements INodeExecutor {
  /** 依次求值所有条件，任一不满足则整体为 false */
  async execute(node: any, context: Record<string, any>): Promise<Record<string, any>> {
    const nodeData = node.data as any;
    const { conditions } = nodeData;

    let result = true;
    if (conditions && Array.isArray(conditions)) {
      for (const condition of conditions) {
        const { variable, operator, value } = condition;
        const contextValue = this.resolveVariable(variable, context);
        if (!this.evaluate(contextValue, operator, value)) {
          result = false;
          break;
        }
      }
    }

    return { result };
  }

  /** 解析变量引用（去掉 {{ }} 后按点号路径取值） */
  private resolveVariable(template: string, context: Record<string, any>): any {
    if (!template) return undefined;
    const keys = template.replace(/\{\{|\}\}/g, '').trim().split('.');
    let value = context;
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    return value;
  }

  /** 按运算符比较上下文值与目标值 */
  private evaluate(contextValue: any, operator: string, value: any): boolean {
    switch (operator) {
      case '===':
        return contextValue === value;
      case '!==':
        return contextValue !== value;
      case '>':
        return contextValue > value;
      case '<':
        return contextValue < value;
      case '>=':
        return contextValue >= value;
      case '<=':
        return contextValue <= value;
      case 'contains':
        return typeof contextValue === 'string' && contextValue.includes(value);
      default:
        return false;
    }
  }
}
