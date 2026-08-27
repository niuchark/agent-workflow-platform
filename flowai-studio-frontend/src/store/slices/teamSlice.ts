/**
 * 团队状态切片：管理团队、成员与应用授权。
 *
 * 覆盖三组操作：团队 CRUD、成员管理（加入/改角色/移除/退出）、
 * 团队应用授权（添加/调整权限/移除），状态保存在内存中，
 * 页面切换后通过 fetch 重新拉取。
 */
import { StateCreator } from 'zustand'
import { Team, TeamMember, TeamApplication, CreateTeamForm, UpdateTeamForm, AddMemberForm, UpdateMemberRoleForm, AddTeamAppForm, UpdateTeamAppPermissionForm } from '../../types'
import * as teamApi from '../../utils/teamApi'

/** 团队切片对外暴露的状态与 Actions 类型 */
export interface TeamSlice {
  teams: Team[]
  currentTeam: Team | null
  teamMembers: TeamMember[]
  teamApps: TeamApplication[]
  teamLoading: boolean

  // 团队操作
  setTeams: (teams: Team[]) => void
  setCurrentTeam: (team: Team | null) => void
  fetchMyTeams: () => Promise<Team[]>
  fetchTeam: (teamId: string) => Promise<Team>
  createTeam: (data: CreateTeamForm) => Promise<Team>
  updateTeam: (teamId: string, data: UpdateTeamForm) => Promise<Team>
  deleteTeam: (teamId: string) => Promise<void>

  // 成员操作
  addTeamMember: (teamId: string, data: AddMemberForm) => Promise<TeamMember>
  updateMemberRole: (teamId: string, memberId: string, data: UpdateMemberRoleForm) => Promise<TeamMember>
  removeTeamMember: (teamId: string, memberId: string) => Promise<void>
  leaveTeam: (teamId: string) => Promise<void>

  // 团队应用操作
  addTeamApp: (teamId: string, data: AddTeamAppForm) => Promise<TeamApplication>
  updateTeamAppPermission: (teamId: string, teamAppId: string, data: UpdateTeamAppPermissionForm) => Promise<TeamApplication>
  removeTeamApp: (teamId: string, teamAppId: string) => Promise<void>
}

/** 创建团队切片：提供团队、成员与应用授权三类操作 */
export const createTeamSlice: StateCreator<TeamSlice> = (set, get) => ({
  teams: [],
  currentTeam: null,
  teamMembers: [],
  teamApps: [],
  teamLoading: false,

  setTeams: (teams) => set({ teams }),
  setCurrentTeam: (team) => set({ currentTeam: team }),

  /** 拉取当前用户加入的团队列表 */
  fetchMyTeams: async () => {
    set({ teamLoading: true })
    try {
      const response = await teamApi.fetchMyTeams() as any
      const teams = (Array.isArray(response.data) ? response.data : []) as Team[]
      set({ teams, teamLoading: false })
      return teams
    } catch (error) {
      set({ teamLoading: false })
      throw error
    }
  },

  /** 按 ID 拉取团队详情，并同步成员与应用列表 */
  fetchTeam: async (teamId) => {
    set({ teamLoading: true })
    try {
      const response = await teamApi.fetchTeam(teamId) as any
      const team = response.data as Team
      set({
        currentTeam: team,
        teamMembers: team.members || [],
        teamApps: team.applications || [],
        teamLoading: false,
      })
      return team
    } catch (error) {
      set({ teamLoading: false })
      throw error
    }
  },

  /** 创建团队：成功后追加到列表末尾 */
  createTeam: async (data) => {
    set({ teamLoading: true })
    try {
      const response = await teamApi.createTeam(data) as any
      const team = response.data as Team
      const currentTeams = Array.isArray(get().teams) ? get().teams : []
      set({ teams: [...currentTeams, team], teamLoading: false })
      return team
    } catch (error) {
      set({ teamLoading: false })
      throw error
    }
  },

  /** 更新团队信息：同步更新列表与当前团队 */
  updateTeam: async (teamId, data) => {
    set({ teamLoading: true })
    try {
      const response = await teamApi.updateTeam(teamId, data) as any
      const updatedTeam = response.data as Team
      const currentTeams = Array.isArray(get().teams) ? get().teams : []
      set({
        teams: currentTeams.map((t) => (t.id === teamId ? updatedTeam : t)),
        currentTeam: get().currentTeam?.id === teamId ? updatedTeam : get().currentTeam,
        teamLoading: false,
      })
      return updatedTeam
    } catch (error) {
      set({ teamLoading: false })
      throw error
    }
  },

  /** 删除团队：从列表移除，若删除的是当前团队则清空 */
  deleteTeam: async (teamId) => {
    set({ teamLoading: true })
    try {
      await teamApi.deleteTeam(teamId)
      const currentTeams = Array.isArray(get().teams) ? get().teams : []
      set({
        teams: currentTeams.filter((t) => t.id !== teamId),
        currentTeam: get().currentTeam?.id === teamId ? null : get().currentTeam,
        teamLoading: false,
      })
    } catch (error) {
      set({ teamLoading: false })
      throw error
    }
  },

  /** 添加团队成员：成功后追加到成员列表 */
  addTeamMember: async (teamId, data) => {
    const response = await teamApi.addTeamMember(teamId, data) as any
    const member = response.data as TeamMember
    set({ teamMembers: [...get().teamMembers, member] })
    return member
  },

  /** 修改成员角色：用最新结果替换列表中的对应项 */
  updateMemberRole: async (teamId, memberId, data) => {
    const response = await teamApi.updateMemberRole(teamId, memberId, data) as any
    const updatedMember = response.data as TeamMember
    set({
      teamMembers: get().teamMembers.map((m) =>
        m.id === memberId ? updatedMember : m
      ),
    })
    return updatedMember
  },

  /** 移除团队成员 */
  removeTeamMember: async (teamId, memberId) => {
    await teamApi.removeTeamMember(teamId, memberId)
    set({ teamMembers: get().teamMembers.filter((m) => m.id !== memberId) })
  },

  /** 退出团队：从列表移除并清空当前团队 */
  leaveTeam: async (teamId) => {
    await teamApi.leaveTeam(teamId)
    const currentTeams = Array.isArray(get().teams) ? get().teams : []
    set({
      teams: currentTeams.filter((t) => t.id !== teamId),
      currentTeam: null,
    })
  },

  /** 把应用加入团队：成功后追加到应用列表 */
  addTeamApp: async (teamId, data) => {
    const response = await teamApi.addTeamApp(teamId, data) as any
    const teamApp = response.data as TeamApplication
    set({ teamApps: [...get().teamApps, teamApp] })
    return teamApp
  },

  /** 调整团队应用的访问权限 */
  updateTeamAppPermission: async (teamId, teamAppId, data) => {
    const response = await teamApi.updateTeamAppPermission(teamId, teamAppId, data) as any
    const updatedApp = response.data as TeamApplication
    set({
      teamApps: get().teamApps.map((a) =>
        a.id === teamAppId ? updatedApp : a
      ),
    })
    return updatedApp
  },

  /** 从团队移除应用授权 */
  removeTeamApp: async (teamId, teamAppId) => {
    await teamApi.removeTeamApp(teamId, teamAppId)
    set({ teamApps: get().teamApps.filter((a) => a.id !== teamAppId) })
  },
})
