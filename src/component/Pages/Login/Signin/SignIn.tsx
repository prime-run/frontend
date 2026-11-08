import { ArrowBackIos } from "@mui/icons-material";
import { LoadingButton } from "@mui/lab";
import { Box, Button, Typography } from "@mui/material";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { CSSTransition, SwitchTransition } from "react-transition-group";
import {
  getOauthAppRegistration,
  send2FALogin,
  sendConsentOauthApp,
  sendLogin,
  sendPrepareLogin,
} from "../../../../api/api.ts";
import { AppError, Code } from "../../../../api/request.ts";
import { AppRegistration, GrantService, LoginResponse, PrepareLoginResponse } from "../../../../api/user.ts";
import { clearOAuthApp, setOAuthApp, setOAuthAppLoading } from "../../../../redux/globalStateSlice.ts";
import { useAppDispatch, useAppSelector } from "../../../../redux/hooks.ts";
import { refreshUserSession, setTargetSession } from "../../../../redux/thunks/session.ts";
import PageTitle from "../../../../router/PageTitle.tsx";
import SessionManager, { Session } from "../../../../session/index.ts";
import { useQuery } from "../../../../util";
import { CaptchaParams } from "../../../Common/Captcha/Captcha.tsx";
import DismissCircleFilled from "../../../Icons/DismissCircleFilled.tsx";
import Phase2FA from "../Phases/Phase2FA.tsx";
import PhaseCollectPassword from "../Phases/PhaseCollectPassword.tsx";
import PhaseCollectUsername from "../Phases/PhaseCollectUsername.tsx";
import PhaseConsent from "../Phases/PhaseConsent.tsx";
import PhaseSignupNeeded from "../Phases/PhaseSignupNeeded.tsx";
import "../SideTransition.css";

// Local storage key for OAuth redirect
export const OAUTH_REDIRECT_KEY = "oauth_redirect_url";

enum LoginPhase {
  CollectUsername,
  CollectPassword,
  SignupNeeded,
  Collect2FA,
  Consent,
}

export interface Control {
  submit: JSX.Element;
  back: JSX.Element;
}

interface phaseSetting {
  title: string;
  nextButtonText: string;
  showBackButton: boolean;
  previous?: LoginPhase;
  control?: Control;
}

export interface OAuthConsentProps {
  clientId: string;
  responseType: string;
  redirectUri: string;
  state: string;
  scope: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
}

export interface SignInProps {
  oauthConsent?: OAuthConsentProps;
}

