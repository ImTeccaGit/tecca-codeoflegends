import { useCountUp } from "@/hooks/use-count-up";

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  duration?: number;
  suffix?: string;
  className?: string;
}

export function AnimatedNumber({
  value,
  decimals = 0,
  duration = 900,
  suffix,
  className,
}: AnimatedNumberProps) {
  const animated = useCountUp(value, { duration });

  const formatted = new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(animated);

  return (
    <span className={className}>
      {formatted}
      {suffix ? <span className="ml-0.5 text-sm">{suffix}</span> : null}
    </span>
  );
}
