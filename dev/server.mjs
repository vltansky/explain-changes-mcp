import { createServer } from "node:http";
import { watch } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3456;

// Mock data for development
const mockData = {
  title: "Add JWT Authentication",
  summary:
    "This commit adds JWT-based authentication middleware and applies it to all API routes along with rate limiting.",
  diff: `diff --git a/src/middleware/auth.ts b/src/middleware/auth.ts
new file mode 100644
index 0000000..a1b2c3d
--- /dev/null
+++ b/src/middleware/auth.ts
@@ -0,0 +1,18 @@
+import jwt from 'jsonwebtoken';
+import { Request, Response, NextFunction } from 'express';
+
+export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
+  const token = req.headers.authorization?.split(' ')[1];
+
+  if (!token) {
+    return res.status(401).json({ error: 'No token provided' });
+  }
+
+  try {
+    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
+    req.user = decoded;
+    next();
+  } catch (err) {
+    res.status(401).json({ error: 'Invalid token' });
+  }
+};
diff --git a/src/routes/api.ts b/src/routes/api.ts
index 1234567..89abcde 100644
--- a/src/routes/api.ts
+++ b/src/routes/api.ts
@@ -1,5 +1,8 @@
 import express from 'express';
+import { authMiddleware } from '../middleware/auth';
+import { rateLimiter } from '../middleware/rate-limit';

 const router = express.Router();
+router.use(authMiddleware);
+router.use(rateLimiter);

 export default router;`,
  annotations: [
    {
      file: "src/middleware/auth.ts",
      line: 5,
      explanation:
        'Extracts the JWT from the Authorization header, expecting "Bearer <token>" format.',
      actions: [
        {
          label: "Add token format validation",
          prompt: `Add validation to check the token format before attempting to verify.

Current code in src/middleware/auth.ts:5-6:
\`\`\`typescript
const token = req.headers.authorization?.split(' ')[1];

if (!token) {
  return res.status(401).json({ error: 'No token provided' });
}
\`\`\`

The code assumes Bearer format but doesn't validate it. Add a check for:
1. Header starts with "Bearer "
2. Token is not empty after split
3. Return 400 Bad Request for malformed headers vs 401 for missing auth`,
        },
        {
          label: "Extract to getTokenFromHeader",
          prompt: `Extract token extraction into a reusable function.

Current code in src/middleware/auth.ts:5:
\`\`\`typescript
const token = req.headers.authorization?.split(' ')[1];
\`\`\`

Create a separate function that:
1. Handles both "Bearer" and "bearer" (case-insensitive)
2. Returns null for invalid formats
3. Can be reused in WebSocket upgrade handlers`,
        },
      ],
    },
    {
      file: "src/middleware/auth.ts",
      line: 12,
      explanation:
        "Verifies the token using JWT_SECRET from environment. On success, decoded payload is attached to req.user.",
      actions: [
        {
          label: "Add type for decoded payload",
          prompt: `Add TypeScript type for the decoded JWT payload.

Current code in src/middleware/auth.ts:12-13:
\`\`\`typescript
const decoded = jwt.verify(token, process.env.JWT_SECRET!);
req.user = decoded;
\`\`\`

The decoded payload is untyped. Create a JwtPayload interface with expected fields (userId, email, role, etc.) and cast the result:
\`\`\`typescript
interface JwtPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}
const decoded = jwt.verify(token, secret) as JwtPayload;
\`\`\``,
        },
      ],
    },
    {
      file: "src/routes/api.ts",
      line: 6,
      explanation:
        "Applies authMiddleware to all routes on this router. Requests without valid tokens will get 401 before reaching handlers.",
      actions: [
        {
          label: "Add public routes bypass",
          prompt: `Some routes might need to be public. Add a way to skip auth for specific paths.

Current code in src/routes/api.ts:6:
\`\`\`typescript
router.use(authMiddleware);
\`\`\`

Consider either:
1. Apply auth to specific routes instead of globally
2. Create a whitelist of public paths in the middleware
3. Use a wrapper: \`router.use(authMiddleware.unless({ path: ['/health', '/docs'] }))\``,
        },
      ],
    },
  ],
  editor: "cursor",
  globalActions: [
    {
      label: "Add error handling tests",
      prompt: `Add unit tests covering error scenarios for the auth middleware.

Files to test: src/middleware/auth.ts

Test cases needed:
1. Missing Authorization header → 401
2. Malformed header (no "Bearer" prefix) → 401
3. Invalid/expired token → 401
4. Valid token → next() called with req.user set
5. JWT_SECRET not set → appropriate error

Use Jest with supertest for HTTP testing.`,
    },
    {
      label: "Consistent error response format",
      prompt: `Standardize error responses across the new middleware.

Current responses vary:
- auth.ts:8: \`{ error: 'No token provided' }\`
- auth.ts:16: \`{ error: 'Invalid token' }\`

Create a consistent error format:
\`\`\`typescript
{
  success: false,
  error: {
    code: 'AUTH_TOKEN_MISSING',
    message: 'No token provided'
  }
}
\`\`\`

Apply this format to all error responses in the new files.`,
    },
  ],
};

