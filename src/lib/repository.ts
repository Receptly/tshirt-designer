import { getDb } from "@/lib/db";
import type { SavedDesignPayload } from "@/lib/designPayload";
import { nameKey } from "@/lib/workshop";

export interface ParticipantRecord { id: number; name: string; groupNumber: number; email: string | null; createdAt: string; lastSeenAt: string; }
export interface ParticipantSummary extends ParticipantRecord { garmentType: string | null; shirtColor: string | null; savedAt: string | null; hasMockup: boolean; }

interface ParticipantRow { id: number; name: string; group_number: number; email: string | null; created_at: Date | string; last_seen_at: Date | string; }
interface SummaryRow extends ParticipantRow { garment_type: string | null; shirt_color: string | null; saved_at: Date | string | null; has_mockup: boolean | null; }

const iso = (value: Date | string) => new Date(value).toISOString();
const toParticipant = (row: ParticipantRow): ParticipantRecord => ({ id: row.id, name: row.name, groupNumber: row.group_number, email: row.email, createdAt: iso(row.created_at), lastSeenAt: iso(row.last_seen_at) });

export async function upsertParticipant(input: { name: string; groupNumber: number; email: string | null }) {
  const db = await getDb();
  const [row] = await db.query<ParticipantRow>(
    `insert into participants (name, name_key, group_number, email) values ($1, $2, $3, $4)
     on conflict (group_number, name_key) do update set last_seen_at = now(), email = coalesce(excluded.email, participants.email)
     returning id, name, group_number, email, created_at, last_seen_at`,
    [input.name, nameKey(input.name), input.groupNumber, input.email],
  );
  return toParticipant(row);
}

export async function getParticipant(id: number) {
  const db = await getDb();
  const [row] = await db.query<ParticipantRow>("select id, name, group_number, email, created_at, last_seen_at from participants where id = $1", [id]);
  return row ? toParticipant(row) : null;
}

export async function getDesign(participantId: number) {
  const db = await getDb();
  const [row] = await db.query<{ payload: SavedDesignPayload; saved_at: Date | string }>("select payload, saved_at from designs where participant_id = $1", [participantId]);
  return row ? { payload: row.payload, savedAt: iso(row.saved_at) } : null;
}

export async function saveDesign(participantId: number, payload: SavedDesignPayload, mockup: Buffer | null) {
  const db = await getDb();
  const [row] = await db.query<{ saved_at: Date | string }>(
    `insert into designs (participant_id, payload, mockup, garment_type, shirt_color, saved_at) values ($1, $2::jsonb, $3, $4, $5, now())
     on conflict (participant_id) do update set payload = excluded.payload, mockup = coalesce(excluded.mockup, designs.mockup),
       garment_type = excluded.garment_type, shirt_color = excluded.shirt_color, saved_at = now()
     returning saved_at`,
    [participantId, JSON.stringify(payload), mockup, payload.configuration.garmentType, payload.configuration.shirtColor],
  );
  return iso(row.saved_at);
}

export async function listParticipants(): Promise<ParticipantSummary[]> {
  const db = await getDb();
  const rows = await db.query<SummaryRow>(
    `select p.id, p.name, p.group_number, p.email, p.created_at, p.last_seen_at, d.garment_type, d.shirt_color, d.saved_at, (d.mockup is not null) as has_mockup
     from participants p left join designs d on d.participant_id = p.id order by p.group_number, lower(p.name)`,
  );
  return rows.map((row) => ({ ...toParticipant(row), garmentType: row.garment_type, shirtColor: row.shirt_color, savedAt: row.saved_at ? iso(row.saved_at) : null, hasMockup: Boolean(row.has_mockup) }));
}

export async function getMockup(participantId: number) {
  const db = await getDb();
  const [row] = await db.query<{ mockup: Uint8Array | null }>("select mockup from designs where participant_id = $1", [participantId]);
  return row?.mockup ? Buffer.from(row.mockup) : null;
}

export async function getDesignMeta(participantId: number) {
  const db = await getDb();
  const [row] = await db.query<{ garment_type: string; shirt_color: string; saved_at: Date | string; has_mockup: boolean }>(
    "select garment_type, shirt_color, saved_at, (mockup is not null) as has_mockup from designs where participant_id = $1",
    [participantId],
  );
  return row ? { garmentType: row.garment_type, shirtColor: row.shirt_color, savedAt: iso(row.saved_at), hasMockup: row.has_mockup } : null;
}
