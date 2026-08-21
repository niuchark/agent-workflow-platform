/**
 * 技能调用节点：执行内置或自定义工具。
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ToolOutlined } from '@ant-design/icons';
import BaseNode from './BaseNode';

/** 技能调用节点组件 */
const SkillNode = ({ id, data }: { id: string; data: any }) => {
  return (
    <BaseNode id={id} label={data.label || '工具调用'} icon={<ToolOutlined />} color="#0891b2" width={240}>
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Left} />
    </BaseNode>
  );
};

export default memo(SkillNode);