// Track connected clients for live reload
const clients = new Set();

// Load generator with cache busting
async function loadGenerator() {
  const cacheBuster = `?t=${Date.now()}`;
  const modulePath = join(__dirname, "../dist/html-generator.js");
  return import(modulePath + cacheBuster);
}

const server = createServer(async (req, res) => {
  // SSE endpoint for live reload
  if (req.url === "/__reload") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.write("data: connected\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  try {
    const { generateHTML } = await loadGenerator();

    const html = generateHTML(
      mockData.title,
      mockData.summary,
      mockData.diff,
      mockData.annotations,
      mockData.editor,
      "side-by-side",
      mockData.globalActions
    );

    // Inject live reload script
    const liveReloadScript = `
      <script>
        const evtSource = new EventSource('/__reload');
        evtSource.onmessage = (e) => {
          if (e.data === 'reload') location.reload();
        };
        evtSource.onerror = () => {
          console.log('Live reload disconnected');
          setTimeout(() => location.reload(), 2000);
        };
      </script>
    `;

    const htmlWithReload = html.replace("</body>", `${liveReloadScript}</body>`);

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(htmlWithReload);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end(`
      <html>
        <body style="background:#1e1e1e;color:#f14c4c;font-family:monospace;padding:40px;">
          <h2>Build Error</h2>
          <pre>${err.message}</pre>
          <p style="color:#888;margin-top:20px;">Fix the error and save - page will auto-reload.</p>
          <script>
            const evtSource = new EventSource('/__reload');
            evtSource.onmessage = (e) => { if (e.data === 'reload') location.reload(); };
          </script>
        </body>
      </html>
    `);
  }
});

// Watch for file changes
const srcDir = join(__dirname, "../src");
let debounceTimer = null;

const watcher = watch(srcDir, { recursive: false }, (eventType, filename) => {
  if (!filename?.endsWith(".ts")) return;

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    console.log(`\n📝 Changed: ${filename}`);
    console.log("🔄 Rebuilding...");

    exec("npm run build", { cwd: join(__dirname, "..") }, (err, stdout, stderr) => {
      if (err) {
        console.error("❌ Build failed:");
        console.error(stderr);
        // Still notify clients to show error
        clients.forEach((client) => client.write("data: reload\n\n"));
        return;
      }
      console.log("✅ Build complete");
      clients.forEach((client) => client.write("data: reload\n\n"));
      console.log(`🔄 Reloading ${clients.size} client(s)...`);
    });
  }, 100);
});

watcher.on('error', (err) => {
  console.error('Watcher error:', err);
});

server.listen(PORT, async () => {
  console.log(`
╔════════════════════════════════════════════════╗
║     🎨 Code Explainer MCP - Dev Server         ║
╠════════════════════════════════════════════════╣
║                                                ║
║   http://localhost:${PORT}                       ║
║                                                ║
║   • Edit src/html-generator.ts                 ║
║   • Browser auto-reloads on save               ║
║   • Mock data in dev/server.mjs                ║
║                                                ║
╚════════════════════════════════════════════════╝
`);

  // Auto-open browser
  const open = await import("open");
  open.default(`http://localhost:${PORT}`);
});
