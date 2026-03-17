const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function run() {
  try {
    // 1. Test storage upload
    console.log('Testing storage upload...');
    const buf = Buffer.from('test info');
    const { data: storageData, error: storageError } = await supabase.storage
      .from('study-notes')
      .upload('test/test.txt', buf, { contentType: 'text/plain', upsert: true });

    if (storageError) {
      console.error('Storage Error:', storageError);
    } else {
      console.log('Storage Success:', storageData);
    }

    // 2. Test DB insert
    console.log('Testing DB insert into topic_completions...');
    // We will use fake UUIDs. Since service_role bypasses RLS and foreign key checks...? Actually FK checks are still enforced!
    // We need real IDs to test FKs, but let's just insert something with a bad ID to see if it's an FK error disguised as RLS, OR just look up a valid user/project/topic.
    
    const { data: user } = await supabase.from('users').select('id').limit(1).single();
    const { data: project } = await supabase.from('projects').select('id').limit(1).single();
    const { data: topic } = await supabase.from('topics').select('id').limit(1).single();

    if (user && project && topic) {
        console.log(`Using user ${user.id}, project ${project.id}, topic ${topic.id}`);
        const { data: dbData, error: dbError } = await supabase
          .from('topic_completions')
          .insert({
            user_id: user.id,
            project_id: project.id,
            topic_id: topic.id,
            notes_url: 'test/test.txt',
            notes_type: 'pdf'
          })
          .select()
          .single();

        if (dbError) {
          console.error('DB Error:', dbError);
        } else {
          console.log('DB Success:', dbData);
          // Cleanup
          await supabase.from('topic_completions').delete().eq('id', dbData.id);
        }
    } else {
        console.log("Couldn't find valid user/project/topic to test FKs");
    }

  } catch (err) {
    console.error('Exception:', err);
  }
}

run();
