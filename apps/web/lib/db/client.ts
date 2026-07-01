import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/config/env";
import * as schema from "./schema";

type DB = PostgresJsDatabase<typeof schema>;

// Lazy singletons: the connection (and DATABASE_URL read) is deferred to first use
// so `next build` can import route modules without a live database env.
const globalForDb = globalThis as unknown as {
  __fibergateSql?: ReturnType<typeof postgres>;
  __fibergateDb?: DB;
};

function init(): DB {
  if (!globalForDb.__fibergateDb) {
    globalForDb.__fibergateSql ??= postgres(env.databaseUrl, { max: 10 });
    globalForDb.__fibergateDb = drizzle(globalForDb.__fibergateSql, { schema });
  }
  return globalForDb.__fibergateDb;
}

/** Drizzle client. Access triggers connection setup on first use. */
export const db = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    const instance = init();
    const value = Reflect.get(instance as object, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export { schema };
