const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function load(p){const js=ts.transpileModule(read(p),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};new Function('exports','module',js)(m.exports,m);return m.exports;}
const {validEmailChange}=load('src/lib/email-account.ts');const {createEmail,classifyResult,validWorkerSecret}=load('supabase/functions/danest-mail-worker/mail.ts');
assert.equal(validEmailChange('new@example.com','old@example.com'),true);
assert.equal(validEmailChange(' OLD@example.com ','old@example.com'),false);
assert.equal(validEmailChange('broken','old@example.com'),false);
assert.equal(validEmailChange('a b@c.com','old@example.com'),false);
assert.equal(validEmailChange('a'.repeat(250)+'@b.co','old@example.com'),false);
assert.equal(validEmailChange('new+tag@example.com','old@example.com'),true);
assert.equal(validWorkerSecret('',''),false);assert.equal(validWorkerSecret('x'.repeat(31),'x'.repeat(31)),false);assert.equal(validWorkerSecret('x'.repeat(32),'x'.repeat(32)),true);assert.equal(validWorkerSecret('x'.repeat(32),'x'.repeat(31)+'y'),false);
assert.equal(classifyResult(200,'test-id'),'accepted');assert.equal(classifyResult(200,null),'retry');assert.equal(classifyResult(429,null),'retry');assert.equal(classifyResult(503,null),'retry');assert.equal(classifyResult(400,null),'permanent_failure');assert.equal(classifyResult(401,null),'permanent_failure');assert.equal(classifyResult(409,null),'retry');
const mail=createEmail('inquiry-created','test@example.com','DaNest <sender@example.com>');assert.deepEqual(mail.to,['test@example.com']);assert.match(mail.subject,/New rental inquiry.*Yêu cầu thuê mới/);assert.match(mail.text,/No payment or password/);assert.equal(createEmail('unknown','test@example.com','sender@example.com').subject,'DaNest | Account notification / Thông báo tài khoản');
const sql=read('supabase/migrations/DaNest_10A14_Account_Email.sql'),worker=read('supabase/functions/danest-mail-worker/index.ts'),ui=read('src/components/account-email-settings.tsx');
assert.match(sql,/ENABLE ROW LEVEL SECURITY/);assert.match(sql,/email_notices_10a14 boolean NOT NULL DEFAULT false/);assert.match(sql,/FOR UPDATE SKIP LOCKED/);assert.match(sql,/ON CONFLICT\(notification_id\) DO NOTHING/);assert.match(worker,/Idempotency-Key/);assert.match(worker,/DANEST_MAIL_ENABLED/);assert.match(ui,/supabase\.auth\.updateUser\(\{email:/);assert.match(read('src/pages/renter-profile.tsx'),/<AccountEmailSettings/);assert.match(read('src/pages/landlord/settings.tsx'),/<AccountEmailSettings/);assert.match(read('src/pages/admin/settings.tsx'),/<AdminEmailStatus/);
console.log('PASS: 31 10A14 email validation, template, worker result and static integration assertions (offline).');
