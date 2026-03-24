import "dotenv/config";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { v2 as cloudinary } from "cloudinary";

type InstagramConnection = {
  user_access_token: string;
  page_id: string;
  ig_user_id: string;
  createdAt: number;
};

type OAuthStateData = {
  userId: string;
  createdAt: number;
};

const connections = new Map<string, InstagramConnection>();
const oauthStates = new Map<string, OAuthStateData>();

const app = express();
app.use(cors());
app.use(express.json({ limit: "30mb" }));

const metaAppId = process.env.META_APP_ID?.trim() ?? "";
const metaAppSecret = process.env.META_APP_SECRET?.trim() ?? "";
const metaRedirectUri = process.env.META_REDIRECT_URI?.trim() ?? "";
const graphVersion = process.env.META_GRAPH_VERSION ?? "v19.0";
const metaScope =
  process.env.META_SCOPE ??
  "pages_show_list,instagram_basic,instagram_manage_insights,instagram_content_publish";
const connectedRedirect = process.env.IG_CONNECTED_REDIRECT ?? "http://localhost:3000";
const port = Number(process.env.IG_SERVER_PORT ?? 8787);
const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? "";
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY?.trim() ?? "";
const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET?.trim() ?? "";

if (cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret) {
  cloudinary.config({
    cloud_name: cloudinaryCloudName,
    api_key: cloudinaryApiKey,
    api_secret: cloudinaryApiSecret,
  });
}

if (process.env.INSTAGRAM_USER_ACCESS_TOKEN) {
  const devUserId = process.env.DEV_USER_ID ?? "dev-user";
  const preconnectToken = process.env.INSTAGRAM_USER_ACCESS_TOKEN;
  bootstrapDevConnection(devUserId, preconnectToken, graphVersion).catch((error) => {
    // Log once on startup; runtime routes continue to work.
    console.error("Failed pre-connect with INSTAGRAM_USER_ACCESS_TOKEN:", error);
  });
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/auth/instagram/debug", (req, res) => {
  const userId = getUserId(req);
  const connection = connections.get(userId);
  const token = process.env.INSTAGRAM_USER_ACCESS_TOKEN?.trim() ?? "";

  res.json({
    ok: true,
    userId,
    hasConnection: Boolean(connection),
    connection: connection
      ? {
          page_id: connection.page_id,
          ig_user_id: connection.ig_user_id,
          createdAt: connection.createdAt,
          tokenPreview: maskToken(connection.user_access_token),
        }
      : null,
    env: {
      devUserId: process.env.DEV_USER_ID ?? "dev-user",
      metaAppId: metaAppId || null,
      hasMetaAppSecret: Boolean(metaAppSecret),
      metaRedirectUri: metaRedirectUri || null,
      graphVersion,
      hasStartupToken: Boolean(token),
      startupTokenPreview: token ? maskToken(token) : null,
    },
  });
});

app.post("/uploads/cloudinary", async (req, res) => {
  if (!hasCloudinaryConfig()) {
    return res.status(400).json({
      error: "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.",
    });
  }

  const images = Array.isArray(req.body?.images)
    ? req.body.images.filter((value: unknown) => typeof value === "string")
    : [];

  if (images.length === 0) {
    return res.status(400).json({ error: "images must be a non-empty string array" });
  }

  if (images.length > 10) {
    return res.status(400).json({ error: "Maximum 10 images per upload batch" });
  }

  const rawFolder =
    typeof req.body?.folder === "string" ? req.body.folder.trim() : "";
  const folder =
    rawFolder && /^[a-zA-Z0-9_\-/]+$/.test(rawFolder)
      ? rawFolder
      : "meditate-with-abhi/instagram-drafts";

  try {
    const urls = await Promise.all(
      images.map(async (image: string, index: number) => {
        const trimmed = image.trim();
        if (/^https?:\/\//i.test(trimmed)) {
          return trimmed;
        }

        if (!trimmed.startsWith("data:image/")) {
          throw new Error(`Unsupported image format at index ${index}. Use data:image/* or public URL.`);
        }

        const upload = await cloudinary.uploader.upload(trimmed, {
          folder,
          resource_type: "image",
        });
        if (!upload.secure_url) {
          throw new Error(`Cloudinary upload failed at index ${index}`);
        }
        return upload.secure_url;
      }),
    );

    return res.json({ ok: true, urls });
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to upload images to Cloudinary",
    });
  }
});

