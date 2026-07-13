const { Client } = require('pg');

const projectRef = 'hijmdaiwxhcrvxqmgxsy';
const password = process.env.SUPABASE_DB_PASSWORD;

if (!password) {
  console.error('❌ SUPABASE_DB_PASSWORD غير موجود');
  process.exit(1);
}

const client = new Client({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  await client.connect();
  console.log('✅ متصل بالـ database');

  await client.query(`
    CREATE TABLE IF NOT EXISTS absences (
      id            text        PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id       text        NOT NULL,
      date          text        NOT NULL,
      shift_number  integer,
      type          text        NOT NULL,
      tardiness_minutes integer,
      excuse        text,
      has_proof     boolean     DEFAULT false,
      coverage_admin_id text,
      penalty       text        NOT NULL DEFAULT 'none',
      penalty_extra_minutes integer DEFAULT 0,
      penalty_applied boolean   DEFAULT false,
      penalty_scheduled_date text,
      monthly_violation_count integer DEFAULT 1,
      notes         text,
      recorded_by   text        NOT NULL,
      created_at    timestamptz DEFAULT now(),
      updated_at    timestamptz DEFAULT now()
    );
  `);
  console.log('✅ تم إنشاء جدول absences');

  // RLS
  await client.query(`ALTER TABLE absences ENABLE ROW LEVEL SECURITY;`);
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'absences' AND policyname = 'all_access'
      ) THEN
        CREATE POLICY all_access ON absences FOR ALL USING (true) WITH CHECK (true);
      END IF;
    END$$;
  `);
  console.log('✅ تم تفعيل RLS والـ policy');

  // Indexes
  await client.query(`CREATE INDEX IF NOT EXISTS absences_user_id_idx ON absences(user_id);`);
  await client.query(`CREATE INDEX IF NOT EXISTS absences_date_idx ON absences(date);`);
  console.log('✅ تم إنشاء الـ indexes');

  await client.end();
  console.log('🎉 Migration اكتملت بنجاح');
}

run().catch(err => {
  console.error('❌ خطأ:', err.message);
  process.exit(1);
});
