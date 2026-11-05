import { FormControl, ListItemText } from "@mui/material";
import { useCallback, useContext, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { defaultPath } from "../../../hooks/useNavigation.tsx";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks.ts";
import { navigateToPath } from "../../../redux/thunks/filemanager.ts";
import { loadUserTeams } from "../../../redux/thunks/session.ts";
import SessionManager from "../../../session";
import CrUri, { Filesystem, newTeamUri } from "../../../util/uri.ts";
import { DenseSelect } from "../../Common/StyledComponents.tsx";
import { SquareMenuItem } from "../ContextMenu/ContextMenu.tsx";
import { FmIndexContext } from "../FmIndexContext.tsx";

const PERSONAL = "personal";

const WorkspaceSwitcher = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const fmIndex = useContext(FmIndexContext);
  const teams = useAppSelector((s) => s.globalState.teams);
  const currentFs = useAppSelector((s) => s.fileManager[fmIndex].current_fs);
  const path = useAppSelector((s) => s.fileManager[fmIndex].path);

  const isLogin = !!SessionManager.currentLoginOrNull();

  useEffect(() => {
    if (isLogin && teams === undefined) {
      dispatch(loadUserTeams());
    }
  }, [dispatch, isLogin, teams]);

  const value = useMemo(() => {
    if (currentFs === Filesystem.team && path) {
      try {
        const id = new CrUri(path).id();
        if (id) {
          return id;
        }
      } catch {
        // ignore invalid path
      }
    }
    return PERSONAL;
  }, [currentFs, path]);

  const onChange = useCallback(
    (e: { target: { value: unknown } }) => {
      const next = e.target.value as string;
      if (next === PERSONAL) {
        dispatch(navigateToPath(fmIndex, defaultPath));
        return;
      }
      dispatch(navigateToPath(fmIndex, newTeamUri(next).toString()));
    },
    [dispatch, fmIndex],
  );

  if (!isLogin || !teams || teams.length === 0) {
    return null;
  }

  return (
    <FormControl fullWidth size="small" sx={{ mb: 1, px: 0.5 }}>
      <DenseSelect variant="outlined" value={value} onChange={onChange} displayEmpty>
        <SquareMenuItem value={PERSONAL}>
          <ListItemText
            slotProps={{
              primary: { variant: "body2" },
            }}
          >
            {t("navbar.personal")}
          </ListItemText>
        </SquareMenuItem>
        {teams.map((team) => (
          <SquareMenuItem key={team.id} value={team.id}>
            <ListItemText
              slotProps={{
                primary: { variant: "body2" },
              }}
            >
              {team.name}
            </ListItemText>
          </SquareMenuItem>
        ))}
      </DenseSelect>
    </FormControl>
  );
};

export default WorkspaceSwitcher;
