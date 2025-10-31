-- Add new prompt fields to agents table
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS objective TEXT,
ADD COLUMN IF NOT EXISTS additional_info TEXT;

-- Add comments to explain the fields
COMMENT ON COLUMN agents.objective IS 'The bot''s goal. Use this space to define what the bot''s goal is like assisting with question answers, booking an appointment etc.';
COMMENT ON COLUMN agents.additional_info IS 'Important Business info, why the conversation is happening, who the contact is, rules to follow, etc. Add anything you need the bot to know which will help it automate your conversations and respond to your contacts';
COMMENT ON COLUMN agents.personality IS 'Is the bot you or your assistant? Are they formal or sarcastic? Tell the bot who it is and how it can meet its goals and things to keep in mind while talking to the contact.';
