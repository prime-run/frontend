import { Box } from "@mui/material";
import * as React from "react";
import { createContext, useEffect, useMemo, useRef, useState } from "react";
import { CSSTransition, SwitchTransition } from "react-transition-group";
import { getTeamDetail, renameTeam } from "../../../../api/api.ts";
import { TeamEnt } from "../../../../api/team.ts";
import { useAppDispatch } from "../../../../redux/hooks.ts";
import FacebookCircularProgress from "../../../Common/CircularProgress.tsx";
import { SavingFloat } from "../../Settings/SettingWrapper.tsx";

export interface TeamSettingWrapperProps {
  teamID: number;
  children: React.ReactNode;
  onTeamChange: (team: TeamEnt) => void;
}

export interface TeamSettingContextProps {
  values: TeamEnt;
  setTeam: (f: (p: TeamEnt) => TeamEnt) => void;
  reload: () => void;
  formRef?: React.RefObject<HTMLFormElement>;
}

const defaultTeam: TeamEnt = {
  id: 0,
  name: "",
  edges: { members: [] },
};

export const TeamSettingContext = createContext<TeamSettingContextProps>({
  values: { ...defaultTeam },
  setTeam: () => {},
  reload: () => {},
});

const TeamSettingWrapper = ({ teamID, children, onTeamChange }: TeamSettingWrapperProps) => {
  const dispatch = useAppDispatch();
  const [values, setValues] = useState<TeamEnt>({ ...defaultTeam });
  const [modifiedValues, setModifiedValues] = useState<TeamEnt>({ ...defaultTeam });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const showSaveButton = useMemo(() => {
    return values.name !== modifiedValues.name;
  }, [modifiedValues, values]);

  const loadTeam = () => {
    setLoading(true);
    dispatch(getTeamDetail(teamID))
      .then((res) => {
        setValues(res);
        setModifiedValues(res);
        onTeamChange(res);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadTeam();
  }, [teamID]);

  const revert = () => {
    setModifiedValues(values);
  };

  const submit = () => {
    if (formRef.current) {
      if (!formRef.current.checkValidity()) {
        formRef.current.reportValidity();
        return;
      }
    }

    setSubmitting(true);
    dispatch(renameTeam(modifiedValues.id, { name: modifiedValues.name }))
      .then((res) => {
        setValues(res);
        setModifiedValues(res);
        onTeamChange(res);
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  return (
    <TeamSettingContext.Provider
      value={{
        values: modifiedValues,
        setTeam: setModifiedValues,
        reload: loadTeam,
        formRef,
      }}
    >
      <SwitchTransition>
        <CSSTransition
          addEndListener={(node, done) => node.addEventListener("transitionend", done, false)}
          classNames="fade"
          key={`${loading}`}
        >
          <Box sx={{ mt: 3 }}>
            {loading && (
              <Box
                sx={{
                  pt: 20,
                  height: "100%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <FacebookCircularProgress />
              </Box>
            )}
            {!loading && (
              <Box>
                {children}
                <SavingFloat in={showSaveButton} submitting={submitting} revert={revert} submit={submit} />
              </Box>
            )}
          </Box>
        </CSSTransition>
      </SwitchTransition>
    </TeamSettingContext.Provider>
  );
};

export default TeamSettingWrapper;
