-- Rollback: 0001_identity_schema
-- Drops all objects created by the forward migration in reverse dependency order.

DROP TABLE IF EXISTS "user_roles"        CASCADE;
DROP TABLE IF EXISTS "role_permissions"  CASCADE;
DROP TABLE IF EXISTS "permissions"       CASCADE;
DROP TABLE IF EXISTS "roles"             CASCADE;
DROP TABLE IF EXISTS "sessions"          CASCADE;
DROP TABLE IF EXISTS "credentials"       CASCADE;
DROP TABLE IF EXISTS "users"             CASCADE;

DROP TYPE IF EXISTS "CredentialType";
DROP TYPE IF EXISTS "UserStatus";