app.post("/auth/instagram/manual-connect", async (req, res) => {
  const userId = getUserId(req);
  const providedToken = String(req.body?.user_access_token ?? "").trim();
  const providedPageId = String(req.body?.page_id ?? "").trim();
  const providedIgUserId = String(req.body?.ig_user_id ?? "").trim();

  if (!providedToken) {
    return res.status(400).json({ error: "user_access_token is required" });
  }

  try {
    let resolvedToken = providedToken;
    try {
      resolvedToken = await exchangeToLongLivedToken({
        shortLivedToken: providedToken,
        graphVersion,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown exchange error";
      console.warn("Manual connect token exchange failed; using token as-is:", message);
    }

    let pageId = providedPageId;
    let igUserId = providedIgUserId;

    if (!pageId || !igUserId) {
      const resolved = await resolvePageAndIgUser({
        userAccessToken: resolvedToken,
        graphVersion,
      });
      pageId = resolved.pageId;
      igUserId = resolved.igUserId;
    }

    connections.set(userId, {
      user_access_token: resolvedToken,
      page_id: pageId,
      ig_user_id: igUserId,
      createdAt: Date.now(),
    });

    return res.json({
      ok: true,
      userId,
      page_id: pageId,
      ig_user_id: igUserId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Manual connect failed";
    return res.status(502).json({ error: message });
  }
});

app.get("/auth/instagram/login", (req, res) => {
  if (!hasOAuthConfig()) {
    return res.status(400).json({
      error: "OAuth is not configured. Set META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI.",
    });
  }

  const userId = getUserId(req);
  const state = cryptoRandomState();
  oauthStates.set(state, { userId, createdAt: Date.now() });
  pruneOldOAuthStates();

  const authUrl = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
  authUrl.searchParams.set("client_id", metaAppId);
  authUrl.searchParams.set("redirect_uri", metaRedirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", metaScope);

  return res.redirect(authUrl.toString());
});

app.get("/auth/instagram/callback", async (req, res) => {
  if (!hasOAuthConfig()) {
    return res.status(400).json({
      error: "OAuth is not configured. Set META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI.",
    });
  }

  const code = String(req.query.code ?? "").trim();
  const state = String(req.query.state ?? "").trim();

  if (!code || !state) {
    return res.status(400).json({ error: "code and state are required" });
  }

  const storedState = oauthStates.get(state);
  oauthStates.delete(state);
  if (!storedState) {
    return res.status(400).json({ error: "Invalid state" });
  }

  try {
    const shortTokenResponse = await fetchJson<{
      access_token: string;
      token_type?: string;
      expires_in?: number;
    }>(
      `https://graph.facebook.com/${graphVersion}/oauth/access_token?` +
        new URLSearchParams({
          client_id: metaAppId,
          client_secret: metaAppSecret,
          redirect_uri: metaRedirectUri,
          code,
        }).toString(),
    );

    const shortLivedToken = shortTokenResponse.access_token;
    if (!shortLivedToken) {
      throw new Error("Meta token exchange did not return access_token");
    }

    const longLivedToken = await exchangeToLongLivedToken({
      shortLivedToken,
      graphVersion,
    });

    const { pageId, igUserId } = await resolvePageAndIgUser({
      userAccessToken: longLivedToken,
      graphVersion,
    });

    connections.set(storedState.userId, {
      user_access_token: longLivedToken,
      page_id: pageId,
      ig_user_id: igUserId,
      createdAt: Date.now(),
    });

    const successUrl = new URL(connectedRedirect);
    successUrl.searchParams.set("connected", "1");
    successUrl.searchParams.set("page_id", pageId);
    successUrl.searchParams.set("ig_user_id", igUserId);
    return res.redirect(successUrl.toString());
  } catch (error) {
    const failureUrl = new URL(connectedRedirect);
    failureUrl.searchParams.set(
      "error",
      error instanceof Error ? error.message : "OAuth callback failed",
    );
    return res.redirect(failureUrl.toString());
  }
});

app.get("/instagram/posts", async (req, res) => {
  const connection = requireConnection(req, res);
  if (!connection) {
    return;
  }

  const limit = String(req.query.limit ?? "").trim();
  const since = String(req.query.since ?? "").trim();
  const until = String(req.query.until ?? "").trim();

  try {
    const url = new URL(`https://graph.facebook.com/${graphVersion}/${connection.ig_user_id}/media`);
    url.searchParams.set(
      "fields",
      "id,caption,media_type,media_url,permalink,timestamp,thumbnail_url",
    );
    url.searchParams.set("access_token", connection.user_access_token);
    if (limit) url.searchParams.set("limit", limit);
    if (since) url.searchParams.set("since", since);
    if (until) url.searchParams.set("until", until);

    const result = await fetchJson<{ data?: unknown[] }>(url.toString());
    return res.json(Array.isArray(result.data) ? result.data : []);
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to fetch Instagram posts",
    });
  }
});

app.post("/instagram/insights", async (req, res) => {
  const connection = requireConnection(req, res);
  if (!connection) {
    return;
  }

  const mediaIds = req.body?.mediaIds;
  if (!Array.isArray(mediaIds) || mediaIds.length === 0 || !mediaIds.every((id) => typeof id === "string")) {
    return res.status(400).json({ error: "mediaIds must be a non-empty string array" });
  }

  const metrics = ["impressions", "reach", "engagement", "saved", "video_views"];

  try {
    const responses = await Promise.all(
      mediaIds.map(async (mediaIdRaw) => {
        const mediaId = mediaIdRaw.trim();
        const url = new URL(`https://graph.facebook.com/${graphVersion}/${mediaId}/insights`);
        url.searchParams.set("metric", metrics.join(","));
        url.searchParams.set("period", "lifetime");
        url.searchParams.set("access_token", connection.user_access_token);

        const response = await fetchJson<{
          data?: Array<{ name?: string; values?: Array<{ value?: number }> }>;
        }>(url.toString());

        const values = Object.fromEntries(metrics.map((metric) => [metric, 0])) as Record<
          string,
          number
        >;
        for (const item of response.data ?? []) {
          const key = item.name ?? "";
          if (key in values) {
            values[key] = Number(item.values?.[0]?.value ?? 0);
          }
        }

        return { id: mediaId, metrics: values };
      }),
    );

    return res.json(responses);
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to fetch insights",
    });
  }
});

app.post("/instagram/publish/create", async (req, res) => {
  const connection = requireConnection(req, res);
  if (!connection) {
    return;
  }

  const imageUrl = String(req.body?.imageUrl ?? "").trim();
  const caption = String(req.body?.caption ?? "");

  if (!imageUrl) {
    return res.status(400).json({ error: "imageUrl is required" });
  }

  try {
    const form = new URLSearchParams();
    form.set("image_url", imageUrl);
    form.set("caption", caption);
    form.set("access_token", connection.user_access_token);

    const result = await fetchJson<{ id?: string }>(
      `https://graph.facebook.com/${graphVersion}/${connection.ig_user_id}/media`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      },
    );

    if (!result.id) {
      throw new Error("Meta did not return creation id");
    }

    return res.json({ creationId: result.id });
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to create publish container",
    });
  }
});

