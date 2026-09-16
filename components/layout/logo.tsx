/** The AIQA icon mark (A + bug-in-magnifying-glass). Single source for the asset. */
export function LogoMark({
  className = "h-9 w-9 rounded-xl",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/aiqa-icon.png"
      alt="AIQA logo"
      className={`object-cover ${className}`}
      style={style}
    />
  );
}
