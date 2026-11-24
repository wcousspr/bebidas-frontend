const paths = {
  search: "M16 16l4 4M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
  cart: "M3 4h2l2.5 11h10.75l2-7H6M10 19a1 1 0 1 0 0 .01M17 19a1 1 0 1 0 0 .01",
  dashboard: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  drinks: "M10 3h4M10.5 3v5l-3 4v7a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2v-7l-3-4V3M8 14h8",
  categories: "M4 4h7l9 9-7 7-9-9zM8 8h.01",
  logout: "M10 4H5v16h5M9 12h11m-4-4 4 4-4 4",
};

export default function Icon({ name, size = 20 }: { name: keyof typeof paths; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