const EmailLogin = ({ oauthConsent }: SignInProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const query = useQuery();

  const isOAuthFlow = !!oauthConsent;
  const requestedScopes = useMemo(
    () => (oauthConsent?.scope ? oauthConsent.scope.split(" ").filter(Boolean) : []),
    [oauthConsent?.scope],
  );

  // Get OAuth app from Redux
  const app = useAppSelector((state) => state.globalState.oauthApp);

  const [phase, setPhase] = useState<LoginPhase>(LoginPhase.CollectUsername);
  const [username, setUsername] = useState("");
  const [pwd, setPwd] = useState("");
  const [otp, setOTP] = useState("");
  const [captchaGen, setCaptchaGen] = useState(0);
  const [loading, setLoading] = useState(false);
  const captchaState = useRef<CaptchaParams>();
  const twoFaSession = useRef<string>("");
  const [loginOptions, setLoginOptions] = useState<PrepareLoginResponse>();

  // OAuth-specific state
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);

  // Load OAuth app registration
  const loadAppRegistration = useCallback(async () => {
    if (!oauthConsent?.clientId) {
      setOauthError(t("oauth.invalidClientId"));
      dispatch(setOAuthAppLoading(false));
      return null;
    }

    try {
      dispatch(setOAuthAppLoading(true));
      const registration = await dispatch(getOauthAppRegistration(oauthConsent.clientId));
      dispatch(setOAuthApp(registration));
      return registration;
    } catch (e) {
      setOauthError(t("oauth.appNotFound"));
      dispatch(setOAuthAppLoading(false));
      return null;
    }
  }, [oauthConsent?.clientId, dispatch, t]);

  // Send consent and redirect
  const sendConsent = useCallback(
    async (deny = false) => {
      if (!oauthConsent) return;

      try {
        setLoading(true);
        const grantService: GrantService = {
          client_id: oauthConsent.clientId,
          response_type: oauthConsent.responseType,
          redirect_uri: oauthConsent.redirectUri,
          state: oauthConsent.state,
          scope: oauthConsent.scope,
          code_challenge: oauthConsent.codeChallenge,
          code_challenge_method: oauthConsent.codeChallengeMethod,
        };
        const response = await dispatch(sendConsentOauthApp(grantService, deny));

        // Clear OAuth state before redirecting
        dispatch(clearOAuthApp());
        localStorage.removeItem(OAUTH_REDIRECT_KEY);

        // Redirect to the app with the authorization code
        // Handle both absolute URLs and relative paths
        const redirectUrl =
          oauthConsent.redirectUri.startsWith("http://") || oauthConsent.redirectUri.startsWith("https://")
            ? new URL(oauthConsent.redirectUri)
            : new URL(oauthConsent.redirectUri, window.location.origin);
        redirectUrl.searchParams.delete("code");
        redirectUrl.searchParams.delete("error");
        if (response.error) {
          redirectUrl.searchParams.set("error", response.error);
        } else if (!deny && response.code) {
          redirectUrl.searchParams.set("code", response.code);
        } else {
          throw new Error("Invalid OAuth consent response");
        }
        if (response.state) {
          redirectUrl.searchParams.set("state", response.state);
        }
        window.location.assign(redirectUrl.toString());
      } catch (e: unknown) {
        setOauthError(e instanceof AppError ? e.message : String(e));
        setLoading(false);
      }
    },
    [oauthConsent, dispatch, t],
  );

  // Check if all requested scopes are already consented
  const checkAndProceed = useCallback(
    async (registration: AppRegistration) => {
      const consentedScopes = registration.consented_scopes || [];
      const allConsented = requestedScopes.every((s) => consentedScopes.includes(s));

      if (allConsented && requestedScopes.length > 0) {
        // All scopes already consented, send consent directly
        await sendConsent();
      } else {
        // Need user to consent to new scopes
        setSelectedScopes(requestedScopes.filter((s) => !consentedScopes.includes(s)));
        setPhase(LoginPhase.Consent);
      }
    },
    [requestedScopes, sendConsent],
  );

  // Handle OAuth session switch (different from normal login - don't redirect)
  const handleOAuthSessionSwitch = useCallback(
    async (session: Session | LoginResponse) => {
      const loginResponse: LoginResponse = { user: session.user, token: session.token };
      dispatch(setTargetSession(loginResponse));

      // Reload app registration to get updated consented scopes
      const registration = await loadAppRegistration();
      if (registration) {
        await checkAndProceed(registration);
      }
    },
    [dispatch, loadAppRegistration, checkAndProceed],
  );

  const prepareLogin = useCallback(
    async (name: string) => {
      try {
        setLoading(true);
        const opts = await dispatch(sendPrepareLogin(name));
        setLoginOptions(opts);
        setPhase(LoginPhase.CollectPassword);
      } catch (e) {
        if (e instanceof AppError && e.code === Code.NodeFound) {
          // User not registered yet, guided to register
          setPhase(LoginPhase.SignupNeeded);
        }
      } finally {
        setLoading(false);
      }
    },
    [dispatch],
  );

  const passwordLogin = useCallback(
    async (name: string, password: string, captcha?: CaptchaParams) => {
      try {
        setLoading(true);
        const loginRes = await dispatch(sendLogin({ username: name, password, ...captcha }));
        if (isOAuthFlow) {
          await handleOAuthSessionSwitch(loginRes);
        } else {
          dispatch(refreshUserSession(loginRes, query.get("redirect")));
        }
      } catch (e) {
        if (e instanceof AppError && e.code === Code.Continue) {
          twoFaSession.current = e.response.data;
          // User needs 2FA
          setPhase(LoginPhase.Collect2FA);
        } else {
          setCaptchaGen((g) => g + 1);
        }
      } finally {
        setLoading(false);
      }
    },
    [dispatch, isOAuthFlow, handleOAuthSessionSwitch, query],
  );

  const finish2FA = useCallback(
    async (otp: string, ticket: string) => {
      try {
        setLoading(true);
        const loginRes = await dispatch(send2FALogin({ otp, session_id: ticket }));
        if (isOAuthFlow) {
          await handleOAuthSessionSwitch(loginRes);
        } else {
          dispatch(refreshUserSession(loginRes, query.get("redirect")));
        }
      } finally {
        setOTP("");
        setLoading(false);
      }
    },
    [dispatch, isOAuthFlow, handleOAuthSessionSwitch, query],
  );

  const submit = (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    switch (phase) {
      case LoginPhase.CollectUsername:
        prepareLogin(username);
        break;
      case LoginPhase.SignupNeeded:
        navigate(`/session/signup?username=${encodeURIComponent(username)}`);
        break;
      case LoginPhase.CollectPassword:
        passwordLogin(username, pwd, captchaState.current);
        break;
      case LoginPhase.Collect2FA:
        finish2FA(otp, twoFaSession.current);
        break;
      case LoginPhase.Consent:
        sendConsent();
        break;
    }
  };

  useEffect(() => {
    if (otp.length === 6) {
      submit();
    }
  }, [otp]);

  // Initial load for OAuth or regular login
  useEffect(() => {
    const fromQuery = query.get("username") ?? "";
    if (fromQuery) {
      setUsername(fromQuery);
    }
    if (!isOAuthFlow && query.get("phase") === "password" && fromQuery) {
      void prepareLogin(fromQuery);
    }

    const init = async () => {
      if (isOAuthFlow) {
        const registration = await loadAppRegistration();
        if (!registration) return;
        if (SessionManager.currentLoginOrNull()) {
          await checkAndProceed(registration);
        }
      }
    };
    init();

    // Cleanup OAuth state when leaving
    return () => {
      if (isOAuthFlow) {
        dispatch(clearOAuthApp());
      }
    };
  }, []);

  const handleScopeToggle = useCallback((scope: string) => {
    setSelectedScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  }, []);

  const phaseConfig = useMemo((): phaseSetting => {
    var phaseSetting: phaseSetting = {
      title: t("login.siginToYourAccount"),
      nextButtonText: t("login.continue"),
      showBackButton: false,
    };
    switch (phase) {
      case LoginPhase.CollectUsername:
        phaseSetting = {
          title: t("login.siginToYourAccount"),
          nextButtonText: t("login.continue"),
          showBackButton: false,
        };
        break;
      case LoginPhase.SignupNeeded:
        phaseSetting = {
          title: t("login.siginToYourAccount"),
          nextButtonText: t("login.signUpAccount"),
          showBackButton: true,
          previous: LoginPhase.CollectUsername,
        };
        break;
      case LoginPhase.CollectPassword:
        phaseSetting = {
          title: t("login.enterPassword"),
          nextButtonText: t("login.signIn"),
          showBackButton: true,
          previous: LoginPhase.CollectUsername,
        };
        break;
      case LoginPhase.Collect2FA:
        phaseSetting = {
          title: t("login.2FA"),
          nextButtonText: t("login.signIn"),
          showBackButton: true,
          previous: LoginPhase.CollectPassword,
        };
        break;
      case LoginPhase.Consent:
        phaseSetting = {
          title: t("oauth.reviewPermissions"),
          nextButtonText: t("oauth.authorize"),
          showBackButton: true,
          previous: LoginPhase.CollectUsername,
        };
        break;
      default:
        break;
    }
    phaseSetting.control = {
      submit: (
        <LoadingButton sx={{ mt: 2 }} type="submit" fullWidth variant="contained" color="primary" loading={loading}>
          <span>{phaseSetting.nextButtonText}</span>
        </LoadingButton>
      ),
      back: (
        <>
          {phaseSetting.showBackButton && (
            <Button
              startIcon={<ArrowBackIos />}
              size={"small"}
              sx={{ mt: 2 }}
              variant="text"
              disabled={loading}
              color="primary"
              onClick={() => {
                if (phase === LoginPhase.Consent) {
                  sendConsent(true);
                } else {
                  phaseSetting.previous != undefined && setPhase(phaseSetting.previous);
                }
              }}
            >
              {t(phase === LoginPhase.Consent ? "oauth.deny" : "login.back")}
            </Button>
          )}
        </>
      ),
    };
    return phaseSetting;
  }, [phase, t, loading, sendConsent]);

  // Render OAuth error state
  if (oauthError) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          pt: 7,
          pb: 9,
        }}
      >
        <DismissCircleFilled fontSize={"large"} color={"error"} />
        <Typography
          variant={"body2"}
          sx={{
            color: (theme) => theme.palette.error.main,
            mt: 2,
          }}
        >
          {oauthError}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ overflow: "hidden" }}>
      <Typography variant={"h6"}>{phaseConfig.title}</Typography>
      <Box component={"form"} sx={{ mt: 1 }} onSubmit={submit}>
        <SwitchTransition>
          <CSSTransition
            addEndListener={(node, done) => node.addEventListener("transitionend", done, false)}
            classNames="side"
            key={phase}
          >
            <Box>
              {phase === LoginPhase.CollectPassword && (
                <PhaseCollectPassword
                  username={username}
                  pwd={pwd}
                  setPwd={setPwd}
                  control={phaseConfig.control}
                  loginOptions={loginOptions}
                  captchaGen={captchaGen}
                  setCaptchaState={(s) => (captchaState.current = s)}
                  onOAuthPasskeyLogin={isOAuthFlow ? handleOAuthSessionSwitch : undefined}
                />
              )}
              {phase === LoginPhase.SignupNeeded && (
                <PhaseSignupNeeded username={username} control={phaseConfig.control} />
              )}
              {phase === LoginPhase.Collect2FA && (
                <Phase2FA
                  loading={loading}
                  otp={otp}
                  onOtpChange={(t: string) => setOTP(t)}
                  control={phaseConfig.control}
                />
              )}
              {phase === LoginPhase.CollectUsername && (
                <PhaseCollectUsername
                  username={username}
                  setUsername={setUsername}
                  control={phaseConfig.control}
                  onOAuthPasskeyLogin={isOAuthFlow ? handleOAuthSessionSwitch : undefined}
                />
              )}
              {phase === LoginPhase.Consent && app && (
                <PhaseConsent
                  app={app}
                  requestedScopes={requestedScopes}
                  selectedScopes={selectedScopes}
                  onScopeToggle={handleScopeToggle}
                  control={phaseConfig.control!}
                />
              )}
            </Box>
          </CSSTransition>
        </SwitchTransition>
      </Box>
    </Box>
  );
};

const SignIn = ({ oauthConsent }: SignInProps) => {
  const { t } = useTranslation();
  const isOAuthFlow = !!oauthConsent;

  return (
    <Box>
      <PageTitle title={isOAuthFlow ? t("oauth.authorize") : t("login.signIn")} />
      <EmailLogin oauthConsent={oauthConsent} />
    </Box>
  );
};

export default SignIn;
