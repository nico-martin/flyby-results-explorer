import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Info, Mic } from "lucide-react";
import { getFilterConfigFromQuery } from "@/lib/ai";
import { getTranscriptionFromAudio, isMultimodalModelAvailable } from "@/lib/voice";
import { FilterState } from "./FilterSidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert } from "@/components/ui/alert.tsx";

interface SmartFiltersProps {
  onFiltersChange: (filters: Partial<FilterState>) => void;
}

export const SmartFilters = ({ onFiltersChange }: SmartFiltersProps) => {
  const [query, setQuery] = React.useState("");
  const [additionalLoadingMessage, setAdditionalLoadingMessage] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isRecording, setIsRecording] = React.useState(false);
  const [isMicAvailable, setIsMicAvailable] = React.useState(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);

  React.useEffect(() => {
    isMultimodalModelAvailable().then(setIsMicAvailable);
  }, []);

  const handleFilter = async (currentQuery: string = query) => {
    setIsLoading(true);
    const newFilters = await getFilterConfigFromQuery(currentQuery, setAdditionalLoadingMessage);
    setAdditionalLoadingMessage("");
    onFiltersChange(newFilters);
    setIsLoading(false);
  };

  const handleMicClick = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setIsLoading(true);
        try {
          const transcription = await getTranscriptionFromAudio(audioBlob);
          setQuery(transcription);
          await handleFilter(transcription);
        } catch (error) {
          console.error("Error getting transcription:", error);
        } finally {
          setIsLoading(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Smart Filters</h3>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Info className="w-3 h-3" />
        </div>
      </div>
      <Textarea
        placeholder="What are you looking for?
Try something like: I want to see direct flights under £300."
        className="mb-2"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex gap-2">
        <Button className="w-full" onClick={() => handleFilter()} disabled={isLoading || isRecording}>
          {isLoading ? "Filtering..." : "Filter flights"}
        </Button>
        {isMicAvailable && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={handleMicClick} disabled={isLoading}>
                  {isRecording ? (
                    <div className="flex items-center gap-2">
                      <Mic className="w-5 h-5" />
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                      </span>
                    </div>
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isRecording ? "Click to stop recording" : "Start recording"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      {additionalLoadingMessage !== "" && <Alert variant="loading" className="mt-2">{additionalLoadingMessage}</Alert>}
    </div>
  );
};
