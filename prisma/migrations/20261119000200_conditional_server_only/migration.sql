-- Deliberately deny all Data API access: this module uses authenticated server services.
-- PostgreSQL owner/service roles used by Prisma retain their existing BYPASSRLS access.
DO $$
DECLARE table_name text;
BEGIN
 FOREACH table_name IN ARRAY ARRAY['conditional_settings','conditional_customer_profiles','conditional_cases','conditional_items','conditional_events','conditional_profile_events','conditional_shipments','conditional_returns']
 LOOP
  EXECUTE format('CREATE POLICY conditional_server_only ON %I FOR ALL TO PUBLIC USING (false) WITH CHECK (false)',table_name);
 END LOOP;
END $$;
