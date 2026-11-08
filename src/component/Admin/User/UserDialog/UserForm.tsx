import { OpenInNew } from "@mui/icons-material";
import {
  Box,
  Collapse,
  Divider,
  FormControl,
  Grid2 as Grid,
  IconButton,
  Link,
  ListItemText,
  MenuItem,
  SelectChangeEvent,
  Stack,
  Table,
  TableBody,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getTeamList, sendCalibrateUserStorage } from "../../../../api/api";
import { UserStatus } from "../../../../api/dashboard";
import { TeamEnt, TeamRole, UserTeamMembership } from "../../../../api/team";
import { useAppDispatch } from "../../../../redux/hooks";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, USERNAME_PATTERN } from "../../../../util/username.ts";
import { DefaultCloseAction } from "../../../Common/Snackbar/snackbar";
import {
  DenseFilledTextField,
  DenseSelect,
  NoWrapTableCell,
  NoWrapTypography,
  SecondaryButton,
  StyledTableContainerPaper,
} from "../../../Common/StyledComponents";
import UserAvatar from "../../../Common/User/UserAvatar";
import { SquareMenuItem } from "../../../FileManager/ContextMenu/ContextMenu";
import Delete from "../../../Icons/Delete";
import SettingForm, { ProChip } from "../../../Pages/Setting/SettingForm";
import { CapacityBar } from "../../../Pages/Setting/StorageSetting";
import GroupSelectionInput from "../../Common/GroupSelectionInput";
import ProDialog from "../../Common/ProDialog";
import { NoMarginHelperText } from "../../Settings/Settings";
import { UserDialogContext } from "./UserDialog";

const teamRoles: TeamRole[] = ["owner", "admin", "member"];

