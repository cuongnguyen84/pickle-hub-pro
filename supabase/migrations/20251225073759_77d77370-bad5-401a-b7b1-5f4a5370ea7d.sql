-- Add column for skill system name (for 'other' rating system)
ALTER TABLE public.quick_table_registrations
ADD COLUMN skill_system_name TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN public.quick_table_registrations.skill_system_name IS 'Name of the skill rating system when rating_system is "other" (e.g., UTPR, APP, internal club system)';