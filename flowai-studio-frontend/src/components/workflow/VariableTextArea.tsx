import React, { ChangeEvent, useMemo, useRef, useState } from 'react'
import { Form, Input, Select } from 'antd'
import { ExclamationCircleOutlined, FunctionOutlined } from '@ant-design/icons'
import type { TextAreaProps, TextAreaRef } from 'antd/es/input/TextArea'
import { WorkflowNode } from '../../types'
import {
  getInvalidVariableReferences,
  WorkflowVariableOption,
} from './variableUtils'

interface VariableTextAreaProps extends Omit<TextAreaProps, 'value' | 'onChange'> {
  value?: string
  onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void
  availableVariables: WorkflowVariableOption[]
  nodes: WorkflowNode[]
  variableLabel?: string
}

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
  const invalidReferences = useMemo(
    () => getInvalidVariableReferences(value, availableVariables, nodes),
    [availableVariables, nodes, value],
  )

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
