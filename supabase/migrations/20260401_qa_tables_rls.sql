-- Fix QA tables RLS policies - require authentication instead of public access

-- qa_categories
DROP POLICY IF EXISTS qa_categories_all ON qa_categories;
CREATE POLICY qa_categories_auth ON qa_categories
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- qa_checklist_items
DROP POLICY IF EXISTS qa_checklist_items_all ON qa_checklist_items;
CREATE POLICY qa_checklist_items_auth ON qa_checklist_items
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- qa_test_results
DROP POLICY IF EXISTS qa_test_results_all ON qa_test_results;
CREATE POLICY qa_test_results_auth ON qa_test_results
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE qa_categories IS 'QA testing categories. Authenticated users only.';
COMMENT ON TABLE qa_checklist_items IS 'QA checklist items. Authenticated users only.';
COMMENT ON TABLE qa_test_results IS 'QA test results. Authenticated users only. Contains tester emails.';
