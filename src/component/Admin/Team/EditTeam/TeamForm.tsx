import {
  Box,
  FormControl,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useCallback, useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { deleteTeamMember, upsertTeamMember } from "../../../../api/api.ts";
import { TeamRole } from "../../../../api/team.ts";
import { User } from "../../../../api/user.ts";
import { useAppDispatch } from "../../../../redux/hooks.ts";
import { confirmOperation } from "../../../../redux/thunks/dialog.ts";
import { loadUserTeams } from "../../../../redux/thunks/session.ts";
import {
  DenseFilledTextField,
  DenseSelect,
  NoWrapTableCell,
  NoWrapTypography,
  SecondaryButton,
  StyledTableContainerPaper,
} from "../../../Common/StyledComponents.tsx";
import SizeInput from "../../../Common/SizeInput";
import UserAvatar from "../../../Common/User/UserAvatar.tsx";
import Delete from "../../../Icons/Delete.tsx";
import SettingForm from "../../../Pages/Setting/SettingForm.tsx";
import { CapacityBar } from "../../../Pages/Setting/StorageSetting";
import UserSearchInput from "../../File/UserSearchInput.tsx";
import { NoMarginHelperText, SettingSection, SettingSectionContent } from "../../Settings/Settings.tsx";
import { TeamSettingContext } from "./TeamSettingWrapper.tsx";

const roles: TeamRole[] = ["owner", "admin", "member", "viewer"];

const TeamForm = () => {
  const { t } = useTranslation("dashboard");
  const dispatch = useAppDispatch();
  const { values, setTeam, reload, formRef } = useContext(TeamSettingContext);
  const [adding, setAdding] = useState(false);
  const [newMember, setNewMember] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<TeamRole>("member");
  const [memberBusy, setMemberBusy] = useState<string | null>(null);

  const onNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTeam((p) => ({ ...p, name: e.target.value }));
    },
    [setTeam],
  );

  const onMaxStorageChange = useCallback(
    (size: number) => {
      setTeam((p) => ({
        ...p,
        max_storage: size ? size : undefined,
      }));
    },
    [setTeam],
  );

  const onAddMember = () => {
    if (!newMember || !values.id) {
      return;
    }
    setAdding(true);
    dispatch(
      upsertTeamMember(values.id, {
        user_id: newMember.id,
        role: newRole,
      }),
    )
      .then(() => {
        setNewMember(null);
        setNewRole("member");
        reload();
        dispatch(loadUserTeams());
      })
      .finally(() => {
        setAdding(false);
      });
  };

  const onRoleChange = (userHashId: string, role: TeamRole) => {
    if (!values.id) {
      return;
    }
    setMemberBusy(userHashId);
    dispatch(upsertTeamMember(values.id, { user_id: userHashId, role }))
      .then(() => {
        reload();
        dispatch(loadUserTeams());
      })
      .finally(() => setMemberBusy(null));
  };

  const onRemove = (userHashId: string, nickname: string) => {
    if (!values.id) {
      return;
    }
    dispatch(confirmOperation(t("team.confirmRemoveMember", { user: nickname }))).then(() => {
      setMemberBusy(userHashId);
      dispatch(deleteTeamMember(values.id, userHashId))
        .then(() => {
          reload();
          dispatch(loadUserTeams());
        })
        .finally(() => setMemberBusy(null));
    });
  };

  const members = values.members ?? values.edges?.members ?? [];

  return (
    <Box>
      <form ref={formRef}>
        <SettingSection>
          <Typography variant="h6" gutterBottom>
            {t("policy.basicInfo")}
          </Typography>
          <SettingSectionContent>
            <SettingForm title={t("team.name")} lgWidth={5}>
              <FormControl fullWidth>
                <DenseFilledTextField required value={values.name} onChange={onNameChange} />
                <NoMarginHelperText>{t("team.nameDes")}</NoMarginHelperText>
              </FormControl>
            </SettingForm>
            {values.hash_id && (
              <SettingForm title={t("team.hashId")} lgWidth={5}>
                <DenseFilledTextField fullWidth value={values.hash_id} disabled />
                <NoMarginHelperText>{t("team.hashIdDes")}</NoMarginHelperText>
              </SettingForm>
            )}
            <SettingForm title={t("team.maxStorage")} lgWidth={5}>
              <FormControl fullWidth>
                <SizeInput
                  variant={"outlined"}
                  required
                  value={values.max_storage ?? 0}
                  onChange={onMaxStorageChange}
                />
                <NoMarginHelperText>{t("team.maxStorageDes")}</NoMarginHelperText>
              </FormControl>
            </SettingForm>
            {(values.max_storage ?? 0) > 0 && (
              <SettingForm title={t("application:vas.quota")} lgWidth={5}>
                <Box sx={{ mt: 1, width: "100%" }}>
                  <CapacityBar
                    forceRow
                    capacity={{
                      used: values.storage ?? 0,
                      total: values.max_storage ?? 0,
                    }}
                  />
                </Box>
              </SettingForm>
            )}
          </SettingSectionContent>
        </SettingSection>
      </form>

      <SettingSection sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          {t("team.members")}
        </Typography>
        <SettingSectionContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "flex-start" }} sx={{ mb: 2 }}>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <UserSearchInput onUserSelected={setNewMember} label={t("team.searchMember")} />
            </Box>
            <FormControl sx={{ minWidth: 140 }}>
              <DenseSelect value={newRole} onChange={(e) => setNewRole(e.target.value as TeamRole)}>
                {roles.map((role) => (
                  <MenuItem key={role} value={role}>
                    {t(`team.role_${role}`)}
                  </MenuItem>
                ))}
              </DenseSelect>
            </FormControl>
            <SecondaryButton
              variant="contained"
              disabled={!newMember || adding}
              onClick={onAddMember}
              sx={{ whiteSpace: "nowrap" }}
            >
              {t("team.addMember")}
            </SecondaryButton>
          </Stack>

          <TableContainer component={StyledTableContainerPaper}>
            <Table size="small" sx={{ width: "100%", tableLayout: "fixed" }}>
              <TableHead>
                <TableRow>
                  <NoWrapTableCell width={280}>{t("user.nick")}</NoWrapTableCell>
                  <NoWrapTableCell width={200}>{t("user.username")}</NoWrapTableCell>
                  <NoWrapTableCell width={140}>{t("team.role")}</NoWrapTableCell>
                  <NoWrapTableCell width={60}></NoWrapTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {members.map((member) => {
                  const hashId = member.user_hash_id ?? "";
                  const nick = member.nick ?? member.edges?.user?.nick ?? hashId;
                  const username = member.username ?? member.edges?.user?.username ?? "";
                  const busy = memberBusy === hashId;
                  return (
                    <TableRow key={member.id ?? hashId}>
                      <NoWrapTableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          {hashId && (
                            <UserAvatar
                              uid={hashId}
                              sx={{ width: 24, height: 24 }}
                              overwriteTextSize
                            />
                          )}
                          <NoWrapTypography variant="inherit">{nick}</NoWrapTypography>
                        </Box>
                      </NoWrapTableCell>
                      <NoWrapTableCell>
                        <NoWrapTypography variant="inherit" color="text.secondary">
                          {username || "—"}
                        </NoWrapTypography>
                      </NoWrapTableCell>
                      <NoWrapTableCell>
                        <DenseSelect
                          value={member.role}
                          disabled={busy || !hashId}
                          onChange={(e) => onRoleChange(hashId, e.target.value as TeamRole)}
                        >
                          {roles.map((role) => (
                            <MenuItem key={role} value={role}>
                              {t(`team.role_${role}`)}
                            </MenuItem>
                          ))}
                        </DenseSelect>
                      </NoWrapTableCell>
                      <NoWrapTableCell>
                        <IconButton
                          size="small"
                          disabled={busy || !hashId}
                          onClick={() => onRemove(hashId, nick)}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </NoWrapTableCell>
                    </TableRow>
                  );
                })}
                {members.length === 0 && (
                  <TableRow>
                    <NoWrapTableCell colSpan={4}>
                      <Typography variant="body2" color="text.secondary">
                        {t("team.noMembers")}
                      </Typography>
                    </NoWrapTableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </SettingSectionContent>
      </SettingSection>
    </Box>
  );
};

export default TeamForm;
