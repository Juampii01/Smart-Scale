-- RLS para ann_conversations: cada usuario solo ve sus propias conversaciones
ALTER TABLE ann_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ann_conv_select_own" ON ann_conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "ann_conv_insert_own" ON ann_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ann_conv_update_own" ON ann_conversations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "ann_conv_delete_own" ON ann_conversations
  FOR DELETE USING (auth.uid() = user_id);
