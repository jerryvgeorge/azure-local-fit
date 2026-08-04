const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");
const { randomUUID } = require("crypto");

const TABLE_NAME = "assessments";
const PARTITION_KEY = "assessment"; // single partition; fine for this scale

function getTableClient() {
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr) {
    throw new Error("AZURE_STORAGE_CONNECTION_STRING app setting is not configured.");
  }
  return TableClient.fromConnectionString(connStr, TABLE_NAME);
}

async function ensureTable(client) {
  await client.createTable(); // no-op if it already exists
}

// POST /api/assessments -- save a new assessment
app.http("createAssessment", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "assessments",
  handler: async (request, context) => {
    try {
      const body = await request.json();

      if (!body || !body.clientName) {
        return { status: 400, jsonBody: { error: "clientName is required." } };
      }

      const client = getTableClient();
      await ensureTable(client);

      const entity = {
        partitionKey: PARTITION_KEY,
        rowKey: randomUUID(),
        clientName: body.clientName,
        assessorName: body.assessorName || "Unknown",
        industry: body.industry || "",
        signal: typeof body.signal === "number" ? body.signal : 0,
        verdictKey: body.verdictKey || "",
        verdictTitle: body.verdictTitle || "",
        answersJson: JSON.stringify(body.answers || {}),
        createdAt: body.createdAt || new Date().toISOString()
      };

      await client.createEntity(entity);

      return { status: 201, jsonBody: { ok: true, id: entity.rowKey } };
    } catch (err) {
      context.error(err);
      return { status: 500, jsonBody: { error: err.message } };
    }
  }
});

// GET /api/assessments -- list all assessments
app.http("listAssessments", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "assessments",
  handler: async (_request, context) => {
    try {
      const client = getTableClient();
      await ensureTable(client);

      const items = [];
      const entities = client.listEntities({
        queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}'` }
      });
      for await (const entity of entities) {
        items.push({
          id: entity.rowKey,
          clientName: entity.clientName,
          assessorName: entity.assessorName,
          industry: entity.industry,
          signal: entity.signal,
          verdictKey: entity.verdictKey,
          verdictTitle: entity.verdictTitle,
          answers: safeParse(entity.answersJson),
          createdAt: entity.createdAt
        });
      }

      return { status: 200, jsonBody: items };
    } catch (err) {
      context.error(err);
      return { status: 500, jsonBody: { error: err.message } };
    }
  }
});

function safeParse(str) {
  try { return JSON.parse(str); } catch { return {}; }
}
