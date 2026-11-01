import * as process from 'node:process'

import { runRemix } from 'remix/cli'

const argv = process.argv.slice(2)

// `db:reset` is the only command that drops and recreates the database. Keep
// the vendor `--force` gate in the operator's hands and refuse the convenience
// script outright in production; use the vendor CLI deliberately if that is
// really what an environment needs.
if (argv[0] === 'reset' && process.env.NODE_ENV === 'production') {
  console.error(
    'Refusing `db:reset` with NODE_ENV=production. Run `remix db reset --force` deliberately instead.',
  )
  process.exit(1)
}

// Loads `.env` through the npm script (`node --env-file-if-exists=.env`) before
// invoking the vendor CLI, which reads DATABASE_URL from `remix.json`'s
// `db.adapter.connectionString`.
process.exit(await runRemix(['db', ...argv]))
