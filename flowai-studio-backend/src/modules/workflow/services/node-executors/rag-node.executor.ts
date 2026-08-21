/**
 * RAG 检索节点执行器：解析查询后调用知识库检索。
 */
import { Injectable } from '@nestjs/common';
import { INodeExecutor } from '../../types';
import { RAGService } from '../../../rag/services/rag.service';

@Injectable()
export class RAGNodeExecutor implements INodeExecutor {
  constructor(private readonly ragService: RAGService) {}

  /** 解析查询模板 → 检索知识库 → 返回 documents */
  async execute(node: any, context: Record<string, any>): Promise<Record<string, any>> {
    const nodeData = node.data as any;
    const { knowledgeBaseId, query, topK, similarityThreshold } = nodeData;

    const resolvedQuery = this.resolveVariables(query, context);
    const userId = context._userId;
    if (!userId) {
      throw new Error('RAG node execution requires an authenticated user');
    }

    const documents = await this.ragService.retrieve(userId, resolvedQuery, knowledgeBaseId, topK);

    return { documents };
  }

  /** 把查询模板中的变量引用替换为上下文实际值 */
  private resolveVariables(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{(.+?)\}\}/g, (match, p1) => {
      const keys = p1.trim().split('.');
      let value = context;
      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          return match;
        }
      }
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    });
  }
}
