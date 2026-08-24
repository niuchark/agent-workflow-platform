/**
 * 变量输入框：带上游变量插入与失效引用校验的 TextArea 封装。
 *
 * - 支持通过右键菜单或显式按钮在光标位置插入 {{node.field}} 变量；
 * - 自动校验文本中的变量引用，失效时红框 + 提示；
 * - 变量选择器只展示已连接的上游节点输出。
 */
import React, { ChangeEvent, useMemo, useRef } from 'react'
import { Button, Dropdown, Form, Input } from 'antd'
import type { MenuProps } from 'antd'
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
  const selectionRef = useRef<{ start: number; end: number } | null>(null)
  const { status: formStatus, errors: formErrors } = Form.Item.useStatus()
  // 失效变量引用：随文本/可用变量变化实时重算
  const invalidReferences = useMemo(
    () => getInvalidVariableReferences(value, availableVariables, nodes),
    [availableVariables, nodes, value],
  )

  // 按上游节点分组变量，供右键与按钮菜单展示
  const variableGroups = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; options: Array<{ label: string; value: string }> }>()

    availableVariables.forEach((variable) => {
      const existing = groups.get(variable.nodeId) || {
        key: variable.nodeId,
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

  const variableMenuItems = useMemo<MenuProps['items']>(() => {
    if (variableGroups.length === 0) {
      return [{ key: 'empty', label: '暂无可用的上游变量', disabled: true }]
    }

    return variableGroups.map((group) => ({
      key: group.key,
      type: 'group',
      label: group.label,
      children: group.options.map((option) => ({
        key: option.value,
        label: option.label,
      })),
    }))
  }, [variableGroups])

  /** 记录当前选区，确保右键菜单或按钮获得焦点后仍能插回原光标位置 */
  const rememberSelection = () => {
    const textArea = textAreaRef.current?.resizableTextArea?.textArea
    if (!textArea) return
    selectionRef.current = {
      start: textArea.selectionStart,
      end: textArea.selectionEnd,
    }
  }

  /** 把选中的变量 token 插入到光标位置，并把光标移到插入内容之后 */
  const insertVariable = (token: string) => {
    const selection = selectionRef.current || { start: value.length, end: value.length }
    const { start, end } = selection
    const nextValue = `${value.slice(0, start)}${token}${value.slice(end)}`

    onChange?.({ target: { value: nextValue } } as ChangeEvent<HTMLTextAreaElement>)
    selectionRef.current = { start: start + token.length, end: start + token.length }

    requestAnimationFrame(() => {
      const nextTextArea = textAreaRef.current?.resizableTextArea?.textArea
      if (!nextTextArea) return
      const nextCursor = start + token.length
      nextTextArea.focus()
      nextTextArea.setSelectionRange(nextCursor, nextCursor)
    })
  }

  const variableMenu: MenuProps = {
    items: variableMenuItems,
    onClick: ({ key }) => {
      if (key !== 'empty') insertVariable(key)
    },
  }

  const placeholder = textAreaProps.placeholder
    ? `${textAreaProps.placeholder}；右键插入变量`
    : '右键插入变量'

  return (
    <div className="variable-field">
      <Dropdown menu={variableMenu} trigger={['contextMenu']}>
        <div className="variable-field-input-shell">
          <Input.TextArea
            {...textAreaProps}
            ref={textAreaRef}
            value={value}
            placeholder={placeholder}
            onChange={onChange}
            onClick={rememberSelection}
            onKeyUp={rememberSelection}
            onSelect={rememberSelection}
            onBlur={rememberSelection}
            onContextMenu={rememberSelection}
            status={invalidReferences.length > 0 || formStatus === 'error' ? 'error' : textAreaProps.status}
          />
        </div>
      </Dropdown>
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
        <span className="variable-field-hint">
          {availableVariables.length > 0 ? '右键可快速插入已连接的上游变量' : '连接并配置上游节点后可插入变量'}
        </span>
        <Dropdown menu={variableMenu} trigger={['click']} placement="bottomRight">
          <Button
            type="text"
            size="small"
            icon={<FunctionOutlined aria-hidden="true" />}
            disabled={availableVariables.length === 0}
            onMouseDown={rememberSelection}
          >
            {variableLabel}
          </Button>
        </Dropdown>
      </div>
    </div>
  )
}

export default VariableTextArea
