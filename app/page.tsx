"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Zap, Loader2, AlertCircle, Download, Edit3, X, Check, Crown, Palette, Type, MoveVertical, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";

export default function LandingPage() {
  // 🟢 FIX: Clerk hooks called ONCE at the top
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
  const [vidDimensions, setVidDimensions] = useState({ w: 1080, h: 1920 }); // Native video resolution
  const [renderedPlayerDimensions, setRenderedPlayerDimensions] = useState({ w: 0, h: 0 }); // Rendered player size on screen
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cloudinaryUploadAbortRef = useRef<AbortController | null>(null);
  
  // Live Preview VTT State
  const [vttPreviewUrl, setVttPreviewUrl] = useState<string>("");

  // Edit Feature States
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubtitles, setEditedSubtitles] = useState<string>("");
  const [isUpdatingCaptions, setIsUpdatingCaptions] = useState(false);

  // 💰 Business Model State - FIX: user is now defined before this line
  const isPremium = user?.publicMetadata?.isPremium === true;

  // 👑 Premium Styling States
  const [captionColor, setCaptionColor] = useState("#FACC15");
  const [captionFont, setCaptionFont] = useState("Impact");
  const [captionSize, setCaptionSize] = useState("42");
  const [captionPosition, setCaptionPosition] = useState("south");

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
      if (nextLine.length <= maxCharsPerLine || currentLine.length === 0) {
        currentLine = nextLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);
    return lines.join('\n');
  }, []);

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
          
          // Capture Native Video Dimensions for Perfect Scaling
          setVidDimensions({ 
            w: uploadData.width || 1080, 
            h: uploadData.height || 1920 
          });
          
          setVideoUrl(uploadedVideoUrl);
          
          setUploadStatus('processing');
          try {
            const aiRes = await fetch('/api/process-video', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ videoUrl: uploadedVideoUrl }),
            });
            
            const aiData = await aiRes.json();
            if (aiData.subtitles) {
              setSubtitles(aiData.subtitles);
              setEditedSubtitles(aiData.subtitles);

              await uploadVttAndGenerateUrl(uploadedVideoUrl, aiData.subtitles);
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
        }
        setIsUploading(false);
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
      console.error("VTT Upload Error:", vttErr);
    }
  };

  // 🔥 Proportional Scaling Engine
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
    const activeColor = isPremium ? color : "#FACC15";
    const activeFont = isPremium ? font : "Impact";
    const activeCssFontSize = isPremium ? cssFontSize : 35;

    const renderedPlayerWidth = renderedDimensions.w;
    const nativeVideoWidth = nativeDimensions.w;
    const nativeVideoHeight = nativeDimensions.h;

    // Exact width ratio requested: nativeVideoWidth / renderedPlayerWidth
    const widthRatio = renderedPlayerWidth > 0 ? nativeVideoWidth / renderedPlayerWidth : 1;
    // Cloudinary subtitle glyph metrics render larger than browser ::cue in most fonts, so apply a parity factor.
    const cloudinaryParityFactor = 0.78;
    const cloudFontSize = Math.max(12, Math.round(activeCssFontSize * widthRatio * cloudinaryParityFactor));
    
    const borderThickness = Math.max(2, Math.round(cloudFontSize / 12));

    const cleanColor = activeColor.replace('#', '');
    
    const linePercent = getLinePercentForPosition(position);
    let gravity = 'south';
    let yOffset = Math.round(nativeVideoHeight * ((100 - linePercent) / 100)).toString();

    if (isPremium) {
      if (position === 'north') {
        gravity = 'north';
        yOffset = Math.round(nativeVideoHeight * (linePercent / 100)).toString();
      } else if (position === 'center') {
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
    const blob = new Blob([styledVtt], { type: 'text/vtt' });
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

  // 🟢 FIX: Clean Upgrade Function with proper checks
  const handleUpgradeClick = () => {
    if (!user) {
      alert("Please Sign In first to upgrade to PRO!");
      return; 
    }
    
    // ඔයාගේ Lemon Squeezy Checkout Link එක මෙතන දාන්න
    const baseUrl = "https://nexgynix.lemonsqueezy.com/checkout/buy/4019e697-f418-430a-a596-031fc7ab56fb";
    
    // URL එකේ අගට ?checkout[custom][user_id]=... කියලා අමුණනවා
    const checkoutUrl = `${baseUrl}?checkout[custom][user_id]=${user.id}`;
    
    window.open(checkoutUrl, "_blank");
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-purple-500/30">
      
      {/* 🟢 PROPORTIONAL CSS INJECTION FOR PERFECT WEB PREVIEW */}
      <style dangerouslySetInnerHTML={{
        __html: `
        video::cue {
          color: ${isPremium ? captionColor : '#FACC15'} !important;
          font-family: '${isPremium ? captionFont : 'Impact'}', sans-serif !important;
          font-size: ${isPremium ? parseInt(captionSize, 10) : 35}px !important;
          font-weight: 900 !important;
          text-transform: uppercase !important;
          background-color: transparent !important;
          text-shadow: 
            3px 3px 0px #000000, 
            -3px -3px 0px #000000, 
            3px -3px 0px #000000, 
            -3px 3px 0px #000000,
            5px 5px 15px rgba(0, 0, 0, 0.8) !important;
        }
      `}} />

      {/* Navbar */}
      <nav className="flex justify-between items-center px-8 py-6 border-b border-white/5 backdrop-blur-md sticky top-0 z-50">
        <div className="text-xl font-bold tracking-tighter flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center font-bold">V</div>
          ViralFlow AI
        </div>
        
        <div className="flex items-center gap-4">
          {!isSignedIn ? (
            <SignInButton mode="modal">
              <button className="bg-white text-black px-5 py-2 rounded-full text-sm font-medium hover:bg-gray-200 transition">
                Sign In
              </button>
            </SignInButton>
          ) : (
            <div className="flex items-center gap-4">
               {isPremium && <span className="bg-yellow-500/20 text-yellow-500 text-xs font-bold px-3 py-1 rounded-full border border-yellow-500/50 flex items-center gap-1"><Crown size={12}/> PRO</span>}
               <UserButton />
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 pt-20 pb-12 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <span className="px-4 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-400 text-xs font-medium inline-block mb-6">
            Powered by AssemblyAI
          </span>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
            Viral Clips with <br /> "Chad" Captions
          </h1>
        </motion.div>

        <motion.div 
          className="max-w-4xl mx-auto p-8 rounded-3xl border-2 border-dashed border-white/10 bg-white/5 backdrop-blur-sm hover:border-purple-500/40 transition-all relative overflow-hidden"
        >
          {!file && !isUploading && (
            <input 
              type="file" 
              accept="video/*" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
              onChange={handleFileChange}
            />
          )}
          
          <div className="flex flex-col items-center relative z-20">
            {uploadStatus === 'success' && videoUrl ? (
              <div className="w-full flex flex-col md:flex-row gap-8">
                
                {/* Left Side: Video Player */}
                <div className="flex-1 animate-in slide-in-from-left duration-500">
                  <div className="relative rounded-2xl overflow-hidden border-2 border-white/20 shadow-[0_0_40px_rgba(168,85,247,0.4)] bg-black mb-4">
                    <video 
                      ref={videoRef}
                      controls 
                      controlsList="nodownload"
                      autoPlay 
                      className="w-full aspect-[9/16] object-cover"
                      crossOrigin="anonymous"
                      onLoadedMetadata={handleVideoLoadedMetadata}
                    >
                      <source src={videoUrl} type="video/mp4" />
                      {vttPreviewUrl && (
                        <track 
                          label="Chad Captions" 
                          kind="subtitles" 
                          srcLang="en" 
                          src={vttPreviewUrl} 
                          default 
                        />
                      )}
                    </video>
                  </div>
                </div>

                {/* Right Side: Tools & Premium Controls */}
                <div className="flex-1 flex flex-col gap-4 animate-in slide-in-from-right duration-500 text-left">
                  
                  {/* Edit Captions Box */}
                  <div className="bg-black/40 p-5 rounded-2xl border border-white/10">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold flex items-center gap-2"><Edit3 size={18} className="text-purple-400"/> Edit Text</h4>
                      {!isEditing ? (
                         <button onClick={() => setIsEditing(true)} className="text-xs bg-white/10 px-3 py-1 rounded-full hover:bg-white/20 transition">Edit Mode</button>
                      ) : null}
                    </div>
                    
                    {isEditing ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          value={editedSubtitles}
                          onChange={(e) => setEditedSubtitles(e.target.value)}
                          className="w-full h-32 bg-black/60 border border-purple-500/30 rounded-lg p-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                        />
                        <button 
                          onClick={handleSaveCaptions}
                          disabled={isUpdatingCaptions}
                          className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition"
                        >
                          {isUpdatingCaptions ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                          Save Changes
                        </button>
                      </div>
                    ) : (
                      <div className="h-32 overflow-y-auto text-xs text-gray-400 font-mono whitespace-pre-wrap bg-black/20 p-2 rounded border border-white/5">
                        {subtitles.substring(0, 200)}...
                      </div>
                    )}
                  </div>

                  {/* 👑 Premium Styling Box */}
                  <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 p-5 rounded-2xl border border-purple-500/30 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-yellow-600" />
                    
                    <h4 className="font-bold flex items-center gap-2 text-yellow-400 mb-4">
                      <Crown size={18} /> Pro Styling Features
                    </h4>

                    {!isPremium && (
                      <div className="absolute inset-0 z-10 bg-[#050505]/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-2xl border border-yellow-500/20">
                        <div className="bg-yellow-500/20 p-3 rounded-full mb-3">
                           <Lock className="text-yellow-500" size={24} />
                        </div>
                        <h5 className="font-bold text-white mb-1">Premium Feature</h5>
                        <p className="text-xs text-gray-400 mb-4 px-6 text-center">Unlock custom colors, fonts, sizes, and realtime live preview.</p>
                        <button 
                           onClick={handleUpgradeClick}
                           className="bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-2 rounded-full font-bold text-sm shadow-[0_0_20px_rgba(234,179,8,0.3)] transition transform hover:scale-105"
                        >
                           Upgrade to PRO
                        </button>
                      </div>
                    )}
                    
                    <div className={`grid grid-cols-2 gap-4 transition-all duration-500 ${!isPremium ? 'opacity-30 blur-[2px] pointer-events-none' : ''}`}>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-400 flex items-center gap-1"><Palette size={12}/> Color</label>
                        <input 
                          type="color" 
                          value={captionColor}
                          onChange={(e) => setCaptionColor(e.target.value)}
                          className="w-full h-10 rounded cursor-pointer bg-transparent border-0"
                        />
                      </div>
                      
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-400 flex items-center gap-1"><Type size={12}/> Font</label>
                        <select 
                          value={captionFont}
                          onChange={(e) => setCaptionFont(e.target.value)}
                          className="bg-black/50 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none"
                        >
                          <option value="Impact">Impact (Chad)</option>
                          <option value="Arial">Arial (Clean)</option>
                          <option value="Roboto">Roboto (Modern)</option>
                          <option value="Courier">Courier (Hacker)</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-400">Font Size (CSS px)</label>
                        <input 
                          type="range" 
                          min="20" max="60" 
                          value={captionSize}
                          onChange={(e) => setCaptionSize(e.target.value)}
                          className="w-full accent-yellow-400"
                        />
                        <span className="text-xs text-gray-500">{captionSize}px</span>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-400 flex items-center gap-1"><MoveVertical size={12}/> Position</label>
                        <select 
                          value={captionPosition}
                          onChange={(e) => setCaptionPosition(e.target.value)}
                          className="bg-black/50 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none"
                        >
                          <option value="south">Bottom</option>
                          <option value="center">Middle</option>
                          <option value="north">Top</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {downloadUrl && (
                    <a 
                      href={downloadUrl} 
                      download
                      className="mt-2 flex items-center justify-center gap-2 bg-yellow-500 text-black px-6 py-4 rounded-xl font-black text-lg hover:bg-yellow-400 transition shadow-[0_0_20px_rgba(234,179,8,0.4)] w-full"
                    >
                      <Download size={24} /> Download Viral Clip
                    </a>
                  )}

                  <button 
                    onClick={() => {
                      setFile(null);
                      setVideoUrl(null);
                      setDownloadUrl(null);
                      setUploadStatus('idle');
                    }}
                    className="mt-2 text-sm text-gray-400 hover:text-white transition underline underline-offset-4 text-center"
                  >
                    Start Over
                  </button>

                </div>
              </div>
            ) : uploadStatus === 'processing' ? (
              <div className="flex flex-col items-center">
                <Loader2 className="text-purple-400 animate-spin mb-4" size={48} />
                <h3 className="text-xl font-semibold">AI is Listening...</h3>
                <p className="text-gray-500 text-sm mt-2">Generating bold viral captions</p>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4 relative">
                  {isUploading ? (
                    <span className="text-xs font-bold text-purple-400">{uploadProgress}%</span>
                  ) : (
                    <Upload className="text-purple-400" size={32} />
                  )}
                  {isUploading && <Loader2 className="absolute inset-0 text-purple-600 animate-spin" size={64} />}
                </div>

                <h3 className="text-xl font-semibold mb-2">
                  {file ? file.name : "Select Video to Start"}
                </h3>

                {isUploading && (
                  <div className="w-full max-w-xs bg-white/10 h-1 rounded-full mt-4 overflow-hidden">
                    <div className="bg-purple-600 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                )}

                {file && !isUploading && (
                  <button 
                    onClick={handleUpload}
                    className="mt-6 z-20 flex items-center gap-2 bg-purple-600 px-8 py-3 rounded-xl font-semibold hover:bg-purple-500 transition shadow-lg"
                  >
                    Generate Viral Clip <Zap size={18} />
                  </button>
                )}
              </>
            )}
            
            {uploadStatus === 'error' && (
              <div className="mt-4 text-red-400 flex items-center gap-2 text-sm">
                <AlertCircle size={16} /> Something went wrong. Try again.
              </div>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}