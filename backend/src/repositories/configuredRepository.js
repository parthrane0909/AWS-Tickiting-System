
import { createRepository } from "./ticketRepository.js";
import { createDynamoRepository } from "./dynamoTicketRepository.js";

export function createConfiguredRepository({
  backend = process.env.PERSISTENCE_BACKEND || "json",
  dataDir,
  client,
  tables,
} = {}) {
  if (backend === "json") {
    return createRepository(dataDir);
  }

  if (backend === "dynamodb") {
    return createDynamoRepository({ client, tables });
  }

  throw new Error(
    `Unsupported PERSISTENCE_BACKEND: ${backend}`
  );
}
