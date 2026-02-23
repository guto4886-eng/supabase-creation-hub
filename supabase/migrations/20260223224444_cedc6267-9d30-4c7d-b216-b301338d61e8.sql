UPDATE auth.users 
SET email_confirmed_at = now(),
    updated_at = now()
WHERE email = 'teste@teste.com';

UPDATE auth.users 
SET email_confirmed_at = now(),
    updated_at = now()
WHERE email = 'guto4886@gmail.com';