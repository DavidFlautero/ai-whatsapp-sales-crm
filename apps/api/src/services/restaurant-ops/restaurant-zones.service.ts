import { z } from "zod";

const coordinate = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90)
]);
export const polygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(coordinate).min(4).max(500)).length(1)
}).strict().superRefine((polygon, ctx) => {
  const ring = polygon.coordinates[0];
  const first = ring[0]; const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ctx.addIssue({ code: "custom", message: "Polygon boundary must be closed" });
  }
});

export type VerifiedPolygon = z.infer<typeof polygonSchema>;

// Ray casting for WGS84 lon/lat points over small local delivery polygons.
// Never infer geometry from a label such as "500M" or from a screenshot.
export function containsPoint(
  polygon: VerifiedPolygon, lng: number, lat: number
): boolean {
  if (!Number.isFinite(lng) || !Number.isFinite(lat) ||
      lng < -180 || lng > 180 || lat < -90 || lat > 90) return false;
  const ring = polygon.coordinates[0];
  let inside = false;
  for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];
    const cross=((yi>lat)!==(yj>lat)) &&
      lng < (xj-xi)*(lat-yi)/(yj-yi)+xi;
    if(cross)inside=!inside;
  }
  return inside;
}
