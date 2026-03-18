import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { env } from "../config/env";

export const pg = new Pool({
  connectionString: env.databaseUrl,
});

export const db = {
  query: <T extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<T>> =>
    pg.query<T>(text, values),
  connect: (): Promise<PoolClient> => pg.connect(),
};
