import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";
import { classifyRepositoryEvidence, getLayer } from "./src/audit.js";
import { loadPublicRepositoryEvidence, ProofModeGitHubError } from "./src/github.js";

const ownerSchema = z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_.-]+$/);
const repoSchema = z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_.-]+$/);
const refSchema = z.string().trim().min(1).max(200).optional();
const layerNameSchema = z.enum(["claimed", "implemented", "tested", "deployed", "verified"]);

async function buildAudit(args) {
  const evidence = await loadPublicRepositoryEvidence(args);
  return classifyRepositoryEvidence(evidence);
}

function safeToolError(error) {
  const safe = error instanceof ProofModeGitHubError
    ? { code: error.code, message: error.message }
    : { code: "audit_failed", message: "ProofMode could not complete the repository audit." };

  return {
    isError: true,
    structuredContent: { ok: false, error: safe },
    content: [{ type: "text", text: safe.message }],
  };
}

function createProofModeServer() {
  const server = new McpServer({
    name: "proofmode",
    version: "0.1.0",
  });

  server.registerTool(
    "audit_repository",
    {
      title: "Audit repository evidence",
      description:
        "Use this when the user wants an evidence-backed audit of a public GitHub repository. Separates claimed, implemented, tested, deployment, and runtime-verification evidence without modifying the repository.",
      inputSchema: {
        owner: ownerSchema,
        repo: repoSchema,
        ref: refSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const audit = await buildAudit(args);
        return {
          structuredContent: { ok: true, audit },
          content: [
            {
              type: "text",
              text: `${audit.repository} at ${audit.headSha.slice(0, 12)}: ${audit.readiness.replaceAll("_", " ")}. Runtime verification was not inferred from repository evidence.`,
            },
          ],
        };
      } catch (error) {
        return safeToolError(error);
      }
    },
  );

  server.registerTool(
    "inspect_repository_evidence",
    {
      title: "Inspect repository evidence",
      description:
        "Use this when the user wants the supporting evidence for one ProofMode layer in a public GitHub repository audit.",
      inputSchema: {
        owner: ownerSchema,
        repo: repoSchema,
        ref: refSchema,
        layer: layerNameSchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const audit = await buildAudit(args);
        const result = getLayer(audit, args.layer);
        return {
          structuredContent: {
            ok: true,
            repository: audit.repository,
            headSha: audit.headSha,
            result,
          },
          content: [
            {
              type: "text",
              text: result
                ? `${audit.repository} ${args.layer}: ${result.state}. ${result.summary}`
                : `No ${args.layer} layer was found.`,
            },
          ],
        };
      } catch (error) {
        return safeToolError(error);
      }
    },
  );

  return server;
}

const mcpHandler = createMcpHandler(createProofModeServer, {
  route: "/mcp",
  responseMode: "json",
});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return Response.json({
        name: "ProofMode",
        version: "0.1.0",
        mode: "read-only",
        mcp: "/mcp",
        privateRepositories: false,
        runtimeVerification: false,
      });
    }

    return mcpHandler(request, env, ctx);
  },
};
