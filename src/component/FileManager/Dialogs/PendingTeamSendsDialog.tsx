import {
  Box,
  Button,
  Chip,
  DialogContent,
  Divider,
  List,
  ListItem,
  Stack,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { enqueueSnackbar } from "notistack";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  confirmTeamTransfer,
  deleteTeamTransfer,
  listPendingTeamTransfers,
} from "../../../api/api.ts";
import { PendingTeamTransferItem } from "../../../api/team.ts";
import {
  closePendingTeamSendsDialog,
  setPendingTeamSendsCount,
} from "../../../redux/globalStateSlice.ts";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks.ts";
import { sizeToString } from "../../../util";
import TimeBadge from "../../Common/TimeBadge.tsx";
import DraggableDialog from "../../Dialogs/DraggableDialog.tsx";

const PendingTeamSendsDialog = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const open = useAppSelector((state) => state.globalState.pendingTeamSendsDialogOpen);

  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [items, setItems] = useState<PendingTeamTransferItem[]>([]);

  const onClose = useCallback(() => {
    if (!busyId) {
      dispatch(closePendingTeamSendsDialog());
    }
  }, [busyId, dispatch]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dispatch(listPendingTeamTransfers());
      const next = res ?? [];
      setItems(next);
      dispatch(setPendingTeamSendsCount(next.length));
    } catch {
      // Keep the previous list and badge count on a failed refresh.
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    if (!open) {
      return;
    }
    refresh();
  }, [open, refresh]);

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

  const senderLabel = (item: PendingTeamTransferItem) => {
    const nick = item.created_by_nick?.trim();
    const username = item.created_by_username?.trim();
    if (nick && username && nick !== username) {
      return `${nick} (@${username})`;
    }
    return nick || username || t("application:fileManager.pendingSendUnknownUser");
  };

  return (
    <DraggableDialog
      title={t("application:fileManager.pendingSends")}
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
          {items.map((item, index) => (
            <Box key={item.id}>
              {index > 0 && <Divider sx={{ my: 1 }} />}
              <ListItem
                disableGutters
                alignItems="flex-start"
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  gap: 1.25,
                  py: 1.5,
                }}
              >
                <Stack spacing={0.75} sx={{ width: "100%" }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="subtitle2" sx={{ wordBreak: "break-word" }}>
                      {item.source_found
                        ? item.source_file_name
                        : t("application:fileManager.pendingSendUnknownFile")}
                    </Typography>
                    {item.source_found && (
                      <Chip
                        size="small"
                        label={
                          item.source_is_dir
                            ? t("application:fileManager.pendingSendFolder")
                            : t("application:fileManager.pendingSendFile")
                        }
                      />
                    )}
                    <Chip
                      size="small"
                      color={item.allow_write ? "warning" : "default"}
                      label={
                        item.allow_write
                          ? t("application:fileManager.transferAccessWrite")
                          : t("application:fileManager.transferAccessReadOnly")
                      }
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {t("application:fileManager.pendingSendSharedBy", {
                      user: senderLabel(item),
                    })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t("application:fileManager.pendingSendFromTo", {
                      from: item.source_team_name || "—",
                      to: item.dest_team_name || "—",
                    })}
                  </Typography>
                  <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                    {item.source_found && !item.source_is_dir && (
                      <Typography variant="caption" color="text.secondary">
                        {t("application:fileManager.pendingSendSize", {
                          size: sizeToString(item.source_size ?? 0),
                        })}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" component="span">
                      {t("application:fileManager.pendingSendRequested")}{" "}
                      <TimeBadge
                        variant="caption"
                        datetime={dayjs.unix(item.created_at)}
                        component="span"
                      />
                    </Typography>
                  </Stack>
                </Stack>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
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
              </ListItem>
            </Box>
          ))}
        </List>
      </DialogContent>
    </DraggableDialog>
  );
};

export default PendingTeamSendsDialog;
