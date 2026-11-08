import { LoadingButton } from "@mui/lab";
import { Box, Divider, FormControl, Link, Typography } from "@mui/material";
import i18next from "i18next";
import { useSnackbar } from "notistack";
import { useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { sendSinUp } from "../../../api/api.ts";
import { useAppDispatch, useAppSelector } from "../../../redux/hooks.ts";
import PageTitle from "../../../router/PageTitle.tsx";
import { useQuery } from "../../../util";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "../../../util/username.ts";
import { Captcha, CaptchaParams } from "../../Common/Captcha/Captcha.tsx";
import { OutlineIconTextField } from "../../Common/Form/OutlineIconTextField.tsx";
import { DefaultCloseAction } from "../../Common/Snackbar/snackbar.tsx";
import Password from "../../Icons/Password.tsx";
import PersonOutlined from "../../Icons/PersonOutlined.tsx";
import { LegalLinks } from "./Phases/PhaseCollectUsername.tsx";

const SignUp = () => {
  const { t } = useTranslation();
  const { reg_captcha } = useAppSelector((state) => state.siteConfig.login.config);
  const tos = useAppSelector((state) => state.siteConfig.login.config.tos_url);
  const privacyPolicy = useAppSelector((state) => state.siteConfig.login.config.privacy_policy_url);
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();
  const query = useQuery();

  const formRef = useRef<HTMLFormElement>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [captchaGen, setCaptchaGen] = useState(0);
  const captchaState = useRef<CaptchaParams>();
  const [loading, setLoading] = useState(false);

  const showFooter = tos || privacyPolicy;

  useEffect(() => {
    const fromQuery = query.get("username");
    if (fromQuery) {
      setUsername(fromQuery);
    }
  }, []);

  const submit = () => {
    if (!formRef.current) {
      return;
    }

    if (!formRef.current.checkValidity()) {
      formRef.current.reportValidity();
      return;
    }

    if (passwordRepeat != password) {
      enqueueSnackbar({
        message: t("login.passwordNotMatch"),
        variant: "warning",
        action: DefaultCloseAction,
      });
      return;
    }

    setLoading(true);
    dispatch(
      sendSinUp({
        username,
        password,
        language: i18next.language,
        ...captchaState.current,
      }),
    )
      .then(() => {
        navigate("/session?phase=username&username=" + encodeURIComponent(username));
        enqueueSnackbar({
          message: t("login.signUpSuccess"),
          variant: "success",
          action: DefaultCloseAction,
        });
      })
      .catch(() => {
        setCaptchaGen((g) => g + 1);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <Box>
      <PageTitle title={t("login.signUp")} />
      <Box sx={{ overflow: "hidden" }}>
        <Typography variant={"h6"}>{t("login.createNewAccount")}</Typography>
        <Box component={"form"} sx={{ mt: 1 }} ref={formRef}>
          <Box>
            <FormControl variant="standard" margin="normal" required fullWidth>
              <OutlineIconTextField
                label={t("login.username")}
                variant={"outlined"}
                inputProps={{
                  id: "username",
                  type: "text",
                  name: "username",
                  required: "true",
                  minLength: USERNAME_MIN_LENGTH,
                  maxLength: USERNAME_MAX_LENGTH,
                  title: t("login.usernameInvalid"),
                }}
                onChange={(e) => setUsername(e.target.value)}
                icon={<PersonOutlined />}
                value={username}
                autoFocus={true}
                autoComplete={"username"}
              />
            </FormControl>
            <FormControl variant="standard" margin="normal" required fullWidth>
              <OutlineIconTextField
                variant={"outlined"}
                label={t("login.password")}
                inputProps={{
                  name: "password",
                  type: "password",
                  id: "password",
                  required: "true",
                  minLength: 6,
                  maxLength: 128,
                }}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Password />}
                value={password}
                autoComplete={"new-password"}
              />
            </FormControl>
            <FormControl variant="standard" margin="normal" required fullWidth>
              <OutlineIconTextField
                variant={"outlined"}
                label={t("login.repeatPassword")}
                inputProps={{
                  name: "repeatPassword",
                  type: "password",
                  id: "repeatPassword",
                  required: "true",
                  minLength: 6,
                  maxLength: 128,
                }}
                onChange={(e) => setPasswordRepeat(e.target.value)}
                icon={<Password />}
                value={passwordRepeat}
                autoComplete={"new-password"}
              />
            </FormControl>
            {reg_captcha && (
              <FormControl variant="standard" margin="normal" required fullWidth>
                <Captcha
                  generation={captchaGen}
                  required={true}
                  fullWidth={true}
                  onStateChange={(s) => (captchaState.current = s)}
                />
              </FormControl>
            )}
            <LoadingButton
              sx={{ mt: 2 }}
              onClick={submit}
              fullWidth
              variant="contained"
              color="primary"
              loading={loading}
            >
              <span>{t("login.signUp")}</span>
            </LoadingButton>
            <Box sx={{ mt: 2, typography: "body2", textAlign: "center" }}>
              <Trans
                ns={"application"}
                i18nKey={"login.haveAccountSignInNow"}
                components={[<Link underline="hover" component={RouterLink} to="/session" />]}
              />
            </Box>
            {showFooter && (
              <>
                <Divider sx={{ my: 2 }} />
                <LegalLinks />
              </>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default SignUp;
