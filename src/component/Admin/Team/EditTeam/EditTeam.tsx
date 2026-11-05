import { Container } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import PageContainer from "../../../Pages/PageContainer";
import PageHeader from "../../../Pages/PageHeader";
import TeamForm from "./TeamForm";
import TeamSettingWrapper from "./TeamSettingWrapper";

const EditTeam = () => {
  const { t } = useTranslation("dashboard");
  const { id } = useParams();
  const [name, setName] = useState("");

  return (
    <PageContainer>
      <Container maxWidth="xl">
        <PageHeader title={t("team.editTeam", { team: name })} />
        <TeamSettingWrapper teamID={parseInt(id ?? "0") ?? 0} onTeamChange={(p) => setName(p.name)}>
          <TeamForm />
        </TeamSettingWrapper>
      </Container>
    </PageContainer>
  );
};

export default EditTeam;
