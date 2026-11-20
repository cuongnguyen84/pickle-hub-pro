-- Depends on phase1 token predicate. Dedicated phone-only proof; legacy OTPs
-- may have been emailed to caller-supplied addresses and MUST NOT be reused.
CREATE TABLE public.registration_renewal_challenges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 registration_id uuid NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
 phone text NOT NULL CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),
 ip_hash text NOT NULL,
 code_hash text NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '5 minutes',
 delivered_at timestamptz,
 used_at timestamptz,
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3)
);
ALTER TABLE public.registration_renewal_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.registration_renewal_challenges FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE ON public.registration_renewal_challenges TO service_role;
CREATE INDEX ON public.registration_renewal_challenges(created_at);
CREATE INDEX ON public.registration_renewal_challenges(phone,created_at DESC);

-- Seven-day retention leaves the complete rolling one-day cost ledger intact.
-- Preserve every still-active proof, even if created_at is unexpectedly old.
-- Explicit service helper, also called opportunistically under budget lock; no cron.
CREATE FUNCTION public.cleanup_registration_renewal_challenges()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE removed bigint;
BEGIN
 DELETE FROM public.registration_renewal_challenges c
 WHERE c.created_at < statement_timestamp()-interval '7 days'
   AND (c.used_at IS NOT NULL OR NOT isfinite(c.expires_at) OR c.expires_at<=statement_timestamp());
 GET DIAGNOSTICS removed=ROW_COUNT;
 RETURN removed;
END $$;
REVOKE ALL ON FUNCTION public.cleanup_registration_renewal_challenges() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_registration_renewal_challenges() TO service_role;

-- Reserve rate/cost budget BEFORE the SMS call. All attempts, including provider
-- failures, count. Global lock makes the global cap atomic across different IPs.
CREATE FUNCTION public.begin_registration_renewal(p_phone text,p_event_id uuid,p_ip_hash text,p_code_hash text)
RETURNS TABLE(challenge_id uuid,phone text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE reg_id uuid; challenge uuid;
BEGIN
 IF p_phone IS NULL OR p_phone !~ '^\+[1-9][0-9]{7,14}$' OR p_event_id IS NULL THEN RETURN; END IF;
 IF p_ip_hash IS NULL OR p_ip_hash !~ '^[0-9a-f]{64}$' OR p_code_hash IS NULL OR p_code_hash !~ '^[0-9a-f]{64}$' THEN RETURN; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('registration-renewal-budget',0));
 PERFORM public.cleanup_registration_renewal_challenges();
 IF (SELECT count(*) FROM public.registration_renewal_challenges WHERE created_at>now()-interval '1 day')>=50
 OR (SELECT count(*) FROM public.registration_renewal_challenges c WHERE c.phone=p_phone AND created_at>now()-interval '15 minutes')>=3
 OR (SELECT count(*) FROM public.registration_renewal_challenges WHERE ip_hash=p_ip_hash AND created_at>now()-interval '1 hour')>=5 THEN RETURN; END IF;
 SELECT r.id INTO reg_id FROM public.event_registrations r
 WHERE r.phone=p_phone AND r.event_id=p_event_id ORDER BY r.registered_at DESC,r.id LIMIT 1;
 IF reg_id IS NULL THEN RETURN; END IF;
 INSERT INTO public.registration_renewal_challenges(registration_id,phone,ip_hash,code_hash)
 VALUES(reg_id,p_phone,p_ip_hash,p_code_hash) RETURNING id INTO challenge;
 RETURN QUERY SELECT challenge,p_phone;
END $$;

