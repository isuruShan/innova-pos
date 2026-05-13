/**
 * Remove superadmin user(s) from MongoDB (same `users` collection as all apps).
 *
 * Usage:
 *   cd services/auth-service && node src/remove-super-admin.js --list
 *   node src/remove-super-admin.js --email=you@domain.com --yes
 *   node src/remove-super-admin.js --yes
 *
 * Without --yes, only lists matching users and exits with code 1 (nothing deleted).
 * With --yes only: deletes every user with role "superadmin".
 * With --email=... --yes: deletes that user only if their role is superadmin.
 *
 * Requires MONGO_URI (from .env or AWS Secrets Manager via load-env-for-scripts).
 */

const mongoose = require('mongoose');
const { getMongoConnectionString } = require('@innovapos/mongo-connection');
const { loadEnvForScripts } = require('./lib/load-env-for-scripts');
const User = require('./models/User');

function parseArgs(argv) {
  const out = { list: false, yes: false, email: null };
  for (const a of argv.slice(2)) {
    if (a === '--list' || a === '-l') out.list = true;
    else if (a === '--yes' || a === '-y') out.yes = true;
    else if (a.startsWith('--email=')) out.email = a.slice('--email='.length).trim().toLowerCase();
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`
Remove superadmin users from MongoDB.

  --list, -l          List users with role superadmin (no delete)
  --email=ADDR        With --yes: delete only this email (must be superadmin)
  --yes, -y           Confirm deletion (required to delete)

Examples:
  node src/remove-super-admin.js --list
  node src/remove-super-admin.js --email=old@x.com --yes
  node src/remove-super-admin.js --yes
`);
    process.exit(0);
  }

  let exitCode = 0;
  await loadEnvForScripts();
  const uri = getMongoConnectionString({ fallback: 'mongodb://127.0.0.1:27017/innovapos' });
  await mongoose.connect(uri);

  try {
    const query = { role: 'superadmin' };
    if (args.email) query.email = args.email;

    const users = await User.find(query).select('email name isActive createdAt').lean();

    if (users.length === 0) {
      console.log(args.email ? `No superadmin found with email ${args.email}` : 'No superadmin users found.');
      return;
    }

    console.log('Matching superadmin user(s):');
    for (const u of users) {
      console.log(`  - ${u.email}  (${u.name})  active=${u.isActive}  created=${u.createdAt}`);
    }

    if (args.list || !args.yes) {
      console.log('\nNo changes made. Pass --yes to delete, or --email=... --yes for one account.');
      exitCode = args.list ? 0 : 1;
      return;
    }

    const result = args.email
      ? await User.deleteOne({ role: 'superadmin', email: args.email })
      : await User.deleteMany({ role: 'superadmin' });

    const deleted = result.deletedCount ?? 0;
    console.log(`\nDeleted ${deleted} user(s).`);
  } finally {
    await mongoose.disconnect();
  }
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('remove-super-admin failed:', err.message || err);
  process.exit(1);
});
