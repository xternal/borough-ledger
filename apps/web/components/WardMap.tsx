import { WARD_MAP, type WardModel } from "@/lib/wards";

/**
 * The borough's wards as an SVG drawn from the ONS boundaries (etl/ward_map.py): no map library, no map requests.
 * The ward in focus is filled, its neighbours shaded. Each ward opens its page on click; keyboard and screen reader
 * users get the same links in the list beside it, so the drawing itself is one image to them.
 */
export function WardMap({ wards, current, label, names = false }: { wards: WardModel[]; current?: WardModel; label: string; names?: boolean }) {
  const [w, h] = WARD_MAP.view_box;
  const near = new Set(current?.neighbours ?? []);
  return (
    <figure className="wardmap">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
        {wards.map((x) => (
          <a key={x.id} href={`/ward/${x.id}`} tabIndex={-1}>
            <title>{x.name}</title>
            <path d={x.shape.path} className={x.id === current?.id ? "wm on" : near.has(x.id) ? "wm near" : "wm"} />
          </a>
        ))}
        {wards
          .filter((x) => names || x.id === current?.id)
          .map((x) => (
            <text key={x.id} x={x.shape.label[0]} y={x.shape.label[1]} className={x.id === current?.id ? "wm-l on" : "wm-l"} textAnchor="middle" dominantBaseline="middle">
              {x.name}
            </text>
          ))}
      </svg>
    </figure>
  );
}
