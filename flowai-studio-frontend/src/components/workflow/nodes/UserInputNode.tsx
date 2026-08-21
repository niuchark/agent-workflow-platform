/**
 * 用户输入节点：接收外部传入的输入字段，右侧输出。
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { MessageOutlined } from '@ant-design/icons';
import BaseNode from './BaseNode';

/** 用户输入节点组件 */
const UserInputNode = ({ id, data }: { id: string; data: any }) => {
  return (
    <BaseNode id={id} label={data.label || '用户输入'} icon={<MessageOutlined />} color="#059669">
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
    </BaseNode>
  );
};

export default memo(UserInputNode);
