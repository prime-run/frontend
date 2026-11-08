import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/** Forgot-password links are no longer served. Send visitors to sign-in. */
const Reset = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/session", { replace: true });
  }, [navigate]);

  return null;
};

export default Reset;
