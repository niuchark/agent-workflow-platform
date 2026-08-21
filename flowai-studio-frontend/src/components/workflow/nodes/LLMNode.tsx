/**
 * 大模型节点：调用 LLM 生成回答，左右各有连接点。
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { MessageOutlined } from '@ant-design/icons';
import BaseNode from './BaseNode';

/** 大模型节点组件 */
const LLMNode = ({ id, data }: { id: string; data: any }) => {
  return (
    <BaseNode id={id} label={data.label || '大语言模型'} icon={<MessageOutlined />} color="#0284c7" width={240}>
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
    </BaseNode>
  );
};

export default memo(LLMNode);
