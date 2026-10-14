import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand,
  ScanCommand, UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

export function createDynamoRepository({ client, tables = {
  tickets: process.env.TICKETS_TABLE,
  comments: process.env.COMMENTS_TABLE,
  activities: process.env.ACTIVITIES_TABLE,
}} = {}) {
  if (Object.values(tables).some((name) => !name)) {
    throw new Error("TICKETS_TABLE, COMMENTS_TABLE and ACTIVITIES_TABLE are required.");
  }

  const db = client ?? DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });

  async function allPages(makeCommand) {
    const items = [];
    let cursor;
    do {
      const result = await db.send(makeCommand(cursor));
      items.push(...(result.Items ?? []));
      cursor = result.LastEvaluatedKey;
    } while (cursor);
    return items;
  }

  function byTicket(tableName, ticketId) {
    return allPages((cursor) => new QueryCommand({
      TableName: tableName,
      IndexName: "ByTicketCreatedAt",
      KeyConditionExpression: "ticketId = :ticketId",
      ExpressionAttributeValues: { ":ticketId": ticketId },
      ScanIndexForward: true,
      ...(cursor ? { ExclusiveStartKey: cursor } : {}),
    }));
  }

  async function put(tableName, item) {
    await db.send(new PutCommand({
      TableName: tableName,
      Item: item,
      ConditionExpression: "attribute_not_exists(id)",
    }));
    return item;
  }

  return {
    listTickets(customerId = null) {
      if (customerId) {
        return allPages((cursor) => new QueryCommand({
          TableName: tables.tickets,
          IndexName: "ByCustomerCreatedAt",
          KeyConditionExpression: "customerId = :customerId",
          ExpressionAttributeValues: { ":customerId": customerId },
          ...(cursor ? { ExclusiveStartKey: cursor } : {}),
        }));
      }
      return allPages((cursor) => new ScanCommand({
        TableName: tables.tickets,
        ...(cursor ? { ExclusiveStartKey: cursor } : {}),
      }));
    },

    async getTicket(id) {
      const result = await db.send(new GetCommand({
        TableName: tables.tickets, Key: { id },
      }));
      return result.Item ?? null;
    },

    insertTicket(ticket) {
      return put(tables.tickets, ticket);
    },

    async updateTicket(id, patch) {
      const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
      if (!entries.length) {
        const result = await db.send(new GetCommand({ TableName: tables.tickets, Key: { id } }));
        return result.Item ?? null;
      }

      const names = { "#pk": "id" };
      const values = {};
      const assignments = entries.map(([field, value], i) => {
        names[`#f${i}`] = field;
        values[`:v${i}`] = value;
        return `#f${i} = :v${i}`;
      });

      try {
        const result = await db.send(new UpdateCommand({
          TableName: tables.tickets,
          Key: { id },
          UpdateExpression: `SET ${assignments.join(", ")}`,
          ConditionExpression: "attribute_exists(#pk)",
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
          ReturnValues: "ALL_NEW",
        }));
        return result.Attributes ?? null;
      } catch (error) {
        if (error.name === "ConditionalCheckFailedException") return null;
        throw error;
      }
    },

    listComments(ticketId) {
      return byTicket(tables.comments, ticketId);
    },
    insertComment(comment) {
      return put(tables.comments, comment);
    },
    listActivities(ticketId) {
      return byTicket(tables.activities, ticketId);
    },
    insertActivity(activity) {
      return put(tables.activities, activity);
    },
  };
}
