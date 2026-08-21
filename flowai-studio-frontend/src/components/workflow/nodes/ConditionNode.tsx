/**
 * 条件分支节点：右侧提供"是/否"两个输出连接点。
 *
 * 连接点 id 分别为 true / false，连线时用 sourceHandle
 * 区分分支，并带有可见的文字标签与无障碍名称。
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ApartmentOutlined } from '@ant-design/icons';
import BaseNode from './BaseNode';

/** 条件分支节点组件 */
const ConditionNode = ({ id, data }: { id: string; data: any }) => {
  return (
    <BaseNode id={id} label={data.label || '条件分支'} icon={<ApartmentOutlined />} color="#dc2626">
      <span className="condition-handle-label condition-handle-label--true" style={{ top: '30%' }}>是</span>
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ top: '30%' }}
        aria-label="是分支输出接口"
        title="是分支"
      />
      <span className="condition-handle-label condition-handle-label--false" style={{ top: '70%' }}>否</span>
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        style={{ top: '70%' }}
        aria-label="否分支输出接口"
        title="否分支"
      />
      <Handle type="target" position={Position.Left} />
    </BaseNode>
  );
};

export default memo(ConditionNode);