const UserForm = ({ reload, setLoading }: { reload: () => void; setLoading: (loading: boolean) => void }) => {
  const dispatch = useAppDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { t } = useTranslation("dashboard");
  const { formRef, values, setUser } = useContext(UserDialogContext);
  const [proOpen, setProOpen] = useState(false);
  const [allTeams, setAllTeams] = useState<TeamEnt[]>([]);
  const [newTeamHashId, setNewTeamHashId] = useState("");
  const [newTeamRole, setNewTeamRole] = useState<TeamRole>("member");

  useEffect(() => {
    dispatch(
      getTeamList({
        page: 1,
        page_size: 1000,
        order_by: "id",
        order_direction: "asc",
      }),
    ).then((res) => setAllTeams(res.teams ?? []));
  }, [dispatch]);

  const memberships = values.teams ?? [];

  const availableTeams = useMemo(() => {
    const assigned = new Set(memberships.map((m) => m.id));
    return allTeams.filter((t) => t.hash_id && !assigned.has(t.hash_id));
  }, [allTeams, memberships]);

  const setTeams = useCallback(
    (next: UserTeamMembership[]) => {
      setUser((prev) => ({ ...prev, teams: next }));
    },
    [setUser],
  );

  const removeAvatar = useCallback(() => {
    setUser((prev) => ({ ...prev, avatar: undefined }));
  }, [setUser]);

  const onUsernameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setUser((prev) => ({ ...prev, username: e.target.value }));
    },
    [setUser],
  );

  const onNickChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setUser((prev) => ({ ...prev, nick: e.target.value }));
    },
    [setUser],
  );

  const onStatusChange = useCallback(
    (e: SelectChangeEvent<unknown>) => {
      setUser((prev) => ({ ...prev, status: e.target.value as UserStatus }));
    },
    [setUser],
  );

  const onGroupChange = useCallback(
    (value: string) => {
      setUser((prev) => ({ ...prev, group_users: parseInt(value) }));
    },
    [setUser],
  );

  const onPasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setUser((prev) => ({ ...prev, password: e.target.value ? e.target.value : undefined }));
    },
    [setUser],
  );

  const onReset2FA = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      setUser((prev) => ({ ...prev, two_fa_enabled: false }));
    },
    [setUser],
  );

  const onCalibrateStorage = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      setLoading(true);
      dispatch(sendCalibrateUserStorage(values.id))
        .then(() => {
          reload();
          enqueueSnackbar({
            message: t("user.calibrateStorageSuccess"),
            variant: "success",
            action: DefaultCloseAction,
          });
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [dispatch, values.id],
  );

  const onAddTeam = () => {
    if (!newTeamHashId) {
      return;
    }
    const team = allTeams.find((t) => t.hash_id === newTeamHashId);
    if (!team?.hash_id) {
      return;
    }
    setTeams([
      ...memberships,
      {
        id: team.hash_id,
        name: team.name,
        role: newTeamRole,
      },
    ]);
    setNewTeamHashId("");
    setNewTeamRole("member");
  };

  const onTeamRoleChange = (teamId: string, role: TeamRole) => {
    setTeams(memberships.map((m) => (m.id === teamId ? { ...m, role } : m)));
  };

  const onRemoveTeam = (teamId: string) => {
    setTeams(memberships.filter((m) => m.id !== teamId));
  };

  return (
    <Box component={"form"} ref={formRef} onSubmit={(e) => e.preventDefault()}>
      <ProDialog open={proOpen} onClose={() => setProOpen(false)} />
      <Stack spacing={isMobile ? 2 : 3} direction={isMobile ? "column" : "row"}>
        <Stack spacing={isMobile ? 2 : 3} direction={"column"} sx={{ minWidth: 200 }}>
          <SettingForm title={t("user.avatar")} noContainer lgWidth={12}>
            <UserAvatar
              square
              overwriteTextSize
              sx={{
                width: 150,
                height: 150,
              }}
              user={{
                created_at: values.created_at,
                nickname: values.nick ?? "",
                id: values.avatar ? values.hash_id ?? "" : "dummy",
              }}
            />
            <Collapse in={!!values.avatar} unmountOnExit>
              <SecondaryButton sx={{ mt: 1 }} onClick={removeAvatar} variant="contained" startIcon={<Delete />}>
                {t("user.removeAvatar")}
              </SecondaryButton>
            </Collapse>
          </SettingForm>
          <SettingForm title={t("user.id")} noContainer lgWidth={12}>
            <Typography variant="body2" color="text.secondary">
              {t("user.idValue", { id: values.id, hash_id: values.hash_id })}
            </Typography>
          </SettingForm>
          <SettingForm title={t("application:vas.quota")} noContainer lgWidth={12}>
            <Box sx={{ mt: 1, width: "100%" }}>
              <CapacityBar forceRow capacity={values.capacity} />
            </Box>
            <Typography variant="body2" sx={{ mt: 1 }}>
              <Link href="#/" onClick={onCalibrateStorage} underline="hover">
                {t("user.calibrateStorage")}
              </Link>
            </Typography>
          </SettingForm>
          <Box>
            <SecondaryButton
              sx={{ mt: 1 }}
              onClick={() => setProOpen(true)}
              variant="contained"
              startIcon={<OpenInNew />}
            >
              {t("user.openUserFiles")} <ProChip label="Pro" color="primary" size="small" />
            </SecondaryButton>
          </Box>
        </Stack>
        <Divider orientation="vertical" flexItem />
        <Box sx={{ flexGrow: 1 }}>
          <Grid container spacing={isMobile ? 2 : 3}>
            <SettingForm title={t("user.username")} noContainer lgWidth={6}>
              <DenseFilledTextField
                fullWidth
                type="text"
                value={values.username}
                required
                onChange={onUsernameChange}
                slotProps={{
                  htmlInput: {
                    minLength: USERNAME_MIN_LENGTH,
                    maxLength: USERNAME_MAX_LENGTH,
                    pattern: USERNAME_PATTERN,
                    autoComplete: "username",
                    title: t("application:login.usernameInvalid"),
                  },
                }}
              />
            </SettingForm>
            <SettingForm title={t("user.nick")} noContainer lgWidth={6}>
              <DenseFilledTextField fullWidth value={values.nick} required onChange={onNickChange} />
            </SettingForm>
            <SettingForm title={t("user.userStatus")} noContainer lgWidth={6}>
              <FormControl fullWidth>
                <DenseSelect value={values.status} onChange={onStatusChange}>
                  {Object.values(UserStatus).map((value) => (
                    <SquareMenuItem value={value} key={value}>
                      <ListItemText slotProps={{ primary: { variant: "body2" } }}>
                        {t(`user.status_${value}`)}
                      </ListItemText>
                    </SquareMenuItem>
                  ))}
                </DenseSelect>
              </FormControl>
            </SettingForm>
            <SettingForm title={t("user.group")} noContainer lgWidth={6}>
              <GroupSelectionInput value={values.group_users?.toString() ?? ""} onChange={onGroupChange} fullWidth />
            </SettingForm>
            <SettingForm title={t("application:vas.points")} noContainer lgWidth={6} pro>
              <DenseFilledTextField
                slotProps={{
                  htmlInput: {
                    type: "number",
                    min: 0,
                    readOnly: true,
                  },
                }}
                fullWidth
                value={0}
              />
            </SettingForm>
            <SettingForm title={t("user.password")} noContainer lgWidth={6}>
              <DenseFilledTextField
                placeholder={t("user.passwordDes")}
                fullWidth
                value={values.password ?? ""}
                slotProps={{
                  htmlInput: {
                    minLength: 6,
                  },
                }}
                onChange={onPasswordChange}
                type={"password"}
              />
            </SettingForm>
            <SettingForm title={t("user.originUserGroup")} noContainer lgWidth={6} pro>
              <GroupSelectionInput
                value={" "}
                onChange={() => {}}
                emptyText={t("user.noOriginUserGroup")}
                emptyValue={" "}
                fullWidth
              />
              <NoMarginHelperText>{t("user.originUserGroupDes")}</NoMarginHelperText>
            </SettingForm>
            <SettingForm title={t("user.groupExpired")} noContainer lgWidth={6} pro>
              <DenseFilledTextField fullWidth value={""} />
              <NoMarginHelperText>{t("user.groupExpiredDes")}</NoMarginHelperText>
            </SettingForm>
            <SettingForm title={t("user.createdAt")} noContainer lgWidth={6}>
              <DenseFilledTextField
                fullWidth
                value={values.created_at ?? ""}
                slotProps={{ htmlInput: { readOnly: true } }}
              />
            </SettingForm>
            <SettingForm title={t("user.2FA")} noContainer lgWidth={6}>
              <Typography variant="body2" color="text.secondary">
                {values.two_fa_enabled ? t("user.2FAEnabled") : t("user.notEnabled")}
                {values.two_fa_enabled && (
                  <Link href="#/" onClick={onReset2FA} sx={{ ml: 1 }} underline="hover">
                    {t("user.reset2Fa")}
                  </Link>
                )}
              </Typography>
            </SettingForm>
            <SettingForm title={t("user.teams")} noContainer lgWidth={12}>
              <NoMarginHelperText sx={{ mb: 1 }}>{t("user.teamsDes")}</NoMarginHelperText>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1 }}>
                <FormControl fullWidth sx={{ flex: 1 }}>
                  <DenseSelect
                    displayEmpty
                    value={newTeamHashId}
                    onChange={(e) => setNewTeamHashId(e.target.value as string)}
                  >
                    <MenuItem value="">
                      <em>{t("user.selectTeam")}</em>
                    </MenuItem>
                    {availableTeams.map((team) => (
                      <MenuItem key={team.hash_id} value={team.hash_id}>
                        {team.name}
                      </MenuItem>
                    ))}
                  </DenseSelect>
                </FormControl>
                <FormControl sx={{ minWidth: 140 }}>
                  <DenseSelect
                    value={newTeamRole}
                    onChange={(e) => setNewTeamRole(e.target.value as TeamRole)}
                  >
                    {teamRoles.map((role) => (
                      <MenuItem key={role} value={role}>
                        {t(`team.role_${role}`)}
                      </MenuItem>
                    ))}
                  </DenseSelect>
                </FormControl>
                <SecondaryButton
                  variant="contained"
                  disabled={!newTeamHashId}
                  onClick={onAddTeam}
                  sx={{ whiteSpace: "nowrap" }}
                >
                  {t("team.addMember")}
                </SecondaryButton>
              </Stack>
              <TableContainer component={StyledTableContainerPaper}>
                <Table size="small" sx={{ width: "100%", tableLayout: "fixed" }}>
                  <TableHead>
                    <TableRow>
                      <NoWrapTableCell>{t("team.name")}</NoWrapTableCell>
                      <NoWrapTableCell width={140}>{t("team.role")}</NoWrapTableCell>
                      <NoWrapTableCell width={60}></NoWrapTableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {memberships.map((m) => (
                      <TableRow key={m.id}>
                        <NoWrapTableCell>
                          <NoWrapTypography variant="inherit">{m.name || m.id}</NoWrapTypography>
                        </NoWrapTableCell>
                        <NoWrapTableCell>
                          <DenseSelect
                            value={m.role}
                            onChange={(e) => onTeamRoleChange(m.id, e.target.value as TeamRole)}
                          >
                            {teamRoles.map((role) => (
                              <MenuItem key={role} value={role}>
                                {t(`team.role_${role}`)}
                              </MenuItem>
                            ))}
                          </DenseSelect>
                        </NoWrapTableCell>
                        <NoWrapTableCell>
                          <IconButton size="small" onClick={() => onRemoveTeam(m.id)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </NoWrapTableCell>
                      </TableRow>
                    ))}
                    {memberships.length === 0 && (
                      <TableRow>
                        <NoWrapTableCell colSpan={3}>
                          <Typography variant="body2" color="text.secondary">
                            {t("user.noTeams")}
                          </Typography>
                        </NoWrapTableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </SettingForm>
          </Grid>
        </Box>
      </Stack>
    </Box>
  );
};

export default UserForm;
