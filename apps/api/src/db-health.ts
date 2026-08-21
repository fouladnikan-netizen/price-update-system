import { pingDatabase } from "./db.ts";

const result = await pingDatabase();
console.log(JSON.stringify(result, null, 2));
if (!result.ok) {
  process.exit(1);
}
