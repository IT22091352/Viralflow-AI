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
  const [captionSize, setCaptionSize] = useState("20"); 
  const [captionPosition, setCaptionPosition] = useState("south");

  // 🟢 FIX 1: Page එක Load වෙද්දි කලින් හදපු Video එකක් (Local Storage එකේ) තියෙනවද බලලා Load කරනවා
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedState = localStorage.getItem('viralflow_recovery_state');
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          if (parsed.uploadStatus === 'success' && parsed.videoUrl) {
            setVideoUrl(parsed.videoUrl);
            setSubtitles(parsed.subtitles);
            setEditedSubtitles(parsed.subtitles);
            setCloudSubId(parsed.cloudSubId);
            setVidDimensions(parsed.vidDimensions || { w: 1080, h: 1920 });
            setMarketingData(parsed.marketingData || null);
            setUploadStatus('success');
          }
        } catch (e) {
          console.error("Failed to restore state", e);
        }
      }
    }
  }, []);

  // 🟢 FIX 2: Video එකක් සාර්ථකව හැදුවම, ඒක බ්‍රවුසරයේ Local Storage එකේ Save කරනවා
  useEffect(() => {
    if (typeof window !== 'undefined' && uploadStatus === 'success' && videoUrl) {
      const stateToSave = {
        videoUrl,
        subtitles,
        cloudSubId,
        vidDimensions,
        marketingData,
        uploadStatus: 'success'
      };
      localStorage.setItem('viralflow_recovery_state', JSON.stringify(stateToSave));
    }
  }, [uploadStatus, videoUrl, subtitles, cloudSubId, vidDimensions, marketingData]);

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

  const wrapCueText = useCallback((text: string) => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return text;
    
    const lines: string[] = [];
    let currentLine = '';
    const maxChars = 22; 
    
    for (const word of words) {
      if ((currentLine + word).length > maxChars && currentLine.length > 0) {
        lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    }
    if (currentLine) lines.push(currentLine.trim());
    return lines.join('\n');
  }, []);

  const buildStyledVtt = useCallback((rawVtt: string) => {
    const activePosition = isPremium ? captionPosition : 'south';
    const linePercent = getLinePercentForPosition(activePosition);
    const activeCssFontSize = isPremium ? parseInt(captionSize, 10) : 20;

    const playerW = renderedPlayerDimensions.w > 0 ? renderedPlayerDimensions.w : 300;
    const estimatedCharWidth = activeCssFontSize * 0.55; 
    const maxCharsPerLine = Math.max(12, Math.floor((playerW * 0.9) / estimatedCharWidth));

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
      const wrappedCueText = wrapCueText(cueText); 
      
      const withSettings = `${timingLine} line:${linePercent}% position:50% align:center`;

      return [
        ...lines.slice(0, timingIndex),
        withSettings,
        wrappedCueText,
      ].join('\n');
    });

    return styledSections.join('\n\n');
  }, [captionPosition, captionSize, isPremium, renderedPlayerDimensions.w, getLinePercentForPosition, wrapCueText]);

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
        setMarketingData(null);
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
      setCaptionSize('20');
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
    nativeDimensions: { w: number, h: number }
  ) => {
    const activeColor = isPremium ? color : '#FACC15';
    const activeFont = isPremium ? font : 'Arial';
    const activeCssFontSize = isPremium ? cssFontSize : 20;
    const activePosition = isPremium ? position : 'south';

    const nativeW = nativeDimensions.w > 0 ? nativeDimensions.w : 1080;
    const nativeH = nativeDimensions.h > 0 ? nativeDimensions.h : 1920;

    const scaleFactor = nativeW / 600; 
    const cloudFontSize = Math.max(18, Math.round(activeCssFontSize * scaleFactor));
    const borderThickness = Math.max(2, Math.round(cloudFontSize / 12));
    
    const cleanColor = activeColor.replace('#', '');
    const linePercent = getLinePercentForPosition(activePosition);
    let gravity = 'south';
    let yOffset = Math.round(nativeH * ((100 - linePercent) / 100)).toString();

    if (isPremium) {
      if (activePosition === 'north') {
        gravity = 'north';
        yOffset = Math.round(nativeH * (linePercent / 100)).toString();
      } else if (activePosition === 'center') {
        gravity = 'center';
        yOffset = '0';
      } else {
        gravity = 'south';
        yOffset = Math.round(nativeH * ((100 - linePercent) / 100)).toString();
      }
    }

    const magicString = `/upload/fl_attachment:ViralFlow_Clip/l_subtitles:${activeFont}_${cloudFontSize}:${subId},co_rgb:${cleanColor},bo_${borderThickness}px_solid_black,g_${gravity},y_${yOffset}/`;
    const newBurnInUrl = vidUrl.replace('/upload/', magicString);
    setDownloadUrl(newBurnInUrl);
  };

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
      const cssFontSize = isPremium ? parseInt(captionSize, 10) : 20;
      const activePosition = isPremium ? captionPosition : 'south';
      updateCloudinaryUrl(
        videoUrl, cloudSubId, captionColor, captionFont, cssFontSize, activePosition, vidDimensions
      );
    }
    return () => URL.revokeObjectURL(url);
  }, [subtitles, captionColor, captionFont, captionSize, captionPosition, isPremium, videoUrl, cloudSubId, vidDimensions, buildStyledVtt]);

  const handleSaveCaptions = async () => {
    if (!videoUrl) return;
    setIsUpdatingCaptions(true);
    setSubtitles(editedSubtitles);
    setIsEditing(false);
    setIsUpdatingCaptions(false);
    
    // 🟢 FIX: Update local storage when user edits subtitles
    if (typeof window !== 'undefined') {
      const savedState = localStorage.getItem('viralflow_recovery_state');
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState);
          parsed.subtitles = editedSubtitles;
          localStorage.setItem('viralflow_recovery_state', JSON.stringify(parsed));
        } catch(e) {}
      }
    }
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
          color: ${isPremium ? captionColor : '#FACC15'} !important;
          font-family: ${isPremium ? `'${captionFont}', sans-serif` : `'Inter', 'Segoe UI', sans-serif`} !important;
          font-size: ${isPremium ? parseInt(captionSize, 10) : 20}px !important;
          font-weight: 800 !important;
          text-transform: none !important;
          background-color: rgba(0, 0, 0, 0.25) !important;
          text-shadow: 0 3px 15px rgba(0, 0, 0, 0.5) !important;
          letter-spacing: 0.02em !important;
          white-space: pre-wrap !important;
          line-height: 1.3 !important;
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
              <Zap size={14} className="mr-1.5 text-violet-400" /> The Ultimate AI Caption Generator
            </span>

            <h1 className="mt-6 text-5xl font-bold tracking-tight text-white md:text-7xl">
              Add Viral AI Captions to <br/> Your Videos in Seconds.
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/65 md:text-lg">
              Upload any video and let AI automatically generate perfectly synced, highly engaging subtitles. Customize fonts, colors, and layout to match your personal brand instantly.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-white/70 font-medium">
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-400"/> 99% Accuracy</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-400"/> Auto-Highlighting</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md flex items-center gap-1.5"><CheckCircle size={14} className="text-emerald-400"/> Pro Export</span>
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
                      <span className="text-xs text-amber-200/70 mt-2 block font-semibold">⚠️ Currently supporting English audio only.</span>
                      <span className="text-[11px] text-white/40 mt-1 block font-medium">(Supported formats: MP4, MOV. Max size: 100MB or 5 mins)</span>
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
                        Processing failed. Please try a shorter video.
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
              className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)] items-start"
            >
              
              <div className="flex flex-col gap-6 h-fit lg:sticky lg:top-24">
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

                <div className="relative overflow-hidden rounded-[28px] border border-amber-400/20 bg-[#0a0a0a]/80 shadow-[0_0_60px_rgba(234,179,8,0.05)] backdrop-blur-md">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.1),transparent_50%)] pointer-events-none" />

                  <div className="p-5 border-b border-white/5 relative z-10 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2 text-amber-300 mb-0.5">
                        <Crown size={16} />
                        <span className="text-xs font-bold uppercase tracking-[0.15em]">Pro Styling</span>
                      </div>
                    </div>
                    {isPremium ? (
                      <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Active</span>
                    ) : (
                      <button onClick={handleUpgradeClick} className="bg-gradient-to-r from-amber-300 to-amber-500 text-black px-4 py-1.5 rounded-full text-xs font-bold hover:scale-105 transition shadow-[0_0_15px_rgba(250,204,21,0.4)]">
                        Unlock PRO
                      </button>
                    )}
                  </div>

                  <div className={`p-6 relative z-10 ${!isPremium ? 'opacity-30 blur-[2px] pointer-events-none' : ''}`}>
                    <div className="grid grid-cols-2 gap-5">
                      <div className="flex flex-col gap-2.5">
                        <label className="text-xs font-bold uppercase tracking-[0.15em] text-white/50 flex items-center gap-1.5"><Palette size={14}/> Color</label>
                        <input type="color" value={captionColor} onChange={(e) => setCaptionColor(e.target.value)} className="h-10 w-full cursor-pointer rounded-xl border border-white/10 bg-transparent p-1" />
                      </div>
                      <div className="flex flex-col gap-2.5">
                        <label className="text-xs font-bold uppercase tracking-[0.15em] text-white/50 flex items-center gap-1.5"><Type size={14}/> Font</label>
                        <select value={isPremium ? captionFont : 'Arial'} onChange={(e) => { if (isPremium) setCaptionFont(e.target.value); }} className="h-10 rounded-xl border border-white/10 bg-black/40 px-3 text-sm font-medium text-white outline-none transition focus:border-violet-400/50 appearance-none">
                          <option value="Impact">Impact (Cinematic)</option>
                          <option value="Arial">Arial (Clean)</option>
                          <option value="Roboto">Roboto (Modern)</option>
                          <option value="Courier">Courier (Typewriter)</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-2.5">
                        <label className="text-xs font-bold uppercase tracking-[0.15em] text-white/50">Scale</label>
                        <div className="flex items-center gap-3 h-10 bg-black/40 px-3 rounded-xl border border-white/10">
                          <input type="range" min="20" max="60" value={isPremium ? captionSize : '20'} onChange={(e) => { if (isPremium) setCaptionSize(e.target.value); }} className="w-full accent-violet-400" />
                          <span className="text-xs font-bold text-white/70 w-8 text-right">{isPremium ? captionSize : '20'}px</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2.5">
                        <label className="text-xs font-bold uppercase tracking-[0.15em] text-white/50 flex items-center gap-1.5"><MoveVertical size={14}/> Layout</label>
                        <select value={isPremium ? captionPosition : 'south'} onChange={(e) => { if (isPremium) setCaptionPosition(e.target.value); }} className="h-10 rounded-xl border border-white/10 bg-black/40 px-3 text-sm font-medium text-white outline-none transition focus:border-violet-400/50 appearance-none">
                          <option value="south">Bottom Action Safe</option>
                          <option value="center">Center Viewport</option>
                          <option value="north">Top Title Safe</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {!isPremium && (
                    <div className="absolute inset-x-0 bottom-0 top-[70px] z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-b-[28px]">
                      <Lock size={24} className="text-amber-300 mb-2" />
                      <p className="text-sm font-bold text-white mb-3">Custom Styling Locked</p>
                      <button onClick={handleUpgradeClick} className="rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-6 py-2 text-xs font-bold text-black shadow-[0_0_20px_rgba(250,204,21,0.3)] transition hover:scale-105">
                        Upgrade to Use
                      </button>
                    </div>
                  )}
                </div>
              </div>


              <div className="flex flex-col gap-6">
                
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

                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-md flex flex-col items-center text-center">
                  {downloadUrl && (
                    isSignedIn ? (
                      <a
                        href={downloadUrl}
                        download
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-4 text-sm font-bold text-black shadow-[0_0_40px_rgba(255,255,255,0.2)] transition hover:scale-[1.02] hover:bg-gray-100"
                      >
                        <Download size={18} /> Export Final Video
                      </a>
                    ) : (
                      <div className="w-full">
                        <h4 className="text-lg font-bold text-white mb-2">Ready to Export?</h4>
                        <p className="text-sm text-white/60 mb-5 max-w-sm mx-auto">Create a free account to download your video and save your workflow.</p>
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
                      // 🟢 FIX 3: Start over කරද්දි Local Storage එකත් Clear කරනවා
                      if (typeof window !== 'undefined') {
                        localStorage.removeItem('viralflow_recovery_state');
                      }
                    }}
                    className="mt-4 py-2 text-sm font-medium text-white/40 transition hover:text-white"
                  >
                    Clear and start a new project
                  </button>
                </div>
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
                    <div className="flex items-center gap-3 text-sm text-white/80"><CheckCircle size={18} className="text-emerald-400" /> Auto AI Captions (English)</div>
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