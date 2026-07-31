// WO-078: Contract migration dropping legacy plaintext tokens and passwords.
// This migration must run AFTER all services are updated to use hashed values.
//
// EXPAND phase (already done in prior migration):
//   - Added password_hash column
//   - Added hashed refresh tokens
// 
// CONTRACT phase (this file): Drop legacy plaintext columns.

-- Safety check: verify all users have been migrated
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM users WHERE password IS NOT NULL AND password_hash IS NULL
    ) THEN
        RAISE EXCEPTION 'Contract migration blocked: % users not yet migrated', (
            SELECT COUNT(*) FROM users WHERE password IS NOT NULL AND password_hash IS NULL
        );
    END IF;
END
$$;

-- Drop legacy plaintext password column
ALTER TABLE users
  DROP COLUMN IF EXISTS password;

-- Drop legacy plaintext refresh token column  
ALTER TABLE refresh_tokens
  DROP COLUMN IF EXISTS token_plaintext;

-- Drop legacy passenger_name_unencrypted if it exists
ALTER TABLE bookings
  DROP COLUMN IF EXISTS passenger_name_plaintext;

-- Verify the migration was successful
DO $$
BEGIN
    ASSERT NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'password'
    ), 'Legacy password column still exists';
    
    RAISE NOTICE 'Contract migration WO-078 completed successfully';
END
$$;
