"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Zap, Loader2, AlertCircle, Download, Edit3, Check, Crown, Palette, Type, MoveVertical, Lock, CheckCircle, TrendingUp, Users, Share2, Hash } from 'lucide-react';
import { motion } from 'framer-motion';
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";

export default function LandingPage() {
  const { isSignedIn, user } = useUser();
  
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error' | 'processing'>('idle');

  const [subtitles, setSubtitles] = useState<string>("");
  // 🟢 State for Marketing Insights
  const [marketingData, setMarketingData] = useState<{audience?: string, title?: string, platforms?: string[], hashtags?: string[]} | null>(null);
  
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [cloudSubId, setCloudSubId] = useState<string | null>(null);
  const [vidDimensions, setVidDimensions] = useState({ w: 1080, h: 1920 }); 
  const [renderedPlayerDimensions, setRenderedPlayerDimensions] = useState({ w: 0, h: 0 }); 
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cloudinaryUploadAbortRef = useRef<AbortController | null>(null);
  
  const [vttPreviewUrl, setVttPreviewUrl] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubtitles, setEditedSubtitles] = useState<string>("");
  const [isUpdatingCaptions, setIsUpdatingCaptions] = useState(false);

  const isPremium = user?.publicMetadata?.isPremium === true;

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
      const selectedFile = e.target.files[0];
      const maxSizeInBytes = 100 * 1024 * 1024; 
      if (selectedFile.size > maxSizeInBytes) {
        alert("File is too large. Please upload a video under 100MB.");
        e.target.value = ''; 
        return;
      }
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        if (video.duration > 301) { 
          alert("Video is too long. Maximum allowed duration is 5 minutes for viral clips.");
          return;
        }
        setFile(selectedFile);
        setUploadStatus('idle');
        setUploadProgress(0);
        setSubtitles("");
        setMarketingData(null); // Reset marketing
        setVideoUrl(null);
        setDownloadUrl(null);
        setCloudSubId(null);
        setIsEditing(false);
      };
      video.src = URL.createObjectURL(selectedFile);
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
              // 🟢 Set Marketing Data
              if(aiData.marketing) {
                setMarketingData(aiData.marketing);
              }
              await uploadVttAndGenerateUrl(aiData.subtitles);
              setUploadStatus('success');
            } else {
              setUploadStatus('error');
            }
          } catch (err) {
            console.error("AI Fetch Error:", err);
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
      const vttRes = await fetch('/api/upload-vtt', { ...requestInit });
      if (!vttRes.ok) throw new Error(`VTT upload failed with status ${vttRes.status}`);
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
    vidUrl: string, subId: string, color: string, font: string, cssFontSize: number, position: string,
    nativeDimensions: { w: number, h: number }, renderedDimensions: { w: number, h: number }
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
    return () => { controller.abort(); };
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
        videoUrl, cloudSubId, captionColor, captionFont, cssFontSize, activePosition, vidDimensions, renderedPlayerDimensions
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
      alert("Please create a free account first to upgrade to PRO.");
      return; 
    }
    const baseUrl = "https://nexgynix.lemonsqueezy.com/checkout/buy/4019e697-f418-430a-a596-031fc7ab56fb";
    const checkoutUrl = `${baseUrl}?checkout[custom][user_id]=${user.id}`;
    window.open(checkoutUrl, "_blank");
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050816] text-white selection:bg-violet-500/30 font-sans flex flex-col justify-between">
      <div className="pointer-events-none absolute inset-0 z-0">
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

      <div className="relative z-10 w-full">
        <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#050816]/70 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-8">
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-bold shadow-[0_0_30px_rgba(168,85,247,0.25)]">
                V
              </div>
              <div>
                <div className="text-sm font-bold tracking-[0.15em] text-white/90 uppercase">ViralFlow</div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {!isSignedIn ? (
                <SignInButton mode="modal">
                  <button className="bg-white text-black px-6 py-2 rounded-full text-sm font-semibold shadow-lg hover:bg-gray-200 transition transform hover:scale-105">
                    Sign In
                  </button>
                </SignInButton>
              ) : (
                <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 backdrop-blur-md">
                  {isPremium && (
                    <span className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                      <Crown size={12} /> PRO Plan
                    </span>
                  )}
                  <UserButton />
                </div>
              )}
            </div>
          </div>
        </nav>

        <main className="mx-auto w-full max-w-7xl px-6 pb-24 pt-12 md:px-8 md:pt-16">
          <motion.section
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="mx-auto max-w-4xl text-center"
          >
            <span className="inline-flex items-center rounded-full border border-violet-400/20 bg-violet-400/10 px-4 py-1.5 text-xs font-medium tracking-wide text-violet-200 backdrop-blur-md">
              AI-Powered Video Transcription
            </span>

            <h1 className="mt-6 text-5xl font-bold tracking-tight text-white md:text-7xl">
              Transform raw footage into viral social assets.
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/65 md:text-lg">
              Leverage AI to generate perfectly synced, cinematic subtitles. Upgrade your workflow with dynamic hooks and premium styling designed for modern creators.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-white/70 font-medium">
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md">Fast Processing</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md">Studio Grade Export</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md">Full Customization</span>
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

                    <h2 className="mt-6 text-2xl font-bold tracking-tight text-white md:text-3xl">
                      {file ? file.name : 'Drop your video here to begin'}
                    </h2>

                    <p className="mt-3 max-w-xl text-sm leading-6 text-white/60 md:text-base">
                      High-speed cloud rendering with millimeter-perfect subtitle placement. <br/>
                      <span className="text-xs text-white/40 mt-1 block font-semibold text-amber-200/50">(Supported formats: MP4, MOV. Max size: 100MB or 5 mins)</span>
                    </p>

                    {file && !isUploading && uploadStatus !== 'processing' && (
                      <div className="mt-8 flex w-full max-w-xl flex-col items-center gap-4">
                        <button
                          onClick={handleUpload}
                          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-8 py-4 text-sm font-bold text-white shadow-[0_0_30px_rgba(168,85,247,0.18)] transition hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(168,85,247,0.24)]"
                        >
                          Process Video <Zap size={16} />
                        </button>
                      </div>
                    )}

                    {isUploading && (
                      <div className="mt-8 w-full max-w-xl">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                        </div>
                        <p className="mt-3 text-sm text-white/60 font-medium">Uploading source file...</p>
                      </div>
                    )}

                    {uploadStatus === 'processing' && (
                      <div className="mt-8 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm font-medium text-white/90 backdrop-blur-md shadow-lg">
                        <Loader2 className="animate-spin text-violet-400" size={20} />
                        AI is transcribing and rendering subtitles...
                      </div>
                    )}

                    {uploadStatus === 'error' && (
                      <div className="mt-8 flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-3 text-sm font-medium text-red-200">
                        <AlertCircle size={18} />
                        Processing failed. Server timeout or file limit exceeded. Try a shorter video.
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
                  <div className="flex w-full items-center justify-center overflow-hidden rounded-[20px] border border-white/10 bg-black shadow-[0_0_40px_rgba(168,85,247,0.12)]">
                    <video
                      ref={videoRef}
                      controls
                      controlsList="nodownload"
                      autoPlay
                      style={{ aspectRatio: `${vidDimensions.w} / ${vidDimensions.h}` }} 
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
                {/* 🟢 NEW: AI Growth Strategy Insights Section */}
                {marketingData && (
                  <div className="relative overflow-hidden rounded-[28px] border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-transparent p-6 shadow-[0_0_60px_rgba(139,92,246,0.1)] backdrop-blur-md">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.15),transparent_60%)]" />
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-violet-300">
                          <TrendingUp size={18} />
                          <span className="text-sm font-bold uppercase tracking-[0.15em]">AI Growth Strategy</span>
                        </div>
                        <span className="bg-violet-500/20 text-violet-300 text-xs px-2 py-1 rounded border border-violet-500/30 font-medium">Auto-Generated</span>
                      </div>
                      
                      <div className="bg-black/30 rounded-xl p-4 border border-white/5 mb-3">
                        <div className="text-[10px] text-white/50 uppercase font-bold tracking-widest mb-1">Viral Hook / Title</div>
                        <div className="text-sm text-white font-medium">"{marketingData.title}"</div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                          <div className="flex items-center gap-1.5 text-[10px] text-white/50 uppercase font-bold tracking-widest mb-2"><Users size={12}/> Target Audience</div>
                          <div className="text-sm text-white font-medium leading-tight">{marketingData.audience}</div>
                        </div>
                        <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                          <div className="flex items-center gap-1.5 text-[10px] text-white/50 uppercase font-bold tracking-widest mb-2"><Share2 size={12}/> Best Platforms</div>
                          <div className="flex flex-wrap gap-1.5">
                            {marketingData.platforms?.map((p, i) => (
                              <span key={i} className="bg-white/10 px-2 py-0.5 rounded text-xs font-medium text-white/90">{p}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                        <div className="flex items-center gap-1.5 text-[10px] text-white/50 uppercase font-bold tracking-widest mb-1"><Hash size={12}/> Recommended Hashtags</div>
                        <div className="text-sm text-violet-300 font-medium tracking-wide">
                          {marketingData.hashtags?.join(' ')}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className={`relative rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_0_60px_rgba(15,23,42,0.3)] backdrop-blur-md ${!isPremium ? 'opacity-60' : ''}`}>
                  {!isPremium && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[28px] bg-black/70 backdrop-blur-md">
                      <Lock size={32} className="mb-3 text-amber-300" />
                      <p className="text-sm font-bold text-white uppercase tracking-wider">Pro Subscription Required</p>
                      <p className="text-xs text-white/60 mt-2 max-w-xs text-center px-4">Upgrade to unlock the subtitle editor and correct AI transcription errors.</p>
                      <button
                        onClick={handleUpgradeClick}
                        className="mt-4 rounded-full bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 px-6 py-2.5 text-sm font-bold text-black shadow-[0_0_30px_rgba(250,204,21,0.22)]"
                      >
                        Upgrade Plan
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Transcription</div>
                      <h3 className="mt-1 text-lg font-bold text-white">Subtitle Editor</h3>
                    </div>
                    {!isEditing && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white/90 transition hover:bg-white/10"
                      >
                        Edit Text
                      </button>
                    )}
                  </div>

                  <div className="mt-5 pointer-events-auto">
                    {isEditing ? (
                      <div className="space-y-3">
                        <textarea
                          value={editedSubtitles}
                          onChange={(e) => setEditedSubtitles(e.target.value)}
                          className="h-48 w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/90 outline-none transition focus:border-violet-400/50"
                        />
                        <button
                          onClick={handleSaveCaptions}
                          disabled={isUpdatingCaptions}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-bold text-white shadow-[0_0_30px_rgba(168,85,247,0.16)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isUpdatingCaptions ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                          Save Changes
                        </button>
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-6 text-white/80 whitespace-pre-wrap">
                        {subtitles.substring(0, 300)}...
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-[28px] border border-amber-400/20 bg-gradient-to-br from-white/8 to-white/5 p-6 shadow-[0_0_60px_rgba(234,179,8,0.08)] backdrop-blur-md">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.14),transparent_55%)]" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 text-amber-300">
                      <Crown size={18} />
                      <span className="text-sm font-bold uppercase tracking-[0.15em]">Pro Styling Suite</span>
                    </div>

                    <h3 className="mt-3 text-xl font-bold text-white">Advanced Customization</h3>
                    <p className="mt-2 text-sm leading-6 text-white/70">
                      Take control of your brand identity with custom typography, precise positioning, and brand color injection.
                    </p>

                    {!isPremium ? (
                      <div className="mt-6 rounded-[24px] border border-amber-400/20 bg-black/30 p-5 backdrop-blur-md">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
                            <Lock size={20} />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">Unlock Full Suite</div>
                            <div className="mt-1 text-sm leading-6 text-white/60">
                              Access premium fonts, color palettes, and cinematic layouts.
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={handleUpgradeClick}
                          className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 px-5 py-3.5 text-sm font-bold text-black shadow-[0_0_30px_rgba(250,204,21,0.22)] transition hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(250,204,21,0.28)]"
                        >
                          Unlock PRO Features
                        </button>
                      </div>
                    ) : (
                      <div className="mt-6 grid grid-cols-2 gap-4">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                          <div className="text-xs text-white/50 uppercase tracking-widest font-semibold">Subscription</div>
                          <div className="mt-1 text-sm font-bold text-emerald-400">Active PRO Plan</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                          <div className="text-xs text-white/50 uppercase tracking-widest font-semibold">Export Quality</div>
                          <div className="mt-1 text-sm font-bold text-white">Studio Grade</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className={`rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-md ${!isPremium ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="flex flex-col gap-2.5">
                      <label className="text-xs font-bold uppercase tracking-[0.15em] text-white/50 flex items-center gap-1.5"><Palette size={14}/> Brand Color</label>
                      <input
                        type="color"
                        value={captionColor}
                        onChange={(e) => setCaptionColor(e.target.value)}
                        className="h-12 w-full cursor-pointer rounded-2xl border border-white/10 bg-transparent p-1"
                      />
                    </div>

                    <div className="flex flex-col gap-2.5">
                      <label className="text-xs font-bold uppercase tracking-[0.15em] text-white/50 flex items-center gap-1.5"><Type size={14}/> Typography</label>
                      <select
                        value={isPremium ? captionFont : 'Arial'}
                        onChange={(e) => {
                          if (isPremium) setCaptionFont(e.target.value);
                        }}
                        className="h-12 rounded-2xl border border-white/10 bg-black/40 px-4 text-sm font-medium text-white outline-none transition focus:border-violet-400/50 appearance-none"
                      >
                        <option value="Impact">Impact (Cinematic)</option>
                        <option value="Arial">Arial (Clean)</option>
                        <option value="Roboto">Roboto (Modern)</option>
                        <option value="Courier">Courier (Typewriter)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      <label className="text-xs font-bold uppercase tracking-[0.15em] text-white/50">Scale</label>
                      <div className="flex items-center gap-3 h-12 bg-black/40 px-4 rounded-2xl border border-white/10">
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
                        <span className="text-xs font-bold text-white/70 w-8 text-right">{isPremium ? captionSize : '42'}px</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      <label className="text-xs font-bold uppercase tracking-[0.15em] text-white/50 flex items-center gap-1.5"><MoveVertical size={14}/> Layout</label>
                      <select
                        value={isPremium ? captionPosition : 'south'}
                        onChange={(e) => {
                          if (isPremium) setCaptionPosition(e.target.value);
                        }}
                        className="h-12 rounded-2xl border border-white/10 bg-black/40 px-4 text-sm font-medium text-white outline-none transition focus:border-violet-400/50 appearance-none"
                      >
                        <option value="south">Bottom Action Safe</option>
                        <option value="center">Center Viewport</option>
                        <option value="north">Top Title Safe</option>
                      </select>
                    </div>
                  </div>
                </div>

                {downloadUrl && (
                  isSignedIn ? (
                    <a
                      href={downloadUrl}
                      download
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-4 text-sm font-bold text-black shadow-[0_0_40px_rgba(255,255,255,0.2)] transition hover:scale-[1.02] hover:bg-gray-100"
                    >
                      <Download size={18} /> Export Final Video
                    </a>
                  ) : (
                    <div className="mt-4 w-full text-center bg-white/5 rounded-3xl p-6 border border-white/10">
                      <h4 className="text-lg font-bold text-white mb-2">Ready to Export?</h4>
                      <p className="text-sm text-white/60 mb-5 max-w-sm mx-auto">Create a free account to download your watermarked video and save your workflow.</p>
                      <SignInButton mode="modal">
                        <button className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold text-black shadow-lg transition hover:scale-[1.02]">
                          <Download size={18} /> Sign up to Download
                        </button>
                      </SignInButton>
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
                    setMarketingData(null);
                    setEditedSubtitles('');
                    setCloudSubId(null);
                    setIsEditing(false);
                  }}
                  className="mt-2 w-full py-2 text-sm font-medium text-white/40 transition hover:text-white"
                >
                  Clear and start a new project
                </button>
              </div>
            </motion.section>
          )}

          {!videoUrl && (
            <section className="mx-auto max-w-5xl px-6 py-32 md:px-8 relative z-10">
              <div className="text-center mb-16">
                <h2 className="text-3xl font-bold tracking-tight text-white md:text-5xl">Simple, transparent pricing</h2>
                <p className="mt-4 text-white/60 text-lg max-w-2xl mx-auto">Start generating viral clips for free, upgrade when you need professional studio tools and zero limits.</p>
              </div>

              <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
                <div className="rounded-[32px] border border-white/10 bg-white/5 p-8 backdrop-blur-md flex flex-col">
                  <div className="text-white/60 font-bold tracking-wider uppercase text-sm mb-2">Hobby</div>
                  <div className="text-4xl font-bold text-white mb-6">$0<span className="text-lg text-white/40 font-normal">/mo</span></div>
                  <p className="text-white/60 text-sm mb-8 leading-relaxed">Perfect for beginners and creators just starting their viral journey.</p>
                  
                  <div className="flex-1 space-y-4 mb-8">
                    <div className="flex items-center gap-3 text-sm text-white/80"><CheckCircle size={18} className="text-emerald-400" /> Auto AI Captions</div>
                    <div className="flex items-center gap-3 text-sm text-white/80"><CheckCircle size={18} className="text-emerald-400" /> AI Growth Strategy</div>
                    <div className="flex items-center gap-3 text-sm text-white/80"><CheckCircle size={18} className="text-emerald-400" /> Max 100MB / 5 mins duration</div>
                    <div className="flex items-center gap-3 text-sm text-white/40"><Lock size={16} /> No Watermark</div>
                    <div className="flex items-center gap-3 text-sm text-white/40"><Lock size={16} /> Custom Fonts & Colors</div>
                    <div className="flex items-center gap-3 text-sm text-white/40"><Lock size={16} /> Subtitle Editor</div>
                  </div>

                  {!isSignedIn ? (
                    <SignInButton mode="modal">
                      <button className="w-full rounded-full border border-white/20 bg-white/5 py-3.5 text-sm font-bold text-white transition hover:bg-white/10">Get Started Free</button>
                    </SignInButton>
                  ) : (
                    <button disabled className="w-full rounded-full border border-white/10 bg-white/5 py-3.5 text-sm font-bold text-white/40 cursor-not-allowed">Current Plan</button>
                  )}
                </div>

                <div className="rounded-[32px] border border-violet-500/30 bg-gradient-to-b from-violet-500/10 to-fuchsia-500/5 p-8 backdrop-blur-md flex flex-col relative overflow-hidden shadow-[0_0_50px_rgba(168,85,247,0.15)]">
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500"></div>
                  <div className="text-violet-400 font-bold tracking-wider uppercase text-sm mb-2 flex items-center gap-2"><Crown size={16}/> Pro Studio</div>
                  <div className="text-4xl font-bold text-white mb-6">$9.99<span className="text-lg text-white/40 font-normal">/mo</span></div>
                  <p className="text-white/60 text-sm mb-8 leading-relaxed">Everything you need to produce cinematic, brand-aligned viral content.</p>
                  
                  <div className="flex-1 space-y-4 mb-8">
                    <div className="flex items-center gap-3 text-sm text-white/90"><CheckCircle size={18} className="text-violet-400" /> Full Subtitle Editor Access</div>
                    <div className="flex items-center gap-3 text-sm text-white/90"><CheckCircle size={18} className="text-violet-400" /> Cinematic Custom Fonts</div>
                    <div className="flex items-center gap-3 text-sm text-white/90"><CheckCircle size={18} className="text-violet-400" /> Brand Color Injection</div>
                    <div className="flex items-center gap-3 text-sm text-white/90"><CheckCircle size={18} className="text-violet-400" /> Advanced Layout Controls</div>
                    <div className="flex items-center gap-3 text-sm text-white/90"><CheckCircle size={18} className="text-violet-400" /> Zero Watermarks</div>
                    <div className="flex items-center gap-3 text-sm text-white/90"><CheckCircle size={18} className="text-violet-400" /> Priority Cloud Rendering</div>
                  </div>

                  {isPremium ? (
                    <button disabled className="w-full rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 py-3.5 text-sm font-bold flex items-center justify-center gap-2">
                      <CheckCircle size={18}/> Active Plan
                    </button>
                  ) : (
                    <button onClick={handleUpgradeClick} className="w-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 py-3.5 text-sm font-bold text-white transition hover:scale-[1.02] shadow-[0_0_20px_rgba(168,85,247,0.3)]">
                      Upgrade to PRO
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}
        </main>

        <footer className="border-t border-white/5 bg-[#03050d] pt-12 pb-8 mt-auto z-10 relative">
          <div className="mx-auto max-w-7xl px-6 md:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[10px] font-bold">V</div>
                <span className="text-sm font-bold tracking-widest text-white/80 uppercase">ViralFlow AI</span>
              </div>
              
              <div className="flex flex-wrap justify-center gap-8 text-sm text-white/40 font-medium">
                <a href="/terms" className="hover:text-white transition">Terms of Service</a>
                <a href="/privacy" className="hover:text-white transition">Privacy Policy</a>
                <a href="/contact" className="hover:text-white transition flex items-center gap-2">
                  Contact Support
                </a>
              </div>
            </div>
            <div className="mt-8 text-center text-xs text-white/20">
              © {new Date().getFullYear()} ViralFlow AI. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}