app.post("/instagram/publish/confirm", async (req, res) => {
  const connection = requireConnection(req, res);
  if (!connection) {
    return;
  }

  const creationId = String(req.body?.creationId ?? "").trim();
  if (!creationId) {
    return res.status(400).json({ error: "creationId is required" });
  }

  try {
    const form = new URLSearchParams();
    form.set("creation_id", creationId);
    form.set("access_token", connection.user_access_token);

    const result = await fetchJson<Record<string, unknown>>(
      `https://graph.facebook.com/${graphVersion}/${connection.ig_user_id}/media_publish`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      },
    );

    return res.json({
      published: true,
      creationId,
      meta: result,
    });
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to publish media",
    });
  }
});

app.post("/instagram/publish/draft", async (req, res) => {
  const connection = requireConnection(req, res);
  if (!connection) {
    return;
  }

  const imageUrls = Array.isArray(req.body?.imageUrls)
    ? req.body.imageUrls.filter((url: unknown) => typeof url === "string").map((url: string) => url.trim()).filter(Boolean)
    : [];
  const caption = String(req.body?.caption ?? "");

  if (imageUrls.length === 0) {
    return res.status(400).json({ error: "imageUrls must contain at least one public image URL" });
  }

  try {
    if (imageUrls.length === 1) {
      const creationId = await createMediaContainer({
        graphVersion,
        igUserId: connection.ig_user_id,
        accessToken: connection.user_access_token,
        imageUrl: imageUrls[0],
        caption,
      });

      return res.json({
        ok: true,
        mode: "single",
        creationId,
        note: "Container created. This is not a guaranteed Instagram in-app draft.",
      });
    }

    const childIds = await Promise.all(
      imageUrls.map((imageUrl) =>
        createMediaContainer({
          graphVersion,
          igUserId: connection.ig_user_id,
          accessToken: connection.user_access_token,
          imageUrl,
          isCarouselItem: true,
        }),
      ),
    );

    const carouselCreationId = await createMediaContainer({
      graphVersion,
      igUserId: connection.ig_user_id,
      accessToken: connection.user_access_token,
      mediaType: "CAROUSEL",
      children: childIds,
      caption,
    });

    return res.json({
      ok: true,
      mode: "carousel",
      childCreationIds: childIds,
      creationId: carouselCreationId,
      note: "Carousel container created. This is not a guaranteed Instagram in-app draft.",
    });
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to create Instagram draft container",
    });
  }
});

