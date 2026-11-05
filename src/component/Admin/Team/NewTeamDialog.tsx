import { DialogContent, Stack } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { createTeam } from "../../../api/api";
import { useAppDispatch } from "../../../redux/hooks";
import { loadUserTeams } from "../../../redux/thunks/session";
import { DenseFilledTextField } from "../../Common/StyledComponents";
import DraggableDialog from "../../Dialogs/DraggableDialog";
import SettingForm from "../../Pages/Setting/SettingForm";
import { NoMarginHelperText } from "../Settings/Settings";

export interface NewTeamDialogProps {
  open: boolean;
  onClose: () => void;
}

const NewTeamDialog = ({ open, onClose }: NewTeamDialogProps) => {
  const { t } = useTranslation("dashboard");
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
    }
  }, [open]);

  const handleSubmit = () => {
    if (!formRef.current?.checkValidity()) {
      formRef.current?.reportValidity();
      return;
    }

    setLoading(true);
    dispatch(createTeam({ name }))
      .then((r) => {
        dispatch(loadUserTeams());
        navigate(`/admin/team/${r.id}`);
        onClose();
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <DraggableDialog
      onAccept={handleSubmit}
      loading={loading}
      title={t("team.new")}
      showActions
      showCancel
      dialogProps={{
        open,
        onClose,
        fullWidth: true,
        maxWidth: "sm",
      }}
    >
      <DialogContent>
        <form ref={formRef}>
          <Stack spacing={2}>
            <SettingForm title={t("team.name")} lgWidth={12}>
              <DenseFilledTextField
                fullWidth
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <NoMarginHelperText>{t("team.nameDes")}</NoMarginHelperText>
            </SettingForm>
          </Stack>
        </form>
      </DialogContent>
    </DraggableDialog>
  );
};

export default NewTeamDialog;
