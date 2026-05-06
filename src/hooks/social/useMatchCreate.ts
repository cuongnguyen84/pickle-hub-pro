import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { MatchCreateInput, MatchCreateResponse } from "./types";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/match-create`;

interface MatchCreateError {
  status: number;
  error: string;
  code?: string;
  details?: unknown;
}

async function callMatchCreate(body: MatchCreateInput): Promise<MatchCreateResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw { status: 401, error: "Bạn cần đăng nhập" } satisfies MatchCreateError;
  }
  const res = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<MatchCreateError & MatchCreateResponse>;
  if (!res.ok) {
    throw {
      status: res.status,
      error: data.error ?? "Lỗi không xác định",
      code: data.code,
      details: data.details,
    } satisfies MatchCreateError;
  }
  return data as MatchCreateResponse;
}

/**
 * Wrapper around match-create edge function with structured error handling +
 * navigation on success. Caller passes the wizard's full state; we POST it
 * and the server validates + persists.
 */
export function useMatchCreate() {
  const navigate = useNavigate();
  return useMutation<MatchCreateResponse, MatchCreateError, MatchCreateInput>({
    mutationFn: callMatchCreate,
    onSuccess: (response) => {
      toast({
        title: "Đã tạo trận đấu",
        description: "Đối thủ sẽ nhận thông báo xác nhận.",
      });
      navigate(`/tran-dau/${response.match.slug}`);
    },
    onError: (err) => {
      let title = "Không tạo được trận đấu";
      let description = err.error;
      if (err.status === 429) {
        title = "Đã đạt giới hạn";
        description = err.error.includes("Daily")
          ? "Bạn đã log 5 trận trong 24h. Thử lại ngày mai."
          : "Đã đạt giới hạn 20 trận/tuần. Thử lại tuần sau.";
      } else if (err.status === 401) {
        title = "Phiên hết hạn";
        description = "Vui lòng đăng nhập lại.";
      } else if (err.status >= 500) {
        title = "Lỗi hệ thống";
        description = "Không tạo được trận đấu, thử lại sau.";
      }
      toast({ title, description, variant: "destructive" });
    },
  });
}
