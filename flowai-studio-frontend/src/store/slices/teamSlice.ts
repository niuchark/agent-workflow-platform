import { StateCreator } from 'zustand'
import { Team, TeamMember, TeamApplication, CreateTeamForm, UpdateTeamForm, AddMemberForm, UpdateMemberRoleForm, AddTeamAppForm, UpdateTeamAppPermissionForm } from '../../types'
import * as teamApi from '../../utils/teamApi'

export interface TeamSlice {
  teams: Team[]
  currentTeam: Team | null
  teamMembers: TeamMember[]
  teamApps: TeamApplication[]
  isLoading: boolean

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

export const createTeamSlice: StateCreator<TeamSlice> = (set, get) => ({
  teams: [],
  currentTeam: null,
  teamMembers: [],
  teamApps: [],
  isLoading: false,

  setTeams: (teams) => set({ teams }),
  setCurrentTeam: (team) => set({ currentTeam: team }),

  fetchMyTeams: async () => {
    set({ isLoading: true })
    try {
      const response = await teamApi.fetchMyTeams() as any
      const teams = (Array.isArray(response.data) ? response.data : []) as Team[]
      set({ teams, isLoading: false })
      return teams
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  fetchTeam: async (teamId) => {
    set({ isLoading: true })
    try {
      const response = await teamApi.fetchTeam(teamId) as any
      const team = response.data as Team
      set({
        currentTeam: team,
        teamMembers: team.members || [],
        teamApps: team.applications || [],
        isLoading: false,
      })
      return team
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  createTeam: async (data) => {
    set({ isLoading: true })
    try {
      const response = await teamApi.createTeam(data) as any
      const team = response.data as Team
      const currentTeams = Array.isArray(get().teams) ? get().teams : []
      set({ teams: [...currentTeams, team], isLoading: false })
      return team
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  updateTeam: async (teamId, data) => {
    set({ isLoading: true })
    try {
      const response = await teamApi.updateTeam(teamId, data) as any
      const updatedTeam = response.data as Team
      const currentTeams = Array.isArray(get().teams) ? get().teams : []
      set({
        teams: currentTeams.map((t) => (t.id === teamId ? updatedTeam : t)),
        currentTeam: get().currentTeam?.id === teamId ? updatedTeam : get().currentTeam,
        isLoading: false,
      })
      return updatedTeam
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  deleteTeam: async (teamId) => {
    set({ isLoading: true })
    try {
      await teamApi.deleteTeam(teamId)
      const currentTeams = Array.isArray(get().teams) ? get().teams : []
      set({
        teams: currentTeams.filter((t) => t.id !== teamId),
        currentTeam: get().currentTeam?.id === teamId ? null : get().currentTeam,
        isLoading: false,
      })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  addTeamMember: async (teamId, data) => {
    try {
      const response = await teamApi.addTeamMember(teamId, data) as any
      const member = response.data as TeamMember
      set({ teamMembers: [...get().teamMembers, member] })
      return member
    } catch (error) {
      throw error
    }
  },

  updateMemberRole: async (teamId, memberId, data) => {
    try {
      const response = await teamApi.updateMemberRole(teamId, memberId, data) as any
      const updatedMember = response.data as TeamMember
      set({
        teamMembers: get().teamMembers.map((m) =>
          m.id === memberId ? updatedMember : m
        ),
      })
      return updatedMember
    } catch (error) {
      throw error
    }
  },

  removeTeamMember: async (teamId, memberId) => {
    try {
      await teamApi.removeTeamMember(teamId, memberId)
      set({ teamMembers: get().teamMembers.filter((m) => m.id !== memberId) })
    } catch (error) {
      throw error
    }
  },

  leaveTeam: async (teamId) => {
    try {
      await teamApi.leaveTeam(teamId)
      const currentTeams = Array.isArray(get().teams) ? get().teams : []
      set({
        teams: currentTeams.filter((t) => t.id !== teamId),
        currentTeam: null,
      })
    } catch (error) {
      throw error
    }
  },

  addTeamApp: async (teamId, data) => {
    try {
      const response = await teamApi.addTeamApp(teamId, data) as any
      const teamApp = response.data as TeamApplication
      set({ teamApps: [...get().teamApps, teamApp] })
      return teamApp
    } catch (error) {
      throw error
    }
  },

  updateTeamAppPermission: async (teamId, teamAppId, data) => {
    try {
      const response = await teamApi.updateTeamAppPermission(teamId, teamAppId, data) as any
      const updatedApp = response.data as TeamApplication
      set({
        teamApps: get().teamApps.map((a) =>
          a.id === teamAppId ? updatedApp : a
        ),
      })
      return updatedApp
    } catch (error) {
      throw error
    }
  },

  removeTeamApp: async (teamId, teamAppId) => {
    try {
      await teamApi.removeTeamApp(teamId, teamAppId)
      set({ teamApps: get().teamApps.filter((a) => a.id !== teamAppId) })
    } catch (error) {
      throw error
    }
  },
})
