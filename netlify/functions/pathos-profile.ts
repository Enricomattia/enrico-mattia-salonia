import { getDeployStore, getStore } from "@netlify/blobs";
import { boundedJson, CatalogueError, requireOwner } from "../../src/lib/pathos-catalogue";
import { profilePhoto, publicProfile } from "../../public/pathos-personal/public-profile.mjs";

const options = { name: "pathos-hosted-profile", consistency: "strong" as const };
const ownerName = "Enrico Mattia Salonia";
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow, noarchive", "X-Content-Type-Options": "nosniff" };
type Store = Pick<ReturnType<typeof getStore>, "get" | "set">;

export const config = { path: "/api/pathos/profile", method: ["GET", "PUT"] };

export async function handleProfile(request: Request, openStore: () => Store, authorize = requireOwner) {
  const responseHeaders = new Headers(headers);
  if (request.method === "GET") responseHeaders.set("Access-Control-Allow-Origin", "*");
  else responseHeaders.set("Vary", "Authorization");

  try {
    if (request.method === "GET") {
      const photo = await openStore().get("photo");
      return Response.json(publicProfile({ username: ownerName, title: "", photo }), { headers: responseHeaders });
    }
    if (request.method !== "PUT") throw new CatalogueError("Method not allowed.", 405);
    await authorize(request);
    if (!/^application\/json\b/i.test(request.headers.get("content-type") || "")) {
      throw new CatalogueError("Send the profile photo as JSON.", 415);
    }
    const body = await boundedJson(request.body, 72 * 1024, 400);
    if (!body || Object.keys(body).length !== 1 || typeof body.photo !== "string"
      || (body.photo && !profilePhoto(body.photo))) {
      throw new CatalogueError("Choose a valid profile photo.");
    }
    await openStore().set("photo", body.photo);
    return Response.json(publicProfile({ username: ownerName, title: "", photo: body.photo }), { headers: responseHeaders });
  } catch (error) {
    const known = error instanceof CatalogueError;
    return Response.json({ error: known ? error.message : "Could not access the public profile. Try again shortly." },
      { status: known ? error.status : 503, headers: responseHeaders });
  }
}

export default (request: Request, context: { deploy: { context: string } }) =>
  handleProfile(request, () => context.deploy.context === "production" ? getStore(options) : getDeployStore(options));
