-- Migration: Create saved_conversations table
-- Description: Stores user's saved chat conversations with vehicle context
-- Date: 2025-01-05
-- Author: Claude Code

-- Create saved_conversations table
CREATE TABLE IF NOT EXISTS public.saved_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,

    -- Vehicle information
    vehicle_year TEXT,
    vehicle_make TEXT,
    vehicle_model TEXT,
    vehicle_engine_type TEXT,
    vehicle_engine_size TEXT,

    -- Conversation data stored as JSONB for flexibility
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Indexes for performance
    CONSTRAINT saved_conversations_title_length CHECK (char_length(title) BETWEEN 1 AND 200),
    CONSTRAINT saved_conversations_messages_format CHECK (jsonb_typeof(messages) = 'array')
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_saved_conversations_user_id
    ON public.saved_conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_saved_conversations_created_at
    ON public.saved_conversations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_conversations_user_created
    ON public.saved_conversations(user_id, created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.saved_conversations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own saved conversations" ON public.saved_conversations;
DROP POLICY IF EXISTS "Users can insert their own saved conversations" ON public.saved_conversations;
DROP POLICY IF EXISTS "Users can update their own saved conversations" ON public.saved_conversations;
DROP POLICY IF EXISTS "Users can delete their own saved conversations" ON public.saved_conversations;

-- RLS Policy: Users can only view their own saved conversations
CREATE POLICY "Users can view their own saved conversations"
    ON public.saved_conversations
    FOR SELECT
    USING (auth.uid() = user_id);

-- RLS Policy: Users can only insert their own saved conversations
CREATE POLICY "Users can insert their own saved conversations"
    ON public.saved_conversations
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can only update their own saved conversations
CREATE POLICY "Users can update their own saved conversations"
    ON public.saved_conversations
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can only delete their own saved conversations
CREATE POLICY "Users can delete their own saved conversations"
    ON public.saved_conversations
    FOR DELETE
    USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_saved_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS saved_conversations_updated_at_trigger ON public.saved_conversations;

CREATE TRIGGER saved_conversations_updated_at_trigger
    BEFORE UPDATE ON public.saved_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_saved_conversations_updated_at();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_conversations TO authenticated;
GRANT USAGE ON SEQUENCE saved_conversations_id_seq TO authenticated;

-- Add helpful comment
COMMENT ON TABLE public.saved_conversations IS 'Stores saved chat conversations for users with vehicle context and message history';
COMMENT ON COLUMN public.saved_conversations.messages IS 'Array of message objects with role and content fields';
COMMENT ON COLUMN public.saved_conversations.title IS 'User-defined title for the saved conversation';
