import request from './axios'
import type {
  Team,
  CreateTeamForm,
  UpdateTeamForm,
  AddMemberForm,
  UpdateMemberRoleForm,
  TeamMember,
  AddTeamAppForm,
  UpdateTeamAppPermissionForm,
  TeamApplication,
  ApiKey,
  CreateApiKeyForm,
  ApiKeyCreatedResponse,
  AppShare,
  UpdateShareSettingsForm,
  EmbedCodeResponse,
} from '../types'

// ============ 团队 API ============

/** 创建团队 */
export const createTeam = (data: CreateTeamForm) =>
  request.post('/teams', data) as Promise<{ data: Team }>

/** 获取我的团队列表 */
export const fetchMyTeams = () =>
  request.get('/teams') as Promise<{ data: Team[] }>

/** 获取团队详情 */
export const fetchTeam = (teamId: string) =>
  request.get(`/teams/${teamId}`) as Promise<{ data: Team }>

/** 更新团队 */
export const updateTeam = (teamId: string, data: UpdateTeamForm) =>
  request.patch(`/teams/${teamId}`, data) as Promise<{ data: Team }>

/** 删除团队 */
export const deleteTeam = (teamId: string) =>
  request.delete(`/teams/${teamId}`) as Promise<void>

// ============ 团队成员 API ============

/** 添加成员 */
export const addTeamMember = (teamId: string, data: AddMemberForm) =>
  request.post(`/teams/${teamId}/members`, data) as Promise<{ data: TeamMember }>

/** 更新成员角色 */
export const updateMemberRole = (teamId: string, memberId: string, data: UpdateMemberRoleForm) =>
  request.patch(`/teams/${teamId}/members/${memberId}`, data) as Promise<{ data: TeamMember }>

/** 移除成员 */
export const removeTeamMember = (teamId: string, memberId: string) =>
  request.delete(`/teams/${teamId}/members/${memberId}`) as Promise<void>

/** 离开团队 */
export const leaveTeam = (teamId: string) =>
  request.post(`/teams/${teamId}/leave`) as Promise<void>

// ============ 团队应用 API ============

/** 添加应用到团队 */
export const addTeamApp = (teamId: string, data: AddTeamAppForm) =>
  request.post(`/teams/${teamId}/apps`, data) as Promise<{ data: TeamApplication }>

/** 更新团队应用权限 */
export const updateTeamAppPermission = (teamId: string, teamAppId: string, data: UpdateTeamAppPermissionForm) =>
  request.patch(`/teams/${teamId}/apps/${teamAppId}`, data) as Promise<{ data: TeamApplication }>

/** 从团队移除应用 */
export const removeTeamApp = (teamId: string, teamAppId: string) =>
  request.delete(`/teams/${teamId}/apps/${teamAppId}`) as Promise<void>

// ============ API 密钥 API ============

/** 创建 API 密钥 */
export const createApiKey = (data: CreateApiKeyForm) =>
  request.post('/api-keys', data) as Promise<{ data: ApiKeyCreatedResponse }>

/** 获取 API 密钥列表 */
export const fetchApiKeys = (applicationId?: string) => {
  const params = applicationId ? { applicationId } : {}
  return request.get('/api-keys', { params }) as Promise<{ data: ApiKey[] }>
}

/** 删除 API 密钥 */
export const deleteApiKey = (keyId: string) =>
  request.delete(`/api-keys/${keyId}`) as Promise<void>

/** 切换 API 密钥启用/禁用 */
export const toggleApiKey = (keyId: string, isActive: boolean) =>
  request.patch(`/api-keys/${keyId}/toggle`, { isActive }) as Promise<{ data: ApiKey }>

// ============ 应用分享 API ============

/** 生成分享链接 */
export const generateShareLink = (appId: string) =>
  request.post(`/apps/${appId}/share`) as Promise<{ data: AppShare }>

/** 获取分享信息 */
export const getShareInfo = (appId: string) =>
  request.get(`/apps/${appId}/share`) as Promise<{ data: AppShare }>

/** 更新分享设置 */
export const updateShareSettings = (appId: string, data: UpdateShareSettingsForm) =>
  request.patch(`/apps/${appId}/share`, data) as Promise<{ data: AppShare }>

/** 撤销分享链接 */
export const revokeShareLink = (appId: string) =>
  request.delete(`/apps/${appId}/share`) as Promise<void>

/** 获取嵌入代码 */
export const getEmbedCode = (appId: string) =>
  request.get(`/apps/${appId}/embed`) as Promise<{ data: EmbedCodeResponse }>

/** 获取公开分享的应用（无需认证） */
export const getSharedApp = (shareLink: string) =>
  request.get(`/share/${shareLink}`) as Promise<{ data: any }>
