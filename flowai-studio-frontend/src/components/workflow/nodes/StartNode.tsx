/**
 * 开始节点：工作流入口，只提供输出连接点。
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { PlayCircleOutlined } from '@ant-design/icons';
import BaseNode from './BaseNode';

/** 开始节点组件 */
const StartNode = ({ id, data }: { id: string; data: any }) => {
  return (
    <BaseNode id={id} label={data.label || '开始'} icon={<PlayCircleOutlined />} color="#0284c7">
      <Handle type="source" position={Position.Right} />
    </BaseNode>
  );
};

export default memo(StartNode);
