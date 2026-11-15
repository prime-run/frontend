import {
  Box,
  Button,
  DialogContent,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { enqueueSnackbar } from "notistack";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  confirmTeamTransfer,
  deleteTeamTransfer,
  listPendingTeamTransfers,
} from "../../../api/api.ts";
import { PendingTeamTransferItem } from "../../../api/team.ts";
import { closePendingTeamSendsDialog } from "../../../redux/globalStateSlice.ts";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks.ts";
import DraggableDialog from "../../Dialogs/DraggableDialog.tsx";

const PendingTeamSendsDialog = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const open = useAppSelector((state) => state.globalState.pendingTeamSendsDialogOpen);
  const teamId = useAppSelector((state) => state.globalState.pendingTeamSendsTeamId);
  const teamName = useAppSelector((state) => state.globalState.pendingTeamSendsTeamName);

  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [items, setItems] = useState<PendingTeamTransferItem[]>([]);

  const onClose = useCallback(() => {
    if (!busyId) {
      dispatch(closePendingTeamSendsDialog());
    }
  }, [busyId, dispatch]);

  const refresh = useCallback(async () => {
    if (!teamId) {
      return;
    }
    setLoading(true);
    try {
      const res = await dispatch(listPendingTeamTransfers(teamId));
      setItems(res ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [dispatch, teamId]);

  useEffect(() => {
    if (!open || !teamId) {
      return;
    }
    refresh();
  }, [open, teamId, refresh]);

  const onConfirm = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        await dispatch(confirmTeamTransfer(id));
        enqueueSnackbar({
          message: t("application:fileManager.pendingSendConfirmed"),
          variant: "success",
        });
        await refresh();
      } catch {
        // error toast from request layer
      } finally {
        setBusyId(null);
      }
    },
    [dispatch, refresh, t],
  );

  const onReject = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        await dispatch(deleteTeamTransfer(id));
        enqueueSnackbar({
          message: t("application:fileManager.pendingSendRejected"),
          variant: "success",
        });
        await refresh();
      } catch {
        // error toast from request layer
      } finally {
        setBusyId(null);
      }
    },
    [dispatch, refresh, t],
  );

  return (
    <DraggableDialog
      title={t("application:fileManager.pendingSendsTitle", { team: teamName ?? "" })}
      showActions
      showCancel
      hideOk
      loading={loading}
      dialogProps={{
        open: open ?? false,
        onClose,
        fullWidth: true,
        maxWidth: "sm",
      }}
    >
      <DialogContent>
        {!loading && items.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            {t("application:fileManager.pendingSendsEmpty")}
          </Typography>
        )}
        <List disablePadding>
          {items.map((item) => (
            <ListItem
              key={item.id}
              disableGutters
              secondaryAction={
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={!!busyId}
                    onClick={() => onConfirm(item.id)}
                  >
                    {t("application:fileManager.pendingSendConfirm")}
                  </Button>
                  <Button
                    size="small"
                    color="inherit"
                    disabled={!!busyId}
                    onClick={() => onReject(item.id)}
                  >
                    {t("application:fileManager.pendingSendReject")}
                  </Button>
                </Stack>
              }
              sx={{ pr: 28, py: 1.5 }}
            >
              <ListItemText
                primary={item.source_file_name || t("application:fileManager.pendingSendUnknownFile")}
                secondary={
                  <Box component="span">
                    {t("application:fileManager.pendingSendMeta", {
                      team: item.dest_team_name,
                      nick: item.created_by_nick,
                      access: item.allow_write
                        ? t("application:fileManager.transferAccessWrite")
                        : t("application:fileManager.transferAccessReadOnly"),
                    })}
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
    </DraggableDialog>
  );
};

export default PendingTeamSendsDialog;
