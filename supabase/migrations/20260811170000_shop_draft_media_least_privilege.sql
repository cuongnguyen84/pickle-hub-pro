-- ============================================================================
-- Draft media — least privilege for the read side
-- ----------------------------------------------------------------------------
-- P2a.2 let any shop member READ the private draft bucket, on the reasoning
-- that reads are the harmless half. They are not, for this bucket.
--
-- The draft bucket holds the ORIGINAL the seller uploaded, straight off a
-- phone. That file has not been through the canvas re-encode yet, so it still
-- carries whatever EXIF the camera wrote — including, routinely, the GPS
-- coordinates of the seller's house. The public rendition is scrubbed; the
-- original is not, and cannot be until it is processed.
--
-- A `support` member has no task that needs the raw original. They see the
-- product, the rendition and the order — that is their job. So the read side
-- now asks the same question the write side does.
--
-- Admin keeps read access for moderation and audit, and that access is already
-- AAL2-gated: is_admin() ANDs admin_session_aal_ok() since 20260730090000, so
-- an admin whose session dropped to aal1 reads nothing.
-- ============================================================================

DROP POLICY IF EXISTS "shop_product_media_draft_select" ON storage.objects;
CREATE POLICY "shop_product_media_draft_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'shop-product-media-draft'
    AND (
      public.is_shop_manager(((storage.foldername(name))[1])::uuid)
      OR public.is_admin()
    )
  );
