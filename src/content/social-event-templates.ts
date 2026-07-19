// ============================================================================
// social-event-templates.ts — UX-02 static wizard presets (proposal ux-01-05).
// ----------------------------------------------------------------------------
// D3 / CodeQL boundary (js/clear-text-storage-of-sensitive-data):
// Templates are STATIC presets over a WHITELIST of harmless fields only
// (see SocialEventTemplateFields). NEVER add bank_code /
// bank_account_number / bank_account_name — or any payment credential —
// to a preset. Bank details must be typed fresh for every event. If this
// file ever grows a "clone from a past event" path, that is a RED change
// per the proposal's risk audit and needs explicit review.
// ============================================================================

import type { FormState } from "@/components/social/create-event/types";

/** Fields a template is allowed to prefill. Everything else keeps its
 *  `initialForm` default when a template is applied. */
export type SocialEventTemplateFields = Pick<
  FormState,
  | "title"
  | "description"
  | "start_time"
  | "end_time"
  | "court_count"
  | "max_players"
  | "price_vnd"
  | "ball_type"
  | "free_perks"
>;

export interface SocialEventTemplate {
  id: string;
  /** Chip label — bilingual inline (content file, not i18n namespace). */
  labelVi: string;
  labelEn: string;
  preset: Partial<SocialEventTemplateFields>;
}

// Event title/description are Vietnamese on purpose: the wizard persists
// them to social_events.title_vi / description_vi and ~95% of organizers
// write VI content. The organizer edits freely after applying.
export const SOCIAL_EVENT_TEMPLATES: SocialEventTemplate[] = [
  {
    id: "evening-social",
    labelVi: "Giao lưu buổi tối",
    labelEn: "Evening social",
    preset: {
      title: "Giao lưu pickleball buổi tối",
      description:
        "Buổi giao lưu vui vẻ, chia đội xoay vòng. Mọi trình độ đều chơi được.",
      start_time: "19:00",
      end_time: "22:00",
      court_count: 2,
      max_players: 16,
      price_vnd: 50000,
      ball_type: "Franklin X-40",
      free_perks: ["Nước"],
    },
  },
  {
    id: "weekend-morning-free",
    labelVi: "Đánh sáng cuối tuần (miễn phí)",
    labelEn: "Weekend morning (free)",
    preset: {
      title: "Đánh sáng cuối tuần",
      description:
        "Hẹn nhau đánh sáng sớm cuối tuần, ai tới trước chơi trước.",
      start_time: "06:00",
      end_time: "09:00",
      court_count: 2,
      max_players: 16,
      price_vnd: 0,
    },
  },
  {
    id: "interclub-social",
    labelVi: "Giao lưu liên CLB",
    labelEn: "Inter-club social",
    preset: {
      title: "Giao lưu liên CLB",
      description:
        "Giao lưu giữa các CLB — chia bảng theo trình độ, đánh đôi xoay vòng.",
      start_time: "08:00",
      end_time: "12:00",
      court_count: 4,
      max_players: 32,
      price_vnd: 70000,
      free_perks: ["Nước", "Hoa quả"],
    },
  },
];
