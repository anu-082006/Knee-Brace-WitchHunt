import { useState, useEffect, useCallback } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useArduinoConnection } from "@/hooks/useArduinoConnection";
import {
  updateAssignedExercise,
  createExerciseProgress,
  updateExerciseProgress,
} from "@/lib/firestore";
import { useToast } from "@/hooks/use-toast";
import { TopNav } from "@/components/TopNav";
import { ArduinoConnectionPanel } from "@/components/ArduinoConnectionPanel";
import { ExerciseCard } from "@/components/ExerciseCard";
import { LiveReadingCard } from "@/components/LiveReadingCard";
import { getExerciseGifPath } from "@/lib/exerciseMedia";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, Activity as ActivityIcon, Sparkles, RefreshCw } from "lucide-react";
import type { AssignedExercise } from "@shared/schema";

interface N8nRecommendation {
  feedback: string;
  recommendedExercise: string;
  rationale: string;
  additionalAdvice: string;
  confidence: number;
}

export default function PatientDashboard() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [assignedExercises, setAssignedExercises] = useState<AssignedExercise[]>([]);
  const [recommendations, setRecommendations] = useState<N8nRecommendation[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [activeProgressId, setActiveProgressId] = useState<string | null>(null);
  const [selectedExerciseForPreview, setSelectedExerciseForPreview] = useState<AssignedExercise | null>(null);

  const {
    connected,
    deviceName,
    currentReading,
    isRecording,
    readingCount,      // <-- Add this
    mlFeedback,        // <-- Add this
    connect,
    disconnect,
    startRecording,
    stopRecording,
  } = useArduinoConnection(userProfile?.uid || "");


  // 🟢 Fetch Assigned Exercises
  useEffect(() => {
    if (!userProfile) return;

    const exercisesQuery = query(
      collection(db, "patients", userProfile.uid, "assignedExercises")
    );

    const unsubscribe = onSnapshot(exercisesQuery, (snapshot) => {
      const exercises = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as AssignedExercise[];

      setAssignedExercises(exercises);
      setLoadingExercises(false);
    });

    return () => unsubscribe();
  }, [userProfile]);

  // 🟢 Fetch N8n Recommendations from Network (direct webhook, no Firebase storage)
  const fetchN8nRecommendations = useCallback(async () => {
    if (!userProfile?.uid) return;

    setLoadingRecommendations(true);
    try {
      // Try direct n8n webhook first (simple payload format - fetch from network tab)
      let n8nData: any = null;

      try {
        console.log("📡 Fetching n8n recommendations from network (direct webhook)...");
        console.log("Payload:", {
          patientId: userProfile.uid,
          name: userProfile.displayName || "",
          condition: "knee_rehabilitation",
        });

        const directResponse = await fetch("https://orthoconnect.app.n8n.cloud/webhook/patient-query", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            patientId: userProfile.uid,
            name: userProfile.displayName || "",
            condition: "knee_rehabilitation",
          }),
        });

        if (directResponse.ok) {
          n8nData = await directResponse.json();
          console.log("✅ Direct n8n webhook response received:", n8nData);
        } else {
          const errorText = await directResponse.text();
          throw new Error(`Direct webhook failed: ${directResponse.status} - ${errorText}`);
        }
      } catch (directError: any) {
        console.warn("⚠️ Direct n8n webhook failed (likely CORS), trying proxy method:", directError);

        // Fallback: Try proxy method if direct fails (CORS or other issues)
        const proxyResponse = await fetch("/api/n8n/patient-query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: userProfile.uid,
            name: userProfile.displayName || "",
            condition: "knee_rehabilitation",
          }),
        });

        if (!proxyResponse.ok) {
          throw new Error(`Proxy request failed: ${proxyResponse.status}`);
        }

        n8nData = await proxyResponse.json();
        console.log("✅ Proxy n8n response received:", n8nData);
      }

      // Parse recommendations from n8n response (works for both direct and proxy)
      const recs: N8nRecommendation[] = [];
      
      if (Array.isArray(n8nData)) {
        n8nData.forEach((item: any) => {
          if (item.recommendations && Array.isArray(item.recommendations)) {
            item.recommendations.forEach((rec: any) => {
              recs.push({
                feedback: rec.feedback || rec.Feedback || "",
                recommendedExercise: rec.recommendedExercise || rec.RecommendedExercise || rec.exercise || "",
                rationale: rec.rationale || rec.Rationale || "",
                additionalAdvice: rec.additionalAdvice || rec.AdditionalAdvice || rec.advice || "",
                confidence: rec.confidence || rec.Confidence || 0.8,
              });
            });
          } else if (item.feedback || item.recommendedExercise) {
            recs.push({
              feedback: item.feedback || item.Feedback || "",
              recommendedExercise: item.recommendedExercise || item.RecommendedExercise || item.exercise || "",
              rationale: item.rationale || item.Rationale || "",
              additionalAdvice: item.additionalAdvice || item.AdditionalAdvice || item.advice || "",
              confidence: item.confidence || item.Confidence || 0.8,
            });
          }
        });
      } else if (n8nData.recommendations && Array.isArray(n8nData.recommendations)) {
        n8nData.recommendations.forEach((rec: any) => {
          recs.push({
            feedback: rec.feedback || rec.Feedback || "",
            recommendedExercise: rec.recommendedExercise || rec.RecommendedExercise || rec.exercise || "",
            rationale: rec.rationale || rec.Rationale || "",
            additionalAdvice: rec.additionalAdvice || rec.AdditionalAdvice || rec.advice || "",
            confidence: rec.confidence || rec.Confidence || 0.8,
          });
        });
      } else if (n8nData.feedback || n8nData.recommendedExercise) {
        recs.push({
          feedback: n8nData.feedback || n8nData.Feedback || "",
          recommendedExercise: n8nData.recommendedExercise || n8nData.RecommendedExercise || n8nData.exercise || "",
          rationale: n8nData.rationale || n8nData.Rationale || "",
          additionalAdvice: n8nData.additionalAdvice || n8nData.AdditionalAdvice || n8nData.advice || "",
          confidence: n8nData.confidence || n8nData.Confidence || 0.8,
        });
      }

      console.log("✅ Parsed recommendations:", recs);
      setRecommendations(recs);
    } catch (error: any) {
      console.error("❌ Error fetching n8n recommendations:", error);
      toast({
        title: "Could not fetch recommendations",
        description: error.message || "Please try again later.",
        variant: "default",
      });
      setRecommendations([]);
    } finally {
      setLoadingRecommendations(false);
    }
  }, [userProfile?.uid, userProfile?.displayName, toast]);

  useEffect(() => {
    if (!userProfile?.uid) return;

    // Fetch recommendations on mount
    fetchN8nRecommendations();

    // Refresh recommendations every 30 seconds if there's activity
    const interval = setInterval(() => {
      if (connected || isRecording) {
        fetchN8nRecommendations();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [userProfile, connected, isRecording, fetchN8nRecommendations]);

  const handleStartExercise = async (exercise: AssignedExercise) => {
    if (!userProfile?.uid) return;

    if (!connected) {
      toast({
        title: "Device not connected",
        description: "Connect your hardware device before starting the session.",
        variant: "destructive",
      });
      return;
    }

    if (sessionLoading || activeAssignmentId) {
      toast({
        title: "Session already in progress",
        description: "Finish the current exercise before starting another.",
      });
      return;
    }

    setSessionLoading(true);

    try {
      await startRecording(exercise.exerciseId, exercise.exerciseName);

      await updateAssignedExercise(userProfile.uid, exercise.id, {
        status: "in_progress",
      });

      const progress = await createExerciseProgress(userProfile.uid, {
        patientId: userProfile.uid,
        exerciseId: exercise.exerciseId,
        assignedExerciseId: exercise.id,
        sessionStartTime: Date.now(),
      });

      setActiveAssignmentId(exercise.id);
      setActiveProgressId(progress.id);

      toast({
        title: "Exercise started",
        description: `${exercise.exerciseName} session has begun.`,
      });
    } catch (error: any) {
      console.error("Error starting exercise:", error);
      stopRecording();

      try {
        await updateAssignedExercise(userProfile.uid, exercise.id, {
          status: exercise.status,
        });
      } catch (revertError) {
        console.error("Failed to revert exercise status:", revertError);
      }

      toast({
        title: "Could not start session",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSessionLoading(false);
    }
  };

  const handleCompleteExercise = async () => {
    if (!userProfile?.uid || !activeAssignmentId) return;

    setSessionLoading(true);

    try {
      stopRecording();

      const completedAt = Date.now();

      await updateAssignedExercise(userProfile.uid, activeAssignmentId, {
        status: "completed",
        completedAt,
      });

      if (activeProgressId) {
        await updateExerciseProgress(userProfile.uid, activeProgressId, {
          status: "completed",
          sessionEndTime: completedAt,
          completedAt,
        });
      }

      toast({
        title: "Exercise completed",
        description: "Great job! Exercise has been marked complete.",
      });

      // Refresh recommendations after exercise completion
      setTimeout(() => {
        fetchN8nRecommendations();
      }, 2000); // Wait 2 seconds for readings to be processed
    } catch (error: any) {
      console.error("Error completing exercise:", error);
      toast({
        title: "Could not complete exercise",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setActiveAssignmentId(null);
      setActiveProgressId(null);
      setSessionLoading(false);
    }
  };

  useEffect(() => {
    if (!activeAssignmentId) return;
    const activeExercise = assignedExercises.find((ex) => ex.id === activeAssignmentId);
    if (activeExercise && activeExercise.status === "completed") {
      setActiveAssignmentId(null);
      setActiveProgressId(null);
      stopRecording();
    }
  }, [assignedExercises, activeAssignmentId, stopRecording]);

  return (
    <div className="min-h-screen bg-background">
      <TopNav />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Patient Dashboard</h1>
          <p className="text-muted-foreground">
            Track your exercises and view personalized recommendations
          </p>
          {userProfile?.assignedPhysioId && (
            <Badge variant="outline" className="mt-2">
              <ActivityIcon className="w-3 h-3 mr-1" />
              Supervised by physiotherapist
            </Badge>
          )}
        </div>

        {/* 🔹 Arduino + Live Readings Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-1">
            <ArduinoConnectionPanel
              connected={connected}
              deviceName={deviceName}
              currentReading={currentReading}
              isRecording={isRecording}
              onConnect={connect}
              onDisconnect={disconnect}
              onStartRecording={() => startRecording()}
              onStopRecording={stopRecording}
            />
          </div>

          <div className="lg:col-span-2">
            {connected && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-xl">Live Readings</CardTitle>
                  <CardDescription>
                    {currentReading
                      ? "Real-time data from your device"
                      : "Connected. Waiting for sensor data..."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <LiveReadingCard label="Angle" value={currentReading?.angle ?? Number.NaN} />
                    <LiveReadingCard label="Roll" value={currentReading?.roll ?? Number.NaN} />
                    <LiveReadingCard label="Pitch" value={currentReading?.pitch ?? Number.NaN} />
                    <LiveReadingCard label="Yaw" value={currentReading?.yaw ?? Number.NaN} />
                  </div>
                  {/* ML Progress Indicator */}
                  {isRecording && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Recording Progress</span>
                        <span className="text-sm text-muted-foreground">
                          {readingCount} / 200 samples
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min((readingCount / 200) * 100, 100)}%` }}
                        />
                      </div>
                      {readingCount >= 200 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Analysis in progress...
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            {/* ML Feedback Display */}
            {mlFeedback && (
              <Card className="mb-6 border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <ActivityIcon className="w-5 h-5 text-primary" />
                    Performance Analysis
                  </CardTitle>
                  <CardDescription>ML-powered exercise evaluation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Performance Score</p>
                      <p className="text-3xl font-bold text-primary">
                        {mlFeedback.performance_score}
                        <span className="text-lg text-muted-foreground">/100</span>
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Recovery Stage</p>
                      <p className="text-xl font-semibold">{mlFeedback.recovery_stage}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge
                        variant={mlFeedback.status === "Ready" ? "default" : "secondary"}
                        className="text-sm"
                      >
                        {mlFeedback.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* 🔹 Assigned Exercises Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold">Assigned Exercises</CardTitle>
            <CardDescription>Your personalized exercise program</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingExercises ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : assignedExercises.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No exercises assigned yet
                </h3>
                <p className="text-muted-foreground">
                  Your physiotherapist will assign exercises soon.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {assignedExercises.map((exercise) => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    progress={
                      exercise.status === "completed"
                        ? 100
                        : exercise.status === "in_progress"
                        ? 50
                        : 0
                    }
                    onStart={() => handleStartExercise(exercise)}
                    onStop={handleCompleteExercise}
                    isActive={activeAssignmentId === exercise.id}
                    isRecording={isRecording}
                    disabled={sessionLoading && activeAssignmentId !== exercise.id}
                    loading={
                      sessionLoading && activeAssignmentId === exercise.id && isRecording
                    }
                    onViewExercise={() => setSelectedExerciseForPreview(exercise)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={selectedExerciseForPreview !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedExerciseForPreview(null);
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedExerciseForPreview?.exerciseName || "Exercise"}</DialogTitle>
              <DialogDescription>
                Follow the movement shown in the GIF while performing your assigned session.
              </DialogDescription>
            </DialogHeader>
            {selectedExerciseForPreview && (
              <div className="rounded-lg border bg-muted/20 p-2">
                <img
                  src={getExerciseGifPath(selectedExerciseForPreview.exerciseName)}
                  alt={`${selectedExerciseForPreview.exerciseName} demonstration`}
                  className="w-full rounded-md object-contain max-h-[60vh]"
                  loading="lazy"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* 🔹 Recommended Exercises Section (from n8n) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-semibold flex items-center">
                  <Sparkles className="w-5 h-5 mr-2 text-primary" />
                  Recommended Exercises (AI Suggestions)
                </CardTitle>
                <CardDescription>
                  Based on your recent exercise data and device readings
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchN8nRecommendations}
                disabled={loadingRecommendations}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loadingRecommendations ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingRecommendations ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : recommendations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No AI recommendations yet. They’ll appear once new n8n responses are received.
              </p>
            ) : (
              <div className="space-y-6">
                {recommendations.map((rec, index) => (
                  <div
                    key={index}
                    className="p-6 border rounded-lg bg-muted/40 hover:bg-muted/60 transition"
                  >
                    <h3 className="text-lg font-semibold text-primary mb-2">
                      {rec.recommendedExercise}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Feedback:</strong> {rec.feedback}
                    </p>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Rationale:</strong> {rec.rationale}
                    </p>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Additional Advice:</strong> {rec.additionalAdvice}
                    </p>
                    <p className="text-xs text-muted-foreground italic">
                      Confidence: {(rec.confidence * 100).toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
