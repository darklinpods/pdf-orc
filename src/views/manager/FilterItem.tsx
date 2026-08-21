export function FilterItem({
  active,
  label,
  count,
  color,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-neutral-200 ${
        active ? 'bg-blue-100 font-medium' : ''
      }`}
    >
      {color !== undefined && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
      <span className="truncate">{label}</span>
      <span className="ml-auto text-xs tabular-nums text-neutral-400">{count}</span>
    </button>
  );
}
