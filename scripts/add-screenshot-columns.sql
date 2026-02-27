-- Migration to add screenshot and thumbnail paths to memories table
-- Run this script to update the existing database

-- Add columns for screenshot storage
ALTER TABLE memories ADD COLUMN screenshot_path TEXT;
ALTER TABLE memories ADD COLUMN thumbnail_path TEXT;

-- Create an index for faster lookups of memories with screenshots
CREATE INDEX IF NOT EXISTS idx_memories_has_screenshot 
ON memories(id) WHERE screenshot_path IS NOT NULL;

-- Verify the migration
SELECT sql FROM sqlite_master WHERE name = 'memories';


