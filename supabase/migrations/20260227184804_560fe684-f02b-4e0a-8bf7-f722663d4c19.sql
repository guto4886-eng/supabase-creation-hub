-- Allow authenticated users to upload company logos
CREATE POLICY "Users can upload company logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = 'companies');

-- Allow authenticated users to update (upsert) company logos
CREATE POLICY "Users can update company logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = 'companies');

-- Allow anyone to view company logos (public logos)
CREATE POLICY "Anyone can view company logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = 'companies');

-- Allow authenticated users to delete company logos
CREATE POLICY "Users can delete company logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = 'companies');