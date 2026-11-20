import * as z from "zod/v4/mini";

/** Shared by team creation and registration so validation cannot drift. */
export function buildTeamSchema(teamNameError: string, captainNameError: string) {
  return z.object({
    team_name: z.string().check(z.minLength(2, teamNameError), z.maxLength(50)),
    captain_name: z.string().check(z.minLength(2, captainNameError), z.maxLength(50)),
    captain_gender: z.enum(["male", "female"]),
    captain_skill_level: z.optional(z.number().check(z.minimum(1), z.maximum(8))),
  });
}

export function buildTeamMemberSchema(nameError: string) {
  return z.object({
    player_name: z.string().check(z.minLength(2, nameError), z.maxLength(50)),
    gender: z.enum(["male", "female"]),
    skill_level: z.optional(z.number().check(z.minimum(1), z.maximum(8))),
  });
}

export function buildVenueSchema(language: "vi" | "en") {
  return z.object({
    name: z.string().check(z.minLength(2, language === "vi"
      ? "Tên sân tối thiểu 2 ký tự" : "Venue name needs at least 2 characters"), z.maxLength(100)),
    name_vi: z.optional(z.string().check(z.maxLength(100))),
    city: z.string().check(z.minLength(1, language === "vi" ? "Chọn thành phố" : "Pick a city")),
    district: z.optional(z.string().check(z.maxLength(60))),
    address: z.optional(z.string().check(z.maxLength(200))),
    num_courts: z.optional(z.coerce.number().check(z.int(), z.minimum(0), z.maximum(50))),
    surface_type: z.optional(z.string()),
    is_indoor: z._default(z.boolean(), false),
  });
}

// Vietnam phone: 0 followed by 9 digits, OR +84 followed by 9 digits.
const VN_PHONE_RE = /^(0\d{9}|\+84\d{9})$/;

export function buildGhostProfileSchema(language: "vi" | "en") {
  return z.object({
    display_name: z.string().check(z.minLength(2, language === "vi"
      ? "Tên tối thiểu 2 ký tự" : "Name needs at least 2 characters"), z.maxLength(50)),
    phone: z.string().check(z.regex(VN_PHONE_RE, language === "vi"
      ? "Số điện thoại VN: 0xxxxxxxxx hoặc +84xxxxxxxxx"
      : "VN phone format: 0xxxxxxxxx or +84xxxxxxxxx")),
    city: z.string().check(z.minLength(1, language === "vi" ? "Chọn thành phố" : "Pick a city")),
  });
}