app.listen(port, () => {
  console.log(`Instagram auth server listening on http://localhost:${port}`);
});

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message =
      (data as { error?: { message?: string } })?.error?.message ??
      `HTTP ${response.status} ${response.statusText}`;
    throw new Error(message);
  }

  return data as T;
}

function getUserId(req: Request): string {
  const authHeader = req.header("authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    const fromBearer = authHeader.slice("Bearer ".length).trim();
    if (fromBearer) return fromBearer;
  }

  const fromQuery = String(req.query.userId ?? "").trim();
  if (fromQuery) {
    return fromQuery;
  }

  if (process.env.DEV_USER_ID?.trim()) {
    return process.env.DEV_USER_ID.trim();
  }

  return "dev-user";
}

function requireConnection(req: Request, res: Response): InstagramConnection | null {
  const userId = getUserId(req);
  const connection = connections.get(userId);
  if (!connection) {
    res.status(401).json({ error: "Instagram not connected for current user" });
    return null;
  }
  return connection;
}

async function exchangeToLongLivedToken({
  shortLivedToken,
  graphVersion,
}: {
  shortLivedToken: string;
  graphVersion: string;
}): Promise<string> {
  if (!metaAppId || !metaAppSecret) {
    // Token-only mode: keep provided token as-is when app credentials are not configured.
    return shortLivedToken;
  }

  const exchangeUrl =
    `https://graph.facebook.com/${graphVersion}/oauth/access_token?` +
    new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: metaAppId,
      client_secret: metaAppSecret,
      fb_exchange_token: shortLivedToken,
    }).toString();

  const response = await fetchJson<{ access_token?: string }>(exchangeUrl);
  if (!response.access_token) {
    throw new Error("Could not exchange token to long-lived token");
  }
  return response.access_token;
}

