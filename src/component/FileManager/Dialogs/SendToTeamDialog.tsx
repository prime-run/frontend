import { Autocomplete, Checkbox, DialogContent, FormControlLabel, Stack, TextField } from "@mui/material";
import { enqueueSnackbar } from "notistack";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getTeamDirectory, sendTeamTransfer } from "../../../api/api.ts";
import { FileResponse } from "../../../api/explorer.ts";
import { TeamDirectoryEntry } from "../../../api/team.ts";
import { closeSendToTeamDialog } from "../../../redux/globalStateSlice.ts";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks.ts";
import DraggableDialog from "../../Dialogs/DraggableDialog.tsx";

const SendToTeamDialog = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const open = useAppSelector((state) => state.globalState.sendToTeamDialogOpen);
  const files = useAppSelector((state) => state.globalState.sendToTeamDialogFiles);

  const [loading, setLoading] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [teams, setTeams] = useState<TeamDirectoryEntry[]>([]);
  const [selected, setSelected] = useState<TeamDirectoryEntry | null>(null);
  const [allowWrite, setAllowWrite] = useState(false);

  const onClose = useCallback(() => {
    if (!loading) {
      dispatch(closeSendToTeamDialog());
    }
  }, [dispatch, loading]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelected(null);
    setAllowWrite(false);
    setLoadingTeams(true);
    dispatch(getTeamDirectory())
      .then((res) => setTeams(res ?? []))
      .catch(() => setTeams([]))
      .finally(() => setLoadingTeams(false));
  }, [open, dispatch]);

  const onAccept = useCallback(async () => {
    if (!selected || !files?.length) {
      return;
    }
    setLoading(true);
    try {
      await dispatch(
        sendTeamTransfer({
          uris: files.map((f: FileResponse) => f.path),
          dst_team_id: selected.id,
          allow_write: allowWrite,
        }),
      );
      enqueueSnackbar({
        message: t("application:fileManager.sendToTeamSuccess", {
          team: selected.name,
          count: files.length,
        }),
        variant: "success",
      });
      dispatch(closeSendToTeamDialog());
    } catch {
      // error toast handled by request layer
    } finally {
      setLoading(false);
    }
  }, [allowWrite, dispatch, files, selected, t]);

  return (
    <DraggableDialog
      title={t("application:fileManager.sendToTeam")}
      showActions
      loading={loading}
      showCancel
      disabled={!selected}
      onAccept={onAccept}
      dialogProps={{
        open: open ?? false,
        onClose: onClose,
        fullWidth: true,
        maxWidth: "xs",
      }}
    >
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Autocomplete
            options={teams}
            loading={loadingTeams}
            value={selected}
            onChange={(_e, v) => setSelected(v)}
            getOptionLabel={(o) => o.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => (
              <TextField
                {...params}
                variant="filled"
                label={t("application:fileManager.sendToTeamDestination")}
                margin="dense"
              />
            )}
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={allowWrite}
                onChange={(e) => setAllowWrite(e.target.checked)}
              />
            }
            label={t("application:fileManager.sendToTeamAllowWrite")}
          />
        </Stack>
      </DialogContent>
    </DraggableDialog>
  );
};

export default SendToTeamDialog;
