type DraftContainerResponse = {
  ok: boolean;
  mode: "single" | "carousel";
  creationId: string;
  childCreationIds?: string[];
  note?: string;
};

type InstagramDebugResponse = {
  ok: boolean;
  userId: string;
  hasConnection: boolean;
  connection: {
    page_id: string;
    ig_user_id: string;
    createdAt: number;
    tokenPreview: string;
  } | null;
};

const API_BASE = (import.meta.env.VITE_IG_API_BASE_URL as string | undefined) ?? "http://localhost:8787";
const DEV_USER_ID = (import.meta.env.VITE_DEV_USER_ID as string | undefined) ?? "dev-user";

export async function sendDraftContainerToInstagram(params: {
  imageUrls: string[];
  caption: string;
}): Promise<DraftContainerResponse> {
  const response = await fetch(`${API_BASE}/instagram/publish/draft`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${DEV_USER_ID}`,
    },
    body: JSON.stringify({
      imageUrls: params.imageUrls,
      caption: params.caption,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to send draft container to Instagram");
  }
  return payload as DraftContainerResponse;
}

export async function uploadImagesForInstagramDraft(images: string[]): Promise<string[]> {
  const response = await fetch(`${API_BASE}/uploads/cloudinary`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${DEV_USER_ID}`,
    },
    body: JSON.stringify({ images }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to upload images to Cloudinary");
  }
  return Array.isArray(payload?.urls) ? payload.urls : [];
}

type ConfirmPublishResponse = {
  published: boolean;
  creationId: string;
  meta?: { id?: string };
};

export async function confirmInstagramPublish(creationId: string): Promise<ConfirmPublishResponse> {
  const response = await fetch(`${API_BASE}/instagram/publish/confirm`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${DEV_USER_ID}`,
    },
    body: JSON.stringify({ creationId }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to publish to Instagram");
  }
  return payload as ConfirmPublishResponse;
}

export async function getInstagramConnectionStatus(): Promise<InstagramDebugResponse> {
  const response = await fetch(`${API_BASE}/auth/instagram/debug`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${DEV_USER_ID}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to fetch Instagram connection status");
  }
  return payload as InstagramDebugResponse;
}
