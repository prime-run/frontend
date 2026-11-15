import { Badge, Box } from "@mui/material";
import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { listPendingTeamTransfers } from "../../../api/api.ts";
import {
  setPendingTeamSendsCount,
  setPendingTeamSendsDialog,
} from "../../../redux/globalStateSlice.ts";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks.ts";
import SessionManager from "../../../session";
import SideNavItem from "../../Frame/NavBar/SideNavItem.tsx";
import PeopleTeamOutlined from "../../Icons/PeopleTeamOutlined.tsx";

const PendingTeamSendsNavItem = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const teams = useAppSelector((s) => s.globalState.teams);
  const count = useAppSelector((s) => s.globalState.pendingTeamSendsCount) ?? 0;
  const dialogOpen = useAppSelector((s) => s.globalState.pendingTeamSendsDialogOpen);
  const isLogin = !!SessionManager.currentLoginOrNull();

  const canApprove = useMemo(
    () => !!teams?.some((team) => team.role === "owner" || team.role === "admin"),
    [teams],
  );

  const refreshCount = useCallback(async () => {
    if (!isLogin || !canApprove) {
      dispatch(setPendingTeamSendsCount(0));
      return;
    }
    try {
      const items = await dispatch(listPendingTeamTransfers());
      dispatch(setPendingTeamSendsCount((items ?? []).length));
    } catch {
      dispatch(setPendingTeamSendsCount(0));
    }
  }, [canApprove, dispatch, isLogin]);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  // Refresh badge when the dialog closes after confirm/reject.
  useEffect(() => {
    if (!dialogOpen) {
      refreshCount();
    }
  }, [dialogOpen, refreshCount]);

  const onClick = useCallback(() => {
    dispatch(setPendingTeamSendsDialog({ open: true }));
  }, [dispatch]);

  if (!isLogin || !canApprove) {
    return null;
  }

  return (
    <Box sx={{ px: 0.5 }}>
      <SideNavItem
        level={0}
        onClick={onClick}
        icon={
          <Badge
            color="error"
            badgeContent={count}
            max={99}
            invisible={count <= 0}
            sx={{
              "& .MuiBadge-badge": {
                fontSize: "0.65rem",
                height: 16,
                minWidth: 16,
                right: -2,
                top: 2,
              },
            }}
          >
            <PeopleTeamOutlined fontSize="small" sx={{ width: 20, height: 20 }} />
          </Badge>
        }
        label={t("application:fileManager.pendingSends")}
      />
    </Box>
  );
};

export default PendingTeamSendsNavItem;
