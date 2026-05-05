-- Migration: Drop dify_app_id column from agents
-- Date: 2026-04-24
-- Description: Removes Dify integration column from agents table. Dify support
-- has been fully removed from the product (lib, API routes, UI, env vars).

ALTER TABLE agents DROP COLUMN IF EXISTS dify_app_id;
