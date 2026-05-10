import { useState, useCallback, useRef, useEffect } from "react";
import { collection, addDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { InsertReading } from "@shared/schema";

interface ArduinoReading {
  angle: number;
  roll: number;
  pitch: number;
  yaw: number;
  raw: string;
}

// Added interface for ML response
interface MLAnalysisResult {
  performance_score: number;
  recovery_stage: string;
  status: string;
}

export function useArduinoConnection(patientId: string) {
  const [connected, setConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string>();
  const [currentReading, setCurrentReading] = useState<ArduinoReading | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  // --- NEW STATE FOR ML INTEGRATION ---
  const [readingBuffer, setReadingBuffer] = useState<ArduinoReading[]>([]);
  const [mlFeedback, setMlFeedback] = useState<MLAnalysisResult | null>(null);
  const MAX_SAMPLES = 200;

  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const currentExerciseIdRef = useRef<string | undefined>();
  const currentExerciseNameRef = useRef<string>("Heel Slides"); // Track name for ML lookup
  const isRecordingRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // ✅ Parse Arduino serial line (supports multiple firmware output formats)
  const parseSerialLine = (line: string): ArduinoReading | null => {
    const extractMetric = (patterns: RegExp[]) => {
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          const parsed = Number.parseFloat(match[1]);
          if (Number.isFinite(parsed)) return parsed;
        }
      }
      return undefined;
    };

    const angle = extractMetric([
      /(?:\bangle\b|\bknee[_\s-]*angle\b)\s*[:=]\s*(-?\d+(?:\.\d+)?)/i,
      /\bangle\s*(-?\d+(?:\.\d+)?)/i,
    ]);
    const roll = extractMetric([
      /\broll\b\s*[:=]\s*(-?\d+(?:\.\d+)?)/i,
      /\broll\s*(-?\d+(?:\.\d+)?)/i,
    ]);
    const pitch = extractMetric([
      /\bpitch\b\s*[:=]\s*(-?\d+(?:\.\d+)?)/i,
      /\bpitch\s*(-?\d+(?:\.\d+)?)/i,
    ]);
    const yaw = extractMetric([
      /\byaw\b\s*[:=]\s*(-?\d+(?:\.\d+)?)/i,
      /\byaw\s*(-?\d+(?:\.\d+)?)/i,
    ]);

    // Fallback format: "a,b,c,d" or "a b c d"
    if (
      angle === undefined &&
      roll === undefined &&
      pitch === undefined &&
      yaw === undefined
    ) {
      const numericValues = line.match(/-?\d+(?:\.\d+)?/g)?.map(Number.parseFloat) ?? [];
      if (numericValues.length >= 4) {
        return {
          angle: numericValues[0],
          roll: numericValues[1],
          pitch: numericValues[2],
          yaw: numericValues[3],
          raw: line,
        };
      }
      return null;
    }

    if (
      angle === undefined ||
      roll === undefined ||
      pitch === undefined ||
      yaw === undefined
    ) {
      return null;
    }

    return {
      angle,
      roll,
      pitch,
      yaw,
      raw: line,
    };
  };

  // --- NEW: ML ANALYSIS FUNCTION (Pure ML integration, stores results for physio dashboard) ---
  const stopAndAnalyze = useCallback(async () => {
    if (readingBuffer.length === 0) {
      console.warn("⚠️ No readings to analyze");
      setIsRecording(false);
      return;
    }

    setIsRecording(false);
    try {
      // Ensure we have at least some readings (minimum 10 for meaningful analysis)
      if (readingBuffer.length < 10) {
        console.warn("⚠️ Insufficient readings for ML analysis:", readingBuffer.length);
        setMlFeedback(null);
        return;
      }

      const response = await fetch("http://localhost:8000/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercise_name: currentExerciseNameRef.current,
          readings: readingBuffer.map(r => ({
            knee_angle: r.angle,
            pitch: r.pitch,
            roll: r.roll,
            yaw: r.yaw
          }))
        })
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`ML Service error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      setMlFeedback(result);
      console.log("✅ ML Analysis complete:", result);

      // Store ML results for physiotherapist dashboard (minimal Firebase write)
      if (currentExerciseIdRef.current && patientId) {
        try {
          await addDoc(collection(db, "mlAnalysisResults"), {
            patientId,
            exerciseId: currentExerciseIdRef.current,
            exerciseName: currentExerciseNameRef.current,
            timestamp: Date.now(),
            performance_score: result.performance_score,
            recovery_stage: result.recovery_stage,
            status: result.status,
            sampleCount: readingBuffer.length,
          });
          console.log("✅ ML results stored for physiotherapist dashboard");
        } catch (storageError) {
          console.error("⚠️ Failed to store ML results:", storageError);
          // Don't fail the whole operation if storage fails
        }
      }
    } catch (err: any) {
      console.error("❌ ML Service unreachable:", err);
      // Set error feedback but don't store to Firebase
      setMlFeedback({
        performance_score: 0,
        recovery_stage: "Analysis Failed",
        status: err.message || "Service unavailable",
      });
    } finally {
      // Clear buffer after analysis (whether successful or not)
      setReadingBuffer([]);
    }
  }, [readingBuffer, patientId]);

  // --- NEW: AUTOMATIC ML TRIGGER WHEN BUFFER IS FULL ---
  useEffect(() => {
    if (readingBuffer.length >= MAX_SAMPLES && isRecording) {
      console.log("🏁 Buffer full (200 samples). Triggering ML analysis...");
      stopAndAnalyze();
    }
  }, [readingBuffer.length, isRecording, stopAndAnalyze]);

  // ✅ Save reading locally and send to n8n (Existing Logic Maintained)
  const saveReading = useCallback(
    async (reading: ArduinoReading) => {
      // ADDED: Push to buffer for ML (limit to MAX_SAMPLES)
      setReadingBuffer(prev => {
        if (prev.length >= MAX_SAMPLES) {
          return prev; // Don't add more once we hit the limit
        }
        return [...prev, reading];
      });

      try {
        const exerciseId = currentExerciseIdRef.current ?? "unassigned";

        const readingData: InsertReading = {
          patientId,
          timestamp: Date.now(),
          angle: reading.angle,
          roll: reading.roll,
          pitch: reading.pitch,
          yaw: reading.yaw,
          raw: reading.raw,
          exerciseId,
          sentToN8N: false,
        };

        const collectionRef = collection(db, "readings");
        const readingDocRef = await addDoc(collectionRef, readingData);
        
        // 🔗 Send to n8n webhook (Existing)
        try {
          const n8nRes = await fetch("https://orthoconnect.app.n8n.cloud/webhook/patient-query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(readingData),
          });

          const status = n8nRes.status;
          const n8nData = await n8nRes.json().catch(() => ({}));

          await updateDoc(readingDocRef, {
            sentToN8N: true,
            n8nStatusCode: status,
            n8nResponse: JSON.stringify(n8nData),
          });

          if (Array.isArray(n8nData) && n8nData[0]?.recommendations) {
            const patientRef = collection(db, "patients", patientId, "n8nResponses");
            await addDoc(patientRef, {
              timestamp: Date.now(),
              recommendations: n8nData[0].recommendations,
            });
          }
        } catch (err) {
          console.error("❌ Error sending to n8n:", err);
        }
      } catch (error) {
        console.error("❌ Error preparing reading:", error);
      }
    },
    [patientId]
  );

  // ✅ Connect to Arduino device (Existing)
  const connect = useCallback(async () => {
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      setConnected(true);
      setDeviceName("Arduino Device");

      const decoder = new TextDecoderStream();
      const reader = decoder.readable.getReader();
      const writable = decoder.writable as WritableStream<Uint8Array>;
      const readableStreamClosed = (port.readable as ReadableStream<Uint8Array>).pipeTo(writable);
      readerRef.current = reader;

      let buffer = "";
      (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!value) continue;

            buffer += value;
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const reading = parseSerialLine(line.trim());
              if (reading) {
                setCurrentReading(reading);
                if (isRecordingRef.current) {
                  saveReading(reading);
                }
              }
            }
          }
        } catch (error) {
          console.error("❌ Error in read loop:", error);
        }
      })();
      await readableStreamClosed.catch(() => {});
    } catch (error) {
      console.error("⚠️ Error connecting:", error);
      setConnected(false);
    }
  }, [saveReading]);

  // ✅ Disconnect from Arduino (Existing)
  const disconnect = useCallback(async () => {
    try {
      if (readerRef.current) { await readerRef.current.cancel(); readerRef.current = null; }
      if (portRef.current) { await portRef.current.close(); portRef.current = null; }
      setConnected(false);
    } catch (error) { console.error("❌ Error disconnecting:", error); }
  }, []);

  // ✅ Start recording (Existing with added Name param)
  const startRecording = useCallback(
    async (exerciseId?: string, exerciseName?: string) => {
      setReadingBuffer([]); // Clear buffer for new session
      setMlFeedback(null);  // Clear old results
      currentExerciseNameRef.current = exerciseName || "Heel Slides";

      try {
        if (exerciseId) {
          currentExerciseIdRef.current = exerciseId;
          setIsRecording(true);
          return;
        }
        // Fallback to n8n for ID (Existing)
        const res = await fetch("https://orthoconnect.app.n8n.cloud/webhook/patient-query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patientId }),
        });
        const data = await res.json();
        currentExerciseIdRef.current = data.exerciseId || "manual-" + Date.now();
        setIsRecording(true);
      } catch (error) {
        currentExerciseIdRef.current = "unknown";
        setIsRecording(true);
      }
    },
    [patientId]
  );

  // ✅ Stop recording (Updated to trigger Analysis)
  const stopRecording = useCallback(() => {
    if (readingBuffer.length > 0) {
      stopAndAnalyze();
    } else {
      setIsRecording(false);
      currentExerciseIdRef.current = undefined;
    }
  }, [readingBuffer, stopAndAnalyze]);

  return {
    connected,
    deviceName,
    currentReading,
    isRecording,
    readingCount: readingBuffer.length, // PROGRESS TRACKING
    mlFeedback,                        // ML RESULT DATA
    connect,
    disconnect,
    startRecording,
    stopRecording,
  };
}