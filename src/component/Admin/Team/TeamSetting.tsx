import {
  Box,
  Button,
  Container,
  Stack,
  Table,
  TableBody,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
} from "@mui/material";
import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getTeamList } from "../../../api/api";
import { TeamEnt } from "../../../api/team";
import { useAppDispatch } from "../../../redux/hooks";
import { NoWrapTableCell, SecondaryButton, StyledTableContainerPaper } from "../../Common/StyledComponents";
import Add from "../../Icons/Add";
import ArrowSync from "../../Icons/ArrowSync";
import PageContainer from "../../Pages/PageContainer";
import PageHeader from "../../Pages/PageHeader";
import TablePagination from "../Common/TablePagination";
import { OrderByQuery, OrderDirectionQuery, PageQuery, PageSizeQuery } from "../StoragePolicy/StoragePolicySetting";
import NewTeamDialog from "./NewTeamDialog";
import TeamRow from "./TeamRow";

const TeamSetting = () => {
  const { t } = useTranslation("dashboard");
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<TeamEnt[]>([]);
  const [page, setPage] = useQueryState(PageQuery, { defaultValue: "1" });
  const [pageSize, setPageSize] = useQueryState(PageSizeQuery, {
    defaultValue: "10",
  });
  const [orderBy, setOrderBy] = useQueryState(OrderByQuery, {
    defaultValue: "",
  });
  const [orderDirection, setOrderDirection] = useQueryState(OrderDirectionQuery, { defaultValue: "desc" });
  const [count, setCount] = useState(0);
  const [createNewOpen, setCreateNewOpen] = useState(false);

  const pageInt = parseInt(page) ?? 1;
  const pageSizeInt = parseInt(pageSize) ?? 10;

  useEffect(() => {
    fetchTeams();
  }, [page, pageSize, orderBy, orderDirection]);

  const fetchTeams = () => {
    setLoading(true);
    dispatch(
      getTeamList({
        page: pageInt,
        page_size: pageSizeInt,
        order_by: orderBy ?? "",
        order_direction: orderDirection ?? "desc",
      }),
    )
      .then((res) => {
        setTeams(res.teams);
        setPageSize(res.pagination.page_size.toString());
        setCount(res.pagination.total_items ?? 0);
        setLoading(false);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const orderById = orderBy === "id" || orderBy === "";
  const direction = orderDirection as "asc" | "desc";
  const onSortClick = (field: string) => () => {
    const alreadySorted = orderBy === field || (field === "id" && orderById);
    setOrderBy(field);
    setOrderDirection(alreadySorted ? (direction === "asc" ? "desc" : "asc") : "asc");
  };

  return (
    <PageContainer>
      <NewTeamDialog open={createNewOpen} onClose={() => setCreateNewOpen(false)} />
      <Container maxWidth="xl">
        <PageHeader title={t("dashboard:nav.teams")} />
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button onClick={() => setCreateNewOpen(true)} variant={"contained"} startIcon={<Add />}>
            {t("team.create")}
          </Button>
          <SecondaryButton onClick={fetchTeams} disabled={loading} variant={"contained"} startIcon={<ArrowSync />}>
            {t("node.refresh")}
          </SecondaryButton>
        </Stack>
        <TableContainer component={StyledTableContainerPaper} sx={{ mt: 2 }}>
          <Table size="small" stickyHeader sx={{ width: "100%", tableLayout: "fixed" }}>
            <TableHead>
              <TableRow>
                <NoWrapTableCell width={50} sortDirection={orderById ? direction : false}>
                  <TableSortLabel active={orderById} direction={direction} onClick={onSortClick("id")}>
                    {t("team.#")}
                  </TableSortLabel>
                </NoWrapTableCell>
                <NoWrapTableCell width={200}>
                  <TableSortLabel active={orderBy === "name"} direction={direction} onClick={onSortClick("name")}>
                    {t("team.name")}
                  </TableSortLabel>
                </NoWrapTableCell>
                <NoWrapTableCell width={120}>{t("team.members")}</NoWrapTableCell>
                <NoWrapTableCell width={180}>{t("team.hashId")}</NoWrapTableCell>
                <NoWrapTableCell width={80} align="right"></NoWrapTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && teams.map((team) => <TeamRow key={team.id} team={team} onDelete={fetchTeams} />)}
              {loading &&
                teams.length > 0 &&
                teams.map((team) => <TeamRow key={`loading-${team.id}`} loading={true} />)}
              {loading &&
                teams.length === 0 &&
                Array.from(Array(5)).map((_, index) => <TeamRow key={`loading-${index}`} loading={true} />)}
            </TableBody>
          </Table>
        </TableContainer>
        {count > 0 && (
          <Box sx={{ mt: 1 }}>
            <TablePagination
              page={pageInt}
              totalItems={count}
              rowsPerPage={pageSizeInt}
              rowsPerPageOptions={[10, 25, 50, 100, 200, 500, 1000]}
              onRowsPerPageChange={(value) => setPageSize(value.toString())}
              onChange={(_, value) => setPage(value.toString())}
            />
          </Box>
        )}
      </Container>
    </PageContainer>
  );
};

export default TeamSetting;
