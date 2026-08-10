SELECT email, "platformRole" FROM users WHERE email LIKE '%admin%' OR email LIKE '%super%' LIMIT 10;
