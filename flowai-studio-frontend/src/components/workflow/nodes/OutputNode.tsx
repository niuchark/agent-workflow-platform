/**
 * 输出节点：工作流终点，汇总最终输出。
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FlagOutlined } from '@ant-design/icons';
import BaseNode from './BaseNode';

/** 输出节点组件 */
const OutputNode = ({ id, data }: { id: string; data: any }) => {
  return (
    <BaseNode id={id} label={data.label || '结束'} icon={<FlagOutlined />} color="#059669">
      <Handle type="target" position={Position.Left} />
    </BaseNode>
  );
};

export default memo(OutputNode);