-- Service-only internal primitive; callers must establish proof before calling.
-- Serialization by registration makes simultaneous valid proofs converge on one
-- token. A valid token is returned unchanged: no public retry can revoke it.
CREATE FUNCTION public.issue_verified_registration_token(p_registration_id uuid)
RETURNS TABLE(registration_id uuid,magic_token uuid,expires_at timestamptz,rotated boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE token uuid; expiry timestamptz; changed boolean:=false;
BEGIN
 PERFORM 1 FROM public.event_registrations r WHERE r.id=p_registration_id FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT s.magic_token,s.expires_at INTO token,expiry FROM public.registration_secrets s WHERE s.registration_id=p_registration_id FOR UPDATE;
 IF token IS NULL OR expiry IS NULL OR NOT isfinite(expiry) OR expiry<=statement_timestamp() THEN
   token:=gen_random_uuid(); expiry:=statement_timestamp()+interval '400 days'; changed:=true;
   INSERT INTO public.registration_secrets(registration_id,magic_token,expires_at)
   VALUES(p_registration_id,token,expiry)
   ON CONFLICT ON CONSTRAINT registration_secrets_pkey DO UPDATE SET magic_token=excluded.magic_token,expires_at=excluded.expires_at;
 END IF;
 RETURN QUERY SELECT p_registration_id,token,expiry,changed;
END $$;
-- Not directly callable by Edge/browser; only the proof-verifying definers below.
REVOKE ALL ON FUNCTION public.issue_verified_registration_token(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.renew_registration_token_by_phone(p_phone text,p_event_id uuid,p_code_hash text)
RETURNS TABLE(registration_id uuid,magic_token uuid,expires_at timestamptz,rotated boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE proof public.registration_renewal_challenges%ROWTYPE;
BEGIN
 IF p_phone IS NULL OR p_phone !~ '^\+[1-9][0-9]{7,14}$' OR p_event_id IS NULL OR p_code_hash IS NULL OR p_code_hash !~ '^[0-9a-f]{64}$' THEN RETURN; END IF;
 -- Dedicated proof rows only; no legacy otp_codes/email codes can enter here.
 -- Serialize phone/event verification, then consume proof and rotate in one txn.
 PERFORM pg_advisory_xact_lock(hashtextextended('registration-renewal:'||p_phone||':'||p_event_id::text,0));
 SELECT c.* INTO proof FROM public.registration_renewal_challenges c
 JOIN public.event_registrations r ON r.id=c.registration_id
 WHERE c.phone=p_phone AND r.phone=p_phone AND r.event_id=p_event_id
   AND c.used_at IS NULL AND c.delivered_at IS NOT NULL
 ORDER BY c.created_at DESC,c.id DESC LIMIT 1 FOR UPDATE OF c;
 IF proof.id IS NULL OR NOT isfinite(proof.expires_at) OR proof.expires_at<=statement_timestamp() OR proof.attempts>=3 THEN RETURN; END IF;
 IF p_code_hash IS NULL OR proof.code_hash<>p_code_hash THEN
   UPDATE public.registration_renewal_challenges SET attempts=attempts+1 WHERE id=proof.id;
   RETURN;
 END IF;
 -- Recheck ownership while holding the registration lock, not only in the
 -- earlier joined snapshot. Concurrent phone/event reassignment must deny.
 PERFORM 1 FROM public.event_registrations r WHERE r.id=proof.registration_id
   AND r.phone=p_phone AND r.event_id=p_event_id FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 UPDATE public.registration_renewal_challenges c SET used_at=statement_timestamp()
 WHERE c.phone=p_phone AND c.used_at IS NULL AND EXISTS(SELECT 1 FROM public.event_registrations r WHERE r.id=c.registration_id AND r.event_id=p_event_id);
 RETURN QUERY SELECT * FROM public.issue_verified_registration_token(proof.registration_id);
END $$;

CREATE FUNCTION public.renew_registration_token_by_owner(p_registration_id uuid,p_owner_id uuid)
RETURNS TABLE(registration_id uuid,magic_token uuid,expires_at timestamptz,rotated boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 -- Edge derives owner ID through Auth.getUser, never request body/decoded JWT.
 PERFORM 1 FROM public.event_registrations r JOIN auth.users u ON u.id=r.profile_id
 WHERE r.id=p_registration_id AND u.id=p_owner_id AND (u.email_confirmed_at IS NOT NULL OR u.phone_confirmed_at IS NOT NULL) FOR UPDATE OF r;
 IF NOT FOUND THEN RETURN; END IF;
 RETURN QUERY SELECT * FROM public.issue_verified_registration_token(p_registration_id);
END $$;
REVOKE ALL ON FUNCTION public.begin_registration_renewal(text,uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.renew_registration_token_by_phone(text,uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.renew_registration_token_by_owner(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.begin_registration_renewal(text,uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.renew_registration_token_by_phone(text,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.renew_registration_token_by_owner(uuid,uuid) TO service_role;
