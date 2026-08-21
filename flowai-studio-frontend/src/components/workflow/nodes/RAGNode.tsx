/**
 * RAG 检索节点：调用知识库检索，输出相关文档。
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ReadOutlined } from '@ant-design/icons';
import BaseNode from './BaseNode';

/** RAG 检索节点组件 */
const RAGNode = ({ id, data }: { id: string; data: any }) => {
  return (
    <BaseNode id={id} label={data.label || '知识库检索'} icon={<ReadOutlined />} color="#d97706" width={240}>
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
    </BaseNode>
  );
};

export default memo(RAGNode);
