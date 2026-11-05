import { User } from "./dashboard.ts";
import { PaginationResults } from "./explorer.ts";

export type TeamRole = "owner" | "admin" | "member";

/** Current user's team membership (GET /api/v4/team). */
export interface UserTeam {
  id: string;
  name: string;
  role: TeamRole;
}

export interface TeamMemberEnt {
  id?: number;
  user_id: number;
  role: TeamRole;
  edges?: {
    user?: User;
  };
  user_hash_id?: string;
}

export interface TeamEnt {
  id: number;
  name: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
  root_file_id?: number;
  edges?: {
    members?: TeamMemberEnt[];
  };
  member_count?: number;
  hash_id?: string;
}

export interface AdminListTeamResponse {
  teams: TeamEnt[];
  pagination: PaginationResults;
}

export interface UpsertTeamService {
  team: {
    id?: number;
    name: string;
  };
  /** Hash ID of the user seeded as owner on create. Defaults to current admin. */
  owner_id?: string;
}

export interface UpsertTeamMemberService {
  user_id: string;
  role: TeamRole;
}
