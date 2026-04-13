"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Zap, Loader2, AlertCircle, Download, Edit3, Check, Crown, Palette, Type, MoveVertical, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";

export default function LandingPage() {
  const { isSignedIn, user } = useUser();
  
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error' | 'processing'>('idle');

  // States for Video, Captions & Dimensions
  const [subtitles, setSubtitles] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [cloudSubId, setCloudSubId] = useState<string | null>(null);
  const [vidDimensions, setVidDimensions] = useState({ w: 1080, h: 1920 }); 
  const [renderedPlayerDimensions, setRenderedPlayerDimensions] = useState({ w: 0, h: 0 }); 
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cloudinaryUploadAbortRef = useRef<AbortController | null>(null);
  
  // Live Preview VTT State
  const [vttPreviewUrl, setVttPreviewUrl] = useState<string>("");

  // Edit Feature States
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubtitles, setEditedSubtitles] = useState<string>("");
  const [isUpdatingCaptions, setIsUpdatingCaptions] = useState(false);

  // 💰 Business Model State
  const isPremium = user?.publicMetadata?.isPremium === true;

  // 👑 Premium Styling States
  const [captionColor, setCaptionColor] = useState("#FACC15");
  const [captionFont, setCaptionFont] = useState("Arial"); 
  const [captionSize, setCaptionSize] = useState("42");
  const [captionPosition, setCaptionPosition] = useState("south");

  const countGraphemes = useCallback((text: string) => {
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      return Array.from(segmenter.segment(text)).length;
    }
    return Array.from(text).length;
  }, []);

  const updateRenderedPlayerSize = useCallback(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const nextW = videoEl.clientWidth;
    const nextH = videoEl.clientHeight;

    if (nextW > 0 && nextH > 0) {
      setRenderedPlayerDimensions({ w: nextW, h: nextH });
    }
  }, []);

  const handleVideoLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const videoEl = e.currentTarget;

    if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
      setVidDimensions({ w: videoEl.videoWidth, h: videoEl.videoHeight });
    }

    updateRenderedPlayerSize();
  }, [updateRenderedPlayerSize]);

  const getLinePercentForPosition = useCallback((position: string) => {
    if (position === 'north') return 12;
    if (position === 'center') return 50;
    return 88;
  }, []);

  const wrapCueText = useCallback((text: string, maxCharsPerLine: number) => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return text;

    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const nextLine = currentLine ? `${currentLine} ${word}` : word;
      if (countGraphemes(nextLine) <= maxCharsPerLine || countGraphemes(currentLine) === 0) {
        currentLine = nextLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);
    return lines.join('\n');
  }, [countGraphemes]);

  const buildStyledVtt = useCallback((rawVtt: string) => {
    const activePosition = isPremium ? captionPosition : 'south';
    const linePercent = getLinePercentForPosition(activePosition);
    const cssFontSize = isPremium ? parseInt(captionSize, 10) : 35;

    const usableWidth = Math.max(240, renderedPlayerDimensions.w * 0.9);
    const estimatedCharWidth = Math.max(8, cssFontSize * 0.56);
    const maxCharsPerLine = Math.max(10, Math.min(42, Math.floor(usableWidth / estimatedCharWidth)));

    const sections = rawVtt.split(/\r?\n\r?\n/);

    const styledSections = sections.map((section) => {
      const lines = section.split(/\r?\n/);
      if (lines.length === 0) return section;

      const timingIndex = lines.findIndex((line) => line.includes('-->'));
      if (timingIndex === -1) return section;

      const timingLine = lines[timingIndex];
      const cueTextLines = lines.slice(timingIndex + 1).filter((line) => line.trim() !== '');
      if (cueTextLines.length === 0) return section;

      const cueText = cueTextLines.join(' ');
      const wrappedCueText = wrapCueText(cueText, maxCharsPerLine);
      const withSettings = `${timingLine} line:${linePercent}% position:50% size:92% align:middle`;

      return [
        ...lines.slice(0, timingIndex),
        withSettings,
        wrappedCueText,
      ].join('\n');
    });

    return styledSections.join('\n\n');
  }, [captionPosition, captionSize, getLinePercentForPosition, isPremium, renderedPlayerDimensions.w, wrapCueText]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadStatus('idle');
      setUploadProgress(0);
      setSubtitles("");
      setVideoUrl(null);
      setDownloadUrl(null);
      setCloudSubId(null);
      setIsEditing(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setUploadStatus('idle');

    try {
      const signRes = await fetch('/api/sign-cloudinary');
      const signData = await signRes.json();

      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", signData.apiKey);
      formData.append("timestamp", signData.timestamp);
      formData.append("signature", signData.signature);
      formData.append("folder", "viralflow_uploads");

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `https://api.cloudinary.com/v1_1/${signData.cloudName}/video/upload`);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          setUploadProgress(Math.round(percentComplete));
        }
      };

      xhr.onload = async () => {
        if (xhr.status === 200) {
          const uploadData = JSON.parse(xhr.responseText);
          const uploadedVideoUrl = uploadData.secure_url;
          
          setVidDimensions({ 
            w: uploadData.width || 1080, 
            h: uploadData.height || 1920 
          });
          
          setVideoUrl(uploadedVideoUrl);
          
          setIsUploading(false); 
          setUploadStatus('processing');
          
          try {
            const aiRes = await fetch('/api/process-video', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ videoUrl: uploadedVideoUrl, language: 'en' }), 
            });
            
            const aiData = await aiRes.json();
            if (aiData.subtitles) {
              setSubtitles(aiData.subtitles);
              setEditedSubtitles(aiData.subtitles);

              await uploadVttAndGenerateUrl(aiData.subtitles);
              setUploadStatus('success');
            } else {
              setUploadStatus('error');
            }
          } catch (err) {
            console.error("AI Error:", err);
            setUploadStatus('error');
          }
        } else {
          setUploadStatus('error');
          setIsUploading(false);
        }
      };

      xhr.onerror = () => {
        setUploadStatus('error');
        setIsUploading(false);
      };

      xhr.send(formData);
    } catch (err) {
      console.error("Upload Error:", err);
      setUploadStatus('error');
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (!isPremium) {
      setCaptionColor('#FACC15');
      setCaptionFont('Arial');
      setCaptionSize('42');
      setCaptionPosition('south');
    }
  }, [isPremium]);

  const uploadVttAndGenerateUrl = async (vttText: string, signal?: AbortSignal) => {
    try {
      const requestInit: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vttText: vttText }),
      };

      if (signal && typeof AbortSignal !== 'undefined' && signal instanceof AbortSignal) {
        requestInit.signal = signal;
      }

      const vttRes = await fetch('/api/upload-vtt', {
        ...requestInit,
      });

      if (!vttRes.ok) {
        throw new Error(`VTT upload failed with status ${vttRes.status}`);
      }

      const vttData = await vttRes.json();

      if (vttData.subtitleId) {
        const subId = vttData.subtitleId.replace(/\//g, ':');
        setCloudSubId(subId);
      }
    } catch (vttErr) {
      if (vttErr instanceof DOMException && vttErr.name === 'AbortError') return;
      if (signal?.aborted) return;
      console.error("VTT Upload Error:", vttErr);
    }
  };

  const updateCloudinaryUrl = (
    vidUrl: string, 
    subId: string, 
    color: string, 
    font: string, 
    cssFontSize: number,
    position: string,
    nativeDimensions: { w: number, h: number },
    renderedDimensions: { w: number, h: number }
  ) => {
    const activeColor = isPremium ? color : '#FACC15';
    const activeFont = isPremium ? font : 'Arial';
    const activeCssFontSize = isPremium ? cssFontSize : 35;
    const activePosition = isPremium ? position : 'south';

    const renderedPlayerWidth = renderedDimensions.w;
    const nativeVideoWidth = nativeDimensions.w;
    const nativeVideoHeight = nativeDimensions.h;

    const widthRatio = renderedPlayerWidth > 0 ? nativeVideoWidth / renderedPlayerWidth : 1;
    const cloudinaryParityFactor = 0.78;
    const cloudFontSize = Math.max(12, Math.round(activeCssFontSize * widthRatio * cloudinaryParityFactor));
    
    const borderThickness = Math.max(2, Math.round(cloudFontSize / 12));

    const cleanColor = activeColor.replace('#', '');
    
    const linePercent = getLinePercentForPosition(activePosition);
    let gravity = 'south';
    let yOffset = Math.round(nativeVideoHeight * ((100 - linePercent) / 100)).toString();

    if (isPremium) {
      if (activePosition === 'north') {
        gravity = 'north';
        yOffset = Math.round(nativeVideoHeight * (linePercent / 100)).toString();
      } else if (activePosition === 'center') {
        gravity = 'center';
        yOffset = '0';
      } else {
        gravity = 'south';
        yOffset = Math.round(nativeVideoHeight * ((100 - linePercent) / 100)).toString();
      }
    }

    const magicString = `/upload/fl_attachment:ViralFlow_Clip/l_subtitles:${activeFont}_${cloudFontSize}:${subId},co_rgb:${cleanColor},bo_${borderThickness}px_solid_black,g_${gravity},y_${yOffset}/`;
    const newBurnInUrl = vidUrl.replace('/upload/', magicString);
    
    setDownloadUrl(newBurnInUrl);
  };

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    updateRenderedPlayerSize();

    if (typeof ResizeObserver === 'undefined') {
      const onResize = () => updateRenderedPlayerSize();
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }

    const observer = new ResizeObserver(() => updateRenderedPlayerSize());
    observer.observe(videoEl);

    const onResize = () => updateRenderedPlayerSize();
    window.addEventListener('resize', onResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [videoUrl, updateRenderedPlayerSize]);

  useEffect(() => {
    if (!subtitles || !videoUrl) return;

    const styledVtt = buildStyledVtt(subtitles);

    const controller = new AbortController();
    cloudinaryUploadAbortRef.current?.abort();
    cloudinaryUploadAbortRef.current = controller;

    uploadVttAndGenerateUrl(styledVtt, controller.signal).catch((err) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Styled VTT upload failed:', err);
    });

    return () => {
      controller.abort();
    };
  }, [subtitles, videoUrl, buildStyledVtt]);

  useEffect(() => {
    if (!subtitles) return;

    const styledVtt = buildStyledVtt(subtitles);
    const blob = new Blob([`\uFEFF${styledVtt}`], { type: 'text/vtt;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    setVttPreviewUrl(url);

    if (videoUrl && cloudSubId) {
      const cssFontSize = isPremium ? parseInt(captionSize, 10) : 35;
      const activePosition = isPremium ? captionPosition : 'south';
      updateCloudinaryUrl(
        videoUrl,
        cloudSubId,
        captionColor,
        captionFont,
        cssFontSize,
        activePosition,
        vidDimensions,
        renderedPlayerDimensions
      );
    }

    return () => URL.revokeObjectURL(url);
  }, [subtitles, captionColor, captionFont, captionSize, captionPosition, isPremium, videoUrl, cloudSubId, vidDimensions, renderedPlayerDimensions, buildStyledVtt]);

  const handleSaveCaptions = async () => {
    if (!videoUrl) return;
    setIsUpdatingCaptions(true);
    setSubtitles(editedSubtitles);
    setIsEditing(false);
    setIsUpdatingCaptions(false);
  };

  const handleUpgradeClick = () => {
    if (!user) {
      alert("Please Sign In first to upgrade to PRO!");
      return; 
    }
    
    const baseUrl = "https://nexgynix.lemonsqueezy.com/checkout/buy/4019e697-f418-430a-a596-031fc7ab56fb";
    const checkoutUrl = `${baseUrl}?checkout[custom][user_id]=${user.id}`;
    
    window.open(checkoutUrl, "_blank");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050816] text-white selection:bg-violet-500/30">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-10rem] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="absolute right-[-8rem] top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-[-6rem] h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.07)_1px,transparent_0)] [background-size:24px_24px] opacity-20" />
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        video::cue {
          color: ${isPremium ? captionColor : '#F5C542'} !important;
          font-family: ${isPremium ? `'${captionFont}', sans-serif` : `'Inter', 'Segoe UI', sans-serif`} !important;
          font-size: ${isPremium ? parseInt(captionSize, 10) : 34}px !important;
          font-weight: 700 !important;
          text-transform: none !important;
          background-color: rgba(0, 0, 0, 0.22) !important;
          text-shadow: 0 2px 12px rgba(0, 0, 0, 0.35) !important;
          letter-spacing: 0.01em !important;
        }
      `}} />

      <div className="relative z-10">
        <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#050816]/70 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-semibold shadow-[0_0_30px_rgba(168,85,247,0.25)]">
                V
              </div>
              <div>
                <div className="text-sm font-semibold tracking-[0.24em] text-white/60 uppercase">ViralFlow AI</div>
                <div className="text-sm text-white/80">AI Caption Studio</div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {!isSignedIn ? (
                <SignInButton mode="modal">
                  <button className="bg-white text-black px-6 py-2.5 rounded-full text-sm font-bold shadow-lg hover:bg-gray-200 transition transform hover:scale-105">
                    Sign In
                  </button>
                </SignInButton>
              ) : (
                <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 backdrop-blur-md">
                  {isPremium && (
                    <span className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                      <Crown size={12} /> PRO
                    </span>
                  )}
                  <UserButton />
                </div>
              )}
            </div>
          </div>
        </nav>

        <main className="mx-auto max-w-7xl px-6 pb-16 pt-12 md:px-8 md:pt-16">
          <motion.section
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="mx-auto max-w-4xl text-center"
          >
            <span className="inline-flex items-center rounded-full border border-violet-400/20 bg-violet-400/10 px-4 py-1.5 text-xs font-medium tracking-wide text-violet-200 backdrop-blur-md">
              AI-Powered Viral Captions
            </span>

            <h1 className="mt-6 text-5xl font-semibold tracking-tight text-white md:text-7xl">
              Turn videos into premium social assets.
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/65 md:text-lg">
              Generate cinematic subtitles, dynamic video hooks, and studio-grade styling for creators who want a polished, high-converting caption workflow.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-white/70">
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md">Cinematic Subtitles</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md">Dynamic Video Hooks</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md">Pro Studio Styling</span>
            </div>
          </motion.section>

          {uploadStatus !== 'success' && (
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className="mx-auto mt-12 max-w-4xl"
            >
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-[0_0_60px_rgba(15,23,42,0.35)] backdrop-blur-md md:p-5">
                <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#070b17]/90 p-8 md:p-10">
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-cyan-400/10" />

                  {!file && !isUploading && uploadStatus !== 'processing' && (
                    <input
                      type="file"
                      accept="video/*"
                      className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0"
                      onChange={handleFileChange}
                    />
                  )}

                  <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5 shadow-[0_0_30px_rgba(168,85,247,0.12)] backdrop-blur-md">
                      {isUploading || uploadStatus === 'processing' ? (
                        <Loader2 className="animate-spin text-violet-300" size={34} />
                      ) : (
                        <Upload className="text-violet-300" size={34} />
                      )}
                    </div>

                    <h2 className="mt-6 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                      {file ? file.name : 'Upload a video to start'}
                    </h2>

                    <p className="mt-3 max-w-xl text-sm leading-6 text-white/60 md:text-base">
                      Clean English transcription, premium subtitle styling, and a fast Cloudinary-powered export pipeline.
                    </p>

                    {file && !isUploading && uploadStatus !== 'processing' && (
                      <div className="mt-8 flex w-full max-w-xl flex-col items-center gap-4">
                        <div className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-left backdrop-blur-md">
                          <div className="text-xs font-medium uppercase tracking-[0.2em] text-white/45">Selected file</div>
                          <div className="mt-2 text-sm text-white/85">{file.name}</div>
                        </div>

                        <button
                          onClick={handleUpload}
                          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-7 py-3.5 text-sm font-semibold text-white shadow-[0_0_30px_rgba(168,85,247,0.18)] transition hover:scale-[1.01] hover:shadow-[0_0_40px_rgba(168,85,247,0.24)]"
                        >
                          Generate Captions <Zap size={16} />
                        </button>
                      </div>
                    )}

                    {isUploading && (
                      <div className="mt-8 w-full max-w-xl">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                        </div>
                        <p className="mt-3 text-sm text-white/60">Uploading and preparing your transcription pipeline...</p>
                      </div>
                    )}

                    {uploadStatus === 'processing' && (
                      <div className="mt-8 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/80 backdrop-blur-md">
                        <Loader2 className="animate-spin text-violet-300" size={18} />
                        Whisper AI is generating captions...
                      </div>
                    )}

                    {uploadStatus === 'error' && (
                      <div className="mt-8 flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                        <AlertCircle size={16} />
                        Something went wrong. Please try again.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.section>
          )}

          {uploadStatus === 'success' && videoUrl && (
            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08 }}
              className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]"
            >
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-[0_0_60px_rgba(15,23,42,0.35)] backdrop-blur-md">
                <div className="rounded-[24px] border border-white/10 bg-[#070b17]/90 p-3 md:p-4">
                  {/* 🟢 FIX: Smart Video Container dynamically handles both Landscape & Portrait */}
                  <div className="flex w-full items-center justify-center overflow-hidden rounded-[20px] border border-white/10 bg-black shadow-[0_0_40px_rgba(168,85,247,0.12)]">
                    <video
                      ref={videoRef}
                      controls
                      controlsList="nodownload"
                      autoPlay
                      // 🟢 Set exact shape to avoid stretch
                      style={{ aspectRatio: `${vidDimensions.w} / ${vidDimensions.h}` }} 
                      // 🟢 Max height 500px so it never blows up the screen!
                      className="max-h-[500px] w-auto max-w-full object-contain" 
                      crossOrigin="anonymous"
                      onLoadedMetadata={handleVideoLoadedMetadata}
                    >
                      <source src={videoUrl} type="video/mp4" />
                      {vttPreviewUrl && (
                        <track
                          label="English Captions"
                          kind="subtitles"
                          srcLang="en"
                          src={vttPreviewUrl}
                          default
                        />
                      )}
                    </video>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <div className={`relative rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-[0_0_60px_rgba(15,23,42,0.3)] backdrop-blur-md ${!isPremium ? 'opacity-60' : ''}`}>
                  {!isPremium && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[28px] bg-black/60 backdrop-blur-md">
                      <Lock size={32} className="mb-2 text-amber-300" />
                      <p className="text-sm font-semibold text-white">Premium Feature</p>
                      <button
                        onClick={handleUpgradeClick}
                        className="mt-3 rounded-full bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 px-4 py-2 text-sm font-semibold text-black shadow-[0_0_30px_rgba(250,204,21,0.22)]"
                      >
                        Upgrade to PRO
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-[0.2em] text-white/45">Transcript</div>
                      <h3 className="mt-1 text-lg font-semibold text-white">Edit captions</h3>
                    </div>
                    {!isEditing && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10"
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  <div className="mt-4 pointer-events-auto">
                    {isEditing ? (
                      <div className="space-y-3">
                        <textarea
                          value={editedSubtitles}
                          onChange={(e) => setEditedSubtitles(e.target.value)}
                          className="h-40 w-full rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white outline-none transition focus:border-violet-400/40"
                          style={{ fontFamily: 'Inter, Segoe UI, sans-serif' }}
                        />
                        <button
                          onClick={handleSaveCaptions}
                          disabled={isUpdatingCaptions}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_30px_rgba(168,85,247,0.16)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isUpdatingCaptions ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                          Save changes
                        </button>
                      </div>
                    ) : (
                      <div
                        className="max-h-40 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/70"
                        style={{ fontFamily: 'Inter, Segoe UI, sans-serif' }}
                      >
                        {subtitles.substring(0, 260)}...
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-[28px] border border-amber-400/20 bg-gradient-to-br from-white/8 to-white/5 p-5 shadow-[0_0_60px_rgba(234,179,8,0.08)] backdrop-blur-md">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.14),transparent_55%)]" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 text-amber-300">
                      <Crown size={18} />
                      <span className="text-sm font-semibold uppercase tracking-[0.18em]">Pro Studio Styling</span>
                    </div>

                    <h3 className="mt-3 text-xl font-semibold text-white">Locked premium controls</h3>
                    <p className="mt-2 text-sm leading-6 text-white/65">
                      Unlock refined color control, cinematic typography, placement tuning, and a polished live preview built for premium creators.
                    </p>

                    {!isPremium ? (
                      <div className="mt-5 rounded-[24px] border border-amber-400/20 bg-black/20 p-5 backdrop-blur-md">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-200">
                            <Lock size={18} />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white">Exclusive premium workflow</div>
                            <div className="mt-1 text-sm leading-6 text-white/60">
                              Unlock custom subtitle styling, positioning, and elevated export controls.
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={handleUpgradeClick}
                          className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 px-5 py-3 text-sm font-semibold text-black shadow-[0_0_30px_rgba(250,204,21,0.22)] transition hover:scale-[1.01] hover:shadow-[0_0_40px_rgba(250,204,21,0.28)]"
                        >
                          Upgrade to PRO
                        </button>
                      </div>
                    ) : (
                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="text-xs text-white/45">Status</div>
                          <div className="mt-1 text-sm font-medium text-white">Premium active</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="text-xs text-white/45">Export</div>
                          <div className="mt-1 text-sm font-medium text-white">Cinematic</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className={`rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-md ${!isPremium ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium uppercase tracking-[0.18em] text-white/45 flex items-center gap-1"><Palette size={12}/> Accent</label>
                      <input
                        type="color"
                        value={captionColor}
                        onChange={(e) => setCaptionColor(e.target.value)}
                        className="h-12 w-full cursor-pointer rounded-2xl border border-white/10 bg-transparent p-1"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium uppercase tracking-[0.18em] text-white/45 flex items-center gap-1"><Type size={12}/> Font</label>
                      <select
                        value={isPremium ? captionFont : 'Arial'}
                        onChange={(e) => {
                          if (isPremium) setCaptionFont(e.target.value);
                        }}
                        className="rounded-2xl border border-white/10 bg-black/25 p-3 text-sm text-white outline-none transition focus:border-violet-400/40"
                      >
                        <option value="Impact">Impact</option>
                        <option value="Arial">Arial</option>
                        <option value="Roboto">Roboto</option>
                        <option value="Courier">Courier</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">Font size</label>
                      <input
                        type="range"
                        min="20"
                        max="60"
                        value={isPremium ? captionSize : '42'}
                        onChange={(e) => {
                          if (isPremium) setCaptionSize(e.target.value);
                        }}
                        className="w-full accent-violet-400"
                      />
                      <span className="text-xs text-white/45">{isPremium ? captionSize : '42'}px</span>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium uppercase tracking-[0.18em] text-white/45 flex items-center gap-1"><MoveVertical size={12}/> Position</label>
                      <select
                        value={isPremium ? captionPosition : 'south'}
                        onChange={(e) => {
                          if (isPremium) setCaptionPosition(e.target.value);
                        }}
                        className="rounded-2xl border border-white/10 bg-black/25 p-3 text-sm text-white outline-none transition focus:border-violet-400/40"
                      >
                        <option value="south">Bottom</option>
                        <option value="center">Middle</option>
                        <option value="north">Top</option>
                      </select>
                    </div>
                  </div>
                </div>

                {downloadUrl && (
                  isSignedIn ? (
                    <a
                      href={downloadUrl}
                      download
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-500 px-6 py-3.5 text-sm font-semibold text-black shadow-[0_0_30px_rgba(56,189,248,0.12)] transition hover:scale-[1.01]"
                    >
                      <Download size={18} /> Download captioned video
                    </a>
                  ) : (
                    <div className="mt-5 w-full text-center">
                      <SignInButton mode="modal">
                        <button className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_0_30px_rgba(168,85,247,0.2)] transition hover:scale-[1.01]">
                          <Download size={18} /> Sign in to download
                        </button>
                      </SignInButton>
                      <p className="mt-3 text-xs text-white/50">
                        Create a free account to unlock downloads.
                      </p>
                    </div>
                  )
                )}

                <button
                  onClick={() => {
                    setFile(null);
                    setVideoUrl(null);
                    setDownloadUrl(null);
                    setUploadStatus('idle');
                    setUploadProgress(0);
                    setSubtitles('');
                    setEditedSubtitles('');
                    setCloudSubId(null);
                    setIsEditing(false);
                  }}
                  className="mt-4 w-full text-sm text-white/50 transition hover:text-white"
                >
                  Start over
                </button>
              </div>
            </motion.section>
          )}
        </main>
      </div>
    </div>
  );
}