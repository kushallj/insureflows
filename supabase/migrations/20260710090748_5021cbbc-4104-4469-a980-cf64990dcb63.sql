
CREATE POLICY "Users read own policy docs" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'policy-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own policy docs" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'policy-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own policy docs" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'policy-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own policy docs" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'policy-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
