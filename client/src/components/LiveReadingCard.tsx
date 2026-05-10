import { Card, CardContent } from "@/components/ui/card";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

interface LiveReadingCardProps {
  label: string;
  value: number;
  unit?: string;
  previousValue?: number;
}

export function LiveReadingCard({ label, value, unit = "°", previousValue }: LiveReadingCardProps) {
  const hasValidValue = Number.isFinite(value);
  const formattedValue = hasValidValue ? value.toFixed(1) : "--";

  const getTrendIcon = () => {
    if (previousValue === undefined || !hasValidValue || !Number.isFinite(previousValue)) return null;
    
    if (value > previousValue) {
      return <ArrowUp className="w-4 h-4 text-green-500" />;
    } else if (value < previousValue) {
      return <ArrowDown className="w-4 h-4 text-red-500" />;
    }
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const getChangePercentage = () => {
    if (previousValue === undefined || previousValue === 0 || !hasValidValue || !Number.isFinite(previousValue)) return null;
    const change = ((value - previousValue) / previousValue) * 100;
    return Math.abs(change).toFixed(1);
  };

  return (
    <Card className="bg-card text-card-foreground border shadow-sm min-h-[160px]">
      <CardContent className="p-6 text-center">
        <div className="flex items-center justify-center gap-1 mb-2">
          {getTrendIcon()}
          {getChangePercentage() && (
            <span className="text-xs text-muted-foreground">
              {getChangePercentage()}%
            </span>
          )}
        </div>
        <div className="text-5xl font-bold font-mono mb-2" data-testid={`value-${label.toLowerCase()}`}>
          {formattedValue}
          <span className="text-2xl text-muted-foreground ml-1">{unit}</span>
        </div>
        <div className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
      </CardContent>
    </Card>
  );
}
