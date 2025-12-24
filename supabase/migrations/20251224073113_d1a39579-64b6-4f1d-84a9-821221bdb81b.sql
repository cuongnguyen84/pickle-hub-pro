-- Step 1: Clean up duplicate playoff matches (keep only the earliest one for each slot)
WITH duplicates AS (
  SELECT id, 
    ROW_NUMBER() OVER (
      PARTITION BY table_id, playoff_round, playoff_match_number 
      ORDER BY created_at ASC, id ASC
    ) as rn
  FROM public.quick_table_matches
  WHERE playoff_round IS NOT NULL AND playoff_match_number IS NOT NULL
)
DELETE FROM public.quick_table_matches 
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- Step 2: Create a unique partial index to prevent duplicates
-- This ensures only one match per (table_id, playoff_round, playoff_match_number) for playoff matches
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_playoff_match 
ON public.quick_table_matches (table_id, playoff_round, playoff_match_number)
WHERE playoff_round IS NOT NULL AND playoff_match_number IS NOT NULL;