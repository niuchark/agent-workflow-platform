import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { ApartmentOutlined } from '@ant-design/icons';
import BaseNode from './BaseNode';

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
