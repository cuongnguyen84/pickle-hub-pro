import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

interface ShareRedirectProps {
  type: "live" | "video";
}

const ShareRedirect = ({ type }: ShareRedirectProps) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      const target = type === "live" ? `/live/${id}` : `/watch/${id}`;
      navigate(target, { replace: true });
    }
  }, [id, type, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Đang chuyển hướng...</div>
    </div>
  );
};

export default ShareRedirect;
