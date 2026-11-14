import { User } from "./dashboard.ts";
import { PaginationResults } from "./explorer.ts";

export type TeamRole = "owner" | "admin" | "member" | "viewer";

/** Current user's team membership (GET /api/v4/team). */
export interface UserTeam {
  id: string;
  name: string;
  role: TeamRole;
}

/** Lightweight team entry for send-to-team picker (GET /api/v4/team/directory). */
export interface TeamDirectoryEntry {
  id: string;
  name: string;
}

export interface CreateTeamTransferService {
  uris: string[];
  dst_team_id: string;
  allow_write?: boolean;
}

export interface TeamTransferResponse {
  id: string;
  dest_path: string;
  source_uri: string;
  allow_write: boolean;
  from_team: string;
  from_team_name: string;
}

export interface TeamMemberEnt {
  id?: number;
  user_id: number;
  role: TeamRole;
  edges?: {
    user?: User;
  };
  user_hash_id?: string;
  username?: string;
  nick?: string;
}

export interface TeamEnt {
  id: number;
  name: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
  root_file_id?: number;
  /** Shared storage quota for the team drive (bytes). */
  max_storage?: number;
  /** Used shared storage under the team root (bytes). */
  storage?: number;
  /** Enriched members from admin get/list (preferred). */
  members?: TeamMemberEnt[];
  edges?: {
    members?: TeamMemberEnt[];
  };
  member_count?: number;
  hash_id?: string;
}

/** Admin user ↔ team assignment (hash team id + role). */
export interface UserTeamMembership {
  id: string;
  name?: string;
  role: TeamRole;
}

export interface AdminListTeamResponse {
  teams: TeamEnt[];
  pagination: PaginationResults;
}

export interface CreateTeamService {
  name: string;
  max_storage?: number;
}

export interface RenameTeamService {
  name: string;
  max_storage?: number;
  clear_max_storage?: boolean;
}

export interface UpsertTeamMemberService {
  /** User hash ID (same as /user/search). */
  user_id: string;
  role: TeamRole;
}
