import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { Usb, Power, Circle } from "lucide-react";

interface ArduinoConnectionPanelProps {
  connected: boolean;
  deviceName?: string;
  currentReading: {
    angle: number;
    roll: number;
    pitch: number;
    yaw: number;
  } | null;
  isRecording: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
}

export function ArduinoConnectionPanel({
  connected,
  deviceName,
  currentReading,
  isRecording,
  onConnect,
  onDisconnect,
  onStartRecording,
  onStopRecording,
}: ArduinoConnectionPanelProps) {
  return (
    <Card className="shadow-lg sticky top-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Arduino Device</CardTitle>
            <CardDescription>Connect your monitoring device</CardDescription>
          </div>
          <ConnectionStatus connected={connected} deviceName={deviceName} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center py-6">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center ${
            connected ? "bg-green-500/10" : "bg-muted"
          }`}>
            <Usb className={`w-12 h-12 ${
              connected ? "text-green-500" : "text-muted-foreground"
            }`} />
          </div>
        </div>

        {connected && currentReading && (
          <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium text-center mb-2">Live Preview</p>
            <div className="grid grid-cols-2 gap-2 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Angle:</span>
                <span className="font-bold" data-testid="preview-angle">{currentReading.angle.toFixed(1)}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Roll:</span>
                <span className="font-bold">{currentReading.roll.toFixed(1)}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pitch:</span>
                <span className="font-bold">{currentReading.pitch.toFixed(1)}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Yaw:</span>
                <span className="font-bold">{currentReading.yaw.toFixed(1)}°</span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {!connected ? (
            <Button
              className="w-full"
              onClick={onConnect}
              data-testid="button-connect"
            >
              <Power className="w-4 h-4 mr-2" />
              Connect Device
            </Button>
          ) : (
            <>
              <Button
                variant="destructive"
                className="w-full"
                onClick={onDisconnect}
                data-testid="button-disconnect"
              >
                <Power className="w-4 h-4 mr-2" />
                Disconnect Device
              </Button>
              
              {onStartRecording && onStopRecording && (
                <Button
                  variant={isRecording ? "secondary" : "default"}
                  className="w-full"
                  onClick={isRecording ? onStopRecording : onStartRecording}
                  data-testid={isRecording ? "button-stop-recording" : "button-start-recording"}
                >
                  <Circle className={`w-4 h-4 mr-2 ${isRecording ? "animate-pulse fill-red-500" : ""}`} />
                  {isRecording ? "Stop Recording" : "Start Recording"}
                </Button>
              )}
            </>
          )}
        </div>

        {!connected && (
          <p className="text-xs text-center text-muted-foreground">
            Make sure your Arduino is connected via USB
          </p>
        )}
      </CardContent>
    </Card>
  );
}