async function resolvePageAndIgUser({
  userAccessToken,
  graphVersion,
}: {
  userAccessToken: string;
  graphVersion: string;
}): Promise<{ pageId: string; igUserId: string }> {
  const accountsUrl = new URL(`https://graph.facebook.com/${graphVersion}/me/accounts`);
  accountsUrl.searchParams.set("fields", "id,instagram_business_account");
  accountsUrl.searchParams.set("access_token", userAccessToken);

  const accounts = await fetchJson<{
    data?: Array<{ id?: string; instagram_business_account?: { id?: string } }>;
  }>(accountsUrl.toString());

  const match = (accounts.data ?? []).find(
    (entry) => entry.id && entry.instagram_business_account?.id,
  );

  if (!match?.id || !match.instagram_business_account?.id) {
    throw new Error("No connected Facebook Page with Instagram Business account found");
  }

  const confirmUrl = new URL(`https://graph.facebook.com/${graphVersion}/${match.id}`);
  confirmUrl.searchParams.set("fields", "instagram_business_account");
  confirmUrl.searchParams.set("access_token", userAccessToken);
  await fetchJson(confirmUrl.toString());

  return {
    pageId: match.id,
    igUserId: match.instagram_business_account.id,
  };
}

function pruneOldOAuthStates() {
  const maxAgeMs = 10 * 60 * 1000;
  const now = Date.now();
  for (const [key, value] of oauthStates.entries()) {
    if (now - value.createdAt > maxAgeMs) {
      oauthStates.delete(key);
    }
  }
}

function cryptoRandomState(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function hasOAuthConfig(): boolean {
  return Boolean(metaAppId && metaAppSecret && metaRedirectUri);
}

function hasCloudinaryConfig(): boolean {
  return Boolean(cloudinaryCloudName && cloudinaryApiKey && cloudinaryApiSecret);
}

function maskToken(value: string): string {
  if (!value) return "";
  if (value.length <= 12) return `${value.slice(0, 4)}...`;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

async function createMediaContainer({
  graphVersion,
  igUserId,
  accessToken,
  imageUrl,
  caption,
  isCarouselItem,
  mediaType,
  children,
}: {
  graphVersion: string;
  igUserId: string;
  accessToken: string;
  imageUrl?: string;
  caption?: string;
  isCarouselItem?: boolean;
  mediaType?: "CAROUSEL";
  children?: string[];
}): Promise<string> {
  const form = new URLSearchParams();
  if (imageUrl) form.set("image_url", imageUrl);
  if (caption) form.set("caption", caption);
  if (isCarouselItem) form.set("is_carousel_item", "true");
  if (mediaType) form.set("media_type", mediaType);
  if (children && children.length > 0) form.set("children", children.join(","));
  form.set("access_token", accessToken);

  const result = await fetchJson<{ id?: string }>(
    `https://graph.facebook.com/${graphVersion}/${igUserId}/media`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    },
  );

  if (!result.id) {
    throw new Error("Meta did not return creation id");
  }
  return result.id;
}

async function bootstrapDevConnection(userId: string, token: string, version: string) {
  let userAccessToken = token;
  try {
    userAccessToken = await exchangeToLongLivedToken({
      shortLivedToken: token,
      graphVersion: version,
    });
  } catch (error) {
    // Match the other project behavior: keep token as-is if exchange fails.
    const message = error instanceof Error ? error.message : "Unknown exchange error";
    console.warn(
      "INSTAGRAM_USER_ACCESS_TOKEN exchange to long-lived failed; using token as-is:",
      message,
    );
  }

  const { pageId, igUserId } = await resolvePageAndIgUser({
    userAccessToken,
    graphVersion: version,
  });
  connections.set(userId, {
    user_access_token: userAccessToken,
    page_id: pageId,
    ig_user_id: igUserId,
    createdAt: Date.now(),
  });
  console.log(`Pre-connected Instagram for user "${userId}" via token.`);
}
