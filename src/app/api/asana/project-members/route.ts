import { NextRequest, NextResponse } from "next/server";
import { asanaFetch, getAsanaBase } from "@/lib/asana/client";

export interface AsanaMemberInfo {
  gid: string;
  name: string;
  photoUrl: string | null;
}

/** GET /api/asana/project-members?projectId=1211653625969373 */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get("projectId") || "1211653625969373";

    // Get project memberships (each has a .member with user gid)
    const membershipsRes = await asanaFetch<{
      data?: Array<{ member?: { gid?: string }; user?: { gid?: string } }>;
    }>(`${getAsanaBase()}/projects/${projectId}/project_memberships`);
    const memberGids: string[] = [];
    if (membershipsRes.data && Array.isArray(membershipsRes.data)) {
      for (const m of membershipsRes.data) {
        const gid = m.member?.gid ?? m.user?.gid;
        if (gid && !memberGids.includes(gid)) memberGids.push(gid);
      }
    }

    const members: AsanaMemberInfo[] = [];
    for (const gid of memberGids) {
      try {
        const userRes = await asanaFetch<{ data?: { name?: string; photo?: { image_128x128?: string; image_256x256?: string } } }>(`${getAsanaBase()}/users/${gid}`);
        const u = userRes.data;
        const name = u?.name ?? "Unknown";
        const photo = u?.photo;
        const photoUrl =
          typeof photo === "object" && photo !== null
            ? (photo as { image_128x128?: string; image_256x256?: string }).image_128x128 ??
              (photo as { image_256x256?: string }).image_256x256 ??
              null
            : null;
        members.push({ gid, name, photoUrl });
      } catch {
        members.push({ gid, name: "Unknown", photoUrl: null });
      }
    }

    return NextResponse.json({ success: true, data: { members } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch project members";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
