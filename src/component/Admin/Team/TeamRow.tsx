import { IconButton, Skeleton, TableRow } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { deleteTeam } from "../../../api/api";
import { TeamEnt } from "../../../api/team";
import { useAppDispatch } from "../../../redux/hooks";
import { confirmOperation } from "../../../redux/thunks/dialog";
import { NoWrapTableCell, NoWrapTypography } from "../../Common/StyledComponents";
import Delete from "../../Icons/Delete";

export interface TeamRowProps {
  team?: TeamEnt;
  loading?: boolean;
  onDelete?: () => void;
}

const TeamRow = ({ team, loading, onDelete }: TeamRowProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation("dashboard");
  const dispatch = useAppDispatch();
  const [deleteLoading, setDeleteLoading] = useState(false);

  const onRowClick = () => {
    navigate(`/admin/team/${team?.id}`);
  };

  const onDeleteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    dispatch(confirmOperation(t("team.confirmDelete", { team: team?.name }))).then(() => {
      if (team?.id) {
        setDeleteLoading(true);
        dispatch(deleteTeam(team.id))
          .then(() => {
            onDelete?.();
          })
          .finally(() => {
            setDeleteLoading(false);
          });
      }
    });
  };

  if (loading) {
    return (
      <TableRow>
        <NoWrapTableCell>
          <Skeleton variant="text" width={50} />
        </NoWrapTableCell>
        <NoWrapTableCell>
          <Skeleton variant="text" width={150} />
        </NoWrapTableCell>
        <NoWrapTableCell>
          <Skeleton variant="text" width={80} />
        </NoWrapTableCell>
        <NoWrapTableCell>
          <Skeleton variant="text" width={100} />
        </NoWrapTableCell>
        <NoWrapTableCell>
          <Skeleton variant="text" width={40} />
        </NoWrapTableCell>
      </TableRow>
    );
  }

  return (
    <TableRow hover key={team?.id} sx={{ cursor: "pointer" }} onClick={onRowClick}>
      <NoWrapTableCell>{team?.id}</NoWrapTableCell>
      <NoWrapTableCell>
        <NoWrapTypography variant="inherit">{team?.name}</NoWrapTypography>
      </NoWrapTableCell>
      <NoWrapTableCell>{team?.member_count ?? team?.edges?.members?.length ?? "—"}</NoWrapTableCell>
      <NoWrapTableCell>{team?.hash_id ?? "—"}</NoWrapTableCell>
      <NoWrapTableCell>
        <IconButton size="small" onClick={onDeleteClick} disabled={deleteLoading}>
          <Delete fontSize="small" />
        </IconButton>
      </NoWrapTableCell>
    </TableRow>
  );
};

export default TeamRow;
