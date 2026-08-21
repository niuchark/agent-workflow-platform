/**
 * 变量输入框：带上游变量插入与失效引用校验的 TextArea 封装。
 *
 * - 支持在光标位置插入 {{node.field}} 变量；
 * - 自动校验文本中的变量引用，失效时红框 + 提示；
 * - 变量选择器只展示已连接的上游节点输出。
 */
import React, { ChangeEvent, useMemo, useRef, useState } from 'react'
import { Form, Input, Select } from 'antd'
import { ExclamationCircleOutlined, FunctionOutlined } from '@ant-design/icons'
import type { TextAreaProps, TextAreaRef } from 'antd/es/input/TextArea'
import { WorkflowNode } from '../../types'
import {
  getInvalidVariableReferences,
  WorkflowVariableOption,
} from './variableUtils'

/** 变量输入框 props：继承 TextArea 属性并补充变量相关能力 */
interface VariableTextAreaProps extends Omit<TextAreaProps, 'value' | 'onChange'> {
  value?: string
  onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void
  availableVariables: WorkflowVariableOption[]
  nodes: WorkflowNode[]
  variableLabel?: string
}

/** 变量输入框组件：文本编辑 + 变量插入 + 引用校验 */
const VariableTextArea: React.FC<VariableTextAreaProps> = ({
  value = '',
  onChange,
  availableVariables,
  nodes,
  variableLabel = '插入上游变量',
  ...textAreaProps
}) => {
  const textAreaRef = useRef<TextAreaRef>(null)
  const [pickerValue, setPickerValue] = useState<string>()
  const { status: formStatus, errors: formErrors } = Form.Item.useStatus()
  // 失效变量引用：随文本/可用变量变化实时重算
  const invalidReferences = useMemo(
    () => getInvalidVariableReferences(value, availableVariables, nodes),
    [availableVariables, nodes, value],
  )

  // 按上游节点分组变量，供 Select 分组展示
  const variableGroups = useMemo(() => {
    const groups = new Map<string, { label: string; options: Array<{ label: string; value: string }> }>()

    availableVariables.forEach((variable) => {
      const existing = groups.get(variable.nodeId) || {
        label: variable.nodeLabel,
        options: [],
      }
      existing.options.push({
        label: `${variable.fieldLabel}（${variable.field}）`,
        value: variable.token,
      })
      groups.set(variable.nodeId, existing)
    })

    return [...groups.values()]
  }, [availableVariables])

  /** 把选中的变量 token 插入到光标位置，并把光标移到插入内容之后 */
  const insertVariable = (token: string) => {
    const textArea = textAreaRef.current?.resizableTextArea?.textArea
    const start = textArea?.selectionStart ?? value.length
    const end = textArea?.selectionEnd ?? value.length
    const nextValue = `${value.slice(0, start)}${token}${value.slice(end)}`

    onChange?.({ target: { value: nextValue } } as ChangeEvent<HTMLTextAreaElement>)
    setPickerValue(undefined)

    requestAnimationFrame(() => {
      const nextTextArea = textAreaRef.current?.resizableTextArea?.textArea
      if (!nextTextArea) return
      const nextCursor = start + token.length
      nextTextArea.focus()
      nextTextArea.setSelectionRange(nextCursor, nextCursor)
    })
  }

  return (
    <div className="variable-field">
      <Input.TextArea
        {...textAreaProps}
        ref={textAreaRef}
        value={value}
        onChange={onChange}
        status={invalidReferences.length > 0 || formStatus === 'error' ? 'error' : textAreaProps.status}
      />
      {(formErrors.length > 0 || invalidReferences.length > 0) && (
        <div className="variable-field-messages" role="alert">
          {formErrors.map((error, index) => (
            <div className="variable-field-message" key={`form-error-${index}`}>
              <ExclamationCircleOutlined aria-hidden="true" />
              <span>{error}</span>
            </div>
          ))}
          {invalidReferences.length > 0 && (
            <div className="variable-field-message">
              <ExclamationCircleOutlined aria-hidden="true" />
              <span>
                变量引用无效：{invalidReferences.map((reference) => reference.token).join('、')}。
                请从下方重新选择。
              </span>
            </div>
          )}
        </div>
      )}
      <div className="variable-field-toolbar">
        <div className="variable-field-toolbar-heading">
          <span className="variable-field-toolbar-title">
            <FunctionOutlined aria-hidden="true" />
            {variableLabel}
          </span>
          <span className="variable-field-hint">仅显示已连接的上游节点</span>
        </div>
        <Select
          aria-label={variableLabel}
          className="variable-field-picker"
          value={pickerValue}
          onChange={(token) => {
            setPickerValue(token)
            insertVariable(token)
          }}
          options={variableGroups}
          optionFilterProp="label"
          showSearch
          allowClear
          disabled={availableVariables.length === 0}
          placeholder="选择变量并插入到光标位置"
          notFoundContent="没有匹配的变量"
        />
        {availableVariables.length === 0 && (
          <span className="variable-field-empty-hint">连接并配置上游节点后可选择变量</span>
        )}
      </div>
    </div>
  )
}

export default VariableTextArea
