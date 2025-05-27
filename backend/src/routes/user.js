const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Load from env
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use Service Role key for admin access
);

router.post('/save', async (req, res) => {
  const token = req.headers.authorization?.split('Bearer ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Missing access token' });
  }

  const { data: user, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { id, email, created_at } = user.user;

  const { data: existingUser } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (!existingUser) {
    const { error: insertError } = await supabase.from('user_profiles').insert([
      {
        id,
        email,
        created_at,
      },
    ]);

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }
  }

  return res.json({ message: 'User saved', id, email });
});

module.exports = router;
